/**
 * ViolationsRegisterCanvas
 *
 * Paginated, filterable table of confirmed violations from exceedances.
 * Uses /api/exceedances?dispositionState=CONFIRMED_VIOLATION
 * Real API shape: { exceedances: [{id, parameter, observedValue, normValue,
 *   breachMagnitude, severity, detectedAt, dispositionState, dispositionAt,
 *   station: {id, name, type, industry: {id, name, districtId}}}], nextCursor, count }
 */

import { useEffect, useState, useCallback } from 'react'
import {
  AlertTriangle, Search, Filter, ChevronLeft, ChevronRight,
  RefreshCw, ExternalLink, Info,
} from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

// Real API shape
interface ApiExceedance {
  id: string
  parameter: string
  observedValue: number
  normValue: number
  breachMagnitude: number
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL'
  detectedAt: string
  dispositionState: string
  dispositionAt: string | null
  station: {
    id: string
    name: string
    type: string
    industryId: string
    industry: {
      id: string
      name: string
      districtId: string | null
    } | null
  }
  dispositionActor: { id: string; name: string; designation: string | null } | null
}

interface ApiResponse {
  exceedances: ApiExceedance[]
  nextCursor?: string
  count?: number
}

const SEV_BADGE: Record<string, string> = {
  MINOR:    'bg-warn-light text-warn',
  MAJOR:    'bg-orange-100 text-orange-600',
  CRITICAL: 'bg-danger-light text-danger',
}

const PAGE_SIZE = 20

type SevFilter = 'ALL' | 'MINOR' | 'MAJOR' | 'CRITICAL'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function ViolationsRegisterCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()

  const [all, setAll] = useState<ApiExceedance[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [sevFilter, setSevFilter] = useState<SevFilter>('ALL')

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api<ApiResponse | ApiExceedance[]>(
        '/api/exceedances?dispositionState=CONFIRMED_VIOLATION&limit=200',
        { token },
      )
      const list: ApiExceedance[] = Array.isArray(res)
        ? (res as ApiExceedance[])
        : ((res as ApiResponse).exceedances ?? [])
      // Sort newest first
      list.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
      setAll(list)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load violations.' })
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void load() }, [load])

  // Filters
  const filtered = all.filter(v => {
    if (sevFilter !== 'ALL' && v.severity !== sevFilter) return false
    if (q) {
      const lq = q.toLowerCase()
      const industryName = v.station.industry?.name ?? v.station.name
      if (
        !v.parameter.toLowerCase().includes(lq) &&
        !industryName.toLowerCase().includes(lq) &&
        !v.station.name.toLowerCase().includes(lq)
      ) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleFilterChange() { setPage(0) }

  function handleRowClick(v: ApiExceedance) {
    const industryName = v.station.industry?.name ?? v.station.name
    showToast({ kind: 'info', text: `Industry: ${industryName}` })
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
              {loading ? 'Loading…' : `${filtered.length} confirmed violations${filtered.length !== all.length ? ` (${all.length} total)` : ''}`}
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
            placeholder="Industry name, station, parameter…"
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
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary">Industry / Station</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary">Parameter</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary hidden sm:table-cell">Observed</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary hidden sm:table-cell">Norm</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary">Severity</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary hidden lg:table-cell">Detected</th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr-light">
              {pageItems.map(v => {
                const industryName = v.station.industry?.name ?? v.station.name
                return (
                  <tr
                    key={v.id}
                    className="hover:bg-white transition-colors cursor-pointer group"
                    onClick={() => handleRowClick(v)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-txt-primary leading-tight truncate max-w-[160px]">{industryName}</div>
                      <div className="text-[11px] text-txt-tertiary">{v.station.name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-txt-secondary text-[12px]">{v.parameter}</td>
                    <td className="px-4 py-3 text-right text-txt-primary hidden sm:table-cell">
                      <span>{v.observedValue.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-txt-tertiary text-[12px] hidden sm:table-cell">
                      {v.normValue.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${SEV_BADGE[v.severity] ?? 'badge-info'}`}>
                        {v.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-txt-tertiary text-[11px] hidden lg:table-cell whitespace-nowrap">
                      {fmtDate(v.detectedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ExternalLink className="w-3.5 h-3.5 text-txt-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                )
              })}
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
