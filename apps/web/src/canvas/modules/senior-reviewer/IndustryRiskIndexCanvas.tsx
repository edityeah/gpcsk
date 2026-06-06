/**
 * IndustryRiskIndexCanvas — Senior Reviewer mega-dashboard #2
 *
 * Sortable, paginated risk-score table from /api/stats/risk-index.
 * Columns: rank / name / district / sector / category / riskScore (mini progress bar) / breakdown chips.
 * Search + filters (district, sector, category).
 * Row click → future IndustryDeepDive (shows toast for now).
 */

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Factory,
  Filter,
  Search,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'
import { api } from '../../../lib/api.js'
import { AskSaathiButton } from '../../../components/AskSaathiButton.js'

// ── Types ─────────────────────────────────────────────────────────────────────

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

type SortKey = 'riskScore' | 'name' | 'district' | 'category'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 15

// ── Risk badge ────────────────────────────────────────────────────────────────

function riskBadge(score: number) {
  if (score >= 70) return 'badge badge-danger'
  if (score >= 40) return 'badge badge-warn'
  return 'badge badge-ok'
}

function riskLabel(score: number) {
  if (score >= 70) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}

// ── Category badge color ──────────────────────────────────────────────────────

function catBadge(cat: string) {
  const MAP: Record<string, string> = {
    RED:    'badge badge-danger',
    ORANGE: 'badge badge-warn',
    GREEN:  'badge badge-ok',
    WHITE:  'badge badge-info',
  }
  return MAP[cat] ?? 'badge badge-info'
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function RiskBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-danger' : score >= 40 ? 'bg-warn' : 'bg-ok'
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[11px] font-bold tabular-nums w-8 text-right">{score}</span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function IndustryRiskIndexCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [rows, setRows] = useState<RiskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('riskScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    api<RiskRow[]>('/api/stats/risk-index', { token })
      .then(d => setRows(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  // Distinct values for filters
  const allDistricts = useMemo(
    () => Array.from(new Set(rows.map(r => r.district ?? '').filter(Boolean))).sort(),
    [rows],
  )
  const allCategories = useMemo(
    () => Array.from(new Set(rows.map(r => r.category))).sort(),
    [rows],
  )

  // Filter + sort + paginate
  const filtered = useMemo(() => {
    let r = rows
    if (search) r = r.filter(x => x.name.toLowerCase().includes(search.toLowerCase()) || (x.district ?? '').toLowerCase().includes(search.toLowerCase()))
    if (filterCat) r = r.filter(x => x.category === filterCat)
    if (filterDistrict) r = r.filter(x => x.district === filterDistrict)

    r = [...r].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (sortKey === 'riskScore') { av = a.riskScore; bv = b.riskScore }
      else if (sortKey === 'name')     { av = a.name; bv = b.name }
      else if (sortKey === 'district') { av = a.district ?? ''; bv = b.district ?? '' }
      else if (sortKey === 'category') { av = a.category; bv = b.category }

      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return r
  }, [rows, search, filterCat, filterDistrict, sortKey, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(0)
  }

  function handleRowClick(row: RiskRow) {
    showToast({ kind: 'info', text: `IndustryDeepDive for "${row.name}" — coming in next slice.` })
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? <ArrowDownUp className={`w-3 h-3 ml-0.5 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
      : <ArrowDownUp className="w-3 h-3 ml-0.5 opacity-30" />

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-[20px] font-bold text-txt-primary">Industry Risk Index</h2>
            {/* AskSaathiButton — compact pill for chart-header pattern */}
            <AskSaathiButton prompt="Why is the top industry ranked highest?" compact />
          </div>
          <p className="text-[12px] text-txt-tertiary mt-0.5">
            Composite score: exceedances + complaints + inspections + consent gaps
          </p>
        </div>
        <span className="ml-auto badge badge-info">{filtered.length} industries</span>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-2 flex-wrap bg-white p-3 rounded-card shadow-card">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] rounded-xl border border-bdr px-3 py-2 bg-surface-page">
          <Search className="w-3.5 h-3.5 text-txt-tertiary flex-shrink-0" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search by name or district…"
            className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-txt-tertiary"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-txt-tertiary" />
          <select
            value={filterCat}
            onChange={e => { setFilterCat(e.target.value); setPage(0) }}
            className="text-[12px] border border-bdr rounded-xl px-3 py-2 bg-white outline-none"
          >
            <option value="">All categories</option>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filterDistrict}
            onChange={e => { setFilterDistrict(e.target.value); setPage(0) }}
            className="text-[12px] border border-bdr rounded-xl px-3 py-2 bg-white outline-none"
          >
            <option value="">All districts</option>
            {allDistricts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-card shadow-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-txt-secondary text-sm">Loading risk index…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-txt-tertiary text-sm">No industries match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-surface-page border-b border-bdr-light">
                <tr>
                  <th className="px-4 py-3 text-left text-txt-tertiary font-medium w-10">#</th>
                  <th
                    className="px-4 py-3 text-left text-txt-tertiary font-medium cursor-pointer hover:text-primary select-none"
                    onClick={() => toggleSort('name')}
                  >
                    <span className="flex items-center">Name <SortIcon k="name" /></span>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-txt-tertiary font-medium cursor-pointer hover:text-primary select-none"
                    onClick={() => toggleSort('district')}
                  >
                    <span className="flex items-center">District <SortIcon k="district" /></span>
                  </th>
                  <th className="px-4 py-3 text-left text-txt-tertiary font-medium">Sector</th>
                  <th
                    className="px-4 py-3 text-left text-txt-tertiary font-medium cursor-pointer hover:text-primary select-none"
                    onClick={() => toggleSort('category')}
                  >
                    <span className="flex items-center">Category <SortIcon k="category" /></span>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-txt-tertiary font-medium cursor-pointer hover:text-primary select-none"
                    onClick={() => toggleSort('riskScore')}
                  >
                    <span className="flex items-center">Risk Score <SortIcon k="riskScore" /></span>
                  </th>
                  <th className="px-4 py-3 text-left text-txt-tertiary font-medium">Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => {
                  const rank = page * PAGE_SIZE + idx + 1
                  return (
                    <tr
                      key={row.industryId}
                      onClick={() => handleRowClick(row)}
                      className="border-t border-bdr-light hover:bg-surface-page cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-txt-tertiary font-mono">{rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Factory className="w-3.5 h-3.5 text-txt-tertiary flex-shrink-0" />
                          <span className="font-medium text-txt-primary truncate max-w-[160px]" title={row.name}>{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-txt-secondary">{row.district ?? '—'}</td>
                      <td className="px-4 py-3 text-txt-secondary">{row.sector ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={catBadge(row.category)}>{row.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`${riskBadge(row.riskScore)} text-[10px]`}>{riskLabel(row.riskScore)}</span>
                          <RiskBar score={row.riskScore} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="badge badge-danger text-[10px]" title="Exceedances 30d">{row.breakdown.exceedance30d}Exc</span>
                          <span className="badge badge-warn text-[10px]" title="Complaints 30d">{row.breakdown.complaints30d}Cmp</span>
                          {row.breakdown.openInspections > 0 && (
                            <span className="badge badge-info text-[10px]">{row.breakdown.openInspections}Insp</span>
                          )}
                          {row.breakdown.consentGapDays > 0 && (
                            <span className="badge badge-flag text-[10px]">{row.breakdown.consentGapDays}d gap</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-txt-tertiary">
            Page {page + 1} of {totalPages} · {filtered.length} industries
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg border border-bdr hover:bg-surface-page disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg border border-bdr hover:bg-surface-page disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
