import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { writeAudit } from '../audit/service.js'
import type { ComplaintState, ViolationSeverity } from '@prisma/client'

export const complaintsRouter = Router()

// ── Auto-categorise ────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: RegExp }> = [
  { category: 'ILLEGAL_DISCHARGE',   keywords: /\b(illegal|unauthorised|unauthorized|bypass|untreated|midnight|night.*discharge)\b/i },
  { category: 'HAZARDOUS_WASTE',     keywords: /\b(hazard(ous)?|drum|barrel|landfill|ash|slag)\b/i },
  { category: 'AIR_POLLUTION',       keywords: /\b(smoke|dust|odour|odor|fumes?|particulate|pm2\.5|pm10|smog|emission|chimney|stack)\b/i },
  { category: 'WATER_POLLUTION',     keywords: /\b(water|effluent|discharge|drain|river|lake|sewage|sewer|liquid|wastewater)\b/i },
  { category: 'NOISE_POLLUTION',     keywords: /\b(noise|sound|loud|vibration|decibel|dB|generator|compressor|machinery)\b/i },
]

function autoCategory(description: string): string {
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.test(description)) return category
  }
  return 'GENERAL'
}

// ── Auto-severity heuristic ────────────────────────────────────────────────

const CRITICAL_PATTERN = /\b(critical|severe|toxic|illegal|bypass|dead|fire|explosion|hazardous waste dump)\b/i
const MAJOR_PATTERN    = /\b(major|serious|significant|continuous|persistent|recurring|strong)\b/i

function autoSeverity(description: string, category: string): ViolationSeverity {
  if (CRITICAL_PATTERN.test(description) || category === 'ILLEGAL_DISCHARGE') return 'CRITICAL'
  if (MAJOR_PATTERN.test(description) || category === 'HAZARDOUS_WASTE') return 'MAJOR'
  return 'MINOR'
}

// ── Find nearest industry within 2 km ─────────────────────────────────────

const EARTH_RADIUS_KM = 6371

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a))
}

async function findNearestIndustry(lat: number, lng: number): Promise<string | null> {
  // Rough bounding box: 2 km ≈ 0.018 degrees of latitude; use 0.02 for safety
  const delta = 0.02
  const industries = await prisma.industry.findMany({
    where: {
      lat: { gte: lat - delta, lte: lat + delta },
      lng: { gte: lng - delta, lte: lng + delta },
    },
    select: { id: true, lat: true, lng: true },
  })

  let nearest: string | null = null
  let minDist = Infinity

  for (const ind of industries) {
    if (ind.lat == null || ind.lng == null) continue
    const dist = haversineKm(lat, lng, ind.lat, ind.lng)
    if (dist < 2 && dist < minDist) {
      minDist = dist
      nearest = ind.id
    }
  }

  return nearest
}

// ── Schemas ────────────────────────────────────────────────────────────────

const CreateComplaintSchema = z.object({
  channel:     z.enum(['WEB', 'PHONE', 'EMAIL', 'WALK_IN']),
  complainant: z.object({
    name:  z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),
  lat:         z.number().optional(),
  lng:         z.number().optional(),
  description: z.string().min(10),
})

const AssignSchema = z.object({
  assignedToId: z.string().min(1),
})

const RespondSchema = z.object({
  message: z.string().min(1),
  action:  z.string().optional(),
})

const StateSchema = z.object({
  state:  z.enum(['RESOLVED', 'CLOSED', 'DUPLICATE']),
  reason: z.string().optional(),
})

const ListQuerySchema = z.object({
  state:        z.string().optional(),
  severity:     z.string().optional(),
  category:     z.string().optional(),
  assignedToId: z.string().optional(),
  since:        z.string().datetime().optional(),
  until:        z.string().datetime().optional(),
  q:            z.string().optional(),
})

// ── GET /api/complaints ────────────────────────────────────────────────────

complaintsRouter.get('/', requireAuth, async (req, res) => {
  const parsed = ListQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })

  const { state, severity, category, assignedToId, since, until, q } = parsed.data

  const complaints = await prisma.complaint.findMany({
    where: {
      ...(state        ? { state: state as ComplaintState } : {}),
      ...(severity     ? { severity: severity as ViolationSeverity } : {}),
      ...(category     ? { category } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(since || until
        ? { receivedAt: { ...(since ? { gte: new Date(since) } : {}), ...(until ? { lte: new Date(until) } : {}) } }
        : {}),
      ...(q
        ? { description: { contains: q, mode: 'insensitive' } }
        : {}),
    },
    orderBy: { receivedAt: 'desc' },
    take: 200,
    include: { assignedTo: { select: { id: true, name: true } } },
  })

  return res.json(complaints)
})

