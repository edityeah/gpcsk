import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { writeAudit } from '../audit/service.js'

export const broadcastsRouter = Router()

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  title:    z.string().min(1).max(200),
  body:     z.string().min(1).max(5000),
  audience: z.array(z.string()).min(1),
})

// ── GET /api/broadcasts — list recent broadcasts ──────────────────────────────

broadcastsRouter.get('/', requireAuth, async (_req, res) => {
  const items = await prisma.broadcast.findMany({
    orderBy: { sentAt: 'desc' },
    take: 50,
    include: {
      sentBy: { select: { id: true, name: true, role: true } },
    },
  })
  res.json({ items })
})

// ── POST /api/broadcasts — compose and send — SENIOR_REVIEWER only ────────────

broadcastsRouter.post(
  '/',
  requireAuth,
  requireRole('SENIOR_REVIEWER'),
  async (req, res) => {
    const parsed = CreateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
      return
    }

    const { title, body, audience } = parsed.data
    const actorId = req.auth!.sub

    const broadcast = await prisma.broadcast.create({
      data: {
        title,
        body,
        audience,
        sentById: actorId,
      },
      include: {
        sentBy: { select: { id: true, name: true, role: true } },
      },
    })

    await writeAudit({
      actorId,
      entity: 'Broadcast',
      entityId: broadcast.id,
      action: 'SENT',
      before: null as never,
      after: { title, audience } as never,
      reason: `Broadcast sent to audience: ${audience.join(', ')}`,
    })

    res.status(201).json(broadcast)
  },
)
