/**
 * CetpScorecardCanvas — table from /api/cetps with:
 * - Online CEQMS badge
 * - Observed COD vs standard
 * - 3-month trend indicator
 * - Row click → 12-month sparkline modal
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
import { api } from '../../../lib/api.js'

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
  monthlyHistory?: { month: string; cod: number }[]
}

const DEMO_CETPS: CetpRow[] = [
  {
    id: 'c1', name: 'AHSPA CETP', district: 'Ahmedabad', capacityMld: 55, memberUnitsCount: 720, hasOnlineCeqms: true,
    observedCod: 187, standardCod: 250, trend3mo: 'improving',
    monthlyHistory: [
      { month: 'Jul 23', cod: 245 }, { month: 'Aug 23', cod: 238 }, { month: 'Sep 23', cod: 225 },
      { month: 'Oct 23', cod: 218 }, { month: 'Nov 23', cod: 212 }, { month: 'Dec 23', cod: 208 },
      { month: 'Jan 24', cod: 204 }, { month: 'Feb 24', cod: 198 }, { month: 'Mar 24', cod: 195 },
      { month: 'Apr 24', cod: 192 }, { month: 'May 24', cod: 189 }, { month: 'Jun 24', cod: 187 },
    ],
  },
  {
    id: 'c2', name: 'Gujarat Vepari CETP', district: 'Ahmedabad', capacityMld: 15, memberUnitsCount: 180, hasOnlineCeqms: true,
    observedCod: 312, standardCod: 250, trend3mo: 'worsening',
    monthlyHistory: [
      { month: 'Jul 23', cod: 260 }, { month: 'Aug 23', cod: 268 }, { month: 'Sep 23', cod: 275 },
      { month: 'Oct 23', cod: 280 }, { month: 'Nov 23', cod: 286 }, { month: 'Dec 23', cod: 291 },
      { month: 'Jan 24', cod: 295 }, { month: 'Feb 24', cod: 300 }, { month: 'Mar 24', cod: 305 },
      { month: 'Apr 24', cod: 308 }, { month: 'May 24', cod: 310 }, { month: 'Jun 24', cod: 312 },
    ],
  },
  {
    id: 'c3', name: 'Naroda Enviro Projects', district: 'Ahmedabad', capacityMld: 40, memberUnitsCount: 510, hasOnlineCeqms: false,
    observedCod: 228, standardCod: 250, trend3mo: 'stable',
    monthlyHistory: [
      { month: 'Jul 23', cod: 230 }, { month: 'Aug 23', cod: 225 }, { month: 'Sep 23', cod: 228 },
      { month: 'Oct 23', cod: 226 }, { month: 'Nov 23', cod: 232 }, { month: 'Dec 23', cod: 229 },
      { month: 'Jan 24', cod: 227 }, { month: 'Feb 24', cod: 231 }, { month: 'Mar 24', cod: 226 },
      { month: 'Apr 24', cod: 229 }, { month: 'May 24', cod: 228 }, { month: 'Jun 24', cod: 228 },
    ],
  },
  {
    id: 'c4', name: 'Narol Dyestuff CETP', district: 'Ahmedabad', capacityMld: 10, memberUnitsCount: 95, hasOnlineCeqms: true,
    observedCod: 198, standardCod: 250, trend3mo: 'improving',
    monthlyHistory: [
      { month: 'Jul 23', cod: 240 }, { month: 'Aug 23', cod: 235 }, { month: 'Sep 23', cod: 228 },
      { month: 'Oct 23', cod: 220 }, { month: 'Nov 23', cod: 215 }, { month: 'Dec 23', cod: 210 },
      { month: 'Jan 24', cod: 208 }, { month: 'Feb 24', cod: 205 }, { month: 'Mar 24', cod: 203 },
      { month: 'Apr 24', cod: 201 }, { month: 'May 24', cod: 199 }, { month: 'Jun 24', cod: 198 },
    ],
  },
  {
    id: 'c5', name: 'Odhav Enviro Ltd', district: 'Ahmedabad', capacityMld: 30, memberUnitsCount: 320, hasOnlineCeqms: true,
    observedCod: 267, standardCod: 250, trend3mo: 'worsening',
    monthlyHistory: [
      { month: 'Jul 23', cod: 242 }, { month: 'Aug 23', cod: 248 }, { month: 'Sep 23', cod: 251 },
      { month: 'Oct 23', cod: 255 }, { month: 'Nov 23', cod: 258 }, { month: 'Dec 23', cod: 260 },
      { month: 'Jan 24', cod: 261 }, { month: 'Feb 24', cod: 263 }, { month: 'Mar 24', cod: 264 },
      { month: 'Apr 24', cod: 265 }, { month: 'May 24', cod: 266 }, { month: 'Jun 24', cod: 267 },
    ],
  },
  {
    id: 'c6', name: 'Vapi CETP',            district: 'Valsad',    capacityMld: 55, memberUnitsCount: 650, hasOnlineCeqms: true,
    observedCod: 241, standardCod: 250, trend3mo: 'stable',
    monthlyHistory: Array.from({ length: 12 }, (_, i) => ({ month: `Month ${i + 1}`, cod: 240 + Math.round(Math.sin(i) * 8) })),
  },
  {
    id: 'c7', name: 'Ankleshwar CETP',      district: 'Bharuch',   capacityMld: 20, memberUnitsCount: 210, hasOnlineCeqms: false,
    observedCod: 215, standardCod: 250, trend3mo: 'improving',
    monthlyHistory: Array.from({ length: 12 }, (_, i) => ({ month: `Month ${i + 1}`, cod: 260 - i * 4 })),
  },
]

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
        {observed}
      </span>
    </div>
  )
}

export function CetpScorecardCanvas() {
  const { token } = useAuth()
  const [cetps, setCetps] = useState<CetpRow[]>(DEMO_CETPS)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<CetpRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<CetpRow[]>('/api/cetps', { token: token ?? undefined })
      setCetps(data)
    } catch {
      setCetps(DEMO_CETPS)
    } finally {
      setLoading(false)
    }
  }, [token])

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
        <table className="min-w-full text-[12px]">
          <thead className="bg-surface-secondary sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-txt-secondary">CETP</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-txt-secondary">District</th>
              <th className="px-3 py-3 text-right text-[11px] font-semibold text-txt-secondary">Capacity (MLD)</th>
              <th className="px-3 py-3 text-right text-[11px] font-semibold text-txt-secondary">Members</th>
              <th className="px-3 py-3 text-center text-[11px] font-semibold text-txt-secondary">Online CEQMS</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-txt-secondary">COD observed / std 250 mg/L</th>
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
                  <CodBar observed={cetp.observedCod} standard={cetp.standardCod} />
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
      </div>

      {/* Footer */}
      <div className="px-6 py-2 bg-white border-t border-bdr-light text-[11px] text-txt-tertiary flex-shrink-0">
        COD standard: 250 mg/L (GPCB/CPCB) · Click any row for 12-month COD sparkline
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
                <p className="text-[12px] text-txt-secondary mt-0.5">12-month COD trend · Standard 250 mg/L</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-surface-secondary">
                <X className="w-5 h-5 text-txt-secondary" />
              </button>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selected.monthlyHistory ?? []} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#7383A5' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#7383A5' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [`${v} mg/L`, 'COD']} />
                  <ReferenceLine y={250} stroke="#E53935" strokeDasharray="5 3" label={{ value: 'Norm 250', position: 'insideTopRight', fill: '#E53935', fontSize: 11 }} />
                  <Line type="monotone" dataKey="cod" stroke="#386AF6" strokeWidth={2} dot={{ r: 3, fill: '#386AF6' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[12px]">
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
                  {selected.observedCod} mg/L
                </div>
                <div className="text-txt-tertiary">Latest COD</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