// ── GET /api/complaints/hotspots ───────────────────────────────────────────

complaintsRouter.get('/hotspots', requireAuth, async (_req, res) => {
  const complaints = await prisma.complaint.findMany({
    where: { lat: { not: null }, lng: { not: null } },
    select: { id: true, lat: true, lng: true, severity: true, industryId: true, state: true },
  })

  // Cluster by rounding lat/lng to 2 decimal places
  const clusterMap = new Map<string, {
    lat: number
    lng: number
    count: number
    sampleIds: string[]
    severityCounts: Record<string, number>
    districtId: string | null
  }>()

  for (const c of complaints) {
    if (c.lat == null || c.lng == null) continue
    const clat = Math.round(c.lat * 100) / 100
    const clng = Math.round(c.lng * 100) / 100
    const key = `${clat},${clng}`

    const existing = clusterMap.get(key)
    if (existing) {
      existing.count++
      if (existing.sampleIds.length < 5) existing.sampleIds.push(c.id)
      existing.severityCounts[c.severity] = (existing.severityCounts[c.severity] ?? 0) + 1
    } else {
      clusterMap.set(key, {
        lat: clat,
        lng: clng,
        count: 1,
        sampleIds: [c.id],
        severityCounts: { [c.severity]: 1 },
        districtId: null,
      })
    }
  }

  // Determine dominant severity and shape response
  const hotspots = Array.from(clusterMap.values()).map(cluster => {
    const { severityCounts } = cluster
    const dominantSeverity = (
      (severityCounts['CRITICAL'] ?? 0) > 0 ? 'CRITICAL'
      : (severityCounts['MAJOR'] ?? 0) > 0 ? 'MAJOR'
      : 'MINOR'
    ) as ViolationSeverity

    return {
      lat: cluster.lat,
      lng: cluster.lng,
      count: cluster.count,
      severity: dominantSeverity,
      sampleIds: cluster.sampleIds,
      districtId: cluster.districtId,
    }
  }).sort((a, b) => b.count - a.count)

  return res.json(hotspots)
})

// ── GET /api/complaints/triage-stats ──────────────────────────────────────
// Aggregates for the last 7d and 30d, grouped by category/severity/channel/state.

