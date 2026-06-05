// AutoTriageCanvas — Complaints Officer
// Donut of complaint categories + bar of severity + last-7-day intake sparkline.

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
  Legend,
} from 'recharts'
import { Activity, RefreshCw, TrendingUp } from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TriageStats {
  categoryBreakdown: Array<{ category: string; count: number }>
  severityBreakdown: Array<{ severity: string; count: number }>
  last7Days: Array<{ date: string; count: number }>
  totalOpen: number
  totalResolved: number
  avgResolutionDays: number
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_STATS: TriageStats = {
  categoryBreakdown: [
    { category: 'Air Pollution', count: 112 },
    { category: 'Water Pollution', count: 78 },
    { category: 'Noise', count: 45 },
    { category: 'Hazardous Waste', count: 34 },
    { category: 'Odour', count: 21 },
    { category: 'Other', count: 10 },
  ],
  severityBreakdown: [
    { severity: 'critical', count: 18 },
    { severity: 'high', count: 52 },
    { severity: 'medium', count: 107 },
    { severity: 'low', count: 123 },
  ],
  last7Days: [
    { date: 'Mon', count: 14 },
    { date: 'Tue', count: 22 },
    { date: 'Wed', count: 18 },
    { date: 'Thu', count: 31 },
    { date: 'Fri', count: 27 },
    { date: 'Sat', count: 9 },
    { date: 'Sun', count: 7 },
  ],
  totalOpen: 168,
  totalResolved: 132,
  avgResolutionDays: 4.3,
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#386AF6', '#4CAF50', '#FFB300', '#E53935', '#7C3AED', '#0EA5E9',
]

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#E53935',
  high: '#F97316',
  medium: '#FFB300',
  low: '#4CAF50',
}

// ─── Custom donut label ───────────────────────────────────────────────────────

interface LabelProps {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
  name: string
}

function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: LabelProps) {
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

// ─── Main canvas ─────────────────────────────────────────────────────────────

export function AutoTriageCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [stats, setStats] = useState<TriageStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<TriageStats>('/api/complaints/triage-stats', {
        token: token ?? undefined,
      })
      setStats(res)
    } catch {
      showToast({ kind: 'warn', text: 'Using demo data — API not reachable.' })
      setStats(DEMO_STATS)
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void load() }, [load])

  const s = stats ?? DEMO_STATS

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

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* KPI row */}
        <div className="flex gap-3 flex-wrap">
          <StatCard label="Open complaints" value={s.totalOpen} color="text-danger" />
          <StatCard label="Resolved" value={s.totalResolved} color="text-ok" />
          <StatCard label="Avg resolution" value={`${s.avgResolutionDays}d`} sub="last 30 days" color="text-primary" />
        </div>

        {/* Donut — category breakdown */}
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

        {/* Bar — severity distribution */}
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
                    <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity] ?? '#386AF6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

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
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" name="Complaints received" fill="#386AF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
