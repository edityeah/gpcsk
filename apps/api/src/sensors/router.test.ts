import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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
