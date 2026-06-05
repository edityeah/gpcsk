import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { seedCetps } from '../seed/cetps.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'

const app = buildApp()

let token = ''
let monitoringToken = ''
let firstCetpId = ''

beforeAll(async () => {
  await seedDemoUsers(prisma)
  await seedCetps(prisma)

  // Consent officer token (any authenticated user can access CETPs)
  const co = await prisma.user.findUnique({ where: { phone: '9000000001' } })
  if (!co) throw new Error('consent officer seed missing')
  token = signToken({ sub: co.id, role: co.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })

  // Monitoring officer token
  const mo = await prisma.user.findUnique({ where: { phone: '9000000002' } })
  if (!mo) throw new Error('monitoring officer seed missing')
  monitoringToken = signToken({ sub: mo.id, role: mo.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })

  // Grab the first CETP id for detail tests
  const first = await prisma.cetp.findFirst({ orderBy: { name: 'asc' } })
  if (!first) throw new Error('cetp seed missing')
  firstCetpId = first.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ── GET /api/cetps ─────────────────────────────────────────────────────────

describe('GET /api/cetps', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/cetps')
    expect(res.status).toBe(401)
  })

  it('returns the full CETP list with summary fields', async () => {
    const res = await request(app)
      .get('/api/cetps')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    // 15 CETPs seeded (5 real + 10 synthesised)
    expect(res.body.data.length).toBe(15)

    const first = res.body.data[0]
    // Core CETP fields
    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('capacityMld')
    expect(first).toHaveProperty('district')
    expect(first).toHaveProperty('memberUnitsCount')
    expect(first).toHaveProperty('hasOnlineCeqms')
    // Summary fields
    expect(first).toHaveProperty('latestReport')
    expect(first).toHaveProperty('trend')
    expect(first.trend).toHaveProperty('codTrendPct')
    expect(first.trend).toHaveProperty('bodTrendPct')
  })

  it('latestReport contains COD / BOD and bypass values', async () => {
    const res = await request(app)
      .get('/api/cetps')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const withReport = res.body.data.find((c: { latestReport: unknown }) => c.latestReport !== null)
    expect(withReport).toBeTruthy()

    const lr = withReport.latestReport
    expect(typeof lr.observedFinalCOD).toBe('number')
    expect(typeof lr.observedFinalBOD).toBe('number')
    expect(typeof lr.bypassMld).toBe('number')
    expect(lr).toHaveProperty('monthOf')
  })

  it('trend percentages are numbers or null (not undefined)', async () => {
    const res = await request(app)
      .get('/api/cetps')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    for (const cetp of res.body.data) {
      const cod = cetp.trend.codTrendPct
      const bod = cetp.trend.bodTrendPct
      // must be number or null — never undefined
      expect(cod === null || typeof cod === 'number').toBe(true)
      expect(bod === null || typeof bod === 'number').toBe(true)
    }
  })

  it('works with a monitoring officer token', async () => {
    const res = await request(app)
      .get('/api/cetps')
      .set('Authorization', `Bearer ${monitoringToken}`)
    expect(res.status).toBe(200)
  })
})

// ── GET /api/cetps/:id/reports ─────────────────────────────────────────────

describe('GET /api/cetps/:id/reports', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/cetps/${firstCetpId}/reports`)
    expect(res.status).toBe(401)
  })

  it('returns CETP metadata + up to 12 monthly reports', async () => {
    const res = await request(app)
      .get(`/api/cetps/${firstCetpId}/reports`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.cetp).toHaveProperty('id', firstCetpId)
    expect(res.body.cetp).toHaveProperty('name')
    expect(res.body.cetp).toHaveProperty('capacityMld')
    expect(Array.isArray(res.body.reports)).toBe(true)
    expect(res.body.reports.length).toBeGreaterThanOrEqual(1)
    expect(res.body.reports.length).toBeLessThanOrEqual(12)
  })

  it('each report has inlet / observed / final / bypass fields', async () => {
    const res = await request(app)
      .get(`/api/cetps/${firstCetpId}/reports`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const report = res.body.reports[0]
    expect(report).toHaveProperty('id')
    expect(report).toHaveProperty('monthOf')
    expect(report).toHaveProperty('inletNorms')
    expect(report).toHaveProperty('finalEffluentStds')
    expect(report).toHaveProperty('observedInlet')
    expect(report).toHaveProperty('observedFinal')
    expect(report).toHaveProperty('bypassMld')
    expect(report).toHaveProperty('hazardousWasteStorageMt')
    expect(report).toHaveProperty('hazardousWasteDisposedMt')
  })

  it('reports are ordered newest first', async () => {
    const res = await request(app)
      .get(`/api/cetps/${firstCetpId}/reports`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const reports = res.body.reports as Array<{ monthOf: string }>
    if (reports.length >= 2) {
      const d0 = new Date(reports[0]!.monthOf).getTime()
      const d1 = new Date(reports[1]!.monthOf).getTime()
      expect(d0).toBeGreaterThan(d1)
    }
  })

  it('returns 400 for a non-cuid id', async () => {
    const res = await request(app)
      .get('/api/cetps/not-a-valid-id/reports')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'invalid_id')
  })

  it('returns 404 for a well-formed but unknown cuid', async () => {
    // A syntactically valid cuid that does not exist
    const res = await request(app)
      .get('/api/cetps/clxxxxxxxxxxxxxxxxxxxxxx0000/reports')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error', 'cetp_not_found')
  })
})
