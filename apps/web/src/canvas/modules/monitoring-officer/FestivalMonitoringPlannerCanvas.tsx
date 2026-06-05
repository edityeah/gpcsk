/**
 * FestivalMonitoringPlannerCanvas — Sabarmati Ganesh Utsav monitoring.
 * Data from /api/stats/festival-monitoring.
 * Real API shape:
 * { event, year, windows: { before: {from, to, parameters}, during: {...}, after: {...} },
 *   parametersCompared: [], stations: [{id, name, type}] }
 *
 * Since parametersCompared is empty in current data, we fall back to showing
 * the window dates and station info from the API, clearly stating data is pending.
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Calendar, MapPin } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'
import { api } from '../../../lib/api.js'

// Real API shape
interface Window {
  from: string
  to: string
  parameters: Record<string, unknown>
}

interface FestivalStation {
  id: string
  name: string
  type: string
}

interface FestivalApiData {
  event: string
  year: number
  windows: {
    before: Window
    during: Window
    after: Window
  }
  parametersCompared: Array<{
    parameter: string
    unit: string
    before: number
    during: number
    after: number
    norm: number | null
    source: string
  }>
  stations: FestivalStation[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function deltaPct(before: number, during: number): string {
  if (before === 0) return '—'
  const pct = ((during - before) / before) * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`
}

function cellStyle(value: number, norm: number | null): string {
  if (!norm) return 'text-txt-primary'
  if (value > norm) return 'text-danger font-semibold'
  if (value > norm * 0.8) return 'text-warn font-semibold'
  return 'text-ok'
}

export function FestivalMonitoringPlannerCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [data, setData] = useState<FestivalApiData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api<FestivalApiData>('/api/stats/festival-monitoring', { token })
      setData(res)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load festival monitoring data.' })
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void load() }, [load])

  const exceedanceDuring = data?.parametersCompared.filter(
    p => p.norm !== null && p.during > p.norm,
  ).length ?? 0

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 bg-white border-b border-bdr-light flex-shrink-0">
        <div>
          <h2 className="text-[16px] font-bold text-txt-primary">Festival Monitoring Planner</h2>
          {data && (
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[12px] text-txt-secondary">
                {data.event} · {data.year}
              </span>
              {exceedanceDuring > 0 && (
                <span className="badge badge-danger">{exceedanceDuring} parameters exceeded during festival</span>
              )}
            </div>
          )}
        </div>
        <button onClick={() => { void load() }} className="p-2 rounded-lg hover:bg-surface-secondary text-txt-secondary mt-1">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-txt-tertiary text-[14px]">
          Loading festival data…
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center flex-1 text-txt-tertiary text-[14px]">
          No festival monitoring data available.
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {/* Monitoring windows */}
          <div className="grid grid-cols-3 gap-3">
            {([
              { key: 'before', label: 'Pre-festival', bg: 'bg-ok-light/30 border-ok/20' },
              { key: 'during', label: 'During festival', bg: 'bg-warn-light/30 border-warn/20' },
              { key: 'after',  label: 'Post-festival',  bg: 'bg-ok-light/30 border-ok/20' },
            ] as const).map(col => {
              const w = data.windows[col.key]
              return (
                <div key={col.key} className={`rounded-xl border p-3 ${col.bg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-txt-secondary" />
                    <span className="text-[12px] font-bold text-txt-primary">{col.label}</span>
                  </div>
                  <div className="text-[11px] text-txt-secondary">
                    {fmtDate(w.from)} → {fmtDate(w.to)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Monitoring stations */}
          {data.stations.length > 0 && (
            <div className="bg-white rounded-xl border border-bdr-light shadow-card p-4">
              <div className="text-[12px] font-bold text-txt-primary mb-3">
                Monitoring Stations ({data.stations.length})
              </div>
              <div className="space-y-2">
                {data.stations.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-[12px]">
                    <MapPin className="w-3.5 h-3.5 text-txt-secondary flex-shrink-0" />
                    <span className="text-txt-primary font-medium">{s.name}</span>
                    <span className="text-txt-tertiary ml-auto">{s.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parameter comparison table */}
          {data.parametersCompared.length > 0 ? (
            <div className="bg-white rounded-xl border border-bdr-light shadow-card overflow-hidden">
              <table className="min-w-full text-[12px]">
                <thead className="bg-surface-secondary sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-txt-secondary">Parameter</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-txt-secondary">Unit</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-txt-secondary bg-ok-light/30">Pre-festival</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-txt-secondary bg-warn-light/30">During</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-txt-secondary bg-ok-light/30">Post-festival</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-txt-secondary">Change</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-txt-secondary">Norm</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-txt-secondary">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr-light">
                  {data.parametersCompared.map((p, i) => (
                    <tr key={p.parameter} className={i % 2 === 0 ? 'bg-white' : 'bg-surface-secondary/20'}>
                      <td className="px-4 py-2.5 font-medium text-txt-primary">{p.parameter}</td>
                      <td className="px-3 py-2.5 text-txt-tertiary text-right">{p.unit}</td>
                      <td className={`px-4 py-2.5 text-right bg-ok-light/10 ${cellStyle(p.before, p.norm)}`}>
                        {p.before.toLocaleString()}
                      </td>
                      <td className={`px-4 py-2.5 text-right bg-warn-light/10 ${cellStyle(p.during, p.norm)}`}>
                        {p.during.toLocaleString()}
                      </td>
                      <td className={`px-4 py-2.5 text-right bg-ok-light/10 ${cellStyle(p.after, p.norm)}`}>
                        {p.after.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-[11px] ${p.during > p.before ? 'text-danger' : 'text-ok'}`}>
                          {deltaPct(p.before, p.during)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-txt-tertiary">
                        {p.norm !== null ? p.norm : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-txt-tertiary">{p.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-surface-secondary rounded-xl p-6 text-center text-[13px] text-txt-tertiary">
              No parameter comparison data available for this event.
              Monitoring windows and station assignments are shown above.
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-2 bg-white border-t border-bdr-light text-[11px] text-txt-tertiary flex-shrink-0">
        Data source: GPCB Festival Monitoring Report · Sabarmati River at Ahmedabad
      </div>
    </div>
  )
}
