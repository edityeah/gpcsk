/**
 * PredictedExceedanceLabCanvas — pick a station; show 7-day series with dashed 24h projection.
 * Linear regression over the last 6 data points to project the next 24 hours.
 * Highlights where the projection crosses the norm.
 *
 * Uses /api/sensors/stations?type=OCEMS to list stations.
 * Prefers /api/sensors/stations/:id/readings for readings; falls back to
 * /api/sensors/readings?stationId=&parameter=&since=
 */

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, ChevronDown } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'
import { api } from '../../../lib/api.js'

// Real API station shape from /api/sensors/stations?type=OCEMS
interface ApiStation {
  id: string
  name: string
  type: string
  status: string
  parameters: string[]
  industry: {
    id: string
    name: string
    district: { id: string; name: string } | null
  } | null
}

interface ApiStationsResponse {
  stations: ApiStation[]
}

// Real API reading shape from /api/sensors/readings?stationId=&parameter=&since=
interface ApiReading {
  id: string
  parameter: string
  value: number
  unit: string
  timestamp: string
  validity: string
}

interface ApiReadingsResponse {
  readings: ApiReading[]
}

// Internal display types
interface Station {
  id: string
  name: string
  parameter: string
  unit: string
  norm: number | null
  districtName: string
}

interface Reading {
  timestamp: string
  value: number
}

interface ChartPoint {
  label: string
  actual?: number
  projected?: number
  norm?: number
}

/** Simple linear regression (least-squares) on last N points → slope, intercept */
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 }
  const sumX = points.reduce((a, p) => a + p.x, 0)
  const sumY = points.reduce((a, p) => a + p.y, 0)
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0)
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

