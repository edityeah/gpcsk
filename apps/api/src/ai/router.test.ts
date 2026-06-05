/**
 * Tests for /api/ai/* routes.
 *
 * OpenAI is mocked via vitest — no real API calls made.
 * Tests cover:
 *  1. Offline guard (placeholder OPENAI_API_KEY)
 *  2. Canvas response when gpt-4o returns a tool call (SENIOR_REVIEWER)
 *  3. Answer response when gpt-4o returns plain text
 *  4. Role-based tool access (forbidden tool call blocked)
 *  5. Thread reuse across multiple messages
 *  6. GET /api/ai/threads — returns thread list
 *  7. GET /api/ai/threads/:id — owner access + 403 on wrong user
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'

// ── Mock OpenAI ──────────────────────────────────────────────────────────────
//
// We expose a shared `mockCreate` spy that individual tests can configure via
// mockResolvedValueOnce. The mock constructor always returns the same object.

const mockCreate = vi.fn()
const mockEmbeddingsCreate = vi.fn().mockResolvedValue({
  data: [{ index: 0, embedding: new Array(1536).fill(0.01) }],
})

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
      embeddings: {
        create: mockEmbeddingsCreate,
      },
    })),
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePlainTextResponse(text: string) {
  return {
    choices: [
      {
        finish_reason: 'stop',
        message: { role: 'assistant', content: text, tool_calls: null },
      },
    ],
  }
}

function makeToolCallResponse(toolName: string, args: Record<string, unknown> = {}) {
  return {
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_test123',
              type: 'function',
              function: { name: toolName, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────

const app = buildApp()

let srToken = ''
let coToken = ''
let moToken = ''
let srId = ''
let coId = ''

const REAL_KEY = 'sk-realkey1234567890abcdef'

beforeAll(async () => {
  await seedDemoUsers(prisma)

  const sr = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000005' } })
  const co = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000001' } })
  const mo = await prisma.user.findUniqueOrThrow({ where: { phone: '9000000002' } })

  srId = sr.id
  coId = co.id

  srToken = signToken({ sub: sr.id, role: sr.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  coToken = signToken({ sub: co.id, role: co.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
  moToken = signToken({ sub: mo.id, role: mo.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })

  // Default to real key so that tests that need OpenAI active work
  process.env['OPENAI_API_KEY'] = REAL_KEY
})

beforeEach(() => {
  mockCreate.mockReset()
  // Restore real key before each test (individual tests override as needed)
  process.env['OPENAI_API_KEY'] = REAL_KEY
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ── Tests: POST /api/ai/message ──────────────────────────────────────────────

describe('POST /api/ai/message', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/ai/message')
      .send({ content: 'Hello' })
    expect(res.status).toBe(401)
  })

  it('returns 400 for empty content', async () => {
    const res = await request(app)
      .post('/api/ai/message')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ content: '' })
    expect(res.status).toBe(400)
  })

  it('returns offline answer when OPENAI_API_KEY is placeholder', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-...'

    const res = await request(app)
      .post('/api/ai/message')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ content: 'What is the current PM10 level?' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('answer')
    expect((res.body.text as string)).toMatch(/offline/i)
    expect(Array.isArray(res.body.citations)).toBe(true)
  })

  it('returns canvas response when gpt-4o calls a tool (SENIOR_REVIEWER opens Gujarat Pulse)', async () => {
    mockCreate.mockResolvedValueOnce(makeToolCallResponse('OPEN_GUJARAT_PULSE', { stream: 'air' }))

    const res = await request(app)
      .post('/api/ai/message')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ content: 'Show me the Gujarat Pulse dashboard', lang: 'en' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('canvas')
    expect(res.body.module).toBe('OPEN_GUJARAT_PULSE')
    expect(res.body.args).toBeDefined()
    expect(typeof res.body.threadId).toBe('string')
  })

  it('returns answer response when gpt-4o replies with text', async () => {
    // First call: plain text (no RAG chunks in test DB, so only one call is made)
    mockCreate.mockResolvedValue(makePlainTextResponse('PM10 levels in Surat are within norms.'))

    const res = await request(app)
      .post('/api/ai/message')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ content: 'What is the current PM10 level in Surat?', lang: 'en' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('answer')
    expect(typeof res.body.text).toBe('string')
    expect((res.body.text as string).length).toBeGreaterThan(0)
    expect(Array.isArray(res.body.citations)).toBe(true)
    expect(typeof res.body.threadId).toBe('string')
  })

  it('blocks a tool call when the user role is not in allowedRoles (CO cannot open Gujarat Pulse)', async () => {
    // Model tries to open OPEN_GUJARAT_PULSE — only SENIOR_REVIEWER is allowed
    mockCreate.mockResolvedValueOnce(makeToolCallResponse('OPEN_GUJARAT_PULSE'))

    const res = await request(app)
      .post('/api/ai/message')
      .set('Authorization', `Bearer ${coToken}`)
      .send({ content: 'Open Gujarat Pulse', lang: 'en' })

    expect(res.status).toBe(200)
    // Should fall back to an answer with a permissions message
    expect(res.body.kind).toBe('answer')
    expect((res.body.text as string)).toMatch(/permission/i)
  })

  it('creates a new thread when no threadId provided', async () => {
    mockCreate.mockResolvedValue(makePlainTextResponse('Here is what I know about CETP.'))

    const res = await request(app)
      .post('/api/ai/message')
      .set('Authorization', `Bearer ${moToken}`)
      .send({ content: 'Tell me about CETP performance', lang: 'en' })

    expect(res.status).toBe(200)
    expect(typeof res.body.threadId).toBe('string')
    expect((res.body.threadId as string).length).toBeGreaterThan(0)
  })

  it('reuses an existing thread when threadId provided', async () => {
    // First message — create thread
    mockCreate.mockResolvedValueOnce(makePlainTextResponse('First answer.'))
    const firstRes = await request(app)
      .post('/api/ai/message')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ content: 'First question', lang: 'en' })

    expect(firstRes.status).toBe(200)
    const { threadId } = firstRes.body as { threadId: string }
    expect(typeof threadId).toBe('string')

    // Second message — reuse thread
    mockCreate.mockResolvedValueOnce(makePlainTextResponse('Second answer.'))
    const secondRes = await request(app)
      .post('/api/ai/message')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ content: 'Second question', threadId, lang: 'en' })

    expect(secondRes.status).toBe(200)
    expect(secondRes.body.threadId).toBe(threadId)
  })

  it('returns 404 when threadId belongs to another user', async () => {
    // Create a thread owned by SR
    const thread = await prisma.chatThread.create({
      data: { userId: srId, title: 'SR private thread' },
    })

    // CO tries to continue SR thread
    const res = await request(app)
      .post('/api/ai/message')
      .set('Authorization', `Bearer ${coToken}`)
      .send({ content: 'Continue the thread', threadId: thread.id, lang: 'en' })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('thread_not_found')
  })
})

// ── Tests: GET /api/ai/threads ───────────────────────────────────────────────

describe('GET /api/ai/threads', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/ai/threads')
    expect(res.status).toBe(401)
  })

  it('returns thread list for authenticated user', async () => {
    const res = await request(app)
      .get('/api/ai/threads')
      .set('Authorization', `Bearer ${srToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.threads)).toBe(true)
  })
})

// ── Tests: GET /api/ai/threads/:id ──────────────────────────────────────────

describe('GET /api/ai/threads/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/ai/threads/nonexistent')
    expect(res.status).toBe(401)
  })

  it('returns 404 for nonexistent thread', async () => {
    const res = await request(app)
      .get('/api/ai/threads/nonexistent_id_xyz')
      .set('Authorization', `Bearer ${srToken}`)

    expect(res.status).toBe(404)
  })

  it('returns thread with messages for owner', async () => {
    // Create a thread owned by SR
    const thread = await prisma.chatThread.create({
      data: { userId: srId, title: 'Test thread for GET' },
    })
    await prisma.chatMessage.create({
      data: { threadId: thread.id, role: 'user', content: 'Test message' },
    })

    const res = await request(app)
      .get(`/api/ai/threads/${thread.id}`)
      .set('Authorization', `Bearer ${srToken}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(thread.id)
    expect(Array.isArray(res.body.messages)).toBe(true)
    expect((res.body.messages as unknown[]).length).toBeGreaterThanOrEqual(1)
  })

  it('returns 403 when a different user tries to access someone elses thread', async () => {
    // Create a thread owned by SR
    const thread = await prisma.chatThread.create({
      data: { userId: srId, title: 'SR private thread for 403 test' },
    })

    // CO tries to access SR thread
    const res = await request(app)
      .get(`/api/ai/threads/${thread.id}`)
      .set('Authorization', `Bearer ${coToken}`)

    expect(res.status).toBe(403)
  })
})
