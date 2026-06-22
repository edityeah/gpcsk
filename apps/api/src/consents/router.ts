import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { writeAudit } from '../audit/service.js'

export const consentsRouter = Router()

// ── GET /api/consents/doc-verification-summary ────────────────────────────────
// Aggregate counts for the Consent Management dashboard.
// Must be registered BEFORE /:id routes so it isn't captured by param routing.

consentsRouter.get('/doc-verification-summary', requireAuth, async (_req, res) => {
  const apps = await prisma.consentApplication.findMany({
    select: { docVerification: true },
  })

  const byStatus: Record<string, number> = {
    BLANK: 0,
    MISSING: 0,
    BLURRED: 0,
    UNCLEAR: 0,
    UNSCANNED: 0,
    OK: 0,
  }

  let totalReviewed = 0
  let totalAppsAwaitingHumanReview = 0

  for (const app of apps) {
    const dv = app.docVerification as Record<string, unknown>
    const documents = Array.isArray(dv['documents']) ? (dv['documents'] as Array<Record<string, unknown>>) : []
    const humanReviewStatus = typeof dv['humanReviewStatus'] === 'string' ? dv['humanReviewStatus'] : null
    const aiReviewedAt = dv['aiReviewedAt'] ?? null

    if (aiReviewedAt) totalReviewed++

    if (humanReviewStatus === null || humanReviewStatus === 'PENDING') {
      if (documents.length > 0 && aiReviewedAt) {
        totalAppsAwaitingHumanReview++
      }
    }

    for (const doc of documents) {
      const status = typeof doc['status'] === 'string' ? doc['status'] : null
      if (status && status in byStatus) {
        byStatus[status]!++
      }
    }
  }

  res.json({ totalReviewed, byStatus, totalAppsAwaitingHumanReview })
})

const ListQuerySchema = z.object({
  type:               z.enum(['CTE', 'CTO', 'HW_AUTH']).optional(),
  state:              z.enum(['DRAFT', 'UNDER_REVIEW', 'RECOMMENDED', 'APPROVED', 'REJECTED', 'EXPIRED', 'RENEWED']).optional(),
  expiringWithinDays: z.coerce.number().int().min(1).optional(),
  industryId:         z.string().optional(),
  makerId:            z.string().optional(),
  checkerId:          z.string().optional(),
  limit:              z.coerce.number().int().min(1).max(100).default(20),
  cursor:             z.string().optional(),
})

const ActionBodySchema = z.object({ reason: z.string().optional() })

consentsRouter.get('/', requireAuth, async (req, res) => {
  const parsed = ListQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }
  const { type, state, expiringWithinDays, industryId, makerId, checkerId, limit, cursor } = parsed.data

  const where: Prisma.ConsentApplicationWhereInput = {}
  if (type)       where.type       = type
  if (state)      where.state      = state
  if (industryId) where.industryId = industryId
  if (makerId)    where.makerId    = makerId
  if (checkerId)  where.checkerId  = checkerId
  if (expiringWithinDays) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + expiringWithinDays)
    where.validityTo = { lte: cutoff }
    where.state      = { in: ['APPROVED', 'RENEWED'] }
  }

  const items = await prisma.consentApplication.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { updatedAt: 'desc' },
    include: {
      industry: { select: { id: true, name: true, ucNumber: true, category: true } },
      maker:    { select: { id: true, name: true, designation: true } },
      checker:  { select: { id: true, name: true, designation: true } },
    },
  })

  let nextCursor: string | undefined
  if (items.length > limit) {
    nextCursor = items[limit]!.id
    items.splice(limit)
  }

  res.json({ items, nextCursor })
})

// POST /api/consents/:id/recommend — CONSENT_OFFICER only (maker)
consentsRouter.post(
  '/:id/recommend',
  requireAuth,
  requireRole('CONSENT_OFFICER'),
  async (req, res) => {
    const parsed = ActionBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body' })
      return
    }

    const consent = await prisma.consentApplication.findUnique({ where: { id: req.params['id'] } })
    if (!consent) {
      res.status(404).json({ error: 'consent_not_found' })
      return
    }
    if (consent.state !== 'DRAFT' && consent.state !== 'UNDER_REVIEW') {
      res.status(409).json({ error: 'invalid_state_transition', current: consent.state })
      return
    }

    const actorId = req.auth!.sub
    const before = { state: consent.state, makerId: consent.makerId }

    const updated = await prisma.consentApplication.update({
      where: { id: consent.id },
      data:  { state: 'RECOMMENDED', makerId: actorId },
    })

    await writeAudit({
      actorId,
      entity:   'ConsentApplication',
      entityId: consent.id,
      action:   'RECOMMENDED',
      before,
      after:    { state: updated.state, makerId: updated.makerId },
      reason:   parsed.data.reason,
    })

    res.json(updated)
  },
)

