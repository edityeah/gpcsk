/**
 * AI message router — POST /api/ai/message
 *
 * Flow:
 *  1. Validate body { threadId?, content, lang? }
 *  2. Create or fetch ChatThread
 *  3. Persist user message
 *  4. gpt-4o with actionRegistry tools + system prompt
 *  5a. Tool call  → validate allowedRoles → return { kind: 'canvas', module, args }
 *  5b. Text reply → rag.retrieve → re-prompt with context → return { kind: 'answer', text, citations }
 *  6. Persist assistant message
 *
 * Also exposes:
 *  GET /api/ai/threads              — current user's thread list
 *  GET /api/ai/threads/:id          — thread + messages (owner-only)
 */

import { Router } from 'express'
import { z } from 'zod'
import OpenAI from 'openai'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { logger } from '../logger.js'
import { buildOpenAiTools, findAction } from './actionRegistry.js'
import { retrieve } from './rag.js'
import type { Role } from '@gpcsk/shared'

export const aiRouter = Router()

// ── Constants ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are GPCSK AI — the intelligent assistant for the Gujarat Pollution Control Samiksha Kendra (GPCSK) platform built by the Gujarat Pollution Control Board (GPCB).

You assist five types of officers: Consent Officers, Monitoring Officers, Inspection & Enforcement Officers, Complaints Officers, and Senior Reviewers. Always address the officer respectfully and in their preferred language.

You can do two things:
1. OPEN A CANVAS MODULE — call the matching tool when the officer asks to see a specific dashboard, queue, map, or report. Always confirm which module you are opening.
2. ANSWER A QUESTION — provide concise, data-backed answers about pollution monitoring, consent regulations, enforcement procedures, CETP performance, OCEMS data, or GPCB policies. Cite relevant documents when available.

