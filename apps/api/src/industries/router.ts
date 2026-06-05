import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const industriesRouter = Router()

const ListQuerySchema = z.object({
  districtId:  z.string().optional(),
  sectorId:    z.string().optional(),
  category:    z.enum(['RED', 'ORANGE', 'GREEN', 'WHITE']).optional(),
  gidcZoneId:  z.string().optional(),
  q:           z.string().optional(),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
  cursor:      z.string().optional(),
})

industriesRouter.get('/', requireAuth, async (req, res) => {
  const parsed = ListQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() })
    return
  }
  const { districtId, sectorId, category, gidcZoneId, q, limit, cursor } = parsed.data

  const where: Parameters<typeof prisma.industry.findMany>[0]['where'] = {}
  if (districtId)  where.districtId  = districtId
  if (sectorId)    where.sectorId    = sectorId
  if (category)    where.category    = category
  if (gidcZoneId)  where.gidcZoneId  = gidcZoneId
  if (q) {
    where.OR = [
      { name:     { contains: q, mode: 'insensitive' } },
      { ucNumber: { contains: q, mode: 'insensitive' } },
    ]
  }

  const items = await prisma.industry.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { name: 'asc' },
    include: {
      sector:   { select: { code: true, name: true } },
      district: { select: { code: true, name: true } },
      gidcZone: { select: { name: true } },
    },
  })

  let nextCursor: string | undefined
  if (items.length > limit) {
    nextCursor = items[limit]!.id
    items.splice(limit)
  }

  res.json({ items, nextCursor })
})

industriesRouter.get('/:id', requireAuth, async (req, res) => {
  const industry = await prisma.industry.findUnique({
    where: { id: req.params['id'] },
    include: {
      sector:   { select: { code: true, name: true } },
      district: { select: { code: true, name: true } },
      taluka:   { select: { name: true } },
      gidcZone: { select: { name: true } },
    },
  })
  if (!industry) {
    res.status(404).json({ error: 'industry_not_found' })
    return
  }

  const [recentViolations, activeConsents, recentExceedances, recentComplaints] = await Promise.all([
    prisma.violation.findMany({
      where:   { industryId: industry.id },
      orderBy: { detectedAt: 'desc' },
      take:    10,
      select:  { id: true, parameter: true, severity: true, source: true, detectedAt: true, dispositionState: true, observedValue: true, normValue: true, unit: true },
    }),
    prisma.consentApplication.findMany({
      where:   { industryId: industry.id, state: { in: ['APPROVED', 'UNDER_REVIEW', 'RECOMMENDED'] } },
      orderBy: { updatedAt: 'desc' },
      select:  { id: true, type: true, state: true, validityFrom: true, validityTo: true, submittedAt: true },
    }),
    prisma.exceedance.findMany({
      where:   { station: { industryId: industry.id } },
      orderBy: { detectedAt: 'desc' },
      take:    10,
      select:  { id: true, parameter: true, observedValue: true, normValue: true, severity: true, detectedAt: true, dispositionState: true },
    }),
    prisma.complaint.findMany({
      where:   { industryId: industry.id },
      orderBy: { receivedAt: 'desc' },
      take:    5,
      select:  { id: true, category: true, severity: true, state: true, receivedAt: true, description: true },
    }),
  ])

  res.json({ industry, recentViolations, activeConsents, recentExceedances, recentComplaints })
})
