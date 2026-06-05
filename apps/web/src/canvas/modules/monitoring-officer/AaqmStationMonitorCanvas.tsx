/**
 * AaqmStationMonitorCanvas — grid of AAQM stations coloured by latest readings.
 * Uses /api/sensors/stations/latest?type=AAQM (same pattern as OcemsLiveGridCanvas).
 * API returns { stations: [ { id, name, status, type, industry, district, readings: [{parameter, value, norm, ...}] } ] }
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'
import { api } from '../../../lib/api.js'

type Param = 'PM10' | 'PM2_5' | 'SO2' | 'NOx'

// Real API shapes
interface ApiReading {
  parameter: string
  value: number
  unit: string
  norm: number | null
  normUnit: string | null
  timestamp: string
  validity: string
}

interface ApiStation {
  id: string
  name: string
  status: string
  type: string
  industry: { id: string; name: string } | null
  district: { id: string; name: string } | null
  readings: ApiReading[]
}

interface ApiResponse {
  stations: ApiStation[]
}

// Internal display row
interface AaqmRow {
  id: string
  stationName: string
  districtName: string
  PM10: number | null
  PM2_5: number | null
  SO2: number | null
  NOx: number | null
}

// NAAQS annual standards (µg/m³)
const NAAQS: Record<Param, number> = {
  PM10:  60,
  PM2_5: 40,
  SO2:   20,
  NOx:   30,
}

const PARAMS: { key: Param; label: string }[] = [
  { key: 'PM10',  label: 'PM10' },
  { key: 'PM2_5', label: 'PM2.5' },
  { key: 'SO2',   label: 'SO₂' },
  { key: 'NOx',   label: 'NOₓ' },
]

function getReading(readings: ApiReading[], param: string): number | null {
  // API may use 'PM2_5' or 'PM2.5' etc.
  const found = readings.find(r => r.parameter === param || r.parameter === param.replace('_', '.'))
  return found?.value ?? null
}

function getCellStyle(value: number | null, norm: number): string {
  if (value === null) return 'bg-surface-secondary text-txt-tertiary'
  const r = value / norm
  if (r >= 1.2) return 'bg-danger text-white'
  if (r >= 1.0) return 'bg-danger-light text-danger font-semibold'
  if (r >= 0.8) return 'bg-warn-light text-warn font-semibold'
  return 'bg-ok-light/50 text-ok'
}

export function AaqmStationMonitorCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [stations, setStations] = useState<AaqmRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState<{ stationName: string; param: string; value: number } | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api<ApiResponse | ApiStation[]>(
        '/api/sensors/stations/latest?type=AAQM',
        { token },
      )
      const raw: ApiStation[] = Array.isArray(res)
        ? (res as ApiStation[])
        : ((res as ApiResponse).stations ?? [])

      const rows: AaqmRow[] = raw.map(s => ({
        id: s.id,
        stationName: s.name,
        districtName: s.district?.name ?? s.industry?.name ?? '',
        PM10:  getReading(s.readings, 'PM10'),
        PM2_5: getReading(s.readings, 'PM2_5'),
        SO2:   getReading(s.readings, 'SO2'),
        NOx:   getReading(s.readings, 'NOx'),
      }))
      setStations(rows)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load AAQM data.' })
      setStations([])
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void load() }, [load])

  const exceedCount = stations.filter(s =>
    PARAMS.some(p => {
      const v = s[p.key]
      return v !== null && v >= NAAQS[p.key]
    }),
  ).length

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-bdr-light flex-shrink-0">
        <div>
          <h2 className="text-[16px] font-bold text-txt-primary">AAQM Station Monitor</h2>
          <p className="text-[12px] text-txt-secondary mt-0.5">
            {loading ? 'Loading…' : `${stations.length} stations × 4 parameters · coloured by NAAQS compliance`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {exceedCount > 0 && (
            <span className="badge badge-danger">{exceedCount} stations exceeding</span>
          )}
          <button onClick={() => { void load() }} className="p-2 rounded-lg hover:bg-surface-secondary text-txt-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-2 bg-white border-b border-bdr-light text-[11px] flex-shrink-0">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-ok-light inline-block" /> Within norm</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-warn-light inline-block" /> 80–100% of norm</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-danger-light inline-block" /> Exceeds norm</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-danger inline-block" /> &gt;120% norm</div>
        <span className="text-txt-tertiary ml-auto">Hover cell for detail · NAAQS annual standards</span>
      </div>

      {/* Hover tooltip */}
      {hover && (
        <div className="px-6 py-2 bg-primary-light border-b border-primary/20 text-[12px] text-primary flex-shrink-0 animate-slide-in">
          <strong>{hover.stationName}</strong> — {hover.param}: <strong>{hover.value} µg/m³</strong>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-txt-tertiary text-[14px]">Loading AAQM data…</div>
        ) : stations.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-txt-tertiary text-[14px]">No AAQM stations found.</div>
        ) : (
          <div className="bg-white rounded-card border border-bdr-light shadow-card overflow-hidden">
            <table className="min-w-full text-[12px]">
              <thead className="bg-surface-secondary sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-txt-secondary w-48">Station</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-txt-secondary w-28">District</th>
                  {PARAMS.map(p => (
                    <th key={p.key} className="px-4 py-2.5 text-center text-[11px] font-semibold text-txt-secondary">
                      <div>{p.label}</div>
                      <div className="text-txt-tertiary font-normal">≤ {NAAQS[p.key]} µg/m³</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr-light">
                {stations.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-surface-secondary/20'}>
                    <td className="px-4 py-2 font-medium text-txt-primary text-[11px] truncate max-w-[180px]">{s.stationName}</td>
                    <td className="px-3 py-2 text-txt-secondary text-[11px]">{s.districtName || '—'}</td>
                    {PARAMS.map(p => {
                      const val = s[p.key]
                      const norm = NAAQS[p.key]
                      return (
                        <td
                          key={p.key}
                          className={`px-4 py-2 text-center cursor-default rounded-sm transition-all ${getCellStyle(val, norm)}`}
                          onMouseEnter={() => val !== null && setHover({ stationName: s.stationName, param: p.label, value: val })}
                          onMouseLeave={() => setHover(null)}
                        >
                          {val !== null ? val.toFixed(1) : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
