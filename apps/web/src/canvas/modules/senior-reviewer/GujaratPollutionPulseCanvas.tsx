/**
 * GujaratPollutionPulseCanvas — Senior Reviewer mega-dashboard #1
 *
 * • KPI tiles: live exceedances 24h, industries-with-exceedance %, complaints today
 * • District × Stream heatmap (33 districts × 4 streams)
 * • Top-10 risk industries
 * • Breaking Anomalies feed
 * • Polls /api/stats/pulse every 60 s
 */

import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Factory,
  MessageCircle,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { api } from '../../../lib/api.js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DistrictStream {
  district: string | null
  stream: string
  count: number
}

interface RiskIndustry {
  industryId: string
  name: string
  districtId: string | null
  openViolations: number
  pendingExceedances: number
}

interface BreakingAnomaly {
  id: string
  parameter: string
  observedValue: number
  normValue: number
  breachMagnitude: number
  severity: string
  detectedAt: string
  stationName: string
  stationType: string
}

interface PulseData {
  districtStream: DistrictStream[]
  liveExceedanceCount24h: number
  topRiskIndustries: RiskIndustry[]
  breakingAnomalies: BreakingAnomaly[]
}

// ── Heatmap helpers ───────────────────────────────────────────────────────────

const STREAMS = ['AIR', 'WATER', 'OTHER'] as const
type Stream = (typeof STREAMS)[number]

const STREAM_LABEL: Record<Stream, string> = {
  AIR:   'Air',
  WATER: 'Water',
  OTHER: 'Other',
}

const STREAM_COLOR: Record<Stream, string> = {
  AIR:   'bg-sky-100 text-sky-700',
  WATER: 'bg-blue-100 text-blue-700',
  OTHER: 'bg-slate-100 text-slate-600',
}

