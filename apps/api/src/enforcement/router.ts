import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { writeAudit } from '../audit/service.js'

export const enforcementRouter = Router()

// ── Schemas ───────────────────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  state:       z.enum(['DRAFT', 'PENDING_REVIEW', 'COMMITTED', 'RETURNED_FOR_REVISION', 'WITHDRAWN']).optional(),
  industryId:  z.string().optional(),
  type:        z.enum(['SHOW_CAUSE', 'CLOSURE_DIRECTION', 'BANK_GUARANTEE_INVOCATION', 'RECOVERY', 'SEALING']).optional(),
  draftedById: z.string().optional(),
  reviewedById: z.string().optional(),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
  cursor:      z.string().optional(),
})

const CreateSchema = z.object({
  industryId:   z.string().min(1),
  type:         z.enum(['SHOW_CAUSE', 'CLOSURE_DIRECTION', 'BANK_GUARANTEE_INVOCATION', 'RECOVERY', 'SEALING']),
  evidence:     z.record(z.string(), z.unknown()).optional().default({}),
  violationIds: z.array(z.string()).optional().default([]),
})

const ReturnSchema = z.object({
  notes: z.string().min(1),
})

const WithdrawSchema = z.object({
  reason: z.string().optional(),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const REVIEWABLE_STATES = ['DRAFT', 'PENDING_REVIEW', 'RETURNED_FOR_REVISION'] as const

// ── GET /api/enforcement ──────────────────────────────────────────────────────

enforcementRouter.get('/', requireAuth, async (req, res) => {
  const parsed = ListQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }

  const { state, industryId, type, draftedById, reviewedById, limit, cursor } = parsed.data

  const where: Parameters<typeof prisma.enforcementAction.findMany>[0]['where'] = {}
  if (state)       where.state       = state
  if (industryId)  where.industryId  = industryId
  if (type)        where.type        = type
  if (draftedById) where.draftedById = draftedById
  if (reviewedById) where.reviewedById = reviewedById

  const items = await prisma.enforcementAction.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { draftedAt: 'desc' },
    include: {
      industry: { select: { id: true, name: true, ucNumber: true, category: true } },
      draftedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  })

  let nextCursor: string | undefined
  if (items.length > limit) {
    nextCursor = items[limit]!.id
    items.splice(limit)
  }

  res.json({ items, nextCursor })
})

// ── GET /api/enforcement/queue/pending-review — SENIOR_REVIEWER only ──────────

enforcementRouter.get(
  '/queue/pending-review',
  requireAuth,
  requireRole('SENIOR_REVIEWER'),
  async (req, res) => {
    const items = await prisma.enforcementAction.findMany({
      where: { state: 'PENDING_REVIEW' },
      orderBy: { draftedAt: 'asc' }, // oldest first — longest-waiting
      include: {
        industry: { select: { id: true, name: true, ucNumber: true, category: true, district: { select: { name: true } } } },
        draftedBy: { select: { id: true, name: true, designation: true } },
      },
    })

    res.json({ items, total: items.length })
  },
)

// ── GET /api/enforcement/:id ──────────────────────────────────────────────────

enforcementRouter.get('/:id', requireAuth, async (req, res) => {
  const action = await prisma.enforcementAction.findUnique({
    where: { id: req.params['id'] },
    include: {
      industry: { select: { id: true, name: true, ucNumber: true, category: true, district: { select: { name: true } } } },
      draftedBy: { select: { id: true, name: true, designation: true } },
      reviewedBy: { select: { id: true, name: true, designation: true } },
    },
  })

  if (!action) {
    res.status(404).json({ error: 'enforcement_action_not_found' })
    return
  }

  res.json(action)
})

// ── POST /api/enforcement — create DRAFT ──────────────────────────────────────
// INSPECTION_ENFORCEMENT_OFFICER only

enforcementRouter.post(
  '/',
  requireAuth,
  requireRole('INSPECTION_ENFORCEMENT_OFFICER'),
  async (req, res) => {
    const parsed = CreateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
      return
    }

    const { industryId, type, evidence, violationIds } = parsed.data
    const actorId = req.auth!.sub

    // Validate industry exists
    const industry = await prisma.industry.findUnique({ where: { id: industryId }, select: { id: true } })
    if (!industry) {
      res.status(404).json({ error: 'industry_not_found' })
      return
    }

    const action = await prisma.enforcementAction.create({
      data: {
        industryId,
        type,
        draftedById: actorId,
        evidence: evidence as Record<string, unknown>,
        violationIds,
        state: 'DRAFT',
      },
    })

    await writeAudit({
      actorId,
      entity: 'EnforcementAction',
      entityId: action.id,
      action: 'DRAFTED',
      before: null as never,
      after: { state: 'DRAFT', type, industryId } as never,
      reason: 'Enforcement action drafted by IEO',
    })

    res.status(201).json(action)
  },
)

// ── POST /api/enforcement/:id/submit — DRAFT → PENDING_REVIEW ─────────────────
// Only the original maker (INSPECTION_ENFORCEMENT_OFFICER)

