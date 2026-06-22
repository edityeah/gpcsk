import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'

const app = buildApp()

let ieoToken  = ''
let srToken   = ''
let coToken   = ''
let industryId = ''
let suggestedId = ''
let toDismissId = ''

beforeAll(async () => {
  await seedDemoUsers(prisma)

  const ieo = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000003' } })
  const sr  = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000005' } })
  const co  = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000001' } })

  ieoToken = signToken({ sub: ieo.id, role: ieo.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  srToken  = signToken({ sub: sr.id,  role: sr.role  }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  coToken  = signToken({ sub: co.id,  role: co.role  }, { secret: env.API_JWT_SECRET, ttlHours: 1 })

  // Create a dedicated test industry (unique ucNumber)
  const district = await prisma.district.upsert({
    where:  { code: 'RBQ-TEST-DIST' },
    update: {},
    create: { code: 'RBQ-TEST-DIST', name: 'RBQ Test District' },
  })
  const industry = await prisma.industry.upsert({
    where:  { ucNumber: 'UC-RBQ-TEST-001' },
    update: {},
    create: { name: 'RBQ Test Industry', ucNumber: 'UC-RBQ-TEST-001', category: 'RED', districtId: district.id },
  })
  industryId = industry.id

  // Seed a SUGGESTED row for confirm test
  const sugg = await prisma.riskBasedSuggestion.upsert({
    where: { industryId_state: { industryId, state: 'SUGGESTED' } },
    update: {},
    create: {
      industryId,
      riskScore: 75.0,
      breakdown: { exceedance30d: 8, complaints30d: 3, openInspections: 2, consentGapDays: 45 },
      state: 'SUGGESTED',
    },
  })
  suggestedId = sugg.id

  // Create a second industry for dismiss test
  const industry2 = await prisma.industry.upsert({
    where:  { ucNumber: 'UC-RBQ-TEST-002' },
    update: {},
    create: { name: 'RBQ Test Industry 2', ucNumber: 'UC-RBQ-TEST-002', category: 'ORANGE', districtId: district.id },
  })

  const sugg2 = await prisma.riskBasedSuggestion.upsert({
    where: { industryId_state: { industryId: industry2.id, state: 'SUGGESTED' } },
    update: {},
    create: {
      industryId: industry2.id,
      riskScore: 55.0,
      breakdown: { exceedance30d: 3, complaints30d: 1, openInspections: 1, consentGapDays: 0 },
      state: 'SUGGESTED',
    },
  })
  toDismissId = sugg2.id
})

afterAll(async () => {
  // Clean up any inspections and suggestions we created
  await prisma.auditLog.deleteMany({ where: { entity: 'RiskBasedSuggestion' } })
  await prisma.riskBasedSuggestion.deleteMany({ where: { industryId: { in: [industryId] } } })

  // Find industry2 by ucNumber to delete suggestions there too
  const ind2 = await prisma.industry.findUnique({ where: { ucNumber: 'UC-RBQ-TEST-002' } })
  if (ind2) {
    await prisma.riskBasedSuggestion.deleteMany({ where: { industryId: ind2.id } })
    await prisma.inspection.deleteMany({ where: { industryId: ind2.id } })
    await prisma.industry.delete({ where: { id: ind2.id } }).catch(() => {})
  }

  await prisma.inspection.deleteMany({ where: { industryId } })
  await prisma.industry.delete({ where: { id: industryId } }).catch(() => {})
  await prisma.$disconnect()
})

// ── GET /api/inspections/risk-based-queue ─────────────────────────────────────

describe('GET /api/inspections/risk-based-queue', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/inspections/risk-based-queue')
    expect(res.status).toBe(401)
  })

  it('returns array sorted by riskScore desc', async () => {
    const res = await request(app)
      .get('/api/inspections/risk-based-queue')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)

    // All returned rows should be SUGGESTED
    for (const row of res.body) {
      expect(row.state).toBe('SUGGESTED')
    }

    // Sorted desc by riskScore
    const scores: number[] = res.body.map((r: { riskScore: number }) => r.riskScore)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]!).toBeGreaterThanOrEqual(scores[i]!)
    }

    // Industry join is present
    const our = res.body.find((r: { id: string }) => r.id === suggestedId)
    expect(our).toBeDefined()
    expect(our.industry).toBeDefined()
    expect(our.industry.ucNumber).toBe('UC-RBQ-TEST-001')
  })
})

// ── POST /api/inspections/risk-based-queue/:id/confirm ───────────────────────

