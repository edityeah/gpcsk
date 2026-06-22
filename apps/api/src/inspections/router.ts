import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { writeAudit } from '../audit/service.js'

export const inspectionsRouter = Router()

// ── Query / body schemas ──────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  state:       z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
  industryId:  z.string().optional(),
  inspectorId: z.string().optional(),
  since:       z.coerce.date().optional(),
  until:       z.coerce.date().optional(),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
  cursor:      z.string().optional(),
})

const CreateSchema = z.object({
  industryId:  z.string().min(1),
  scheduledAt: z.coerce.date(),
  inspectorId: z.string().optional(),
  nextDueAt:   z.coerce.date().optional(),
})

const ViolationInputSchema = z.object({
  parameter:     z.string().min(1),
  observedValue: z.number().optional(),
  normValue:     z.number().optional(),
  unit:          z.string().optional(),
  severity:      z.enum(['MINOR', 'MAJOR', 'CRITICAL']),
  source:        z.enum(['SENSOR', 'INSPECTION', 'COMPLAINT', 'AUDIT']).default('INSPECTION'),
})

const CompleteSchema = z.object({
  observations: z.record(z.string(), z.unknown()).optional().default({}),
  photos:       z.array(z.string()).optional().default([]),
  violations:   z.array(ViolationInputSchema).optional().default([]),
  nextDueAt:    z.coerce.date().optional(),
})

const ConfirmQueueSchema = z.object({
  scheduledAt: z.coerce.date(),
  inspectorId: z.string().optional(),
})

const DismissQueueSchema = z.object({
  reason: z.string().min(1),
})

// ── Risk-based queue routes — MUST come before /:id to avoid param capture ────

// GET /api/inspections/risk-based-queue/stats

inspectionsRouter.get('/risk-based-queue/stats', requireAuth, async (_req, res) => {
  const now = new Date()
  const since30d = new Date(now.getTime() - 30 * 86_400_000)

  const [suggested, confirmedLast30d, dismissedLast30d] = await Promise.all([
    prisma.riskBasedSuggestion.count({ where: { state: 'SUGGESTED' } }),
    prisma.riskBasedSuggestion.count({
      where: { state: 'CONFIRMED', decidedAt: { gte: since30d } },
    }),
    prisma.riskBasedSuggestion.count({
      where: { state: 'DISMISSED', decidedAt: { gte: since30d } },
    }),
  ])

  // Average time from suggestedAt to decidedAt for decided rows in last 30d
  const decidedRows = await prisma.riskBasedSuggestion.findMany({
    where: {
      state: { in: ['CONFIRMED', 'DISMISSED'] },
      decidedAt: { gte: since30d },
    },
    select: { suggestedAt: true, decidedAt: true },
  })

  let avgTimeToDecisionHours: number | null = null
  if (decidedRows.length > 0) {
    const totalMs = decidedRows.reduce((sum, r) => {
      const diff = r.decidedAt ? r.decidedAt.getTime() - r.suggestedAt.getTime() : 0
      return sum + diff
    }, 0)
    avgTimeToDecisionHours = Math.round((totalMs / decidedRows.length / 3_600_000) * 10) / 10
  }

  res.json({ suggested, confirmedLast30d, dismissedLast30d, avgTimeToDecisionHours })
})

// GET /api/inspections/risk-based-queue

inspectionsRouter.get('/risk-based-queue', requireAuth, async (_req, res) => {
  const items = await prisma.riskBasedSuggestion.findMany({
    where: { state: 'SUGGESTED' },
    orderBy: { riskScore: 'desc' },
    include: {
      industry: {
        select: { id: true, name: true, ucNumber: true, category: true, district: { select: { name: true } } },
      },
    },
  })

  res.json(items)
})

// POST /api/inspections/risk-based-queue/:id/confirm — IEO or SENIOR_REVIEWER

