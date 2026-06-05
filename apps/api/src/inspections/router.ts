import { Router } from 'express'
import { z } from 'zod'
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

// ── GET /api/inspections ──────────────────────────────────────────────────────

inspectionsRouter.get('/', requireAuth, async (req, res) => {
  const parsed = ListQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }

  const { state, industryId, inspectorId, since, until, limit, cursor } = parsed.data

  const where: Parameters<typeof prisma.inspection.findMany>[0]['where'] = {}
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
          observations: observations as Record<string, unknown>,
          photos: photos as unknown[],
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
