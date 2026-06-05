/**
 * Sensors router
 *
 * GET /api/sensors/stations          – list stations with optional filters
 * GET /api/sensors/stations/:id      – station detail: current values + 24h time-series + active exceedances
 * GET /api/sensors/readings          – paginated readings (stationId required)
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

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

  const norms = await prisma.norm.findMany({
    select: { parameter: true, stream: true, value: true, unit: true },
  })
  const normByKey = new Map<string, { value: number; unit: string }>()
  for (const n of norms) {
    const key = `${n.stream}|${n.parameter}`
    if (!normByKey.has(key)) normByKey.set(key, { value: n.value, unit: n.unit })
  }

  const byStation = new Map<string, {
    id: string; name: string; status: string; type: string;
    industry: { id: string; name: string } | null;
    district: string | null;
    readings: Array<{ parameter: string; value: number; unit: string; norm: number | null; normUnit: string | null; timestamp: string; validity: string }>;
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
      norm: normLookup?.value ?? null,
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
