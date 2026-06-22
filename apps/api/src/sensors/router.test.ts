import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'

const app = buildApp()

let token: string
let stationId: string

beforeAll(async () => {
  // Seed demo users (idempotent)
  await seedDemoUsers(prisma)

  // Get a token for MONITORING_OFFICER
  const loginRes = await request(app)
    .post('/api/auth/demo-login')
    .send({ role: 'MONITORING_OFFICER' })
  token = loginRes.body.token as string

  // Ensure at least one station exists for tests
  const existing = await prisma.monitoringStation.findFirst({
    where: { type: 'AAQM' },
  })

  if (existing) {
    stationId = existing.id
  } else {
    // Create a minimal test station
    const created = await prisma.monitoringStation.create({
      data: {
        type: 'AAQM',
        name: 'Test AAQM Station',
        lat: 23.0,
        lng: 72.5,
        parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'],
        status: 'active',
      },
    })
    stationId = created.id

    // Insert some readings
    const now = new Date()
    await prisma.sensorReading.createMany({
      data: [
        { stationId, parameter: 'PM10', value: 85.5, unit: 'µg/m³', timestamp: new Date(now.getTime() - 3600 * 1000), validity: 'VALID' },
        { stationId, parameter: 'PM2_5', value: 42.0, unit: 'µg/m³', timestamp: new Date(now.getTime() - 3600 * 1000), validity: 'VALID' },
        { stationId, parameter: 'PM10', value: 110.0, unit: 'µg/m³', timestamp: new Date(now.getTime() - 7200 * 1000), validity: 'VALID' },
      ],
    })
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/sensors/stations', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/sensors/stations')
    expect(res.status).toBe(401)
  })

  it('returns a list of stations', async () => {
    const res = await request(app)
      .get('/api/sensors/stations')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('stations')
    expect(Array.isArray(res.body.stations)).toBe(true)
  })

  it('filters by type', async () => {
    const res = await request(app)
      .get('/api/sensors/stations?type=AAQM')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const types = (res.body.stations as Array<{ type: string }>).map(s => s.type)
    expect(types.every(t => t === 'AAQM')).toBe(true)
  })

  it('rejects an invalid type', async () => {
    const res = await request(app)
      .get('/api/sensors/stations?type=INVALID')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/sensors/stations/:id', () => {
  it('returns station detail with currentValues, timeSeries, activeExceedances', async () => {
    const res = await request(app)
      .get(`/api/sensors/stations/${stationId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('station')
    expect(res.body).toHaveProperty('currentValues')
    expect(res.body).toHaveProperty('timeSeries')
    expect(res.body).toHaveProperty('activeExceedances')
    expect(Array.isArray(res.body.timeSeries)).toBe(true)
    expect(Array.isArray(res.body.activeExceedances)).toBe(true)
  })

  it('returns 404 for unknown station', async () => {
    const res = await request(app)
      .get('/api/sensors/stations/nonexistent-id-xyz')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/sensors/readings', () => {
  it('requires stationId', async () => {
    const res = await request(app)
      .get('/api/sensors/readings')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })

  it('returns readings for a station', async () => {
    const res = await request(app)
      .get(`/api/sensors/readings?stationId=${stationId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('readings')
    expect(Array.isArray(res.body.readings)).toBe(true)
    expect(typeof res.body.count).toBe('number')
  })

  it('filters readings by parameter', async () => {
    const res = await request(app)
      .get(`/api/sensors/readings?stationId=${stationId}&parameter=PM10`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const params = (res.body.readings as Array<{ parameter: string }>).map(r => r.parameter)
    expect(params.every(p => p === 'PM10')).toBe(true)
  })
})

describe('GET /api/sensors/stations/:id/readings', () => {
  it('returns readings for a station', async () => {
    const res = await request(app)
      .get(`/api/sensors/stations/${stationId}/readings`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('readings')
    expect(Array.isArray(res.body.readings)).toBe(true)
    expect(typeof res.body.count).toBe('number')
  })

  it('supports parameter filter', async () => {
    const res = await request(app)
      .get(`/api/sensors/stations/${stationId}/readings?parameter=PM10`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const params = (res.body.readings as Array<{ parameter: string }>).map(r => r.parameter)
    expect(params.every(p => p === 'PM10')).toBe(true)
  })

  it('returns 404 for unknown station', async () => {
    const res = await request(app)
      .get('/api/sensors/stations/nonexistent-id/readings')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/sensors/voc-clusters', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/sensors/voc-clusters')
    expect(res.status).toBe(401)
  })

  it('returns clusters shape', async () => {
    const res = await request(app)
      .get('/api/sensors/voc-clusters')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('clusters')
    expect(Array.isArray(res.body.clusters)).toBe(true)
  })
})

// ── Uptime tests ──────────────────────────────────────────────────────────────

describe('GET /api/sensors/stations/:id/uptime', () => {
  let uptimeOnlineStationId: string
  let uptimeOfflineStationId: string

  beforeAll(async () => {
    const now = new Date()

    // Station A: has a very recent reading (no current outage)
    const onlineStation = await prisma.monitoringStation.create({
      data: {
        name: 'Uptime-Test Online Station',
        type: 'AAQM',
        lat: 23.1,
        lng: 72.6,
        parameters: ['PM10'],
        status: 'active',
      },
    })
    uptimeOnlineStationId = onlineStation.id

    // Insert a reading 30 minutes ago → station is online
    await prisma.sensorReading.create({
      data: {
        stationId: uptimeOnlineStationId,
        parameter: 'PM10',
        value: 55,
        unit: 'µg/m³',
        timestamp: new Date(now.getTime() - 30 * 60 * 1000),
        validity: 'VALID',
      },
    })

    // Seed 30d of uptime stats for the online station (perfect uptime)
    const stats: Array<{ stationId: string; date: Date; onlineMinutes: number; offlineMinutes: number; outageCount: number }> = []
    for (let d = 0; d < 30; d++) {
      stats.push({
        stationId: uptimeOnlineStationId,
        date: new Date(Date.UTC(
          now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d,
        )),
        onlineMinutes: 1440,
        offlineMinutes: 0,
        outageCount: 0,
      })
    }
    await prisma.stationUptimeStat.createMany({ data: stats, skipDuplicates: true })

    // Station B: last reading was 6 hours ago → current outage
    const offlineStation = await prisma.monitoringStation.create({
      data: {
        name: 'Uptime-Test Offline Station',
        type: 'AAQM',
        lat: 23.2,
        lng: 72.7,
        parameters: ['PM10'],
        status: 'active',
      },
    })
    uptimeOfflineStationId = offlineStation.id

    // Last reading 6 hours ago → outage ongoing
    await prisma.sensorReading.create({
      data: {
        stationId: uptimeOfflineStationId,
        parameter: 'PM10',
        value: 80,
        unit: 'µg/m³',
        timestamp: new Date(now.getTime() - 6 * 3_600_000),
        validity: 'VALID',
      },
    })

    // Seed 30d of uptime stats: 3 outage days to simulate a problematic station
    const offlineStats: typeof stats = []
    for (let d = 0; d < 30; d++) {
      const hasOutage = d % 10 === 0 // every 10th day has an outage
      offlineStats.push({
        stationId: uptimeOfflineStationId,
        date: new Date(Date.UTC(
          now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d,
        )),
        onlineMinutes: hasOutage ? 1200 : 1440,
        offlineMinutes: hasOutage ? 240 : 0,
        outageCount: hasOutage ? 1 : 0,
      })
    }
    await prisma.stationUptimeStat.createMany({ data: offlineStats, skipDuplicates: true })
  })

  it('returns 404 for unknown station', async () => {
    const res = await request(app)
      .get('/api/sensors/stations/nonexistent-uptime-id/uptime')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('station with no current outage: currentlyOffline=false, thisOutageStartedAt=null', async () => {
    const res = await request(app)
      .get(`/api/sensors/stations/${uptimeOnlineStationId}/uptime`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)

    const body = res.body as {
      stationId: string
      stationName: string
      currentlyOffline: boolean
      hoursSinceLastReading: number | null
      thisOutageStartedAt: string | null
      stats30d: { totalOnlineMinutes: number; totalOfflineMinutes: number; outageCount: number; uptimePct: number }
      stats90d: { totalOnlineMinutes: number; totalOfflineMinutes: number; outageCount: number; uptimePct: number }
      daily90d: Array<{ date: string; onlineMinutes: number; offlineMinutes: number; outageCount: number }>
    }

    expect(body.stationId).toBe(uptimeOnlineStationId)
    expect(body.currentlyOffline).toBe(false)
    expect(body.thisOutageStartedAt).toBeNull()
    expect(body.hoursSinceLastReading).not.toBeNull()
    expect(body.hoursSinceLastReading!).toBeLessThan(2) // within 2h → online
    expect(body.stats30d).toMatchObject({
      outageCount: 0,
      uptimePct: 100,
    })
    expect(Array.isArray(body.daily90d)).toBe(true)
  })

  it('station with current outage (6h since last reading): currentlyOffline=true, thisOutageStartedAt set', async () => {
    const res = await request(app)
      .get(`/api/sensors/stations/${uptimeOfflineStationId}/uptime`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)

    const body = res.body as {
      stationId: string
      currentlyOffline: boolean
      hoursSinceLastReading: number | null
      thisOutageStartedAt: string | null
      stats30d: { outageCount: number; uptimePct: number }
    }

    expect(body.stationId).toBe(uptimeOfflineStationId)
    expect(body.currentlyOffline).toBe(true)
    expect(body.thisOutageStartedAt).not.toBeNull()
    expect(body.hoursSinceLastReading).not.toBeNull()
    expect(body.hoursSinceLastReading!).toBeGreaterThanOrEqual(2)
    // 3 outage days (d=0,10,20) → outageCount should be 3
    expect(body.stats30d.outageCount).toBeGreaterThan(0)
    expect(body.stats30d.uptimePct).toBeLessThan(100)
  })
})

describe('GET /api/sensors/stations/latest — uptime field', () => {
  it('each station entry includes an uptime object with required keys', async () => {
    const res = await request(app)
      .get('/api/sensors/stations/latest')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.stations)).toBe(true)

    const stations = res.body.stations as Array<{
      id: string
      uptime?: { hoursOfflineCurrent: number; outageCount30d: number; thisOutageRank: string }
    }>
    expect(stations.length).toBeGreaterThan(0)

    for (const s of stations) {
      expect(s).toHaveProperty('uptime')
      expect(typeof s.uptime!.hoursOfflineCurrent).toBe('number')
      expect(typeof s.uptime!.outageCount30d).toBe('number')
      expect(typeof s.uptime!.thisOutageRank).toBe('string')
    }
  })
})

describe('GET /api/sensors/stations/:id/health — auto-inspection trigger', () => {
  let healthStationId: string
  let healthIndustryId: string

  beforeEach(async () => {
    // Clean up any auto-triggered inspections for this industry before each test
    if (healthIndustryId) {
      await prisma.inspection.deleteMany({
        where: {
          industryId: healthIndustryId,
          observations: {
            path: ['auto_triggered'],
            equals: true,
          },
        },
      })
    }
  })

  beforeAll(async () => {
    // Create an industry (needed for Inspection.industryId)
    const district = await prisma.district.findFirst()
    const sector   = await prisma.sector.findFirst()

    const industry = await prisma.industry.create({
      data: {
        name:      'Health-Test Industry',
        ucNumber:  `HC-TEST-${Date.now()}`,
        category:  'RED',
        lat:       23.01,
        lng:       72.51,
        ...(district ? { districtId: district.id } : {}),
        ...(sector   ? { sectorId:   sector.id   } : {}),
      },
    })
    healthIndustryId = industry.id

    // Create station linked to the industry
    const station = await prisma.monitoringStation.create({
      data: {
        name:       'Auto-Inspect Test Station',
        type:       'OCEMS',
        lat:        23.01,
        lng:        72.51,
        parameters: ['COD'],
        status:     'active',
        industryId: industry.id,
      },
    })
    healthStationId = station.id

    // Seed 4 readings that create 3+ gaps > 2h (spaced 3 days apart)
    const now = new Date()
    const offsets = [29, 26, 23, 20]
    await prisma.sensorReading.createMany({
      data: offsets.map(d => ({
        stationId: station.id,
        parameter: 'COD',
        value:     200,
        unit:      'mg/L',
        timestamp: new Date(now.getTime() - d * 24 * 3_600_000),
        validity:  'VALID',
      })),
    })
  })

  it('creates an Inspection row when outageCount30d >= 3', async () => {
    const res = await request(app)
      .get(`/api/sensors/stations/${healthStationId}/health`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.outageCount30d).toBeGreaterThanOrEqual(3)
    expect(res.body.autoInspectionTriggered).toBe(true)

    // Verify Inspection row was actually created in DB
    const inspection = await prisma.inspection.findFirst({
      where: {
        industryId: healthIndustryId,
        state: 'SCHEDULED',
        observations: {
          path: ['auto_triggered'],
          equals: true,
        },
      },
    })
    expect(inspection).not.toBeNull()
    expect((inspection!.observations as Record<string, unknown>)['auto_triggered']).toBe(true)
  })

  it('does NOT create a duplicate Inspection on second call', async () => {
    // First call creates one
    await request(app)
      .get(`/api/sensors/stations/${healthStationId}/health`)
      .set('Authorization', `Bearer ${token}`)

    const countBefore = await prisma.inspection.count({
      where: {
        industryId: healthIndustryId,
        state: 'SCHEDULED',
        observations: { path: ['auto_triggered'], equals: true },
      },
    })

    // Second call should NOT add another
    await request(app)
      .get(`/api/sensors/stations/${healthStationId}/health`)
      .set('Authorization', `Bearer ${token}`)

    const countAfter = await prisma.inspection.count({
      where: {
        industryId: healthIndustryId,
        state: 'SCHEDULED',
        observations: { path: ['auto_triggered'], equals: true },
      },
    })

    expect(countAfter).toBe(countBefore) // no new rows
  })
})