inspectionsRouter.post(
  '/risk-based-queue/:id/confirm',
  requireAuth,
  requireRole('INSPECTION_ENFORCEMENT_OFFICER', 'SENIOR_REVIEWER'),
  async (req, res) => {
    const parsed = ConfirmQueueSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
      return
    }

    const suggestion = await prisma.riskBasedSuggestion.findUnique({ where: { id: req.params['id'] } })
    if (!suggestion) {
      res.status(404).json({ error: 'suggestion_not_found' })
      return
    }
    if (suggestion.state !== 'SUGGESTED') {
      res.status(409).json({ error: 'not_in_suggested_state', current: suggestion.state })
      return
    }

    const actorId = req.auth!.sub
    const now = new Date()

    const [inspection, updatedSuggestion] = await prisma.$transaction(async (tx) => {
      const insp = await tx.inspection.create({
        data: {
          industryId:     suggestion.industryId,
          scheduledAt:    parsed.data.scheduledAt,
          inspectorId:    parsed.data.inspectorId ?? actorId,
          state:          'SCHEDULED',
          inspectionType: 'RISK_BASED',
          observations:   {},
          photos:         [],
        },
      })

      const sugg = await tx.riskBasedSuggestion.update({
        where: { id: suggestion.id },
        data: {
          state:                 'CONFIRMED',
          decidedById:           actorId,
          decidedAt:             now,
          scheduledInspectionId: insp.id,
        },
      })

      return [insp, sugg]
    })

    await writeAudit({
      actorId,
      entity:   'RiskBasedSuggestion',
      entityId: suggestion.id,
      action:   'CONFIRMED',
      before:   { state: 'SUGGESTED' } as never,
      after:    { state: 'CONFIRMED', scheduledInspectionId: inspection.id } as never,
      reason:   'Risk-based inspection confirmed and scheduled',
    })

    res.status(201).json({ suggestion: updatedSuggestion, inspection })
  },
)

// POST /api/inspections/risk-based-queue/:id/dismiss — IEO or SENIOR_REVIEWER

inspectionsRouter.post(
  '/risk-based-queue/:id/dismiss',
  requireAuth,
  requireRole('INSPECTION_ENFORCEMENT_OFFICER', 'SENIOR_REVIEWER'),
  async (req, res) => {
    const parsed = DismissQueueSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
      return
    }

    const suggestion = await prisma.riskBasedSuggestion.findUnique({ where: { id: req.params['id'] } })
    if (!suggestion) {
      res.status(404).json({ error: 'suggestion_not_found' })
      return
    }
    if (suggestion.state !== 'SUGGESTED') {
      res.status(409).json({ error: 'not_in_suggested_state', current: suggestion.state })
      return
    }

    const actorId = req.auth!.sub
    const now = new Date()

    const updated = await prisma.riskBasedSuggestion.update({
      where: { id: suggestion.id },
      data: {
        state:       'DISMISSED',
        decidedById: actorId,
        decidedAt:   now,
      },
    })

    await writeAudit({
      actorId,
      entity:   'RiskBasedSuggestion',
      entityId: suggestion.id,
      action:   'DISMISSED',
      before:   { state: 'SUGGESTED' } as never,
      after:    { state: 'DISMISSED' } as never,
      reason:   parsed.data.reason,
    })

    res.json(updated)
  },
)

// ── GET /api/inspections ──────────────────────────────────────────────────────

inspectionsRouter.get('/', requireAuth, async (req, res) => {
  const parsed = ListQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }

  const { state, industryId, inspectorId, since, until, limit, cursor } = parsed.data

  const where: Prisma.InspectionWhereInput = {}
  if (state)       where.state       = state
  if (industryId)  where.industryId  = industryId
  if (inspectorId) where.inspectorId = inspectorId
  if (since || until) {
    where.scheduledAt = {}
    if (since) where.scheduledAt.gte = since
    if (until) where.scheduledAt.lte = until
  }

  const items = await prisma.inspection.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { scheduledAt: 'desc' },
    include: {
      industry: { select: { id: true, name: true, ucNumber: true, category: true } },
      inspector: { select: { id: true, name: true } },
      violations: {
        select: { id: true, parameter: true, severity: true, dispositionState: true },
      },
    },
  })

  let nextCursor: string | undefined
  if (items.length > limit) {
    nextCursor = items[limit]!.id
    items.splice(limit)
  }

  res.json({ items, nextCursor })
})

