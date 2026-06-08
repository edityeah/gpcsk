// AutoTriageCanvas — Complaints Officer
// Donut of complaint categories + bar of severity + last-7-day intake.
// Prefers /api/complaints/triage-stats; falls back to /api/complaints?limit=200.

import { useEffect, useState, useCallback } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Activity, RefreshCw, TrendingUp } from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

// ─── Real API shapes ──────────────────────────────────────────────────────────

interface ApiComplaint {
  id: string
  channel: string
  receivedAt: string
  category: string       // e.g. 'AIR_POLLUTION', 'WATER_POLLUTION', 'NOISE', etc.
  severity: string       // 'MINOR' | 'MAJOR' | 'CRITICAL'
  state: string          // 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  description: string
}

// Response shape from GET /api/complaints/triage-stats
interface ApiTriageStats {
  totalLast7d: number
  totalLast30d: number
  byCategory: Array<{ category: string; _count: { id: number } }>
  bySeverity: Array<{ severity: string; _count: { id: number } }>
  byChannel:  Array<{ channel:  string; _count: { id: number } }>
  byState:    Array<{ state:    string; _count: { id: number } }>
}

// ─── Internal stats shape ─────────────────────────────────────────────────────

interface TriageStats {
  categoryBreakdown: Array<{ category: string; count: number }>
  severityBreakdown: Array<{ severity: string; count: number }>
  last7Days: Array<{ date: string; count: number }>
  totalOpen: number
  totalResolved: number
  avgResolutionDays: number
}

const CATEGORY_LABEL: Record<string, string> = {
  AIR_POLLUTION:    'Air Pollution',
  WATER_POLLUTION:  'Water Pollution',
  NOISE:            'Noise',
  HAZARDOUS_WASTE:  'Hazardous Waste',
  ODOUR:            'Odour',
  BURNING:          'Burning',
  ILLEGAL_DISCHARGE:'Illegal Discharge',
  OTHER:            'Other',
}

const SEVERITY_LABEL: Record<string, string> = {
  CRITICAL: 'Critical',
  MAJOR:    'Major',
  MINOR:    'Minor',
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#386AF6', '#4CAF50', '#FFB300', '#E53935', '#7C3AED', '#0EA5E9', '#F97316', '#7383A5',
]

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#E53935',
  MAJOR:    '#F97316',
  MINOR:    '#FFB300',
}

// ─── Custom donut label ───────────────────────────────────────────────────────

interface LabelProps {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
}

function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: LabelProps) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-card border border-bdr-light shadow-card px-4 py-3 flex-1 min-w-[100px]">
      <div className={`text-[22px] font-bold ${color}`}>{value}</div>
      <div className="text-[11px] font-semibold text-txt-secondary mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-txt-tertiary mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Build stats from raw complaints ─────────────────────────────────────────

function buildStats(complaints: ApiComplaint[]): TriageStats {
  const catMap = new Map<string, number>()
  const sevMap = new Map<string, number>()
  const dayMap = new Map<string, number>()
  let totalOpen = 0
  let totalResolved = 0

  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 3600_000

  // Seed 7-day buckets
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 24 * 3600_000)
    const key = d.toLocaleDateString('en-IN', { weekday: 'short' })
    dayMap.set(key, 0)
  }

  for (const c of complaints) {
    // Category
    const catKey = CATEGORY_LABEL[c.category] ?? c.category.replace(/_/g, ' ')
    catMap.set(catKey, (catMap.get(catKey) ?? 0) + 1)

    // Severity
    const sevLabel = SEVERITY_LABEL[c.severity] ?? c.severity
    sevMap.set(sevLabel, (sevMap.get(sevLabel) ?? 0) + 1)

    // Open/resolved
    if (c.state === 'RESOLVED' || c.state === 'CLOSED') totalResolved++
    else totalOpen++

    // 7-day intake
    const received = new Date(c.receivedAt).getTime()
    if (received >= sevenDaysAgo) {
      const dayKey = new Date(c.receivedAt).toLocaleDateString('en-IN', { weekday: 'short' })
      dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + 1)
    }
  }

  return {
    categoryBreakdown: Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count })),
    severityBreakdown: ['Critical', 'Major', 'Minor']
      .map(s => ({ severity: s, count: sevMap.get(s) ?? 0 }))
      .filter(s => s.count > 0),
    last7Days: Array.from(dayMap.entries()).map(([date, count]) => ({ date, count })),
    totalOpen,
    totalResolved,
    avgResolutionDays: 0, // not available from list endpoint
  }
}

// ─── Main canvas ─────────────────────────────────────────────────────────────

