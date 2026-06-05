import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const cetpsRouter = Router()

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Given an array of up to 12 monthly COD/BOD final-effluent values (newest last),
 * compute the 3-month trailing average of the most recent 3 entries and express
 * the latest month as a trend percentage vs that average.
 *
 * Returns null when there are fewer than 4 reports (not enough data for a
 * meaningful trend).
 */
function trendPct(values: number[]): number | null {
  if (values.length < 4) return null
  const recent = values.slice(-4)                // last 4 months
  const avg3   = (recent[0]! + recent[1]! + recent[2]!) / 3   // 3-mo avg
  if (avg3 === 0) return null
  return Math.round(((recent[3]! - avg3) / avg3) * 1000) / 10 // 1 dp
}

/** Cast a Prisma Json field to a plain record safely. */
function jsonRecord(v: unknown): Record<string, number | string> {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, number | string>
  }
  return {}
}

// ── GET /api/cetps ─────────────────────────────────────────────────────────
//
// Returns each CETP with its latest monitoring report summary and COD/BOD
// trend percentages vs the 3-month trailing average.

cetpsRouter.get('/cetps', requireAuth, async (_req, res) => {
  // Fetch all CETPs with their last 12 monthly reports ordered oldest→newest
  const cetps = await prisma.cetp.findMany({
    orderBy: { name: 'asc' },
    include: {
      reports: {
        orderBy: { monthOf: 'asc' },
        take: 12,
        select: {
          id: true,
          monthOf: true,
          bypassMld: true,
          observedFinal: true,
          hazardousWasteStorageMt: true,
          hazardousWasteDisposedMt: true,
        },
      },
    },
  })

  const result = cetps.map(cetp => {
    const reports = cetp.reports   // oldest→newest

    // Extract COD / BOD time-series from observedFinal
    const codSeries = reports.map(r => {
      const f = jsonRecord(r.observedFinal)
      return typeof f['COD'] === 'number' ? f['COD'] : 0
    })
    const bodSeries = reports.map(r => {
      const f = jsonRecord(r.observedFinal)
      return typeof f['BOD'] === 'number' ? f['BOD'] : 0
    })

    const latest = reports[reports.length - 1] ?? null

    return {
      id: cetp.id,
      name: cetp.name,
      capacityMld: cetp.capacityMld,
      district: cetp.district,
      memberUnitsCount: cetp.memberUnitsCount,
      hasOnlineCeqms: cetp.hasOnlineCeqms,
      spraydryerUnits: cetp.spraydryerUnits,
      latestReport: latest
        ? {
            id: latest.id,
            monthOf: latest.monthOf,
            bypassMld: latest.bypassMld ?? 0,
            observedFinalCOD: codSeries[codSeries.length - 1] ?? null,
            observedFinalBOD: bodSeries[bodSeries.length - 1] ?? null,
            hazardousWasteStorageMt: latest.hazardousWasteStorageMt ?? null,
            hazardousWasteDisposedMt: latest.hazardousWasteDisposedMt ?? null,
          }
        : null,
      trend: {
        codTrendPct: trendPct(codSeries),
        bodTrendPct: trendPct(bodSeries),
      },
    }
  })

  return res.json({ data: result })
})

// ── GET /api/cetps/:id/reports ─────────────────────────────────────────────
//
// Returns the last 12 monthly monitoring reports for a single CETP, with full
// inlet / observed / final / bypass data.

const IdSchema = z.object({ id: z.string().cuid() })

cetpsRouter.get('/cetps/:id/reports', requireAuth, async (req, res) => {
  const parsed = IdSchema.safeParse(req.params)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_id' })

  const { id } = parsed.data

  const cetp = await prisma.cetp.findUnique({
    where: { id },
    include: {
      reports: {
        orderBy: { monthOf: 'desc' },
        take: 12,
        select: {
          id: true,
          monthOf: true,
          inletNorms: true,
          finalEffluentStds: true,
          observedInlet: true,
          observedFinal: true,
          bypassMld: true,
          hazardousWasteStorageMt: true,
          hazardousWasteDisposedMt: true,
          reportFileUrl: true,
        },
      },
    },
  })

  if (!cetp) return res.status(404).json({ error: 'cetp_not_found' })

  // Return newest first (already ordered desc by monthOf)
  return res.json({
    cetp: {
      id: cetp.id,
      name: cetp.name,
      capacityMld: cetp.capacityMld,
      district: cetp.district,
      memberUnitsCount: cetp.memberUnitsCount,
      hasOnlineCeqms: cetp.hasOnlineCeqms,
      spraydryerUnits: cetp.spraydryerUnits,
    },
    reports: cetp.reports,
  })
})
