import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'

const app = buildApp()

let ieoToken = ''
let srToken  = ''
let coToken  = ''
let ieoId    = ''
let industryId = ''

beforeAll(async () => {
  await seedDemoUsers(prisma)

  const ieo = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000003' } })
  const sr  = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000005' } })
  const co  = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000001' } })

  ieoId    = ieo.id
  ieoToken = signToken({ sub: ieo.id, role: ieo.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  srToken  = signToken({ sub: sr.id,  role: sr.role  }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  coToken  = signToken({ sub: co.id,  role: co.role  }, { secret: env.API_JWT_SECRET, ttlHours: 1 })

  // Ensure we have at least one industry
  const existingIndustry = await prisma.industry.findFirst()
  if (existingIndustry) {
    industryId = existingIndustry.id
  } else {
    const ind = await prisma.industry.create({
      data: {
        name: 'Test Chemical Ltd',
        ucNumber: 'UC-TEST-ENF-001',
        category: 'RED',
      },
    })
    industryId = ind.id
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ── Helper: create a draft action ─────────────────────────────────────────────

async function createDraft(token = ieoToken) {
  const res = await request(app)
    .post('/api/enforcement')
    .set('Authorization', `Bearer ${token}`)
    .send({
      industryId,
      type: 'SHOW_CAUSE',
      evidence: { summary: 'PM10 exceedance detected by CEQMS.' },
      violationIds: [],
    })
  return res
}

// ── GET /api/enforcement ──────────────────────────────────────────────────────

describe('GET /api/enforcement', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/enforcement')
    expect(res.status).toBe(401)
  })

  it('returns paginated list for authenticated user', async () => {
    const res = await request(app)
      .get('/api/enforcement')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('filters by state=DRAFT', async () => {
    const res = await request(app)
      .get('/api/enforcement?state=DRAFT')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(200)
    for (const item of res.body.items) {
      expect(item.state).toBe('DRAFT')
    }
  })

  it('rejects invalid state filter', async () => {
    const res = await request(app)
      .get('/api/enforcement?state=INVALID')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(400)
  })
})

// ── GET /api/enforcement/queue/pending-review ─────────────────────────────────

describe('GET /api/enforcement/queue/pending-review', () => {
  it('returns 403 for IEO role', async () => {
    const res = await request(app)
      .get('/api/enforcement/queue/pending-review')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 403 for Consent Officer', async () => {
    const res = await request(app)
      .get('/api/enforcement/queue/pending-review')
      .set('Authorization', `Bearer ${coToken}`)
    expect(res.status).toBe(403)
  })

  it('returns pending-review items for Senior Reviewer', async () => {
    const res = await request(app)
      .get('/api/enforcement/queue/pending-review')
      .set('Authorization', `Bearer ${srToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(typeof res.body.total).toBe('number')
    for (const item of res.body.items) {
      expect(item.state).toBe('PENDING_REVIEW')
    }
  })
})

// ── POST /api/enforcement (create DRAFT) ──────────────────────────────────────

describe('POST /api/enforcement', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/enforcement').send({ industryId, type: 'SHOW_CAUSE' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for Consent Officer (wrong role)', async () => {
    const res = await request(app)
      .post('/api/enforcement')
      .set('Authorization', `Bearer ${coToken}`)
      .send({ industryId, type: 'SHOW_CAUSE' })
    expect(res.status).toBe(403)
  })

  it('returns 403 for Senior Reviewer (checker cannot create)', async () => {
    const res = await request(app)
      .post('/api/enforcement')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ industryId, type: 'SHOW_CAUSE' })
    expect(res.status).toBe(403)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/enforcement')
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid enforcement type', async () => {
    const res = await request(app)
      .post('/api/enforcement')
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ industryId, type: 'INVALID_TYPE' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown industryId', async () => {
    const res = await request(app)
      .post('/api/enforcement')
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ industryId: 'does-not-exist', type: 'SHOW_CAUSE' })
    expect(res.status).toBe(404)
  })

  it('creates a DRAFT enforcement action and writes audit', async () => {
    const res = await createDraft()
    expect(res.status).toBe(201)
    expect(res.body.state).toBe('DRAFT')
    expect(res.body.industryId).toBe(industryId)
    expect(res.body.type).toBe('SHOW_CAUSE')

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'EnforcementAction', entityId: res.body.id, action: 'DRAFTED' },
    })
    expect(audit).not.toBeNull()
  })
})

// ── GET /api/enforcement/:id ──────────────────────────────────────────────────

describe('GET /api/enforcement/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/enforcement/nonexistent-id')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(404)
  })

  it('returns the enforcement action detail', async () => {
    const createRes = await createDraft()
    expect(createRes.status).toBe(201)

    const res = await request(app)
      .get(`/api/enforcement/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(createRes.body.id)
    expect(res.body.industry).toBeDefined()
    expect(res.body.draftedBy).toBeDefined()
  })
})

// ── POST /api/enforcement/:id/submit ─────────────────────────────────────────

describe('POST /api/enforcement/:id/submit', () => {
  it('returns 403 for Senior Reviewer', async () => {
    const draft = await createDraft()
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/submit`)
      .set('Authorization', `Bearer ${srToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 403 for Consent Officer', async () => {
    const draft = await createDraft()
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/submit`)
      .set('Authorization', `Bearer ${coToken}`)
    expect(res.status).toBe(403)
  })

  it('transitions DRAFT → PENDING_REVIEW and writes audit', async () => {
    const draft = await createDraft()
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/submit`)
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('PENDING_REVIEW')

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'EnforcementAction', entityId: draft.body.id, action: 'SUBMITTED_FOR_REVIEW' },
    })
    expect(audit).not.toBeNull()
  })

  it('returns 409 if not in DRAFT or RETURNED_FOR_REVISION state', async () => {
    const draft = await createDraft()
    // Submit once
    await request(app)
      .post(`/api/enforcement/${draft.body.id}/submit`)
      .set('Authorization', `Bearer ${ieoToken}`)
    // Submit again — already PENDING_REVIEW
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/submit`)
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(409)
  })

  it('returns 404 for unknown action', async () => {
    const res = await request(app)
      .post('/api/enforcement/nonexistent/submit')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(404)
  })
})

// ── POST /api/enforcement/:id/approve ────────────────────────────────────────

describe('POST /api/enforcement/:id/approve', () => {
  it('returns 403 for IEO role', async () => {
    const draft = await createDraft()
    await request(app).post(`/api/enforcement/${draft.body.id}/submit`).set('Authorization', `Bearer ${ieoToken}`)
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/approve`)
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 409 if not in PENDING_REVIEW state', async () => {
    const draft = await createDraft()
    // Still in DRAFT, not submitted
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/approve`)
      .set('Authorization', `Bearer ${srToken}`)
    expect(res.status).toBe(409)
  })

  it('transitions PENDING_REVIEW → COMMITTED with delivery queued, writes audit', async () => {
    const draft = await createDraft()
    await request(app).post(`/api/enforcement/${draft.body.id}/submit`).set('Authorization', `Bearer ${ieoToken}`)

    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/approve`)
      .set('Authorization', `Bearer ${srToken}`)
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('COMMITTED')
    expect(res.body.deliveryChannel).toBe('EMAIL')
    expect(res.body.deliveryStatus).toBe('QUEUED')
    expect(res.body.reviewedById).toBeTruthy()

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'EnforcementAction', entityId: draft.body.id, action: 'APPROVED' },
    })
    expect(audit).not.toBeNull()
  })
})

