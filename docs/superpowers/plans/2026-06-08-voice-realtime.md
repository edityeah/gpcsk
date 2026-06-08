# Voice Realtime (OpenAI gpt-4o-realtime) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real-time voice calling to Saathi using OpenAI Realtime API (WebRTC + ephemeral tokens), replacing the KSK LiveKit/Deepgram/Cartesia pattern with a zero-new-vendor solution that runs against the existing `OPENAI_API_KEY`.

**Architecture:** Backend mints a short-lived ephemeral `client_secret` via `POST /api/openai.com/v1/realtime/sessions` (server-side, key stays server). Frontend creates an `RTCPeerConnection`, sends an SDP offer to OpenAI's edge using only the ephemeral token, and attaches the remote audio stream to a hidden `<audio>` element. A floating pill at the bottom of the page shows live transcripts, mute toggle, and end-call button. Data-channel function calls from the model trigger proxied backend endpoints (`/api/voice/rag-search`, `/api/voice/canvas-intent`) to ground answers and open canvases.

**Tech Stack:** Express (backend), OpenAI REST (`/v1/realtime/sessions`), browser `RTCPeerConnection` + `getUserMedia`, React context + hooks, Lucide icons, Tailwind CSS (design tokens already present).

---

## File Map

### New files
| Path | Responsibility |
|------|---------------|
| `apps/api/src/voice/router.ts` | Three POST endpoints: `/session`, `/rag-search`, `/canvas-intent` |
| `apps/api/src/voice/router.test.ts` | Vitest tests for all three endpoints |
| `apps/web/src/context/CallProvider.tsx` | React context owning WebRTC lifecycle + transcript state |
| `apps/web/src/components/FloatingCallPill.tsx` | Fixed bottom-center pill UI (only when in-call) |
| `apps/web/src/components/CanvasCallButton.tsx` | Phone-icon button for canvas headers |

### Modified files
| Path | Change |
|------|--------|
| `apps/api/src/app.ts` | Mount `voiceRouter` at `/api/voice` |
| `apps/web/src/main.tsx` | Wrap `<App>` with `<CallProvider>` inside `<ChatProvider>` |
| `apps/web/src/pages/SuperHomePage.tsx` | (a) Wire `onVoice` in `GreetingPanel` to `startCall()`, (b) add `CanvasCallButton` in `CanvasOverlay` header, (c) add `CanvasCallButton` next to `SaathiQuickButton` in top bar |

---

## Task 1 — Backend: voice router skeleton + tests boilerplate

**Files:**
- Create: `apps/api/src/voice/router.ts`
- Create: `apps/api/src/voice/router.test.ts`

- [ ] **Step 1: Create the router file with stub exports**

```typescript
// apps/api/src/voice/router.ts
import { Router } from 'express'
import { requireAuth } from '../auth/middleware.js'

export const voiceRouter = Router()

// POST /api/voice/session — minted in Task 2
voiceRouter.post('/session', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'not_implemented' })
})

// POST /api/voice/rag-search — implemented in Task 3
voiceRouter.post('/rag-search', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'not_implemented' })
})

// POST /api/voice/canvas-intent — implemented in Task 4
voiceRouter.post('/canvas-intent', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'not_implemented' })
})
```

- [ ] **Step 2: Mount on app.ts**

Open `apps/api/src/app.ts`. Add the import after the existing ai router import:

```typescript
import { voiceRouter } from './voice/router.js'
```

Add the mount line after `app.use('/api/ai', aiRouter)`:

```typescript
app.use('/api/voice', voiceRouter)
```

- [ ] **Step 3: Write the test boilerplate**

```typescript
// apps/api/src/voice/router.test.ts
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
 *  6. /rag-search — returns passages
 *  7. /canvas-intent — 401 without token
 *  8. /canvas-intent — 200 for allowed role + module
 *  9. /canvas-intent — 403 for forbidden role + module
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

// Filled in Tasks 2-4
describe('POST /api/voice/session', () => {
  it('placeholder', () => expect(true).toBe(true))
})

describe('POST /api/voice/rag-search', () => {
  it('placeholder', () => expect(true).toBe(true))
})

describe('POST /api/voice/canvas-intent', () => {
  it('placeholder', () => expect(true).toBe(true))
})
```

- [ ] **Step 4: Run tests to confirm they at least compile and load**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter api test -- --reporter=verbose 2>&1 | tail -30
```

Expected: existing tests still pass; new voice placeholders pass (trivially true).

- [ ] **Step 5: Commit**

```bash
cd /Users/adityeahspare/Documents/GPCB
git add apps/api/src/voice/router.ts apps/api/src/voice/router.test.ts apps/api/src/app.ts
git commit -m "feat(api/voice): scaffold voice router + mount on app + test boilerplate"
```

---

## Task 2 — Backend: POST /api/voice/session

**Files:**
- Modify: `apps/api/src/voice/router.ts`
- Modify: `apps/api/src/voice/router.test.ts`

The endpoint calls `POST https://api.openai.com/v1/realtime/sessions` server-side, proxies back the response (which includes `client_secret.value`, `expires_at`, `model`). Accepts optional `contextHint` body field to append to the base system prompt.

- [ ] **Step 1: Write the failing tests first**

Replace the `POST /api/voice/session` describe block in `router.test.ts`:

