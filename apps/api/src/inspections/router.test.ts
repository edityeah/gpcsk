import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'

const app = buildApp()

let ieoToken = ''
let srToken = ''
let coToken = ''
let industryId = ''

beforeAll(async () => {
  await seedDemoUsers(prisma)

  const ieo = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000003' } })
  const sr  = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000005' } })
  const co  = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000001' } })

  ieoToken = signToken({ sub: ieo.id, role: ieo.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  srToken  = signToken({ sub: sr.id,  role: sr.role  }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  coToken  = signToken({ sub: co.id,  role: co.role  }, { secret: env.API_JWT_SECRET, ttlHours: 1 })

  // Ensure we have at least one industry to work with
  const existingIndustry = await prisma.industry.findFirst()
  if (existingIndustry) {
    industryId = existingIndustry.id
  } else {
    const ind = await prisma.industry.create({
      data: {
        name: 'Test Textile Ltd',
        ucNumber: 'UC-TEST-INSP-001',
        category: 'RED',
      },
    })
    industryId = ind.id
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ── GET /api/inspections ──────────────────────────────────────────────────────

describe('GET /api/inspections', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/inspections')
    expect(res.status).toBe(401)
  })

  it('returns paginated list for authenticated user', async () => {
    const res = await request(app)
      .get('/api/inspections')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('filters by state=SCHEDULED', async () => {
    const res = await request(app)
      .get('/api/inspections?state=SCHEDULED')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(200)
    for (const item of res.body.items) {
      expect(item.state).toBe('SCHEDULED')
    }
  })

  it('rejects invalid state filter', async () => {
    const res = await request(app)
      .get('/api/inspections?state=BOGUS')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(400)
  })
})

// ── POST /api/inspections ─────────────────────────────────────────────────────

describe('POST /api/inspections', () => {
  it('returns 403 for non-IEO role (Consent Officer)', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${coToken}`)
      .send({ industryId, scheduledAt: new Date().toISOString() })
    expect(res.status).toBe(403)
  })

  it('returns 403 for Senior Reviewer', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ industryId, scheduledAt: new Date().toISOString() })
    expect(res.status).toBe(403)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown industryId', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ industryId: 'non-existent-id', scheduledAt: new Date().toISOString() })
    expect(res.status).toBe(404)
  })

  it('creates a SCHEDULED inspection and writes audit', async () => {
    const scheduledAt = new Date(Date.now() + 7 * 86_400_000).toISOString()
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ industryId, scheduledAt })
    expect(res.status).toBe(201)
    expect(res.body.state).toBe('SCHEDULED')
    expect(res.body.industryId).toBe(industryId)

    // Verify audit log entry was written
    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'Inspection', entityId: res.body.id, action: 'SCHEDULED' },
    })
    expect(audit).not.toBeNull()
  })
})

// ── GET /api/inspections/:id ──────────────────────────────────────────────────

describe('GET /api/inspections/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/inspections/nonexistent-id')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(404)
  })

  it('returns the inspection detail', async () => {
    // Create one to fetch
    const scheduledAt = new Date(Date.now() + 14 * 86_400_000).toISOString()
    const createRes = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ industryId, scheduledAt })
    expect(createRes.status).toBe(201)

    const res = await request(app)
      .get(`/api/inspections/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(createRes.body.id)
    expect(res.body.industry).toBeDefined()
  })
})

// ── POST /api/inspections/:id/complete ───────────────────────────────────────

describe('POST /api/inspections/:id/complete', () => {
  let scheduledInspectionId = ''

  beforeAll(async () => {
    const scheduledAt = new Date(Date.now() + 1 * 86_400_000).toISOString()
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ industryId, scheduledAt })
    scheduledInspectionId = res.body.id
  })

  it('returns 403 for non-IEO role', async () => {
    const res = await request(app)
      .post(`/api/inspections/${scheduledInspectionId}/complete`)
      .set('Authorization', `Bearer ${coToken}`)
      .send({ observations: {}, violations: [] })
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown inspection', async () => {
    const res = await request(app)
      .post('/api/inspections/unknown-id/complete')
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ observations: {}, violations: [] })
    expect(res.status).toBe(404)
  })

  it('completes a scheduled inspection with violations and writes audit', async () => {
    const res = await request(app)
      .post(`/api/inspections/${scheduledInspectionId}/complete`)
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({
        observations: { stackPM10: 'PM10 at 195 µg/m³ — exceeding norm.', housekeeping: 'Satisfactory.' },
        violations: [
          { parameter: 'PM10', observedValue: 195, normValue: 150, unit: 'µg/m³', severity: 'MAJOR' },
          { parameter: 'SO2',  observedValue: 95,  normValue: 80,  unit: 'µg/m³', severity: 'MINOR' },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('COMPLETED')
    expect(res.body.completedAt).not.toBeNull()

    // Verify violations were created
    const violations = await prisma.violation.findMany({
      where: { inspectionId: scheduledInspectionId },
    })
    expect(violations.length).toBe(2)

    // Verify audit entry
    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'Inspection', entityId: scheduledInspectionId, action: 'COMPLETED' },
    })
    expect(audit).not.toBeNull()
  })

  it('returns 409 if inspection is already completed', async () => {
    // Try to complete the same inspection again
    const res = await request(app)
      .post(`/api/inspections/${scheduledInspectionId}/complete`)
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ observations: {}, violations: [] })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('not_in_scheduled_state')
  })
})
