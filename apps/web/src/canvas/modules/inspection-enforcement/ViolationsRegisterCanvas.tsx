/**
 * ViolationsRegisterCanvas
 *
 * Paginated, filterable table of all violations.
 * Filters: severity, source, dispositionState, free-text search.
 * Row click → navigates to IndustryDeepDive (via showToast placeholder in demo).
 *
 * Fetches from /api/inspections?... and extracts violations, or directly from
 * a dedicated violations endpoint if available. For this prototype we query
 * /api/inspections to get violations embedded in completed inspections,
 * and also use a stats summary.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  AlertTriangle, Search, Filter, ChevronLeft, ChevronRight,
  RefreshCw, ExternalLink, Info,
} from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

interface ViolationItem {
  id: string
  parameter: string
  observedValue: number | null
  normValue: number | null
  unit: string | null
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL'
  source: string
  detectedAt: string
  dispositionState: string
  industry: {
    id: string
    name: string
    ucNumber: string
    category: string
  }
  inspection: {
    id: string
    scheduledAt: string
  } | null
}

interface InspectionItem {
  id: string
  scheduledAt: string
  state: string
  industry: { id: string; name: string; ucNumber: string; category: string }
  violations: ViolationItem[]
}

const SEV_BADGE: Record<string, string> = {
  MINOR:    'bg-warn-light text-warn',
  MAJOR:    'bg-orange-100 text-orange-600',
  CRITICAL: 'bg-danger-light text-danger',
}

const DISP_BADGE: Record<string, string> = {
  PENDING:  'bg-primary-light text-primary',
  RESOLVED: 'bg-ok-light text-ok',
  CLOSED:   'bg-slate-100 text-slate-500',
}

const PAGE_SIZE = 20

type SevFilter = 'ALL' | 'MINOR' | 'MAJOR' | 'CRITICAL'
type DispFilter = 'ALL' | 'PENDING' | 'RESOLVED' | 'CLOSED'
type SrcFilter  = 'ALL' | 'SENSOR' | 'INSPECTION' | 'COMPLAINT' | 'AUDIT'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function ViolationsRegisterCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()

  const [allViolations, setAllViolations] = useState<ViolationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [sevFilter, setSevFilter] = useState<SevFilter>('ALL')
  const [dispFilter, setDispFilter] = useState<DispFilter>('ALL')
  const [srcFilter, setSrcFilter] = useState<SrcFilter>('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch completed inspections and flatten their violations
      const data = await api<{ items: InspectionItem[] }>(
        '/api/inspections?state=COMPLETED&limit=100',
        { token: token ?? undefined },
      )

      const flat: ViolationItem[] = []
      for (const insp of data.items) {
        for (const v of insp.violations ?? []) {
          flat.push({
            ...v,
            industry: insp.industry,
            inspection: { id: insp.id, scheduledAt: insp.scheduledAt },
          })
        }
      }
      // Sort newest first
      flat.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
      setAllViolations(flat)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load violations.' })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  // Filters
  const filtered = allViolations.filter(v => {
    if (sevFilter !== 'ALL' && v.severity !== sevFilter) return false
    if (dispFilter !== 'ALL' && v.dispositionState !== dispFilter) return false
    if (srcFilter !== 'ALL' && v.source !== srcFilter) return false
    if (q) {
      const lq = q.toLowerCase()
      if (
        !v.parameter.toLowerCase().includes(lq) &&
        !v.industry.name.toLowerCase().includes(lq) &&
        !v.industry.ucNumber.toLowerCase().includes(lq)
      ) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleFilterChange() { setPage(0) }

  function handleRowClick(v: ViolationItem) {
    showToast({ kind: 'info', text: `Industry Deep Dive: ${v.industry.name} (${v.industry.ucNumber})` })
  }

  return (
    <div className="flex flex-col h-full bg-surface-page animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-bdr bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-danger-light flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-danger" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-txt-primary">Violations Register</h2>
            <p className="text-[12px] text-txt-secondary">
              {loading ? 'Loading…' : `${filtered.length} violations${filtered.length !== allViolations.length ? ` (${allViolations.length} total)` : ''}`}
            </p>
          </div>
        </div>
        <button onClick={() => void load()} disabled={loading}
          className="p-2 rounded-lg hover:bg-surface-page disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 text-txt-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-bdr bg-white flex flex-wrap gap-2 items-center flex-shrink-0">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-bdr bg-surface-page flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-txt-tertiary flex-shrink-0" />
          <input
            value={q}
            onChange={e => { setQ(e.target.value); handleFilterChange() }}
            placeholder="Industry name, UC, parameter…"
            className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-txt-tertiary"
          />
        </div>

        {/* Severity */}
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-txt-tertiary" />
          {(['ALL', 'CRITICAL', 'MAJOR', 'MINOR'] as SevFilter[]).map(s => (
            <button
              key={s}
              onClick={() => { setSevFilter(s); handleFilterChange() }}
              className={`px-2.5 py-1 rounded-pill text-[11px] font-semibold border transition-all
                ${sevFilter === s
                  ? (s === 'ALL' ? 'bg-txt-primary text-white border-txt-primary' : `${SEV_BADGE[s]} border-current`)
                  : 'bg-white text-txt-secondary border-bdr hover:border-txt-tertiary'
                }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Disposition */}
        <div className="flex items-center gap-1">
          {(['ALL', 'PENDING', 'RESOLVED'] as DispFilter[]).map(d => (
            <button
              key={d}
              onClick={() => { setDispFilter(d); handleFilterChange() }}
              className={`px-2.5 py-1 rounded-pill text-[11px] font-semibold border transition-all
                ${dispFilter === d
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-txt-secondary border-bdr hover:border-primary'
                }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-40 text-txt-tertiary text-[13px]">
            Loading violations…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-txt-tertiary">
            <Info className="w-8 h-8" />
            <p className="text-[13px]">No violations match the current filters.</p>
          </div>
        )}
        {!loading && pageItems.length > 0 && (
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface-page z-10">
              <tr className="border-b border-bdr">
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary">Industry</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary">Parameter</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary hidden sm:table-cell">Observed</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary hidden sm:table-cell">Norm</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary">Severity</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary hidden lg:table-cell">Detected</th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr-light">
              {pageItems.map(v => (
                <tr
                  key={v.id}
                  className="hover:bg-white transition-colors cursor-pointer group"
                  onClick={() => handleRowClick(v)}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-txt-primary leading-tight truncate max-w-[160px]">{v.industry.name}</div>
                    <div className="text-[11px] text-txt-tertiary">{v.industry.ucNumber}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-txt-secondary text-[12px]">{v.parameter}</td>
                  <td className="px-4 py-3 text-right text-txt-primary hidden sm:table-cell">
                    {v.observedValue != null ? (
                      <span>{v.observedValue}{v.unit ? <span className="text-txt-tertiary text-[11px] ml-0.5">{v.unit}</span> : null}</span>
                    ) : '–'}
                  </td>
                  <td className="px-4 py-3 text-right text-txt-tertiary text-[12px] hidden sm:table-cell">
                    {v.normValue != null ? v.normValue : '–'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`badge ${SEV_BADGE[v.severity] ?? 'badge-info'}`}>
                      {v.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className={`badge ${DISP_BADGE[v.dispositionState] ?? 'badge-info'}`}>
                      {v.dispositionState}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-txt-tertiary text-[11px] hidden lg:table-cell whitespace-nowrap">
                    {fmtDate(v.detectedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ExternalLink className="w-3.5 h-3.5 text-txt-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-bdr bg-white flex-shrink-0">
          <span className="text-[12px] text-txt-secondary">
            Page {page + 1} of {totalPages} · {filtered.length} results
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg border border-bdr hover:border-primary disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-txt-secondary" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg border border-bdr hover:border-primary disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-txt-secondary" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
