/**
 * AI message router — POST /api/ai/message
 *
 * Flow:
 *  1. Validate body { threadId?, content, lang? }
 *  2. Create or fetch ChatThread
 *  3. Persist user message
 *  4. gpt-4o with actionRegistry tools + data tools + system prompt
 *  5a. Canvas tool call → return { kind: 'canvas', module, args }
 *  5b. Data query tool call → run DB query, return results to model (up to 4 iterations)
 *  5c. renderChart tool call → return { kind: 'chart', spec: {...} }
 *  5d. Text reply → rag.retrieve → re-prompt with context → return { kind: 'answer', text, citations }
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
import { buildOpenAiTools, findAction, dataTools, type ChartSpec } from './actionRegistry.js'
import { retrieve } from './rag.js'
import type { Role } from '@gpcsk/shared'

export const aiRouter = Router()

// ── Constants ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are GPCSK AI — the intelligent assistant for the Gujarat Pollution Control Samiksha Kendra (GPCSK) platform built by the Gujarat Pollution Control Board (GPCB).

You assist five types of officers: Consent Officers, Monitoring Officers, Inspection & Enforcement Officers, Complaints Officers, and Senior Reviewers. Always address the officer respectfully and in their preferred language.

You can do three things:
1. OPEN A CANVAS MODULE — call the matching tool when the officer asks to see a specific dashboard, queue, map, or report. Always confirm which module you are opening.
2. ANSWER A QUESTION — provide concise, data-backed answers about pollution monitoring, consent regulations, enforcement procedures, CETP performance, OCEMS data, or GPCB policies. Cite relevant documents when available.
3. RENDER A CHART — when the user asks for trends, top-N rankings, breakdowns, or comparisons:
   a. First call a data query tool (queryTopPollutingIndustries, queryExceedanceTrend, querySensorReadingTrend, queryComplaintsByCategory, queryEnforcementByState, or queryCetpScorecard) to get REAL numbers from the database.
   b. Then call renderChart with the data returned. NEVER fabricate chart data. If no query tool covers the data needed, answer in text and explain what data would be required.

Guidelines:
- Never fabricate data. If you do not know, say so and suggest which canvas module to consult.
- Be concise but precise — officers are busy field professionals.
- Prefer the officer's language (lang parameter). If gujarati requested, respond in Gujarati script where natural.
- For enforcement actions, always remind the maker-checker workflow applies.
- Do not reveal internal system details, raw SQL, or embedding mechanics.
- GPCSK modules replace nothing — they layer intelligence on top of XGN, OCEMS, CEQMS, AAQM, and MINARS data.`

const MAX_TOOL_ITERATIONS = 4

// ── OpenAI key check ─────────────────────────────────────────────────────

function isApiKeyConfigured(): boolean {
  const apiKey = process.env['OPENAI_API_KEY'] ?? ''
  return apiKey.length > 0 && apiKey !== 'sk-...' && !apiKey.startsWith('sk-...')
}

function makeOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] ?? '' })
}

// ── Schemas ────────────────────────────────────────────────────────────────

const MessageBodySchema = z.object({
  threadId: z.string().optional(),
  content: z.string().min(1).max(4000),
  lang: z.enum(['en', 'gu', 'hi']).optional().default('en'),
  /** Canvas module id that originated this message — stored in toolCalls for client-side filtering */
  canvasContext: z.string().optional(),
})

// ── Data query handlers ────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

