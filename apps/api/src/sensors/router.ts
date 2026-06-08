/**
 * Sensors router
 *
 * GET /api/sensors/stations              – list stations with optional filters
 * GET /api/sensors/stations/latest       – latest reading per (station, parameter)
 * GET /api/sensors/stations/:id          – station detail: current values + 24h time-series + active exceedances
 * GET /api/sensors/stations/:id/health   – outage analysis + auto-inspection trigger
 * GET /api/sensors/stations/:id/readings – paginated readings co-located with station
 * GET /api/sensors/readings              – paginated readings (stationId required)
 * GET /api/sensors/voc-clusters          – all VOC stations with latest readings
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { writeAudit } from '../audit/service.js'

export const sensorsRouter = Router()

// ── GET /api/sensors/stations ──────────────────────────────────────────────

const StationsQuerySchema = z.object({
  type:       z.enum(['OCEMS','CEQMS','AAQM','MINARS','GEMS','VOC']).optional(),
  status:     z.string().optional(),
  industryId: z.string().optional(),
  districtId: z.string().optional(),
})

sensorsRouter.get('/stations', requireAuth, async (req, res) => {
  const parsed = StationsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }
  const { type, status, industryId, districtId } = parsed.data

  // Build Prisma where clause
  const where: Record<string, unknown> = {}
  if (type)       where['type']       = type
  if (status)     where['status']     = status
  if (industryId) where['industryId'] = industryId
  if (districtId) {
    // Filter via joined industry.districtId
    where['industry'] = { districtId }
  }

  const stations = await prisma.monitoringStation.findMany({
    where,
    select: {
      id:         true,
      name:       true,
      type:       true,
      status:     true,
      lat:        true,
      lng:        true,
      parameters: true,
      industryId: true,
      industry: {
        select: {
          id:       true,
          name:     true,
          district: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  res.json({ stations })
})

// ── GET /api/sensors/stations/latest ──────────────────────────────────────
// Batch — every (station, parameter) with its latest reading + matching norm.
// Powers OCEMS / CEQMS / AAQM live-grid canvases without per-station N+1.

const LatestQuerySchema = z.object({
  type:   z.enum(['OCEMS','CEQMS','AAQM','MINARS','GEMS','VOC']).optional(),
  status: z.string().optional(),
})

const NORM_STREAM_BY_TYPE: Record<string, string> = {
  OCEMS: 'WATER', CEQMS: 'WATER', MINARS: 'WATER', GEMS: 'WATER',
  AAQM: 'AIR', VOC: 'AIR',
}

interface LatestRow {
  station_id: string; station_name: string; station_status: string; station_type: string;
  industry_id: string | null; industry_name: string | null; district_name: string | null;
  parameter: string; value: number; unit: string; timestamp: Date; validity: string;
}

sensorsRouter.get('/stations/latest', requireAuth, async (req, res) => {
  const parsed = LatestQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }
  const { type, status } = parsed.data

  const typeFilter = type ?? null
  const statusFilter = status ?? null

  const rows = await prisma.$queryRaw<LatestRow[]>`
    SELECT
      s.id   AS station_id,
      s.name AS station_name,
      s.status AS station_status,
      s.type::text AS station_type,
      i.id   AS industry_id,
      i.name AS industry_name,
      d.name AS district_name,
      r.parameter, r.value, r.unit, r.timestamp, r.validity::text AS validity
    FROM "MonitoringStation" s
    LEFT JOIN "Industry" i ON s."industryId" = i.id
    LEFT JOIN "District" d ON i."districtId" = d.id
    INNER JOIN LATERAL (
      SELECT DISTINCT ON (parameter)
        parameter, value, unit, timestamp, validity
      FROM "SensorReading"
      WHERE "stationId" = s.id
      ORDER BY parameter, timestamp DESC
    ) r ON TRUE
    WHERE (${typeFilter}::text IS NULL OR s.type::text = ${typeFilter}::text)
      AND (${statusFilter}::text IS NULL OR s.status = ${statusFilter}::text)
    ORDER BY s.name, r.parameter
  `

  // Aggregate norms by (stream, parameter). Some parameters carry BOTH a min
  // and a max in the table (notably pH, which is a range, and noise day/night).
  // For parameters with multiple rows we take min(all values) as normMin and
  // max(all values) as normMax; consumers can treat single-bound parameters as
  // "exceedance when value > normMax" and bidirectional ones (where normMin <
  // normMax meaningfully) as "exceedance when value is outside [normMin,normMax]".
  const norms = await prisma.norm.findMany({
    select: { parameter: true, stream: true, value: true, unit: true },
  })
  const normByKey = new Map<string, { normMin: number; normMax: number; unit: string }>()
  for (const n of norms) {
    const key = `${n.stream}|${n.parameter}`
    const existing = normByKey.get(key)
    if (existing) {
      existing.normMin = Math.min(existing.normMin, n.value)
      existing.normMax = Math.max(existing.normMax, n.value)
    } else {
      normByKey.set(key, { normMin: n.value, normMax: n.value, unit: n.unit })
    }
  }

  const byStation = new Map<string, {
    id: string; name: string; status: string; type: string;
    industry: { id: string; name: string } | null;
    district: string | null;
    readings: Array<{ parameter: string; value: number; unit: string; normMin: number | null; normMax: number | null; normUnit: string | null; timestamp: string; validity: string }>;
  }>()
  for (const row of rows) {
    if (!byStation.has(row.station_id)) {
      byStation.set(row.station_id, {
        id: row.station_id, name: row.station_name, status: row.station_status, type: row.station_type,
        industry: row.industry_id && row.industry_name ? { id: row.industry_id, name: row.industry_name } : null,
        district: row.district_name,
        readings: [],
      })
    }
    const stream = NORM_STREAM_BY_TYPE[row.station_type]
    const normLookup = stream ? normByKey.get(`${stream}|${row.parameter}`) : undefined
    byStation.get(row.station_id)!.readings.push({
      parameter: row.parameter,
      value: row.value,
      unit: row.unit,
      normMin: normLookup?.normMin ?? null,
      normMax: normLookup?.normMax ?? null,
      normUnit: normLookup?.unit ?? null,
      timestamp: row.timestamp.toISOString(),
      validity: row.validity,
    })
  }

  // Include stations that have no readings (down / calibration / freshly installed).
  const allStations = await prisma.monitoringStation.findMany({
    where: { ...(type ? { type } : {}), ...(status ? { status } : {}) },
    select: { id: true, name: true, status: true, type: true, industry: { select: { id: true, name: true, district: { select: { name: true } } } } },
  })
  for (const s of allStations) {
    if (!byStation.has(s.id)) {
      byStation.set(s.id, {
        id: s.id, name: s.name, status: s.status, type: s.type,
        industry: s.industry ? { id: s.industry.id, name: s.industry.name } : null,
        district: s.industry?.district?.name ?? null,
        readings: [],
      })
    }
  }

  res.json({ stations: Array.from(byStation.values()) })
})

// ── GET /api/sensors/stations/:id ─────────────────────────────────────────

sensorsRouter.get('/stations/:id', requireAuth, async (req, res) => {
  const { id } = req.params

  const station = await prisma.monitoringStation.findUnique({
    where: { id },
    include: {
      industry: {
        select: {
          id:       true,
          name:     true,
          category: true,
          district: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!station) {
    res.status(404).json({ error: 'station_not_found' })
    return
  }

  const now = new Date()
  const since24h = new Date(now.getTime() - 24 * 3600 * 1000)

  // Latest value per parameter (most-recent reading)
  const latestReadings = await prisma.$queryRaw<
    Array<{ parameter: string; value: number; unit: string; timestamp: Date; validity: string }>
  >`
    SELECT DISTINCT ON (parameter) parameter, value, unit, timestamp, validity
    FROM "SensorReading"
    WHERE "stationId" = ${id}
    ORDER BY parameter, timestamp DESC
  `

  // 24h time-series (all readings within the window)
  const timeSeries = await prisma.sensorReading.findMany({
    where:   { stationId: id, timestamp: { gte: since24h } },
    select:  { parameter: true, value: true, unit: true, timestamp: true, validity: true },
    orderBy: { timestamp: 'asc' },
  })

  // Active exceedances (PENDING disposition)
  const activeExceedances = await prisma.exceedance.findMany({
    where:   { stationId: id, dispositionState: 'PENDING' },
    select:  {
      id:             true,
      parameter:      true,
      observedValue:  true,
      normValue:      true,
      breachMagnitude:true,
      severity:       true,
      detectedAt:     true,
      dispositionState: true,
    },
    orderBy: { detectedAt: 'desc' },
    take:    50,
  })

  res.json({
    station,
    currentValues: latestReadings,
    timeSeries,
    activeExceedances,
  })
})

// ── GET /api/sensors/stations/:id/health ──────────────────────────────────
//
// Returns station health including outage history (last 30d) computed from
// SensorReading timestamp gaps >2h, and auto-creates INSPECTION_DUE
// notification for IEO if criteria met (idempotent).
//
// Response:
//   { stationId, status, lastReadingAt, hoursSinceLastReading,
//     last30dOutages: [{ start, end, durationHours }],
//     outageCount30d, totalOfflineHours30d, autoInspectionTriggered }

sensorsRouter.get('/stations/:id/health', requireAuth, async (req, res) => {
  const { id } = req.params

  const station = await prisma.monitoringStation.findUnique({
    where: { id },
    include: { industry: { select: { id: true, name: true } } },
  })
  if (!station) {
    res.status(404).json({ error: 'station_not_found' })
    return
  }

  const now = new Date()
  const since30d = new Date(now.getTime() - 30 * 24 * 3_600_000)

  // Pull all reading timestamps in the last 30 days ordered ASC
  const rawReadings = await prisma.$queryRaw<Array<{ ts: Date }>>`
    SELECT timestamp AS ts
    FROM   "SensorReading"
    WHERE  "stationId" = ${id}
      AND  timestamp   >= ${since30d}
    ORDER  BY timestamp ASC
  `

  const timestamps: Date[] = rawReadings.map(r => new Date(r.ts))

  // Outage = gap > 2h between consecutive readings
  const TWO_HOURS_MS = 2 * 3_600_000

  interface Outage { start: Date; end: Date; durationHours: number }
  const outages: Outage[] = []

  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i]!.getTime() - timestamps[i - 1]!.getTime()
    if (gap > TWO_HOURS_MS) {
      const durationHours = Math.round((gap / 3_600_000) * 10) / 10
      outages.push({ start: timestamps[i - 1]!, end: timestamps[i]!, durationHours })
    }
  }

  // Last reading timestamp
  const lastReadingAt = timestamps.length > 0 ? timestamps[timestamps.length - 1]! : null
  const hoursSinceLastReading = lastReadingAt
    ? Math.round((now.getTime() - lastReadingAt.getTime()) / 3_600_000 * 10) / 10
    : null

  // Open outage: station 'active' but last reading >2h ago
  if (
    station.status === 'active' &&
    lastReadingAt &&
    hoursSinceLastReading != null &&
    hoursSinceLastReading >= 2
  ) {
    outages.push({
      start: lastReadingAt,
      end: now,
      durationHours: Math.round(hoursSinceLastReading * 10) / 10,
    })
  }

  const outageCount30d = outages.length
  const totalOfflineHours30d = Math.round(
    outages.reduce((s, o) => s + o.durationHours, 0) * 10,
  ) / 10

  // ── Auto-inspection trigger ────────────────────────────────────────────────
  // When outageCount30d >= 3 AND the station belongs to an industry,
  // create a SCHEDULED Inspection row (idempotent: 14-day dedup window).
  // Also write an audit log entry.
  const shouldTrigger = outageCount30d >= 3

  let autoInspectionTriggered = false

  if (shouldTrigger && station.industry?.id) {
    // Idempotency: check for existing auto-triggered SCHEDULED Inspection in last 14 days
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 3_600_000)
    const existingInspection = await prisma.inspection.findFirst({
      where: {
        industryId: station.industry.id,
        state: 'SCHEDULED',
        createdAt: { gte: fourteenDaysAgo },
        observations: {
          path: ['auto_triggered'],
          equals: true,
        },
      },
    })

    if (existingInspection) {
      autoInspectionTriggered = true
    } else {
      // Find first IEO to assign
      const ieoUser = await prisma.user.findFirst({
        where: { role: 'INSPECTION_ENFORCEMENT_OFFICER' },
        select: { id: true },
      })

      const scheduledAt = new Date(now.getTime() + 7 * 24 * 3_600_000) // 7 days from now
      const reason = `Frequent OCEMS dropout — ${outageCount30d} outages in last 30d at ${station.name}`

      const newInspection = await prisma.inspection.create({
        data: {
          industryId:  station.industry.id,
          scheduledAt,
          inspectorId: ieoUser?.id ?? null,
          state:       'SCHEDULED',
          observations: {
            auto_triggered:    true,
            reason,
            source_station_id: id,
          },
        },
      })

      const actorId = ieoUser?.id ?? 'system'
      await writeAudit({
        actorId,
        entity:   'Inspection',
        entityId: newInspection.id,
        action:   'AUTO_SCHEDULED',
        after:    newInspection as unknown as import('@prisma/client').Prisma.InputJsonValue,
      })

      autoInspectionTriggered = true
    }
  }

  res.json({
    stationId: id,
    stationName: station.name,
    status: station.status,
    lastReadingAt: lastReadingAt?.toISOString() ?? null,
    hoursSinceLastReading,
    last30dOutages: outages.map(o => ({
      start: o.start.toISOString(),
      end: o.end.toISOString(),
      durationHours: o.durationHours,
    })),
    outageCount30d,
    totalOfflineHours30d,
    autoInspectionTriggered,
  })
})

// ── GET /api/sensors/stations/:id/readings ────────────────────────────────
// Thin wrapper — co-located with station routes, same query as /readings.
// Validates station exists, then delegates to the same Prisma query.

const StationReadingsQuerySchema = z.object({
  parameter: z.string().optional(),
  since:     z.string().datetime({ offset: true }).optional(),
  until:     z.string().datetime({ offset: true }).optional(),
  limit:     z.coerce.number().int().min(1).max(5000).default(500),
})

sensorsRouter.get('/stations/:id/readings', requireAuth, async (req, res) => {
  const { id } = req.params

  // Validate station exists
  const station = await prisma.monitoringStation.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!station) {
    res.status(404).json({ error: 'station_not_found' })
    return
  }

  const parsed = StationReadingsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }
  const { parameter, since, until, limit } = parsed.data

  const where: Record<string, unknown> = { stationId: id }
  if (parameter) where['parameter'] = parameter
  if (since || until) {
    const ts: Record<string, Date> = {}
    if (since) ts['gte'] = new Date(since)
    if (until) ts['lte'] = new Date(until)
    where['timestamp'] = ts
  }

  const readings = await prisma.sensorReading.findMany({
    where,
    select: { id: true, parameter: true, value: true, unit: true, timestamp: true, validity: true },
    orderBy: { timestamp: 'asc' },
    take: limit,
  })

  res.json({ readings, count: readings.length })
})

// ── GET /api/sensors/readings ──────────────────────────────────────────────

const ReadingsQuerySchema = z.object({
  stationId: z.string().min(1),
  parameter: z.string().optional(),
  since:     z.string().datetime({ offset: true }).optional(),
  until:     z.string().datetime({ offset: true }).optional(),
  limit:     z.coerce.number().int().min(1).max(5000).default(200),
})

sensorsRouter.get('/readings', requireAuth, async (req, res) => {
  const parsed = ReadingsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }
  const { stationId, parameter, since, until, limit } = parsed.data

  const where: Record<string, unknown> = { stationId }
  if (parameter) where['parameter'] = parameter
  if (since || until) {
    const ts: Record<string, Date> = {}
    if (since) ts['gte'] = new Date(since)
    if (until) ts['lte'] = new Date(until)
    where['timestamp'] = ts
  }

  const readings = await prisma.sensorReading.findMany({
    where,
    select: { id: true, parameter: true, value: true, unit: true, timestamp: true, validity: true },
    orderBy: { timestamp: 'desc' },
    take: limit,
  })

  res.json({ readings, count: readings.length })
})

// ── GET /api/sensors/voc-clusters ─────────────────────────────────────────
// Returns all VOC monitoring stations with latest readings.
// Delegates to the same /stations/latest pattern, filtered to type=VOC.

sensorsRouter.get('/voc-clusters', requireAuth, async (_req, res) => {
  const rows = await prisma.$queryRaw<LatestRow[]>`
    SELECT
      s.id   AS station_id,
      s.name AS station_name,
      s.status AS station_status,
      s.type::text AS station_type,
      i.id   AS industry_id,
      i.name AS industry_name,
      d.name AS district_name,
      r.parameter, r.value, r.unit, r.timestamp, r.validity::text AS validity
    FROM "MonitoringStation" s
    LEFT JOIN "Industry" i ON s."industryId" = i.id
    LEFT JOIN "District" d ON i."districtId" = d.id
    INNER JOIN LATERAL (
      SELECT DISTINCT ON (parameter)
        parameter, value, unit, timestamp, validity
      FROM "SensorReading"
      WHERE "stationId" = s.id
      ORDER BY parameter, timestamp DESC
    ) r ON TRUE
    WHERE s.type::text = 'VOC'
    ORDER BY s.name, r.parameter
  `

  const norms = await prisma.norm.findMany({
    where: { stream: 'AIR' },
    select: { parameter: true, value: true, unit: true },
  })
  const normByParam = new Map<string, { normMax: number; unit: string }>()
  for (const n of norms) {
    const existing = normByParam.get(n.parameter)
    if (!existing || n.value > existing.normMax) {
      normByParam.set(n.parameter, { normMax: n.value, unit: n.unit })
    }
  }

  const byStation = new Map<string, {
    stationId: string; name: string; district: string | null; status: string;
    latestReadings: Array<{ parameter: string; value: number; unit: string; norm: number | null; normUnit: string | null; timestamp: string }>;
  }>()

  for (const row of rows) {
    if (!byStation.has(row.station_id)) {
      byStation.set(row.station_id, {
        stationId:      row.station_id,
        name:           row.station_name,
        district:       row.district_name,
        status:         row.station_status,
        latestReadings: [],
      })
    }
    const norm = normByParam.get(row.parameter)
    byStation.get(row.station_id)!.latestReadings.push({
      parameter: row.parameter,
      value:     row.value,
      unit:      row.unit,
      norm:      norm?.normMax ?? null,
      normUnit:  norm?.unit ?? null,
      timestamp: row.timestamp.toISOString(),
    })
  }

  // Include VOC stations that have no readings
  const allVoc = await prisma.monitoringStation.findMany({
    where: { type: 'VOC' },
    select: {
      id:     true,
      name:   true,
      status: true,
      industry: { select: { district: { select: { name: true } } } },
    },
  })
  for (const s of allVoc) {
    if (!byStation.has(s.id)) {
      byStation.set(s.id, {
        stationId:      s.id,
        name:           s.name,
        district:       s.industry?.district?.name ?? null,
        status:         s.status,
        latestReadings: [],
      })
    }
  }

  res.json({ clusters: Array.from(byStation.values()) })
})
