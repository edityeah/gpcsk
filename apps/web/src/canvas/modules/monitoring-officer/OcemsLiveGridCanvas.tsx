/**
 * OcemsLiveGridCanvas — live grid of OCEMS stations, each showing its
 * latest reading per parameter against the CPCB norm.
 *
 * Backend: GET /api/sensors/stations/latest?type=OCEMS
 *   → { stations: [{ id, name, status, industry, district, readings: [{ parameter, value, unit, norm, normUnit, timestamp, validity }] }] }
 *
 * Auto-refreshes every 30 seconds.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle, WifiOff, Factory } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { api } from '../../../lib/api.js'

interface Reading {
  parameter: string
  value: number
  unit: string
  norm: number | null
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

type Level = 'ok' | 'warn' | 'critical' | 'offline' | 'unknown'

function readingLevel(r: Reading): Level {
  if (r.norm == null) return 'unknown'
  const ratio = r.value / r.norm
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
  ok:       { card: 'border-ok/40 bg-white',           chip: 'badge badge-ok',     chipLabel: 'All within norm' },
  warn:     { card: 'border-warn/50 bg-warn-light/30',  chip: 'badge badge-warn',   chipLabel: 'Approaching limit' },
  critical: { card: 'border-danger/60 bg-danger-light/40', chip: 'badge badge-danger', chipLabel: 'Exceeding norm' },
  offline:  { card: 'border-bdr bg-surface-secondary',  chip: 'badge badge-info',   chipLabel: 'Offline' },
  unknown:  { card: 'border-bdr bg-white',              chip: 'badge badge-info',   chipLabel: 'No data yet' },
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

export function OcemsLiveGridCanvas() {
  const { token } = useAuth()
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const counts = useMemo(() => ({
    ok: stations.filter(s => stationLevel(s) === 'ok').length,
    warn: stations.filter(s => stationLevel(s) === 'warn').length,
    critical: stations.filter(s => stationLevel(s) === 'critical').length,
    offline: stations.filter(s => stationLevel(s) === 'offline').length,
    unknown: stations.filter(s => stationLevel(s) === 'unknown').length,
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
          { label: 'All within norm',  count: counts.ok,       cls: 'text-ok border-ok/30 bg-ok-light/40' },
          { label: 'Approaching limit', count: counts.warn,    cls: 'text-warn border-warn/30 bg-warn-light/40' },
          { label: 'Exceeding norm',   count: counts.critical, cls: 'text-danger border-danger/30 bg-danger-light/40' },
          { label: 'Offline',          count: counts.offline,  cls: 'text-txt-secondary border-bdr bg-surface-secondary' },
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
              const latestTs = station.readings.length > 0
                ? station.readings.map(r => r.timestamp).sort().pop()!
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
                        <span className="text-[12px] font-bold text-txt-primary leading-tight truncate">{station.name}</span>
                      </div>
                      {station.industry && (
                        <div className="text-[11px] text-txt-secondary truncate flex items-center gap-1 mt-0.5">
                          <Factory className="w-3 h-3 flex-shrink-0" /> {station.industry.name}
                        </div>
                      )}
                      <div className="text-[10px] text-txt-tertiary mt-0.5">
                        {station.district ?? '—'}
                        {latestTs && ` · ${timeAgo(latestTs)}`}
                      </div>
                    </div>
                    <span className={style.chip}>{style.chipLabel}</span>
                  </div>

                  {/* Readings */}
                  {station.readings.length === 0 ? (
                    <div className="text-[11px] text-txt-tertiary italic">
                      {station.status === 'active' ? 'No readings yet.' : `Station ${station.status}.`}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
                      {station.readings.map(r => {
                        const lvl = readingLevel(r)
                        const pct = r.norm ? Math.min(Math.round((r.value / r.norm) * 100), 200) : null
                        return (
                          <div key={r.parameter} className="flex flex-col">
                            <span className="text-[9px] uppercase tracking-wider text-txt-tertiary truncate">{r.parameter}</span>
                            <span className={`text-[13px] leading-tight ${READING_STYLES[lvl]}`}>
                              {Number.isFinite(r.value) ? r.value.toFixed(r.value < 10 ? 2 : 1) : '—'}
                            </span>
                            {r.norm != null && (
                              <span className="text-[9px] text-txt-tertiary truncate">
                                {pct}% of {r.norm}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
