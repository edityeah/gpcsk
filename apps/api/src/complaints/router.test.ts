import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'

const app = buildApp()

// ── Helpers ─────────────────────────────────────────────────────────────────

async function login(phone: string) {
  const res = await request(app).post('/api/auth/phone/verify-otp').send({ phone, otp: '1234' })
  return res.body.token as string
}

let complaintsOfficerToken: string
let seniorReviewerToken: string
let monitoringOfficerToken: string

beforeAll(async () => {
  await seedDemoUsers(prisma)
  complaintsOfficerToken = await login('9000000004') // COMPLAINTS_OFFICER
  seniorReviewerToken    = await login('9000000005') // SENIOR_REVIEWER
  monitoringOfficerToken = await login('9000000002') // MONITORING_OFFICER
})

afterAll(async () => {
  await prisma.$disconnect()
})

// Clean up complaints between tests to avoid cross-contamination
beforeEach(async () => {
  await prisma.complaintResponse.deleteMany()
  await prisma.complaint.deleteMany()
})

// ── POST /api/complaints ─────────────────────────────────────────────────────

describe('POST /api/complaints', () => {
  it('creates a complaint with auto-categorisation and severity', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)
      .send({
        channel: 'WEB',
        complainant: { name: 'Ramesh Patel', phone: '9876543210' },
        description: 'Dense black smoke coming from the chimney of the factory near Vatva GIDC.',
      })

    expect(res.status).toBe(201)
    expect(res.body.category).toBe('AIR_POLLUTION')
    expect(res.body.severity).toBe('MINOR')
    expect(res.body.state).toBe('NEW')
    expect(res.body.channel).toBe('WEB')
  })

  it('assigns CRITICAL severity for illegal bypass keywords', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)
      .send({
        channel: 'PHONE',
        complainant: { name: 'Geeta Sharma' },
        description: 'Illegal bypass of effluent into Sabarmati river at night — toxic chemicals.',
      })

    expect(res.status).toBe(201)
    expect(res.body.severity).toBe('CRITICAL')
    expect(res.body.category).toMatch(/WATER_POLLUTION|ILLEGAL_DISCHARGE/)
  })

  it('assigns MAJOR severity for hazardous waste dump', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)
      .send({
        channel: 'EMAIL',
        complainant: { name: 'Suresh Kumar', email: 'suresh@example.com' },
        description: 'Hazardous waste drums dumped near the drain behind the industrial plot.',
      })

    expect(res.status).toBe(201)
    expect(res.body.category).toBe('HAZARDOUS_WASTE')
    expect(['MAJOR', 'CRITICAL']).toContain(res.body.severity)
  })

  it('rejects a complaint with a description that is too short', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)
      .send({
        channel: 'WEB',
        complainant: { name: 'A' },
        description: 'bad',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_input')
  })

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .send({
        channel: 'WEB',
        complainant: { name: 'Anonymous' },
        description: 'Something fishy going on at the plant',
      })

    expect(res.status).toBe(401)
  })
})

// ── GET /api/complaints ──────────────────────────────────────────────────────

describe('GET /api/complaints', () => {
  beforeEach(async () => {
    await prisma.complaint.createMany({
      data: [
        {
          channel: 'WEB', complainant: { name: 'A' }, description: 'Air pollution from chimney',
          category: 'AIR_POLLUTION', severity: 'MINOR', state: 'NEW',
        },
        {
          channel: 'PHONE', complainant: { name: 'B' }, description: 'Water effluent discharge',
          category: 'WATER_POLLUTION', severity: 'MAJOR', state: 'ASSIGNED',
        },
        {
          channel: 'EMAIL', complainant: { name: 'C' }, description: 'Hazardous waste dump near drain',
          category: 'HAZARDOUS_WASTE', severity: 'CRITICAL', state: 'RESOLVED',
        },
      ],
    })
  })

  it('returns all complaints (authenticated)', async () => {
    const res = await request(app)
      .get('/api/complaints')
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(3)
  })

  it('filters by state', async () => {
    const res = await request(app)
      .get('/api/complaints?state=RESOLVED')
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.every((c: { state: string }) => c.state === 'RESOLVED')).toBe(true)
  })

  it('filters by severity', async () => {
    const res = await request(app)
      .get('/api/complaints?severity=CRITICAL')
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.every((c: { severity: string }) => c.severity === 'CRITICAL')).toBe(true)
  })

  it('filters by full-text q', async () => {
    const res = await request(app)
      .get('/api/complaints?q=chimney')
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.some((c: { description: string }) => /chimney/i.test(c.description))).toBe(true)
  })
})

