/**
 * GujaratHeatmap — 7×7 geo-grid of Gujarat districts coloured by criticality score.
 *
 * The grid maps rows (0=north) and columns (0=west) to approximate district positions
 * within Gujarat state. Each cell shows a 2-3 letter abbreviation and is coloured from
 * green (0) → yellow → orange → red (100).
 *
 * Data source: GET /api/stats/war-room/heatmap
 *   { districts: [{ districtId, districtName, criticality, breakdown }], generatedAt }
 */

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistrictBreakdown {
  criticalCount: number
  majorCount: number
  anomalyCount: number
  openComplaints: number
  activeExceedances: number
}

interface DistrictScore {
  districtId: string
  districtName: string
  criticality: number   // 0–100
  breakdown: DistrictBreakdown
}

interface HeatmapResponse {
  districts: DistrictScore[]
  generatedAt: string
}

// ─── Geo-grid layout ──────────────────────────────────────────────────────────
// [row, col] within a 7×7 grid. Row 0 = north, col 0 = west.
// Source: approximate geographic centroids mapped to 7×7 grid cells.

const DISTRICT_GRID: Array<{ abbr: string; full: string; row: number; col: number }> = [
  // North row
  { abbr: 'BNK', full: 'Banaskantha',   row: 0, col: 1 },
  { abbr: 'PAN', full: 'Patan',         row: 0, col: 2 },
  { abbr: 'MEH', full: 'Mehsana',       row: 0, col: 3 },
  { abbr: 'SAB', full: 'Sabarkantha',   row: 0, col: 4 },
  { abbr: 'ARV', full: 'Arvalli',       row: 0, col: 5 },
  // Kutch + Morbi / Surendranagar row
  { abbr: 'KCH', full: 'Kutch',         row: 1, col: 0 },
  { abbr: 'MOR', full: 'Morbi',         row: 1, col: 2 },
  { abbr: 'SRD', full: 'Surendranagar', row: 1, col: 3 },
  { abbr: 'GDH', full: 'Gandhinagar',   row: 1, col: 4 },
  { abbr: 'AHM', full: 'Ahmedabad',     row: 1, col: 5 },
  { abbr: 'KHD', full: 'Kheda',         row: 1, col: 6 },
  // Rajkot / Anand row
  { abbr: 'RAJ', full: 'Rajkot',        row: 2, col: 1 },
  { abbr: 'BOT', full: 'Botad',         row: 2, col: 2 },
  { abbr: 'AND', full: 'Anand',         row: 2, col: 5 },
  { abbr: 'PNC', full: 'Panchmahal',    row: 2, col: 6 },
  // Jamnagar / Bhavnagar row
  { abbr: 'JAM', full: 'Jamnagar',      row: 3, col: 0 },
  { abbr: 'DWK', full: 'Dwarka',        row: 3, col: 1 },
  { abbr: 'BHV', full: 'Bhavnagar',     row: 3, col: 3 },
  { abbr: 'VDO', full: 'Vadodara',      row: 3, col: 5 },
  { abbr: 'DAH', full: 'Dahod',         row: 3, col: 6 },
  // Porbandar / Amreli row
  { abbr: 'PRB', full: 'Porbandar',     row: 4, col: 0 },
  { abbr: 'AMR', full: 'Amreli',        row: 4, col: 2 },
  { abbr: 'NRM', full: 'Narmada',       row: 4, col: 4 },
  { abbr: 'CHH', full: 'Chhota Udaipur',row: 4, col: 5 },
  // Junagadh / Gir / Bharuch row
  { abbr: 'JNG', full: 'Junagadh',      row: 5, col: 1 },
  { abbr: 'GIR', full: 'Gir Somnath',   row: 5, col: 2 },
  { abbr: 'BHR', full: 'Bharuch',       row: 5, col: 4 },
  { abbr: 'NVS', full: 'Nvsari',        row: 5, col: 5 },
  { abbr: 'TAP', full: 'Tapi',          row: 5, col: 6 },
  // South row
  { abbr: 'SOM', full: 'Somnath',       row: 6, col: 2 },
  { abbr: 'SRT', full: 'Surat',         row: 6, col: 4 },
  { abbr: 'VLS', full: 'Valsad',        row: 6, col: 5 },
  { abbr: 'DNG', full: 'Dang',          row: 6, col: 6 },
]

// ─── Criticality → colour ─────────────────────────────────────────────────────

