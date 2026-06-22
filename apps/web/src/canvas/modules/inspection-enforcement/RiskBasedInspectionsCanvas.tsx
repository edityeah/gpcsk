/**
 * RiskBasedInspectionsCanvas
 *
 * Implements the AI-suggest → review → schedule workflow for risk-based inspections.
 *
 * Layout:
 *   - Header: title + subtitle
 *   - KPI tiles: suggested, confirmedLast30d, dismissedLast30d, avgTimeToDecisionHours
 *   - Tabbed list: [AI Suggestions] [Confirmed (30d)] [Dismissed (30d)]
 *
 * AI Suggestions tab:
 *   - RiskBasedSuggestion rows sorted by riskScore desc
 *   - Each card: industry name, district, category badge, risk score + mini bar,
 *     breakdown chips, suggested-at relative time
 *   - Actions: [Schedule Inspection] (opens ConfirmInspectionModal) | [Dismiss] (dismiss modal)
 *
 * Confirm modal: date/time picker + inspector dropdown → POST confirm → toast + remove
 * Dismiss modal: textarea for reason → POST dismiss → toast + remove
 *
 * Confirmed / Dismissed tabs: read-only rows showing decidedBy + decidedAt
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Target, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle,
  Calendar, ChevronRight, X, Loader2,
} from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RiskBasedSuggestion {
  id: string
  industryId: string
  riskScore: number
  breakdown: {
    exceedance30d: number
    complaints30d: number
    openInspections: number
    consentGapDays: number
  }
  state: 'SUGGESTED' | 'CONFIRMED' | 'DISMISSED'
  suggestedAt: string
  decidedAt: string | null
  scheduledInspectionId: string | null
  industry: {
    id: string
    name: string
    ucNumber: string
    category: string
    district: { name: string } | null
  }
  decidedBy: { id: string; name: string } | null
}

interface QueueStats {
  suggested: number
  confirmedLast30d: number
  dismissedLast30d: number
  avgTimeToDecisionHours: number | null
}

interface InspectorUser {
  id: string
  name: string
  role: string
  designation: string | null
}

type TabId = 'SUGGESTED' | 'CONFIRMED' | 'DISMISSED'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_BADGE: Record<string, string> = {
  RED:    'bg-danger-light text-danger',
  ORANGE: 'bg-warn-light text-warn',
  GREEN:  'bg-ok-light text-ok',
  WHITE:  'bg-slate-100 text-slate-500',
}

function riskBarColor(score: number): string {
  if (score >= 70) return 'bg-danger'
  if (score >= 40) return 'bg-warn'
  return 'bg-ok'
}

function riskTextColor(score: number): string {
  if (score >= 70) return 'text-danger font-bold'
  if (score >= 40) return 'text-warn font-semibold'
  return 'text-ok'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** Default scheduledAt: 7 days from now, formatted for datetime-local input */
function defaultScheduledAt(): string {
  const d = new Date(Date.now() + 7 * 86_400_000)
  // datetime-local value: "YYYY-MM-DDThh:mm"
  return d.toISOString().slice(0, 16)
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, color }: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="flex-1 min-w-[130px] bg-white rounded-xl border border-bdr px-4 py-3 shadow-sm">
      <div className={`text-[22px] font-extrabold tabular-nums leading-tight ${color ?? 'text-txt-primary'}`}>
        {value}
      </div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-txt-secondary mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-txt-tertiary mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Breakdown chip ─────────────────────────────────────────────────────────────

