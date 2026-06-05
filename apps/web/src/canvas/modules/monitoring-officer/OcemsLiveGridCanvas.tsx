/**
 * OcemsLiveGridCanvas — grid of OCEMS stations colour-coded by margin.
 * Polls /api/sensors/stations?type=OCEMS every 30 seconds.
 */

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { api } from '../../../lib/api.js'

interface OcemsStation {
  id: string
  name: string
  industry: string
  district: string
  parameter: string
  value: number
  unit: string
  norm: number
  status: 'active' | 'down' | 'calibration'
  lastReadingAt: string
}

type MarginLevel = 'ok' | 'warn' | 'critical' | 'offline'

function getMarginLevel(station: OcemsStation): MarginLevel {
  if (station.status !== 'active') return 'offline'
  const ratio = station.value / station.norm
  if (ratio >= 1) return 'critical'
  if (ratio >= 0.8) return 'warn'
  return 'ok'
}

const MARGIN_STYLES: Record<MarginLevel, { card: string; badge: string; label: string }> = {
  ok:       { card: 'border-ok/40 bg-ok-light/30',       badge: 'badge badge-ok',    label: 'Within norm' },
  warn:     { card: 'border-warn/40 bg-warn-light/30',    badge: 'badge badge-warn',  label: 'Nearing limit' },
  critical: { card: 'border-danger/50 bg-danger-light/40', badge: 'badge badge-danger', label: 'Exceeds norm' },
  offline:  { card: 'border-bdr bg-surface-secondary',    badge: 'badge badge-info',  label: 'Offline' },
}

// Seed-like fallback data when API is unavailable in demo
const DEMO_STATIONS: OcemsStation[] = [
  { id: 's1',  name: 'Vatva-OCEMS-01',    industry: 'Gujarat Alkalis & Chemicals', district: 'Ahmedabad', parameter: 'SO2',  value: 42,  unit: 'µg/m³', norm: 80,  status: 'active', lastReadingAt: new Date().toISOString() },
  { id: 's2',  name: 'Vatva-OCEMS-02',    industry: 'Pushpak Ind',                 district: 'Ahmedabad', parameter: 'NOx',  value: 95,  unit: 'µg/m³', norm: 100, status: 'active', lastReadingAt: new Date().toISOString() },
  { id: 's3',  name: 'Naroda-OCEMS-01',   industry: 'Nirma Ltd',                   district: 'Ahmedabad', parameter: 'PM10', value: 130, unit: 'µg/m³', norm: 100, status: 'active', lastReadingAt: new Date().toISOString() },
  { id: 's4',  name: 'Ankleshwar-01',     industry: 'INEOS Styrolution',           district: 'Bharuch',   parameter: 'SO2',  value: 38,  unit: 'µg/m³', norm: 80,  status: 'active', lastReadingAt: new Date().toISOString() },
  { id: 's5',  name: 'Ankleshwar-02',     industry: 'Clariant Chemicals',          district: 'Bharuch',   parameter: 'NOx',  value: 78,  unit: 'µg/m³', norm: 100, status: 'active', lastReadingAt: new Date().toISOString() },
  { id: 's6',  name: 'Vapi-OCEMS-01',     industry: 'Jubilant Pharmova',           district: 'Valsad',    parameter: 'PM2.5',value: 45,  unit: 'µg/m³', norm: 60,  status: 'active', lastReadingAt: new Date().toISOString() },
  { id: 's7',  name: 'Sachin-OCEMS-01',   industry: 'Alok Industries',             district: 'Surat',     parameter: 'COD',  value: 250, unit: 'mg/L',  norm: 250, status: 'active', lastReadingAt: new Date().toISOString() },
  { id: 's8',  name: 'Panoli-OCEMS-01',   industry: 'Deepak Nitrite',              district: 'Bharuch',   parameter: 'SO2',  value: 22,  unit: 'µg/m³', norm: 80,  status: 'down',   lastReadingAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 's9',  name: 'Dahej-OCEMS-01',    industry: 'ONGC Petro additions',        district: 'Bharuch',   parameter: 'VOC',  value: 61,  unit: 'µg/m³', norm: 50,  status: 'active', lastReadingAt: new Date().toISOString() },
  { id: 's10', name: 'Hazira-OCEMS-01',   industry: 'L&T Hydrocarbon Eng.',        district: 'Surat',     parameter: 'NOx',  value: 55,  unit: 'µg/m³', norm: 100, status: 'active', lastReadingAt: new Date().toISOString() },
  { id: 's11', name: 'Morbi-OCEMS-01',    industry: 'Kajaria Ceramics',            district: 'Morbi',     parameter: 'PM10', value: 118, unit: 'µg/m³', norm: 100, status: 'active', lastReadingAt: new Date().toISOString() },
  { id: 's12', name: 'Odhav-OCEMS-01',    industry: 'Asian Paints',                district: 'Ahmedabad', parameter: 'VOC',  value: 30,  unit: 'µg/m³', norm: 50,  status: 'calibration', lastReadingAt: new Date(Date.now() - 7200000).toISOString() },
]

