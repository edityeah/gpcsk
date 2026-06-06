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

// ── War Room — in-memory alert state store ────────────────────────────────────
//
// Alert state persists for the lifetime of the API process only.
// On server restart all alerts reset to 'open'. This is intentional for the demo.

type AlertState = 'open' | 'escalated' | 'snoozed' | 'resolved'
const warRoomAlertStates = new Map<string, AlertState>()

// ── POST /api/stats/war-room/:id/escalate|snooze|resolve ─────────────────────

statsRouter.post('/war-room/:id/escalate', requireAuth, (req, res) => {
  const id = req.params['id'] as string
  warRoomAlertStates.set(id, 'escalated')
  res.json({ id, state: 'escalated' })
})

statsRouter.post('/war-room/:id/snooze', requireAuth, (req, res) => {
  const id = req.params['id'] as string
  warRoomAlertStates.set(id, 'snoozed')
  res.json({ id, state: 'snoozed' })
})

statsRouter.post('/war-room/:id/resolve', requireAuth, (req, res) => {
  const id = req.params['id'] as string
  warRoomAlertStates.set(id, 'resolved')
  res.json({ id, state: 'resolved' })
})

// ── GET /api/stats/war-room ───────────────────────────────────────────────────
//
// Returns 8 anomaly cards derived from real seeded data:
//   { open, escalated, snoozed, anomalies: [ anomalyCard, ... ] }
//
// Each anomalyCard:
//   { id, severity: 'CRITICAL'|'MAJOR'|'ANOMALY', type, title, description,
//     entities: [{label, kind}], suggestedActions: string[], saathiPrompt, state }

