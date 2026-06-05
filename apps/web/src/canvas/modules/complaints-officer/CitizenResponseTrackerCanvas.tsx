// CitizenResponseTrackerCanvas — Complaints Officer
// Kanban-style columns by complaint state.
// Real API returns plain array with UPPERCASE states: NEW, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED.

import { useEffect, useState, useCallback } from 'react'
import {
  Layers,
  RefreshCw,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

// ─── Real API complaint shape ──────────────────────────────────────────────────

interface ApiComplaint {
  id: string
  channel: string
  receivedAt: string
  complainant?: { name?: string; email?: string; phone?: string; anonymous?: boolean }
  lat: number | null
  lng: number | null
  category: string    // e.g. 'AIR_POLLUTION'
  severity: string    // 'MINOR' | 'MAJOR' | 'CRITICAL'
  description: string
  state: string       // 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  assignedToId: string | null
  industryId: string | null
}

// ─── Kanban column config ─────────────────────────────────────────────────────

interface KanbanColumn {
  state: string
  label: string
  icon: React.ReactNode
  headerCls: string
  borderCls: string
}

const COLUMNS: KanbanColumn[] = [
  { state: 'NEW',         label: 'New',         icon: <Clock className="w-3.5 h-3.5" />,        headerCls: 'bg-primary-light text-primary',      borderCls: 'border-primary/30' },
  { state: 'ASSIGNED',    label: 'Assigned',     icon: <User className="w-3.5 h-3.5" />,          headerCls: 'bg-indigo-100 text-indigo-700',       borderCls: 'border-indigo-300' },
  { state: 'IN_PROGRESS', label: 'In Progress',  icon: <RefreshCw className="w-3.5 h-3.5" />,    headerCls: 'bg-warn-light text-yellow-800',       borderCls: 'border-warn' },
  { state: 'RESOLVED',    label: 'Resolved',     icon: <CheckCircle2 className="w-3.5 h-3.5" />, headerCls: 'bg-ok-light text-ok',                borderCls: 'border-ok/40' },
  { state: 'CLOSED',      label: 'Closed',       icon: <CheckCircle2 className="w-3.5 h-3.5" />, headerCls: 'bg-surface-secondary text-txt-tertiary', borderCls: 'border-bdr' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-danger-light text-danger font-bold',
  MAJOR:    'bg-orange-100 text-orange-700 font-semibold',
  MINOR:    'bg-warn-light text-yellow-800',
}

const CAT_LABEL: Record<string, string> = {
  AIR_POLLUTION:    'Air Pollution',
  WATER_POLLUTION:  'Water Pollution',
  NOISE:            'Noise',
  HAZARDOUS_WASTE:  'Hazardous Waste',
  ODOUR:            'Odour',
  BURNING:          'Burning',
  ILLEGAL_DISCHARGE:'Illegal Discharge',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── Card component ───────────────────────────────────────────────────────────

function ComplaintCard({ complaint, token, onRefresh }: {
  complaint: ApiComplaint
  token: string | null
  onRefresh: () => void
}) {
  const { showToast } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim()) return
    setSending(true)
    try {
      await api(`/api/complaints/${complaint.id}/respond`, {
        method: 'POST',
        token: token ?? undefined,
        body: { message: replyText },
      })
      showToast({ kind: 'success', text: 'Reply sent.' })
      setReplyText('')
      onRefresh()
    } catch {
      showToast({ kind: 'danger', text: 'Failed to send reply.' })
    } finally {
      setSending(false)
    }
  }

  const catLabel = CAT_LABEL[complaint.category] ?? complaint.category.replace(/_/g, ' ')

  return (
    <div className="bg-white rounded-xl border border-bdr-light shadow-card overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-3 py-2.5 hover:bg-surface-page/60 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[10px] font-bold text-txt-tertiary truncate max-w-[120px]">{complaint.id.slice(-8)}</span>
          {complaint.severity && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${SEVERITY_BADGE[complaint.severity] ?? ''}`}>
              {complaint.severity}
            </span>
          )}
          {catLabel && (
            <span className="text-[9px] text-primary ml-auto flex items-center gap-0.5">
              <MessageSquare className="w-2.5 h-2.5" /> {catLabel.slice(0, 12)}
            </span>
          )}
        </div>
        <div className="text-[12px] text-txt-primary line-clamp-2 leading-snug">{complaint.description}</div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {complaint.complainant?.name && !complaint.complainant.anonymous && (
            <span className="text-[10px] text-txt-tertiary flex items-center gap-0.5">
              <User className="w-2.5 h-2.5" /> {complaint.complainant.name}
            </span>
          )}
          <span className="text-[10px] text-txt-tertiary ml-auto">{fmt(complaint.receivedAt)}</span>
        </div>
        <div className="flex justify-end mt-1">
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-txt-tertiary" /> : <ChevronDown className="w-3.5 h-3.5 text-txt-tertiary" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-bdr-light space-y-2 animate-bubble-in">
          <div className="text-[11px] text-txt-primary leading-relaxed bg-surface-secondary rounded-lg p-2 mt-2">
            {complaint.description}
          </div>
          {complaint.channel && (
            <div className="text-[10px] text-txt-tertiary">Channel: {complaint.channel}</div>
          )}
          <form onSubmit={handleReply} className="flex items-center gap-1.5 border border-bdr rounded-lg p-1.5">
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Reply or note…"
              className="flex-1 text-[11px] bg-transparent outline-none placeholder:text-txt-tertiary"
            />
            <button
              type="submit"
              disabled={!replyText.trim() || sending}
              className="w-6 h-6 rounded-md bg-primary text-white flex items-center justify-center disabled:bg-slate-300 flex-shrink-0"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ─── Main canvas ─────────────────────────────────────────────────────────────

export function CitizenResponseTrackerCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [complaints, setComplaints] = useState<ApiComplaint[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api<ApiComplaint[] | { complaints?: ApiComplaint[]; data?: ApiComplaint[] }>(
        '/api/complaints?limit=100',
        { token },
      )
      const list: ApiComplaint[] = Array.isArray(res)
        ? (res as ApiComplaint[])
        : ((res as { complaints?: ApiComplaint[]; data?: ApiComplaint[] }).complaints
          ?? (res as { data?: ApiComplaint[] }).data
          ?? [])
      setComplaints(list)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load complaints.' })
      setComplaints([])
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void load() }, [load])

  const byState = (state: string) => complaints.filter(c => c.state === state)

  const criticalNewCount = complaints.filter(c => c.severity === 'CRITICAL' && c.state === 'NEW').length

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-ok-light flex items-center justify-center">
          <Layers className="w-5 h-5 text-ok" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-txt-primary">Citizen Response Tracker</div>
          <div className="text-[11px] text-txt-secondary">
            {loading ? 'Loading…' : `${complaints.length} total · ${byState('NEW').length} new · ${byState('RESOLVED').length} resolved`}
          </div>
        </div>
        <button
          onClick={() => { void load() }}
          className="w-8 h-8 rounded-lg hover:bg-surface-secondary flex items-center justify-center text-txt-secondary"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex items-center justify-center flex-1 text-txt-tertiary text-[13px]">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading…
        </div>
      ) : complaints.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-txt-tertiary text-[14px]">
          No complaints found.
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex h-full gap-3 px-5 py-4 min-w-max">
            {COLUMNS.map(col => {
              const cards = byState(col.state)
              return (
                <div
                  key={col.state}
                  className={`flex flex-col w-[240px] flex-shrink-0 rounded-card border ${col.borderCls} bg-white shadow-card overflow-hidden`}
                >
                  {/* Column header */}
                  <div className={`flex items-center gap-2 px-3 py-2.5 ${col.headerCls} rounded-t-card`}>
                    {col.icon}
                    <span className="text-[12px] font-bold">{col.label}</span>
                    <span className="ml-auto text-[11px] font-bold opacity-70">
                      {cards.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {cards.length === 0 && (
                      <div className="text-[11px] text-txt-tertiary text-center py-6 opacity-60">
                        No complaints
                      </div>
                    )}
                    {cards.map(c => (
                      <ComplaintCard
                        key={c.id}
                        complaint={c}
                        token={token}
                        onRefresh={() => { void load() }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Critical alert bar */}
      {!loading && criticalNewCount > 0 && (
        <div className="flex-shrink-0 bg-danger-light border-t border-danger/20 px-5 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
          <span className="text-[12px] font-bold text-danger">
            {criticalNewCount} critical complaint{criticalNewCount !== 1 ? 's' : ''} awaiting assignment
          </span>
        </div>
      )}
    </div>
  )
}
