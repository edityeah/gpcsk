/**
 * Tests for GET /api/programs and the two AI program tools.
 *
 * 1. GET /api/programs — requires auth, returns well-formed catalog
 * 2. GET /api/programs — shape: each program has required fields
 * 3. AI tool: queryAllPrograms returns all programs via handleDataTool
 * 4. AI tool: queryProgramHealth returns single program summary for a valid ID
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'
import { computeProgramStats } from './router.js'

// ── Setup ────────────────────────────────────────────────────────────────────

const app = buildApp()
let srToken = ''

beforeAll(async () => {
  await seedDemoUsers(prisma)
  const sr = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000005' } })
  srToken = signToken({ sub: sr.id, role: sr.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ── GET /api/programs ────────────────────────────────────────────────────────

describe('GET /api/programs', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/programs')
    expect(res.status).toBe(401)
  })

  it('returns 200 with programs array containing all 8 entries', async () => {
    const res = await request(app)
      .get('/api/programs')
      .set('Authorization', `Bearer ${srToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.programs)).toBe(true)
    expect((res.body.programs as unknown[]).length).toBe(8)
  })

  it('each program has required shape fields', async () => {
    const res = await request(app)
      .get('/api/programs')
      .set('Authorization', `Bearer ${srToken}`)

    for (const p of res.body.programs as Record<string, unknown>[]) {
      expect(typeof p['id']).toBe('string')
      expect(typeof p['name']).toBe('string')
      expect(typeof p['fullName']).toBe('string')
      expect(typeof p['canvasId']).toBe('string')
      expect(typeof p['stationCount']).toBe('number')
      expect(typeof p['activeStationCount']).toBe('number')
      expect(typeof p['currentExceedancesCount']).toBe('number')
      expect(typeof p['recentAnomalyCount30d']).toBe('number')
    }
  })

  it('OCEMS program has a positive stationCount from seeded data', async () => {
    const res = await request(app)
      .get('/api/programs')
      .set('Authorization', `Bearer ${srToken}`)

    const ocems = (res.body.programs as Array<{ id: string; stationCount: number }>)
      .find((p) => p.id === 'OCEMS')

    expect(ocems).toBeDefined()
    expect(ocems!.stationCount).toBeGreaterThan(0)
  })

  it('placeholder programs (NOISE, HAZARDOUS_WASTE, FESTIVAL) have zero counts', async () => {
    const res = await request(app)
      .get('/api/programs')
      .set('Authorization', `Bearer ${srToken}`)

    const placeholders = (
      res.body.programs as Array<{
        id: string
        stationCount: number
        activeStationCount: number
        currentExceedancesCount: number
        recentAnomalyCount30d: number
      }>
    ).filter((p) => ['NOISE', 'HAZARDOUS_WASTE', 'FESTIVAL'].includes(p.id))

    expect(placeholders.length).toBe(3)
    for (const p of placeholders) {
      expect(p.stationCount).toBe(0)
      expect(p.activeStationCount).toBe(0)
      expect(p.currentExceedancesCount).toBe(0)
      expect(p.recentAnomalyCount30d).toBe(0)
    }
  })
})

// ── computeProgramStats unit tests (AI tools) ────────────────────────────────

describe('computeProgramStats (AI tool backing)', () => {
  it('queryAllPrograms: returns all 8 programs', async () => {
    const programs = await computeProgramStats()
    expect(programs.length).toBe(8)
    const ids = programs.map((p) => p.id)
    expect(ids).toContain('OCEMS')
    expect(ids).toContain('AAQM')
    expect(ids).toContain('WATER')
    expect(ids).toContain('VOC')
    expect(ids).toContain('CETP')
    expect(ids).toContain('NOISE')
    expect(ids).toContain('HAZARDOUS_WASTE')
    expect(ids).toContain('FESTIVAL')
  })

  it('queryProgramHealth: returns single program summary for OCEMS', async () => {
    const results = await computeProgramStats(['OCEMS'])
    expect(results.length).toBe(1)
    const ocems = results[0]!
    expect(ocems.id).toBe('OCEMS')
    expect(ocems.fullName).toBe('Online Continuous Effluent Monitoring System')
    expect(ocems.canvasId).toBe('OPEN_OCEMS_LIVE_GRID')
    expect(ocems.stationCount).toBeGreaterThanOrEqual(0)
    expect(typeof ocems.currentExceedancesCount).toBe('number')
  })

  it('queryProgramHealth: returns empty array for unknown programId', async () => {
    const results = await computeProgramStats(['UNKNOWN_PROGRAM'])
    expect(results.length).toBe(0)
  })
})