complaintsRouter.get('/triage-stats', requireAuth, async (_req, res) => {
  const now = new Date()
  const since7d  = new Date(now.getTime() - 7  * 24 * 3_600_000)
  const since30d = new Date(now.getTime() - 30 * 24 * 3_600_000)

  const [
    totalLast7d,
    totalLast30d,
    byCategory,
    bySeverity,
    byChannel,
    byState,
  ] = await Promise.all([
    prisma.complaint.count({ where: { receivedAt: { gte: since7d  } } }),
    prisma.complaint.count({ where: { receivedAt: { gte: since30d } } }),
    prisma.complaint.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { receivedAt: { gte: since30d } },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.complaint.groupBy({
      by: ['severity'],
      _count: { id: true },
      where: { receivedAt: { gte: since30d } },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.complaint.groupBy({
      by: ['channel'],
      _count: { id: true },
      where: { receivedAt: { gte: since30d } },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.complaint.groupBy({
      by: ['state'],
      _count: { id: true },
      where: { receivedAt: { gte: since30d } },
      orderBy: { _count: { id: 'desc' } },
    }),
  ])

  return res.json({
    totalLast7d,
    totalLast30d,
    byCategory: byCategory.map(r => ({ category: r.category, count: r._count.id })),
    bySeverity: bySeverity.map(r => ({ severity: r.severity, count: r._count.id })),
    byChannel:  byChannel.map( r => ({ channel: r.channel,   count: r._count.id })),
    byState:    byState.map(   r => ({ state: r.state,       count: r._count.id })),
  })
})

// ── GET /api/complaints/:id/correlation ───────────────────────────────────
// For one complaint, return industries within 5 km sorted by distance asc.

complaintsRouter.get('/:id/correlation', requireAuth, async (req, res) => {
  const complaint = await prisma.complaint.findUnique({
    where: { id: req.params['id'] },
    select: { id: true, lat: true, lng: true },
  })
  if (!complaint) return res.status(404).json({ error: 'complaint_not_found' })

  const lat = complaint.lat
  const lng = complaint.lng

  if (lat == null || lng == null) {
    return res.json({ nearbyIndustries: [] })
  }

  // Bounding box: 5 km ≈ 0.045 degrees latitude
  const DELTA = 0.05
  const since30d = new Date(Date.now() - 30 * 24 * 3_600_000)

  const industries = await prisma.industry.findMany({
    where: {
      lat: { gte: lat - DELTA, lte: lat + DELTA },
      lng: { gte: lng - DELTA, lte: lng + DELTA },
    },
    select: {
      id:       true,
      name:     true,
      category: true,
      lat:      true,
      lng:      true,
      sector:   { select: { name: true } },
      district: { select: { name: true } },
    },
    take: 50,
  })

  const withDist = industries
    .filter(i => i.lat != null && i.lng != null)
    .map(i => ({
      ...i,
      distanceKm: haversineKm(lat, lng, i.lat!, i.lng!),
    }))
    .filter(i => i.distanceKm <= 5)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8)

  const enriched = await Promise.all(
    withDist.map(async i => {
      const [exceedanceCount, complaintCount] = await Promise.all([
        prisma.exceedance.count({
          where: {
            station:    { industryId: i.id },
            detectedAt: { gte: since30d },
          },
        }),
        prisma.complaint.count({
          where: {
            industryId: i.id,
            receivedAt: { gte: since30d },
          },
        }),
      ])
      return {
        id:                        i.id,
        name:                      i.name,
        distanceKm:                Math.round(i.distanceKm * 10) / 10,
        sector:                    i.sector?.name ?? null,
        category:                  i.category,
        recentExceedanceCount30d:  exceedanceCount,
        openComplaintCount30d:     complaintCount,
      }
    }),
  )

  return res.json({ nearbyIndustries: enriched })
})

// ── GET /api/complaints/:id ────────────────────────────────────────────────

complaintsRouter.get('/:id', requireAuth, async (req, res) => {
  const complaint = await prisma.complaint.findUnique({
    where: { id: req.params['id'] },
    include: {
      responses:  { include: { respondedBy: { select: { id: true, name: true } } }, orderBy: { respondedAt: 'asc' } },
      assignedTo: { select: { id: true, name: true } },
      industry: {
        select: {
          id: true, name: true, ucNumber: true, category: true, lat: true, lng: true,
          violations: {
            orderBy: { detectedAt: 'desc' },
            take: 5,
            select: { id: true, parameter: true, severity: true, detectedAt: true, dispositionState: true },
          },
        },
      },
    },
  })

  if (!complaint) return res.status(404).json({ error: 'complaint_not_found' })
  return res.json(complaint)
})

// ── POST /api/complaints ───────────────────────────────────────────────────

complaintsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = CreateComplaintSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })

  const { channel, complainant, lat, lng, description } = parsed.data

  const category = autoCategory(description)
  const severity = autoSeverity(description, category)
  const industryId = lat != null && lng != null ? await findNearestIndustry(lat, lng) : null

  const complaint = await prisma.complaint.create({
    data: {
      channel,
      complainant,
      lat,
      lng,
      description,
      category,
      severity,
      industryId,
    },
  })

  await writeAudit({
    actorId:  req.auth!.sub,
    entity:   'Complaint',
    entityId: complaint.id,
    action:   'CREATE',
    after:    { state: complaint.state, category, severity, industryId },
  })

  return res.status(201).json(complaint)
})

