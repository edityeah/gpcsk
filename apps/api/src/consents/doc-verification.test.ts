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
let industryId = ''
let consentId  = ''
let consentWithDocId = ''

beforeAll(async () => {
  await seedDemoUsers(prisma)

  const consentUser  = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000001' } })
  const reviewerUser = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000005' } })

  consentOfficerToken = signToken({ sub: consentUser.id,  role: consentUser.role  }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  seniorReviewerToken = signToken({ sub: reviewerUser.id, role: reviewerUser.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })

  const district = await prisma.district.upsert({
    where:  { code: 'DV-TEST-DIST' },
    update: {},
    create: { code: 'DV-TEST-DIST', name: 'DocVerif Test District' },
  })
  const industry = await prisma.industry.upsert({
    where:  { ucNumber: 'UC-DV-001' },
    update: {},
    create: { name: 'DocVerif Test Industry', ucNumber: 'UC-DV-001', category: 'RED', districtId: district.id },
  })
  industryId = industry.id

  // Consent without doc verification data
  const bare = await prisma.consentApplication.create({
    data: { industryId, type: 'CTO', state: 'DRAFT' },
  })
  consentId = bare.id

  // Consent with AI-populated docVerification
  const withDoc = await prisma.consentApplication.create({
    data: {
      industryId,
      type: 'CTE',
      state: 'UNDER_REVIEW',
      docVerification: {
        aiReviewedAt: new Date().toISOString(),
        documents: [
          { name: 'NOC Letter', status: 'OK' },
          { name: 'Site Plan',  status: 'BLURRED' },
        ],
      },
    },
  })
  consentWithDocId = withDoc.id
})

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: 'ConsentApplication', entityId: { in: [consentId, consentWithDocId] } } })
  await prisma.consentApplication.deleteMany({ where: { industryId } })
  await prisma.industry.delete({ where: { id: industryId } }).catch(() => {})
  await prisma.$disconnect()
})

// ── GET /api/consents/:id/doc-verification ────────────────────────────────────

describe('GET /api/consents/:id/doc-verification', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get(`/api/consents/${consentId}/doc-verification`)
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown consent', async () => {
    const res = await request(app)
      .get('/api/consents/does-not-exist/doc-verification')
      .set('Authorization', `Bearer ${consentOfficerToken}`)
    expect(res.status).toBe(404)
  })

  it('returns empty documents + null aiReviewedAt for a consent with no doc data', async () => {
    const res = await request(app)
      .get(`/api/consents/${consentId}/doc-verification`)
      .set('Authorization', `Bearer ${consentOfficerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.documents).toEqual([])
    expect(res.body.aiReviewedAt).toBeNull()
  })

  it('returns documents and aiReviewedAt for a consent with doc data', async () => {
    const res = await request(app)
      .get(`/api/consents/${consentWithDocId}/doc-verification`)
      .set('Authorization', `Bearer ${consentOfficerToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.documents)).toBe(true)
    expect(res.body.documents.length).toBe(2)
    expect(res.body.aiReviewedAt).not.toBeNull()
  })
})

// ── POST /api/consents/:id/human-review ───────────────────────────────────────

describe('POST /api/consents/:id/human-review', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post(`/api/consents/${consentWithDocId}/human-review`)
      .send({ status: 'APPROVED' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for SENIOR_REVIEWER (not CONSENT_OFFICER)', async () => {
    const res = await request(app)
      .post(`/api/consents/${consentWithDocId}/human-review`)
      .set('Authorization', `Bearer ${seniorReviewerToken}`)
      .send({ status: 'APPROVED' })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .post(`/api/consents/${consentWithDocId}/human-review`)
      .set('Authorization', `Bearer ${consentOfficerToken}`)
      .send({ status: 'INVALID' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown consent', async () => {
    const res = await request(app)
      .post('/api/consents/does-not-exist/human-review')
      .set('Authorization', `Bearer ${consentOfficerToken}`)
      .send({ status: 'APPROVED' })
    expect(res.status).toBe(404)
  })

  it('sets humanReviewStatus=APPROVED and writes audit log', async () => {
    const res = await request(app)
      .post(`/api/consents/${consentWithDocId}/human-review`)
      .set('Authorization', `Bearer ${consentOfficerToken}`)
      .send({ status: 'APPROVED', notes: 'Looks good' })
    expect(res.status).toBe(200)

    const dv = res.body.docVerification as Record<string, unknown>
    expect(dv['humanReviewStatus']).toBe('APPROVED')

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'ConsentApplication', entityId: consentWithDocId, action: 'DOC_REVIEW_APPROVED' },
    })
    expect(audit).not.toBeNull()
  })

  it('sets humanReviewStatus=RETURNED and writes audit log', async () => {
    const fresh = await prisma.consentApplication.create({
      data: {
        industryId,
        type: 'HW_AUTH',
        state: 'UNDER_REVIEW',
        docVerification: {
          aiReviewedAt: new Date().toISOString(),
          documents: [{ name: 'Lab Report', status: 'MISSING' }],
        },
      },
    })
    const res = await request(app)
      .post(`/api/consents/${fresh.id}/human-review`)
      .set('Authorization', `Bearer ${consentOfficerToken}`)
      .send({ status: 'RETURNED', notes: 'Missing lab report' })
    expect(res.status).toBe(200)

    const dv = res.body.docVerification as Record<string, unknown>
    expect(dv['humanReviewStatus']).toBe('RETURNED')

    await prisma.auditLog.deleteMany({ where: { entity: 'ConsentApplication', entityId: fresh.id } })
    await prisma.consentApplication.delete({ where: { id: fresh.id } })
  })
})

// ── GET /api/consents/doc-verification-summary ────────────────────────────────

describe('GET /api/consents/doc-verification-summary', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/consents/doc-verification-summary')
    expect(res.status).toBe(401)
  })

  it('returns aggregate summary with expected keys', async () => {
    const res = await request(app)
      .get('/api/consents/doc-verification-summary')
      .set('Authorization', `Bearer ${consentOfficerToken}`)
    expect(res.status).toBe(200)
    expect(typeof res.body.totalReviewed).toBe('number')
    expect(typeof res.body.totalAppsAwaitingHumanReview).toBe('number')
    expect(typeof res.body.byStatus).toBe('object')
    // Our seeded docs had OK and BLURRED statuses
    expect(res.body.byStatus).toHaveProperty('OK')
    expect(res.body.byStatus).toHaveProperty('BLURRED')
    expect(res.body.byStatus['OK']).toBeGreaterThanOrEqual(1)
    expect(res.body.byStatus['BLURRED']).toBeGreaterThanOrEqual(1)
  })
})
