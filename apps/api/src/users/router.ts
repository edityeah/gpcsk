import { Router } from 'express'
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
