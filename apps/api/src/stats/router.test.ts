/**
 * Stats router tests — one per endpoint (5 total).
 *
 * The tests assume the seed data has been applied to the Postgres DB
 * (the CI/dev environment runs the full seed before vitest).
 * Each test calls the real endpoint against the live DB via supertest.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'

const app = buildApp()
let token = ''

beforeAll(async () => {
  await seedDemoUsers(prisma)
  const sr = await prisma.user.findFirstOrThrow({ where: { role: 'SENIOR_REVIEWER' } })
  token = signToken({ sub: sr.id, role: sr.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ── 1. Pulse ──────────────────────────────────────────────────────────────────

describe('GET /api/stats/pulse', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/stats/pulse')
    expect(res.status).toBe(401)
  })

  it('returns expected shape with all four keys', async () => {
    const res = await request(app)
      .get('/api/stats/pulse')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const body = res.body as Record<string, unknown>
    expect(body).toHaveProperty('districtStream')
    expect(body).toHaveProperty('liveExceedanceCount24h')
    expect(body).toHaveProperty('topRiskIndustries')
    expect(body).toHaveProperty('breakingAnomalies')
    expect(typeof body.liveExceedanceCount24h).toBe('number')
    expect(Array.isArray(body.districtStream)).toBe(true)
    expect(Array.isArray(body.topRiskIndustries)).toBe(true)
    expect(Array.isArray(body.breakingAnomalies)).toBe(true)
  })

  it('topRiskIndustries has at most 10 entries', async () => {
    const res = await request(app)
      .get('/api/stats/pulse')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const industries = res.body.topRiskIndustries as unknown[]
    expect(industries.length).toBeLessThanOrEqual(10)
  })
})

// ── 2. Risk Index ─────────────────────────────────────────────────────────────

describe('GET /api/stats/risk-index', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/stats/risk-index')
    expect(res.status).toBe(401)
  })

  it('returns an array sorted descending by riskScore', async () => {
    const res = await request(app)
      .get('/api/stats/risk-index')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const rows = res.body as Array<{ riskScore: number; breakdown: Record<string, number> }>
    expect(Array.isArray(rows)).toBe(true)

    // Each entry has the required fields
    if (rows.length > 0) {
      const first = rows[0]!
      expect(first).toHaveProperty('industryId')
      expect(first).toHaveProperty('name')
      expect(first).toHaveProperty('category')
      expect(first).toHaveProperty('riskScore')
      expect(first).toHaveProperty('breakdown')
      expect(first.breakdown).toHaveProperty('exceedance30d')
      expect(first.breakdown).toHaveProperty('complaints30d')
      expect(first.breakdown).toHaveProperty('openInspections')
      expect(first.breakdown).toHaveProperty('consentGapDays')
    }

    // Verify sort order
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.riskScore).toBeGreaterThanOrEqual(rows[i]!.riskScore)
    }
  })

  it('riskScore is clamped between 0 and 100', async () => {
    const res = await request(app)
      .get('/api/stats/risk-index')
      .set('Authorization', `Bearer ${token}`)

    const rows = res.body as Array<{ riskScore: number }>
    for (const r of rows) {
      expect(r.riskScore).toBeGreaterThanOrEqual(0)
      expect(r.riskScore).toBeLessThanOrEqual(100)
    }
  })
})

// ── 3. Enforcement Pipeline ───────────────────────────────────────────────────

describe('GET /api/stats/enforcement-pipeline', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/stats/enforcement-pipeline')
    expect(res.status).toBe(401)
  })

  it('returns expected shape with byState, byType, slaBreaches, avgTimeInState', async () => {
    const res = await request(app)
      .get('/api/stats/enforcement-pipeline')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const body = res.body as {
      byState: Array<{ state: string; count: number }>
      byType: Array<{ type: string; count: number }>
      slaBreaches: number
      avgTimeInState: Array<{ state: string; avgHours: number }>
    }
    expect(Array.isArray(body.byState)).toBe(true)
    expect(Array.isArray(body.byType)).toBe(true)
    expect(typeof body.slaBreaches).toBe('number')
    expect(Array.isArray(body.avgTimeInState)).toBe(true)
  })

  it('byState sums match total enforcement action count', async () => {
    const res = await request(app)
      .get('/api/stats/enforcement-pipeline')
      .set('Authorization', `Bearer ${token}`)

    const body = res.body as { byState: Array<{ count: number }> }
    const total = body.byState.reduce((s, r) => s + r.count, 0)
    const dbTotal = await prisma.enforcementAction.count()
    expect(total).toBe(dbTotal)
  })
})

// ── 4. Trend Lab ──────────────────────────────────────────────────────────────

describe('GET /api/stats/trend-lab', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/stats/trend-lab?stationId=x&parameter=PM10')
    expect(res.status).toBe(401)
  })

  it('returns 400 when stationId or parameter is missing', async () => {
    const res = await request(app)
      .get('/api/stats/trend-lab?parameter=PM10')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })

  it('returns 404 for a non-existent stationId', async () => {
    const res = await request(app)
      .get('/api/stats/trend-lab?stationId=nonexistent-id&parameter=PM10')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('returns series data for a valid OCEMS station', async () => {
    // Find any OCEMS station that exists
    const station = await prisma.monitoringStation.findFirst({
      where: { type: 'OCEMS' },
      select: { id: true, parameters: true },
    })
    if (!station) return // skip if no seed data present

    const param = station.parameters[0] ?? 'PM10'
    const res = await request(app)
      .get(`/api/stats/trend-lab?stationId=${station.id}&parameter=${param}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const body = res.body as {
      stationId: string
      parameter: string
      series: Array<{ timestamp: string; value: number }>
    }
    expect(body.stationId).toBe(station.id)
    expect(Array.isArray(body.series)).toBe(true)
  })
})

// ── 5. Festival Monitoring ────────────────────────────────────────────────────

describe('GET /api/stats/festival-monitoring', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/stats/festival-monitoring')
    expect(res.status).toBe(401)
  })

  it('returns expected shape with event, windows, parametersCompared', async () => {
    const res = await request(app)
      .get('/api/stats/festival-monitoring')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const body = res.body as {
      event: string
      year: number
      windows: {
        before: { parameters: Record<string, unknown> }
        during: { parameters: Record<string, unknown> }
        after: { parameters: Record<string, unknown> }
      }
      parametersCompared: string[]
    }
    expect(body.event).toBe('Ganesh Utsav Sabarmati')
    expect(body.year).toBe(2023)
    expect(body).toHaveProperty('windows')
    expect(body.windows).toHaveProperty('before')
    expect(body.windows).toHaveProperty('during')
    expect(body.windows).toHaveProperty('after')
    expect(Array.isArray(body.parametersCompared)).toBe(true)
  })
})