async function handleDataTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    case 'queryTopPollutingIndustries': {
      const district = args['district'] as string | undefined
      const limit = Math.min(Number(args['limit'] ?? 10), 20)
      const since30d = daysAgo(30)

      const rows = await prisma.$queryRaw<
        Array<{
          industryId: string
          name: string
          district: string | null
          exceedance30d: bigint
          riskScore: number
        }>
      >`
        SELECT
          i.id                               AS "industryId",
          i.name,
          dist.name                          AS district,
          COALESCE(ex30.cnt, 0)              AS "exceedance30d",
          LEAST(100, COALESCE(ex30.cnt, 0) * 3 + COALESCE(comp30.cnt, 0) * 5) AS "riskScore"
        FROM "Industry" i
        LEFT JOIN "District" dist ON dist.id = i."districtId"
        LEFT JOIN (
          SELECT ms."industryId", COUNT(*)::bigint AS cnt
          FROM   "Exceedance" ex2
          JOIN   "MonitoringStation" ms ON ms.id = ex2."stationId"
          WHERE  ex2."detectedAt" >= ${since30d}
          GROUP  BY ms."industryId"
        ) ex30 ON ex30."industryId" = i.id
        LEFT JOIN (
          SELECT "industryId", COUNT(*)::bigint AS cnt
          FROM   "Complaint"
          WHERE  "receivedAt" >= ${since30d} AND "industryId" IS NOT NULL
          GROUP  BY "industryId"
        ) comp30 ON comp30."industryId" = i.id
        WHERE COALESCE(ex30.cnt, 0) + COALESCE(comp30.cnt, 0) > 0
          ${district ? Prisma.sql`AND dist.name ILIKE ${'%' + district + '%'}` : Prisma.sql``}
        ORDER BY "riskScore" DESC
        LIMIT ${limit}
      `
      return rows.map((r) => ({
        industryId: r.industryId,
        name: r.name,
        district: r.district,
        exceedanceCount30d: Number(r.exceedance30d),
        riskScore: Number(r.riskScore),
      }))
    }

    case 'queryExceedanceTrend': {
      const parameter = args['parameter'] as string | undefined
      const days = Math.min(Number(args['days'] ?? 30), 90)
      const stationId = args['stationId'] as string | undefined
      const industryId = args['industryId'] as string | undefined
      const since = daysAgo(days)

      const rows = await prisma.$queryRaw<
        Array<{ date: Date; exceedanceCount: bigint }>
      >`
        SELECT
          DATE_TRUNC('day', ex."detectedAt")::date  AS date,
          COUNT(*)::bigint                           AS "exceedanceCount"
        FROM "Exceedance" ex
        JOIN "MonitoringStation" ms ON ms.id = ex."stationId"
        WHERE ex."detectedAt" >= ${since}
          ${parameter ? Prisma.sql`AND ex.parameter ILIKE ${'%' + parameter + '%'}` : Prisma.sql``}
          ${stationId ? Prisma.sql`AND ex."stationId" = ${stationId}` : Prisma.sql``}
          ${industryId ? Prisma.sql`AND ms."industryId" = ${industryId}` : Prisma.sql``}
        GROUP BY DATE_TRUNC('day', ex."detectedAt")
        ORDER BY date ASC
      `
      return rows.map((r) => ({
        date: r.date.toISOString().split('T')[0],
        exceedanceCount: Number(r.exceedanceCount),
      }))
    }

    case 'querySensorReadingTrend': {
      const stationId = args['stationId'] as string
      const parameter = args['parameter'] as string
      const days = Math.min(Number(args['days'] ?? 30), 90)
      const since = daysAgo(days)

      const rows = await prisma.$queryRaw<
        Array<{ date: Date; avgValue: number; unit: string }>
      >`
        SELECT
          DATE_TRUNC('day', timestamp)::date  AS date,
          AVG(value)::float                   AS "avgValue",
          MAX(unit)                           AS unit
        FROM "SensorReading"
        WHERE "stationId" = ${stationId}
          AND parameter ILIKE ${'%' + parameter + '%'}
          AND timestamp >= ${since}
          AND validity != 'MISSING'
        GROUP BY DATE_TRUNC('day', timestamp)
        ORDER BY date ASC
      `
      return rows.map((r) => ({
        date: r.date.toISOString().split('T')[0],
        avgValue: Math.round(r.avgValue * 100) / 100,
        unit: r.unit,
      }))
    }

    case 'queryComplaintsByCategory': {
      const days = Math.min(Number(args['days'] ?? 30), 365)
      const since = daysAgo(days)

      const rows = await prisma.complaint.groupBy({
        by: ['category'],
        _count: { id: true },
        where: { receivedAt: { gte: since } },
        orderBy: { _count: { id: 'desc' } },
      })
      return rows.map((r) => ({
        category: r.category,
        count: r._count.id,
      }))
    }

    case 'queryEnforcementByState': {
      const rows = await prisma.enforcementAction.groupBy({
        by: ['state'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      })
      return rows.map((r) => ({
        state: r.state,
        count: r._count.id,
      }))
    }

    case 'queryCetpScorecard': {
      const district = args['district'] as string | undefined

      // Get latest monitoring reports for CETPs
      const cetps = await prisma.cetp.findMany({
        where: district ? { district: { contains: district, mode: 'insensitive' } } : undefined,
        select: {
          id: true,
          name: true,
          district: true,
          reports: {
            orderBy: { monthOf: 'desc' },
            take: 1,
            select: {
              observedFinal: true,
              finalEffluentStds: true,
              monthOf: true,
            },
          },
        },
        take: 20,
      })

      // Flatten to per-CETP per-parameter latest value
      const results: Array<{
        cetpName: string
        district: string | null
        parameter: string
        latestValue: number
        norm: number | null
        unit: string
      }> = []

      for (const cetp of cetps) {
        const latestReport = cetp.reports[0]
        if (!latestReport) continue

        const observed = latestReport.observedFinal as Record<string, { value: number; unit: string }>
        const stds = latestReport.finalEffluentStds as Record<string, { value: number; unit: string }>

        for (const [param, obs] of Object.entries(observed)) {
          if (!obs || typeof obs.value !== 'number') continue
          const std = stds[param]
          results.push({
            cetpName: cetp.name,
            district: cetp.district,
            parameter: param,
            latestValue: Math.round(obs.value * 10) / 10,
            norm: std ? Math.round(std.value * 10) / 10 : null,
            unit: obs.unit ?? '',
          })
        }
      }
      return results
    }

    default:
      return { error: `Unknown data tool: ${toolName}` }
  }
}

// ── POST /api/ai/message ───────────────────────────────────────────────────

