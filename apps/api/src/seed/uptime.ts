/**
 * StationUptimeStat seed: one row per MonitoringStation per day for the last 90 days.
 * Distribution per station-day (deterministic via per-station band):
 *   ~85%  → 1440 onlineMinutes, 0 offlineMinutes, 0 outages
 *   ~10%  → 1 outage: 60-300 offlineMinutes
 *   ~5%   → 2-3 outages: longer offline windows
 * Total target: ~170 stations × 90 days = ~15 300 rows
 */
import type { PrismaClient } from '@prisma/client'

// ── Deterministic PRNG ────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff
  }
}

function strHash(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) | 0
  }
  return h >>> 0
}

// ── Main seed function ─────────────────────────────────────────────────────────

export async function seedStationUptime(prisma: PrismaClient): Promise<number> {
  // Idempotent: skip if we already have uptime stats
  const existing = await prisma.stationUptimeStat.count()
  if (existing >= 10_000) return existing

  const stations = await prisma.monitoringStation.findMany({ select: { id: true } })
  if (stations.length === 0) {
    throw new Error('seedStationUptime: no stations found — run seedSensors first')
  }

  const now = new Date()
  // Midnight UTC of today
  const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const DAYS = 90
  let inserted = 0

  for (const station of stations) {
    const stationRng = mulberry32(strHash(station.id))

    // Per-station baseline: controls how "healthy" this station is overall
    // Higher baseline → fewer outage days
    const baseline = stationRng()

    for (let d = 0; d < DAYS; d++) {
      const dayDate = new Date(todayMidnight.getTime() - d * 86_400_000)
      const dayRng = mulberry32(strHash(station.id + '-' + d))
      const roll = dayRng()

      let onlineMinutes: number
      let offlineMinutes: number
      let outageCount: number

      if (roll < 0.85) {
        // ~85%: perfect uptime
        onlineMinutes = 1440
        offlineMinutes = 0
        outageCount = 0
      } else if (roll < 0.95) {
        // ~10%: single outage, 60–300 min offline
        const outage = Math.floor(60 + dayRng() * 240)
        offlineMinutes = outage
        onlineMinutes = 1440 - outage
        outageCount = 1
      } else {
        // ~5%: 2–3 outages, longer windows
        const numOutages = Math.floor(dayRng() * 2) + 2 // 2 or 3
        // Each outage: 120–480 min, but total capped at 1200
        let totalOffline = 0
        for (let o = 0; o < numOutages; o++) {
          const dur = Math.floor(120 + dayRng() * 360)
          totalOffline = Math.min(totalOffline + dur, 1200)
        }
        offlineMinutes = totalOffline
        onlineMinutes = 1440 - totalOffline
        outageCount = numOutages
      }

      // Adjust slightly by per-station baseline: very healthy stations shift roll up
      if (baseline > 0.92) {
        // Extra-healthy: force all multi-outage days into the single-outage tier
        if (outageCount > 1) {
          const outage = Math.floor(60 + dayRng() * 120)
          offlineMinutes = outage
          onlineMinutes = 1440 - outage
          outageCount = 1
        }
      }

      await prisma.stationUptimeStat.create({
        data: {
          stationId: station.id,
          date: dayDate,
          onlineMinutes,
          offlineMinutes,
          outageCount,
        },
      })
      inserted++
    }
  }

  return inserted
}
