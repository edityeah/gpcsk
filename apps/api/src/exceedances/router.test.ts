import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'

const app = buildApp()

let moToken: string   // MONITORING_OFFICER
let coToken: string   // CONSENT_OFFICER (wrong role)
let pendingExceedanceId: string
let stationWithIndustryId: string
let industryId: string

beforeAll(async () => {
  await seedDemoUsers(prisma)

  // Tokens for different roles
  const moRes = await request(app).post('/api/auth/demo-login').send({ role: 'MONITORING_OFFICER' })
  moToken = moRes.body.token as string

  const coRes = await request(app).post('/api/auth/demo-login').send({ role: 'CONSENT_OFFICER' })
  coToken = coRes.body.token as string

  // Ensure we have an industry, station, and a PENDING exceedance
  const industry = await prisma.industry.findFirst()
  if (!industry) throw new Error('No industry found — run seed first or ensure industries exist')
  industryId = industry.id

  let station = await prisma.monitoringStation.findFirst({
    where: { industryId },
  })
  if (!station) {
    station = await prisma.monitoringStation.create({
      data: {
        type: 'OCEMS',
        name: 'Test OCEMS Station for Exceedance Tests',
        lat: 21.62,
        lng: 72.99,
        parameters: ['COD', 'BOD'],
        status: 'active',
        industryId,
      },
    })
  }
  stationWithIndustryId = station.id

  // Create a PENDING exceedance
  const exc = await prisma.exceedance.create({
    data: {
      stationId:       stationWithIndustryId,
      parameter:       'COD',
      observedValue:   350,
      normValue:       250,
      breachMagnitude: 0.4,
      severity:        'MAJOR',
      detectedAt:      new Date(),
      dispositionState: 'PENDING',
    },
  })
  pendingExceedanceId = exc.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/exceedances', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/exceedances')
    expect(res.status).toBe(401)
  })

  it('returns exceedances list', async () => {
    const res = await request(app)
      .get('/api/exceedances')
      .set('Authorization', `Bearer ${moToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('exceedances')
    expect(Array.isArray(res.body.exceedances)).toBe(true)
    expect(typeof res.body.count).toBe('number')
  })

  it('filters by severity=MAJOR', async () => {
    const res = await request(app)
      .get('/api/exceedances?severity=MAJOR')
      .set('Authorization', `Bearer ${moToken}`)
    expect(res.status).toBe(200)
    const severities = (res.body.exceedances as Array<{ severity: string }>).map(e => e.severity)
    expect(severities.every(s => s === 'MAJOR')).toBe(true)
  })

  it('filters by dispositionState=PENDING', async () => {
    const res = await request(app)
      .get('/api/exceedances?dispositionState=PENDING')
      .set('Authorization', `Bearer ${moToken}`)
    expect(res.status).toBe(200)
    const states = (res.body.exceedances as Array<{ dispositionState: string }>).map(e => e.dispositionState)
    expect(states.every(s => s === 'PENDING')).toBe(true)
  })

  it('respects limit param', async () => {
    const res = await request(app)
      .get('/api/exceedances?limit=3')
      .set('Authorization', `Bearer ${moToken}`)
    expect(res.status).toBe(200)
    expect(res.body.exceedances.length).toBeLessThanOrEqual(3)
  })

  it('rejects invalid severity', async () => {
    const res = await request(app)
      .get('/api/exceedances?severity=EXTREME')
      .set('Authorization', `Bearer ${moToken}`)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/exceedances/:id/disposition', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post(`/api/exceedances/${pendingExceedanceId}/disposition`)
      .send({ state: 'SENSOR_GLITCH' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-MONITORING_OFFICER', async () => {
    const res = await request(app)
      .post(`/api/exceedances/${pendingExceedanceId}/disposition`)
      .set('Authorization', `Bearer ${coToken}`)
      .send({ state: 'SENSOR_GLITCH' })
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown exceedance', async () => {
    const res = await request(app)
      .post('/api/exceedances/nonexistent-xyz/disposition')
      .set('Authorization', `Bearer ${moToken}`)
      .send({ state: 'SENSOR_GLITCH' })
    expect(res.status).toBe(404)
  })

  it('rejects invalid state', async () => {
    const res = await request(app)
      .post(`/api/exceedances/${pendingExceedanceId}/disposition`)
      .set('Authorization', `Bearer ${moToken}`)
      .send({ state: 'INVALID_STATE' })
    expect(res.status).toBe(400)
  })

  it('marks exceedance as CONFIRMED_VIOLATION and auto-creates enforcement draft', async () => {
    const res = await request(app)
      .post(`/api/exceedances/${pendingExceedanceId}/disposition`)
      .set('Authorization', `Bearer ${moToken}`)
      .send({ state: 'CONFIRMED_VIOLATION', notes: 'Persistent COD breach confirmed on site visit' })
    expect(res.status).toBe(200)
    expect(res.body.exceedance.dispositionState).toBe('CONFIRMED_VIOLATION')
    expect(res.body.enforcementAction).not.toBeNull()
    expect(res.body.enforcementAction.state).toBe('DRAFT')
    expect(res.body.enforcementAction.industryId).toBe(industryId)

    // Verify enforcement action is persisted
    const ea = await prisma.enforcementAction.findUnique({
      where: { id: res.body.enforcementAction.id },
    })
    expect(ea?.state).toBe('DRAFT')
    expect(ea?.type).toBe('SHOW_CAUSE')
  })

  it('returns 409 when attempting to disposition an already-dispositioned exceedance', async () => {
    // The exceedance above is now CONFIRMED_VIOLATION — a second call should fail
    const res = await request(app)
      .post(`/api/exceedances/${pendingExceedanceId}/disposition`)
      .set('Authorization', `Bearer ${moToken}`)
      .send({ state: 'SENSOR_GLITCH' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('already_dispositioned')
  })

  it('marks exceedance as SENSOR_GLITCH without creating enforcement', async () => {
    // Create a fresh PENDING exceedance
    const fresh = await prisma.exceedance.create({
      data: {
        stationId:       stationWithIndustryId,
        parameter:       'BOD',
        observedValue:   40,
        normValue:       30,
        breachMagnitude: 0.33,
        severity:        'MINOR',
        detectedAt:      new Date(),
        dispositionState: 'PENDING',
      },
    })

    const res = await request(app)
      .post(`/api/exceedances/${fresh.id}/disposition`)
      .set('Authorization', `Bearer ${moToken}`)
      .send({ state: 'SENSOR_GLITCH', notes: 'Sensor calibration issue' })
    expect(res.status).toBe(200)
    expect(res.body.exceedance.dispositionState).toBe('SENSOR_GLITCH')
    expect(res.body.enforcementAction).toBeNull()
  })
})
