/**
 * WarRoomCanvas — Senior Reviewer crisis-room view.
 *
 * Layout:
 *  • Top strip: 4 KPI tiles (red/amber/orange/rose)
 *  • Left 60%: BREAKING feed (critical exceedances + new closures + pending review)
 *  • Right 40%:
 *      top: pseudo-map of Gujarat with overlays (critical exceedances, complaint hotspots,
 *           offline stations) mirroring ComplaintHotspotMapCanvas pattern
 *      bottom: SLA breaches list (pending_review >48h, inspections due 24h, red renewals 30d)
 *
 * Auto-refreshes every 30s.
 * Single endpoint: GET /api/stats/war-room
 */

import { useEffect, useState, useCallback } from 'react'
import {
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  Clock,
  ArrowRight,
  WifiOff,
  MapPin,
} from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useChat } from '../../../context/ChatContext.js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Kpis {
  criticalExceedances24h: number
  inspectionTriggerAlerts: number
  pendingReviewEnforcement: number
  hotspotComplaintsThisWeek: number
}

interface BreakingEvent {
  id: string
  kind: 'EXCEEDANCE' | 'COMMITTED' | 'PENDING_REVIEW'
  timestamp: string
  industryId: string | null
  industryName: string | null
  summary: string
  actionCanvas: string
}

interface PendingReviewSla {
  id: string
  type: string
  industryId: string
  industryName: string
  draftedAt: string
  hoursWaiting: number
}

interface InspectionDueSla {
  id: string
  industryId: string
  industryName: string
  scheduledAt: string
}

interface RenewalDueSla {
  id: string
  industryId: string
  industryName: string
  category: string
  validityTo: string | null
  daysRemaining: number | null
}

interface SlaSummary {
  pendingReviewOver48h: PendingReviewSla[]
  inspectionsDueIn24h: InspectionDueSla[]
  redCategoryRenewalsDue30d: RenewalDueSla[]
}

interface OfflineStation {
  id: string
  name: string
  type: string
  status: string
  lat: number | null
  lng: number | null
  industryId: string | null
  industryName: string | null
}

interface HotspotPoint {
  lat: number
  lng: number
  count: number
  severity: string
  districtId: string | null
}

interface WarRoomData {
  kpis: Kpis
  breakingFeed: BreakingEvent[]
  slaSummary: SlaSummary
  offlineStations: OfflineStation[]
  hotspotPoints: HotspotPoint[]
  generatedAt: string
}

// ── Gujarat grid (from ComplaintHotspotMapCanvas) ─────────────────────────────

interface DistrictCell { name: string; col: number; row: number; w?: number; h?: number }

const GUJARAT_GRID: DistrictCell[] = [
  { name: 'Banaskantha',  col: 2, row: 1, w: 2 },
  { name: 'Patan',        col: 4, row: 1 },
  { name: 'Mehsana',      col: 5, row: 1 },
  { name: 'Sabarkantha',  col: 6, row: 1 },
  { name: 'Aravalli',     col: 7, row: 1 },
  { name: 'Kutch',        col: 1, row: 2, w: 2, h: 3 },
  { name: 'Morbi',        col: 3, row: 2 },
  { name: 'Surendranagar',col: 4, row: 2 },
  { name: 'Gandhinagar',  col: 5, row: 2 },
  { name: 'Ahmedabad',    col: 6, row: 2 },
  { name: 'Kheda',        col: 7, row: 2 },
  { name: 'Anand',        col: 8, row: 2 },
  { name: 'Devbhumi Dwarka', col: 3, row: 3 },
  { name: 'Jamnagar',     col: 4, row: 3 },
  { name: 'Rajkot',       col: 5, row: 3 },
  { name: 'Botad',        col: 6, row: 3 },
  { name: 'Vadodara',     col: 7, row: 3 },
  { name: 'Chhota Udaipur', col: 8, row: 3 },
  { name: 'Porbandar',    col: 3, row: 4 },
  { name: 'Junagadh',     col: 4, row: 4 },
  { name: 'Amreli',       col: 5, row: 4 },
  { name: 'Bhavnagar',    col: 6, row: 4 },
  { name: 'Narmada',      col: 7, row: 4 },
  { name: 'Bharuch',      col: 8, row: 4 },
  { name: 'Gir Somnath',  col: 4, row: 5 },
  { name: 'Dang',         col: 6, row: 5 },
  { name: 'Tapi',         col: 7, row: 5 },
  { name: 'Surat',        col: 8, row: 5 },
  { name: 'Navsari',      col: 8, row: 6 },
  { name: 'Valsad',       col: 8, row: 7 },
]

