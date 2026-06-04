import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { writeAudit } from './service.js'

beforeAll(async () => {
  await seedDemoUsers(prisma)
})

afterAll(async () => prisma.$disconnect())

describe('writeAudit', () => {
  it('persists an audit row with before/after JSON', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { role: 'SENIOR_REVIEWER' } })
    const row = await writeAudit({
      actorId: user.id,
      entity: 'ConsentApplication',
      entityId: 'cons_test_1',
      action: 'APPROVED',
      before: { state: 'PENDING_REVIEW' },
      after: { state: 'COMMITTED' },
      reason: 'docs in order',
    })
    expect(row.id).toBeTruthy()
    const persisted = await prisma.auditLog.findUniqueOrThrow({ where: { id: row.id } })
    expect(persisted.action).toBe('APPROVED')
    expect((persisted.after as { state: string }).state).toBe('COMMITTED')
  })
})
