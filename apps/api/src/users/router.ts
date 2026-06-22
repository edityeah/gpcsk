import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const usersRouter = Router()

usersRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } })
  if (!user) return res.status(404).json({ error: 'user_not_found' })
  return res.json({
    id: user.id, name: user.name, role: user.role, designation: user.designation, region: user.region, phone: user.phone,
  })
})

// GET /api/users?role=INSPECTION_ENFORCEMENT_OFFICER  — list users by role (authenticated)
const UsersQuerySchema = z.object({
  role: z.string().optional(),
})

usersRouter.get('/users', requireAuth, async (req, res) => {
  const parsed = UsersQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }

  const where = parsed.data.role ? { role: parsed.data.role as never } : {}

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, role: true, designation: true, region: true },
    orderBy: { name: 'asc' },
  })

  res.json(users)
})
