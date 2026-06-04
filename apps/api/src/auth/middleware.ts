import type { Request, Response, NextFunction } from 'express'
import { ROLES, type Role } from '@gpcsk/shared'
import { verifyToken, type TokenPayload } from './jwt.js'
import { env } from '../env.js'

declare module 'express-serve-static-core' {
  interface Request {
    auth?: TokenPayload
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? ''
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) {
    res.status(401).json({ error: 'missing_token' })
    return
  }
  try {
    const payload = verifyToken(match[1]!, env.API_JWT_SECRET)
    if (!ROLES.includes(payload.role)) {
      res.status(401).json({ error: 'invalid_role' })
      return
    }
    req.auth = payload
    next()
  } catch {
    res.status(401).json({ error: 'invalid_token' })
  }
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'unauthenticated' })
      return
    }
    if (!allowed.includes(req.auth.role)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  }
}