export function AutoTriageCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [stats, setStats] = useState<TriageStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      // Try the real triage-stats endpoint first
      let triageRes: ApiTriageStats | null = null
      try {
        triageRes = await api<ApiTriageStats>('/api/complaints/triage-stats', { token })
      } catch {
        // endpoint not yet available — fall through to list-based fallback
      }

      if (triageRes) {
        // Map server-side aggregates directly into TriageStats
        const categoryBreakdown = triageRes.byCategory.map(row => ({
          category: CATEGORY_LABEL[row.category] ?? row.category.replace(/_/g, ' '),
          count: row._count.id,
        })).sort((a, b) => b.count - a.count)

        const severityBreakdown = triageRes.bySeverity
          .map(row => ({ severity: SEVERITY_LABEL[row.severity] ?? row.severity, count: row._count.id }))
          .filter(s => s.count > 0)

        const resolvedCount = triageRes.byState
          .filter(r => r.state === 'RESOLVED' || r.state === 'CLOSED')
          .reduce((acc, r) => acc + r._count.id, 0)
        const openCount = triageRes.byState
          .filter(r => r.state !== 'RESOLVED' && r.state !== 'CLOSED')
          .reduce((acc, r) => acc + r._count.id, 0)

        setStats({
          categoryBreakdown,
          severityBreakdown,
          last7Days: [],          // not in triage-stats response
          totalOpen: openCount,
          totalResolved: resolvedCount,
          avgResolutionDays: 0,
        })
      } else {
        // Fallback: derive stats from complaint list
        const res = await api<ApiComplaint[] | { complaints?: ApiComplaint[]; data?: ApiComplaint[] }>(
          '/api/complaints?limit=200',
          { token },
        )
        const complaints: ApiComplaint[] = Array.isArray(res)
          ? (res as ApiComplaint[])
          : ((res as { complaints?: ApiComplaint[]; data?: ApiComplaint[] }).complaints
            ?? (res as { data?: ApiComplaint[] }).data
            ?? [])
        setStats(buildStats(complaints))
      }
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load complaints data.' })
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void load() }, [load])

  const s = stats

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-txt-primary">Auto-Triage Analytics</div>
          <div className="text-[11px] text-txt-secondary">Category breakdown · Severity distribution · 7-day intake</div>
        </div>
        <button
          onClick={() => { void load() }}
          className="w-8 h-8 rounded-lg hover:bg-surface-secondary flex items-center justify-center text-txt-secondary"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-txt-tertiary text-[14px]">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading analytics…
        </div>
      ) : !s ? (
        <div className="flex items-center justify-center flex-1 text-danger text-[14px]">
          Failed to load data.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* KPI row */}
          <div className="flex gap-3 flex-wrap">
            <StatCard label="Open complaints" value={s.totalOpen} color="text-danger" />
            <StatCard label="Resolved" value={s.totalResolved} color="text-ok" />
            <StatCard label="Total" value={s.totalOpen + s.totalResolved} color="text-primary" />
          </div>

          {/* Donut — category breakdown */}
          {s.categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-card border border-bdr-light shadow-card p-4">
              <div className="text-[12px] font-bold uppercase tracking-widest text-txt-tertiary mb-3">
                Complaint Category Breakdown
              </div>
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="w-full lg:w-[220px] h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={s.categoryBreakdown}
                        dataKey="count"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        labelLine={false}
                        label={renderLabel as (props: unknown) => JSX.Element | null}
                      >
                        {s.categoryBreakdown.map((entry, i) => (
                          <Cell key={entry.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v} complaints`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  {s.categoryBreakdown.map((entry, i) => (
                    <div key={entry.category} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                      <div>
                        <div className="text-[11px] font-semibold text-txt-primary">{entry.category}</div>
                        <div className="text-[10px] text-txt-tertiary">{entry.count} complaints</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bar — severity distribution */}
          {s.severityBreakdown.length > 0 && (
            <div className="bg-white rounded-card border border-bdr-light shadow-card p-4">
              <div className="text-[12px] font-bold uppercase tracking-widest text-txt-tertiary mb-3">
                Severity Distribution
              </div>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.severityBreakdown} barSize={32}>
                    <XAxis dataKey="severity" tick={{ fontSize: 11, fill: '#7383A5' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#B8C0CC' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                      formatter={(v: number) => [`${v}`, 'Complaints']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {s.severityBreakdown.map(entry => (
                        <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity.toUpperCase()] ?? '#386AF6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Bar — last-7-day intake */}
          <div className="bg-white rounded-card border border-bdr-light shadow-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <div className="text-[12px] font-bold uppercase tracking-widest text-txt-tertiary">
                7-Day Intake
              </div>
            </div>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.last7Days} barSize={28}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7383A5' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#B8C0CC' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                    formatter={(v: number) => [`${v}`, 'Complaints']}
                  />
                  <Bar dataKey="count" name="Received" fill="#386AF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
