/**
 * Notifications router
 *
 * GET   /api/notifications          – list notifications for authenticated user (desc by createdAt)
 * PATCH /api/notifications/:id/read – mark a notification as read
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const notificationsRouter = Router()

// ── GET /api/notifications ─────────────────────────────────────────────────

const ListQuerySchema = z.object({
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
})

notificationsRouter.get('/', requireAuth, async (req, res) => {
  const parsed = ListQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }

  const { unreadOnly, limit, cursor } = parsed.data
  const userId = req.auth!.sub

  const where: Parameters<typeof prisma.notification.findMany>[0]['where'] = {
    userId,
    ...(unreadOnly ? { readAt: null } : {}),
    ...(cursor ? { id: { lt: cursor } } : {}),
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  })

  let nextCursor: string | undefined
  if (notifications.length > limit) {
    nextCursor = notifications[limit]!.id
    notifications.splice(limit)
  }

  res.json({ notifications, nextCursor })
})

// ── PATCH /api/notifications/:id/read ─────────────────────────────────────

notificationsRouter.patch('/:id/read', requireAuth, async (req, res) => {
  const { id } = req.params
  const userId = req.auth!.sub

  const notification = await prisma.notification.findUnique({ where: { id } })

  if (!notification) {
    res.status(404).json({ error: 'notification_not_found' })
    return
  }

  if (notification.userId !== userId) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  if (notification.readAt) {
    // Already read — return as-is (idempotent)
    res.json(notification)
    return
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  })

  res.json(updated)
})