```typescript
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
        id: 'sess_abc123',
        model: 'gpt-4o-realtime-preview-2024-12-17',
        client_secret: { value: 'ek_live_testtoken', expires_at: 9999999999 },
        expires_at: 9999999999,
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
          id: 'sess_xyz',
          model: 'gpt-4o-realtime-preview-2024-12-17',
          client_secret: { value: 'ek_live_ctx', expires_at: 9999999999 },
          expires_at: 9999999999,
        }),
      }
    })
    const res = await request(app)
      .post('/api/voice/session')
      .set('Authorization', `Bearer ${srToken}`)
      .send({ contextHint: 'War Room canvas is open.' })
    expect(res.status).toBe(200)
    const body = capturedBody as { instructions?: string }
    expect(body.instructions).toContain('War Room canvas is open.')
  })
})
```

- [ ] **Step 2: Run tests to confirm they FAIL**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter api test -- voice/router --reporter=verbose 2>&1 | tail -20
```

Expected: 4 tests fail (session still returns 501).

- [ ] **Step 3: Implement the endpoint**

Replace the `/session` stub in `apps/api/src/voice/router.ts` with:

```typescript
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../auth/middleware.js'
import { logger } from '../logger.js'

export const voiceRouter = Router()

// ── Shared helpers ───────────────────────────────────────────────────────────

function isApiKeyConfigured(): boolean {
  const key = process.env['OPENAI_API_KEY'] ?? ''
  return key.length > 0 && key !== 'sk-...' && !key.startsWith('sk-...')
}

// ── System prompt (voice-optimised) ─────────────────────────────────────────

const VOICE_SYSTEM_PROMPT = `You are GPCSK AI — the intelligent assistant for the Gujarat Pollution Control Samiksha Kendra (GPCSK) platform built by the Gujarat Pollution Control Board (GPCB).

You assist five types of officers: Consent Officers, Monitoring Officers, Inspection & Enforcement Officers, Complaints Officers, and Senior Reviewers. Always address the officer respectfully and in their preferred language.

You can do three things:
1. OPEN A CANVAS MODULE — call the open_canvas function when the officer asks to see a specific dashboard, queue, map, or report.
2. ANSWER A QUESTION — provide concise, data-backed answers about pollution monitoring, consent regulations, enforcement procedures, CETP performance, OCEMS data, or GPCB policies.
3. SEARCH THE KNOWLEDGE BASE — call the rag_search function when answering a data-specific question about GPCB norms, regulations, or historical information.

You are speaking out loud to a GPCB officer over a phone-style call. Keep answers concise (2-3 sentences). When the officer asks about pollution data you don't immediately know, call the rag_search function. When they ask you to open a dashboard, call the open_canvas function with the appropriate canvas name. Don't read out long URLs or IDs.

Available canvas names: OPEN_WAR_ROOM, OPEN_GUJARAT_PULSE, OPEN_INDUSTRY_RISK_INDEX, OPEN_ENFORCEMENT_PIPELINE, OPEN_TREND_LAB, OPEN_APPLICATION_QUEUE, OPEN_CONSENT_PIPELINE, OPEN_RENEWAL_RADAR, OPEN_OCEMS_LIVE_GRID, OPEN_EXCEEDANCE_FEED, OPEN_CETP_SCORECARD, OPEN_AAQM_MONITOR, OPEN_VOC_CLUSTER_MONITOR, OPEN_FESTIVAL_PLANNER, OPEN_INSPECTION_PRIORITISATION, OPEN_DRAFT_NOTICE, OPEN_VIOLATIONS_REGISTER, OPEN_COMPLAINT_INBOX, OPEN_COMPLAINT_HOTSPOT_MAP, OPEN_MAKER_CHECKER_QUEUE, OPEN_INDUSTRY_DEEP_DIVE.`

const VOICE_TOOLS = [
  {
    type: 'function',
    name: 'rag_search',
    description: 'Search the GPCB knowledge base for regulations, norms, and procedures. Call this when the officer asks a factual question about GPCB data, standards, or policies.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'open_canvas',
    description: 'Open a GPCSK canvas module for the officer. Call this when they ask to see a dashboard or specific view.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Canvas module name, e.g. OPEN_WAR_ROOM' },
        args: { type: 'object', description: 'Optional canvas arguments', additionalProperties: true },
      },
      required: ['name'],
    },
  },
]

// ── Schema ───────────────────────────────────────────────────────────────────

const SessionBodySchema = z.object({
  contextHint: z.string().max(500).optional(),
})

// ── POST /api/voice/session ──────────────────────────────────────────────────

voiceRouter.post('/session', requireAuth, async (req, res) => {
  if (!isApiKeyConfigured()) {
    res.status(503).json({ error: 'voice_offline' })
    return
  }

  const parsed = SessionBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
    return
  }

  const { contextHint } = parsed.data
  const instructions = contextHint
    ? `${VOICE_SYSTEM_PROMPT}\n\n${contextHint}`
    : VOICE_SYSTEM_PROMPT

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env['OPENAI_API_KEY']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
        instructions,
        modalities: ['text', 'audio'],
        turn_detection: { type: 'server_vad' },
        input_audio_transcription: { model: 'whisper-1' },
        tools: VOICE_TOOLS,
        tool_choice: 'auto',
      }),
    })

    if (!openaiRes.ok) {
      const errBody = await openaiRes.json().catch(() => ({}))
      logger.error({ status: openaiRes.status, errBody }, 'voice/session — OpenAI error')
      res.status(502).json({ error: 'upstream_error', details: errBody })
      return
    }

    const data = await openaiRes.json()
    res.json(data)
  } catch (err: unknown) {
    logger.error({ err }, 'voice/session — unhandled error')
    res.status(500).json({ error: 'server_error' })
  }
})