function buildChartData(readings: Reading[], norm: number | null): ChartPoint[] {
  if (readings.length === 0) return []

  const actual: ChartPoint[] = readings.map(r => ({
    label: new Date(r.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit' }),
    actual: r.value,
    norm: norm ?? undefined,
  }))

  // Regression on last 6 readings
  const tail = readings.slice(-6)
  const t0 = new Date(tail[0]?.timestamp ?? readings[0]?.timestamp ?? '').getTime()
  const pts = tail.map(r => ({
    x: (new Date(r.timestamp).getTime() - t0) / 3600_000,
    y: r.value,
  }))
  const { slope, intercept } = linearRegression(pts)
  const lastTs = new Date(readings[readings.length - 1]?.timestamp ?? '').getTime()

  // 4 projection points: +6h, +12h, +18h, +24h
  const projected: ChartPoint[] = [0, 6, 12, 18, 24].map(h => {
    const x = (lastTs - t0) / 3600_000 + h
    const projValue = +(slope * x + intercept).toFixed(1)
    const ts = new Date(lastTs + h * 3600_000)
    return {
      label: ts.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit' }),
      projected: Math.max(0, projValue),
      norm: norm ?? undefined,
    }
  })

  // Merge last actual point as start of projection
  const merged = [...actual]
  const lastActual = merged[merged.length - 1]
  if (lastActual) {
    lastActual.projected = lastActual.actual
  }
  projected.slice(1).forEach(p => merged.push(p))
  return merged
}

export function PredictedExceedanceLabCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [stations, setStations] = useState<Station[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(false)
  const [stationsLoading, setStationsLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [selectedParam, setSelectedParam] = useState<string>('COD')

  const selectedStation = stations.find(s => s.id === selectedId) ?? stations[0]

  const loadStations = useCallback(async () => {
    if (!token) return
    setStationsLoading(true)
    try {
      const res = await api<ApiStationsResponse>('/api/sensors/stations?type=OCEMS&limit=100', { token })
      const raw: ApiStation[] = Array.isArray(res)
        ? (res as unknown as ApiStation[])
        : (res.stations ?? [])
      if (raw.length > 0) {
        // Build flat display stations — use first parameter of each station
        const flat: Station[] = raw.map(s => ({
          id: s.id,
          name: s.name,
          parameter: s.parameters[0] ?? 'COD',
          unit: 'mg/L',
          norm: null,
          districtName: s.industry?.district?.name ?? '',
        }))
        setStations(flat)
        setSelectedId(flat[0]!.id)
        setSelectedParam(flat[0]!.parameter)
      } else {
        showToast({ kind: 'warn', text: 'No OCEMS stations found.' })
      }
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load stations.' })
    } finally {
      setStationsLoading(false)
    }
  }, [token, showToast])

  const loadReadings = useCallback(async (stationId: string, parameter: string) => {
    if (!token || !stationId) return
    setLoading(true)
    try {
      const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
      let raw: ApiReading[] = []

      // Try the per-station readings endpoint first
      try {
        const res = await api<ApiReadingsResponse>(
          `/api/sensors/stations/${stationId}/readings?parameter=${encodeURIComponent(parameter)}&since=${since}`,
          { token },
        )
        raw = Array.isArray(res) ? (res as unknown as ApiReading[]) : (res.readings ?? [])
      } catch {
        // Fall back to the generic readings endpoint
        const res = await api<ApiReadingsResponse>(
          `/api/sensors/readings?stationId=${stationId}&parameter=${encodeURIComponent(parameter)}&since=${since}`,
          { token },
        )
        raw = Array.isArray(res) ? (res as unknown as ApiReading[]) : (res.readings ?? [])
      }

      const sorted = [...raw].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )
      setReadings(sorted.map(r => ({ timestamp: r.timestamp, value: r.value })))
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load readings.' })
      setReadings([])
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void loadStations() }, [loadStations])

  useEffect(() => {
    if (selectedId && selectedParam) void loadReadings(selectedId, selectedParam)
  }, [selectedId, selectedParam, loadReadings])

  const chartData = buildChartData(readings, selectedStation?.norm ?? null)
  const norm = selectedStation?.norm ?? null

  // Check if projection crosses norm
  const projCross = norm !== null && chartData.some(p => p.projected !== undefined && p.projected >= norm)

  if (stationsLoading) {
    return (
      <div className="h-full flex items-center justify-center text-txt-tertiary text-[14px]">
        Loading stations…
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-bdr-light flex-shrink-0">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-[16px] font-bold text-txt-primary">Predicted Exceedance Lab</h2>
            <p className="text-[12px] text-txt-secondary mt-0.5">7-day history + 24h linear-regression projection</p>
          </div>
        </div>
      </div>

      {/* Station picker */}
      <div className="px-6 py-3 bg-white border-b border-bdr-light flex-shrink-0 space-y-2">
        <div className="relative inline-block w-full max-w-sm">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-bdr bg-white text-[13px] font-medium text-txt-primary hover:border-primary transition-colors"
          >
            <span>{selectedStation?.name ?? 'Select station'}</span>
            <ChevronDown className="w-4 h-4 text-txt-secondary" />
          </button>
          {open && (
            <div className="absolute top-full left-0 w-full z-10 mt-1 bg-white border border-bdr rounded-xl shadow-modal overflow-hidden max-h-60 overflow-y-auto">
              {stations.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedId(s.id); setSelectedParam(s.parameter); setOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-surface-secondary transition-colors ${s.id === selectedId ? 'font-bold text-primary bg-primary-light' : 'text-txt-primary'}`}
                >
                  <div>{s.name}</div>
                  {s.districtName && <div className="text-[11px] text-txt-secondary">{s.districtName}</div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Parameter chips — common OCEMS params */}
        <div className="flex items-center gap-2 flex-wrap">
          {['COD', 'BOD', 'pH', 'SS', 'NH3_N'].map(p => (
            <button
              key={p}
              onClick={() => setSelectedParam(p)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                selectedParam === p ? 'bg-primary text-white border-primary' : 'bg-white text-txt-secondary border-bdr hover:border-primary'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {projCross && (
          <span className="badge badge-danger">Projected exceedance in 24h</span>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-hidden p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-txt-tertiary text-[14px]">Loading data…</div>
        ) : readings.length === 0 ? (
          <div className="flex items-center justify-center h-full text-txt-tertiary text-[14px]">No readings available for this station/parameter.</div>
        ) : (
          <div className="bg-white rounded-card border border-bdr-light shadow-card h-full p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#7383A5' }}
                  interval="preserveStartEnd"
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#7383A5' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #CFD8E6', fontSize: 12 }}
                  formatter={(value: number, name: string) => [
                    `${value}`,
                    name === 'actual' ? 'Actual' : 'Projected',
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {norm !== null && (
                  <ReferenceLine
                    y={norm}
                    stroke="#E53935"
                    strokeDasharray="6 3"
                    label={{ value: `Norm ${norm}`, position: 'insideTopRight', fill: '#E53935', fontSize: 11 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke="#386AF6"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#386AF6' }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  name="Projected"
                  stroke="#FFB300"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3, fill: '#FFB300' }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Legend note */}
      <div className="px-6 pb-4 text-[11px] text-txt-tertiary flex-shrink-0">
        Dashed yellow line = 24h projection from linear regression of last 6 readings.
        {norm !== null && ' Red dashed = norm threshold.'}
      </div>
    </div>
  )
}
