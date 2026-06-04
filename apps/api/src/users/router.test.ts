import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'

const app = buildApp()

let token = ''
let userId = ''

beforeAll(async () => {
  await seedDemoUsers(prisma)
  const u = await prisma.user.findUnique({ where: { phone: '9000000001' } })
  if (!u) throw new Error('seed missing')
  userId = u.id
  token = signToken({ sub: u.id, role: u.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
})

afterAll(async () => prisma.$disconnect())

describe('GET /api/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/me')
    expect(res.status).toBe(401)
  })

  it('returns the current user with a valid token', async () => {
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(userId)
    expect(res.body.role).toBe('CONSENT_OFFICER')
  })

  it('returns 401 with a malformed token', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer garbage')
    expect(res.status).toBe(401)
  })
})
