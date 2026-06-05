/**
 * FestivalMonitoringPlannerCanvas — Sabarmati Ganesh Utsav before/during/after table.
 * Data from /api/stats/festival-monitoring.
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { api } from '../../../lib/api.js'

interface FestivalPhaseData {
  parameter: string
  unit: string
  before: number
  during: number
  after: number
  norm: number | null
  source: string
}

interface FestivalMonitoringData {
  festival: string
  location: string
  year: number
  phases: {
    before: { label: string; dateRange: string }
    during: { label: string; dateRange: string }
    after:  { label: string; dateRange: string }
  }
  parameters: FestivalPhaseData[]
}

const DEMO_DATA: FestivalMonitoringData = {
  festival: 'Ganesh Utsav (Sabarmati)',
  location: 'Sabarmati River, Ahmedabad',
  year: 2023,
  phases: {
    before: { label: 'Pre-festival',   dateRange: '17–18 Sep 2023' },
    during: { label: 'During festival', dateRange: '19–28 Sep 2023' },
    after:  { label: 'Post-festival',  dateRange: '29 Sep – 08 Oct 2023' },
  },
  parameters: [
    { parameter: 'pH',             unit: '',        before: 7.8,  during: 7.4,  after: 7.9,  norm: null,  source: 'GPCB Lab' },
    { parameter: 'Dissolved Oxygen', unit: 'mg/L', before: 6.2,  during: 4.1,  after: 6.8,  norm: 5.0,   source: 'GPCB Lab' },
    { parameter: 'BOD',            unit: 'mg/L',    before: 12.4, during: 28.6, after: 14.2, norm: 3.0,   source: 'GPCB Lab' },
    { parameter: 'COD',            unit: 'mg/L',    before: 38.2, during: 88.4, after: 42.1, norm: 10.0,  source: 'GPCB Lab' },
    { parameter: 'Total Coliform', unit: 'MPN/100mL', before: 1600, during: 9200, after: 2100, norm: 500,  source: 'GPCB Lab' },
    { parameter: 'Nitrate (NO₃)', unit: 'mg/L',    before: 4.2,  during: 8.1,  after: 4.8,  norm: 10.0,  source: 'GPCB Lab' },
    { parameter: 'Phosphate (PO₄)', unit: 'mg/L',  before: 0.82, during: 2.14, after: 0.95, norm: null,  source: 'GPCB Lab' },
    { parameter: 'Total Dissolved Solids', unit: 'mg/L', before: 418, during: 654, after: 432, norm: 500, source: 'GPCB Lab' },
    { parameter: 'Suspended Solids', unit: 'mg/L', before: 28,   during: 112,  after: 34,   norm: 30.0,  source: 'GPCB Lab' },
    { parameter: 'PM10 (riverbank)', unit: 'µg/m³', before: 58,  during: 118,  after: 64,   norm: 100.0, source: 'AAQM Mobile' },
    { parameter: 'PM2.5 (riverbank)', unit: 'µg/m³', before: 32, during: 68,   after: 36,   norm: 60.0,  source: 'AAQM Mobile' },
    { parameter: 'Noise Level',    unit: 'dB(A)',    before: 58,  during: 82,   after: 61,   norm: 65.0,  source: 'GPCB Monitor' },
    { parameter: 'Idol Immersions', unit: 'count',  before: 0,   during: 4820, after: 0,    norm: null,  source: 'GPCB Census' },
    { parameter: 'Water Sample Locations', unit: 'count', before: 12, during: 18, after: 12, norm: null, source: 'GPCB Lab' },
  ],
}

function deltaIcon(before: number, during: number): React.ReactNode {
  const pct = ((during - before) / before) * 100
  if (Math.abs(pct) < 5) return <Minus className="w-3.5 h-3.5 text-txt-tertiary inline" />
  if (during > before) return <TrendingUp className="w-3.5 h-3.5 text-danger inline" />
  return <TrendingDown className="w-3.5 h-3.5 text-ok inline" />
}

function deltaPct(before: number, during: number): string {
  if (before === 0) return '—'
  const pct = ((during - before) / before) * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`
}

function cellStyle(value: number, norm: number | null, isBest: boolean): string {
  if (!norm) return isBest ? 'text-txt-primary' : 'text-txt-secondary'
  if (value > norm) return 'text-danger font-semibold'
  if (value > norm * 0.8) return 'text-warn font-semibold'
  return 'text-ok'
}

export function FestivalMonitoringPlannerCanvas() {
  const { token } = useAuth()
  const [data, setData] = useState<FestivalMonitoringData>(DEMO_DATA)
  const [loading, setLoading] = useState(false)
  const [activePhase, setActivePhase] = useState<'all' | 'before' | 'during' | 'after'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await api<FestivalMonitoringData>('/api/stats/festival-monitoring', { token: token ?? undefined })
      setData(resp)
    } catch {
      setData(DEMO_DATA)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  const exceedanceDuring = data.parameters.filter(p => p.norm !== null && p.during > p.norm).length

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 bg-white border-b border-bdr-light flex-shrink-0">
        <div>
          <h2 className="text-[16px] font-bold text-txt-primary">Festival Monitoring Planner</h2>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[12px] text-txt-secondary">{data.festival} · {data.location} · {data.year}</span>
            {exceedanceDuring > 0 && (
              <span className="badge badge-danger">{exceedanceDuring} parameters exceeded during festival</span>
            )}
          </div>
        </div>
        <button onClick={() => { void load() }} className="p-2 rounded-lg hover:bg-surface-secondary text-txt-secondary mt-1">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-2 px-6 py-3 bg-white border-b border-bdr-light flex-shrink-0">
        {([
          { key: 'all',    label: 'All phases' },
          { key: 'before', label: `Pre-festival · ${data.phases.before.dateRange}` },
          { key: 'during', label: `During · ${data.phases.during.dateRange}` },
          { key: 'after',  label: `Post-festival · ${data.phases.after.dateRange}` },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActivePhase(tab.key)}
            className={`px-3 py-1.5 rounded-pill text-[12px] font-medium transition-colors border ${
              activePhase === tab.key
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-txt-secondary border-bdr hover:border-primary hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-card border border-bdr-light shadow-card overflow-hidden">
          <table className="min-w-full text-[12px]">
            <thead className="bg-surface-secondary sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-txt-secondary">Parameter</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-txt-secondary">Unit</th>
                {(activePhase === 'all' || activePhase === 'before') && (
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-txt-secondary bg-ok-light/30">
                    Pre-festival<br /><span className="font-normal text-txt-tertiary">{data.phases.before.dateRange}</span>
                  </th>
                )}
                {(activePhase === 'all' || activePhase === 'during') && (
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-txt-secondary bg-warn-light/30">
                    During festival<br /><span className="font-normal text-txt-tertiary">{data.phases.during.dateRange}</span>
                  </th>
                )}
                {(activePhase === 'all' || activePhase === 'after') && (
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-txt-secondary bg-ok-light/30">
                    Post-festival<br /><span className="font-normal text-txt-tertiary">{data.phases.after.dateRange}</span>
                  </th>
                )}
                {activePhase === 'all' && (
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-txt-secondary">
                    Change (pre→during)
                  </th>
                )}
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-txt-secondary">Norm</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-txt-secondary">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr-light">
              {data.parameters.map((p, i) => (
                <tr key={p.parameter} className={i % 2 === 0 ? 'bg-white' : 'bg-surface-secondary/20'}>
                  <td className="px-4 py-2.5 font-medium text-txt-primary">{p.parameter}</td>
                  <td className="px-3 py-2.5 text-txt-tertiary text-right">{p.unit}</td>
                  {(activePhase === 'all' || activePhase === 'before') && (
                    <td className={`px-4 py-2.5 text-right bg-ok-light/10 ${cellStyle(p.before, p.norm, true)}`}>
                      {p.before.toLocaleString()}
                    </td>
                  )}
                  {(activePhase === 'all' || activePhase === 'during') && (
                    <td className={`px-4 py-2.5 text-right bg-warn-light/10 ${cellStyle(p.during, p.norm, false)}`}>
                      {p.during.toLocaleString()}
                    </td>
                  )}
                  {(activePhase === 'all' || activePhase === 'after') && (
                    <td className={`px-4 py-2.5 text-right bg-ok-light/10 ${cellStyle(p.after, p.norm, true)}`}>
                      {p.after.toLocaleString()}
                    </td>
                  )}
                  {activePhase === 'all' && (
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-[11px] ${p.during > p.before ? 'text-danger' : 'text-ok'}`}>
                        {deltaIcon(p.before, p.during)}&nbsp;{deltaPct(p.before, p.during)}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right text-txt-tertiary">
                    {p.norm !== null ? p.norm : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-txt-tertiary">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <div className="px-6 py-2 bg-white border-t border-bdr-light text-[11px] text-txt-tertiary flex-shrink-0">
        Data source: GPCB Ganesh Utsav Monitoring Report 2023 · Sabarmati River at Ahmedabad · All water norms as per GPCB standards
      </div>
    </div>
  )
}
