import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

export interface AuditInput {
  actorId: string
  entity: string
  entityId: string
  action: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
  reason?: string
}

export async function writeAudit(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      before: input.before ?? Prisma.JsonNull,
      after: input.after ?? Prisma.JsonNull,
      reason: input.reason,
    },
  })
}
