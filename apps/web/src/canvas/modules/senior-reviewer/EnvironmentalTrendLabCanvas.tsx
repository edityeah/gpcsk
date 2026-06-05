/**
 * EnvironmentalTrendLabCanvas — Senior Reviewer mega-dashboard #4
 *
 * Picker: station type → station → parameter → range (7d / 30d / 90d / 12m)
 * recharts LineChart showing sensor value + dashed norm threshold
 * Festival vertical markers (Ganesh Utsav window)
 * Side panel: summary stats (min, max, avg, % above norm)
 */

import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart2, Layers, RefreshCw } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { api } from '../../../lib/api.js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Station {
  id: string
  name: string
  type: string
}

interface TrendSeries {
  timestamp: string
  value: number
  unit: string
}

interface TrendData {
  stationId: string
  stationName: string
  stationType: string
  parameter: string
  normValue: number | null
  normUnit: string | null
  series: TrendSeries[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATION_TYPES = ['OCEMS', 'CEQMS', 'AAQM', 'MINARS', 'GEMS', 'VOC'] as const

// Common parameters per type (best-effort for quick-pick)
const PARAM_SUGGESTIONS: Record<string, string[]> = {
  OCEMS:  ['PM10', 'PM2.5', 'SO2', 'NOx', 'CO'],
  CEQMS:  ['COD', 'BOD', 'pH', 'TSS', 'TDS'],
  AAQM:   ['PM10', 'PM2.5', 'SO2', 'NOx', 'NH3', 'O3'],
  MINARS: ['pH', 'DO', 'BOD', 'COD', 'Conductivity'],
  GEMS:   ['pH', 'DO', 'BOD', 'COD', 'Turbidity'],
  VOC:    ['Benzene', 'Toluene', 'Xylene', 'Ethylbenzene'],
}

const RANGES: { label: string; days: number }[] = [
  { label: '7 days',  days: 7   },
  { label: '30 days', days: 30  },
  { label: '90 days', days: 90  },
  { label: '12 months', days: 365 },
]

// Ganesh Utsav 2023 window (for demo markers)
const FESTIVAL_START = new Date('2023-09-19T00:00:00Z').getTime()
const FESTIVAL_END   = new Date('2023-09-28T23:59:59Z').getTime()

// ── Tooltip ───────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-bdr rounded-xl shadow-modal px-3 py-2 text-[11px]">
      <div className="text-txt-tertiary mb-1">{label ? new Date(label).toLocaleString() : ''}</div>
      {payload.map((p, i) => (
        <div key={i} className={`font-bold ${p.name === 'Norm' ? 'text-danger' : 'text-primary'}`}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  )
}

// ── Side panel stats ──────────────────────────────────────────────────────────

function SideStats({ data }: { data: TrendData }) {
  const values = data.series.map(s => s.value)
  if (!values.length) return <div className="text-txt-tertiary text-sm py-4">No data.</div>

  const mn = Math.min(...values)
  const mx = Math.max(...values)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const norm = data.normValue
  const aboveNorm = norm != null ? values.filter(v => v > norm).length : 0
  const abovePct  = norm != null ? Math.round((aboveNorm / values.length) * 100) : null

  const unit = data.series[0]?.unit ?? ''

  const rows: Array<{ label: string; value: string; danger?: boolean }> = [
    { label: 'Min',     value: `${mn.toFixed(2)} ${unit}` },
    { label: 'Max',     value: `${mx.toFixed(2)} ${unit}`, danger: norm != null && mx > norm },
    { label: 'Average', value: `${avg.toFixed(2)} ${unit}`, danger: norm != null && avg > norm },
    { label: 'Norm',    value: norm != null ? `${norm} ${data.normUnit ?? ''}` : '—' },
    { label: 'Readings',value: `${values.length}` },
    ...(abovePct != null ? [{ label: '% Above Norm', value: `${abovePct}%`, danger: abovePct > 20 }] : []),
  ]

  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.label} className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-txt-tertiary">{r.label}</span>
          <span className={`text-[12px] font-bold tabular-nums ${r.danger ? 'text-danger' : 'text-txt-primary'}`}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function EnvironmentalTrendLabCanvas() {
  const { token } = useAuth()

  const [stationType, setStationType] = useState<string>('AAQM')
  const [stations, setStations] = useState<Station[]>([])
  const [selectedStation, setSelectedStation] = useState<string>('')
  const [parameter, setParameter] = useState<string>('PM10')
  const [rangeDays, setRangeDays] = useState<number>(30)
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(false)
  const [stationsLoading, setStationsLoading] = useState(false)

  // Load stations when type changes
  useEffect(() => {
    if (!token) return
    setStationsLoading(true)
    setSelectedStation('')
    setTrendData(null)
    api<{ stations: Station[] }>(`/api/sensors/stations?type=${stationType}&limit=100`, { token })
      .then(d => {
        setStations(d.stations)
        if (d.stations.length > 0) setSelectedStation(d.stations[0]!.id)
      })
      .catch(() => setStations([]))
      .finally(() => setStationsLoading(false))
  }, [stationType, token])

  // Default parameter when type changes
  useEffect(() => {
    const suggested = PARAM_SUGGESTIONS[stationType]
    if (suggested?.length) setParameter(suggested[0]!)
  }, [stationType])

  async function fetchTrend() {
    if (!token || !selectedStation || !parameter) return
    setLoading(true)
    const toDate = new Date()
    const fromDate = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000)
    const params = new URLSearchParams({
      stationId: selectedStation,
      parameter,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    })
    try {
      const d = await api<TrendData>(`/api/stats/trend-lab?${params}`, { token })
      setTrendData(d)
    } catch {
      setTrendData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedStation && parameter) void fetchTrend()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStation, parameter, rangeDays])

  // Build chart series with festival markers
  const chartData = useMemo(() => {
    if (!trendData) return []
    return trendData.series.map(s => ({
      ts: new Date(s.timestamp).getTime(),
      value: s.value,
      norm: trendData.normValue ?? undefined,
    }))
  }, [trendData])

  // Festival markers visible in range?
  const showFestival = chartData.some(
    d => d.ts >= FESTIVAL_START - 7 * 86400000 && d.ts <= FESTIVAL_END + 7 * 86400000,
  )

  const paramSuggestions = PARAM_SUGGESTIONS[stationType] ?? []

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <BarChart2 className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-[20px] font-bold text-txt-primary">Environmental Trend Lab</h2>
          <p className="text-[12px] text-txt-tertiary mt-0.5">Pick a station and parameter to view trends with norm thresholds.</p>
        </div>
      </div>

      {/* Picker row */}
      <div className="bg-white rounded-card shadow-card p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Station type */}
          <div>
            <label className="block text-[10px] text-txt-tertiary font-medium mb-1 uppercase tracking-wider">Station Type</label>
            <select
              value={stationType}
              onChange={e => setStationType(e.target.value)}
              className="border border-bdr rounded-xl px-3 py-2 text-[12px] outline-none bg-white"
            >
              {STATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Station */}
          <div>
            <label className="block text-[10px] text-txt-tertiary font-medium mb-1 uppercase tracking-wider">Station</label>
            {stationsLoading ? (
              <div className="flex items-center gap-1.5 text-[12px] text-txt-tertiary px-3 py-2 border border-bdr rounded-xl">
                <RefreshCw className="w-3 h-3 animate-spin" /> Loading…
              </div>
            ) : (
              <select
                value={selectedStation}
                onChange={e => setSelectedStation(e.target.value)}
                className="border border-bdr rounded-xl px-3 py-2 text-[12px] outline-none bg-white max-w-[200px]"
                disabled={!stations.length}
              >
                {stations.length === 0 && <option value="">No stations</option>}
                {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>

          {/* Parameter */}
          <div>
            <label className="block text-[10px] text-txt-tertiary font-medium mb-1 uppercase tracking-wider">Parameter</label>
            <div className="flex items-center gap-1">
              <input
                value={parameter}
                onChange={e => setParameter(e.target.value)}
                className="border border-bdr rounded-xl px-3 py-2 text-[12px] outline-none w-28"
                placeholder="e.g. PM10"
              />
              <div className="flex items-center gap-1 flex-wrap">
                {paramSuggestions.map(p => (
                  <button
                    key={p}
                    onClick={() => setParameter(p)}
                    className={`chip text-[10px] py-1 ${parameter === p ? 'bg-primary text-white border-primary' : ''}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Range */}
          <div>
            <label className="block text-[10px] text-txt-tertiary font-medium mb-1 uppercase tracking-wider">Range</label>
            <div className="flex items-center gap-1">
              {RANGES.map(r => (
                <button
                  key={r.days}
                  onClick={() => setRangeDays(r.days)}
                  className={`px-3 py-1.5 rounded-pill text-[11px] font-medium border transition-colors ${
                    rangeDays === r.days
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-txt-secondary border-bdr hover:bg-surface-page'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
        {/* Chart */}
        <div className="bg-white rounded-card shadow-card p-5">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-txt-secondary text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading data…
            </div>
          ) : !trendData || chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-txt-tertiary text-sm">
              No data for selected parameters.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-bold text-[14px] text-txt-primary">{trendData.parameter}</div>
                  <div className="text-[11px] text-txt-tertiary">{trendData.stationName} · {trendData.stationType}</div>
                </div>
                {trendData.normValue != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 border-t-2 border-dashed border-danger" />
                    <span className="text-[10px] text-danger font-medium">Norm: {trendData.normValue} {trendData.normUnit}</span>
                  </div>
                )}
              </div>

              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={t => new Date(t as number).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 10, fill: '#B8C0CC' }}
                    tickCount={8}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#B8C0CC' }} width={40} />
                  <Tooltip content={<CustomTooltip />} />

                  {/* Festival reference lines */}
                  {showFestival && (
                    <>
                      <ReferenceLine x={FESTIVAL_START} stroke="#7C3AED" strokeDasharray="4 4" label={{ value: '🪔 Ganesh Start', fill: '#7C3AED', fontSize: 9 }} />
                      <ReferenceLine x={FESTIVAL_END}   stroke="#7C3AED" strokeDasharray="4 4" label={{ value: 'Festival End', fill: '#7C3AED', fontSize: 9 }} />
                    </>
                  )}

                  {/* Norm reference line */}
                  {trendData.normValue != null && (
                    <ReferenceLine y={trendData.normValue} stroke="#E53935" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: 'Norm', fill: '#E53935', fontSize: 9, position: 'right' }} />
                  )}

                  <Line
                    type="monotone"
                    dataKey="value"
                    name={trendData.parameter}
                    stroke="#386AF6"
                    strokeWidth={2}
                    dot={chartData.length < 60}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Side stats */}
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-[13px] text-txt-primary">Summary</h3>
          </div>
          {trendData ? (
            <SideStats data={trendData} />
          ) : (
            <div className="text-txt-tertiary text-[12px]">Select a station and parameter to see stats.</div>
          )}

          {/* Festival info */}
          {showFestival && (
            <div className="mt-4 p-3 rounded-xl bg-flag-light border border-flag/20">
              <div className="text-[11px] font-bold text-flag mb-1">Festival Period</div>
              <div className="text-[10px] text-flag/80">Ganesh Utsav 2023: Sep 19–28</div>
              <div className="text-[10px] text-flag/80 mt-0.5">Vertical markers shown on chart.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
