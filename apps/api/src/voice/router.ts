/**
 * Voice router — three endpoints used by OpenAI Realtime WebRTC sessions.
 *
 * POST /api/voice/session       — mint an ephemeral client_secret (key never leaves server)
 * POST /api/voice/rag-search    — proxy to rag.retrieve for in-call knowledge lookups
 * POST /api/voice/canvas-intent — validate + authorise a canvas open request from the model
 */
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../auth/middleware.js'
import { logger } from '../logger.js'
import { retrieve } from '../ai/rag.js'
import { findAction } from '../ai/actionRegistry.js'
import type { Role } from '@gpcsk/shared'

export const voiceRouter = Router()

// ── Shared helpers ────────────────────────────────────────────────────────────

function isApiKeyConfigured(): boolean {
  const key = process.env['OPENAI_API_KEY'] ?? ''
  return key.length > 0 && key !== 'sk-...' && !key.startsWith('sk-...')
}

// ── System prompt (voice-optimised) ──────────────────────────────────────────

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

// ── Schemas ───────────────────────────────────────────────────────────────────

const SessionBodySchema = z.object({
  contextHint: z.string().max(500).optional(),
})

const RagSearchBodySchema = z.object({
  query: z.string().min(1).max(500),
})

const CanvasIntentBodySchema = z.object({
  name: z.string().min(1),
  args: z.record(z.unknown()).optional().default({}),
})

// ── POST /api/voice/session ────────────────────────────────────────────────────

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

// ── POST /api/voice/rag-search ─────────────────────────────────────────────────

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

// ── POST /api/voice/canvas-intent ─────────────────────────────────────────────

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
