/**
 * PredictedExceedanceLabCanvas — pick a station; show 7-day series with dashed 24h projection.
 * Linear regression over the last 6 data points to project the next 24 hours.
 * Highlights where the projection crosses the norm.
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
import { api } from '../../../lib/api.js'

interface Station {
  id: string
  name: string
  industry: string
  district: string
  parameter: string
  unit: string
  norm: number
}

interface Reading {
  timestamp: string
  value: number
}

interface ChartPoint {
  label: string
  actual?: number
  projected?: number
  norm: number
}

const DEMO_STATIONS: Station[] = [
  { id: 's1', name: 'Vatva-OCEMS-02',  industry: 'Pushpak Ind',           district: 'Ahmedabad', parameter: 'NOx',  unit: 'µg/m³', norm: 100 },
  { id: 's2', name: 'Naroda-OCEMS-01', industry: 'Nirma Ltd',              district: 'Ahmedabad', parameter: 'PM10', unit: 'µg/m³', norm: 100 },
  { id: 's3', name: 'Dahej-OCEMS-01',  industry: 'ONGC Petro additions',   district: 'Bharuch',   parameter: 'VOC',  unit: 'µg/m³', norm: 50  },
  { id: 's4', name: 'Morbi-OCEMS-01',  industry: 'Kajaria Ceramics',       district: 'Morbi',     parameter: 'PM10', unit: 'µg/m³', norm: 100 },
  { id: 's5', name: 'Sachin-OCEMS-01', industry: 'Alok Industries',        district: 'Surat',     parameter: 'COD',  unit: 'mg/L',  norm: 250 },
]

/** Seed deterministic demo readings: 7d × 4 readings/day, gently trending up */
function makeDemoReadings(norm: number): Reading[] {
  const readings: Reading[] = []
  const now = Date.now()
  const total = 28 // 7d × 4 per day
  for (let i = 0; i < total; i++) {
    const ts = now - (total - 1 - i) * 6 * 3600_000
    const trend = (i / total) * 0.35 // 0→35% drift
    const noise = (Math.sin(i * 1.9) * 0.08 + Math.cos(i * 3.1) * 0.06)
    const value = +(norm * (0.55 + trend + noise)).toFixed(1)
    readings.push({ timestamp: new Date(ts).toISOString(), value })
  }
  return readings
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

function buildChartData(readings: Reading[], norm: number): ChartPoint[] {
  if (readings.length === 0) return []

  const actual: ChartPoint[] = readings.map(r => ({
    label: new Date(r.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit' }),
    actual: r.value,
    norm,
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
      norm,
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
  const [stations, setStations] = useState<Station[]>(DEMO_STATIONS)
  const [selectedId, setSelectedId] = useState<string>(DEMO_STATIONS[0]?.id ?? '')
  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const selectedStation = stations.find(s => s.id === selectedId) ?? stations[0]

  const loadStations = useCallback(async () => {
    try {
      const data = await api<Station[]>('/api/sensors/stations?type=OCEMS', { token: token ?? undefined })
      if (data.length > 0) {
        setStations(data)
        setSelectedId(data[0]?.id ?? '')
      }
    } catch {
      // use demo
    }
  }, [token])

  const loadReadings = useCallback(async (stationId: string) => {
    setLoading(true)
    try {
      const data = await api<Reading[]>(`/api/sensors/stations/${stationId}/readings?days=7`, { token: token ?? undefined })
      setReadings(data)
    } catch {
      setReadings(makeDemoReadings(selectedStation?.norm ?? 100))
    } finally {
      setLoading(false)
    }
  }, [token, selectedStation])

  useEffect(() => { void loadStations() }, [loadStations])
  useEffect(() => { if (selectedId) void loadReadings(selectedId) }, [selectedId, loadReadings])

  const chartData = buildChartData(readings, selectedStation?.norm ?? 100)
  const norm = selectedStation?.norm ?? 100

  // Check if projection crosses norm
  const projCross = chartData.some(p => p.projected !== undefined && p.projected >= norm)

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
      <div className="px-6 py-3 bg-white border-b border-bdr-light flex-shrink-0">
        <div className="relative inline-block w-full max-w-sm">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-bdr bg-white text-[13px] font-medium text-txt-primary hover:border-primary transition-colors"
          >
            <span>{selectedStation?.name ?? 'Select station'}</span>
            <ChevronDown className="w-4 h-4 text-txt-secondary" />
          </button>
          {open && (
            <div className="absolute top-full left-0 w-full z-10 mt-1 bg-white border border-bdr rounded-xl shadow-modal overflow-hidden">
              {stations.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedId(s.id); setOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-surface-secondary transition-colors ${s.id === selectedId ? 'font-bold text-primary bg-primary-light' : 'text-txt-primary'}`}
                >
                  <div>{s.name}</div>
                  <div className="text-[11px] text-txt-secondary">{s.industry} · {s.parameter} · {s.district}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedStation && (
          <div className="mt-2 flex items-center gap-4 text-[12px] text-txt-secondary">
            <span>{selectedStation.industry}</span>
            <span className="text-bdr">|</span>
            <span>{selectedStation.parameter} ({selectedStation.unit})</span>
            <span className="text-bdr">|</span>
            <span>Norm: <strong className="text-txt-primary">{selectedStation.norm}</strong></span>
            {projCross && (
              <span className="badge badge-danger ml-auto">Projected exceedance in 24h</span>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-hidden p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-txt-tertiary text-[14px]">Loading data…</div>
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
                    `${value} ${selectedStation?.unit ?? ''}`,
                    name === 'actual' ? 'Actual' : 'Projected',
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  y={norm}
                  stroke="#E53935"
                  strokeDasharray="6 3"
                  label={{ value: `Norm ${norm}`, position: 'insideTopRight', fill: '#E53935', fontSize: 11 }}
                />
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
        Dashed yellow line = 24h projection from linear regression of last 6 readings. Red dashed = CPCB norm.
      </div>
    </div>
  )
}
