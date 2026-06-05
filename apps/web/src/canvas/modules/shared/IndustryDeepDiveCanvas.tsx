/**
 * IndustryDeepDiveCanvas
 *
 * Args: { industryId: string }
 * Tabs (state-based, no router): Overview | Consents | Sensors | Inspections | Violations | Complaints
 * Fetches /api/industries/:id which returns: { industry, recentViolations, activeConsents, recentExceedances, recentComplaints }
 */

import { useEffect, useState } from 'react'
import {
  Building2,
  MapPin,
  AlertTriangle,
  ShieldCheck,
  Activity,
  ClipboardList,
  MessageCircle,
  Eye,
  RefreshCw,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'

// ── Types ────────────────────────────────────────────────────────────────────

interface Industry {
  id: string
  name: string
  ucNumber: string
  category: 'RED' | 'ORANGE' | 'GREEN' | 'WHITE'
  classificationScheme: string | null
  lat: number | null
  lng: number | null
  sector: { code: string; name: string } | null
  district: { code: string; name: string } | null
  taluka: { name: string } | null
  gidcZone: { name: string } | null
}

interface Violation {
  id: string
  parameter: string
  severity: string
  source: string
  detectedAt: string
  dispositionState: string
  observedValue: number | null
  normValue: number | null
  unit: string | null
}

interface Consent {
  id: string
  type: string
  state: string
  validityFrom: string | null
  validityTo: string | null
  submittedAt: string
}

interface Exceedance {
  id: string
  parameter: string
  observedValue: number
  normValue: number
  severity: string
  detectedAt: string
  dispositionState: string
}

interface Complaint {
  id: string
  category: string
  severity: string
  state: string
  receivedAt: string
  description: string
}

interface IndustryDetail {
  industry: Industry
  recentViolations: Violation[]
  activeConsents: Consent[]
  recentExceedances: Exceedance[]
  recentComplaints: Complaint[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'consents' | 'sensors' | 'inspections' | 'violations' | 'complaints'

const CATEGORY_COLORS: Record<string, string> = {
  RED: 'bg-red-100 text-red-700 border-red-200',
  ORANGE: 'bg-orange-100 text-orange-700 border-orange-200',
  GREEN: 'bg-green-100 text-green-700 border-green-200',
  WHITE: 'bg-slate-100 text-slate-700 border-slate-200',
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  MAJOR: 'bg-amber-100 text-amber-700',
  MINOR: 'bg-yellow-50 text-yellow-700',
}

const STATE_COLORS: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-700',
  UNDER_REVIEW: 'bg-blue-100 text-blue-700',
  RECOMMENDED: 'bg-teal-100 text-teal-700',
  PENDING: 'bg-slate-100 text-slate-600',
  CONFIRMED_VIOLATION: 'bg-red-100 text-red-700',
  SENSOR_GLITCH: 'bg-slate-100 text-slate-600',
  RESOLVED: 'bg-green-100 text-green-700',
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
      {label}
    </span>
  )
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: IndustryDetail }) {
  const { recentExceedances, recentViolations, recentComplaints, activeConsents } = data

  const exceedanceLast30 = recentExceedances.filter(
    (e) => new Date(e.detectedAt) > new Date(Date.now() - 30 * 86400_000),
  )

  const trendData = (() => {
    const buckets: Record<string, number> = {}
    exceedanceLast30.forEach((e) => {
      const day = new Date(e.detectedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      buckets[day] = (buckets[day] ?? 0) + 1
    })
    return Object.entries(buckets).map(([date, count]) => ({ date, count }))
  })()

  const statCards = [
    {
      label: 'Active Consents',
      value: activeConsents.length,
      icon: ShieldCheck,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Exceedances (30d)',
      value: exceedanceLast30.length,
      icon: Activity,
      color: 'text-red-600 bg-red-50',
    },
    {
      label: 'Open Violations',
      value: recentViolations.filter((v) => v.dispositionState !== 'RESOLVED').length,
      icon: AlertTriangle,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Complaints',
      value: recentComplaints.length,
      icon: MessageCircle,
      color: 'text-rose-600 bg-rose-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-bdr-light bg-white p-4 shadow-card">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-[22px] font-bold text-txt-primary">{value}</div>
            <div className="text-[12px] text-txt-secondary mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* 30-day exceedance trend */}
      {trendData.length > 0 && (
        <div className="rounded-2xl border border-bdr-light bg-white p-5 shadow-card">
          <div className="text-[13px] font-bold text-txt-primary mb-4">Exceedance trend — last 30 days</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#386AF6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent complaints summary */}
      {recentComplaints.length > 0 && (
        <div className="rounded-2xl border border-bdr-light bg-white p-5 shadow-card">
          <div className="text-[13px] font-bold text-txt-primary mb-3">Recent Complaints</div>
          <div className="space-y-2">
            {recentComplaints.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-bdr-light last:border-0">
                <div>
                  <div className="text-[12px] font-semibold text-txt-primary">{c.category.replace(/_/g, ' ')}</div>
                  <div className="text-[11px] text-txt-secondary line-clamp-1">{c.description}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <Badge label={c.severity} className={SEVERITY_COLORS[c.severity] ?? ''} />
                  <span className="text-[11px] text-txt-tertiary">{fmt(c.receivedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Consents ─────────────────────────────────────────────────────────────

function ConsentsTab({ consents }: { consents: Consent[] }) {
  if (!consents.length) {
    return <div className="text-[13px] text-txt-tertiary py-8 text-center">No active consent applications found.</div>
  }
  return (
    <div className="rounded-2xl border border-bdr-light bg-white overflow-hidden shadow-card">
      <table className="w-full text-[12px]">
        <thead className="bg-surface-page border-b border-bdr-light">
          <tr>
            <th className="text-left px-4 py-3 text-txt-secondary font-semibold">Type</th>
            <th className="text-left px-4 py-3 text-txt-secondary font-semibold">State</th>
            <th className="text-left px-4 py-3 text-txt-secondary font-semibold">Submitted</th>
            <th className="text-left px-4 py-3 text-txt-secondary font-semibold">Valid From</th>
            <th className="text-left px-4 py-3 text-txt-secondary font-semibold">Valid To</th>
          </tr>
        </thead>
        <tbody>
          {consents.map((c, i) => (
            <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-surface-page/30'}>
              <td className="px-4 py-3 font-semibold text-txt-primary">{c.type}</td>
              <td className="px-4 py-3">
                <Badge label={c.state.replace(/_/g, ' ')} className={STATE_COLORS[c.state] ?? ''} />
              </td>
              <td className="px-4 py-3 text-txt-secondary">{fmt(c.submittedAt)}</td>
              <td className="px-4 py-3 text-txt-secondary">{c.validityFrom ? fmt(c.validityFrom) : '—'}</td>
              <td className="px-4 py-3 text-txt-secondary">{c.validityTo ? fmt(c.validityTo) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab: Sensors (live OCEMS) ─────────────────────────────────────────────────

function SensorsTab({ exceedances }: { exceedances: Exceedance[] }) {
  if (!exceedances.length) {
    return <div className="text-[13px] text-txt-tertiary py-8 text-center">No recent sensor exceedances recorded.</div>
  }

  // Group by parameter
  const byParam: Record<string, Exceedance[]> = {}
  exceedances.forEach((e) => {
    if (!byParam[e.parameter]) byParam[e.parameter] = []
    byParam[e.parameter]!.push(e)
  })

  return (
    <div className="space-y-4">
      {Object.entries(byParam).map(([param, rows]) => (
        <div key={param} className="rounded-2xl border border-bdr-light bg-white p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-bold text-txt-primary">{param}</div>
            <Badge label={`${rows.length} exceedance${rows.length > 1 ? 's' : ''}`} className="bg-red-50 text-red-700 border-red-100" />
          </div>
          <div className="space-y-1">
            {rows.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-[11px] py-1 border-b border-bdr-light last:border-0">
                <div className="text-txt-secondary">{fmt(e.detectedAt)}</div>
                <div className="flex items-center gap-3">
                  <span className="text-txt-primary font-semibold">
                    {e.observedValue.toFixed(1)} <span className="text-txt-tertiary font-normal">/ norm {e.normValue.toFixed(1)}</span>
                  </span>
                  <Badge label={e.severity} className={SEVERITY_COLORS[e.severity] ?? ''} />
                  <Badge label={e.dispositionState.replace(/_/g, ' ')} className={STATE_COLORS[e.dispositionState] ?? ''} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Inspections ──────────────────────────────────────────────────────────

function InspectionsTab({ industryId }: { industryId: string }) {
  interface Inspection {
    id: string
    scheduledAt: string
    completedAt: string | null
    state: string
    inspector: { name: string } | null
    nextDueAt: string | null
  }

  const { token } = useAuth()
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api<{ items: Inspection[]; inspections?: Inspection[] }>(
      `/api/inspections?industryId=${industryId}&limit=20`,
      { token },
    )
      .then((r) => setInspections(r.items ?? r.inspections ?? []))
      .catch(() => setInspections([]))
      .finally(() => setLoading(false))
  }, [industryId, token])

  if (loading) return <div className="text-[13px] text-txt-tertiary py-8 text-center">Loading…</div>
  if (!inspections.length) return <div className="text-[13px] text-txt-tertiary py-8 text-center">No inspections on record.</div>

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-bdr-light" />
      <div className="space-y-4 pl-12">
        {inspections.map((ins) => (
          <div key={ins.id} className="relative">
            <div
              className={`absolute -left-9 w-3.5 h-3.5 rounded-full border-2 border-white ${ins.state === 'COMPLETED' ? 'bg-green-500' : ins.state === 'CANCELLED' ? 'bg-slate-400' : 'bg-primary'}`}
            />
            <div className="rounded-2xl border border-bdr-light bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-bold text-txt-primary">
                    {ins.completedAt ? fmt(ins.completedAt) : `Scheduled ${fmt(ins.scheduledAt)}`}
                  </div>
                  {ins.inspector && (
                    <div className="text-[11px] text-txt-secondary mt-0.5">
                      Inspector: {ins.inspector.name}
                    </div>
                  )}
                  {ins.nextDueAt && (
                    <div className="text-[11px] text-txt-tertiary mt-0.5">
                      Next due: {fmt(ins.nextDueAt)}
                    </div>
                  )}
                </div>
                <Badge label={ins.state} className={ins.state === 'COMPLETED' ? 'bg-green-100 text-green-700 border-green-200' : ins.state === 'CANCELLED' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-blue-100 text-blue-700 border-blue-200'} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab: Violations ──────────────────────────────────────────────────────────

function ViolationsTab({ violations }: { violations: Violation[] }) {
  if (!violations.length) {
    return <div className="text-[13px] text-txt-tertiary py-8 text-center">No violations recorded.</div>
  }
  return (
    <div className="rounded-2xl border border-bdr-light bg-white overflow-hidden shadow-card">
      <table className="w-full text-[12px]">
        <thead className="bg-surface-page border-b border-bdr-light">
          <tr>
            <th className="text-left px-4 py-3 text-txt-secondary font-semibold">Parameter</th>
            <th className="text-left px-4 py-3 text-txt-secondary font-semibold">Observed / Norm</th>
            <th className="text-left px-4 py-3 text-txt-secondary font-semibold">Severity</th>
            <th className="text-left px-4 py-3 text-txt-secondary font-semibold">Source</th>
            <th className="text-left px-4 py-3 text-txt-secondary font-semibold">Detected</th>
            <th className="text-left px-4 py-3 text-txt-secondary font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {violations.map((v, i) => (
            <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-surface-page/30'}>
              <td className="px-4 py-3 font-semibold text-txt-primary">{v.parameter}</td>
              <td className="px-4 py-3 text-txt-secondary">
                {v.observedValue != null
                  ? `${v.observedValue.toFixed(1)} / ${v.normValue?.toFixed(1) ?? '—'} ${v.unit ?? ''}`
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <Badge label={v.severity} className={SEVERITY_COLORS[v.severity] ?? ''} />
              </td>
              <td className="px-4 py-3 text-txt-secondary">{v.source}</td>
              <td className="px-4 py-3 text-txt-secondary">{fmt(v.detectedAt)}</td>
              <td className="px-4 py-3">
                <Badge label={v.dispositionState.replace(/_/g, ' ')} className={STATE_COLORS[v.dispositionState] ?? ''} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab: Complaints ───────────────────────────────────────────────────────────

function ComplaintsTab({ complaints }: { complaints: Complaint[] }) {
  if (!complaints.length) {
    return <div className="text-[13px] text-txt-tertiary py-8 text-center">No complaints filed against this industry.</div>
  }
  return (
    <div className="space-y-3">
      {complaints.map((c) => (
        <div key={c.id} className="rounded-2xl border border-bdr-light bg-white p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge label={c.category.replace(/_/g, ' ')} className="bg-slate-100 text-slate-700 border-slate-200" />
                <Badge label={c.severity} className={SEVERITY_COLORS[c.severity] ?? ''} />
                <Badge label={c.state.replace(/_/g, ' ')} className="bg-blue-50 text-blue-700 border-blue-100" />
              </div>
              <p className="text-[12px] text-txt-secondary leading-relaxed line-clamp-2">{c.description}</p>
            </div>
            <div className="text-[11px] text-txt-tertiary flex-shrink-0">{fmt(c.receivedAt)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  industryId: string
}

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview',    label: 'Overview',    icon: Eye },
  { id: 'consents',   label: 'Consents',    icon: ShieldCheck },
  { id: 'sensors',    label: 'Sensors',     icon: Activity },
  { id: 'inspections', label: 'Inspections', icon: ClipboardList },
  { id: 'violations', label: 'Violations',  icon: AlertTriangle },
  { id: 'complaints', label: 'Complaints',  icon: MessageCircle },
]

export function IndustryDeepDiveCanvas({ industryId }: Props) {
  const { token } = useAuth()
  const [data, setData] = useState<IndustryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  const load = () => {
    if (!token) return
    setLoading(true)
    setError(null)
    api<IndustryDetail>(`/api/industries/${industryId}`, { token })
      .then(setData)
      .catch((e: { message?: string }) => setError(e.message ?? 'Failed to load industry'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [industryId, token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
        <span className="ml-2 text-[13px] text-txt-secondary">Loading industry data…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <div className="text-[13px] text-txt-secondary">{error ?? 'Industry not found'}</div>
        <button onClick={load} className="text-[12px] text-primary hover:underline font-semibold">Retry</button>
      </div>
    )
  }

  const { industry, recentViolations, activeConsents, recentExceedances, recentComplaints } = data

  return (
    <div className="flex flex-col h-full bg-surface-page" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <div className="bg-white border-b border-bdr-light px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[18px] font-bold text-txt-primary leading-tight">{industry.name}</h1>
              <Badge
                label={industry.category}
                className={CATEGORY_COLORS[industry.category] ?? 'bg-slate-100 text-slate-700 border-slate-200'}
              />
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-[12px] text-txt-secondary">
              <span className="font-semibold text-txt-tertiary">{industry.ucNumber}</span>
              {industry.sector && <span>· {industry.sector.name}</span>}
              {industry.gidcZone && <span>· GIDC {industry.gidcZone.name}</span>}
            </div>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-txt-tertiary">
              <MapPin className="w-3 h-3" />
              {[industry.district?.name, industry.taluka?.name].filter(Boolean).join(', ')}
              {industry.lat != null && industry.lng != null && (
                <span className="ml-1">({industry.lat.toFixed(4)}, {industry.lng.toFixed(4)})</span>
              )}
            </div>
          </div>
          <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 flex-shrink-0" title="Refresh">
            <RefreshCw className="w-4 h-4 text-txt-tertiary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all ${
                tab === id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-txt-secondary hover:bg-surface-page hover:text-txt-primary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === 'overview' && <OverviewTab data={data} />}
        {tab === 'consents' && <ConsentsTab consents={activeConsents} />}
        {tab === 'sensors' && <SensorsTab exceedances={recentExceedances} />}
        {tab === 'inspections' && <InspectionsTab industryId={industryId} />}
        {tab === 'violations' && <ViolationsTab violations={recentViolations} />}
        {tab === 'complaints' && <ComplaintsTab complaints={recentComplaints} />}
      </div>
    </div>
  )
}