// ── GET /api/complaints/:id ──────────────────────────────────────────────────

describe('GET /api/complaints/:id', () => {
  it('returns a complaint with responses', async () => {
    const complaint = await prisma.complaint.create({
      data: {
        channel: 'WEB',
        complainant: { name: 'Tester' },
        description: 'Water discharge into Sabarmati river near the plant',
        category: 'WATER_POLLUTION',
        severity: 'MAJOR',
      },
    })

    const res = await request(app)
      .get(`/api/complaints/${complaint.id}`)
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(complaint.id)
    expect(Array.isArray(res.body.responses)).toBe(true)
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/complaints/nonexistent-id-abc')
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)

    expect(res.status).toBe(404)
  })
})

// ── POST /api/complaints/:id/assign ─────────────────────────────────────────

describe('POST /api/complaints/:id/assign', () => {
  it('allows COMPLAINTS_OFFICER to assign a complaint', async () => {
    const complaint = await prisma.complaint.create({
      data: {
        channel: 'PHONE',
        complainant: { name: 'Citizen X' },
        description: 'Smoke coming from the stack at night — visible from kilometres away',
        category: 'AIR_POLLUTION',
        severity: 'MAJOR',
      },
    })

    const officerRes = await request(app)
      .post('/api/auth/phone/verify-otp')
      .send({ phone: '9000000004', otp: '1234' })
    const officerId = officerRes.body.user.id

    const res = await request(app)
      .post(`/api/complaints/${complaint.id}/assign`)
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)
      .send({ assignedToId: officerId })

    expect(res.status).toBe(200)
    expect(res.body.assignedToId).toBe(officerId)
    expect(res.body.state).toBe('ASSIGNED')
  })

  it('rejects assignment by MONITORING_OFFICER (wrong role)', async () => {
    const complaint = await prisma.complaint.create({
      data: {
        channel: 'EMAIL',
        complainant: { name: 'Citizen Y' },
        description: 'Noise from compressors running overnight in residential area',
        category: 'NOISE_POLLUTION',
        severity: 'MINOR',
      },
    })

    const res = await request(app)
      .post(`/api/complaints/${complaint.id}/assign`)
      .set('Authorization', `Bearer ${monitoringOfficerToken}`)
      .send({ assignedToId: 'some-id' })

    expect(res.status).toBe(403)
  })
})

// ── POST /api/complaints/:id/respond ────────────────────────────────────────

describe('POST /api/complaints/:id/respond', () => {
  it('allows the assigned officer to respond and moves state to IN_PROGRESS', async () => {
    const officerRes = await request(app)
      .post('/api/auth/phone/verify-otp')
      .send({ phone: '9000000004', otp: '1234' })
    const officerId = officerRes.body.user.id

    const complaint = await prisma.complaint.create({
      data: {
        channel: 'WALK_IN',
        complainant: { name: 'Walkup Citizen' },
        description: 'Persistent water discharge running into irrigation channel near factory',
        category: 'WATER_POLLUTION',
        severity: 'MAJOR',
        assignedToId: officerId,
        state: 'ASSIGNED',
      },
    })

    const res = await request(app)
      .post(`/api/complaints/${complaint.id}/respond`)
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)
      .send({ message: 'Inspectors dispatched. Will visit tomorrow morning.', action: 'SITE_VISIT_SCHEDULED' })

    expect(res.status).toBe(201)
    expect(res.body.response.message).toMatch(/Inspectors dispatched/)
    expect(res.body.complaint.state).toBe('IN_PROGRESS')
  })

  it('blocks an unassigned officer from responding', async () => {
    const complaint = await prisma.complaint.create({
      data: {
        channel: 'WEB',
        complainant: { name: 'Another Citizen' },
        description: 'Chemical odour from factory very strong near school area early morning',
        category: 'AIR_POLLUTION',
        severity: 'MAJOR',
        assignedToId: null,
        state: 'NEW',
      },
    })

    const res = await request(app)
      .post(`/api/complaints/${complaint.id}/respond`)
      .set('Authorization', `Bearer ${monitoringOfficerToken}`)
      .send({ message: 'We are investigating.' })

    expect(res.status).toBe(403)
  })
})

// ── POST /api/complaints/:id/state ──────────────────────────────────────────