// ── GET /api/inspections/:id ──────────────────────────────────────────────────

inspectionsRouter.get('/:id', requireAuth, async (req, res) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id: req.params['id'] },
    include: {
      industry: { select: { id: true, name: true, ucNumber: true, category: true, district: { select: { name: true } } } },
      inspector: { select: { id: true, name: true, designation: true } },
      violations: true,
    },
  })

  if (!inspection) {
    res.status(404).json({ error: 'inspection_not_found' })
    return
  }

  res.json(inspection)
})

// ── POST /api/inspections — schedule a new inspection ────────────────────────
// INSPECTION_ENFORCEMENT_OFFICER only

inspectionsRouter.post(
  '/',
  requireAuth,
  requireRole('INSPECTION_ENFORCEMENT_OFFICER'),
  async (req, res) => {
    const parsed = CreateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
      return
    }

    const { industryId, scheduledAt, inspectorId, nextDueAt } = parsed.data

    // Validate industry exists
    const industry = await prisma.industry.findUnique({ where: { id: industryId }, select: { id: true } })
    if (!industry) {
      res.status(404).json({ error: 'industry_not_found' })
      return
    }

    const actorId = req.auth!.sub

    const inspection = await prisma.inspection.create({
      data: {
        industryId,
        scheduledAt,
        inspectorId: inspectorId ?? actorId,
        nextDueAt:   nextDueAt ?? null,
        state: 'SCHEDULED',
        observations: {},
        photos: [],
      },
    })

    await writeAudit({
      actorId,
      entity: 'Inspection',
      entityId: inspection.id,
      action: 'SCHEDULED',
      before: null as never,
      after: { state: 'SCHEDULED', industryId, scheduledAt } as never,
      reason: 'Inspection scheduled by IEO',
    })

    res.status(201).json(inspection)
  },
)

// ── POST /api/inspections/:id/complete — record findings + violations ─────────
// INSPECTION_ENFORCEMENT_OFFICER only

inspectionsRouter.post(
  '/:id/complete',
  requireAuth,
  requireRole('INSPECTION_ENFORCEMENT_OFFICER'),
  async (req, res) => {
    const parsed = CompleteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
      return
    }

    const existing = await prisma.inspection.findUnique({
      where: { id: req.params['id'] },
      select: { id: true, state: true, industryId: true },
    })
    if (!existing) {
      res.status(404).json({ error: 'inspection_not_found' })
      return
    }
    if (existing.state !== 'SCHEDULED') {
      res.status(409).json({ error: 'not_in_scheduled_state', current: existing.state })
      return
    }

    const actorId = req.auth!.sub
    const now = new Date()
    const { observations, photos, violations, nextDueAt } = parsed.data

    // Update inspection + create violations in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const insp = await tx.inspection.update({
        where: { id: existing.id },
        data: {
          state: 'COMPLETED',
          completedAt: now,
          observations: observations as Prisma.InputJsonValue,
          photos: photos as Prisma.InputJsonValue,
          nextDueAt: nextDueAt ?? null,
        },
      })

      // Create violation records linked to this inspection
      for (const v of violations) {
        await tx.violation.create({
          data: {
            industryId: existing.industryId,
            inspectionId: existing.id,
            source: v.source,
            parameter: v.parameter,
            observedValue: v.observedValue ?? null,
            normValue: v.normValue ?? null,
            unit: v.unit ?? null,
            severity: v.severity,
            detectedAt: now,
            dispositionState: 'PENDING',
          },
        })
      }

      return insp
    })

    await writeAudit({
      actorId,
      entity: 'Inspection',
      entityId: existing.id,
      action: 'COMPLETED',
      before: { state: 'SCHEDULED' } as never,
      after: { state: 'COMPLETED', violationCount: violations.length } as never,
      reason: `Inspection completed with ${violations.length} violation(s) recorded`,
    })

    res.json(updated)
  },
)