// Stubs — implemented in Tasks 3 and 4
voiceRouter.post('/rag-search', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'not_implemented' })
})

voiceRouter.post('/canvas-intent', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'not_implemented' })
})
```

- [ ] **Step 4: Run tests to confirm they PASS**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter api test -- voice/router --reporter=verbose 2>&1 | tail -20
```

Expected: 4 session tests pass; rag-search and canvas-intent still placeholder-pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/adityeahspare/Documents/GPCB
git add apps/api/src/voice/router.ts apps/api/src/voice/router.test.ts
git commit -m "feat(api/voice): POST /api/voice/session — ephemeral token + contextHint support"
```

---

## Task 3 — Backend: POST /api/voice/rag-search

**Files:**
- Modify: `apps/api/src/voice/router.ts`
- Modify: `apps/api/src/voice/router.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the `POST /api/voice/rag-search` describe block:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they FAIL**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter api test -- voice/router --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|rag)"
```

Expected: 3 rag-search tests fail (still 501).

- [ ] **Step 3: Implement the endpoint**

Add after the `import` block at the top of `router.ts`:

```typescript
import { retrieve } from '../ai/rag.js'
```

Replace the `/rag-search` stub with:

```typescript
const RagSearchBodySchema = z.object({
  query: z.string().min(1).max(500),
})

voiceRouter.post('/rag-search', requireAuth, async (req, res) => {
  const parsed = RagSearchBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
    return
  }

  try {
    const chunks = await retrieve(parsed.data.query, 5)
    res.json({
      passages: chunks.map((c) => ({
        docId: c.docId,
        docTitle: c.docTitle,
        snippet: c.snippet,
      })),
    })
  } catch (err: unknown) {
    logger.error({ err }, 'voice/rag-search — error')
    res.status(500).json({ error: 'server_error' })
  }
})
```

- [ ] **Step 4: Run tests to confirm they PASS**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter api test -- voice/router --reporter=verbose 2>&1 | tail -20
```

Expected: all rag-search tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/adityeahspare/Documents/GPCB
git add apps/api/src/voice/router.ts apps/api/src/voice/router.test.ts
git commit -m "feat(api/voice): POST /api/voice/rag-search — wraps rag.retrieve"
```

---

## Task 4 — Backend: POST /api/voice/canvas-intent

**Files:**
- Modify: `apps/api/src/voice/router.ts`
- Modify: `apps/api/src/voice/router.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the `POST /api/voice/canvas-intent` describe block:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they FAIL**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter api test -- voice/router --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|canvas)"
```

Expected: 5 canvas-intent tests fail.

- [ ] **Step 3: Implement the endpoint**

Add import at top of `router.ts`:

```typescript
import { findAction } from '../ai/actionRegistry.js'
import type { Role } from '@gpcsk/shared'
```

Replace the `/canvas-intent` stub with:

```typescript
const CanvasIntentBodySchema = z.object({
  name: z.string().min(1),
  args: z.record(z.unknown()).optional().default({}),
})

voiceRouter.post('/canvas-intent', requireAuth, (req, res) => {
  const parsed = CanvasIntentBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
    return
  }

  const { name } = parsed.data
  const userRole = req.auth!.role as Role

  const action = findAction(name)
  if (!action) {
    res.status(404).json({ error: 'unknown_canvas', name })
    return
  }

  if (!action.allowedRoles.includes(userRole)) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  res.json({ ok: true, name })
})
```

- [ ] **Step 4: Run ALL api tests to confirm no regressions**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter api test --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass (voice + existing ai + auth + etc.).

- [ ] **Step 5: Commit**

```bash
cd /Users/adityeahspare/Documents/GPCB
git add apps/api/src/voice/router.ts apps/api/src/voice/router.test.ts
git commit -m "feat(api/voice): POST /api/voice/canvas-intent — role-gated canvas open signal"
```

---

## Task 5 — Frontend: CallProvider context

**Files:**
- Create: `apps/web/src/context/CallProvider.tsx`

This is the most complex piece. It owns the entire WebRTC lifecycle. Read it carefully before editing any other files.

- [ ] **Step 1: Create CallProvider.tsx**

```typescript
// apps/web/src/context/CallProvider.tsx
/**
 * CallProvider — owns the OpenAI Realtime WebRTC call lifecycle.
 *
 * Exposes:
 *  isInCall       — true once RTCPeerConnection is connected
 *  isConnecting   — true while SDP negotiation in flight
 *  isMuted        — mic muted
 *  peerStatus     — RTCPeerConnectionState string
 *  transcripts    — last 20 lines of {role, text}
 *  startCall(opts?) — begins the call (optional contextHint)
 *  endCall()       — tears down peer connection
 *  toggleMute()    — toggles mic track enabled flag
 *
 * Placement in tree: inside AuthProvider + ChatProvider
 * (needs useAuth for the API token and useChat for openCanvas)
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api.js'
import { useAuth } from './AuthContext.js'
import { useChat } from './ChatContext.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TranscriptLine {
  role: 'user' | 'assistant'
  text: string
  id: string
}

interface StartCallOptions {
  /** Optional hint appended to system prompt, e.g. current canvas context */
  contextHint?: string
}

interface SessionResponse {
  client_secret: { value: string }
  model: string
  expires_at: number
  id?: string
}