function criticalityToColor(score: number): { bg: string; text: string; ring: string } {
  if (score >= 70) return { bg: 'bg-red-500',    text: 'text-white',          ring: 'ring-red-700' }
  if (score >= 50) return { bg: 'bg-orange-400', text: 'text-white',          ring: 'ring-orange-600' }
  if (score >= 30) return { bg: 'bg-amber-300',  text: 'text-amber-900',      ring: 'ring-amber-500' }
  if (score >= 10) return { bg: 'bg-yellow-200', text: 'text-yellow-900',     ring: 'ring-yellow-400' }
  return                   { bg: 'bg-emerald-100', text: 'text-emerald-800',  ring: 'ring-emerald-300' }
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps {
  district: DistrictScore
}

function DistrictTooltip({ district }: TooltipProps) {
  const b = district.breakdown
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-white rounded-xl border border-bdr shadow-modal p-3 pointer-events-none">
      <div className="text-[12px] font-bold text-txt-primary mb-1">{district.districtName}</div>
      <div className="text-[11px] text-danger font-semibold">Criticality: {Math.round(district.criticality)}</div>
      <div className="mt-1.5 space-y-0.5 text-[11px] text-txt-secondary">
        <div>Critical alerts: {b.criticalCount}</div>
        <div>Major alerts: {b.majorCount}</div>
        <div>Anomalies: {b.anomalyCount}</div>
        <div>Open complaints: {b.openComplaints}</div>
        <div>Active exceedances: {b.activeExceedances}</div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GujaratHeatmapProps {
  /** If provided, the component uses this score map instead of fetching */
  scoreMap?: Map<string, DistrictScore>
  /** Show loading state */
  externalLoading?: boolean
}

export function GujaratHeatmap({ scoreMap: externalMap, externalLoading }: GujaratHeatmapProps = {}) {
  const { token } = useAuth()
  const [scores, setScores] = useState<Map<string, DistrictScore>>(new Map())
  const [loading, setLoading] = useState(true)
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api<HeatmapResponse>('/api/stats/war-room/heatmap', { token })
      const map = new Map<string, DistrictScore>()
      for (const d of res.districts) {
        // Index by both districtId and districtName (lowercase) for fuzzy lookup
        map.set(d.districtName.toLowerCase(), d)
        map.set(d.districtId, d)
      }
      setScores(map)
      setGeneratedAt(res.generatedAt)
    } catch {
      // Silently fail — show empty heatmap
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (externalMap !== undefined) {
      setScores(externalMap)
      setLoading(false)
    } else {
      void load()
    }
  }, [externalMap, load])

  const activeLoading = externalLoading ?? loading

  // Build 7×7 grid with undefined cells for empty positions
  const grid: Array<Array<typeof DISTRICT_GRID[0] | null>> = Array.from({ length: 7 }, () =>
    Array.from({ length: 7 }, () => null),
  )
  for (const d of DISTRICT_GRID) {
    grid[d.row]![d.col] = d
  }

  return (
    <div className="bg-white rounded-2xl border border-bdr-light shadow-card p-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[3px] text-txt-tertiary">
            District Criticality Heatmap
          </div>
          {generatedAt && (
            <div className="text-[10px] text-txt-tertiary mt-0.5">
              Updated {new Date(generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
          )}
        </div>
        {activeLoading && <RefreshCw className="w-3.5 h-3.5 text-txt-tertiary animate-spin" />}
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-1">
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-1">
            {row.map((cell, colIdx) => {
              if (!cell) {
                return <div key={colIdx} className="flex-1 aspect-square" />
              }

              // Look up score
              const score = scores.get(cell.full.toLowerCase()) ?? scores.get(cell.abbr.toLowerCase())
              const criticality = score?.criticality ?? 0
              const colors = criticalityToColor(criticality)
              const isHovered = hoveredDistrict === cell.full

              return (
                <div
                  key={colIdx}
                  className="flex-1 aspect-square relative"
                  onMouseEnter={() => setHoveredDistrict(cell.full)}
                  onMouseLeave={() => setHoveredDistrict(null)}
                >
                  <div
                    className={`
                      w-full h-full rounded-lg flex flex-col items-center justify-center cursor-default
                      transition-all duration-200 select-none
                      ${colors.bg} ${colors.text}
                      ${isHovered ? `ring-2 ${colors.ring} scale-110 z-10` : ''}
                    `}
                  >
                    <div className="text-[9px] font-black leading-tight text-center px-0.5 truncate w-full text-center">
                      {cell.abbr}
                    </div>
                    {score && (
                      <div className="text-[8px] font-semibold opacity-80">
                        {Math.round(criticality)}
                      </div>
                    )}
                  </div>

                  {/* Tooltip */}
                  {isHovered && score && (
                    <DistrictTooltip district={score} />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <div className="text-[9px] font-bold uppercase tracking-widest text-txt-tertiary mr-1">Criticality</div>
        {[
          { label: '<10',  bg: 'bg-emerald-100' },
          { label: '10–30', bg: 'bg-yellow-200' },
          { label: '30–50', bg: 'bg-amber-300' },
          { label: '50–70', bg: 'bg-orange-400' },
          { label: '70+',   bg: 'bg-red-500' },
        ].map(({ label, bg }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${bg}`} />
            <span className="text-[9px] text-txt-tertiary">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
