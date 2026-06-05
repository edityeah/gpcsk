// ComplaintHotspotMapCanvas — Complaints Officer
// Pseudo-map of Gujarat rendered as CSS rectangles per district.
// Hotspot clusters from /api/complaints/hotspots. Hover/click district → side panel.

import { useEffect, useState, useCallback } from 'react'
import { MapPin, X, RefreshCw, AlertTriangle, Eye } from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface HotspotComplaint {
  id: string
  category: string
  severity: string
  description: string
  receivedAt: string
}

interface DistrictHotspot {
  district: string
  count: number
  critical: number
  topCategory: string
  complaints: HotspotComplaint[]
}

interface HotspotsResponse {
  hotspots: DistrictHotspot[]
}

// ─── Gujarat district layout (simplified grid map) ────────────────────────────
// x / y in grid units (each = 48px). Gujarat shape approximated in a 10×10 grid.

interface DistrictCell {
  name: string
  col: number  // 1-indexed
  row: number
  w?: number   // colspan
  h?: number   // rowspan
}

const GUJARAT_GRID: DistrictCell[] = [
  // North
  { name: 'Banaskantha',  col: 2, row: 1, w: 2 },
  { name: 'Patan',        col: 4, row: 1 },
  { name: 'Mehsana',      col: 5, row: 1 },
  { name: 'Sabarkantha',  col: 6, row: 1 },
  { name: 'Aravalli',     col: 7, row: 1 },
  // Second row
  { name: 'Kutch',        col: 1, row: 2, w: 2, h: 3 },
  { name: 'Morbi',        col: 3, row: 2 },
  { name: 'Surendranagar',col: 4, row: 2 },
  { name: 'Gandhinagar',  col: 5, row: 2 },
  { name: 'Ahmedabad',    col: 6, row: 2 },
  { name: 'Kheda',        col: 7, row: 2 },
  { name: 'Anand',        col: 8, row: 2 },
  // Third row
  { name: 'Devbhumi Dwarka', col: 3, row: 3 },
  { name: 'Jamnagar',     col: 4, row: 3 },
  { name: 'Rajkot',       col: 5, row: 3 },
  { name: 'Botad',        col: 6, row: 3 },
  { name: 'Vadodara',     col: 7, row: 3 },
  { name: 'Chhota Udaipur', col: 8, row: 3 },
  // Fourth row
  { name: 'Porbandar',    col: 3, row: 4 },
  { name: 'Junagadh',     col: 4, row: 4 },
  { name: 'Amreli',       col: 5, row: 4 },
  { name: 'Bhavnagar',    col: 6, row: 4 },
  { name: 'Narmada',      col: 7, row: 4 },
  { name: 'Bharuch',      col: 8, row: 4 },
  // Fifth row
  { name: 'Gir Somnath',  col: 4, row: 5 },
  { name: 'Dang',         col: 6, row: 5 },
  { name: 'Tapi',         col: 7, row: 5 },
  { name: 'Surat',        col: 8, row: 5 },
  // Sixth row
  { name: 'Navsari',      col: 8, row: 6 },
  { name: 'Valsad',       col: 8, row: 7 },
]

