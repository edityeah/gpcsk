// CitizenResponseTrackerCanvas — Complaints Officer
// Kanban-style columns by complaint state. Cards are expandable (same as inbox thread).

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComplaintResponse {
  id: string
  respondedBy: string
  respondedAt: string
  message: string
  action?: string
}

interface Complaint {
  id: string
  channel: string
  receivedAt: string
  complainant?: { name?: string }
  location?: { district?: string }
  category?: string
  severity?: string
  description: string
  state: 'new' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'duplicate'
  assignedTo?: string
  responses?: ComplaintResponse[]
}

// ─── Kanban column config ─────────────────────────────────────────────────────

interface KanbanColumn {
  state: Complaint['state']
  label: string
  icon: React.ReactNode
  headerCls: string
  borderCls: string
}

const COLUMNS: KanbanColumn[] = [
  { state: 'new',         label: 'New',         icon: <Clock className="w-3.5 h-3.5" />,        headerCls: 'bg-primary-light text-primary',      borderCls: 'border-primary/30' },
  { state: 'assigned',    label: 'Assigned',     icon: <User className="w-3.5 h-3.5" />,          headerCls: 'bg-indigo-100 text-indigo-700',       borderCls: 'border-indigo-300' },
  { state: 'in_progress', label: 'In Progress',  icon: <RefreshCw className="w-3.5 h-3.5" />,    headerCls: 'bg-warn-light text-yellow-800',       borderCls: 'border-warn' },
  { state: 'resolved',    label: 'Resolved',     icon: <CheckCircle2 className="w-3.5 h-3.5" />, headerCls: 'bg-ok-light text-ok',                borderCls: 'border-ok/40' },
  { state: 'closed',      label: 'Closed',       icon: <CheckCircle2 className="w-3.5 h-3.5" />, headerCls: 'bg-surface-secondary text-txt-tertiary', borderCls: 'border-bdr' },
]

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_COMPLAINTS: Complaint[] = [
  { id: 'C-001', channel: 'web',   receivedAt: new Date(Date.now() - 3600_000).toISOString(),   category: 'Air Pollution',   severity: 'high',     state: 'new',         complainant: { name: 'Ramesh Patel' },  location: { district: 'Ahmedabad' }, description: 'Thick black smoke from GIDC Vatva chemical unit stack near residential area.' },
  { id: 'C-005', channel: 'web',   receivedAt: new Date(Date.now() - 259_200_000).toISOString(), category: 'Air Pollution',  severity: 'high',     state: 'new',         complainant: { name: 'Geeta Desai' },   location: { district: 'Rajkot' },   description: 'Ceramic kilns emitting excessive particulate matter. AQI very poor for a week.' },
  { id: 'C-002', channel: 'phone', receivedAt: new Date(Date.now() - 7_200_000).toISOString(),  category: 'Water Pollution', severity: 'critical', state: 'assigned',    complainant: { name: 'Fatima Sheikh' }, location: { district: 'Surat' },    description: 'Dye effluent discharged directly into drain without treatment. Fish dying.', responses: [{ id: 'R-1', respondedBy: 'CO-001', respondedAt: new Date(Date.now() - 5_000_000).toISOString(), message: 'Complaint assigned to monitoring team.', action: 'Assigned' }] },
  { id: 'C-006', channel: 'email', receivedAt: new Date(Date.now() - 18_000_000).toISOString(), category: 'Hazardous Waste', severity: 'medium',  state: 'assigned',    complainant: { name: 'Sanjay Modi' },  location: { district: 'Bharuch' },  description: 'Drums of waste stored in open compound without containment labels.' },
  { id: 'C-003', channel: 'email', receivedAt: new Date(Date.now() - 86_400_000).toISOString(), category: 'Hazardous Waste', severity: 'medium',  state: 'in_progress', complainant: { name: 'Anand Mehta' },  location: { district: 'Bharuch' },  description: 'Chemical waste seeping into ground after heavy rains.', responses: [{ id: 'R-2', respondedBy: 'CO-002', respondedAt: new Date(Date.now() - 50_000_000).toISOString(), message: 'Site visit scheduled for tomorrow.' }] },
  { id: 'C-007', channel: 'web',   receivedAt: new Date(Date.now() - 100_000_000).toISOString(), category: 'Noise',         severity: 'low',      state: 'in_progress', complainant: { name: 'Priya Joshi' },  location: { district: 'Vadodara' }, description: 'Factory machines running 24/7 causing noise disturbance in residential colony.' },
  { id: 'C-004', channel: 'walk-in', receivedAt: new Date(Date.now() - 172_800_000).toISOString(), category: 'Noise',      severity: 'low',      state: 'resolved',    complainant: { name: 'Suresh Bhai' },  location: { district: 'Valsad' },   description: 'Compressor noise after 10 PM. Resolved with warning notice.', responses: [{ id: 'R-3', respondedBy: 'CO-002', respondedAt: new Date(Date.now() - 100_000_000).toISOString(), message: 'Warning notice issued. Operations restricted 7 AM–9 PM.', action: 'Warning issued' }] },
  { id: 'C-008', channel: 'phone', receivedAt: new Date(Date.now() - 345_600_000).toISOString(), category: 'Air Pollution', severity: 'medium',  state: 'closed',      complainant: { name: 'Vinod Rathod' }, location: { district: 'Morbi' },    description: 'Dust from ceramic plant affecting nearby school premises.', responses: [{ id: 'R-4', respondedBy: 'CO-001', respondedAt: new Date(Date.now() - 300_000_000).toISOString(), message: 'Unit installed dust suppression system. Case closed.', action: 'Closed' }] },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-danger-light text-danger font-bold',
  high: 'bg-orange-100 text-orange-700 font-semibold',
  medium: 'bg-warn-light text-yellow-800',
  low: 'bg-ok-light text-ok',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── Card component ───────────────────────────────────────────────────────────

function ComplaintCard({ complaint, token, onRefresh }: {
  complaint: Complaint
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
      showToast({ kind: 'warn', text: 'Reply logged in demo mode.' })
      setReplyText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-bdr-light shadow-card overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-3 py-2.5 hover:bg-surface-page/60 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[10px] font-bold text-txt-tertiary">{complaint.id}</span>
          {complaint.severity && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${SEVERITY_BADGE[complaint.severity] ?? ''}`}>
              {complaint.severity}
            </span>
          )}
          {(complaint.responses ?? []).length > 0 && (
            <span className="text-[9px] text-primary flex items-center gap-0.5 ml-auto">
              <MessageSquare className="w-2.5 h-2.5" /> {complaint.responses!.length}
            </span>
          )}
        </div>
        <div className="text-[12px] text-txt-primary line-clamp-2 leading-snug">{complaint.description}</div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {complaint.complainant?.name && (
            <span className="text-[10px] text-txt-tertiary flex items-center gap-0.5">
              <User className="w-2.5 h-2.5" /> {complaint.complainant.name}
            </span>
          )}
          {complaint.location?.district && (
            <span className="text-[10px] text-txt-tertiary">{complaint.location.district}</span>
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

          {(complaint.responses ?? []).length > 0 && (
            <div className="space-y-1.5">
              {(complaint.responses ?? []).map(r => (
                <div key={r.id} className="bg-primary-light rounded-lg p-2">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-[10px] font-bold text-primary">{r.respondedBy}</span>
                    <span className="text-[9px] text-txt-tertiary">{fmt(r.respondedAt)}</span>
                  </div>
                  <div className="text-[11px] text-txt-primary">{r.message}</div>
                  {r.action && (
                    <div className="mt-0.5 text-[9px] font-semibold text-flag bg-flag-light inline-block px-1.5 py-0.5 rounded-full">
                      {r.action}
                    </div>
                  )}
                </div>
              ))}
            </div>
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
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ data: Complaint[] }>('/api/complaints?limit=100', {
        token: token ?? undefined,
      })
      setComplaints(res.data ?? [])
    } catch {
      showToast({ kind: 'warn', text: 'Using demo data — API not reachable.' })
      setComplaints(DEMO_COMPLAINTS)
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void load() }, [load])

  const byState = (state: Complaint['state']) => complaints.filter(c => c.state === state)

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
            {loading ? 'Loading…' : `${complaints.length} total · ${byState('new').length} new · ${byState('resolved').length} resolved`}
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
      {!loading && complaints.filter(c => c.severity === 'critical' && c.state === 'new').length > 0 && (
        <div className="flex-shrink-0 bg-danger-light border-t border-danger/20 px-5 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
          <span className="text-[12px] font-bold text-danger">
            {complaints.filter(c => c.severity === 'critical' && c.state === 'new').length} critical complaint{complaints.filter(c => c.severity === 'critical' && c.state === 'new').length !== 1 ? 's' : ''} awaiting assignment
          </span>
        </div>
      )}
    </div>
  )
}