function BreakdownChip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
      highlight && value > 0
        ? 'border-danger/30 bg-danger-light text-danger'
        : 'border-bdr bg-surface-page text-txt-secondary'
    }`}>
      <span className="font-bold tabular-nums">{value}</span>
      <span className="text-txt-tertiary">{label}</span>
    </span>
  )
}

// ── Confirm Inspection Modal ───────────────────────────────────────────────────

function ConfirmInspectionModal({
  suggestion,
  inspectors,
  onClose,
  onConfirmed,
}: {
  suggestion: RiskBasedSuggestion
  inspectors: InspectorUser[]
  onClose: () => void
  onConfirmed: (id: string) => void
}) {
  const { token } = useAuth()
  const { showToast } = useApp()

  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt())
  const [inspectorId, setInspectorId] = useState(inspectors[0]?.id ?? '')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!scheduledAt) return
    setSubmitting(true)
    try {
      await api(`/api/inspections/risk-based-queue/${suggestion.id}/confirm`, {
        method: 'POST',
        token: token ?? undefined,
        body: {
          scheduledAt: new Date(scheduledAt).toISOString(),
          inspectorId: inspectorId || undefined,
        },
      })
      showToast({ kind: 'success', text: `Inspection scheduled for ${suggestion.industry.name}` })
      onConfirmed(suggestion.id)
      onClose()
    } catch {
      showToast({ kind: 'danger', text: 'Failed to confirm inspection. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Modal header */}
        <div className="px-5 py-4 border-b border-bdr flex items-center justify-between bg-ok-light">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-ok" />
            <h3 className="text-[14px] font-bold text-txt-primary">Schedule Inspection</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
            <X className="w-4 h-4 text-txt-secondary" />
          </button>
        </div>

        {/* Industry info */}
        <div className="px-5 py-3 border-b border-bdr bg-surface-page">
          <div className="font-semibold text-[13px] text-txt-primary">{suggestion.industry.name}</div>
          <div className="text-[11px] text-txt-secondary mt-0.5">
            {suggestion.industry.district?.name} · {suggestion.industry.ucNumber}
            <span className={`ml-2 badge ${CATEGORY_BADGE[suggestion.industry.category] ?? 'bg-slate-100 text-slate-500'}`}>
              {suggestion.industry.category}
            </span>
          </div>
          <div className={`text-[20px] font-extrabold tabular-nums mt-2 ${riskTextColor(suggestion.riskScore)}`}>
            {suggestion.riskScore.toFixed(1)} <span className="text-[12px] font-normal text-txt-tertiary">/ 100 risk score</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 flex flex-col gap-4">
          {/* Date/time picker */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">
              Scheduled Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="px-3 py-2 rounded-lg border border-bdr text-[13px] bg-white outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          {/* Inspector dropdown */}
          {inspectors.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">
                Inspector
              </label>
              <select
                value={inspectorId}
                onChange={e => setInspectorId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-bdr text-[13px] bg-white outline-none focus:ring-2 focus:ring-primary/30"
              >
                {inspectors.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.designation ? ` — ${u.designation}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-bdr text-[13px] text-txt-secondary hover:bg-surface-page transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ok text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              {submitting ? 'Scheduling…' : 'Confirm & Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Dismiss Modal ─────────────────────────────────────────────────────────────

function DismissModal({
  suggestion,
  onClose,
  onDismissed,
}: {
  suggestion: RiskBasedSuggestion
  onClose: () => void
  onDismissed: (id: string) => void
}) {
  const { token } = useAuth()
  const { showToast } = useApp()

  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    setSubmitting(true)
    try {
      await api(`/api/inspections/risk-based-queue/${suggestion.id}/dismiss`, {
        method: 'POST',
        token: token ?? undefined,
        body: { reason: reason.trim() },
      })
      showToast({ kind: 'info', text: `Suggestion dismissed for ${suggestion.industry.name}` })
      onDismissed(suggestion.id)
      onClose()
    } catch {
      showToast({ kind: 'danger', text: 'Failed to dismiss suggestion. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Modal header */}
        <div className="px-5 py-4 border-b border-bdr flex items-center justify-between bg-danger-light">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-danger" />
            <h3 className="text-[14px] font-bold text-txt-primary">Dismiss Suggestion</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
            <X className="w-4 h-4 text-txt-secondary" />
          </button>
        </div>

        {/* Industry info */}
        <div className="px-5 py-3 border-b border-bdr bg-surface-page">
          <div className="font-semibold text-[13px] text-txt-primary">{suggestion.industry.name}</div>
          <div className="text-[11px] text-txt-secondary mt-0.5">
            {suggestion.industry.district?.name} · Risk score: {suggestion.riskScore.toFixed(1)}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">
              Reason for dismissal <span className="text-danger">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Risk re-assessed — recent inspection completed, sensor calibration issue, data anomaly…"
              rows={3}
              className="px-3 py-2 rounded-lg border border-bdr text-[13px] bg-white outline-none focus:ring-2 focus:ring-danger/30 resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-bdr text-[13px] text-txt-secondary hover:bg-surface-page transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-danger text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              {submitting ? 'Dismissing…' : 'Dismiss'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Suggestion card (AI Suggestions tab) ─────────────────────────────────────

function SuggestionCard({
  item,
  onSchedule,
  onDismiss,
}: {
  item: RiskBasedSuggestion
  onSchedule: (item: RiskBasedSuggestion) => void
  onDismiss: (item: RiskBasedSuggestion) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-bdr shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow animate-fade-in">
      {/* Top row: industry info + risk score */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[14px] text-txt-primary leading-tight truncate">
              {item.industry.name}
            </span>
            <span className={`badge text-[10px] ${CATEGORY_BADGE[item.industry.category] ?? 'bg-slate-100 text-slate-500'}`}>
              {item.industry.category}
            </span>
          </div>
          <div className="text-[11px] text-txt-secondary mt-0.5">
            {item.industry.district?.name ?? '—'} · {item.industry.ucNumber}
          </div>
        </div>

        {/* Risk score */}
        <div className="text-right flex-shrink-0">
          <div className={`text-[26px] font-extrabold tabular-nums leading-none ${riskTextColor(item.riskScore)}`}>
            {item.riskScore.toFixed(0)}
          </div>
          <div className="text-[10px] text-txt-tertiary">/ 100</div>
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${riskBarColor(item.riskScore)}`}
          style={{ width: `${Math.min(item.riskScore, 100)}%` }}
        />
      </div>

      {/* Breakdown chips */}
      <div className="flex flex-wrap gap-1.5">
        <BreakdownChip label="exc 30d" value={item.breakdown.exceedance30d} highlight />
        <BreakdownChip label="complaints 30d" value={item.breakdown.complaints30d} highlight />
        <BreakdownChip label="open insp" value={item.breakdown.openInspections} />
        <BreakdownChip label="consent gap d" value={item.breakdown.consentGapDays} highlight={item.breakdown.consentGapDays > 30} />
      </div>

      {/* Footer: suggested at + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-bdr-light">
        <div className="flex items-center gap-1 text-[11px] text-txt-tertiary">
          <Clock className="w-3 h-3" />
          Suggested {relativeTime(item.suggestedAt)}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onDismiss(item)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-bdr text-[12px] text-txt-secondary hover:bg-surface-page hover:text-danger transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Dismiss
          </button>
          <button
            onClick={() => onSchedule(item)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ok text-white text-[12px] font-semibold hover:opacity-90 transition-opacity"
          >
            <Calendar className="w-3.5 h-3.5" />
            Schedule Inspection
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Decided card (Confirmed / Dismissed tabs) ─────────────────────────────────

function DecidedCard({ item }: { item: RiskBasedSuggestion }) {
  const isConfirmed = item.state === 'CONFIRMED'

  return (
    <div className="bg-white rounded-xl border border-bdr shadow-sm p-4 flex flex-col gap-2 opacity-90">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[13px] text-txt-primary truncate">{item.industry.name}</span>
            <span className={`badge text-[10px] ${CATEGORY_BADGE[item.industry.category] ?? 'bg-slate-100 text-slate-500'}`}>
              {item.industry.category}
            </span>
            <span className={`flex items-center gap-1 text-[11px] font-semibold ${isConfirmed ? 'text-ok' : 'text-txt-tertiary'}`}>
              {isConfirmed
                ? <><CheckCircle2 className="w-3 h-3" /> Confirmed</>
                : <><XCircle className="w-3 h-3" /> Dismissed</>
              }
            </span>
          </div>
          <div className="text-[11px] text-txt-secondary mt-0.5">
            {item.industry.district?.name ?? '—'} · {item.industry.ucNumber}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-[20px] font-extrabold tabular-nums leading-none ${riskTextColor(item.riskScore)}`}>
            {item.riskScore.toFixed(0)}
          </div>
          <div className="text-[10px] text-txt-tertiary">/ 100</div>
        </div>
      </div>

      {/* Breakdown chips (compact) */}
      <div className="flex flex-wrap gap-1.5">
        <BreakdownChip label="exc 30d" value={item.breakdown.exceedance30d} highlight />
        <BreakdownChip label="complaints 30d" value={item.breakdown.complaints30d} highlight />
        <BreakdownChip label="open insp" value={item.breakdown.openInspections} />
        <BreakdownChip label="consent gap d" value={item.breakdown.consentGapDays} />
      </div>

      {/* Decision metadata */}
      <div className="flex items-center gap-3 text-[11px] text-txt-tertiary pt-1 border-t border-bdr-light flex-wrap">
        {item.decidedBy && (
          <span className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            {isConfirmed ? 'Confirmed' : 'Dismissed'} by <strong className="text-txt-secondary">{item.decidedBy.name}</strong>
          </span>
        )}
        {item.decidedAt && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(item.decidedAt)}
          </span>
        )}
        {isConfirmed && item.scheduledInspectionId && (
          <span className="flex items-center gap-1 text-ok">
            <Calendar className="w-3 h-3" />
            Inspection scheduled
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main canvas ───────────────────────────────────────────────────────────────

export function RiskBasedInspectionsCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()

  const [stats, setStats] = useState<QueueStats | null>(null)
  const [items, setItems] = useState<RiskBasedSuggestion[]>([])
  const [inspectors, setInspectors] = useState<InspectorUser[]>([])
  const [activeTab, setActiveTab] = useState<TabId>('SUGGESTED')
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingItems, setLoadingItems] = useState(true)
  const [confirmTarget, setConfirmTarget] = useState<RiskBasedSuggestion | null>(null)
  const [dismissTarget, setDismissTarget] = useState<RiskBasedSuggestion | null>(null)

  // Load KPI stats
  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const data = await api<QueueStats>('/api/inspections/risk-based-queue/stats', {
        token: token ?? undefined,
      })
      setStats(data)
    } catch {
      // Non-fatal; KPI tiles will show "—"
    } finally {
      setLoadingStats(false)
    }
  }, [token])

  // Load queue items for the active tab
  const loadItems = useCallback(async (tab: TabId) => {
    setLoadingItems(true)
    try {
      const data = await api<RiskBasedSuggestion[]>(
        `/api/inspections/risk-based-queue?state=${tab}`,
        { token: token ?? undefined },
      )
      setItems(data)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load inspection queue.' })
    } finally {
      setLoadingItems(false)
    }
  }, [token, showToast])

  // Load inspector users for the confirm modal dropdown
  const loadInspectors = useCallback(async () => {
    try {
      const data = await api<InspectorUser[]>(
        '/api/users?role=INSPECTION_ENFORCEMENT_OFFICER',
        { token: token ?? undefined },
      )
      setInspectors(data)
    } catch {
      // Non-fatal — dropdown just won't show
    }
  }, [token])

  useEffect(() => {
    void loadStats()
    void loadInspectors()
  }, [loadStats, loadInspectors])

  useEffect(() => {
    void loadItems(activeTab)
  }, [activeTab, loadItems])

  function handleTabChange(tab: TabId) {
    setActiveTab(tab)
  }

  function handleRefresh() {
    void loadStats()
    void loadItems(activeTab)
  }

  /** Remove a suggestion from the list after it's been actioned */
  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    void loadStats()
  }

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'SUGGESTED',  label: 'AI Suggestions',   count: stats?.suggested },
    { id: 'CONFIRMED',  label: 'Confirmed (30d)',   count: stats?.confirmedLast30d },
    { id: 'DISMISSED',  label: 'Dismissed (30d)',   count: stats?.dismissedLast30d },
  ]

  return (
    <div className="flex flex-col h-full bg-surface-page animate-fade-in">
      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-bdr bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
            <Target className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-txt-primary">Risk-Based Inspections</h2>
            <p className="text-[12px] text-txt-secondary">AI-prioritised inspection targets — review, dismiss, or schedule</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loadingStats || loadingItems}
          className="p-2 rounded-lg hover:bg-surface-page disabled:opacity-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-txt-secondary ${(loadingStats || loadingItems) ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── KPI tiles ── */}
      <div className="px-6 py-3 border-b border-bdr bg-surface-page flex-shrink-0">
        <div className="flex gap-3 flex-wrap">
          <KpiTile
            label="Pending AI Suggestions"
            value={loadingStats ? '…' : (stats?.suggested ?? 0)}
            color="text-rose-600"
          />
          <KpiTile
            label="Confirmed (30d)"
            value={loadingStats ? '…' : (stats?.confirmedLast30d ?? 0)}
            color="text-ok"
          />
          <KpiTile
            label="Dismissed (30d)"
            value={loadingStats ? '…' : (stats?.dismissedLast30d ?? 0)}
            color="text-txt-secondary"
          />
          <KpiTile
            label="Avg Decision Time"
            value={
              loadingStats ? '…' :
              stats?.avgTimeToDecisionHours != null
                ? `${stats.avgTimeToDecisionHours}h`
                : '—'
            }
            sub="hours, last 30d"
            color="text-indigo-600"
          />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="px-6 pt-3 border-b border-bdr bg-white flex-shrink-0">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-[12px] font-semibold transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-rose-500 text-rose-600 bg-rose-50'
                  : 'border-transparent text-txt-secondary hover:text-txt-primary hover:bg-surface-page'
              }`}
            >
              {tab.id === 'SUGGESTED' && <Target className="w-3.5 h-3.5" />}
              {tab.id === 'CONFIRMED' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {tab.id === 'DISMISSED' && <XCircle className="w-3.5 h-3.5" />}
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === tab.id ? 'bg-rose-500 text-white' : 'bg-bdr text-txt-tertiary'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">
        {loadingItems && (
          <div className="flex items-center justify-center h-48 gap-2 text-txt-tertiary text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        )}

        {!loadingItems && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-txt-tertiary">
            {activeTab === 'SUGGESTED' ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-ok" />
                <p className="text-[13px] font-medium">No pending AI suggestions</p>
                <p className="text-[11px]">All suggestions have been reviewed.</p>
              </>
            ) : activeTab === 'CONFIRMED' ? (
              <>
                <AlertTriangle className="w-8 h-8 text-txt-tertiary/40" />
                <p className="text-[13px] font-medium">No confirmed inspections in the last 30 days</p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-8 h-8 text-txt-tertiary/40" />
                <p className="text-[13px] font-medium">No dismissed suggestions in the last 30 days</p>
              </>
            )}
          </div>
        )}

        {!loadingItems && items.length > 0 && (
          <div className="p-4 flex flex-col gap-3">
            {activeTab === 'SUGGESTED'
              ? items.map(item => (
                  <SuggestionCard
                    key={item.id}
                    item={item}
                    onSchedule={setConfirmTarget}
                    onDismiss={setDismissTarget}
                  />
                ))
              : items.map(item => (
                  <DecidedCard key={item.id} item={item} />
                ))
            }
          </div>
        )}
      </div>

      {/* ── Confirm inspection modal ── */}
      {confirmTarget && (
        <ConfirmInspectionModal
          suggestion={confirmTarget}
          inspectors={inspectors}
          onClose={() => setConfirmTarget(null)}
          onConfirmed={removeItem}
        />
      )}

      {/* ── Dismiss modal ── */}
      {dismissTarget && (
        <DismissModal
          suggestion={dismissTarget}
          onClose={() => setDismissTarget(null)}
          onDismissed={removeItem}
        />
      )}
    </div>
  )
}
