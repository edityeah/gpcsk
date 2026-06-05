/**
 * InspectionPrioritisationCanvas
 *
 * Shows the top 30 industries by AI-computed risk score from /api/stats/risk-index.
 * Each row has a "Schedule inspection" CTA that opens the scheduler pre-filled with
 * that industry. Category badge colours: RED → danger, ORANGE → warn, GREEN → ok.
 */

import { useEffect, useState } from 'react'
import { AlertTriangle, Calendar, RefreshCw, TrendingUp } from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

interface RiskRow {
  industryId: string
  name: string
  district: string | null
  sector: string | null
  category: string
  riskScore: number
  breakdown: {
    exceedance30d: number
    complaints30d: number
    openInspections: number
    consentGapDays: number
  }
}

const CATEGORY_BADGE: Record<string, string> = {
  RED:    'bg-danger-light text-danger',
  ORANGE: 'bg-warn-light text-warn',
  GREEN:  'bg-ok-light text-ok',
  WHITE:  'bg-slate-100 text-slate-500',
}

function riskColor(score: number): string {
  if (score >= 70) return 'text-danger font-bold'
  if (score >= 40) return 'text-warn font-semibold'
  return 'text-ok'
}

export function InspectionPrioritisationCanvas({
  onSchedule,
}: {
  onSchedule?: (industryId: string, industryName: string) => void
}) {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [rows, setRows] = useState<RiskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await api<RiskRow[]>('/api/stats/risk-index', { token: token ?? undefined })
      setRows(data.slice(0, 30))
    } catch {
      setError('Failed to load risk index.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [token])

  function handleSchedule(row: RiskRow) {
    if (onSchedule) {
      onSchedule(row.industryId, row.name)
    } else {
      showToast({ kind: 'info', text: `Schedule inspection for ${row.name}` })
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-page animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-bdr bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-danger-light flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-danger" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-txt-primary">Inspection Prioritisation</h2>
            <p className="text-[12px] text-txt-secondary">Top 30 high-risk industries · AI composite score</p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-surface-page disabled:opacity-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-txt-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 flex items-center gap-4 text-[11px] text-txt-secondary border-b border-bdr bg-white flex-shrink-0">
        <span className="font-semibold uppercase tracking-wider text-txt-tertiary">Score</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-danger inline-block" /> ≥ 70 critical
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-warn inline-block" /> 40–69 high
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-ok inline-block" /> &lt; 40 moderate
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-40 text-txt-tertiary text-[13px]">
            Loading risk index…
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 m-6 p-4 rounded-xl bg-danger-light text-danger text-[13px]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="flex items-center justify-center h-40 text-txt-tertiary text-[13px]">
            No high-risk industries found.
          </div>
        )}
        {!loading && !error && rows.length > 0 && (
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface-page z-10">
              <tr className="border-b border-bdr">
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary w-8">#</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary">Industry</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary hidden sm:table-cell">Category</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary">Score</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary hidden md:table-cell">Exc 30d</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary hidden md:table-cell">Complaints</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr-light">
              {rows.map((row, idx) => (
                <tr key={row.industryId} className="hover:bg-white transition-colors group">
                  <td className="px-4 py-3 text-txt-tertiary font-mono text-[11px]">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-txt-primary leading-tight">{row.name}</div>
                    {row.district && (
                      <div className="text-[11px] text-txt-tertiary mt-0.5">{row.district}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`badge ${CATEGORY_BADGE[row.category] ?? 'bg-slate-100 text-slate-500'}`}>
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-[15px] tabular-nums ${riskColor(row.riskScore)}`}>
                      {row.riskScore}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-txt-secondary hidden md:table-cell">
                    {row.breakdown.exceedance30d}
                  </td>
                  <td className="px-4 py-3 text-center text-txt-secondary hidden md:table-cell">
                    {row.breakdown.complaints30d}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSchedule(row)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[12px] font-semibold hover:bg-primary-dark transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Schedule
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
