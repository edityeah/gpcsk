import jwt from 'jsonwebtoken'
import type { Role } from '@gpcsk/shared'

export interface TokenPayload {
  sub: string
  role: Role
}

export interface SignOptions {
  secret: string
  ttlHours: number
}

export function signToken(payload: TokenPayload, opts: SignOptions): string {
  return jwt.sign(payload, opts.secret, {
    expiresIn: `${opts.ttlHours}h`,
    algorithm: 'HS256',
  })
}

export function verifyToken(token: string, secret: string): TokenPayload {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload
  if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') {
    throw new Error('invalid_token_payload')
  }
  return { sub: decoded.sub, role: decoded.role as Role }
}