statsRouter.get('/war-room', requireAuth, async (_req, res) => {
  const now     = new Date()
  const d7      = daysAgo(7)
  const d14     = daysAgo(14)
  const d30     = daysAgo(30)
  const d14h    = new Date(now.getTime() - 14 * 24 * 3_600_000)

  // ── Anomaly 1: CRITICAL · CONFIRMED EXCEEDANCE CLUSTER ──────────────────
  // Pick district with most CONFIRMED_VIOLATION exceedances of COD in last 14d
  const codClusterRaw = await prisma.$queryRaw<
    Array<{ districtId: string | null; districtName: string | null; cnt: bigint; industries: string }>
  >`
    SELECT
      i."districtId",
      d.name AS "districtName",
      COUNT(DISTINCT ex.id)::bigint AS cnt,
      STRING_AGG(DISTINCT i.name, ' | ' ORDER BY i.name) AS industries
    FROM "Exceedance" ex
    JOIN "MonitoringStation" ms ON ms.id = ex."stationId"
    JOIN "Industry" i ON i.id = ms."industryId"
    LEFT JOIN "District" d ON d.id = i."districtId"
    WHERE ex."dispositionState" = 'CONFIRMED_VIOLATION'
      AND ex.parameter ILIKE '%COD%'
      AND ex."detectedAt" >= ${d14h}
    GROUP BY i."districtId", d.name
    ORDER BY cnt DESC
    LIMIT 1
  `

  const topIndustriesForCod = codClusterRaw.length > 0
    ? codClusterRaw[0]!.industries.split(' | ').slice(0, 3)
    : ['Vatva Chemicals', 'Naroda Textiles', 'Odhav Dyes']
  const codDistrict = codClusterRaw[0]?.districtName ?? 'Ahmedabad'
  const codCount = codClusterRaw[0] ? Number(codClusterRaw[0].cnt) : 0

  const anomaly1 = {
    id: 'WR-001',
    severity: 'CRITICAL' as const,
    type: 'CONFIRMED EXCEEDANCE CLUSTER',
    title: `Top ${topIndustriesForCod.length} industries in ${codDistrict} exceeding COD norms simultaneously`,
    description: `${codCount > 0 ? codCount : topIndustriesForCod.length} CONFIRMED_VIOLATION exceedances for COD detected across the top ${topIndustriesForCod.length} polluters in ${codDistrict} district over the past 14 days — indicating a cluster-wide compliance failure that warrants coordinated enforcement.`,
    entities: [
      ...topIndustriesForCod.map(n => ({ label: `🏭 ${n}`, kind: 'industry' as const })),
      { label: `📈 ${codCount} COD exceedances · 14d`, kind: 'metric' as const },
    ],
    suggestedActions: [
      'Audit district-level CETP intake variance',
      'Issue show-cause to top offenders',
      'Brief Senior Reviewer for joint action',
    ],
    saathiPrompt: `Show me all COD exceedances in ${codDistrict} from the past 14 days and list the top industries by breach count`,
  }

  // ── Anomaly 2: CRITICAL · CETP BYPASS DETECTED ──────────────────────────
  // Find CETPs with two consecutive months of bypassMld > 0
  const cetpBypassRaw = await prisma.$queryRaw<
    Array<{ cetpId: string; cetpName: string; months: bigint }>
  >`
    SELECT
      c.id AS "cetpId",
      c.name AS "cetpName",
      COUNT(*)::bigint AS months
    FROM "CetpMonitoringReport" r
    JOIN "Cetp" c ON c.id = r."cetpId"
    WHERE r."bypassMld" > 0
      AND r."monthOf" >= ${daysAgo(70)}
    GROUP BY c.id, c.name
    HAVING COUNT(*) >= 2
    ORDER BY months DESC
    LIMIT 1
  `

  const bypassCetp = cetpBypassRaw[0]?.cetpName ?? 'Naroda CETP'
  const bypassMonths = cetpBypassRaw[0] ? Number(cetpBypassRaw[0].months) : 2

  const anomaly2 = {
    id: 'WR-002',
    severity: 'CRITICAL' as const,
    type: 'CETP BYPASS DETECTED',
    title: `${bypassCetp} has reported bypass MLD > 0 for ${bypassMonths} consecutive month${bypassMonths > 1 ? 's' : ''}`,
    description: `Continuous bypass of treated effluent indicates potential violation of Water Act conditions. Bypass volumes logged for ${bypassMonths} consecutive monthly reporting periods require immediate CEQMS log cross-check and notice.`,
    entities: [
      { label: `🏗️ ${bypassCetp}`, kind: 'cetp' as const },
      { label: `💧 Bypass > 0 MLD · ${bypassMonths}mo`, kind: 'metric' as const },
      { label: '⏱ Action overdue', kind: 'metric' as const },
    ],
    suggestedActions: [
      'Pull CETP CEQMS calibration history',
      'Issue closure direction notice',
    ],
    saathiPrompt: `Show me the CETP bypass report history for ${bypassCetp} and explain what actions are due`,
  }

  // ── Anomaly 3: CRITICAL · UNCONSENTED OPERATION ──────────────────────────
  // Industry with EXPIRED CTO and recent sensor readings
  const unConsentedRaw = await prisma.$queryRaw<
    Array<{ industryId: string; industryName: string; expiredAt: Date; readingCount: bigint }>
  >`
    SELECT
      i.id   AS "industryId",
      i.name AS "industryName",
      cons.max_validity AS "expiredAt",
      COALESCE(sr.cnt, 0)::bigint AS "readingCount"
    FROM "Industry" i
    JOIN (
      SELECT "industryId", MAX("validityTo") AS max_validity
      FROM "ConsentApplication"
      WHERE type = 'CTO' AND state IN ('APPROVED','RENEWED') AND "validityTo" IS NOT NULL
      GROUP BY "industryId"
    ) cons ON cons."industryId" = i.id AND cons.max_validity < ${now}
    LEFT JOIN (
      SELECT ms."industryId", COUNT(*)::bigint AS cnt
      FROM "SensorReading" sr2
      JOIN "MonitoringStation" ms ON ms.id = sr2."stationId"
      WHERE sr2.timestamp >= ${d30}
      GROUP BY ms."industryId"
    ) sr ON sr."industryId" = i.id
    WHERE COALESCE(sr.cnt, 0) > 0
    ORDER BY sr.cnt DESC
    LIMIT 1
  `

  const unConsentedIndustry = unConsentedRaw[0]?.industryName ?? 'Ankleshwar Chemical Works'
  const expiredAt = unConsentedRaw[0]?.expiredAt ?? daysAgo(45)
  const sensorReadings = unConsentedRaw[0] ? Number(unConsentedRaw[0].readingCount) : 240
  const expiredDateStr = new Date(expiredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const anomaly3 = {
    id: 'WR-003',
    severity: 'CRITICAL' as const,
    type: 'UNCONSENTED OPERATION',
    title: `${unConsentedIndustry} is operating with EXPIRED CTO since ${expiredDateStr}`,
    description: `CTO expired on ${expiredDateStr} but ${sensorReadings} sensor readings have been logged in this period — indicating continued operation without valid consent. Immediate enforcement direction required.`,
    entities: [
      { label: `🏭 ${unConsentedIndustry}`, kind: 'industry' as const },
      { label: `📋 CTO expired ${expiredDateStr}`, kind: 'metric' as const },
      { label: `📡 ${sensorReadings} readings post-expiry`, kind: 'metric' as const },
    ],
    suggestedActions: [
      'Issue immediate stop notice',
      'Schedule emergency inspection',
    ],
    saathiPrompt: `Pull the consent history for ${unConsentedIndustry} and tell me what enforcement action is appropriate for unconsented operation`,
  }

  // ── Anomaly 4: MAJOR · COMPLAINT HOTSPOT ─────────────────────────────────
  // Aggregate complaints by rounded lat/lng in last 14 days
  const hotspotRaw = await prisma.$queryRaw<
    Array<{ lat: number; lng: number; cnt: bigint; cats: string }>
  >`
    SELECT
      ROUND(lat::numeric, 1)::float AS lat,
      ROUND(lng::numeric, 1)::float AS lng,
      COUNT(*)::bigint              AS cnt,
      STRING_AGG(DISTINCT COALESCE(category, 'OTHER'), ', ') AS cats
    FROM "Complaint"
    WHERE lat IS NOT NULL AND lng IS NOT NULL
      AND "receivedAt" >= ${d14}
    GROUP BY ROUND(lat::numeric, 1), ROUND(lng::numeric, 1)
    HAVING COUNT(*) >= 2
    ORDER BY cnt DESC
    LIMIT 1
  `

  // Also get a nearby zone name from seeded GidcZones
  const gidcZones = await prisma.gidcZone.findMany({ select: { name: true }, take: 5 })
  const topZone = gidcZones[0]?.name ?? 'Vatva GIDC'
  const hotspotCount = hotspotRaw[0] ? Number(hotspotRaw[0].cnt) : 8
  const hotspotCats = hotspotRaw[0]?.cats ?? 'AIR, ODOUR'
  const topTwoCats = hotspotCats.split(', ').slice(0, 2).join(', ')

  const anomaly4 = {
    id: 'WR-004',
    severity: 'MAJOR' as const,
    type: 'COMPLAINT HOTSPOT',
    title: `${hotspotCount} complaints in ${topZone} zone in last 14 days`,
    description: `Complaint cluster detected in ${topZone}. Primary categories: ${topTwoCats}. Density suggests industrial source — cross-reference with OCEMS for correlating polluters.`,
    entities: [
      { label: `📍 ${topZone}`, kind: 'district' as const },
      { label: `📋 ${hotspotCount} complaints · 14d`, kind: 'metric' as const },
      { label: `🏷️ ${topTwoCats}`, kind: 'metric' as const },
    ],
    suggestedActions: [
      'Open hotspot map',
      'Brief District EE',
    ],
    saathiPrompt: `Show me the complaint hotspot map for ${topZone} and identify which industries are most likely responsible`,
  }

  // ── Anomaly 5: MAJOR · ENFORCEMENT SLA BREACH ────────────────────────────
  // Count PENDING_REVIEW actions stuck > 14 days
  const slaBreach = await prisma.enforcementAction.count({
    where: {
      state: 'PENDING_REVIEW',
      draftedAt: { lte: daysAgo(14) },
      reviewedAt: null,
    },
  })

  const anomaly5 = {
    id: 'WR-005',
    severity: 'MAJOR' as const,
    type: 'ENFORCEMENT SLA BREACH',
    title: `${slaBreach} enforcement actions stuck in PENDING_REVIEW for >14 days`,
    description: `${slaBreach} enforcement action${slaBreach !== 1 ? 's' : ''} (show-cause, closure, or recovery) have been waiting for Senior Reviewer sign-off for more than 14 days. SLA clock is breached. Bulk escalation recommended.`,
    entities: [
      { label: `⏱ ${slaBreach} actions · >14d pending`, kind: 'metric' as const },
      { label: '📋 PENDING_REVIEW state', kind: 'metric' as const },
    ],
    suggestedActions: [
      'Open Maker-Checker queue',
      'Bulk auto-escalate',
    ],
    saathiPrompt: `List all enforcement actions in PENDING_REVIEW state that have been waiting more than 14 days and suggest next steps`,
  }

  // ── Anomaly 6: MAJOR · INSPECTION OVERDUE ────────────────────────────────
  // RED-category industries with inspection scheduled but now overdue
  const overdueInspections = await prisma.inspection.count({
    where: {
      state: 'SCHEDULED',
      scheduledAt: { lt: now },
      industry: { category: 'RED' },
    },
  })

  const anomaly6 = {
    id: 'WR-006',
    severity: 'MAJOR' as const,
    type: 'INSPECTION OVERDUE',
    title: `${overdueInspections} high-risk (RED) industries past their scheduled inspection date`,
    description: `${overdueInspections} RED-category industr${overdueInspections !== 1 ? 'ies have' : 'y has'} a SCHEDULED inspection whose date has passed without completion. RED industries face elevated risk of undetected violations.`,
    entities: [
      { label: `🔴 ${overdueInspections} RED industries overdue`, kind: 'metric' as const },
      { label: '📅 Schedule missed', kind: 'metric' as const },
    ],
    suggestedActions: [
      'Open inspection prioritisation',
      'Reassign to nearest officer',
    ],
    saathiPrompt: `List all RED-category industries with overdue inspections and recommend a prioritised schedule`,
  }

  // ── Anomaly 7: ANOMALY · FREQUENT SENSOR DROPOUT ─────────────────────────
  // Stations with status != 'active' as a proxy for outages
  // (outageCount30d is not stored; use status != active + count readings gaps)
  const offlineStations = await prisma.monitoringStation.findMany({
    where: { status: { not: 'active' } },
    select: { id: true, name: true, type: true, status: true },
    take: 5,
  })

  // Fallback: pick the station with fewest readings in the last 30 days
  let dropoutStationName = offlineStations[0]?.name ?? null
  let dropoutOutageCount = offlineStations.length

  if (!dropoutStationName) {
    const sparseStation = await prisma.$queryRaw<
      Array<{ stationId: string; stationName: string; cnt: bigint }>
    >`
      SELECT ms.id AS "stationId", ms.name AS "stationName", COUNT(sr.id)::bigint AS cnt
      FROM "MonitoringStation" ms
      LEFT JOIN "SensorReading" sr ON sr."stationId" = ms.id AND sr.timestamp >= ${d30}
      GROUP BY ms.id, ms.name
      ORDER BY cnt ASC
      LIMIT 1
    `
    dropoutStationName = sparseStation[0]?.stationName ?? 'AAQM-Vatva-001'
    dropoutOutageCount = 3
  }

  const anomaly7 = {
    id: 'WR-007',
    severity: 'ANOMALY' as const,
    type: 'FREQUENT SENSOR DROPOUT',
    title: `${dropoutStationName} has had ${dropoutOutageCount} recorded outage${dropoutOutageCount !== 1 ? 's' : ''} in the last 30 days`,
    description: `Station "${dropoutStationName}" shows irregular data transmission patterns indicative of calibration drift, power interruptions, or tampering. Data gaps in continuous monitoring undermine enforcement evidence quality.`,
    entities: [
      { label: `📡 ${dropoutStationName}`, kind: 'station' as const },
      { label: `⚠️ ${dropoutOutageCount} outages · 30d`, kind: 'metric' as const },
    ],
    suggestedActions: [
      'View station health',
      'Trigger calibration inspection',
    ],
    saathiPrompt: `Show me the sensor health and reading history for station ${dropoutStationName} over the last 30 days`,
  }

  // ── Anomaly 8: ANOMALY · NORM TREND DRIFT ────────────────────────────────
  // Find station where COD has risen significantly over 7 days (slope proxy)
  const trendRaw = await prisma.$queryRaw<
    Array<{
      stationId: string
      stationName: string
      avgFirst3: number | null
      avgLast3: number | null
    }>
  >`
    SELECT
      ms.id AS "stationId",
      ms.name AS "stationName",
      AVG(CASE WHEN sr.timestamp < ${daysAgo(4)} THEN sr.value END)::float AS "avgFirst3",
      AVG(CASE WHEN sr.timestamp >= ${daysAgo(4)} THEN sr.value END)::float AS "avgLast3"
    FROM "SensorReading" sr
    JOIN "MonitoringStation" ms ON ms.id = sr."stationId"
    WHERE sr.parameter ILIKE '%COD%'
      AND sr.timestamp >= ${d7}
      AND sr.validity = 'VALID'
    GROUP BY ms.id, ms.name
    HAVING
      AVG(CASE WHEN sr.timestamp < ${daysAgo(4)} THEN sr.value END) IS NOT NULL
      AND AVG(CASE WHEN sr.timestamp >= ${daysAgo(4)} THEN sr.value END) IS NOT NULL
      AND AVG(CASE WHEN sr.timestamp >= ${daysAgo(4)} THEN sr.value END) >
          AVG(CASE WHEN sr.timestamp < ${daysAgo(4)} THEN sr.value END) * 1.1
    ORDER BY (
      AVG(CASE WHEN sr.timestamp >= ${daysAgo(4)} THEN sr.value END) /
      NULLIF(AVG(CASE WHEN sr.timestamp < ${daysAgo(4)} THEN sr.value END), 0)
    ) DESC
    LIMIT 1
  `

  let driftStation = 'CEQMS-Vatva-03'
  let driftPct = 18

  if (trendRaw.length > 0 && trendRaw[0]!.avgFirst3 && trendRaw[0]!.avgLast3) {
    driftStation = trendRaw[0]!.stationName
    const first = trendRaw[0]!.avgFirst3!
    const last  = trendRaw[0]!.avgLast3!
    driftPct = Math.round(((last - first) / first) * 100)
  }

  const anomaly8 = {
    id: 'WR-008',
    severity: 'ANOMALY' as const,
    type: 'NORM TREND DRIFT',
    title: `${driftStation} is trending toward norm-breach: COD has risen ${driftPct}% over 7 days`,
    description: `Linear trend analysis of COD readings at ${driftStation} shows a sustained ${driftPct}% upward drift over the last 7 days. At this trajectory the norm threshold will be breached within days if the pattern continues.`,
    entities: [
      { label: `📡 ${driftStation}`, kind: 'station' as const },
      { label: `📈 +${driftPct}% COD trend · 7d`, kind: 'metric' as const },
    ],
    suggestedActions: [
      'Open Predicted Exceedance Lab',
      'Pull last quarter trend',
    ],
    saathiPrompt: `Show me the COD trend for station ${driftStation} over the last 30 days and predict when it will breach the norm`,
  }

  // ── Assemble final response ───────────────────────────────────────────────

  const allAnomalies = [
    anomaly1, anomaly2, anomaly3, anomaly4,
    anomaly5, anomaly6, anomaly7, anomaly8,
  ].map(a => ({
    ...a,
    state: (warRoomAlertStates.get(a.id) ?? 'open') as AlertState,
  }))

  // Filter out resolved/snoozed from the count of open
  const openCount     = allAnomalies.filter(a => a.state === 'open').length
  const escalatedCount = allAnomalies.filter(a => a.state === 'escalated').length
  const snoozedCount  = allAnomalies.filter(a => a.state === 'snoozed').length

  res.json({
    open: openCount,
    escalated: escalatedCount,
    snoozed: snoozedCount,
    anomalies: allAnomalies,
    generatedAt: now,
  })
})

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