aiRouter.post('/message', requireAuth, async (req, res) => {
  const parsed = MessageBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
    return
  }

  const { threadId: existingThreadId, content, lang, canvasContext } = parsed.data
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
        // Store canvasContext in toolCalls JSON so the client can filter canvas-scoped messages
        ...(canvasContext
          ? { toolCalls: [{ canvasContext }] as unknown as Prisma.InputJsonValue }
          : {}),
      },
    })
    await prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    })

    // ── 3. Build tools ────────────────────────────────────────────────
    const canvasTools = buildOpenAiTools(userRole)
    const allTools = [...canvasTools, ...dataTools]

    // ── 4. Build system content ──────────────────────────────────────────
    const systemContent =
      lang === 'gu'
        ? `${SYSTEM_PROMPT}\n\nThe officer prefers Gujarati (gu). Respond in Gujarati where natural.`
        : lang === 'hi'
          ? `${SYSTEM_PROMPT}\n\nThe officer prefers Hindi (hi). Respond in Hindi where natural.`
          : SYSTEM_PROMPT

    // ── 5. Multi-step tool loop ──────────────────────────────────────────
    // Build initial message list
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content },
    ]

    let iterations = 0
    let chartSpec: ChartSpec | null = null

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: allTools.length > 0 ? allTools : undefined,
        tool_choice: allTools.length > 0 ? 'auto' : undefined,
        max_tokens: 1024,
      })

      const choice = response.choices[0]
      if (!choice) throw new Error('No response from OpenAI')

      // Add assistant message to context
      messages.push(choice.message)

      // ── No tool call — text answer ──────────────────────────────────
      if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) {
        const firstText = choice.message.content ?? ''

        // RAG augmentation
        const chunks = await retrieve(content, 5)
        let finalText = firstText
        const citations: Array<{ docId: string; docTitle: string; snippet: string }> = []

        if (chunks.length > 0) {
          const ragContext = chunks
            .map((c, i) => `[${i + 1}] ${c.docTitle}:\n${c.snippet}`)
            .join('\n\n')

          citations.push(...chunks.map((c) => ({
            docId: c.docId,
            docTitle: c.docTitle,
            snippet: c.snippet,
          })))

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
            logger.warn({ err: ragErr }, 'ai/message — RAG re-prompt failed, using first response')
          }
        }

        await prisma.chatMessage.create({
          data: { threadId, role: 'assistant', content: finalText },
        })
        await prisma.chatThread.update({
          where: { id: threadId },
          data: { lastMessageAt: new Date() },
        })

        res.json({ kind: 'answer', text: finalText, citations, threadId })
        return
      }

      // ── Tool calls ──────────────────────────────────────────────────
      const toolCallResults: OpenAI.ChatCompletionToolMessageParam[] = []

      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name
        let toolArgs: Record<string, unknown> = {}
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>
        } catch {
          toolArgs = {}
        }

        // ── Canvas action ───────────────────────────────────────────
        if (toolName.startsWith('OPEN_')) {
          const action = findAction(toolName)
          if (!action || !action.allowedRoles.includes(userRole)) {
            logger.warn({ toolName, userRole }, 'ai/message — canvas tool blocked: role not allowed')
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

          await prisma.chatMessage.create({
            data: {
              threadId,
              role: 'assistant',
              content: `Opening ${toolName}`,
              toolCalls: [{ name: toolName, args: toolArgs }] as unknown as Prisma.InputJsonValue,
            },
          })
          await prisma.chatThread.update({
            where: { id: threadId },
            data: { lastMessageAt: new Date() },
          })

          res.json({ kind: 'canvas', module: toolName, args: toolArgs, threadId })
          return
        }

        // ── renderChart ─────────────────────────────────────────────
        if (toolName === 'renderChart') {
          chartSpec = toolArgs as unknown as ChartSpec

          await prisma.chatMessage.create({
            data: {
              threadId,
              role: 'assistant',
              content: chartSpec.title ?? 'Chart',
              toolCalls: [{ name: 'renderChart', spec: chartSpec }] as unknown as Prisma.InputJsonValue,
            },
          })
          await prisma.chatThread.update({
            where: { id: threadId },
            data: { lastMessageAt: new Date() },
          })

          res.json({ kind: 'chart', spec: chartSpec, threadId })
          return
        }

        // ── Data query tool ─────────────────────────────────────────
        logger.info({ toolName, toolArgs }, 'ai/message — executing data tool')
        try {
          const result = await handleDataTool(toolName, toolArgs)
          toolCallResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          })
        } catch (err: unknown) {
          logger.warn({ err, toolName }, 'ai/message — data tool error')
          toolCallResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: String(err) }),
          })
        }
      }

      // Add tool results to message context for the next iteration
      messages.push(...toolCallResults)
    }

    // If we exhausted iterations without a final answer, give a text fallback
    logger.warn({ iterations }, 'ai/message — exhausted tool iterations')
    const fallbackText = 'I was unable to complete the request within the allowed steps. Please try rephrasing your question.'
    await prisma.chatMessage.create({
      data: { threadId, role: 'assistant', content: fallbackText },
    })
    await prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    })
    res.json({ kind: 'answer', text: fallbackText, citations: [], threadId })

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

  if (thread.userId !== userId) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  res.json(thread)
})
