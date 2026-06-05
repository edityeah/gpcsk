/**
 * CetpScorecardCanvas — table from /api/cetps with:
 * - Online CEQMS badge
 * - Observed COD vs standard (from latestReport.observedFinalCOD)
 * - 3-month trend indicator (from trend.codTrendPct)
 * - Row click → detail modal
 *
 * Real API shape: { data: [ { id, name, capacityMld, district, memberUnitsCount, hasOnlineCeqms,
 *   spraydryerUnits, latestReport: { observedFinalCOD, observedFinalBOD, monthOf, ... },
 *   trend: { codTrendPct, bodTrendPct } } ] }
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'
import { api } from '../../../lib/api.js'

// Real API shape
interface ApiCetp {
  id: string
  name: string
  capacityMld: number
  district: string
  memberUnitsCount: number
  hasOnlineCeqms: boolean
  spraydryerUnits: number | null
  latestReport: {
    id: string
    monthOf: string
    bypassMld: number
    observedFinalCOD: number
    observedFinalBOD: number
    hazardousWasteStorageMt: number
    hazardousWasteDisposedMt: number
  } | null
  trend: {
    codTrendPct: number
    bodTrendPct: number
  } | null
}

interface ApiResponse {
  data: ApiCetp[]
}

// Internal display row
interface CetpRow {
  id: string
  name: string
  district: string
  capacityMld: number
  memberUnitsCount: number
  hasOnlineCeqms: boolean
  observedCod: number
  standardCod: number
  trend3mo: 'improving' | 'stable' | 'worsening'
}

const COD_STANDARD = 250

function trend3mo(codTrendPct: number | undefined | null): 'improving' | 'stable' | 'worsening' {
  if (codTrendPct === null || codTrendPct === undefined) return 'stable'
  if (codTrendPct < -5) return 'improving'
  if (codTrendPct > 5) return 'worsening'
  return 'stable'
}

function TrendIcon({ trend }: { trend: CetpRow['trend3mo'] }) {
  if (trend === 'improving') return <TrendingDown className="w-4 h-4 text-ok" />
  if (trend === 'worsening') return <TrendingUp className="w-4 h-4 text-danger" />
  return <Minus className="w-4 h-4 text-txt-tertiary" />
}

function CodBar({ observed, standard }: { observed: number; standard: number }) {
  const pct = Math.min((observed / standard) * 100, 120)
  const over = observed > standard
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-bdr-light rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${over ? 'bg-danger' : 'bg-ok'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-[12px] font-semibold ${over ? 'text-danger' : 'text-ok'}`}>
        {observed.toFixed(0)}
      </span>
    </div>
  )
}

export function CetpScorecardCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [cetps, setCetps] = useState<CetpRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CetpRow | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api<ApiResponse | ApiCetp[]>('/api/cetps', { token })
      const raw: ApiCetp[] = Array.isArray(res)
        ? (res as ApiCetp[])
        : ((res as ApiResponse).data ?? [])

      const rows: CetpRow[] = raw.map(c => ({
        id: c.id,
        name: c.name,
        district: c.district,
        capacityMld: c.capacityMld,
        memberUnitsCount: c.memberUnitsCount,
        hasOnlineCeqms: c.hasOnlineCeqms,
        observedCod: c.latestReport?.observedFinalCOD ?? 0,
        standardCod: COD_STANDARD,
        trend3mo: trend3mo(c.trend?.codTrendPct),
      }))
      setCetps(rows)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load CETP data.' })
      setCetps([])
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void load() }, [load])

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-bdr-light flex-shrink-0">
        <div>
          <h2 className="text-[16px] font-bold text-txt-primary">CETP Scorecard</h2>
          <p className="text-[12px] text-txt-secondary mt-0.5">Common Effluent Treatment Plants — COD compliance + CEQMS status</p>
        </div>
        <button onClick={() => { void load() }} className="p-2 rounded-lg hover:bg-surface-secondary text-txt-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-txt-tertiary text-[14px]">Loading CETP data…</div>
        ) : cetps.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-txt-tertiary text-[14px]">No CETP data available.</div>
        ) : (
          <table className="min-w-full text-[12px]">
            <thead className="bg-surface-secondary sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-txt-secondary">CETP</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-txt-secondary">District</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-txt-secondary">Capacity (MLD)</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-txt-secondary">Members</th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold text-txt-secondary">Online CEQMS</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-txt-secondary">COD observed / std {COD_STANDARD} mg/L</th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold text-txt-secondary">3-mo trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr-light">
              {cetps.map((cetp, i) => (
                <tr
                  key={cetp.id}
                  onClick={() => setSelected(cetp)}
                  className={`cursor-pointer hover:bg-primary-light/20 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-surface-secondary/30'}`}
                >
                  <td className="px-4 py-3 font-medium text-txt-primary">{cetp.name}</td>
                  <td className="px-3 py-3 text-txt-secondary">{cetp.district}</td>
                  <td className="px-3 py-3 text-right text-txt-primary">{cetp.capacityMld}</td>
                  <td className="px-3 py-3 text-right text-txt-primary">{cetp.memberUnitsCount}</td>
                  <td className="px-3 py-3 text-center">
                    {cetp.hasOnlineCeqms ? (
                      <span className="badge badge-ok">Online</span>
                    ) : (
                      <span className="badge badge-warn">Absent</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {cetp.observedCod > 0
                      ? <CodBar observed={cetp.observedCod} standard={cetp.standardCod} />
                      : <span className="text-txt-tertiary">—</span>
                    }
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-center">
                      <TrendIcon trend={cetp.trend3mo} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-2 bg-white border-t border-bdr-light text-[11px] text-txt-tertiary flex-shrink-0">
        COD standard: {COD_STANDARD} mg/L (GPCB/CPCB) · Click any row for detail
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-card shadow-modal w-full max-w-xl p-6 animate-bubble-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-txt-primary">{selected.name}</h3>
                <p className="text-[12px] text-txt-secondary mt-0.5">COD standard: {COD_STANDARD} mg/L</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-surface-secondary">
                <X className="w-5 h-5 text-txt-secondary" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-[12px]">
              <div className="bg-surface-secondary rounded-xl p-3">
                <div className="text-[18px] font-bold text-txt-primary">{selected.capacityMld} MLD</div>
                <div className="text-txt-tertiary">Capacity</div>
              </div>
              <div className="bg-surface-secondary rounded-xl p-3">
                <div className="text-[18px] font-bold text-txt-primary">{selected.memberUnitsCount}</div>
                <div className="text-txt-tertiary">Members</div>
              </div>
              <div className="bg-surface-secondary rounded-xl p-3">
                <div className={`text-[18px] font-bold ${selected.observedCod > selected.standardCod ? 'text-danger' : 'text-ok'}`}>
                  {selected.observedCod > 0 ? `${selected.observedCod.toFixed(0)} mg/L` : '—'}
                </div>
                <div className="text-txt-tertiary">Latest COD</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[13px]">
              <span className="text-txt-secondary">Online CEQMS:</span>
              <span className={selected.hasOnlineCeqms ? 'text-ok font-semibold' : 'text-warn font-semibold'}>
                {selected.hasOnlineCeqms ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[13px] mt-2">
              <span className="text-txt-secondary">3-month COD trend:</span>
              <div className="flex items-center gap-1">
                <TrendIcon trend={selected.trend3mo} />
                <span className="font-semibold text-txt-primary capitalize">{selected.trend3mo}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
