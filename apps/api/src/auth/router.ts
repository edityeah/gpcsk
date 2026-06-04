import { Router } from 'express'
import { z } from 'zod'
import { ROLES, type Role } from '@gpcsk/shared'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { isValidDemoOtp } from './otp.js'
import { signToken } from './jwt.js'

const PhoneRequestSchema = z.object({ phone: z.string().regex(/^\d{10}$/) })
const PhoneVerifySchema  = z.object({ phone: z.string().regex(/^\d{10}$/), otp: z.string() })
const XgnCallbackSchema  = z.object({ xgnId: z.string().min(3) })
const DemoLoginSchema    = z.object({ role: z.enum(ROLES) })

export const authRouter = Router()

function issue(userId: string, role: Role): string {
  return signToken({ sub: userId, role }, { secret: env.API_JWT_SECRET, ttlHours: env.API_JWT_TTL_HOURS })
}

authRouter.post('/phone/request-otp', (req, res) => {
  const parsed = PhoneRequestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_phone' })
  return res.json({ status: 'sent' })
})

authRouter.post('/phone/verify-otp', async (req, res) => {
  const parsed = PhoneVerifySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })
  if (!isValidDemoOtp(parsed.data.otp)) return res.status(401).json({ error: 'invalid_otp' })
  const user = await prisma.user.findUnique({ where: { phone: parsed.data.phone } })
  if (!user) return res.status(404).json({ error: 'user_not_found' })
  return res.json({ token: issue(user.id, user.role), user: { id: user.id, name: user.name, role: user.role, region: user.region } })
})

authRouter.post('/xgn/callback', async (req, res) => {
  const parsed = XgnCallbackSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })
  const user = await prisma.user.findUnique({ where: { xgnId: parsed.data.xgnId } })
  if (!user) return res.status(404).json({ error: 'user_not_found' })
  return res.json({ token: issue(user.id, user.role), user: { id: user.id, name: user.name, role: user.role, region: user.region } })
})

authRouter.post('/demo-login', async (req, res) => {
  if (env.NODE_ENV === 'production') return res.status(404).json({ error: 'not_found' })
  const parsed = DemoLoginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_role' })
  const user = await prisma.user.findFirst({ where: { role: parsed.data.role } })
  if (!user) return res.status(404).json({ error: 'no_user_for_role' })
  return res.json({ token: issue(user.id, user.role), user: { id: user.id, name: user.name, role: user.role, region: user.region } })
})