// ── POST /api/enforcement/:id/return-for-revision ─────────────────────────────

describe('POST /api/enforcement/:id/return-for-revision', () => {
  it('returns 403 for IEO role', async () => {
    const draft = await createDraft()
    await request(app).post(`/api/enforcement/${draft.body.id}/submit`).set('Authorization', `Bearer ${ieoToken}`)
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/return-for-revision`)
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ notes: 'needs more evidence' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when notes are missing', async () => {
    const draft = await createDraft()
    await request(app).post(`/api/enforcement/${draft.body.id}/submit`).set('Authorization', `Bearer ${ieoToken}`)
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/return-for-revision`)
      .set('Authorization', `Bearer ${srToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 409 if not in PENDING_REVIEW state', async () => {
    const draft = await createDraft()
    // Still DRAFT
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/return-for-revision`)
      .set('Authorization', `Bearer ${srToken}`)
      .send({ notes: 'insufficient evidence' })
    expect(res.status).toBe(409)
  })

  it('transitions PENDING_REVIEW → RETURNED_FOR_REVISION and writes audit', async () => {
    const draft = await createDraft()
    await request(app).post(`/api/enforcement/${draft.body.id}/submit`).set('Authorization', `Bearer ${ieoToken}`)

    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/return-for-revision`)
      .set('Authorization', `Bearer ${srToken}`)
      .send({ notes: 'Please include lab report for stack #2.' })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('RETURNED_FOR_REVISION')
    expect(res.body.reviewerNotes).toBe('Please include lab report for stack #2.')

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'EnforcementAction', entityId: draft.body.id, action: 'RETURNED_FOR_REVISION' },
    })
    expect(audit).not.toBeNull()
    expect(audit?.reason).toBe('Please include lab report for stack #2.')
  })

  it('allows re-submission after RETURNED_FOR_REVISION', async () => {
    const draft = await createDraft()
    await request(app).post(`/api/enforcement/${draft.body.id}/submit`).set('Authorization', `Bearer ${ieoToken}`)
    await request(app)
      .post(`/api/enforcement/${draft.body.id}/return-for-revision`)
      .set('Authorization', `Bearer ${srToken}`)
      .send({ notes: 'Add more evidence.' })

    // Re-submit
    const resubmit = await request(app)
      .post(`/api/enforcement/${draft.body.id}/submit`)
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(resubmit.status).toBe(200)
    expect(resubmit.body.state).toBe('PENDING_REVIEW')
  })
})

// ── POST /api/enforcement/:id/withdraw ───────────────────────────────────────

describe('POST /api/enforcement/:id/withdraw', () => {
  it('returns 403 for Senior Reviewer (not the maker)', async () => {
    const draft = await createDraft()
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/withdraw`)
      .set('Authorization', `Bearer ${srToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 403 for Consent Officer', async () => {
    const draft = await createDraft()
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/withdraw`)
      .set('Authorization', `Bearer ${coToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown action', async () => {
    const res = await request(app)
      .post('/api/enforcement/no-such-id/withdraw')
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(404)
  })

  it('withdraws a DRAFT and writes audit', async () => {
    const draft = await createDraft()
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/withdraw`)
      .set('Authorization', `Bearer ${ieoToken}`)
      .send({ reason: 'Industry rectified voluntarily.' })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('WITHDRAWN')

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'EnforcementAction', entityId: draft.body.id, action: 'WITHDRAWN' },
    })
    expect(audit).not.toBeNull()
    expect(audit?.reason).toBe('Industry rectified voluntarily.')
  })

  it('withdraws a PENDING_REVIEW action', async () => {
    const draft = await createDraft()
    await request(app).post(`/api/enforcement/${draft.body.id}/submit`).set('Authorization', `Bearer ${ieoToken}`)
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/withdraw`)
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('WITHDRAWN')
  })

  it('returns 409 if action is already COMMITTED', async () => {
    const draft = await createDraft()
    await request(app).post(`/api/enforcement/${draft.body.id}/submit`).set('Authorization', `Bearer ${ieoToken}`)
    await request(app).post(`/api/enforcement/${draft.body.id}/approve`).set('Authorization', `Bearer ${srToken}`)

    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/withdraw`)
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(409)
  })

  it('returns 409 if action is already WITHDRAWN', async () => {
    const draft = await createDraft()
    await request(app).post(`/api/enforcement/${draft.body.id}/withdraw`).set('Authorization', `Bearer ${ieoToken}`)
    const res = await request(app)
      .post(`/api/enforcement/${draft.body.id}/withdraw`)
      .set('Authorization', `Bearer ${ieoToken}`)
    expect(res.status).toBe(409)
  })
})
