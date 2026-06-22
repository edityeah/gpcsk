/**
 * Programs catalog — GET /api/programs
 *
 * Returns the 5 active + 2 placeholder monitoring programs with summary stats
 * computed live from the DB. The response is intentionally lightweight —
 * per-station detail lives in /api/sensors/stations/latest.
 *
 * Program → station type mapping:
 *   OCEMS   → OCEMS + CEQMS
 *   AAQM    → AAQM
 *   WATER   → MINARS + GEMS
 *   VOC     → VOC
 *   CETP    → backed by the Cetp table (not MonitoringStation)
 *   NOISE   → placeholder (v2)
 *   HAZARDOUS_WASTE → placeholder (v2)
 *   FESTIVAL → special campaign monitoring (placeholder)
 */

import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const programsRouter = Router()

// ── Static catalog metadata ──────────────────────────────────────────────────

interface ProgramMeta {
  id: string
  name: string
  fullName: string
  canvasId: string
  stationTypes: string[]   // MonitoringStationType values this program covers
  useCetp: boolean         // source from Cetp table instead of MonitoringStation
  isPlaceholder: boolean   // v2 — no live data yet
}

const PROGRAMS: ProgramMeta[] = [
  {
    id: 'OCEMS',
    name: 'OCEMS',
    fullName: 'Online Continuous Effluent Monitoring System',
    canvasId: 'OPEN_OCEMS_LIVE_GRID',
    stationTypes: ['OCEMS', 'CEQMS'],
    useCetp: false,
    isPlaceholder: false,
  },
  {
    id: 'AAQM',
    name: 'Ambient Air Quality',
    fullName: 'AAQM (NAMP + SAMP)',
    canvasId: 'OPEN_AAQM_MONITOR',
    stationTypes: ['AAQM'],
    useCetp: false,
    isPlaceholder: false,
  },
  {
    id: 'WATER',
    name: 'Water Quality',
    fullName: 'MINARS + GEMS surface + groundwater',
    canvasId: 'OPEN_OCEMS_LIVE_GRID',
    stationTypes: ['MINARS', 'GEMS'],
    useCetp: false,
    isPlaceholder: false,
  },
  {
    id: 'VOC',
    name: 'VOC Clusters',
    fullName: 'VOC Industrial Cluster Monitoring',
    canvasId: 'OPEN_VOC_CLUSTER_MONITOR',
    stationTypes: ['VOC'],
    useCetp: false,
    isPlaceholder: false,
  },
  {
    id: 'CETP',
    name: 'CETP Monitoring',
    fullName: 'Common Effluent Treatment Plant Monitoring',
    canvasId: 'OPEN_CETP_SCORECARD',
    stationTypes: [],
    useCetp: true,
    isPlaceholder: false,
  },
  {
    id: 'NOISE',
    name: 'Noise',
    fullName: 'Ambient Noise Monitoring (v2)',
    canvasId: 'OPEN_OCEMS_LIVE_GRID',
    stationTypes: [],
    useCetp: false,
    isPlaceholder: true,
  },
  {
    id: 'HAZARDOUS_WASTE',
    name: 'Hazardous Waste',
    fullName: 'Hazardous Waste Tracking (v2)',
    canvasId: 'OPEN_OCEMS_LIVE_GRID',
    stationTypes: [],
    useCetp: false,
    isPlaceholder: true,
  },
  {
    id: 'FESTIVAL',
    name: 'Festival Monitoring',
    fullName: 'Festival Monitoring (Ganesh Utsav, Diwali)',
    canvasId: 'OPEN_FESTIVAL_PLANNER',
    stationTypes: [],
    useCetp: false,
    isPlaceholder: true,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

export interface ProgramSummary {
  id: string
  name: string
  fullName: string
  canvasId: string
  stationCount: number
  activeStationCount: number
  currentExceedancesCount: number
  recentAnomalyCount30d: number
}

/** Compute live stats for one or more programs in parallel. */
export async function computeProgramStats(programIds?: string[]): Promise<ProgramSummary[]> {
  const since30d = daysAgo(30)
  const targets = programIds
    ? PROGRAMS.filter((p) => programIds.includes(p.id))
    : PROGRAMS

  return Promise.all(
    targets.map(async (p): Promise<ProgramSummary> => {
      if (p.isPlaceholder) {
        return {
          id: p.id,
          name: p.name,
          fullName: p.fullName,
          canvasId: p.canvasId,
          stationCount: 0,
          activeStationCount: 0,
          currentExceedancesCount: 0,
          recentAnomalyCount30d: 0,
        }
      }

      if (p.useCetp) {
        // CETP program: count from the Cetp table
        const [total, exceedances, anomalies] = await Promise.all([
          prisma.cetp.count(),
          // Exceedances via CetpReport: no direct link, use 0 for now (sensor-based CETPs are small set)
          Promise.resolve(0),
          Promise.resolve(0),
        ])
        const active = total  // Cetp model has no status field; treat all as active
        return {
          id: p.id,
          name: p.name,
          fullName: p.fullName,
          canvasId: p.canvasId,
          stationCount: total,
          activeStationCount: active,
          currentExceedancesCount: exceedances,
          recentAnomalyCount30d: anomalies,
        }
      }

      // Station-backed programs
      const types = p.stationTypes as Array<
        'OCEMS' | 'CEQMS' | 'AAQM' | 'MINARS' | 'GEMS' | 'VOC'
      >

      const [stationCount, activeStationCount, currentExceedancesCount, recentAnomalyCount30d] =
        await Promise.all([
          prisma.monitoringStation.count({ where: { type: { in: types } } }),
          prisma.monitoringStation.count({ where: { type: { in: types }, status: 'active' } }),
          prisma.exceedance.count({
            where: {
              dispositionState: 'PENDING',
              station: { type: { in: types } },
            },
          }),
          prisma.exceedance.count({
            where: {
              detectedAt: { gte: since30d },
              station: { type: { in: types } },
            },
          }),
        ])

      return {
        id: p.id,
        name: p.name,
        fullName: p.fullName,
        canvasId: p.canvasId,
        stationCount,
        activeStationCount,
        currentExceedancesCount,
        recentAnomalyCount30d,
      }
    }),
  )
}

// ── GET /api/programs ────────────────────────────────────────────────────────

programsRouter.get('/', requireAuth, async (_req, res) => {
  const programs = await computeProgramStats()
  res.json({ programs })
})
