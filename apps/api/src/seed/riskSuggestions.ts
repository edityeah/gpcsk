/**
 * RiskBasedSuggestion seed:
 *   - Top 20 industries by risk score → state='SUGGESTED'
 *   - 5 additional → state='DISMISSED' (dismissed history)
 *   - 8 additional → state='CONFIRMED', linked to existing RISK_BASED inspections
 * Total target: 33 rows.
 *
 * Risk score formula mirrors /api/stats/risk-index:
 *   score = clamp(0,100, 30*(exc30d/10) + 15*(comp30d/5) + 10*(openInsp/3) + 20*(consentGapDays>0))
 */
import type { PrismaClient } from '@prisma/client'

function clamp(min: number, val: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

// Minimal deterministic hash for stable ordering tie-breaking
function strHash(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) | 0
  }
  return h >>> 0
}

export async function seedRiskSuggestions(prisma: PrismaClient): Promise<number> {
  // Idempotent: skip if already seeded
  const existing = await prisma.riskBasedSuggestion.count()
  if (existing >= 20) return existing

  const now = new Date()
  const since30d = new Date(now.getTime() - 30 * 86_400_000)

  // Fetch the same raw metrics the risk-index endpoint uses
  const rows = await prisma.$queryRaw<
    Array<{
      industryId: string
      name: string
      exceedance30d: bigint
      complaints30d: bigint
      openInspections: bigint
      consentGapDays: number | null
    }>
  >`
    SELECT
      i.id                                   AS "industryId",
      i.name,
      COALESCE(ex30.cnt, 0)                  AS "exceedance30d",
      COALESCE(comp30.cnt, 0)                AS "complaints30d",
      COALESCE(insp.cnt, 0)                  AS "openInspections",
      CASE
        WHEN cons.max_validity IS NULL THEN NULL
        WHEN cons.max_validity < ${now} THEN
          EXTRACT(EPOCH FROM (${now}::timestamp - cons.max_validity)) / 86400.0
        ELSE NULL
      END AS "consentGapDays"
    FROM "Industry" i
    LEFT JOIN (
      SELECT ms."industryId", COUNT(*)::bigint AS cnt
      FROM   "Exceedance" ex2
      JOIN   "MonitoringStation" ms ON ms.id = ex2."stationId"
      WHERE  ex2."detectedAt" >= ${since30d}
      GROUP  BY ms."industryId"
    ) ex30 ON ex30."industryId" = i.id
    LEFT JOIN (
      SELECT "industryId", COUNT(*)::bigint AS cnt
      FROM   "Complaint"
      WHERE  "receivedAt" >= ${since30d} AND "industryId" IS NOT NULL
      GROUP  BY "industryId"
    ) comp30 ON comp30."industryId" = i.id
    LEFT JOIN (
      SELECT "industryId", COUNT(*)::bigint AS cnt
      FROM   "Inspection"
      WHERE  state = 'SCHEDULED'
      GROUP  BY "industryId"
    ) insp ON insp."industryId" = i.id
    LEFT JOIN (
      SELECT "industryId", MAX("validityTo") AS max_validity
      FROM   "ConsentApplication"
      WHERE  state IN ('APPROVED','RENEWED') AND "validityTo" IS NOT NULL
      GROUP  BY "industryId"
    ) cons ON cons."industryId" = i.id
    ORDER BY i.id
  `

  // Score each row
  const scored = rows.map(r => {
    const exc = Number(r.exceedance30d)
    const comp = Number(r.complaints30d)
    const openInsp = Number(r.openInspections)
    const consentGapDays = r.consentGapDays != null ? Number(r.consentGapDays) : 0

    const excRate = Math.min(exc / 10, 1)
    const compRate = Math.min(comp / 5, 1)
    const inspRate = Math.min(openInsp / 3, 1)
    const consentFlag = consentGapDays > 0 ? 1 : 0

    const riskScore = clamp(0, 100, 30 * excRate + 15 * compRate + 10 * inspRate + 20 * consentFlag)

    return {
      industryId: r.industryId,
      name: r.name,
      riskScore: Math.round(riskScore * 10) / 10,
      breakdown: {
        exceedance30d: exc,
        complaints30d: comp,
        openInspections: openInsp,
        consentGapDays: Math.round(consentGapDays),
      },
    }
  })

  // Sort descending by score, use strHash for stable tie-breaking
  scored.sort((a, b) =>
    b.riskScore !== a.riskScore
      ? b.riskScore - a.riskScore
      : strHash(a.industryId) - strHash(b.industryId)
  )

  // Take top 33 (20 SUGGESTED + 5 DISMISSED + 8 CONFIRMED)
  const top33 = scored.slice(0, 33)
  // Pad if fewer than 33 scored industries (edge case on sparse DB)
  if (top33.length < 33) {
    const rest = scored.slice(top33.length)
    while (top33.length < 33 && rest.length > 0) {
      top33.push(rest.shift()!)
    }
  }

  // Fetch a user to be the decider for DISMISSED/CONFIRMED rows
  const decider = await prisma.user.findFirst({ where: { role: 'SENIOR_REVIEWER' } })
  const decidedById = decider?.id ?? null

  // Fetch RISK_BASED COMPLETED inspections to link to CONFIRMED suggestions
  const riskBasedInspections = await prisma.inspection.findMany({
    where: { inspectionType: 'RISK_BASED', state: 'COMPLETED' },
    select: { id: true, industryId: true },
    take: 8,
  })

  let inserted = 0

  // 1. Top 20 → SUGGESTED
  for (let i = 0; i < Math.min(20, top33.length); i++) {
    const entry = top33[i]!
    await prisma.riskBasedSuggestion.upsert({
      where: { industryId_state: { industryId: entry.industryId, state: 'SUGGESTED' } },
      update: {},
      create: {
        industryId: entry.industryId,
        riskScore: entry.riskScore,
        breakdown: entry.breakdown,
        state: 'SUGGESTED',
      },
    })
    inserted++
  }

  // 2. Next 5 → DISMISSED
  for (let i = 20; i < Math.min(25, top33.length); i++) {
    const entry = top33[i]!
    await prisma.riskBasedSuggestion.upsert({
      where: { industryId_state: { industryId: entry.industryId, state: 'DISMISSED' } },
      update: {},
      create: {
        industryId: entry.industryId,
        riskScore: entry.riskScore,
        breakdown: entry.breakdown,
        state: 'DISMISSED',
        decidedById,
        decidedAt: new Date(now.getTime() - (i - 19) * 3 * 86_400_000),
      },
    })
    inserted++
  }

  // 3. Next 8 → CONFIRMED, linked to RISK_BASED inspections
  for (let i = 25; i < Math.min(33, top33.length); i++) {
    const entry = top33[i]!
    const inspection = riskBasedInspections[i - 25]
    await prisma.riskBasedSuggestion.upsert({
      where: { industryId_state: { industryId: entry.industryId, state: 'CONFIRMED' } },
      update: {},
      create: {
        industryId: entry.industryId,
        riskScore: entry.riskScore,
        breakdown: entry.breakdown,
        state: 'CONFIRMED',
        decidedById,
        decidedAt: new Date(now.getTime() - (i - 24) * 2 * 86_400_000),
        scheduledInspectionId: inspection?.id ?? null,
      },
    })
    inserted++
  }

  return inserted
}