enforcementRouter.post(
  '/:id/submit',
  requireAuth,
  requireRole('INSPECTION_ENFORCEMENT_OFFICER'),
  async (req, res) => {
    const action = await prisma.enforcementAction.findUnique({
      where: { id: req.params['id'] },
      select: { id: true, state: true, draftedById: true },
    })
    if (!action) {
      res.status(404).json({ error: 'enforcement_action_not_found' })
      return
    }

    const actorId = req.auth!.sub

    // Only the original maker can submit
    if (action.draftedById !== actorId) {
      res.status(403).json({ error: 'forbidden_only_maker_can_submit' })
      return
    }

    if (action.state !== 'DRAFT' && action.state !== 'RETURNED_FOR_REVISION') {
      res.status(409).json({ error: 'invalid_state_transition', current: action.state, expected: ['DRAFT', 'RETURNED_FOR_REVISION'] })
      return
    }

    const updated = await prisma.enforcementAction.update({
      where: { id: action.id },
      data: { state: 'PENDING_REVIEW' },
    })

    await writeAudit({
      actorId,
      entity: 'EnforcementAction',
      entityId: action.id,
      action: 'SUBMITTED_FOR_REVIEW',
      before: { state: action.state } as never,
      after: { state: 'PENDING_REVIEW' } as never,
      reason: 'Submitted for Senior Reviewer approval',
    })

    res.json(updated)
  },
)

// ── POST /api/enforcement/:id/approve — PENDING_REVIEW → COMMITTED ────────────
// SENIOR_REVIEWER only

enforcementRouter.post(
  '/:id/approve',
  requireAuth,
  requireRole('SENIOR_REVIEWER'),
  async (req, res) => {
    const action = await prisma.enforcementAction.findUnique({
      where: { id: req.params['id'] },
      select: { id: true, state: true },
    })
    if (!action) {
      res.status(404).json({ error: 'enforcement_action_not_found' })
      return
    }
    if (action.state !== 'PENDING_REVIEW') {
      res.status(409).json({ error: 'invalid_state_transition', current: action.state, expected: 'PENDING_REVIEW' })
      return
    }

    const actorId = req.auth!.sub
    const now = new Date()

    const updated = await prisma.enforcementAction.update({
      where: { id: action.id },
      data: {
        state: 'COMMITTED',
        reviewedById: actorId,
        reviewedAt: now,
        // queue delivery — set channel + pending status
        deliveryChannel: 'EMAIL',
        deliveryStatus: 'QUEUED',
      },
    })

    await writeAudit({
      actorId,
      entity: 'EnforcementAction',
      entityId: action.id,
      action: 'APPROVED',
      before: { state: 'PENDING_REVIEW' } as never,
      after: { state: 'COMMITTED', deliveryChannel: 'EMAIL', deliveryStatus: 'QUEUED' } as never,
      reason: 'Approved by Senior Reviewer — notice committed + delivery queued',
    })

    res.json(updated)
  },
)

// ── POST /api/enforcement/:id/return-for-revision ─────────────────────────────
// SENIOR_REVIEWER only — PENDING_REVIEW → RETURNED_FOR_REVISION + notes

enforcementRouter.post(
  '/:id/return-for-revision',
  requireAuth,
  requireRole('SENIOR_REVIEWER'),
  async (req, res) => {
    const bodyParsed = ReturnSchema.safeParse(req.body)
    if (!bodyParsed.success) {
      res.status(400).json({ error: 'invalid_body', details: bodyParsed.error.flatten() })
      return
    }

    const action = await prisma.enforcementAction.findUnique({
      where: { id: req.params['id'] },
      select: { id: true, state: true },
    })
    if (!action) {
      res.status(404).json({ error: 'enforcement_action_not_found' })
      return
    }
    if (action.state !== 'PENDING_REVIEW') {
      res.status(409).json({ error: 'invalid_state_transition', current: action.state, expected: 'PENDING_REVIEW' })
      return
    }

    const actorId = req.auth!.sub
    const { notes } = bodyParsed.data

    const updated = await prisma.enforcementAction.update({
      where: { id: action.id },
      data: {
        state: 'RETURNED_FOR_REVISION',
        reviewedById: actorId,
        reviewedAt: new Date(),
        reviewerNotes: notes,
      },
    })

    await writeAudit({
      actorId,
      entity: 'EnforcementAction',
      entityId: action.id,
      action: 'RETURNED_FOR_REVISION',
      before: { state: 'PENDING_REVIEW' } as never,
      after: { state: 'RETURNED_FOR_REVISION', reviewerNotes: notes } as never,
      reason: notes,
    })

    res.json(updated)
  },
)

// ── POST /api/enforcement/:id/withdraw ────────────────────────────────────────
// The original maker only — any pre-committed state → WITHDRAWN

enforcementRouter.post(
  '/:id/withdraw',
  requireAuth,
  requireRole('INSPECTION_ENFORCEMENT_OFFICER'),
  async (req, res) => {
    const bodyParsed = WithdrawSchema.safeParse(req.body)
    if (!bodyParsed.success) {
      res.status(400).json({ error: 'invalid_body', details: bodyParsed.error.flatten() })
      return
    }

    const action = await prisma.enforcementAction.findUnique({
      where: { id: req.params['id'] },
      select: { id: true, state: true, draftedById: true },
    })
    if (!action) {
      res.status(404).json({ error: 'enforcement_action_not_found' })
      return
    }

    const actorId = req.auth!.sub

    // Only the original maker can withdraw
    if (action.draftedById !== actorId) {
      res.status(403).json({ error: 'forbidden_only_maker_can_withdraw' })
      return
    }

    // Cannot withdraw once committed
    if (action.state === 'COMMITTED' || action.state === 'WITHDRAWN') {
      res.status(409).json({ error: 'invalid_state_transition', current: action.state, message: 'Cannot withdraw a committed or already-withdrawn action' })
      return
    }

    const beforeState = action.state
    const reason = bodyParsed.data.reason ?? 'Maker withdrew the action'

    const updated = await prisma.enforcementAction.update({
      where: { id: action.id },
      data: { state: 'WITHDRAWN' },
    })

    await writeAudit({
      actorId,
      entity: 'EnforcementAction',
      entityId: action.id,
      action: 'WITHDRAWN',
      before: { state: beforeState } as never,
      after: { state: 'WITHDRAWN' } as never,
      reason,
    })

    res.json(updated)
  },
)
