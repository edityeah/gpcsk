/**
 * WarRoomCanvas — Senior Reviewer live-anomaly investigation view.
 *
 * Reproduces the KSK War Room design pattern for GPCSK pollution domain.
 *
 * Layout:
 *  • Top header strip: title + sub + filters + refresh
 *  • Status banner: WAR ROOM · LIVE ANOMALIES eyebrow, big counts, description
 *  • Body: vertical stack of anomaly cards with severity, chips, actions, Saathi CTA
 *
 * Polls /api/stats/war-room every 60 seconds.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw,
  AlertTriangle,
  Siren,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronUp as ChevronUpIcon,
} from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useChat } from '../../../context/ChatContext.js'
import { useApp } from '../../../context/AppContext.js'
import { AskSaathiButton } from '../../../components/AskSaathiButton.js'
import { GujaratHeatmap } from '../../../components/GujaratHeatmap.js'

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = 'CRITICAL' | 'MAJOR' | 'ANOMALY'
type AlertState = 'open' | 'escalated' | 'snoozed' | 'resolved'

interface Entity {
  label: string
  kind: 'industry' | 'cetp' | 'station' | 'district' | 'metric'
}

interface Anomaly {
  id: string
  severity: Severity
  type: string
  title: string
  description: string
  entities: Entity[]
  suggestedActions: string[]
  saathiPrompt: string
  state: AlertState
}

interface WarRoomData {
  open: number
  escalated: number
  snoozed: number
  anomalies: Anomaly[]
  generatedAt: string
}

// ── Severity config ───────────────────────────────────────────────────────────

const SEV_CONFIG: Record<Severity, {
  cardBg: string
  cardBorder: string
  iconBg: string
  labelText: string
  Icon: typeof Siren
}> = {
  CRITICAL: {
    cardBg: 'bg-red-50/60',
    cardBorder: 'border-red-200',
    iconBg: 'bg-red-100',
    labelText: 'text-red-600',
    Icon: Siren,
  },
  MAJOR: {
    cardBg: 'bg-amber-50/60',
    cardBorder: 'border-amber-200',
    iconBg: 'bg-amber-100',
    labelText: 'text-amber-600',
    Icon: ShieldAlert,
  },
  ANOMALY: {
    cardBg: 'bg-blue-50/60',
    cardBorder: 'border-blue-200',
    iconBg: 'bg-blue-100',
    labelText: 'text-blue-600',
    Icon: AlertTriangle,
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// ── Anomaly card ──────────────────────────────────────────────────────────────

interface AnomalyCardProps {
  anomaly: Anomaly
  onInvestigate: (prompt: string) => void
  onEscalate: (id: string) => void
  onSnooze: (id: string) => void
  onResolve: (id: string) => void
}

function AnomalyCard({ anomaly, onInvestigate, onEscalate, onSnooze, onResolve }: AnomalyCardProps) {
  const cfg = SEV_CONFIG[anomaly.severity]
  const { Icon } = cfg
  const { showToast } = useApp()

  function handleAction(action: string) {
    showToast({ kind: 'info', text: `Action queued: ${action}` })
  }

  if (anomaly.state === 'resolved') return null

  const stateBadge = anomaly.state !== 'open' ? (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
      anomaly.state === 'escalated' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
    }`}>
      {anomaly.state}
    </span>
  ) : null

  return (
    <div
      className={`rounded-2xl border ${cfg.cardBg} ${cfg.cardBorder} p-4 flex gap-3`}
      style={{ fontFamily: 'Montserrat, sans-serif' }}
    >
      {/* Severity icon block */}
      <div className={`flex-shrink-0 w-11 h-11 rounded-2xl ${cfg.iconBg} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${cfg.labelText}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Label row */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.labelText}`}>
            {anomaly.severity} · {anomaly.type}
          </span>
          {stateBadge}
        </div>

        {/* Title */}
        <div className="text-[14px] font-bold text-txt-primary leading-snug mb-1">
          {anomaly.title}
        </div>

        {/* Description */}
        <p className="text-[12px] text-txt-secondary leading-relaxed line-clamp-3 mb-2">
          {anomaly.description}
        </p>

        {/* Entity chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {anomaly.entities.map((e, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-bdr-light text-[11px] text-txt-secondary font-medium"
            >
              {e.label}
            </span>
          ))}
        </div>

        {/* Suggested action chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {anomaly.suggestedActions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleAction(action)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700 font-medium hover:bg-emerald-100 transition"
            >
              📣 {action}
            </button>
          ))}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Primary CTA */}
          <button
            type="button"
            onClick={() => onInvestigate(anomaly.saathiPrompt)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-primary text-white text-[12px] font-bold hover:bg-primary-dark transition active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Investigate with Saathi
          </button>

          {/* Secondary actions */}
          {anomaly.state === 'open' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEscalate(anomaly.id)}
                className="text-[11px] text-txt-secondary hover:text-danger transition font-medium"
              >
                ↗ Escalate
              </button>
              <button
                type="button"
                onClick={() => onSnooze(anomaly.id)}
                className="text-[11px] text-txt-secondary hover:text-txt-primary transition font-medium"
              >
                🌙 Snooze 7d
              </button>
              <button
                type="button"
                onClick={() => onResolve(anomaly.id)}
                className="text-[11px] text-txt-secondary hover:text-ok transition font-medium"
              >
                ✓ Resolve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────

interface FiltersProps {
  severity: Severity | 'ALL'
  onSeverity: (s: Severity | 'ALL') => void
}

function FilterBar({ severity, onSeverity }: FiltersProps) {
  const [open, setOpen] = useState(false)
  const severities: Array<Severity | 'ALL'> = ['ALL', 'CRITICAL', 'MAJOR', 'ANOMALY']

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-bdr-light bg-white text-[12px] text-txt-secondary hover:border-bdr transition"
      >
        Severity: {severity}
        {open ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 z-10 bg-white border border-bdr-light rounded-xl shadow-modal overflow-hidden min-w-[140px]">
          {severities.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { onSeverity(s); setOpen(false) }}
              className={`w-full text-left px-4 py-2 text-[13px] hover:bg-surface-page transition ${
                severity === s ? 'text-primary font-bold' : 'text-txt-primary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function WarRoomCanvas() {
  const { token } = useAuth()
  const { sendMessage } = useChat()
  const { showToast } = useApp()
  const [data, setData] = useState<WarRoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [severity, setSeverity] = useState<Severity | 'ALL'>('ALL')

  const load = useCallback(() => {
    if (!token) return
    setLoading(true)
    api<WarRoomData>('/api/stats/war-room', { token })
      .then(d => {
        setData(d)
        setError(null)
        setLastRefreshed(new Date())
      })
      .catch((e: { message?: string }) => setError(e.message ?? 'Failed to load war-room data'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  // State change: optimistic update, then re-fetch
  async function patchAlertState(id: string, action: 'escalate' | 'snooze' | 'resolve') {
    if (!token) return
    const newState: AlertState = action === 'escalate' ? 'escalated' : action === 'snooze' ? 'snoozed' : 'resolved'
    // Optimistic
    setData(prev => prev
      ? {
          ...prev,
          anomalies: prev.anomalies.map(a => a.id === id ? { ...a, state: newState } : a),
        }
      : prev
    )
    try {
      await api(`/api/stats/war-room/${id}/${action}`, { token, method: 'POST' })
      showToast({ kind: 'success', text: `Alert ${newState}` })
    } catch {
      showToast({ kind: 'danger', text: 'Failed to update alert state' })
      load() // revert
    }
  }

  function handleInvestigate(prompt: string) {
    void sendMessage(prompt)
  }

  const filtered = data?.anomalies.filter(a =>
    a.state !== 'resolved' && (severity === 'ALL' || a.severity === severity)
  ) ?? []

  return (
    <div className="flex flex-col min-h-full bg-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* ── Top header strip ── */}
      <div className="px-5 py-4 border-b border-bdr-light bg-white flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Left: title */}
          <div>
            <div className="flex items-center gap-2">
              <Siren className="w-5 h-5 text-rose-600" />
              <h2 className="text-[18px] font-black text-txt-primary tracking-tight">War Room</h2>
            </div>
            <p className="text-[12px] text-txt-secondary mt-0.5">
              Live anomalies · investigate + act
            </p>
          </div>

          {/* Right: filters + refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <FilterBar severity={severity} onSeverity={setSeverity} />
            {lastRefreshed && (
              <span className="text-[11px] text-txt-tertiary hidden sm:block">
                Updated {fmtTime(lastRefreshed.toISOString())}
              </span>
            )}
            <button
              type="button"
              onClick={load}
              className="w-9 h-9 rounded-xl border border-bdr-light flex items-center justify-center hover:bg-surface-page transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-txt-secondary ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-5 mt-3 px-4 py-3 rounded-xl bg-danger-light border border-danger/20 text-danger text-[13px]">
          {error}
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {/* Gujarat district heatmap */}
        <GujaratHeatmap />

        {/* Status banner */}
        {data && (
          <div className="rounded-2xl bg-surface-page border border-bdr-light px-5 py-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[10px] font-black uppercase tracking-[3px] text-primary flex-1">
                WAR ROOM · LIVE ANOMALIES
              </div>
              {/* AskSaathiButton — use compact pill variant for section headers */}
              <AskSaathiButton
                prompt="What's the worst anomaly right now?"
                label="Ask Saathi"
                compact
              />
            </div>
            <div className="text-[26px] font-black text-txt-primary leading-tight">
              {data.open} open
              {' '}
              <span className="text-txt-tertiary font-normal text-[20px]">·</span>
              {' '}
              <span className="text-red-600">{data.escalated} escalated</span>
              {' '}
              <span className="text-txt-tertiary font-normal text-[20px]">·</span>
              {' '}
              <span className="text-txt-secondary">{data.snoozed} snoozed</span>
            </div>
            <p className="text-[12px] text-txt-secondary mt-2 leading-relaxed">
              Auto-generated alerts from GPCB live data. Tap any alert to investigate with Saathi, fire an action, or escalate.
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-txt-tertiary">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-[13px]">Loading anomalies…</span>
            </div>
          </div>
        )}

        {/* Anomaly cards */}
        {filtered.map(anomaly => (
          <AnomalyCard
            key={anomaly.id}
            anomaly={anomaly}
            onInvestigate={handleInvestigate}
            onEscalate={(id) => patchAlertState(id, 'escalate')}
            onSnooze={(id) => patchAlertState(id, 'snooze')}
            onResolve={(id) => patchAlertState(id, 'resolve')}
          />
        ))}

        {/* Empty state */}
        {data && filtered.length === 0 && (
          <div className="text-center py-12 text-txt-tertiary">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <div className="text-[14px] font-medium">No {severity !== 'ALL' ? severity.toLowerCase() : ''} anomalies open</div>
            <div className="text-[12px] mt-1">All clear — or adjust your severity filter.</div>
          </div>
        )}
      </div>
    </div>
  )
}