const CELL_PX = 38
const GRID_COLS = 9
const GRID_ROWS = 8

// Rough lat/lng → grid cell mapping
function latLngToCell(lat: number, lng: number): { col: number; row: number } | null {
  // Gujarat approx bounds: lat 20.1–24.7, lng 68.0–74.5
  if (lat < 20.0 || lat > 25.0 || lng < 68.0 || lng > 75.0) return null
  const col = Math.round(((lng - 68.0) / 6.5) * 7) + 1
  const row = Math.round(((24.7 - lat) / 4.6) * 6) + 1
  return { col: Math.max(1, Math.min(GRID_COLS - 1, col)), row: Math.max(1, Math.min(GRID_ROWS - 1, row)) }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'Just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

const KIND_STYLES: Record<string, { bg: string; label: string; dot: string }> = {
  EXCEEDANCE:   { bg: 'bg-red-50 border-red-200',   label: 'BREAKING', dot: 'bg-red-500' },
  COMMITTED:    { bg: 'bg-green-50 border-green-200', label: 'COMMITTED', dot: 'bg-green-500' },
  PENDING_REVIEW: { bg: 'bg-amber-50 border-amber-200', label: 'PENDING', dot: 'bg-amber-500' },
}

// ── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`flex-1 min-w-0 rounded-2xl border p-4 flex flex-col gap-1 ${cls}`}>
      <div className="text-[28px] font-black leading-none">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-75 leading-tight">{label}</div>
    </div>
  )
}

// ── Breaking feed item ────────────────────────────────────────────────────────