export function OcemsLiveGridCanvas() {
  const { token } = useAuth()
  const [stations, setStations] = useState<OcemsStation[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<OcemsStation[]>('/api/sensors/stations?type=OCEMS', { token: token ?? undefined })
      setStations(data)
      setError(null)
    } catch {
      // Fallback to demo data
      setStations(DEMO_STATIONS)
      setError(null)
    } finally {
      setLoading(false)
      setLastUpdated(new Date())
    }
  }, [token])

  useEffect(() => {
    void load()
    const interval = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const counts = {
    ok: stations.filter(s => getMarginLevel(s) === 'ok').length,
    warn: stations.filter(s => getMarginLevel(s) === 'warn').length,
    critical: stations.filter(s => getMarginLevel(s) === 'critical').length,
    offline: stations.filter(s => getMarginLevel(s) === 'offline').length,
  }

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-bdr-light flex-shrink-0">
        <div>
          <h2 className="text-[16px] font-bold text-txt-primary">OCEMS Live Grid</h2>
          <p className="text-[12px] text-txt-secondary mt-0.5">Online Continuous Emission Monitoring — auto-refreshes every 30s</p>
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
      <div className="flex gap-3 px-6 py-3 bg-white border-b border-bdr-light flex-shrink-0">
        {[
          { label: 'Within norm', count: counts.ok, cls: 'text-ok border-ok/30 bg-ok-light/40' },
          { label: 'Nearing limit', count: counts.warn, cls: 'text-warn border-warn/30 bg-warn-light/40' },
          { label: 'Exceeds norm', count: counts.critical, cls: 'text-danger border-danger/30 bg-danger-light/40' },
          { label: 'Offline', count: counts.offline, cls: 'text-txt-secondary border-bdr bg-surface-secondary' },
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
          <div className="flex items-center justify-center h-32 text-txt-tertiary text-[14px]">Loading stations…</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {stations.map(station => {
              const level = getMarginLevel(station)
              const style = MARGIN_STYLES[level]
              const pct = Math.round((station.value / station.norm) * 100)
              return (
                <div
                  key={station.id}
                  className={`rounded-card border p-4 shadow-card flex flex-col gap-2 animate-bubble-in transition-colors ${style.card}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[12px] font-bold text-txt-primary leading-tight truncate">{station.name}</span>
                    {level === 'critical' && <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />}
                    {level === 'ok' && <CheckCircle className="w-4 h-4 text-ok flex-shrink-0" />}
                    {level === 'offline' && <WifiOff className="w-4 h-4 text-txt-tertiary flex-shrink-0" />}
                  </div>

                  <div className="text-[11px] text-txt-secondary truncate">{station.industry}</div>
                  <div className="text-[11px] text-txt-tertiary">{station.district}</div>

                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-[20px] font-bold text-txt-primary">{station.value}</span>
                    <span className="text-[11px] text-txt-secondary">{station.unit}</span>
                    <span className="text-[11px] text-txt-tertiary ml-1">/ {station.norm} norm</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        level === 'critical' ? 'bg-danger' : level === 'warn' ? 'bg-warn' : 'bg-ok'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-txt-secondary">{station.parameter}</span>
                    <span className={style.badge}>{style.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