describe('POST /api/complaints/:id/state', () => {
  it('transitions complaint to RESOLVED with audit log', async () => {
    const complaint = await prisma.complaint.create({
      data: {
        channel: 'WEB',
        complainant: { name: 'Resolved Citizen' },
        description: 'Factory effluent into drain has been a persistent issue for weeks',
        category: 'WATER_POLLUTION',
        severity: 'MAJOR',
        state: 'IN_PROGRESS',
      },
    })

    const res = await request(app)
      .post(`/api/complaints/${complaint.id}/state`)
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)
      .send({ state: 'RESOLVED', reason: 'Factory has installed proper ETP.' })

    expect(res.status).toBe(200)
    expect(res.body.state).toBe('RESOLVED')

    // Verify audit log was written
    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'Complaint', entityId: complaint.id, action: 'STATE_TRANSITION_RESOLVED' },
    })
    expect(audit).not.toBeNull()
    expect(audit?.reason).toBe('Factory has installed proper ETP.')
  })

  it('transitions complaint to DUPLICATE', async () => {
    const complaint = await prisma.complaint.create({
      data: {
        channel: 'PHONE',
        complainant: { name: 'Duplicate Reporter' },
        description: 'Air pollution from chimney — same as earlier complaint',
        category: 'AIR_POLLUTION',
        severity: 'MINOR',
        state: 'NEW',
      },
    })

    const res = await request(app)
      .post(`/api/complaints/${complaint.id}/state`)
      .set('Authorization', `Bearer ${seniorReviewerToken}`)
      .send({ state: 'DUPLICATE' })

    expect(res.status).toBe(200)
    expect(res.body.state).toBe('DUPLICATE')
  })

  it('blocks MONITORING_OFFICER from state transitions', async () => {
    const complaint = await prisma.complaint.create({
      data: {
        channel: 'EMAIL',
        complainant: { name: 'Block Tester' },
        description: 'Noise pollution from industrial machinery is unbearable at night',
        category: 'NOISE_POLLUTION',
        severity: 'MINOR',
      },
    })

    const res = await request(app)
      .post(`/api/complaints/${complaint.id}/state`)
      .set('Authorization', `Bearer ${monitoringOfficerToken}`)
      .send({ state: 'CLOSED' })

    expect(res.status).toBe(403)
  })
})

// ── GET /api/complaints/hotspots ─────────────────────────────────────────────

describe('GET /api/complaints/hotspots', () => {
  beforeEach(async () => {
    // Seed complaints with lat/lng to form clusters
    await prisma.complaint.createMany({
      data: [
        // Cluster around Vatva (~23.00, 72.62)
        { channel: 'WEB', complainant: { name: 'C1' }, description: 'Chimney smoke from factory near Vatva', category: 'AIR_POLLUTION', severity: 'MINOR',    lat: 23.001, lng: 72.621 },
        { channel: 'WEB', complainant: { name: 'C2' }, description: 'Another air pollution near Vatva',      category: 'AIR_POLLUTION', severity: 'MAJOR',    lat: 23.003, lng: 72.619 },
        { channel: 'WEB', complainant: { name: 'C3' }, description: 'Critical toxic bypass near Vatva',      category: 'ILLEGAL_DISCHARGE', severity: 'CRITICAL', lat: 23.002, lng: 72.622 },
        // Isolated complaint (Ankleshwar ~21.63, 73.01)
        { channel: 'PHONE', complainant: { name: 'C4' }, description: 'Hazardous waste drums near drain',   category: 'HAZARDOUS_WASTE', severity: 'MAJOR',  lat: 21.630, lng: 73.012 },
      ],
    })
  })

  it('returns clusters with lat, lng, count, severity, sampleIds', async () => {
    const res = await request(app)
      .get('/api/complaints/hotspots')
      .set('Authorization', `Bearer ${complaintsOfficerToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)

    const clustered = res.body.find((h: { count: number }) => h.count >= 3)
    expect(clustered).toBeDefined()
    expect(clustered.severity).toBe('CRITICAL') // dominant severity in that cluster
    expect(Array.isArray(clustered.sampleIds)).toBe(true)
    expect(clustered.sampleIds.length).toBeGreaterThan(0)
    expect(typeof clustered.lat).toBe('number')
    expect(typeof clustered.lng).toBe('number')
  })

  it('requires authentication', async () => {
    const res = await request(app).get('/api/complaints/hotspots')
    expect(res.status).toBe(401)
  })
})
