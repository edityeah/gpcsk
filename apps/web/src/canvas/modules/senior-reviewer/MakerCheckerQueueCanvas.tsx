/**
 * MakerCheckerQueueCanvas — Senior Reviewer mega-dashboard #5
 *
 * Combined queue: EnforcementActions in PENDING_REVIEW + ConsentApplications in RECOMMENDED.
 * Senior Reviewer can Approve / Return / Reject inline.
 * Live counts ticker at the top.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle,
  Clock,
  FileText,
  Scale,
  XCircle,
  AlertCircle,
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
  industry: { id: string; name: string; ucNumber: string; category: string }
  draftedBy: { id: string; name: string; designation: string | null }
}

interface ConsentItem {
  id: string
  type: string
  state: string
  submittedAt: string
  industry: { id: string; name: string; ucNumber: string; category: string }
  maker: { id: string; name: string; designation: string | null }
}

type QueueItem =
  | { kind: 'enforcement'; data: EnforcementItem }
  | { kind: 'consent';     data: ConsentItem }

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENF_TYPE_LABELS: Record<string, string> = {
  SHOW_CAUSE: 'Show Cause', CLOSURE_DIRECTION: 'Closure',
  BANK_GUARANTEE_INVOCATION: 'Bank Guarantee', RECOVERY: 'Recovery', SEALING: 'Sealing',
}
const CONSENT_TYPE_LABELS: Record<string, string> = {
  CTE: 'CTE', CTO: 'CTO', HW_AUTH: 'HW Auth',
}

function sinceLabel(dateStr: string): string {
  const h = Math.round((Date.now() - new Date(dateStr).getTime()) / 3_600_000)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Return/Reject modal ───────────────────────────────────────────────────────

function NoteModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string
  onConfirm: (notes: string) => void
  onCancel: () => void
}) {
  const [notes, setNotes] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-white rounded-card shadow-modal p-6 w-full max-w-sm animate-slide-in">
        <h3 className="font-bold text-[15px] text-txt-primary mb-3">{title}</h3>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          placeholder="Notes (required)…"
          className="w-full border border-bdr rounded-xl p-3 text-[13px] outline-none focus:border-primary resize-none"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-bdr text-[13px] text-txt-secondary hover:bg-surface-page">
            Cancel
          </button>
          <button
            onClick={() => { if (notes.trim()) onConfirm(notes.trim()) }}
            disabled={!notes.trim()}
            className="flex-1 py-2 rounded-xl bg-danger text-white text-[13px] font-bold hover:bg-danger/90 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Queue Card ────────────────────────────────────────────────────────────────

interface QueueCardProps {
  item: QueueItem
  acting: string | null
  onApprove: (item: QueueItem) => void
  onReturn:  (item: QueueItem) => void
  onReject:  (item: QueueItem) => void
}

function QueueCard({ item, acting, onApprove, onReturn, onReject }: QueueCardProps) {
  const id = item.kind === 'enforcement' ? item.data.id : item.data.id
  const busy = acting === id

  const typeLabel = item.kind === 'enforcement'
    ? (ENF_TYPE_LABELS[item.data.type] ?? item.data.type)
    : (CONSENT_TYPE_LABELS[item.data.type] ?? item.data.type)

  const industryName = item.kind === 'enforcement' ? item.data.industry.name : item.data.industry.name
  const ucNumber     = item.kind === 'enforcement' ? item.data.industry.ucNumber : item.data.industry.ucNumber
  const makerName    = item.kind === 'enforcement' ? item.data.draftedBy.name : item.data.maker.name
  const dateStr      = item.kind === 'enforcement' ? item.data.draftedAt : item.data.submittedAt

  return (
    <div className={`bg-white rounded-card shadow-card p-4 border border-bdr-light animate-slide-in transition-all ${busy ? 'opacity-60' : ''}`}>
      {/* Kind badge + type */}
      <div className="flex items-center gap-2 mb-2">
        {item.kind === 'enforcement'
          ? <Scale className="w-3.5 h-3.5 text-warn" />
          : <FileText className="w-3.5 h-3.5 text-primary" />
        }
        <span className={`badge text-[10px] ${item.kind === 'enforcement' ? 'badge-warn' : 'badge-info'}`}>
          {item.kind === 'enforcement' ? 'Enforcement' : 'Consent'}
        </span>
        <span className="text-[11px] font-bold text-txt-primary ml-0.5">{typeLabel}</span>
        <span className="ml-auto text-[10px] text-txt-tertiary flex items-center gap-0.5">
          <Clock className="w-3 h-3" />{sinceLabel(dateStr)}
        </span>
      </div>

      {/* Industry */}
      <div className="font-medium text-[13px] text-txt-primary truncate" title={industryName}>{industryName}</div>
      <div className="text-[11px] text-txt-tertiary">{ucNumber}</div>
      <div className="text-[11px] text-txt-secondary mt-1">Submitted by {makerName}</div>

      {/* Actions */}
      <div className="flex gap-1.5 mt-3">
        <button
          onClick={() => onApprove(item)}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-ok text-white text-[11px] font-bold hover:bg-ok/90 disabled:opacity-50 transition-colors"
        >
          <CheckCircle className="w-3.5 h-3.5" /> Approve
        </button>
        {item.kind === 'enforcement' && (
          <button
            onClick={() => onReturn(item)}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-flag-light text-flag text-[11px] font-bold hover:bg-flag hover:text-white disabled:opacity-50 transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5" /> Return
          </button>
        )}
        {item.kind === 'consent' && (
          <button
            onClick={() => onReject(item)}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-danger-light text-danger text-[11px] font-bold hover:bg-danger hover:text-white disabled:opacity-50 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function MakerCheckerQueueCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()

  const [enfItems, setEnfItems] = useState<EnforcementItem[]>([])
  const [consentItems, setConsentItems] = useState<ConsentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  // Modal state: { kind: 'return'|'reject', item }
  const [modal, setModal] = useState<{ action: 'return' | 'reject'; item: QueueItem } | null>(null)

  const loadQueue = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [enfRes, consentRes] = await Promise.all([
        api<{ items: EnforcementItem[] }>('/api/enforcement?state=PENDING_REVIEW&limit=100', { token }),
        api<{ items: ConsentItem[] }>('/api/consents?state=RECOMMENDED&limit=100', { token }),
      ])
      setEnfItems(enfRes.items)
      setConsentItems(consentRes.items)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load maker-checker queue.' })
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void loadQueue() }, [loadQueue])

  const queue: QueueItem[] = [
    ...enfItems.map(d => ({ kind: 'enforcement' as const, data: d })),
    ...consentItems.map(d => ({ kind: 'consent' as const, data: d })),
  ].sort((a, b) => {
    const da = a.kind === 'enforcement' ? a.data.draftedAt : a.data.submittedAt
    const db = b.kind === 'enforcement' ? b.data.draftedAt : b.data.submittedAt
    return new Date(da).getTime() - new Date(db).getTime()
  })

  async function handleApprove(item: QueueItem) {
    if (!token) return
    const id = item.data.id
    setActing(id)
    try {
      if (item.kind === 'enforcement') {
        await api(`/api/enforcement/${id}/approve`, { method: 'POST', token })
      } else {
        await api(`/api/consents/${id}/approve`, { method: 'POST', token })
      }
      showToast({ kind: 'success', text: 'Approved successfully.' })
      await loadQueue()
    } catch {
      showToast({ kind: 'danger', text: 'Approval failed.' })
    } finally {
      setActing(null)
    }
  }

  async function handleNoteAction(notes: string) {
    if (!modal || !token) return
    const { action, item } = modal
    const id = item.data.id
    setActing(id)
    setModal(null)
    try {
      if (item.kind === 'enforcement' && action === 'return') {
        await api(`/api/enforcement/${id}/return-for-revision`, { method: 'POST', token, body: { notes } })
      } else if (item.kind === 'consent' && action === 'reject') {
        await api(`/api/consents/${id}/reject`, { method: 'POST', token, body: { reason: notes } })
      }
      showToast({ kind: 'success', text: action === 'return' ? 'Returned for revision.' : 'Rejected.' })
      await loadQueue()
    } catch {
      showToast({ kind: 'danger', text: `Action failed.` })
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="p-6 animate-fade-in">
      {/* Header + ticker */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-[20px] font-bold text-txt-primary">Maker-Checker Queue</h2>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="badge badge-warn text-[11px]">{enfItems.length} Enforcement</span>
          <span className="badge badge-info text-[11px]">{consentItems.length} Consent</span>
          <span className="badge badge-danger text-[11px]">{queue.length} Total Pending</span>
        </div>
      </div>
      <p className="text-[12px] text-txt-tertiary mb-5">
        Pending enforcement actions and recommended consent decisions awaiting Senior Reviewer action.
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-txt-secondary text-sm">Loading queue…</div>
      ) : queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-txt-tertiary">
          <CheckCircle className="w-10 h-10 text-ok" />
          <div className="text-[14px] font-medium">Queue is clear! No pending items.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {queue.map(item => (
            <QueueCard
              key={`${item.kind}-${item.data.id}`}
              item={item}
              acting={acting}
              onApprove={i => { void handleApprove(i) }}
              onReturn={i => setModal({ action: 'return', item: i })}
              onReject={i => setModal({ action: 'reject', item: i })}
            />
          ))}
        </div>
      )}

      {/* Note modal */}
      {modal && (
        <NoteModal
          title={modal.action === 'return' ? 'Return for Revision' : 'Reject Application'}
          onConfirm={notes => { void handleNoteAction(notes) }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}
