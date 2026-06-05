/**
 * OcemsLiveGridCanvas — live grid of OCEMS stations, each showing its
 * latest reading per parameter against the CPCB norm.
 *
 * Offline station enhancements (Task 2):
 *  - Shows "Last seen Xh ago · N outages in 30d" subtext
 *  - AlertTriangle badge next to status chip if autoInspectionTriggered
 *  - "View health" button opens a modal with last30dOutages timeline
 *
 * Backend: GET /api/sensors/stations/latest?type=OCEMS
 *          GET /api/sensors/stations/:id/health
 *   → auto-refresh every 30s
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  WifiOff,
  Factory,
  X,
  Clock,
  Activity,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { api } from '../../../lib/api.js'

interface Reading {
  parameter: string
  value: number
  unit: string
  normMin: number | null
  normMax: number | null
  normUnit: string | null
  timestamp: string
  validity: string
}

interface Station {
  id: string
  name: string
  status: string
  type: string
  industry: { id: string; name: string } | null
  district: string | null
  readings: Reading[]
}

interface Outage {
  start: string
  end: string
  durationHours: number
}

interface StationHealth {
  stationId: string
  stationName: string
  status: string
  lastReadingAt: string | null
  hoursSinceLastReading: number | null
  last30dOutages: Outage[]
  outageCount30d: number
  totalOfflineHours30d: number
  autoInspectionTriggered: boolean
}

type Level = 'ok' | 'warn' | 'critical' | 'offline' | 'unknown'

function readingLevel(r: Reading): Level {
  if (r.normMin == null && r.normMax == null) return 'unknown'
  const hasRange = r.normMin != null && r.normMax != null && r.normMax > r.normMin * 1.05
  if (hasRange) {
    const min = r.normMin!
    const max = r.normMax!
    if (r.value < min || r.value > max) return 'critical'
    const span = max - min
    if (r.value - min < span * 0.1 || max - r.value < span * 0.1) return 'warn'
    return 'ok'
  }
  const limit = r.normMax ?? r.normMin
  if (limit == null) return 'unknown'
  const ratio = r.value / limit
  if (ratio >= 1) return 'critical'
  if (ratio >= 0.8) return 'warn'
  return 'ok'
}

function stationLevel(s: Station): Level {
  if (s.status !== 'active') return 'offline'
  if (s.readings.length === 0) return 'unknown'
  const levels = s.readings.map(readingLevel)
  if (levels.includes('critical')) return 'critical'
  if (levels.includes('warn')) return 'warn'
  if (levels.every(l => l === 'ok')) return 'ok'
  return 'unknown'
}

const STATION_STYLES: Record<Level, { card: string; chip: string; chipLabel: string }> = {
  ok:       { card: 'border-ok/40 bg-white',               chip: 'badge badge-ok',      chipLabel: 'All within norm' },
  warn:     { card: 'border-warn/50 bg-warn-light/30',      chip: 'badge badge-warn',    chipLabel: 'Approaching limit' },
  critical: { card: 'border-danger/60 bg-danger-light/40',  chip: 'badge badge-danger',  chipLabel: 'Exceeding norm' },
  offline:  { card: 'border-bdr bg-surface-secondary',      chip: 'badge badge-info',    chipLabel: 'Offline' },
  unknown:  { card: 'border-bdr bg-white',                  chip: 'badge badge-info',    chipLabel: 'No data yet' },
}

const READING_STYLES: Record<Level, string> = {
  ok:       'text-ok',
  warn:     'text-warn',
  critical: 'text-danger font-bold',
  offline:  'text-txt-tertiary',
  unknown:  'text-txt-secondary',
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return `${Math.round(ms / 86_400_000)}d ago`
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ── Station Health Modal ──────────────────────────────────────────────────────

function HealthModal({
  stationId,
  stationName,
  token,
  onClose,
}: {
  stationId: string
  stationName: string
  token: string | null
  onClose: () => void
}) {
  const [health, setHealth] = useState<StationHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    api<StationHealth>(`/api/sensors/stations/${stationId}/health`, { token })
      .then(d => setHealth(d))
      .catch((e: { message?: string }) => setError(e.message ?? 'Failed to load health'))
      .finally(() => setLoading(false))
  }, [stationId, token])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bdr-light">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <div>
              <div className="text-[14px] font-bold text-txt-primary">{stationName}</div>
              <div className="text-[11px] text-txt-secondary">Station health — last 30 days</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-secondary text-txt-tertiary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-txt-tertiary text-[13px]">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading health data…
            </div>
          ) : error ? (
            <div className="text-danger text-[13px]">{error}</div>
          ) : health ? (
            <div className="space-y-4">
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-surface-page p-3 text-center">
                  <div className={`text-[22px] font-bold ${health.hoursSinceLastReading != null && health.hoursSinceLastReading >= 24 ? 'text-danger' : 'text-txt-primary'}`}>
                    {health.hoursSinceLastReading != null ? `${health.hoursSinceLastReading.toFixed(0)}h` : '—'}
                  </div>
                  <div className="text-[10px] text-txt-tertiary uppercase tracking-wide mt-0.5">Since last reading</div>
                </div>
                <div className="rounded-xl bg-surface-page p-3 text-center">
                  <div className={`text-[22px] font-bold ${health.outageCount30d >= 3 ? 'text-warn' : 'text-txt-primary'}`}>
                    {health.outageCount30d}
                  </div>
                  <div className="text-[10px] text-txt-tertiary uppercase tracking-wide mt-0.5">Outages (30d)</div>
                </div>
                <div className="rounded-xl bg-surface-page p-3 text-center">
                  <div className="text-[22px] font-bold text-txt-primary">{health.totalOfflineHours30d}h</div>
                  <div className="text-[10px] text-txt-tertiary uppercase tracking-wide mt-0.5">Total offline (30d)</div>
                </div>
              </div>

              {/* Auto-inspection banner */}
              {health.autoInspectionTriggered && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Auto-inspection notification sent to Inspection &amp; Enforcement Officer based on
                    {health.outageCount30d >= 3 ? ` ${health.outageCount30d} outages in 30 days` : ' extended offline period'}.
                  </span>
                </div>
              )}

              {/* Last reading */}
              {health.lastReadingAt && (
                <div className="text-[12px] text-txt-secondary">
                  <span className="font-semibold text-txt-primary">Last reading:</span>{' '}
                  {fmtDateTime(health.lastReadingAt)}
                </div>
              )}

              {/* Outage timeline */}
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-txt-tertiary mb-2">
                  Outage history (last 30 days)
                </div>
                {health.last30dOutages.length === 0 ? (
                  <div className="text-[13px] text-txt-tertiary italic">No outages detected in last 30 days.</div>
                ) : (
                  <div className="space-y-2">
                    {health.last30dOutages.map((o, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-page border border-bdr-light">
                        <Clock className="w-3.5 h-3.5 text-txt-tertiary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-txt-primary">
                            {fmtDateTime(o.start)} — {fmtDateTime(o.end)}
                          </div>
                          <div className="text-[11px] text-txt-secondary">{o.durationHours}h offline</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function OcemsLiveGridCanvas() {
  const { token } = useAuth()
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [healthModal, setHealthModal] = useState<{ id: string; name: string } | null>(null)

  // Health cache: stationId → StationHealth (loaded lazily when first seen offline)
  const [healthCache, setHealthCache] = useState<Record<string, StationHealth>>({})

  const load = useCallback(async () => {
    try {
      const data = await api<{ stations: Station[] }>('/api/sensors/stations/latest?type=OCEMS', { token: token ?? undefined })
      setStations(data.stations ?? [])
      setError(null)
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not load OCEMS stations.')
    } finally {
      setLoading(false)
      setLastUpdated(new Date())
    }
  }, [token])

  useEffect(() => {
    void load()
    const id = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(id)
  }, [load])

  // Lazy-load health for offline/unknown stations so we can show last-seen + outage count
  useEffect(() => {
    const offlineIds = stations
      .filter(s => stationLevel(s) === 'offline' || stationLevel(s) === 'unknown')
      .map(s => s.id)
      .filter(sid => !(sid in healthCache))

    if (offlineIds.length === 0 || !token) return

    Promise.allSettled(
      offlineIds.map(sid =>
        api<StationHealth>(`/api/sensors/stations/${sid}/health`, { token })
          .then(h => ({ sid, h }))
      )
    ).then(results => {
      const additions: Record<string, StationHealth> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') {
          additions[r.value.sid] = r.value.h
        }
      }
      if (Object.keys(additions).length > 0) {
        setHealthCache(prev => ({ ...prev, ...additions }))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, token])

  const counts = useMemo(() => ({
    ok:       stations.filter(s => stationLevel(s) === 'ok').length,
    warn:     stations.filter(s => stationLevel(s) === 'warn').length,
    critical: stations.filter(s => stationLevel(s) === 'critical').length,
    offline:  stations.filter(s => stationLevel(s) === 'offline').length,
    unknown:  stations.filter(s => stationLevel(s) === 'unknown').length,
  }), [stations])

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-bdr-light flex-shrink-0">
        <div>
          <h2 className="text-[16px] font-bold text-txt-primary">OCEMS Live Grid</h2>
          <p className="text-[12px] text-txt-secondary mt-0.5">Online Continuous Effluent Monitoring · auto-refresh every 30s</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-txt-tertiary">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => { void load() }}
            className="p-2 rounded-lg hover:bg-surface-secondary text-txt-secondary"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap gap-3 px-6 py-3 bg-white border-b border-bdr-light flex-shrink-0">
        {[
          { label: 'All within norm',   count: counts.ok,       cls: 'text-ok border-ok/30 bg-ok-light/40' },
          { label: 'Approaching limit', count: counts.warn,     cls: 'text-warn border-warn/30 bg-warn-light/40' },
          { label: 'Exceeding norm',    count: counts.critical, cls: 'text-danger border-danger/30 bg-danger-light/40' },
          { label: 'Offline',           count: counts.offline,  cls: 'text-txt-secondary border-bdr bg-surface-secondary' },
          ...(counts.unknown > 0 ? [{ label: 'No data', count: counts.unknown, cls: 'text-txt-secondary border-bdr bg-white' }] : []),
        ].map(item => (
          <div key={item.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-card border text-[12px] font-medium ${item.cls}`}>
            <span className="text-[18px] font-bold">{item.count}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-danger-light border border-danger/30 rounded-card text-danger text-[13px]">
          {error}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && stations.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-txt-tertiary text-[14px]">Loading OCEMS stations…</div>
        ) : stations.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-txt-tertiary text-[14px]">No OCEMS stations found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stations.map(station => {
              const level = stationLevel(station)
              const style = STATION_STYLES[level]
              const isOffline = level === 'offline' || level === 'unknown'
              const health = healthCache[station.id]
              const latestTs = station.readings.length > 0
                ? station.readings.map(r => r.timestamp).sort().pop()!
                : null

              // Offline subtext
              const offlineSubtext = isOffline && health
                ? `Last seen ${health.hoursSinceLastReading != null ? `${health.hoursSinceLastReading.toFixed(0)}h ago` : '—'} · ${health.outageCount30d} outage${health.outageCount30d !== 1 ? 's' : ''} in 30d`
                : isOffline
                  ? latestTs ? `Last seen ${timeAgo(latestTs)}` : 'No readings found'
                  : null

              return (
                <div
                  key={station.id}
                  className={`rounded-card border p-4 shadow-card flex flex-col gap-3 animate-bubble-in ${style.card}`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {level === 'critical' && <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />}
                        {level === 'ok' && <CheckCircle className="w-4 h-4 text-ok flex-shrink-0" />}
                        {level === 'offline' && <WifiOff className="w-4 h-4 text-txt-tertiary flex-shrink-0" />}
                        {isOffline && health?.autoInspectionTriggered && (
                          <span title="Auto-inspection triggered">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          </span>
                        )}
                        <span className="text-[12px] font-bold text-txt-primary leading-tight truncate">{station.name}</span>
                      </div>
                      {station.industry && (
                        <div className="text-[11px] text-txt-secondary truncate flex items-center gap-1 mt-0.5">
                          <Factory className="w-3 h-3 flex-shrink-0" /> {station.industry.name}
                        </div>
                      )}
                      <div className="text-[10px] text-txt-tertiary mt-0.5">
                        {station.district ?? '—'}
                        {!isOffline && latestTs && ` · ${timeAgo(latestTs)}`}
                      </div>
                      {/* Offline subtext */}
                      {offlineSubtext && (
                        <div className="text-[10px] text-amber-600 mt-0.5 font-medium">{offlineSubtext}</div>
                      )}
                    </div>
                    <span className={style.chip}>{style.chipLabel}</span>
                  </div>

                  {/* Readings or offline buttons */}
                  {station.readings.length === 0 ? (
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-txt-tertiary italic">
                        {station.status === 'active' ? 'No readings yet.' : `Station ${station.status}.`}
                      </div>
                      {isOffline && (
                        <button
                          onClick={() => setHealthModal({ id: station.id, name: station.name })}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/5 border border-primary/20 transition-colors"
                        >
                          <Activity className="w-3 h-3" />
                          View health
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
                        {station.readings.map(r => {
                          const lvl = readingLevel(r)
                          const hasRange = r.normMin != null && r.normMax != null && r.normMax > r.normMin * 1.05
                          const limitLabel =
                            hasRange ? `${r.normMin}–${r.normMax}` :
                            r.normMax != null ? `${r.normMax}` :
                            r.normMin != null ? `${r.normMin}` : null
                          return (
                            <div key={r.parameter} className="flex flex-col">
                              <span className="text-[9px] uppercase tracking-wider text-txt-tertiary truncate">{r.parameter}</span>
                              <span className={`text-[13px] leading-tight ${READING_STYLES[lvl]}`}>
                                {Number.isFinite(r.value) ? r.value.toFixed(r.value < 10 ? 2 : 1) : '—'}
                              </span>
                              {limitLabel != null && (
                                <span className="text-[9px] text-txt-tertiary truncate">norm {limitLabel}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {/* View health for offline-ish stations with readings */}
                      {isOffline && (
                        <button
                          onClick={() => setHealthModal({ id: station.id, name: station.name })}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/5 border border-primary/20 transition-colors"
                        >
                          <Activity className="w-3 h-3" />
                          View health
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Health modal */}
      {healthModal && (
        <HealthModal
          stationId={healthModal.id}
          stationName={healthModal.name}
          token={token}
          onClose={() => setHealthModal(null)}
        />
      )}
    </div>
  )
}
