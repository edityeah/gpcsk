/**
 * Tests for /api/voice/* endpoints.
 *
 * OpenAI realtime sessions API is mocked — no real API calls.
 * Tests cover:
 *  1. /session — 401 without token
 *  2. /session — 503 when key is placeholder
 *  3. /session — 200 returns client_secret on happy path
 *  4. /session — 200 with contextHint appended
 *  5. /rag-search — 401 without token
 *  6. /rag-search — 400 when query missing
 *  7. /rag-search — returns passages
 *  8. /canvas-intent — 401 without token
 *  9. /canvas-intent — 400 for invalid body
 * 10. /canvas-intent — 200 ok=true for SENIOR_REVIEWER opening OPEN_WAR_ROOM
 * 11. /canvas-intent — 403 for CONSENT_OFFICER trying OPEN_WAR_ROOM
 * 12. /canvas-intent — 404 for unknown canvas name
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'

// ── Mock OpenAI fetch (used by voice/session) ─────────────────────────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Mock RAG retrieve ─────────────────────────────────────────────────────────
vi.mock('../ai/rag.js', () => ({
  retrieve: vi.fn().mockResolvedValue([
    { docId: 'doc1', docTitle: 'GPCB Norms', snippet: 'PM10 standard is 100 µg/m³.' },
  ]),
}))

const app = buildApp()

let srToken = ''
let coToken = ''
const REAL_KEY = 'sk-realkey1234567890abcdef'

beforeAll(async () => {
  await seedDemoUsers(prisma)
  const sr = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000005' } })
  const co = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000001' } })
  srToken = signToken({ sub: sr.id, role: sr.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  coToken = signToken({ sub: co.id, role: co.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  process.env['OPENAI_API_KEY'] = REAL_KEY
})

beforeEach(() => {
  mockFetch.mockReset()
  process.env['OPENAI_API_KEY'] = REAL_KEY
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ── /api/voice/session ────────────────────────────────────────────────────────

describe('POST /api/voice/session', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/voice/session').send({})
    expect(res.status).toBe(401)
  })

  it('returns 503 when OPENAI_API_KEY is placeholder', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-...'
    const res = await request(app)
      .post('/api/voice/session')
      .set('Authorization', `Bearer ${srToken}`)
      .send({})
    expect(res.status).toBe(503)
    expect(res.body.error).toBe('voice_offline')
  })

  it('returns client_secret on happy path', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: 'ek_live_testtoken',
        expires_at: 9999999999,
        session: { id: 'sess_abc123', model: 'gpt-4o-realtime-preview-2024-12-17' },
      }),
    })
    const res = await request(app)
      .post('/api/voice/session')
      .set('Authorization', `Bearer ${srToken}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.client_secret?.value).toBe('ek_live_testtoken')
    expect(res.body.model).toBe('gpt-4o-realtime-preview-2024-12-17')
  })

  it('includes contextHint in instructions when provided', async () => {
    let capturedBody: unknown = null
    mockFetch.mockImplementationOnce(async (_url: string, opts: RequestInit) => {
      capturedBody = JSON.parse(opts.body as string)
      return {
        ok: true,
        json: async () => ({
          value: 'ek_live_ctx',
          expires_at: 9999999999,
          session: { id: 'sess_xyz', model: 'gpt-4o-realtime-preview-2024-12-17' },
        }),
      }
    })
    const res = await request(app)
      .post('/api/voice/session')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ contextHint: 'War Room canvas is open.' })
    expect(res.status).toBe(200)
    const body = capturedBody as { session?: { instructions?: string } }
    expect(body.session?.instructions).toContain('War Room canvas is open.')
  })
})

// ── /api/voice/rag-search ─────────────────────────────────────────────────────

describe('POST /api/voice/rag-search', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/voice/rag-search').send({ query: 'PM10 norms' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when query is missing', async () => {
    const res = await request(app)
      .post('/api/voice/rag-search')
      .set('Authorization', `Bearer ${srToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns passages array', async () => {
    const res = await request(app)
      .post('/api/voice/rag-search')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ query: 'PM10 standard' })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.passages)).toBe(true)
    const first = res.body.passages[0] as { docId: string; docTitle: string; snippet: string }
    expect(typeof first.docId).toBe('string')
    expect(typeof first.snippet).toBe('string')
  })
})

// ── /api/voice/canvas-intent ──────────────────────────────────────────────────

describe('POST /api/voice/canvas-intent', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/voice/canvas-intent')
      .send({ name: 'OPEN_WAR_ROOM', args: {} })
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    const res = await request(app)
      .post('/api/voice/canvas-intent')
      .set('Authorization', `Bearer ${srToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 200 ok=true for SENIOR_REVIEWER opening OPEN_WAR_ROOM', async () => {
    const res = await request(app)
      .post('/api/voice/canvas-intent')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ name: 'OPEN_WAR_ROOM', args: {} })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 403 for CONSENT_OFFICER trying OPEN_WAR_ROOM (not in allowedRoles)', async () => {
    const res = await request(app)
      .post('/api/voice/canvas-intent')
      .set('Authorization', `Bearer ${coToken}`)
      .send({ name: 'OPEN_WAR_ROOM', args: {} })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('forbidden')
  })

  it('returns 404 for unknown canvas name', async () => {
    const res = await request(app)
      .post('/api/voice/canvas-intent')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ name: 'OPEN_IMAGINARY_CANVAS', args: {} })
    expect(res.status).toBe(404)
  })
})