// ── POST /api/complaints/:id/assign ───────────────────────────────────────

complaintsRouter.post(
  '/:id/assign',
  requireAuth,
  requireRole('COMPLAINTS_OFFICER', 'SENIOR_REVIEWER'),
  async (req, res) => {
    const parsed = AssignSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })

    const complaint = await prisma.complaint.findUnique({ where: { id: req.params['id'] } })
    if (!complaint) return res.status(404).json({ error: 'complaint_not_found' })

    const assignee = await prisma.user.findUnique({ where: { id: parsed.data.assignedToId } })
    if (!assignee) return res.status(404).json({ error: 'assignee_not_found' })

    const prevState = complaint.state
    const updated = await prisma.complaint.update({
      where: { id: complaint.id },
      data: {
        assignedToId: parsed.data.assignedToId,
        state: prevState === 'NEW' ? 'ASSIGNED' : prevState,
      },
    })

    await writeAudit({
      actorId:  req.auth!.sub,
      entity:   'Complaint',
      entityId: complaint.id,
      action:   'ASSIGN',
      before:   { state: prevState, assignedToId: complaint.assignedToId },
      after:    { state: updated.state, assignedToId: updated.assignedToId },
    })

    return res.json(updated)
  }
)

// ── POST /api/complaints/:id/respond ──────────────────────────────────────

complaintsRouter.post('/:id/respond', requireAuth, async (req, res) => {
  const parsed = RespondSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })

  const complaint = await prisma.complaint.findUnique({ where: { id: req.params['id'] } })
  if (!complaint) return res.status(404).json({ error: 'complaint_not_found' })

  // Only the assigned officer (or SENIOR_REVIEWER) may respond
  const actor = req.auth!
  if (
    actor.role !== 'SENIOR_REVIEWER' &&
    complaint.assignedToId !== actor.sub
  ) {
    return res.status(403).json({ error: 'forbidden_not_assigned' })
  }

  const [response, updated] = await prisma.$transaction([
    prisma.complaintResponse.create({
      data: {
        complaintId:   complaint.id,
        respondedById: actor.sub,
        message:       parsed.data.message,
        action:        parsed.data.action,
      },
    }),
    prisma.complaint.update({
      where: { id: complaint.id },
      data:  { state: complaint.state === 'ASSIGNED' ? 'IN_PROGRESS' : complaint.state },
    }),
  ])

  await writeAudit({
    actorId:  actor.sub,
    entity:   'Complaint',
    entityId: complaint.id,
    action:   'RESPOND',
    before:   { state: complaint.state },
    after:    { state: updated.state, responseId: response.id },
  })

  return res.status(201).json({ response, complaint: updated })
})

// ── POST /api/complaints/:id/state ────────────────────────────────────────

complaintsRouter.post(
  '/:id/state',
  requireAuth,
  requireRole('COMPLAINTS_OFFICER', 'SENIOR_REVIEWER'),
  async (req, res) => {
    const parsed = StateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })

    const complaint = await prisma.complaint.findUnique({ where: { id: req.params['id'] } })
    if (!complaint) return res.status(404).json({ error: 'complaint_not_found' })

    const prevState = complaint.state
    const updated = await prisma.complaint.update({
      where: { id: complaint.id },
      data:  { state: parsed.data.state },
    })

    await writeAudit({
      actorId:  req.auth!.sub,
      entity:   'Complaint',
      entityId: complaint.id,
      action:   `STATE_TRANSITION_${parsed.data.state}`,
      before:   { state: prevState },
      after:    { state: parsed.data.state },
      reason:   parsed.data.reason,
    })

    return res.json(updated)
  }
)
