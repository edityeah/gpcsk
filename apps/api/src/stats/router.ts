/**
 * Stats / aggregation API — engine for Senior Reviewer dashboards.
 *
 * All endpoints are read-only GET. Auth is required (any role).
 * Queries use Prisma groupBy or $queryRaw with parameterised placeholders.
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const statsRouter = Router()

// ── Shared helpers ────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

function clamp(min: number, max: number, v: number): number {
  return Math.min(max, Math.max(min, v))
}

// ── GET /api/stats/pulse ─────────────────────────────────────────────────────
//
// Returns:
//   { districtStream, liveExceedanceCount24h, topRiskIndustries, breakingAnomalies }
//
// districtStream  — exceedances per district grouped by pollution stream (air / water / etc.)
// liveExceedanceCount24h — total PENDING exceedances in last 24h
// topRiskIndustries — top 10 industries by open violation + exceedance count
// breakingAnomalies — latest 5 exceedances with CRITICAL severity still PENDING

statsRouter.get('/pulse', requireAuth, async (_req, res) => {
  const since24h = daysAgo(1)
  const since30d = daysAgo(30)

  // District × stream breakdown: count exceedances per (district, station type)
  // OCEMS/CEQMS/AAQM/VOC → AIR; MINARS/GEMS → WATER
  const districtRaw = await prisma.$queryRaw<
    Array<{ district: string | null; stream: string; cnt: bigint }>
  >`
    SELECT
      i."districtId"                                        AS district,
      CASE
        WHEN ms.type IN ('OCEMS','AAQM','CEQMS','VOC') THEN 'AIR'
        WHEN ms.type IN ('MINARS','GEMS')              THEN 'WATER'
        ELSE 'OTHER'
      END                                                   AS stream,
      COUNT(*)::bigint                                      AS cnt
    FROM   "Exceedance"  ex
    JOIN   "MonitoringStation" ms ON ms.id = ex."stationId"
    LEFT JOIN "Industry"  i  ON i.id = ms."industryId"
    WHERE  ex."detectedAt" >= ${since30d}
    GROUP  BY i."districtId", stream
    ORDER  BY cnt DESC
  `

  // Total live (PENDING) exceedances in last 24 h
  const liveExceedanceCount24h = await prisma.exceedance.count({
    where: {
      detectedAt: { gte: since24h },
      dispositionState: 'PENDING',
    },
  })

  // Top-10 industries by (open violations + pending exceedances)
  const topRiskRaw = await prisma.$queryRaw<
    Array<{
      industryId: string
      name: string
      districtId: string | null
      openViolations: bigint
      pendingExceedances: bigint
    }>
  >`
    SELECT
      i.id               AS "industryId",
      i.name,
      i."districtId",
      COALESCE(v.cnt,0)  AS "openViolations",
      COALESCE(ex.cnt,0) AS "pendingExceedances"
    FROM "Industry" i
    LEFT JOIN (
      SELECT "industryId", COUNT(*)::bigint AS cnt
      FROM   "Violation"
      WHERE  "dispositionState" = 'PENDING'
      GROUP  BY "industryId"
    ) v  ON v."industryId" = i.id
    LEFT JOIN (
      SELECT ms."industryId", COUNT(*)::bigint AS cnt
      FROM   "Exceedance"  ex2
      JOIN   "MonitoringStation" ms ON ms.id = ex2."stationId"
      WHERE  ex2."dispositionState" = 'PENDING'
      GROUP  BY ms."industryId"
    ) ex ON ex."industryId" = i.id
    WHERE COALESCE(v.cnt,0) + COALESCE(ex.cnt,0) > 0
    ORDER BY COALESCE(v.cnt,0) + COALESCE(ex.cnt,0) DESC
    LIMIT 10
  `

  // Breaking anomalies — last 5 critical pending exceedances
  const breakingAnomalies = await prisma.exceedance.findMany({
    where: {
      severity: 'CRITICAL',
      dispositionState: 'PENDING',
    },
    orderBy: { detectedAt: 'desc' },
    take: 5,
    include: {
      station: { select: { name: true, type: true } },
    },
  })

  return res.json({
    districtStream: districtRaw.map(r => ({
      district: r.district,
      stream: r.stream,
      count: Number(r.cnt),
    })),
    liveExceedanceCount24h,
    topRiskIndustries: topRiskRaw.map(r => ({
      industryId: r.industryId,
      name: r.name,
      districtId: r.districtId,
      openViolations: Number(r.openViolations),
      pendingExceedances: Number(r.pendingExceedances),
    })),
    breakingAnomalies: breakingAnomalies.map(e => ({
      id: e.id,
      parameter: e.parameter,
      observedValue: e.observedValue,
      normValue: e.normValue,
      breachMagnitude: e.breachMagnitude,
      severity: e.severity,
      detectedAt: e.detectedAt,
      stationName: e.station.name,
      stationType: e.station.type,
    })),
  })
})

// ── GET /api/stats/risk-index ────────────────────────────────────────────────
//
// Composite risk score per industry, sorted desc.
// Score = clamp(0,100, 30*exceedance30d_rate + 15*complaint30d_rate + 10*openInspect + 20*(consentGap>0))
// Returns array of { industryId, name, district, sector, category, riskScore, breakdown }.

statsRouter.get('/risk-index', requireAuth, async (_req, res) => {
  const since30d = daysAgo(30)
  const now = new Date()

  // Per-industry metrics in a single $queryRaw for efficiency
  const rows = await prisma.$queryRaw<
    Array<{
      industryId: string
      name: string
      districtId: string | null
      sectorId: string | null
      category: string
      exceedance30d: bigint
      complaints30d: bigint
      openInspections: bigint
      consentGapDays: number | null
    }>
  >`
    SELECT
      i.id                                   AS "industryId",
      i.name,
      i."districtId",
      i."sectorId",
      i.category::text,
      -- OCEMS/CEQMS exceedances in last 30 days
      COALESCE(ex30.cnt, 0)                  AS "exceedance30d",
      -- complaints in last 30 days
      COALESCE(comp30.cnt, 0)                AS "complaints30d",
      -- open (SCHEDULED) inspections
      COALESCE(insp.cnt, 0)                  AS "openInspections",
      -- days since latest active consent expired (NULL if no gap)
      CASE
        WHEN cons.max_validity IS NULL THEN NULL
        WHEN cons.max_validity < ${now} THEN
          EXTRACT(EPOCH FROM (${now}::timestamp - cons.max_validity)) / 86400.0
        ELSE NULL
      END                                    AS "consentGapDays"
    FROM "Industry" i

    -- exceedances last 30d
    LEFT JOIN (
      SELECT ms."industryId", COUNT(*)::bigint AS cnt
      FROM   "Exceedance"  ex2
      JOIN   "MonitoringStation" ms ON ms.id = ex2."stationId"
      WHERE  ex2."detectedAt" >= ${since30d}
      GROUP  BY ms."industryId"
    ) ex30 ON ex30."industryId" = i.id

    -- complaints last 30d
    LEFT JOIN (
      SELECT "industryId", COUNT(*)::bigint AS cnt
      FROM   "Complaint"
      WHERE  "receivedAt" >= ${since30d}
        AND  "industryId" IS NOT NULL
      GROUP  BY "industryId"
    ) comp30 ON comp30."industryId" = i.id

    -- open scheduled inspections
    LEFT JOIN (
      SELECT "industryId", COUNT(*)::bigint AS cnt
      FROM   "Inspection"
      WHERE  state = 'SCHEDULED'
      GROUP  BY "industryId"
    ) insp ON insp."industryId" = i.id

    -- latest active consent validity
    LEFT JOIN (
      SELECT "industryId", MAX("validityTo") AS max_validity
      FROM   "ConsentApplication"
      WHERE  state IN ('APPROVED','RENEWED')
        AND  "validityTo" IS NOT NULL
      GROUP  BY "industryId"
    ) cons ON cons."industryId" = i.id

    WHERE COALESCE(ex30.cnt,0) + COALESCE(comp30.cnt,0) + COALESCE(insp.cnt,0) > 0
       OR cons.max_validity < ${now}
    ORDER BY i.id
  `

  // Fetch district + sector names for display
  const districts = await prisma.district.findMany({ select: { id: true, name: true } })
  const sectors = await prisma.sector.findMany({ select: { id: true, name: true } })
  const districtMap = new Map(districts.map(d => [d.id, d.name]))
  const sectorMap = new Map(sectors.map(s => [s.id, s.name]))

  const scored = rows.map(r => {
    const exc = Number(r.exceedance30d)
    const comp = Number(r.complaints30d)
    const openInsp = Number(r.openInspections)
    const consentGapDays = r.consentGapDays != null ? Number(r.consentGapDays) : 0

    // Normalise to rates (0..1 for scoring, capped)
    const excRate = Math.min(exc / 10, 1)
    const compRate = Math.min(comp / 5, 1)
    const inspRate = Math.min(openInsp / 3, 1)
    const consentFlag = consentGapDays > 0 ? 1 : 0

    const riskScore = clamp(
      0,
      100,
      30 * excRate + 15 * compRate + 10 * inspRate + 20 * consentFlag,
    )

    return {
      industryId: r.industryId,
      name: r.name,
      district: r.districtId != null ? districtMap.get(r.districtId) ?? null : null,
      sector: r.sectorId != null ? sectorMap.get(r.sectorId) ?? null : null,
      category: r.category,
      riskScore: Math.round(riskScore * 10) / 10,
      breakdown: {
        exceedance30d: exc,
        complaints30d: comp,
        openInspections: openInsp,
        consentGapDays: Math.round(consentGapDays),
      },
    }
  })

  scored.sort((a, b) => b.riskScore - a.riskScore)
  return res.json(scored)
})

// ── GET /api/stats/enforcement-pipeline ──────────────────────────────────────
//
// Returns:
//   { byState, byType, slaBreaches, avgTimeInState }
//
// slaBreaches — count of PENDING_REVIEW actions older than 7 days without review.
// avgTimeInState — average (draftedAt → now or reviewedAt) per state in hours.

statsRouter.get('/enforcement-pipeline', requireAuth, async (_req, res) => {
  const slaCutoff = daysAgo(7) // 7-day SLA for review

  const [byState, byType, slaBreaches, avgRaw] = await Promise.all([
    // Count by state
    prisma.enforcementAction.groupBy({
      by: ['state'],
      _count: { id: true },
    }),

    // Count by type
    prisma.enforcementAction.groupBy({
      by: ['type'],
      _count: { id: true },
    }),

    // SLA breaches: PENDING_REVIEW for > 7 days
    prisma.enforcementAction.count({
      where: {
        state: 'PENDING_REVIEW',
        draftedAt: { lte: slaCutoff },
        reviewedAt: null,
      },
    }),

    // Avg time in state (hours) — raw SQL for clarity
    prisma.$queryRaw<Array<{ state: string; avgHours: number }>>`
      SELECT
        state::text,
        AVG(
          EXTRACT(EPOCH FROM (
            COALESCE("reviewedAt", NOW()) - "draftedAt"
          )) / 3600.0
        )::float AS "avgHours"
      FROM "EnforcementAction"
      GROUP BY state
    `,
  ])

  return res.json({
    byState: byState.map(r => ({ state: r.state, count: r._count.id })),
    byType: byType.map(r => ({ type: r.type, count: r._count.id })),
    slaBreaches,
    avgTimeInState: avgRaw.map(r => ({
      state: r.state,
      avgHours: Math.round(r.avgHours * 10) / 10,
    })),
  })
})

// ── GET /api/stats/trend-lab ──────────────────────────────────────────────────
//
// Query params: stationId (required), parameter (required), from (ISO date), to (ISO date)
// Returns: { stationId, stationName, parameter, normValue, series: [{ timestamp, value }] }

const TrendLabQuery = z.object({
  stationId: z.string().min(1),
  parameter: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
})

statsRouter.get('/trend-lab', requireAuth, async (req, res) => {
  const parsed = TrendLabQuery.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_query', issues: parsed.error.issues })
  }

  const { stationId, parameter, from, to } = parsed.data

  const fromDate = from ? new Date(from) : daysAgo(30)
  const toDate = to ? new Date(to) : new Date()

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return res.status(400).json({ error: 'invalid_date_range' })
  }

  const station = await prisma.monitoringStation.findUnique({
    where: { id: stationId },
    select: { id: true, name: true, type: true },
  })
  if (!station) {
    return res.status(404).json({ error: 'station_not_found' })
  }

  // Fetch norm for the parameter (best-effort match; no norm found → null)
  const norm = await prisma.norm.findFirst({
    where: { parameter: { contains: parameter, mode: 'insensitive' } },
    select: { value: true, unit: true },
  })

  const readings = await prisma.sensorReading.findMany({
    where: {
      stationId,
      parameter: { contains: parameter, mode: 'insensitive' },
      timestamp: { gte: fromDate, lte: toDate },
      validity: { not: 'MISSING' },
    },
    orderBy: { timestamp: 'asc' },
    select: { timestamp: true, value: true, unit: true },
    take: 2000, // cap to avoid huge payloads
  })

  return res.json({
    stationId,
    stationName: station.name,
    stationType: station.type,
    parameter,
    normValue: norm?.value ?? null,
    normUnit: norm?.unit ?? null,
    series: readings.map(r => ({ timestamp: r.timestamp, value: r.value, unit: r.unit })),
  })
})

// ── GET /api/stats/festival-monitoring ───────────────────────────────────────
//
// Sabarmati Ganesh Utsav before / during / after comparison.
// Looks at MINARS + GEMS stations on the Sabarmati river;
// compares readings in the 7-day windows before, during, and after the festival.
//
// For the demo dataset: Ganesh Utsav 2023 = 19 Sep – 28 Sep 2023
// Returns: { windows: { before, during, after }, parametersCompared, stations }

const GANESH_UTSAV_START = new Date('2023-09-19T00:00:00Z')
const GANESH_UTSAV_END = new Date('2023-09-28T23:59:59Z')
const BEFORE_START = new Date('2023-09-12T00:00:00Z')
const BEFORE_END = new Date('2023-09-18T23:59:59Z')
const AFTER_START = new Date('2023-09-29T00:00:00Z')
const AFTER_END = new Date('2023-10-05T23:59:59Z')

// ── GET /api/stats/war-room ───────────────────────────────────────────────────
//
// Single aggregated payload for the Senior Reviewer War Room canvas:
//   kpis:            { criticalExceedances24h, inspectionTriggerAlerts, pendingReviewEnforcement, hotspotComplaintsThisWeek }
//   breakingFeed:    last 20 events (critical exceedances + new closures + new show-causes + hotspot spikes)
//   slaSummary:      enforcement in PENDING_REVIEW >48h, inspections due within 24h, RED-category renewals due 30d
//   offlineStations: stations with status != 'active'
//   hotspotPoints:   complaint clusters for map overlay (from complaints/hotspots pattern)

statsRouter.get('/war-room', requireAuth, async (_req, res) => {
  const now   = new Date()
  const h24   = daysAgo(1)
  const d7    = daysAgo(7)
  const d48h  = new Date(now.getTime() - 48 * 3_600_000)
  const in24h = new Date(now.getTime() + 24 * 3_600_000)
  const in30d = new Date(now.getTime() + 30 * 24 * 3_600_000)

  const [
    criticalExceedances24h,
    inspectionTriggerAlerts,
    pendingReviewEnforcement,
    hotspotComplaintsThisWeek,
  ] = await Promise.all([
    // KPI 1 — critical exceedances last 24h
    prisma.exceedance.count({
      where: { severity: 'CRITICAL', detectedAt: { gte: h24 } },
    }),

    // KPI 2 — inspection-trigger alerts (INSPECTION_DUE notifications created in last 7d)
    prisma.notification.count({
      where: { category: 'INSPECTION_DUE', createdAt: { gte: d7 } },
    }),

    // KPI 3 — enforcement actions in PENDING_REVIEW
    prisma.enforcementAction.count({ where: { state: 'PENDING_REVIEW' } }),

    // KPI 4 — complaints received this week
    prisma.complaint.count({ where: { receivedAt: { gte: d7 } } }),
  ])

  // ── Breaking feed — last 20 events ────────────────────────────────────────
  const [recentExceedances, recentCommitted, recentShowCause] = await Promise.all([
    // Critical pending exceedances (last 24h)
    prisma.exceedance.findMany({
      where: { severity: 'CRITICAL', dispositionState: 'PENDING', detectedAt: { gte: h24 } },
      include: {
        station: {
          select: {
            id: true, name: true, type: true,
            industry: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { detectedAt: 'desc' },
      take: 12,
    }),
    // New COMMITTED enforcement in last 7 days
    prisma.enforcementAction.findMany({
      where: { state: 'COMMITTED', reviewedAt: { gte: d7 } },
      include: { industry: { select: { id: true, name: true } } },
      orderBy: { reviewedAt: 'desc' },
      take: 5,
    }),
    // PENDING_REVIEW show-cause/closure (newest)
    prisma.enforcementAction.findMany({
      where: { state: 'PENDING_REVIEW', type: { in: ['SHOW_CAUSE', 'CLOSURE_DIRECTION'] } },
      include: { industry: { select: { id: true, name: true } } },
      orderBy: { draftedAt: 'desc' },
      take: 5,
    }),
  ])

  // Combine + sort by timestamp, take top 20
  type BreakingEvent = {
    id: string
    kind: 'EXCEEDANCE' | 'COMMITTED' | 'PENDING_REVIEW'
    timestamp: Date
    industryId: string | null
    industryName: string | null
    summary: string
    actionCanvas: string
  }

  const feed: BreakingEvent[] = [
    ...recentExceedances.map(e => ({
      id: e.id,
      kind: 'EXCEEDANCE' as const,
      timestamp: e.detectedAt,
      industryId: e.station.industry?.id ?? null,
      industryName: e.station.industry?.name ?? null,
      summary: `CRITICAL ${e.parameter}: ${e.observedValue.toFixed(1)} vs norm ${e.normValue.toFixed(1)} at ${e.station.name} (${e.breachMagnitude.toFixed(0)}% above limit)`,
      actionCanvas: 'OPEN_INDUSTRY_DEEP_DIVE',
    })),
    ...recentCommitted.map(e => ({
      id: e.id,
      kind: 'COMMITTED' as const,
      timestamp: e.reviewedAt!,
      industryId: e.industryId,
      industryName: e.industry.name,
      summary: `${humanType(e.type)} committed for ${e.industry.name}`,
      actionCanvas: 'OPEN_ENFORCEMENT_PIPELINE',
    })),
    ...recentShowCause.map(e => ({
      id: e.id,
      kind: 'PENDING_REVIEW' as const,
      timestamp: e.draftedAt,
      industryId: e.industryId,
      industryName: e.industry.name,
      summary: `${humanType(e.type)} pending review — ${e.industry.name}`,
      actionCanvas: 'OPEN_MAKER_CHECKER_QUEUE',
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 20)

  // ── SLA Summary ──────────────────────────────────────────────────────────
  const [slaEnforcement, slaInspections, slaRenewals] = await Promise.all([
    // PENDING_REVIEW > 48h without review
    prisma.enforcementAction.findMany({
      where: { state: 'PENDING_REVIEW', draftedAt: { lte: d48h }, reviewedAt: null },
      include: { industry: { select: { id: true, name: true } } },
      orderBy: { draftedAt: 'asc' },
      take: 10,
    }),
    // INSPECTION_DUE within 24h
    prisma.inspection.findMany({
      where: { state: 'SCHEDULED', scheduledAt: { lte: in24h, gte: now } },
      include: { industry: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    }),
    // RED-category industries with consent expiring within 30 days
    prisma.consentApplication.findMany({
      where: {
        state: { in: ['APPROVED', 'RENEWED'] },
        validityTo: { lte: in30d, gte: now },
        industry: { category: 'RED' },
      },
      include: { industry: { select: { id: true, name: true, category: true } } },
      orderBy: { validityTo: 'asc' },
      take: 10,
    }),
  ])

  // ── Offline stations for map overlay ────────────────────────────────────
  const offlineStations = await prisma.monitoringStation.findMany({
    where: { status: { not: 'active' } },
    select: {
      id: true, name: true, type: true, status: true, lat: true, lng: true,
      industry: { select: { id: true, name: true } },
    },
    take: 20,
  })

  // ── Complaint hotspot points (recent week) ────────────────────────────────
  // Complaint has no districtId column (it has lat/lng); districts are reached
  // via the linked Industry. Group by rounded lat/lng for the map overlay and
  // skip the district label in this raw query — the canvas can look it up
  // later from /api/industries if needed.
  const hotspotRaw = await prisma.$queryRaw<
    Array<{ lat: number; lng: number; count: bigint; sev: string }>
  >`
    SELECT
      ROUND(lat::numeric, 1)::float  AS lat,
      ROUND(lng::numeric, 1)::float  AS lng,
      COUNT(*)::bigint               AS count,
      MAX(severity::text)            AS sev
    FROM   "Complaint"
    WHERE  lat IS NOT NULL
      AND  lng IS NOT NULL
      AND  "receivedAt" >= ${d7}
    GROUP  BY ROUND(lat::numeric, 1), ROUND(lng::numeric, 1)
    HAVING COUNT(*) >= 1
    ORDER  BY count DESC
    LIMIT  30
  `

  res.json({
    kpis: {
      criticalExceedances24h,
      inspectionTriggerAlerts,
      pendingReviewEnforcement,
      hotspotComplaintsThisWeek,
    },
    breakingFeed: feed.map(e => ({
      id: e.id,
      kind: e.kind,
      timestamp: e.timestamp,
      industryId: e.industryId,
      industryName: e.industryName,
      summary: e.summary,
      actionCanvas: e.actionCanvas,
    })),
    slaSummary: {
      pendingReviewOver48h: slaEnforcement.map(e => ({
        id: e.id,
        type: e.type,
        industryId: e.industryId,
        industryName: e.industry.name,
        draftedAt: e.draftedAt,
        hoursWaiting: Math.round((now.getTime() - e.draftedAt.getTime()) / 3_600_000),
      })),
      inspectionsDueIn24h: slaInspections.map(i => ({
        id: i.id,
        industryId: i.industryId,
        industryName: i.industry.name,
        scheduledAt: i.scheduledAt,
      })),
      redCategoryRenewalsDue30d: slaRenewals.map(c => ({
        id: c.id,
        industryId: c.industryId,
        industryName: c.industry.name,
        category: c.industry.category,
        validityTo: c.validityTo,
        daysRemaining: c.validityTo
          ? Math.ceil((c.validityTo.getTime() - now.getTime()) / 86_400_000)
          : null,
      })),
    },
    offlineStations: offlineStations.map(s => ({
      id: s.id, name: s.name, type: s.type, status: s.status,
      lat: s.lat, lng: s.lng,
      industryId: s.industry?.id ?? null,
      industryName: s.industry?.name ?? null,
    })),
    hotspotPoints: hotspotRaw.map(h => ({
      lat: h.lat,
      lng: h.lng,
      count: Number(h.count),
      severity: h.sev,
    })),
    generatedAt: now,
  })
})

function humanType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

statsRouter.get('/festival-monitoring', requireAuth, async (_req, res) => {
  // Find Sabarmati-related stations (MINARS / GEMS / AAQM near Ahmedabad)
  const sabarmatiStations = await prisma.monitoringStation.findMany({
    where: {
      type: { in: ['MINARS', 'GEMS', 'AAQM'] },
      name: { contains: 'Sabarmati', mode: 'insensitive' },
    },
    select: { id: true, name: true, type: true },
  })

  // If no Sabarmati stations found (sparse data), fall back to all MINARS in AHM
  const stationIds =
    sabarmatiStations.length > 0
      ? sabarmatiStations.map(s => s.id)
      : (
          await prisma.monitoringStation.findMany({
            where: { type: { in: ['MINARS', 'AAQM'] } },
            select: { id: true },
            take: 10,
          })
        ).map(s => s.id)

  type WindowLabel = 'BEFORE' | 'DURING' | 'AFTER'
  const windows: Record<WindowLabel, { from: Date; to: Date }> = {
    BEFORE: { from: BEFORE_START, to: BEFORE_END },
    DURING: { from: GANESH_UTSAV_START, to: GANESH_UTSAV_END },
    AFTER:  { from: AFTER_START, to: AFTER_END },
  }

  const windowLabels: WindowLabel[] = ['BEFORE', 'DURING', 'AFTER']

  // Aggregate avg value per parameter per window
  const aggregated: Record<
    WindowLabel,
    Record<string, { avg: number; count: number; unit: string }>
  > = { BEFORE: {}, DURING: {}, AFTER: {} }

  for (const label of windowLabels) {
    const { from, to } = windows[label]
    const readings = await prisma.sensorReading.findMany({
      where: {
        stationId: { in: stationIds },
        timestamp: { gte: from, lte: to },
        validity: { not: 'MISSING' },
      },
      select: { parameter: true, value: true, unit: true },
    })

    // Group by parameter
    const grouped = new Map<string, { sum: number; count: number; unit: string }>()
    for (const r of readings) {
      const existing = grouped.get(r.parameter)
      if (existing) {
        existing.sum += r.value
        existing.count += 1
      } else {
        grouped.set(r.parameter, { sum: r.value, count: 1, unit: r.unit })
      }
    }
    for (const [param, { sum, count, unit }] of grouped) {
      aggregated[label][param] = {
        avg: Math.round((sum / count) * 100) / 100,
        count,
        unit,
      }
    }
  }

  // Parameters present in at least one window
  const allParams = new Set<string>()
  for (const label of windowLabels) {
    for (const p of Object.keys(aggregated[label])) allParams.add(p)
  }

  return res.json({
    event: 'Ganesh Utsav Sabarmati',
    year: 2023,
    windows: {
      before: {
        from: BEFORE_START,
        to: BEFORE_END,
        parameters: aggregated.BEFORE,
      },
      during: {
        from: GANESH_UTSAV_START,
        to: GANESH_UTSAV_END,
        parameters: aggregated.DURING,
      },
      after: {
        from: AFTER_START,
        to: AFTER_END,
        parameters: aggregated.AFTER,
      },
    },
    parametersCompared: Array.from(allParams).sort(),
    stations: sabarmatiStations.length > 0 ? sabarmatiStations : [],
  })
})