describe('POST /api/inspections/risk-based-queue/:id/confirm', () => {
  it('returns 403 for CONSENT_OFFICER', async () => {
    const res = await request(app)
      .post(`/api/inspections/risk-based-queue/${suggestedId}/confirm`)
      .set('Authorization', `Bearer ${coToken}`)
      .send({ scheduledAt: new Date(Date.now() + 86_400_000).toISOString() })
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown suggestion id', async () => {
    const res = await request(app)
      .post('/api/inspections/risk-based-queue/does-not-exist/confirm')
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ scheduledAt: new Date(Date.now() + 86_400_000).toISOString() })
    expect(res.status).toBe(404)
  })

  it('returns 400 if scheduledAt is missing', async () => {
    const res = await request(app)
      .post(`/api/inspections/risk-based-queue/${suggestedId}/confirm`)
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('confirms suggestion, creates RISK_BASED inspection, writes audit', async () => {
    const scheduledAt = new Date(Date.now() + 7 * 86_400_000).toISOString()
    const res = await request(app)
      .post(`/api/inspections/risk-based-queue/${suggestedId}/confirm`)
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ scheduledAt })
    expect(res.status).toBe(201)
    expect(res.body.suggestion.state).toBe('CONFIRMED')
    expect(res.body.inspection.inspectionType).toBe('RISK_BASED')
    expect(res.body.inspection.state).toBe('SCHEDULED')
    expect(res.body.suggestion.scheduledInspectionId).toBe(res.body.inspection.id)

    // Verify audit entry
    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'RiskBasedSuggestion', entityId: suggestedId, action: 'CONFIRMED' },
    })
    expect(audit).not.toBeNull()
  })

  it('returns 409 if suggestion already confirmed', async () => {
    const res = await request(app)
      .post(`/api/inspections/risk-based-queue/${suggestedId}/confirm`)
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ scheduledAt: new Date(Date.now() + 86_400_000).toISOString() })
    expect(res.status).toBe(409)
  })
})

// ── POST /api/inspections/risk-based-queue/:id/dismiss ───────────────────────

describe('POST /api/inspections/risk-based-queue/:id/dismiss', () => {
  it('returns 403 for CONSENT_OFFICER', async () => {
    const res = await request(app)
      .post(`/api/inspections/risk-based-queue/${toDismissId}/dismiss`)
      .set('Authorization', `Bearer ${coToken}`)
      .send({ reason: 'false positive' })
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown suggestion id', async () => {
    const res = await request(app)
      .post('/api/inspections/risk-based-queue/does-not-exist/dismiss')
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ reason: 'false positive' })
    expect(res.status).toBe(404)
  })

  it('returns 400 if reason is missing', async () => {
    const res = await request(app)
      .post(`/api/inspections/risk-based-queue/${toDismissId}/dismiss`)
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('dismisses suggestion and writes audit log', async () => {
    const res = await request(app)
      .post(`/api/inspections/risk-based-queue/${toDismissId}/dismiss`)
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ reason: 'Risk re-assessed — not actionable' })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('DISMISSED')
    expect(res.body.decidedAt).not.toBeNull()

    // Verify audit
    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'RiskBasedSuggestion', entityId: toDismissId, action: 'DISMISSED' },
    })
    expect(audit).not.toBeNull()
    expect(audit?.reason).toBe('Risk re-assessed — not actionable')
  })

  it('returns 409 if suggestion already dismissed', async () => {
    const res = await request(app)
      .post(`/api/inspections/risk-based-queue/${toDismissId}/dismiss`)
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ reason: 'again' })
    expect(res.status).toBe(409)
  })
})

// ── GET /api/inspections/risk-based-queue/stats ───────────────────────────────

describe('GET /api/inspections/risk-based-queue/stats', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/inspections/risk-based-queue/stats')
    expect(res.status).toBe(401)
  })

  it('returns stats with expected shape', async () => {
    const res = await request(app)
      .get('/api/inspections/risk-based-queue/stats')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(200)
    expect(typeof res.body.suggested).toBe('number')
    expect(typeof res.body.confirmedLast30d).toBe('number')
    expect(typeof res.body.dismissedLast30d).toBe('number')
    // avgTimeToDecisionHours can be number or null
    expect(['number', 'object'].includes(typeof res.body.avgTimeToDecisionHours)).toBe(true)

    // We confirmed 1 and dismissed 1, so at minimum these should be >= 1
    expect(res.body.confirmedLast30d).toBeGreaterThanOrEqual(1)
    expect(res.body.dismissedLast30d).toBeGreaterThanOrEqual(1)
    expect(res.body.avgTimeToDecisionHours).not.toBeNull()
  })
})
