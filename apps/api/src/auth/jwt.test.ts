import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from './jwt.js'

const SECRET = 'test-secret-at-least-sixteen-bytes'

describe('jwt', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signToken({ sub: 'user_123', role: 'SENIOR_REVIEWER' }, { secret: SECRET, ttlHours: 1 })
    const decoded = verifyToken(token, SECRET)
    expect(decoded.sub).toBe('user_123')
    expect(decoded.role).toBe('SENIOR_REVIEWER')
  })

  it('rejects a token signed with a different secret', () => {
    const token = signToken({ sub: 'u', role: 'CONSENT_OFFICER' }, { secret: SECRET, ttlHours: 1 })
    expect(() => verifyToken(token, 'other-secret-bytes-here-32')).toThrow()
  })

  it('rejects an expired token', () => {
    const token = signToken({ sub: 'u', role: 'CONSENT_OFFICER' }, { secret: SECRET, ttlHours: -1 })
    expect(() => verifyToken(token, SECRET)).toThrow()
  })
})