const CELL_PX = 48
const GRID_COLS = 9
const GRID_ROWS = 8

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_HOTSPOTS: DistrictHotspot[] = [
  {
    district: 'Ahmedabad', count: 87, critical: 12, topCategory: 'Air Pollution',
    complaints: [
      { id: 'C-001', category: 'Air Pollution', severity: 'critical', description: 'Black smoke from GIDC Vatva', receivedAt: new Date(Date.now() - 3600_000).toISOString() },
      { id: 'C-007', category: 'Hazardous Waste', severity: 'high', description: 'Open chemical drums at Naroda', receivedAt: new Date(Date.now() - 86400_000).toISOString() },
    ],
  },
  {
    district: 'Surat', count: 54, critical: 6, topCategory: 'Water Pollution',
    complaints: [
      { id: 'C-002', category: 'Water Pollution', severity: 'critical', description: 'Dye effluent in drain at Sachin GIDC', receivedAt: new Date(Date.now() - 7200_000).toISOString() },
    ],
  },
  {
    district: 'Bharuch', count: 42, critical: 8, topCategory: 'Hazardous Waste',
    complaints: [
      { id: 'C-003', category: 'Hazardous Waste', severity: 'medium', description: 'Waste drums at Ankleshwar GIDC', receivedAt: new Date(Date.now() - 86400_000).toISOString() },
    ],
  },
  {
    district: 'Valsad', count: 31, critical: 3, topCategory: 'Air Pollution',
    complaints: [
      { id: 'C-004', category: 'Air Pollution', severity: 'high', description: 'Stack emissions at Vapi industrial estate', receivedAt: new Date(Date.now() - 172_800_000).toISOString() },
    ],
  },
  {
    district: 'Rajkot', count: 28, critical: 2, topCategory: 'Noise',
    complaints: [
      { id: 'C-005', category: 'Noise', severity: 'medium', description: 'Compressor noise at ceramic unit', receivedAt: new Date(Date.now() - 259_200_000).toISOString() },
    ],
  },
  {
    district: 'Vadodara', count: 22, critical: 1, topCategory: 'Water Pollution',
    complaints: [],
  },
  {
    district: 'Kutch', count: 15, critical: 0, topCategory: 'Noise',
    complaints: [],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIntensity(count: number, maxCount: number): string {
  const ratio = maxCount === 0 ? 0 : count / maxCount
  if (ratio > 0.75) return 'bg-danger text-white'
  if (ratio > 0.5)  return 'bg-orange-500 text-white'
  if (ratio > 0.25) return 'bg-warn text-txt-primary'
  if (ratio > 0)    return 'bg-yellow-100 text-txt-primary'
  return 'bg-surface-secondary text-txt-tertiary'
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

// ─── Side panel ───────────────────────────────────────────────────────────────

function DistrictPanel({ hotspot, onClose }: { hotspot: DistrictHotspot; onClose: () => void }) {
  return (
    <div className="w-[260px] flex-shrink-0 bg-white border-l border-bdr-light flex flex-col animate-bubble-in">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-bdr-light">
        <MapPin className="w-4 h-4 text-primary" />
        <div className="flex-1">
          <div className="text-[14px] font-bold text-txt-primary">{hotspot.district}</div>
          <div className="text-[11px] text-txt-secondary">{hotspot.count} complaints</div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-surface-secondary flex items-center justify-center">
          <X className="w-4 h-4 text-txt-tertiary" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-bdr-light space-y-1.5">
        <div className="flex justify-between text-[12px]">
          <span className="text-txt-secondary">Critical</span>
          <span className="font-bold text-danger">{hotspot.critical}</span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-txt-secondary">Top category</span>
          <span className="font-semibold text-txt-primary">{hotspot.topCategory}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-txt-tertiary mb-2">Recent complaints</div>
        {hotspot.complaints.length === 0 && (
          <div className="text-[12px] text-txt-tertiary">No details available.</div>
        )}
        {hotspot.complaints.map(c => (
          <div key={c.id} className="bg-surface-secondary rounded-xl p-3">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] font-bold text-txt-tertiary">{c.id}</span>
              <span className="text-[10px] text-txt-tertiary">·</span>
              <span className="text-[10px] text-txt-secondary">{c.category}</span>
              <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${c.severity === 'critical' ? 'bg-danger text-white' : c.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-warn-light text-yellow-800'}`}>
                {c.severity}
              </span>
            </div>
            <div className="text-[11px] text-txt-primary line-clamp-2">{c.description}</div>
            <div className="text-[10px] text-txt-tertiary mt-1">{fmt(c.receivedAt)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main canvas ─────────────────────────────────────────────────────────────

export function ComplaintHotspotMapCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [hotspots, setHotspots] = useState<DistrictHotspot[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DistrictHotspot | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<HotspotsResponse>('/api/complaints/hotspots', {
        token: token ?? undefined,
      })
      setHotspots(res.hotspots ?? [])
    } catch {
      showToast({ kind: 'warn', text: 'Using demo data — API not reachable.' })
      setHotspots(DEMO_HOTSPOTS)
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void load() }, [load])

  const hotspotMap = new Map(hotspots.map(h => [h.district, h]))
  const maxCount = Math.max(...hotspots.map(h => h.count), 1)

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-rose-600" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-txt-primary">Complaint Hotspot Map</div>
          <div className="text-[11px] text-txt-secondary">Gujarat districts · click a district to view complaints</div>
        </div>
        <button
          onClick={() => { void load() }}
          className="w-8 h-8 rounded-lg hover:bg-surface-secondary flex items-center justify-center text-txt-secondary"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map area */}
        <div className="flex-1 overflow-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-16 text-txt-tertiary text-[13px]">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading hotspots…
            </div>
          )}

          {!loading && (
            <>
              {/* Legend */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-[11px] text-txt-tertiary font-semibold">Intensity:</span>
                {[
                  { label: 'None', cls: 'bg-surface-secondary' },
                  { label: 'Low', cls: 'bg-yellow-100' },
                  { label: 'Medium', cls: 'bg-warn' },
                  { label: 'High', cls: 'bg-orange-500' },
                  { label: 'Critical', cls: 'bg-danger' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded ${l.cls}`} />
                    <span className="text-[10px] text-txt-secondary">{l.label}</span>
                  </div>
                ))}
              </div>

              {/* Grid map */}
              <div
                className="relative bg-white rounded-card border border-bdr-light shadow-card overflow-hidden"
                style={{
                  width: GRID_COLS * CELL_PX + 2,
                  height: GRID_ROWS * CELL_PX + 2,
                  minWidth: GRID_COLS * CELL_PX + 2,
                }}
              >
                {/* Sea background */}
                <div className="absolute inset-0 bg-blue-50" />

                {GUJARAT_GRID.map(cell => {
                  const h = hotspotMap.get(cell.name)
                  const intensity = h ? getIntensity(h.count, maxCount) : 'bg-slate-100 text-txt-tertiary'
                  const isSelected = selected?.district === cell.name
                  const isHovered = hovered === cell.name

                  return (
                    <button
                      key={cell.name}
                      onClick={() => setSelected(h ?? null)}
                      onMouseEnter={() => setHovered(cell.name)}
                      onMouseLeave={() => setHovered(null)}
                      title={h ? `${cell.name}: ${h.count} complaints` : cell.name}
                      style={{
                        position: 'absolute',
                        left: (cell.col - 1) * CELL_PX + 1,
                        top: (cell.row - 1) * CELL_PX + 1,
                        width: (cell.w ?? 1) * CELL_PX - 2,
                        height: (cell.h ?? 1) * CELL_PX - 2,
                      }}
                      className={`
                        flex flex-col items-center justify-center border rounded-lg text-center transition-all
                        ${intensity}
                        ${isSelected ? 'ring-2 ring-primary ring-offset-1 z-10' : ''}
                        ${isHovered && !isSelected ? 'brightness-90 z-10 shadow-md' : ''}
                        ${h ? 'cursor-pointer' : 'cursor-default'}
                      `}
                    >
                      <div className="text-[8px] font-bold leading-tight px-0.5 truncate w-full text-center">
                        {cell.name}
                      </div>
                      {h && (
                        <div className="text-[9px] font-bold mt-0.5">{h.count}</div>
                      )}
                      {h && h.critical > 0 && (
                        <AlertTriangle className="w-2.5 h-2.5 mt-0.5 opacity-80" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* District list below map for districts not in grid */}
              {hotspots.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-txt-tertiary mb-2">Top Hotspots</div>
                  <div className="flex flex-wrap gap-2">
                    {[...hotspots].sort((a, b) => b.count - a.count).slice(0, 8).map(h => (
                      <button
                        key={h.district}
                        onClick={() => setSelected(h)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                          selected?.district === h.district
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-txt-primary border-bdr hover:border-primary'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        {h.district} <span className="opacity-70">({h.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Side panel */}
        {selected && (
          <DistrictPanel hotspot={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  )
}
