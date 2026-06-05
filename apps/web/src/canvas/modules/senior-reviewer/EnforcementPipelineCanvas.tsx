/**
 * EnforcementPipelineCanvas — Senior Reviewer mega-dashboard #3
 *
 * Kanban view of EnforcementActions by state.
 * PENDING_REVIEW cards show inline Approve / Return-for-revision buttons.
 * Uses /api/enforcement and /api/enforcement/:id/approve + /api/enforcement/:id/return-for-revision.
 * Cards animate on state change.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  FileWarning,
  Scale,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'
import { api } from '../../../lib/api.js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnforcementItem {
  id: string
  type: string
  state: string
  draftedAt: string
  reviewedAt: string | null
  reviewerNotes: string | null
  industry: {
    id: string
    name: string
    ucNumber: string
    category: string
  }
  draftedBy: {
    id: string
    name: string
    designation: string | null
  }
  reviewedBy?: {
    id: string
    name: string
  } | null
}

// ── Column config ─────────────────────────────────────────────────────────────

const COLUMNS = [
  { state: 'DRAFT',                label: 'Draft',            icon: FileWarning,    color: 'text-txt-secondary', bg: 'bg-slate-50' },
  { state: 'PENDING_REVIEW',       label: 'Pending Review',   icon: Clock,          color: 'text-warn',          bg: 'bg-warn-light' },
  { state: 'COMMITTED',            label: 'Committed',        icon: CheckCircle,    color: 'text-ok',            bg: 'bg-ok-light' },
  { state: 'RETURNED_FOR_REVISION',label: 'Returned',         icon: AlertCircle,    color: 'text-flag',          bg: 'bg-flag-light' },
  { state: 'WITHDRAWN',            label: 'Withdrawn',        icon: XCircle,        color: 'text-txt-tertiary',  bg: 'bg-slate-50' },
]

const TYPE_LABELS: Record<string, string> = {
  SHOW_CAUSE:                 'Show Cause',
  CLOSURE_DIRECTION:          'Closure',
  BANK_GUARANTEE_INVOCATION:  'Bank Guarantee',
  RECOVERY:                   'Recovery',
  SEALING:                    'Sealing',
}

function typeColor(t: string) {
  return t === 'CLOSURE_DIRECTION' || t === 'SEALING' ? 'badge-danger' : 'badge-warn'
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  item: EnforcementItem
  isSR: boolean
  onApprove: (id: string) => Promise<void>
  onReturn:  (id: string) => void
  acting: string | null
}

function EnforcementCard({ item, isSR, onApprove, onReturn, acting }: CardProps) {
  const isPending = item.state === 'PENDING_REVIEW'
  const busyThis  = acting === item.id

  return (
    <div className={`p-3 rounded-xl border border-bdr-light bg-white shadow-card animate-slide-in mb-2 transition-all ${busyThis ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`badge badge-${typeColor(item.type)} text-[10px]`}>{TYPE_LABELS[item.type] ?? item.type}</span>
          <div className="font-medium text-[12px] text-txt-primary mt-1 truncate" title={item.industry.name}>
            {item.industry.name}
          </div>
          <div className="text-[10px] text-txt-tertiary mt-0.5">{item.industry.ucNumber} · {item.industry.category}</div>
          <div className="text-[10px] text-txt-secondary mt-1">by {item.draftedBy.name}</div>
          <div className="text-[10px] text-txt-tertiary">{new Date(item.draftedAt).toLocaleDateString()}</div>
        </div>
        {item.state === 'COMMITTED' && <CheckCircle className="w-4 h-4 text-ok flex-shrink-0 mt-1" />}
        {item.state === 'WITHDRAWN' && <XCircle className="w-4 h-4 text-txt-tertiary flex-shrink-0 mt-1" />}
      </div>

      {item.reviewerNotes && (
        <div className="mt-2 text-[10px] text-flag bg-flag-light rounded-lg px-2 py-1 italic">
          "{item.reviewerNotes}"
        </div>
      )}

      {isPending && isSR && (
        <div className="flex gap-1.5 mt-2.5">
          <button
            onClick={() => { void onApprove(item.id) }}
            disabled={busyThis}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-ok text-white text-[11px] font-bold hover:bg-ok/90 disabled:opacity-50 transition-colors"
          >
            <CheckCircle className="w-3 h-3" /> Approve
          </button>
          <button
            onClick={() => onReturn(item.id)}
            disabled={busyThis}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-flag-light text-flag text-[11px] font-bold hover:bg-flag hover:text-white disabled:opacity-50 transition-colors"
          >
            <AlertCircle className="w-3 h-3" /> Return
          </button>
        </div>
      )}
    </div>
  )
}

// ── Return modal ──────────────────────────────────────────────────────────────

function ReturnModal({ onConfirm, onCancel }: { onConfirm: (notes: string) => void; onCancel: () => void }) {
  const [notes, setNotes] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-white rounded-card shadow-modal p-6 w-full max-w-sm animate-slide-in">
        <h3 className="font-bold text-[16px] text-txt-primary mb-3">Return for Revision</h3>
        <p className="text-[12px] text-txt-secondary mb-3">Provide notes for the Inspection & Enforcement Officer:</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          className="w-full border border-bdr rounded-xl p-3 text-[13px] outline-none focus:border-primary resize-none"
          placeholder="Reason for returning…"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-bdr text-[13px] text-txt-secondary hover:bg-surface-page">
            Cancel
          </button>
          <button
            onClick={() => { if (notes.trim()) onConfirm(notes.trim()) }}
            disabled={!notes.trim()}
            className="flex-1 py-2 rounded-xl bg-flag text-white text-[13px] font-bold hover:bg-flag/90 disabled:opacity-50"
          >
            Return
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function EnforcementPipelineCanvas() {
  const { token, user } = useAuth()
  const { showToast } = useApp()
  const [items, setItems] = useState<EnforcementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [returnTarget, setReturnTarget] = useState<string | null>(null)

  const isSR = user?.role === 'SENIOR_REVIEWER'

  const loadItems = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const d = await api<{ items: EnforcementItem[] }>('/api/enforcement', { token })
      setItems(d.items)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load enforcement actions.' })
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void loadItems() }, [loadItems])

  async function handleApprove(id: string) {
    if (!token) return
    setActing(id)
    try {
      await api(`/api/enforcement/${id}/approve`, { method: 'POST', token })
      showToast({ kind: 'success', text: 'Action approved and committed.' })
      await loadItems()
    } catch {
      showToast({ kind: 'danger', text: 'Failed to approve action.' })
    } finally {
      setActing(null)
    }
  }

  async function handleReturn(id: string, notes: string) {
    if (!token) return
    setActing(id)
    setReturnTarget(null)
    try {
      await api(`/api/enforcement/${id}/return-for-revision`, { method: 'POST', token, body: { notes } })
      showToast({ kind: 'success', text: 'Action returned for revision.' })
      await loadItems()
    } catch {
      showToast({ kind: 'danger', text: 'Failed to return action.' })
    } finally {
      setActing(null)
    }
  }

  // Group items by state
  const byState = COLUMNS.map(col => ({
    ...col,
    items: items.filter(i => i.state === col.state),
  }))

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Scale className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-[20px] font-bold text-txt-primary">Enforcement Pipeline</h2>
          <p className="text-[12px] text-txt-tertiary mt-0.5">All enforcement actions by stage. Pending Review → Approve or Return.</p>
        </div>
        <span className="ml-auto badge badge-info">{items.length} total</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-txt-secondary text-sm">Loading pipeline…</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {byState.map(col => {
            const Icon = col.icon
            return (
              <div key={col.state} className="flex-shrink-0 w-[220px]">
                {/* Column header */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${col.bg} mb-2`}>
                  <Icon className={`w-4 h-4 ${col.color}`} />
                  <span className={`font-bold text-[12px] ${col.color}`}>{col.label}</span>
                  <span className="ml-auto text-[11px] font-bold text-txt-tertiary">{col.items.length}</span>
                </div>

                {/* Cards */}
                <div className="min-h-[120px]">
                  {col.items.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-txt-tertiary text-[11px] border border-dashed border-bdr rounded-xl">
                      Empty
                    </div>
                  ) : (
                    col.items.map(item => (
                      <EnforcementCard
                        key={item.id}
                        item={item}
                        isSR={isSR}
                        onApprove={handleApprove}
                        onReturn={id => setReturnTarget(id)}
                        acting={acting}
                      />
                    ))
                  )}
                </div>

                {col.items.length > 0 && (
                  <div className="flex items-center gap-0.5 text-[10px] text-txt-tertiary px-1">
                    <ChevronRight className="w-3 h-3" /> {col.items.length} action{col.items.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Return modal */}
      {returnTarget && (
        <ReturnModal
          onConfirm={notes => { void handleReturn(returnTarget, notes) }}
          onCancel={() => setReturnTarget(null)}
        />
      )}
    </div>
  )
}