function heatColor(count: number, max: number): string {
  if (max === 0 || count === 0) return 'bg-slate-50 text-slate-300'
  const ratio = count / max
  if (ratio > 0.75) return 'bg-danger text-white'
  if (ratio > 0.45) return 'bg-warn text-txt-primary'
  if (ratio > 0.2)  return 'bg-yellow-200 text-yellow-800'
  return 'bg-green-100 text-green-700'
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────

interface KpiTileProps {
  icon: React.ReactNode
  label: string
  value: number | string
  sub?: string
  accent?: string
}

function KpiTile({ icon, label, value, sub, accent = 'text-primary' }: KpiTileProps) {
  return (
    <div className="bg-white rounded-card shadow-card p-5 flex items-start gap-4 animate-slide-in">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-primary-light ${accent} flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`text-[28px] font-bold leading-none ${accent}`}>{value}</div>
        <div className="text-[13px] font-semibold text-txt-primary mt-1">{label}</div>
        {sub && <div className="text-[11px] text-txt-tertiary mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ── District ID → Name lookup (built from industries endpoint) ────────────────

async function fetchDistrictMap(token: string): Promise<Map<string, string>> {
  try {
    const res = await api<{ items: Array<{ districtId: string; district: { name: string } | null }> }>(
      '/api/industries?limit=100',
      { token },
    )
    const map = new Map<string, string>()
    for (const ind of res.items) {
      if (ind.districtId && ind.district?.name) {
        map.set(ind.districtId, ind.district.name)
      }
    }
    return map
  } catch {
    return new Map()
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function GujaratPollutionPulseCanvas() {
  const { token } = useAuth()
  const [data, setData] = useState<PulseData | null>(null)
  const [districtMap, setDistrictMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchPulse() {
    if (!token) return
    try {
      setRefreshing(true)
      const [d, dm] = await Promise.all([
        api<PulseData>('/api/stats/pulse', { token }),
        districtMap.size === 0 ? fetchDistrictMap(token) : Promise.resolve(districtMap),
      ])
      setData(d)
      if (dm.size > 0) setDistrictMap(dm)
      setLastRefresh(new Date())
    } catch {
      // silent — stale data displayed
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchPulse()
    intervalRef.current = setInterval(() => { void fetchPulse() }, 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // ── Build heatmap matrix (resolve district IDs → names) ──────────────────

  const heatMatrix = (() => {
    if (!data) return { districts: [] as string[], matrix: new Map<string, Map<string, number>>(), max: 0 }
    const districtSet = new Set<string>()
    const matrix = new Map<string, Map<string, number>>()
    let max = 0

    for (const r of data.districtStream) {
      // r.district may be an ID — resolve to name
      const rawId = r.district ?? ''
      const d = (rawId && districtMap.get(rawId)) ?? (rawId.length < 30 ? rawId : 'Unknown')
      districtSet.add(d)
      if (!matrix.has(d)) matrix.set(d, new Map())
      const streamMap = matrix.get(d)!
      const prev = streamMap.get(r.stream) ?? 0
      const next = prev + r.count
      streamMap.set(r.stream, next)
      if (next > max) max = next
    }

    const districts = Array.from(districtSet).sort()
    return { districts, matrix, max }
  })()

  // Derive % industries with exceedance (rough: from top-risk list)
  const industriesWithExceedance = data?.topRiskIndustries.filter(i => i.pendingExceedances > 0).length ?? 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-txt-secondary text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading pulse data…
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold text-txt-primary">Gujarat Pollution Pulse</h2>
          <p className="text-[12px] text-txt-tertiary mt-0.5">
            Live statewide exceedance overview — refreshes every 60 s
            {lastRefresh && ` · Last: ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={() => { void fetchPulse() }}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-[12px] text-primary font-medium px-3 py-1.5 rounded-card border border-primary-light hover:bg-primary-light transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiTile
          icon={<Zap className="w-6 h-6" />}
          label="Live Exceedances (24h)"
          value={data?.liveExceedanceCount24h ?? 0}
          sub="Pending dispositions"
          accent="text-danger"
        />
        <KpiTile
          icon={<Factory className="w-6 h-6" />}
          label="Industries with Exceedance"
          value={industriesWithExceedance}
          sub="From top-risk list"
          accent="text-warn"
        />
        <KpiTile
          icon={<MessageCircle className="w-6 h-6" />}
          label="Breaking Anomalies"
          value={data?.breakingAnomalies.length ?? 0}
          sub="Critical severity, pending"
          accent="text-flag"
        />
      </div>

      {/* District × Stream Heatmap */}
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-[14px] text-txt-primary">District × Pollution Stream Heatmap</h3>
          <span className="text-[11px] text-txt-tertiary ml-auto">30-day window</span>
        </div>

        {heatMatrix.districts.length === 0 ? (
          <div className="text-center py-8 text-txt-tertiary text-sm">No exceedance data available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  <th className="text-left pr-3 py-1.5 text-txt-tertiary font-medium w-32">District</th>
                  {STREAMS.map(s => (
                    <th key={s} className="px-2 py-1.5 text-center">
                      <span className={`badge ${STREAM_COLOR[s]} text-[10px] font-bold`}>{STREAM_LABEL[s]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatMatrix.districts.map(district => {
                  const streamMap = heatMatrix.matrix.get(district) ?? new Map()
                  return (
                    <tr key={district} className="border-t border-bdr-light hover:bg-surface-page/50">
                      <td className="pr-3 py-1.5 font-medium text-txt-secondary truncate max-w-[100px]" title={district}>
                        {district}
                      </td>
                      {STREAMS.map(s => {
                        const cnt = streamMap.get(s) ?? 0
                        return (
                          <td key={s} className="px-2 py-1.5 text-center">
                            <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${heatColor(cnt, heatMatrix.max)}`}>
                              {cnt > 0 ? cnt : '·'}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {[
            { color: 'bg-green-100 text-green-700', label: 'Low' },
            { color: 'bg-yellow-200 text-yellow-800', label: 'Moderate' },
            { color: 'bg-warn text-txt-primary', label: 'High' },
            { color: 'bg-danger text-white', label: 'Critical' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <span className={`inline-block w-5 h-3 rounded ${color.split(' ')[0]}`} />
              <span className="text-[10px] text-txt-tertiary">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top-10 Risk Industries */}
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Factory className="w-4 h-4 text-danger" />
            <h3 className="font-bold text-[14px] text-txt-primary">Top Risk Industries</h3>
          </div>
          {!data?.topRiskIndustries.length ? (
            <div className="text-txt-tertiary text-sm py-6 text-center">No high-risk industries found.</div>
          ) : (
            <ol className="space-y-2">
              {data.topRiskIndustries.map((ind, idx) => {
                const total = ind.openViolations + ind.pendingExceedances
                return (
                  <li key={ind.industryId} className="flex items-center gap-2 text-[12px]">
                    <span className="w-5 h-5 rounded-full bg-primary-light text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="flex-1 font-medium text-txt-primary truncate" title={ind.name}>{ind.name}</span>
                    <span className="badge badge-danger text-[10px]">{ind.openViolations}V</span>
                    <span className="badge badge-warn text-[10px]">{ind.pendingExceedances}E</span>
                    <span className="text-txt-tertiary font-bold tabular-nums w-8 text-right">{total}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {/* Breaking Anomalies feed */}
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-danger" />
            <h3 className="font-bold text-[14px] text-txt-primary">Breaking Anomalies</h3>
            <span className="ml-auto badge badge-danger">{data?.breakingAnomalies.length ?? 0} critical</span>
          </div>
          {!data?.breakingAnomalies.length ? (
            <div className="text-txt-tertiary text-sm py-6 text-center">No critical anomalies at this time.</div>
          ) : (
            <ul className="space-y-2.5">
              {data.breakingAnomalies.map(a => (
                <li key={a.id} className="p-3 rounded-xl border border-danger/20 bg-danger-light/30 animate-slide-in">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[12px] text-danger">{a.parameter}</span>
                    <span className="text-[10px] text-txt-tertiary">{new Date(a.detectedAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-[11px] text-txt-secondary mt-0.5">{a.stationName} · {a.stationType}</div>
                  <div className="text-[11px] text-txt-primary mt-1 font-medium">
                    {a.observedValue.toFixed(2)} vs norm {a.normValue.toFixed(2)}
                    <span className="ml-2 text-danger font-bold">+{a.breachMagnitude.toFixed(1)}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
