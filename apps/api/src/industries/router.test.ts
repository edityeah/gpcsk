import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'

const app = buildApp()

let token = ''
let industryId = ''

beforeAll(async () => {
  await seedDemoUsers(prisma)
  const user = await prisma.user.findUnique({ where: { phone: '9000000001' } })
  if (!user) throw new Error('seed user missing')
  token = signToken({ sub: user.id, role: user.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })

  // Seed a district + sector + industry for tests
  const district = await prisma.district.upsert({
    where:  { code: 'TEST-DIST' },
    update: {},
    create: { code: 'TEST-DIST', name: 'Test District' },
  })
  const sector = await prisma.sector.upsert({
    where:  { code: 'TEST-SEC' },
    update: {},
    create: { code: 'TEST-SEC', name: 'Test Sector' },
  })
  const industry = await prisma.industry.upsert({
    where:  { ucNumber: 'UC-TEST-001' },
    update: {},
    create: {
      name:      'Alpha Chemicals Ltd',
      ucNumber:  'UC-TEST-001',
      category:  'RED',
      districtId: district.id,
      sectorId:   sector.id,
    },
  })
  industryId = industry.id

  // Seed a violation for deep-dive test
  await prisma.violation.create({
    data: {
      industryId: industry.id,
      source:     'INSPECTION',
      parameter:  'COD',
      observedValue: 500,
      normValue:     250,
      unit:          'mg/L',
      severity:      'MAJOR',
    },
  })
})

afterAll(async () => {
  // Clean up seeded test data
  await prisma.violation.deleteMany({ where: { industryId } })
  await prisma.industry.delete({ where: { id: industryId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('GET /api/industries', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/industries')
    expect(res.status).toBe(401)
  })

  it('returns a paginated list of industries', async () => {
    const res = await request(app)
      .get('/api/industries')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('filters by category=RED and returns matching items', async () => {
    const res = await request(app)
      .get('/api/industries?category=RED')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    for (const item of res.body.items) {
      expect(item.category).toBe('RED')
    }
  })

  it('searches by name with q param', async () => {
    const res = await request(app)
      .get('/api/industries?q=Alpha+Chemicals')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const ids = res.body.items.map((i: { id: string }) => i.id)
    expect(ids).toContain(industryId)
  })

  it('paginates with limit=1 and returns nextCursor when more items exist', async () => {
    // Seed a second RED industry to ensure we have at least 2
    const district = await prisma.district.findUnique({ where: { code: 'TEST-DIST' } })
    const second = await prisma.industry.upsert({
      where:  { ucNumber: 'UC-TEST-002' },
      update: {},
      create: {
        name:       'Beta Textiles Ltd',
        ucNumber:   'UC-TEST-002',
        category:   'RED',
        districtId: district!.id,
      },
    })

    const res = await request(app)
      .get('/api/industries?category=RED&limit=1')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(1)
    expect(typeof res.body.nextCursor).toBe('string')

    // Cleanup second industry
    await prisma.industry.delete({ where: { id: second.id } })
  })

  it('returns 400 on an invalid category value', async () => {
    const res = await request(app)
      .get('/api/industries?category=PURPLE')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/industries/:id', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/industries/${industryId}`)
    expect(res.status).toBe(401)
  })

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .get('/api/industries/does-not-exist')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('returns the industry with related data arrays', async () => {
    const res = await request(app)
      .get(`/api/industries/${industryId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.industry.id).toBe(industryId)
    expect(Array.isArray(res.body.recentViolations)).toBe(true)
    expect(Array.isArray(res.body.activeConsents)).toBe(true)
    expect(Array.isArray(res.body.recentExceedances)).toBe(true)
    expect(Array.isArray(res.body.recentComplaints)).toBe(true)
  })

  it('deep-dive includes the seeded violation', async () => {
    const res = await request(app)
      .get(`/api/industries/${industryId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const violation = res.body.recentViolations.find(
      (v: { parameter: string }) => v.parameter === 'COD',
    )
    expect(violation).toBeDefined()
    expect(violation.severity).toBe('MAJOR')
  })
})
