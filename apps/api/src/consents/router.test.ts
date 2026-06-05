import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'

const app = buildApp()

let consentOfficerToken = ''
let seniorReviewerToken  = ''
let monitoringOfficerToken = ''
let industryId = ''
let consentId  = ''

beforeAll(async () => {
  await seedDemoUsers(prisma)

  const consentUser  = await prisma.user.findUnique({ where: { phone: '9000000001' } })
  const reviewerUser = await prisma.user.findUnique({ where: { phone: '9000000005' } })
  const monitorUser  = await prisma.user.findUnique({ where: { phone: '9000000002' } })
  if (!consentUser || !reviewerUser || !monitorUser) throw new Error('seed users missing')

  consentOfficerToken    = signToken({ sub: consentUser.id,  role: consentUser.role },  { secret: env.API_JWT_SECRET, ttlHours: 1 })
  seniorReviewerToken    = signToken({ sub: reviewerUser.id, role: reviewerUser.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  monitoringOfficerToken = signToken({ sub: monitorUser.id,  role: monitorUser.role },  { secret: env.API_JWT_SECRET, ttlHours: 1 })

  // Seed an industry + consent application
  const district = await prisma.district.upsert({
    where:  { code: 'CST-DIST' },
    update: {},
    create: { code: 'CST-DIST', name: 'Consent Test District' },
  })
  const industry = await prisma.industry.upsert({
    where:  { ucNumber: 'UC-CST-001' },
    update: {},
    create: { name: 'Gamma Pharma Ltd', ucNumber: 'UC-CST-001', category: 'RED', districtId: district.id },
  })
  industryId = industry.id

  const consent = await prisma.consentApplication.create({
    data: { industryId, type: 'CTO', state: 'DRAFT' },
  })
  consentId = consent.id
})

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: consentId } })
  await prisma.consentApplication.deleteMany({ where: { industryId } })
  await prisma.industry.delete({ where: { id: industryId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('GET /api/consents', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/consents')
    expect(res.status).toBe(401)
  })

  it('returns a paginated list of consents', async () => {
    const res = await request(app)
      .get('/api/consents')
      .set('Authorization', `Bearer ${consentOfficerToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('filters by type=CTO and includes our seeded consent', async () => {
    const res = await request(app)
      .get('/api/consents?type=CTO')
      .set('Authorization', `Bearer ${consentOfficerToken}`)
    expect(res.status).toBe(200)
    const ids = res.body.items.map((c: { id: string }) => c.id)
    expect(ids).toContain(consentId)
  })

  it('filters by state=DRAFT and includes our seeded consent', async () => {
    const res = await request(app)
      .get('/api/consents?state=DRAFT')
      .set('Authorization', `Bearer ${consentOfficerToken}`)
    expect(res.status).toBe(200)
    const ids = res.body.items.map((c: { id: string }) => c.id)
    expect(ids).toContain(consentId)
  })

  it('returns 400 on invalid state value', async () => {
    const res = await request(app)
      .get('/api/consents?state=INVALID')
      .set('Authorization', `Bearer ${consentOfficerToken}`)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/consents/:id/recommend (RBAC: CONSENT_OFFICER only)', () => {
  it('returns 403 for a MONITORING_OFFICER', async () => {
    const res = await request(app)
      .post(`/api/consents/${consentId}/recommend`)
      .set('Authorization', `Bearer ${monitoringOfficerToken}`)
      .send({})
    expect(res.status).toBe(403)
  })

  it('returns 403 for a SENIOR_REVIEWER', async () => {
    const res = await request(app)
      .post(`/api/consents/${consentId}/recommend`)
      .set('Authorization', `Bearer ${seniorReviewerToken}`)
      .send({})
    expect(res.status).toBe(403)
  })

  it('transitions DRAFT → RECOMMENDED for CONSENT_OFFICER', async () => {
    const res = await request(app)
      .post(`/api/consents/${consentId}/recommend`)
      .set('Authorization', `Bearer ${consentOfficerToken}`)
      .send({ reason: 'docs verified' })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('RECOMMENDED')
  })

  it('rejects a second recommend (state no longer DRAFT/UNDER_REVIEW)', async () => {
    const res = await request(app)
      .post(`/api/consents/${consentId}/recommend`)
      .set('Authorization', `Bearer ${consentOfficerToken}`)
      .send({})
    expect(res.status).toBe(409)
  })
})

describe('POST /api/consents/:id/approve (RBAC: SENIOR_REVIEWER only)', () => {
  it('returns 403 for a CONSENT_OFFICER', async () => {
    const res = await request(app)
      .post(`/api/consents/${consentId}/approve`)
      .set('Authorization', `Bearer ${consentOfficerToken}`)
      .send({})
    expect(res.status).toBe(403)
  })

  it('transitions RECOMMENDED → APPROVED for SENIOR_REVIEWER', async () => {
    const res = await request(app)
      .post(`/api/consents/${consentId}/approve`)
      .set('Authorization', `Bearer ${seniorReviewerToken}`)
      .send({ reason: 'approved after review' })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('APPROVED')
  })
})

describe('POST /api/consents/:id/reject (RBAC: SENIOR_REVIEWER only)', () => {
  it('returns 403 for a CONSENT_OFFICER', async () => {
    // Create a fresh consent for reject test
    const fresh = await prisma.consentApplication.create({
      data: { industryId, type: 'CTE', state: 'RECOMMENDED' },
    })
    const res = await request(app)
      .post(`/api/consents/${fresh.id}/reject`)
      .set('Authorization', `Bearer ${consentOfficerToken}`)
      .send({})
    expect(res.status).toBe(403)
    await prisma.consentApplication.delete({ where: { id: fresh.id } })
  })

  it('transitions RECOMMENDED → REJECTED for SENIOR_REVIEWER', async () => {
    const fresh = await prisma.consentApplication.create({
      data: { industryId, type: 'CTE', state: 'RECOMMENDED' },
    })
    const res = await request(app)
      .post(`/api/consents/${fresh.id}/reject`)
      .set('Authorization', `Bearer ${seniorReviewerToken}`)
      .send({ reason: 'missing NOC' })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('REJECTED')
    expect(res.body.reviewerNotes).toBe('missing NOC')
    await prisma.auditLog.deleteMany({ where: { entityId: fresh.id } })
    await prisma.consentApplication.delete({ where: { id: fresh.id } })
  })

  it('returns 404 for a non-existent consent', async () => {
    const res = await request(app)
      .post('/api/consents/does-not-exist/reject')
      .set('Authorization', `Bearer ${seniorReviewerToken}`)
      .send({})
    expect(res.status).toBe(404)
  })
})