interface CallContextValue {
  isInCall: boolean
  isConnecting: boolean
  isMuted: boolean
  peerStatus: RTCPeerConnectionState | 'new'
  transcripts: TranscriptLine[]
  startCall: (opts?: StartCallOptions) => Promise<void>
  endCall: () => void
  toggleMute: () => void
}

const Ctx = createContext<CallContextValue | null>(null)

const REALTIME_URL = 'https://api.openai.com/v1/realtime'
const REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17'
const MAX_TRANSCRIPTS = 20

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function CallProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const { openCanvas } = useChat()

  const [isInCall, setIsInCall] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [peerStatus, setPeerStatus] = useState<RTCPeerConnectionState | 'new'>('new')
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([])

  // Refs — mutable without re-renders
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  // Accumulate assistant delta text until 'done'
  const assistantDeltaRef = useRef<string>('')

  // ── Transcript helpers ────────────────────────────────────────────────────

  function appendTranscript(role: 'user' | 'assistant', text: string) {
    if (!text.trim()) return
    setTranscripts((prev) => {
      const line: TranscriptLine = { role, text, id: makeId() }
      const next = [...prev, line]
      return next.length > MAX_TRANSCRIPTS ? next.slice(-MAX_TRANSCRIPTS) : next
    })
  }

  // ── Data channel event handler ────────────────────────────────────────────

  function handleDataChannelMessage(raw: string) {
    let event: Record<string, unknown>
    try {
      event = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }

    const type = event['type'] as string | undefined

    switch (type) {
      // ── Assistant speech transcript (streamed delta) ──────────────────────
      case 'response.audio_transcript.delta': {
        const delta = event['delta'] as string | undefined
        if (delta) assistantDeltaRef.current += delta
        break
      }
      case 'response.audio_transcript.done': {
        const final = (event['transcript'] as string | undefined) ?? assistantDeltaRef.current
        if (final) appendTranscript('assistant', final)
        assistantDeltaRef.current = ''
        break
      }

      // ── User speech transcript ────────────────────────────────────────────
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = event['transcript'] as string | undefined
        if (transcript) appendTranscript('user', transcript)
        break
      }

      // ── Function call results ─────────────────────────────────────────────
      case 'response.function_call_arguments.done': {
        const name = event['name'] as string | undefined
        const callId = event['call_id'] as string | undefined
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(event['arguments'] as string || '{}') as Record<string, unknown>
        } catch {
          args = {}
        }

        if (name === 'rag_search') {
          void handleRagSearch(callId ?? '', args)
        } else if (name === 'open_canvas') {
          void handleOpenCanvas(callId ?? '', args)
        }
        break
      }

      default:
        break
    }
  }

  // ── RAG search handler ────────────────────────────────────────────────────

  async function handleRagSearch(callId: string, args: Record<string, unknown>) {
    if (!token || !dcRef.current || dcRef.current.readyState !== 'open') return

    const query = (args['query'] as string | undefined) ?? ''
    let passages: Array<{ docId: string; docTitle: string; snippet: string }> = []

    try {
      const result = await api<{ passages: typeof passages }>('/api/voice/rag-search', {
        method: 'POST',
        token,
        body: { query },
      })
      passages = result.passages
    } catch {
      passages = []
    }

    const resultText = passages.length > 0
      ? passages.map((p, i) => `[${i + 1}] ${p.docTitle}: ${p.snippet}`).join('\n')
      : 'No relevant passages found.'

    // Send function result back to the model via data channel
    dcRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: resultText,
      },
    }))

    // Ask the model to generate a response now
    dcRef.current.send(JSON.stringify({ type: 'response.create' }))
  }

  // ── Open canvas handler ───────────────────────────────────────────────────

  async function handleOpenCanvas(callId: string, args: Record<string, unknown>) {
    if (!token || !dcRef.current || dcRef.current.readyState !== 'open') return

    const name = (args['name'] as string | undefined) ?? ''
    const canvasArgs = (args['args'] as Record<string, unknown> | undefined) ?? {}

    let ok = false
    try {
      await api('/api/voice/canvas-intent', {
        method: 'POST',
        token,
        body: { name, args: canvasArgs },
      })
      ok = true
      // Dispatch canvas open in the app
      openCanvas(name, canvasArgs)
    } catch {
      ok = false
    }

    // Return result to the model
    dcRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: ok ? `Opened ${name}` : `Could not open ${name} — permission denied or unknown module.`,
      },
    }))
    dcRef.current.send(JSON.stringify({ type: 'response.create' }))
  }

  // ── startCall ─────────────────────────────────────────────────────────────

  const startCall = useCallback(async (opts?: StartCallOptions) => {
    if (!token || isConnecting || isInCall) return
    setIsConnecting(true)
    setTranscripts([])
    assistantDeltaRef.current = ''

    try {
      // 1. Mint ephemeral session
      const session = await api<SessionResponse>('/api/voice/session', {
        method: 'POST',
        token,
        body: opts?.contextHint ? { contextHint: opts.contextHint } : {},
      })
      const clientSecret = session.client_secret.value

      // 2. Capture microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      // 3. Create RTCPeerConnection
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      pc.onconnectionstatechange = () => {
        setPeerStatus(pc.connectionState)
        if (pc.connectionState === 'connected') {
          setIsInCall(true)
          setIsConnecting(false)
        }
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          setIsInCall(false)
          setIsConnecting(false)
        }
      }

      // 4. Attach remote audio track
      pc.ontrack = (e) => {
        if (!audioRef.current) {
          const el = document.createElement('audio')
          el.autoplay = true
          el.style.display = 'none'
          document.body.appendChild(el)
          audioRef.current = el
        }
        audioRef.current.srcObject = e.streams[0] ?? null
      }

      // 5. Add local audio track
      for (const track of stream.getAudioTracks()) {
        pc.addTrack(track, stream)
      }

      // 6. Open data channel (must be before createOffer)
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onmessage = (e) => handleDataChannelMessage(e.data as string)

      // 7. Create SDP offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // 8. Exchange SDP with OpenAI Realtime endpoint
      const sdpRes = await fetch(`${REALTIME_URL}?model=${REALTIME_MODEL}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })

      if (!sdpRes.ok) {
        throw new Error(`SDP exchange failed: ${sdpRes.status}`)
      }

      const answerSdp = await sdpRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

    } catch (err) {
      console.error('[CallProvider] startCall error', err)
      setIsConnecting(false)
      setIsInCall(false)
      // Clean up partial state
      pcRef.current?.close()
      pcRef.current = null
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
  }, [token, isConnecting, isInCall, openCanvas])

  // ── endCall ───────────────────────────────────────────────────────────────

  const endCall = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    dcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    if (audioRef.current) {
      audioRef.current.srcObject = null
      audioRef.current.remove()
      audioRef.current = null
    }
    setIsInCall(false)
    setIsConnecting(false)
    setIsMuted(false)
    setPeerStatus('new')
    assistantDeltaRef.current = ''
  }, [])

  // ── toggleMute ────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled
    })
    setIsMuted((m) => !m)
  }, [])

  // ── Value ─────────────────────────────────────────────────────────────────

  const value = useMemo<CallContextValue>(
    () => ({
      isInCall,
      isConnecting,
      isMuted,
      peerStatus,
      transcripts,
      startCall,
      endCall,
      toggleMute,
    }),
    [isInCall, isConnecting, isMuted, peerStatus, transcripts, startCall, endCall, toggleMute],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCall(): CallContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCall called outside CallProvider')
  return v
}
```

- [ ] **Step 2: Typecheck the new file**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter web exec tsc --noEmit 2>&1 | head -30
```

Expected: zero errors on `CallProvider.tsx`.

- [ ] **Step 3: Commit**

```bash
cd /Users/adityeahspare/Documents/GPCB
git add apps/web/src/context/CallProvider.tsx
git commit -m "feat(web/call): CallProvider — WebRTC lifecycle + transcript + RAG/canvas data-channel handlers"
```

---

## Task 6 — Frontend: FloatingCallPill component

**Files:**
- Create: `apps/web/src/components/FloatingCallPill.tsx`

- [ ] **Step 1: Create FloatingCallPill.tsx**

```typescript
// apps/web/src/components/FloatingCallPill.tsx
/**
 * FloatingCallPill — fixed bottom-center overlay visible only when isInCall.
 *
 * Layout (left→right):
 *   [pulsing Saathi avatar] [live transcript lines] [Mic/MicOff] [red PhoneOff]
 *
 * Width: 480px on desktop, full-width minus 16px on mobile.
 * z-index: 60 (above CanvasOverlay which is z-20).
 */

import { Mic, MicOff, PhoneOff } from 'lucide-react'
import { useCall } from '../context/CallProvider.js'

export function FloatingCallPill() {
  const { isInCall, isConnecting, isMuted, transcripts, peerStatus, endCall, toggleMute } = useCall()

  if (!isInCall && !isConnecting) return null

  // Show only the most recent 2 transcript lines
  const recent = transcripts.slice(-2)

  const statusLabel = isConnecting
    ? 'Connecting…'
    : peerStatus === 'connected'
      ? 'Live'
      : peerStatus

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-60 flex items-center gap-3 px-4 py-3 rounded-pill bg-white border border-bdr shadow-modal"
      style={{ width: 'min(480px, calc(100vw - 16px))' }}
      role="status"
      aria-live="polite"
    >
      {/* Pulsing avatar */}
      <div className="relative flex-shrink-0 w-9 h-9">
        {/* pulse ring */}
        <span
          className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring"
          aria-hidden="true"
        />
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center relative z-10">
          <span className="text-white text-[11px] font-bold">AI</span>
        </div>
      </div>

      {/* Transcript + status */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">
          Saathi · {statusLabel}
        </div>
        {recent.length === 0 ? (
          <div className="text-[12px] text-txt-tertiary italic">Listening…</div>
        ) : (
          recent.map((line) => (
            <div
              key={line.id}
              className={`text-[12px] leading-snug truncate ${
                line.role === 'user' ? 'text-txt-secondary' : 'text-txt-primary font-medium'
              }`}
            >
              {line.role === 'user' ? 'You: ' : 'Saathi: '}
              {line.text}
            </div>
          ))
        )}
      </div>

      {/* Mute toggle */}
      <button
        type="button"
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition ${
          isMuted
            ? 'bg-warn-light text-warn border border-warn/30'
            : 'bg-surface-page text-txt-secondary hover:bg-surface-secondary border border-bdr-light'
        }`}
        aria-pressed={isMuted}
      >
        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>

      {/* End call */}
      <button
        type="button"
        onClick={endCall}
        title="End call"
        className="w-9 h-9 rounded-full bg-danger text-white flex items-center justify-center flex-shrink-0 hover:bg-red-700 transition"
      >
        <PhoneOff className="w-4 h-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add `z-60` to Tailwind safelist in tailwind.config.ts**

Open `apps/web/tailwind.config.ts`. The `z-60` class is not in the default scale — we need to extend it:

```typescript
// Inside theme.extend, after boxShadow:
zIndex: {
  60: '60',
},
```

The full extend block should contain the new `zIndex` key after `animation`:

```typescript
animation: {
  'slide-in':     'slide-in 240ms ease-out',
  'fade-in':      'fade-in 200ms ease-out',
  'bubble-in':    'bubble-in 200ms ease-out',
  'canvas-slide': 'canvas-slide 300ms ease-out',
  'typing':       'typing 1.2s infinite',
  'pulse-ring':   'pulse-ring 1.6s ease-out infinite',
},
zIndex: {
  60: '60',
},
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter web exec tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/adityeahspare/Documents/GPCB
git add apps/web/src/components/FloatingCallPill.tsx apps/web/tailwind.config.ts
git commit -m "feat(web/call): FloatingCallPill + z-60 Tailwind token"
```

---

## Task 7 — Frontend: CanvasCallButton component

**Files:**
- Create: `apps/web/src/components/CanvasCallButton.tsx`

- [ ] **Step 1: Create CanvasCallButton.tsx**

```typescript
// apps/web/src/components/CanvasCallButton.tsx
/**
 * CanvasCallButton — a small phone-icon button for canvas headers.
 *
 * When clicked it calls startCall() with a contextHint describing the
 * current canvas so the Realtime session is primed with context.
 *
 * Usage:
 *   <CanvasCallButton canvasName="OPEN_WAR_ROOM" canvasLabel="War Room" />
 */

import { Phone } from 'lucide-react'
import { useCall } from '../context/CallProvider.js'

interface CanvasCallButtonProps {
  canvasName: string
  canvasLabel: string
}

export function CanvasCallButton({ canvasName, canvasLabel }: CanvasCallButtonProps) {
  const { startCall, isInCall, isConnecting } = useCall()

  function handleClick() {
    void startCall({
      contextHint: `You are inside the ${canvasLabel} canvas (module: ${canvasName}). The officer is looking at this view. Prefer answering questions relevant to what they see here.`,
    })
  }

  const disabled = isInCall || isConnecting

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? 'Call in progress' : `Talk to Saathi about ${canvasLabel}`}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition disabled:opacity-40 bg-primary text-white hover:bg-primary-dark active:scale-95"
    >
      <Phone className="w-4 h-4" />
    </button>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter web exec tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/adityeahspare/Documents/GPCB
git add apps/web/src/components/CanvasCallButton.tsx
git commit -m "feat(web/call): CanvasCallButton — canvas-context-aware phone button"
```

---

## Task 8 — Frontend: Wire CallProvider + FloatingCallPill into main.tsx

**Files:**
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Update main.tsx**

The current structure is `<AppProvider><AuthProvider><App /></AuthProvider></AppProvider>`. We need `ChatProvider` around `CallProvider` because `CallProvider` calls `useChat`. But `ChatProvider` is currently mounted inside `SuperHomePage`. We must NOT move `ChatProvider` to `main.tsx` (it uses `useAuth` and `useApp` which are already provided). Instead, we need `CallProvider` to go inside `ChatProvider` — and `ChatProvider` is already inside `SuperHomePage`.

The cleanest approach: wrap at the `SuperHomePage` level, not `main.tsx`. But the spec says `main.tsx`. Since `CallProvider` calls both `useAuth` AND `useChat`, and `ChatProvider` lives inside `SuperHomePage`, we'll put `CallProvider` INSIDE `SuperHomePage` right alongside where `ChatProvider` is already declared.

Open `apps/web/src/main.tsx` and replace its contents:

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import { AppProvider } from './context/AppContext.js'
import { AuthProvider } from './context/AuthContext.js'
import './i18n/index.js'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppProvider>
  </React.StrictMode>,
)
```

Note: `main.tsx` stays the same because `CallProvider` must be inside `ChatProvider`. We handle the actual wrapping in `SuperHomePage.tsx` (next task). This is the correct placement.

- [ ] **Step 2: Update SuperHomePage.tsx — wrap Shell with CallProvider**

Open `apps/web/src/pages/SuperHomePage.tsx`. Add the import at the top with other context imports:

```typescript
import { CallProvider } from '../context/CallProvider.js'
import { FloatingCallPill } from '../components/FloatingCallPill.js'
```

Update the `SuperHomePage` export function (currently wraps with `ChatProvider`). Wrap `<Shell />` with `CallProvider` inside `ChatProvider`:

```typescript
export function SuperHomePage() {
  return (
    <ChatProvider>
      <CallProvider>
        <Shell />
        <FloatingCallPill />
      </CallProvider>
    </ChatProvider>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter web exec tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/adityeahspare/Documents/GPCB
git add apps/web/src/main.tsx apps/web/src/pages/SuperHomePage.tsx
git commit -m "feat(web/call): mount CallProvider + FloatingCallPill inside SuperHomePage"
```

---

## Task 9 — Frontend: Wire "Talk to Saathi" button + CanvasCallButton placements

**Files:**
- Modify: `apps/web/src/pages/SuperHomePage.tsx`

Three wiring points:
1. `GreetingPanel` — `onVoice` currently shows a toast. Replace with `startCall()`.
2. `CanvasOverlay` header — add `CanvasCallButton` between title and Maximize2.
3. Top header bar — add `CanvasCallButton` (no canvas context) next to `SaathiQuickButton`.

- [ ] **Step 1: Add CanvasCallButton import**

Already added in Task 8. Confirm it's present:

```typescript
import { CanvasCallButton } from '../components/CanvasCallButton.js'
```

- [ ] **Step 2: Fix GreetingPanel's onVoice prop + ContentArea wiring**

In `ContentArea`, change:

```typescript
// BEFORE
function handleVoice() {
  showToast({ kind: 'info', text: 'Voice coming soon' })
}
```

to:

```typescript
// AFTER — add useCall import at the top of the file
import { useCall } from '../context/CallProvider.js'

// Inside ContentArea:
const { startCall } = useCall()

function handleVoice() {
  void startCall()
}
```

Full updated `ContentArea` function:

```typescript
function ContentArea() {
  const { messages, busy, sendMessage, canvasState } = useChat()
  const { user } = useAuth()
  const { startCall } = useCall()

  const mainChatMessages = messages.filter((m) => !(m as { canvasContext?: string }).canvasContext)
  const greetedView = mainChatMessages.length === 0 && !canvasState.module
  const role = user?.role ?? 'SENIOR_REVIEWER'
  const chips = SUGGESTIONS_BY_ROLE[role] ?? []

  const HIDDEN_FROM_GRID = new Set(['OPEN_INDUSTRY_DEEP_DIVE', 'OPEN_NOTIFICATIONS', 'OPEN_REPORT_EXPORT'])
  const modules: ModuleEntry[] = user
    ? modulesForRole(user.role).filter((m) => !HIDDEN_FROM_GRID.has(m.id))
    : []

  function handleSend(text: string) {
    if (!text.trim() || busy) return
    void sendMessage(text)
  }

  function handleVoice() {
    void startCall()
  }

  return (
    <>
      {greetedView ? (
        <GreetingPanel
          modules={modules}
          chips={chips}
          onSend={handleSend}
          onVoice={handleVoice}
        />
      ) : (
        <ChatThread messages={mainChatMessages} />
      )}
      <MessageInput onSend={handleSend} />
    </>
  )
}
```

- [ ] **Step 3: Add CanvasCallButton in CanvasOverlay header**

Find the header section of `CanvasOverlay` (around line 797 of the original file). The current header looks like:

```typescript
{/* Header */}
<div className="flex items-center gap-3 px-4 py-3 border-b border-bdr-light bg-white flex-shrink-0">
  <button ... ArrowLeft ... />
  <span className="flex-1 ...">{title}</span>
  {/* Maximize / Minimize toggle */}
  <button ... Maximize2/Minimize2 ... />
  <button ... X ... />
</div>
```

Insert the `CanvasCallButton` between the `<span>` and the Maximize toggle:

```typescript
{/* Header */}
<div className="flex items-center gap-3 px-4 py-3 border-b border-bdr-light bg-white flex-shrink-0">
  <button
    type="button"
    onClick={closeCanvas}
    className="w-9 h-9 rounded-xl hover:bg-surface-secondary flex items-center justify-center transition"
    title="Back"
  >
    <ArrowLeft className="w-4 h-4 text-txt-secondary" />
  </button>
  <span className="flex-1 text-[14px] font-bold text-txt-primary truncate">{title}</span>
  {/* Canvas-scoped voice call */}
  {canvasState.module && (
    <CanvasCallButton
      canvasName={canvasState.module}
      canvasLabel={title}
    />
  )}
  {/* Maximize / Minimize toggle */}
  <button
    type="button"
    onClick={() => setExpanded((e) => !e)}
    className="w-9 h-9 rounded-xl hover:bg-surface-secondary flex items-center justify-center transition"
    title={expanded ? 'Restore' : 'Maximize'}
  >
    {expanded
      ? <Minimize2 className="w-4 h-4 text-txt-secondary" />
      : <Maximize2 className="w-4 h-4 text-txt-secondary" />
    }
  </button>
  <button
    type="button"
    onClick={closeCanvas}
    className="w-9 h-9 rounded-xl hover:bg-surface-secondary flex items-center justify-center transition"
    title="Close"
  >
    <X className="w-4 h-4 text-txt-tertiary" />
  </button>
</div>
```

- [ ] **Step 4: Add CanvasCallButton next to SaathiQuickButton in top header bar**

Find the top header bar in `Shell`:

```typescript
<div className="flex items-center gap-2 md:gap-3">
  <SaathiQuickButton />
  <BellButton />
</div>
```

Add a new `VoiceQuickButton` component and use it:

```typescript
function VoiceQuickButton() {
  const { startCall, isInCall, isConnecting } = useCall()
  const disabled = isInCall || isConnecting
  return (
    <button
      type="button"
      onClick={() => { void startCall() }}
      disabled={disabled}
      title={disabled ? 'Call in progress' : 'Talk to Saathi'}
      className="w-9 h-9 rounded-full border border-bdr-light flex items-center justify-center hover:bg-surface-page disabled:opacity-40 transition bg-white"
    >
      <Phone className="w-[17px] h-[17px] text-primary" />
    </button>
  )
}
```

Then in the `Shell` top-bar div:

```typescript
<div className="flex items-center gap-2 md:gap-3">
  <VoiceQuickButton />
  <SaathiQuickButton />
  <BellButton />
</div>
```

- [ ] **Step 5: Typecheck**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter web exec tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 6: Run existing web tests**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter web test --reporter=verbose 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/adityeahspare/Documents/GPCB
git add apps/web/src/pages/SuperHomePage.tsx
git commit -m "feat(web/call): wire Talk to Saathi + CanvasCallButton in overlay header + VoiceQuickButton in top bar"
```

---

## Task 10 — Full typecheck + test suite + prod build

**Files:** No new files. Verification only.

- [ ] **Step 1: Run full typecheck for both packages**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter api exec tsc --noEmit 2>&1 | head -30
npx -y pnpm@9.12.3 --filter web exec tsc --noEmit 2>&1 | head -30
```

Expected: zero errors in both.

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/adityeahspare/Documents/GPCB
npx -y pnpm@9.12.3 --filter api test --reporter=verbose 2>&1 | tail -40
npx -y pnpm@9.12.3 --filter web test --reporter=verbose 2>&1 | tail -20
```

Expected: all existing tests pass; new voice router tests pass.

- [ ] **Step 3: Build prod containers**

```bash
cd /Users/adityeahspare/Documents/GPCB
docker compose --project-name gpcsk-prod --env-file .env.production -f docker-compose.tunnel.yml build api web 2>&1 | tail -30
```

Expected: both images build without errors.

- [ ] **Step 4: Bring prod containers up**

```bash
cd /Users/adityeahspare/Documents/GPCB
docker compose --project-name gpcsk-prod --env-file .env.production -f docker-compose.tunnel.yml up -d api web 2>&1
```

- [ ] **Step 5: Wait 10 seconds and sanity-check health endpoint**

```bash
sleep 10
curl -s https://gpcsk.adityeah.ai/health
```

Expected: `{"status":"ok","ts":<timestamp>}`

- [ ] **Step 6: Sanity-curl the session endpoint (replace TOKEN with a valid SR JWT)**

The test uses `SENIOR_REVIEWER` demo JWT. Obtain one by hitting the demo-login endpoint:

```bash
# Get a demo JWT
SR_JWT=$(curl -s -X POST https://gpcsk.adityeah.ai/api/auth/demo-login \
  -H 'Content-Type: application/json' \
  -d '{"role":"SENIOR_REVIEWER"}' | jq -r '.token')

# Hit the session endpoint
curl -s -X POST https://gpcsk.adityeah.ai/api/voice/session \
  -H "Authorization: Bearer $SR_JWT" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Expected response shape (values differ per run):

```json
{
  "id": "sess_...",
  "model": "gpt-4o-realtime-preview-2024-12-17",
  "client_secret": {
    "value": "ek_live_...",
    "expires_at": 1749...
  },
  "expires_at": 1749...
}
```

If `OPENAI_API_KEY` is not configured in `.env.production`, you will get `{"error":"voice_offline"}` — that is expected and correct offline behaviour.

- [ ] **Step 7: Final commit (if any cleanup changes made during verification)**

```bash
cd /Users/adityeahspare/Documents/GPCB
git status
# commit any remaining tweaks
git add -p
git commit -m "chore(voice): verification fixes after prod smoke test" || true
```

---

## Deferred / Out of scope for v1

- **Video / screen-share** — WebRTC video track not wired (audio only)
- **Chart rendering via voice** — model cannot call `renderChart` over Realtime in v1; text answers only
- **Gujarati/Hindi voice** — `voice: 'alloy'` is English-primary; multilingual TTS deferred
- **Transcript persistence** — transcripts are in-memory only; no DB storage
- **Rate limiting on /api/voice/session** — not added; OpenAI session API has its own rate limits
- **E2E browser call test** — requires human + browser; can't be automated in CI

---

## Self-review checklist

**Spec coverage:**
- [x] POST /api/voice/session — Task 2
- [x] POST /api/voice/rag-search — Task 3
- [x] POST /api/voice/canvas-intent — Task 4
- [x] isAIOnline() / voice_offline guard — Task 2 (`isApiKeyConfigured()` helper)
- [x] contextHint parameter — Task 2 (body schema + instructions concatenation)
- [x] Mount at /api/voice/* — Task 1 (app.ts)
- [x] CallProvider context — Task 5
- [x] RTCPeerConnection + getUserMedia + SDP exchange — Task 5 (`startCall`)
- [x] Data channel event parsing (transcript deltas + function calls) — Task 5
- [x] rag_search function call handler — Task 5 (`handleRagSearch`)
- [x] open_canvas function call handler — Task 5 (`handleOpenCanvas`)
- [x] endCall / toggleMute — Task 5
- [x] FloatingCallPill — Task 6
- [x] CanvasCallButton — Task 7
- [x] main.tsx / SuperHomePage provider wrapping — Task 8
- [x] Wire onVoice in GreetingPanel — Task 9
- [x] CanvasCallButton in CanvasOverlay header — Task 9
- [x] CanvasCallButton/VoiceQuickButton in top bar — Task 9
- [x] Typecheck + tests + prod build — Task 10

**Type consistency:**
- `TranscriptLine` defined in `CallProvider.tsx` with `{role, text, id}` — used only in `FloatingCallPill.tsx` ✓
- `StartCallOptions.contextHint` passed from `CanvasCallButton`, `VoiceQuickButton`, `handleVoice` — all consistent ✓
- `SessionResponse.client_secret.value` consumed in `startCall` — matches OpenAI API shape ✓
- `findAction` from `actionRegistry.ts` imported in `voice/router.ts` — same import as existing ai/router.ts ✓