Guidelines:
- Never fabricate data. If you do not know, say so and suggest which canvas module to consult.
- Be concise but precise — officers are busy field professionals.
- Prefer the officer's language (lang parameter). If gujarati requested, respond in Gujarati script where natural.
- For enforcement actions, always remind the maker-checker workflow applies.
- Do not reveal internal system details, raw SQL, or embedding mechanics.
- GPCSK modules replace nothing — they layer intelligence on top of XGN, OCEMS, CEQMS, AAQM, and MINARS data.`

// ── OpenAI key check ─────────────────────────────────────────────────────

/**
 * Returns true if the OPENAI_API_KEY looks like a real key (not placeholder).
 * Checked on every request so env changes in tests take effect immediately.
 */
function isApiKeyConfigured(): boolean {
  const apiKey = process.env['OPENAI_API_KEY'] ?? ''
  return apiKey.length > 0 && apiKey !== 'sk-...' && !apiKey.startsWith('sk-...')
}

/**
 * Create a fresh OpenAI client each call.
 * In production the overhead is negligible (module is cached by Node).
 * In tests the mock intercepts the constructor fresh each time.
 */
function makeOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] ?? '' })
}

// ── Schemas ────────────────────────────────────────────────────────────────

const MessageBodySchema = z.object({
  threadId: z.string().optional(),
  content: z.string().min(1).max(4000),
  lang: z.enum(['en', 'gu', 'hi']).optional().default('en'),
})

// ── POST /api/ai/message ───────────────────────────────────────────────────

aiRouter.post('/message', requireAuth, async (req, res) => {
  const parsed = MessageBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
    return
  }

  const { threadId: existingThreadId, content, lang } = parsed.data
  const userId = req.auth!.sub
  const userRole = req.auth!.role as Role

  // ── Graceful offline check ─────────────────────────────────────────────
  if (!isApiKeyConfigured()) {
    res.json({
      kind: 'answer',
      text: 'AI is offline — set OPENAI_API_KEY in .env and restart.',
      citations: [],
    })
    return
  }

  const openai = makeOpenAI()

  try {
    // ── 1. Create or fetch thread ────────────────────────────────────────
    let threadId = existingThreadId

    if (threadId) {
      const thread = await prisma.chatThread.findUnique({
        where: { id: threadId },
        select: { id: true, userId: true },
      })
      if (!thread || thread.userId !== userId) {
        res.status(404).json({ error: 'thread_not_found' })
        return
      }
    } else {
      // Create new thread; use first 60 chars of content as title
      const thread = await prisma.chatThread.create({
        data: {
          userId,
          title: content.slice(0, 60),
        },
      })
      threadId = thread.id
    }

    // ── 2. Persist user message ──────────────────────────────────────────
    await prisma.chatMessage.create({
      data: {
        threadId,
        role: 'user',
        content,
      },
    })

    // Update thread lastMessageAt
    await prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    })

    // ── 3. Build tools for this role ────────────────────────────────────
    const tools = buildOpenAiTools(userRole)

    // ── 4. Initial gpt-4o call with tools ───────────────────────────────
    const systemContent =
      lang === 'gu'
        ? `${SYSTEM_PROMPT}\n\nThe officer prefers Gujarati (gu). Respond in Gujarati where natural.`
        : lang === 'hi'
          ? `${SYSTEM_PROMPT}\n\nThe officer prefers Hindi (hi). Respond in Hindi where natural.`
          : SYSTEM_PROMPT

    const firstResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content },
      ],
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      max_tokens: 1024,
    })

    const firstChoice = firstResponse.choices[0]
    if (!firstChoice) {
      throw new Error('No response from OpenAI')
    }

    // ── 5a. Tool call path ───────────────────────────────────────────────
    if (firstChoice.finish_reason === 'tool_calls' && firstChoice.message.tool_calls) {
      const toolCall = firstChoice.message.tool_calls[0]
      if (!toolCall) {
        throw new Error('tool_calls present but empty')
      }

      const actionName = toolCall.function.name
      const action = findAction(actionName)

      // Validate allowedRoles
      if (!action || !action.allowedRoles.includes(userRole)) {
        logger.warn({ actionName, userRole }, 'ai/message — tool call blocked: role not allowed')

        const blockedText = 'Sorry, you do not have permission to open that module.'
        await prisma.chatMessage.create({
          data: { threadId, role: 'assistant', content: blockedText },
        })
        await prisma.chatThread.update({
          where: { id: threadId },
          data: { lastMessageAt: new Date() },
        })

        res.json({ kind: 'answer', text: blockedText, citations: [], threadId })
        return
      }

      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>
      } catch {
        args = {}
      }

      // Persist assistant message (record the tool call)
      await prisma.chatMessage.create({
        data: {
          threadId,
          role: 'assistant',
          content: `Opening ${actionName}`,
          toolCalls: [{ name: actionName, args }] as unknown as Prisma.InputJsonValue,
        },
      })
      await prisma.chatThread.update({
        where: { id: threadId },
        data: { lastMessageAt: new Date() },
      })

      res.json({ kind: 'canvas', module: actionName, args, threadId })
      return
    }

    // ── 5b. Text answer path with RAG ───────────────────────────────────
    const firstText = firstChoice.message.content ?? ''

    // Retrieve relevant knowledge chunks
    const chunks = await retrieve(content, 5)

    let finalText = firstText
    const citations: Array<{ docId: string; docTitle: string; snippet: string }> = []

    if (chunks.length > 0) {
      // Build RAG context
      const ragContext = chunks
        .map((c, i) => `[${i + 1}] ${c.docTitle}:\n${c.snippet}`)
        .join('\n\n')

      citations.push(
        ...chunks.map((c) => ({
          docId: c.docId,
          docTitle: c.docTitle,
          snippet: c.snippet,
        })),
      )

      // Re-prompt with retrieved context
      try {
        const ragResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content },
            {
              role: 'system',
              content: `Relevant knowledge base context:\n\n${ragContext}\n\nUsing the context above where relevant, provide your final answer. Cite source numbers like [1], [2] when referencing the context.`,
            },
          ],
          max_tokens: 1024,
        })

        const ragChoice = ragResponse.choices[0]
        if (ragChoice?.message.content) {
          finalText = ragChoice.message.content
        }
      } catch (ragErr: unknown) {
        // If RAG re-prompt fails, use first response text
        logger.warn({ err: ragErr }, 'ai/message — RAG re-prompt failed, using first response')
      }
    }

    // Persist assistant message
    await prisma.chatMessage.create({
      data: {
        threadId,
        role: 'assistant',
        content: finalText,
      },
    })
    await prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    })

    res.json({ kind: 'answer', text: finalText, citations, threadId })
  } catch (err: unknown) {
    logger.error({ err }, 'ai/message — unhandled error')
    res.status(500).json({ error: 'ai_error', message: 'Failed to process AI request' })
  }
})

// ── GET /api/ai/threads ────────────────────────────────────────────────────

aiRouter.get('/threads', requireAuth, async (req, res) => {
  const userId = req.auth!.sub

  const threads = await prisma.chatThread.findMany({
    where: { userId },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      createdAt: true,
      lastMessageAt: true,
      _count: { select: { messages: true } },
    },
  })

  res.json({ threads })
})

// ── GET /api/ai/threads/:id ────────────────────────────────────────────────

aiRouter.get('/threads/:id', requireAuth, async (req, res) => {
  const userId = req.auth!.sub
  const threadId = req.params['id']

  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          toolCalls: true,
          createdAt: true,
        },
      },
    },
  })

  if (!thread) {
    res.status(404).json({ error: 'thread_not_found' })
    return
  }

  // Owner-only access
  if (thread.userId !== userId) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  res.json(thread)
})
