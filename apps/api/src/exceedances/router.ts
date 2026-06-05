/**
 * Exceedances router
 *
 * GET  /api/exceedances                   – paginated list with filters
 * POST /api/exceedances/:id/disposition   – MONITORING_OFFICER marks disposition
 *                                           → CONFIRMED_VIOLATION auto-creates
 *                                             an EnforcementAction DRAFT for the industry
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { writeAudit } from '../audit/service.js'

export const exceedancesRouter = Router()

// ── GET /api/exceedances ───────────────────────────────────────────────────

const ExceedancesQuerySchema = z.object({
  severity:         z.enum(['MINOR','MAJOR','CRITICAL']).optional(),
  dispositionState: z.enum(['PENDING','CONFIRMED_VIOLATION','SENSOR_GLITCH','RESOLVED']).optional(),
  since:            z.string().datetime({ offset: true }).optional(),
  stationId:        z.string().optional(),
  industryId:       z.string().optional(),
  parameter:        z.string().optional(),
  limit:            z.coerce.number().int().min(1).max(500).default(50),
  cursor:           z.string().optional(), // exceedance id for keyset pagination
})

exceedancesRouter.get('/', requireAuth, async (req, res) => {
  const parsed = ExceedancesQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }
  const { severity, dispositionState, since, stationId, industryId, parameter, limit, cursor } = parsed.data

  const where: Record<string, unknown> = {}
  if (severity)         where['severity']         = severity
  if (dispositionState) where['dispositionState'] = dispositionState
  if (stationId)        where['stationId']        = stationId
  if (parameter)        where['parameter']        = parameter
  if (since)            where['detectedAt']       = { gte: new Date(since) }
  if (industryId)       where['station']          = { industryId }
  if (cursor)           where['id']               = { lt: cursor }

  const exceedances = await prisma.exceedance.findMany({
    where,
    select: {
      id:               true,
      parameter:        true,
      observedValue:    true,
      normValue:        true,
      breachMagnitude:  true,
      severity:         true,
      detectedAt:       true,
      dispositionState: true,
      dispositionAt:    true,
      dispositionNotes: true,
      station: {
        select: {
          id:         true,
          name:       true,
          type:       true,
          industryId: true,
          industry: {
            select: { id: true, name: true, districtId: true },
          },
        },
      },
      dispositionActor: {
        select: { id: true, name: true, designation: true },
      },
    },
    orderBy: { detectedAt: 'desc' },
    take: limit,
  })

  const nextCursor = exceedances.length === limit
    ? (exceedances[exceedances.length - 1]?.id ?? null)
    : null

  res.json({ exceedances, nextCursor, count: exceedances.length })
})

// ── POST /api/exceedances/:id/disposition ─────────────────────────────────

const DispositionBodySchema = z.object({
  state: z.enum(['CONFIRMED_VIOLATION','SENSOR_GLITCH','RESOLVED']),
  notes: z.string().max(2000).optional(),
})

exceedancesRouter.post(
  '/:id/disposition',
  requireAuth,
  requireRole('MONITORING_OFFICER'),
  async (req, res) => {
    const { id } = req.params
    const actorId = req.auth!.sub

    const parsed = DispositionBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
      return
    }
    const { state, notes } = parsed.data

    // Load exceedance (with station for industry FK)
    const exceedance = await prisma.exceedance.findUnique({
      where: { id },
      include: {
        station: {
          select: { id: true, industryId: true },
        },
      },
    })

    if (!exceedance) {
      res.status(404).json({ error: 'exceedance_not_found' })
      return
    }

    if (exceedance.dispositionState !== 'PENDING') {
      res.status(409).json({ error: 'already_dispositioned', current: exceedance.dispositionState })
      return
    }

    const now = new Date()
    const before = {
      dispositionState:   exceedance.dispositionState,
      dispositionActorId: exceedance.dispositionActorId,
      dispositionAt:      exceedance.dispositionAt,
      dispositionNotes:   exceedance.dispositionNotes,
    }

    // Update exceedance disposition
    const updated = await prisma.exceedance.update({
      where: { id },
      data: {
        dispositionState:   state,
        dispositionActorId: actorId,
        dispositionAt:      now,
        dispositionNotes:   notes ?? null,
      },
    })

    // Write audit log
    await writeAudit({
      actorId,
      entity:   'Exceedance',
      entityId: id,
      action:   'DISPOSITION',
      before,
      after: {
        dispositionState:   state,
        dispositionActorId: actorId,
        dispositionAt:      now,
        dispositionNotes:   notes ?? null,
      },
      reason: notes,
    })

    // Auto-create EnforcementAction draft on CONFIRMED_VIOLATION
    let enforcementAction = null
    if (state === 'CONFIRMED_VIOLATION' && exceedance.station.industryId) {
      const industryId = exceedance.station.industryId

      // Use the INSPECTION_ENFORCEMENT_OFFICER as the draftedBy actor
      // (the spec says auto-create a draft for that officer; we use the
      // first IEO user or fall back to the MO themselves)
      const ieo = await prisma.user.findFirst({
        where: { role: 'INSPECTION_ENFORCEMENT_OFFICER' },
        select: { id: true },
      })
      const draftedById = ieo?.id ?? actorId

      enforcementAction = await prisma.enforcementAction.create({
        data: {
          industryId,
          type:        'SHOW_CAUSE',
          draftedById,
          draftedAt:   now,
          state:       'DRAFT',
          violationIds: [],
          evidence: {
            source:          'auto_exceedance_disposition',
            exceedanceId:    id,
            stationId:       exceedance.stationId,
            parameter:       exceedance.parameter,
            observedValue:   exceedance.observedValue,
            normValue:       exceedance.normValue,
            breachMagnitude: exceedance.breachMagnitude,
            severity:        exceedance.severity,
            detectedAt:      exceedance.detectedAt,
            dispositionedBy: actorId,
            dispositionedAt: now,
          },
        },
        select: { id: true, industryId: true, type: true, state: true, draftedAt: true },
      })

      // Audit the auto-created enforcement draft
      await writeAudit({
        actorId,
        entity:   'EnforcementAction',
        entityId: enforcementAction.id,
        action:   'AUTO_DRAFT_CREATED',
        before:   null,
        after:    {
          trigger: 'exceedance_disposition',
          exceedanceId: id,
          state:   'DRAFT',
        },
        reason: `Auto-created from exceedance ${id} disposition as CONFIRMED_VIOLATION`,
      })
    }

    res.json({ exceedance: updated, enforcementAction })
  },
)
