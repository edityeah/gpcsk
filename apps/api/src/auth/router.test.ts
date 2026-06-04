import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'

const app = buildApp()

beforeAll(async () => {
  await seedDemoUsers(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/auth/phone/request-otp', () => {
  it('returns ok for a known demo phone', async () => {
    const res = await request(app).post('/api/auth/phone/request-otp').send({ phone: '9000000001' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'sent' })
  })

  it('returns ok even for an unknown phone (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/phone/request-otp').send({ phone: '9999999999' })
    expect(res.status).toBe(200)
  })

  it('rejects malformed phone', async () => {
    const res = await request(app).post('/api/auth/phone/request-otp').send({ phone: 'abc' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/phone/verify-otp', () => {
  it('issues a JWT for valid phone + OTP', async () => {
    const res = await request(app).post('/api/auth/phone/verify-otp').send({ phone: '9000000005', otp: '1234' })
    expect(res.status).toBe(200)
    expect(res.body.token).toMatch(/^eyJ/)
    expect(res.body.user.role).toBe('SENIOR_REVIEWER')
  })

  it('rejects an invalid OTP', async () => {
    const res = await request(app).post('/api/auth/phone/verify-otp').send({ phone: '9000000005', otp: '0000' })
    expect(res.status).toBe(401)
  })

  it('rejects an unknown phone', async () => {
    const res = await request(app).post('/api/auth/phone/verify-otp').send({ phone: '9999999999', otp: '1234' })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/auth/xgn/callback (mock SSO)', () => {
  it('issues a JWT for a known xgnId', async () => {
    const res = await request(app).post('/api/auth/xgn/callback').send({ xgnId: 'XGN-MO-001' })
    expect(res.status).toBe(200)
    expect(res.body.token).toMatch(/^eyJ/)
    expect(res.body.user.role).toBe('MONITORING_OFFICER')
  })

  it('rejects an unknown xgnId', async () => {
    const res = await request(app).post('/api/auth/xgn/callback').send({ xgnId: 'XGN-UNKNOWN' })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/auth/demo-login', () => {
  it('issues a JWT for a known role (development only)', async () => {
    const res = await request(app).post('/api/auth/demo-login').send({ role: 'CONSENT_OFFICER' })
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('CONSENT_OFFICER')
  })

  it('rejects an unknown role', async () => {
    const res = await request(app).post('/api/auth/demo-login').send({ role: 'GHOST_ROLE' })
    expect(res.status).toBe(400)
  })
})