function FeedItem({ event, onNavigate }: { event: BreakingEvent; onNavigate: (id: string) => void }) {
  const s = KIND_STYLES[event.kind] ?? KIND_STYLES['EXCEEDANCE']!
  return (
    <div className={`rounded-xl border px-3 py-2.5 flex items-start gap-3 ${s.bg}`}>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${s.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{s.label}</span>
          <span className="text-[10px] text-txt-tertiary">{fmtRelative(event.timestamp)}</span>
        </div>
        {event.industryName && (
          <div className="text-[11px] font-bold text-txt-primary truncate">{event.industryName}</div>
        )}
        <div className="text-[11px] text-txt-secondary leading-snug line-clamp-2">{event.summary}</div>
      </div>
      <button
        onClick={() => onNavigate(event.actionCanvas)}
        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/70 text-txt-tertiary hover:text-primary transition-colors mt-0.5"
        title="Investigate"
      >
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Pseudo-map ────────────────────────────────────────────────────────────────

function WarRoomMap({
  hotspots,
  offlineStations,
  criticalExceedances,
}: {
  hotspots: HotspotPoint[]
  offlineStations: OfflineStation[]
  criticalExceedances: number
}) {
  const mapW = GRID_COLS * CELL_PX
  const mapH = GRID_ROWS * CELL_PX

  // Build overlay dots from hotspot lat/lng
  const overlayDots: Array<{ x: number; y: number; size: number; color: string; title: string }> = []
  for (const h of hotspots) {
    const cell = latLngToCell(h.lat, h.lng)
    if (!cell) continue
    const x = (cell.col - 0.5) * CELL_PX
    const y = (cell.row - 0.5) * CELL_PX
    const size = Math.min(14, 6 + h.count * 1.5)
    overlayDots.push({ x, y, size, color: 'rgba(239,68,68,0.75)', title: `${h.count} complaints` })
  }

  // Offline stations
  for (const s of offlineStations) {
    if (s.lat == null || s.lng == null) continue
    const cell = latLngToCell(s.lat, s.lng)
    if (!cell) continue
    const x = (cell.col - 0.5) * CELL_PX - 3
    const y = (cell.row - 0.5) * CELL_PX - 3
    overlayDots.push({ x, y, size: 7, color: 'rgba(100,116,139,0.75)', title: `Offline: ${s.name}` })
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-50 border border-bdr-light">
      <div
        className="relative"
        style={{ width: mapW, height: mapH, margin: '0 auto' }}
      >
        {/* District cells */}
        {GUJARAT_GRID.map(cell => (
          <div
            key={cell.name}
            className="absolute border border-slate-200 bg-white/60 rounded flex items-center justify-center"
            style={{
              left: (cell.col - 1) * CELL_PX,
              top: (cell.row - 1) * CELL_PX,
              width: (cell.w ?? 1) * CELL_PX - 2,
              height: (cell.h ?? 1) * CELL_PX - 2,
            }}
          >
            <span className="text-[6px] text-slate-400 text-center leading-tight px-0.5 truncate">
              {cell.name}
            </span>
          </div>
        ))}

        {/* Overlay dots */}
        {overlayDots.map((d, i) => (
          <div
            key={i}
            className="absolute rounded-full flex items-center justify-center text-white text-[7px] font-bold cursor-pointer transition-transform hover:scale-110"
            style={{
              left: d.x,
              top: d.y,
              width: d.size,
              height: d.size,
              background: d.color,
              transform: 'translate(-50%,-50%)',
              zIndex: 10,
            }}
            title={d.title}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-[9px] text-txt-tertiary">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/75" /> Complaints
        </div>
        <div className="flex items-center gap-1 text-[9px] text-txt-tertiary">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-500/75" /> Offline station
        </div>
      </div>

      {/* KPI overlay if no hotspots */}
      {overlayDots.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-txt-tertiary">
          No complaint clusters this week
        </div>
      )}

      {/* Critical exceedances counter on map */}
      {criticalExceedances > 0 && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
          {criticalExceedances} critical
        </div>
      )}
    </div>
  )
}

// ── SLA section ───────────────────────────────────────────────────────────────

function SlaSection({ sla, onNavigate }: { sla: SlaSummary; onNavigate: (id: string) => void }) {
  const total = sla.pendingReviewOver48h.length + sla.inspectionsDueIn24h.length + sla.redCategoryRenewalsDue30d.length
  if (total === 0) {
    return (
      <div className="text-[12px] text-txt-tertiary italic px-1">No SLA breaches detected.</div>
    )
  }

  return (
    <div className="space-y-1.5">
      {sla.pendingReviewOver48h.map(e => (
        <div key={e.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-100">
          <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-txt-primary truncate">{e.industryName}</div>
            <div className="text-[10px] text-txt-secondary">{e.type.replace(/_/g,' ')} · {e.hoursWaiting}h waiting</div>
          </div>
          <button onClick={() => onNavigate('OPEN_MAKER_CHECKER_QUEUE')} className="p-1 rounded hover:bg-amber-100">
            <ArrowRight className="w-3 h-3 text-amber-600" />
          </button>
        </div>
      ))}
      {sla.inspectionsDueIn24h.map(i => (
        <div key={i.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-blue-50 border border-blue-100">
          <Clock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-txt-primary truncate">{i.industryName}</div>
            <div className="text-[10px] text-txt-secondary">Inspection due {fmtDate(i.scheduledAt)}</div>
          </div>
          <button onClick={() => onNavigate('OPEN_INSPECTION_SCHEDULER')} className="p-1 rounded hover:bg-blue-100">
            <ArrowRight className="w-3 h-3 text-blue-600" />
          </button>
        </div>
      ))}
      {sla.redCategoryRenewalsDue30d.map(c => (
        <div key={c.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-rose-50 border border-rose-100">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-txt-primary truncate">{c.industryName}</div>
            <div className="text-[10px] text-txt-secondary">RED consent expires in {c.daysRemaining}d</div>
          </div>
          <button onClick={() => onNavigate('OPEN_RENEWAL_RADAR')} className="p-1 rounded hover:bg-rose-100">
            <ArrowRight className="w-3 h-3 text-rose-600" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function WarRoomCanvas() {
  const { token } = useAuth()
  const { openCanvas } = useChat()
  const [data, setData] = useState<WarRoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(() => {
    if (!token) return
    api<WarRoomData>('/api/stats/war-room', { token })
      .then(d => {
        setData(d)
        setError(null)
        setLastUpdated(new Date())
      })
      .catch((e: { message?: string }) => setError(e.message ?? 'Failed to load war-room data'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  const handleNavigate = useCallback((canvasId: string) => {
    openCanvas(canvasId)
  }, [openCanvas])

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <div className="text-[15px] font-black text-white tracking-tight">WAR ROOM</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">Live crisis board</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-500">Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-3 px-4 py-2.5 rounded-xl bg-red-900/40 border border-red-700/50 text-red-300 text-[12px]">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-[13px]">Loading war-room data…</span>
          </div>
        </div>
      ) : data ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* KPI strip */}
          <div className="flex gap-3 px-5 py-3 flex-shrink-0">
            <KpiTile
              label="Critical exceedances (24h)"
              value={data.kpis.criticalExceedances24h}
              cls="bg-red-900/50 border-red-700/40 text-red-300"
            />
            <KpiTile
              label="Inspection alerts pending"
              value={data.kpis.inspectionTriggerAlerts}
              cls="bg-amber-900/40 border-amber-700/40 text-amber-300"
            />
            <KpiTile
              label="Pending review enforcement"
              value={data.kpis.pendingReviewEnforcement}
              cls="bg-orange-900/40 border-orange-700/40 text-orange-300"
            />
            <KpiTile
              label="Complaints this week"
              value={data.kpis.hotspotComplaintsThisWeek}
              cls="bg-rose-900/40 border-rose-700/40 text-rose-300"
            />
          </div>

          {/* Main body — left: feed, right: map + SLA */}
          <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
            {/* Left — BREAKING feed */}
            <div className="w-3/5 flex flex-col border-r border-white/10 min-h-0">
              <div className="px-5 py-2 flex-shrink-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Breaking Events</div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
                {data.breakingFeed.length === 0 ? (
                  <div className="text-[13px] text-slate-500 italic mt-4">No breaking events in the last 24 hours.</div>
                ) : (
                  data.breakingFeed.map(e => (
                    <FeedItem key={`${e.kind}-${e.id}`} event={e} onNavigate={handleNavigate} />
                  ))
                )}
              </div>
            </div>

            {/* Right — map + SLA */}
            <div className="w-2/5 flex flex-col min-h-0 overflow-y-auto">
              {/* Map */}
              <div className="px-4 pt-3 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">State Overview</div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <MapPin className="w-3 h-3" />
                    Live overlays
                  </div>
                </div>
                <WarRoomMap
                  hotspots={data.hotspotPoints}
                  offlineStations={data.offlineStations}
                  criticalExceedances={data.kpis.criticalExceedances24h}
                />
              </div>

              {/* Offline stations summary */}
              {data.offlineStations.length > 0 && (
                <div className="px-4 pt-3 flex-shrink-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    <WifiOff className="w-3 h-3" />
                    Offline stations ({data.offlineStations.length})
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {data.offlineStations.slice(0, 4).map(s => s.name).join(', ')}
                    {data.offlineStations.length > 4 && ` +${data.offlineStations.length - 4} more`}
                  </div>
                </div>
              )}

              {/* SLA section */}
              <div className="px-4 pt-3 pb-4 flex-shrink-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Next 24h SLA Breaches
                </div>
                <SlaSection sla={data.slaSummary} onNavigate={handleNavigate} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
