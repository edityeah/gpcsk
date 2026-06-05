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