// POST /api/consents/:id/approve — SENIOR_REVIEWER only (checker)
// Valid from states: DRAFT, RECOMMENDED
consentsRouter.post(
  '/:id/approve',
  requireAuth,
  requireRole('SENIOR_REVIEWER'),
  async (req, res) => {
    const parsed = ActionBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body' })
      return
    }

    const consent = await prisma.consentApplication.findUnique({ where: { id: req.params['id'] } })
    if (!consent) {
      res.status(404).json({ error: 'consent_not_found' })
      return
    }
    if (consent.state !== 'DRAFT' && consent.state !== 'RECOMMENDED') {
      res.status(409).json({ error: 'invalid_state_transition', current: consent.state })
      return
    }

    const actorId = req.auth!.sub
    const before = { state: consent.state, checkerId: consent.checkerId }

    const updated = await prisma.consentApplication.update({
      where: { id: consent.id },
      data:  { state: 'APPROVED', checkerId: actorId },
    })

    await writeAudit({
      actorId,
      entity:   'ConsentApplication',
      entityId: consent.id,
      action:   'APPROVED',
      before,
      after:    { state: updated.state, checkerId: updated.checkerId },
      reason:   parsed.data.reason,
    })

    res.json(updated)
  },
)

// POST /api/consents/:id/reject — SENIOR_REVIEWER only
consentsRouter.post(
  '/:id/reject',
  requireAuth,
  requireRole('SENIOR_REVIEWER'),
  async (req, res) => {
    const parsed = ActionBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body' })
      return
    }

    const consent = await prisma.consentApplication.findUnique({ where: { id: req.params['id'] } })
    if (!consent) {
      res.status(404).json({ error: 'consent_not_found' })
      return
    }
    if (consent.state === 'REJECTED') {
      res.status(409).json({ error: 'invalid_state_transition', current: consent.state })
      return
    }

    const actorId = req.auth!.sub
    const before = { state: consent.state, checkerId: consent.checkerId }

    const updated = await prisma.consentApplication.update({
      where: { id: consent.id },
      data:  { state: 'REJECTED', checkerId: actorId, reviewerNotes: parsed.data.reason },
    })

    await writeAudit({
      actorId,
      entity:   'ConsentApplication',
      entityId: consent.id,
      action:   'REJECTED',
      before,
      after:    { state: updated.state, checkerId: updated.checkerId },
      reason:   parsed.data.reason,
    })

    res.json(updated)
  },
)

// ── GET /api/consents/:id/doc-verification ────────────────────────────────────

consentsRouter.get('/:id/doc-verification', requireAuth, async (req, res) => {
  const consent = await prisma.consentApplication.findUnique({
    where: { id: req.params['id'] },
    select: { id: true, docVerification: true },
  })
  if (!consent) {
    res.status(404).json({ error: 'consent_not_found' })
    return
  }

  const dv = consent.docVerification as Record<string, unknown>
  const documents = Array.isArray(dv['documents']) ? dv['documents'] : []
  const aiReviewedAt = dv['aiReviewedAt'] ?? null
  const humanReviewStatus = dv['humanReviewStatus'] ?? null

  res.json({ documents, aiReviewedAt, humanReviewStatus })
})

// ── POST /api/consents/:id/human-review ───────────────────────────────────────
// CONSENT_OFFICER only

const HumanReviewBodySchema = z.object({
  status: z.enum(['APPROVED', 'RETURNED']),
  notes:  z.string().optional(),
})

consentsRouter.post(
  '/:id/human-review',
  requireAuth,
  requireRole('CONSENT_OFFICER'),
  async (req, res) => {
    const parsed = HumanReviewBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
      return
    }

    const consent = await prisma.consentApplication.findUnique({
      where: { id: req.params['id'] },
      select: { id: true, docVerification: true },
    })
    if (!consent) {
      res.status(404).json({ error: 'consent_not_found' })
      return
    }

    const actorId = req.auth!.sub
    const existingDv = consent.docVerification as Record<string, unknown>
    const before = { humanReviewStatus: existingDv['humanReviewStatus'] ?? null }

    const newDv: Record<string, unknown> = {
      ...existingDv,
      humanReviewStatus: parsed.data.status,
      humanReviewedAt:   new Date().toISOString(),
      humanReviewedById: actorId,
      ...(parsed.data.notes !== undefined ? { humanReviewNotes: parsed.data.notes } : {}),
    }

    const updated = await prisma.consentApplication.update({
      where: { id: consent.id },
      data:  { docVerification: newDv as Prisma.InputJsonValue },
    })

    await writeAudit({
      actorId,
      entity:   'ConsentApplication',
      entityId: consent.id,
      action:   `DOC_REVIEW_${parsed.data.status}`,
      before:   before as Prisma.InputJsonValue,
      after:    { humanReviewStatus: parsed.data.status } as Prisma.InputJsonValue,
      reason:   parsed.data.notes,
    })

    res.json(updated)
  },
)
