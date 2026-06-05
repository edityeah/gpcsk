// ComplaintInboxCanvas — Complaints Officer
// Lists complaints from /api/complaints, supports filters, expandable row with thread, Assign & Reply actions.

import { useEffect, useState, useCallback } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Inbox,
  Filter,
  User,
  MessageSquare,
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
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
  channel: 'web' | 'phone' | 'email' | 'walk-in'
  receivedAt: string
  complainant?: { name?: string; phone?: string }
  location?: { district?: string; taluka?: string }
  category?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  description: string
  state: 'new' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'duplicate'
  assignedTo?: string
  responses?: ComplaintResponse[]
  industry?: { id: string; name: string } | null
}

interface ApiResponse {
  data: Complaint[]
  total: number
  page: number
  limit: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-danger-light text-danger font-bold',
  high: 'bg-orange-100 text-orange-700 font-semibold',
  medium: 'bg-warn-light text-yellow-800',
  low: 'bg-ok-light text-ok',
}

const STATE_BADGE: Record<string, string> = {
  new: 'bg-primary-light text-primary font-bold',
  assigned: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-warn-light text-yellow-800',
  resolved: 'bg-ok-light text-ok',
  closed: 'bg-surface-secondary text-txt-tertiary',
  duplicate: 'bg-flag-light text-flag',
}

const STATE_ICON: Record<string, React.ReactNode> = {
  new: <Clock className="w-3 h-3" />,
  assigned: <User className="w-3 h-3" />,
  in_progress: <RefreshCw className="w-3 h-3" />,
  resolved: <CheckCircle2 className="w-3 h-3" />,
  closed: <CheckCircle2 className="w-3 h-3" />,
  duplicate: <AlertTriangle className="w-3 h-3" />,
}

const CATEGORIES = ['All', 'Air Pollution', 'Water Pollution', 'Noise', 'Hazardous Waste', 'Odour', 'Other']
const STATES = ['All', 'new', 'assigned', 'in_progress', 'resolved', 'closed']

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Seed fallback (offline demo) ────────────────────────────────────────────

const DEMO_COMPLAINTS: Complaint[] = [
  {
    id: 'C-001', channel: 'web', receivedAt: new Date(Date.now() - 3600_000).toISOString(),
    complainant: { name: 'Ramesh Patel', phone: '9876543210' },
    location: { district: 'Ahmedabad', taluka: 'Vatva' },
    category: 'Air Pollution', severity: 'high', state: 'new',
    description: 'Thick black smoke from the stack of the chemical unit at GIDC Vatva Phase 2. It started around 8 AM and the smell is unbearable for nearby residents.',
    responses: [],
  },
  {
    id: 'C-002', channel: 'phone', receivedAt: new Date(Date.now() - 7_200_000).toISOString(),
    complainant: { name: 'Fatima Sheikh' },
    location: { district: 'Surat', taluka: 'Sachin' },
    category: 'Water Pollution', severity: 'critical', state: 'assigned', assignedTo: 'CO-001',
    description: 'Effluent from the dye unit is being discharged directly into the drain without any treatment. The water has turned bright red and fish are dying.',
    responses: [
      { id: 'R-1', respondedBy: 'CO-001', respondedAt: new Date(Date.now() - 5_000_000).toISOString(), message: 'Complaint received and assigned for inspection.', action: 'Assigned to monitoring team' },
    ],
    industry: { id: 'IND-054', name: 'Sachin Dye & Chem Pvt Ltd' },
  },
  {
    id: 'C-003', channel: 'email', receivedAt: new Date(Date.now() - 86_400_000).toISOString(),
    complainant: { name: 'Anand Mehta' },
    location: { district: 'Bharuch', taluka: 'Ankleshwar' },
    category: 'Hazardous Waste', severity: 'medium', state: 'in_progress',
    description: 'Drums of unidentified chemical waste are stored in the open compound without any containment or labelling. It rained last night and the liquid is seeping into the ground.',
    responses: [],
  },
  {
    id: 'C-004', channel: 'walk-in', receivedAt: new Date(Date.now() - 172_800_000).toISOString(),
    complainant: { name: 'Suresh Bhai' },
    location: { district: 'Valsad', taluka: 'Vapi' },
    category: 'Noise', severity: 'low', state: 'resolved',
    description: 'Continuous noise from compressors in the industrial estate even after 10 PM. The noise level is disrupting sleep for the entire colony.',
    responses: [
      { id: 'R-2', respondedBy: 'CO-002', respondedAt: new Date(Date.now() - 100_000_000).toISOString(), message: 'Inspection conducted. Unit issued a warning notice. Compressors to be operated only between 7 AM and 9 PM.', action: 'Warning issued' },
    ],
  },
  {
    id: 'C-005', channel: 'web', receivedAt: new Date(Date.now() - 259_200_000).toISOString(),
    complainant: { name: 'Geeta Desai' },
    location: { district: 'Rajkot', taluka: 'Rajkot' },
    category: 'Air Pollution', severity: 'high', state: 'new',
    description: 'Ceramic kilns in the industrial area are emitting excessive particulate matter. AQI in the locality has been very poor for the past week.',
    responses: [],
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThreadPanel({ complaint, token, onRefresh }: {
  complaint: Complaint
  token: string | null
  onRefresh: () => void
}) {
  const { showToast } = useApp()
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [assigning, setAssigning] = useState(false)

  async function handleAssign() {
    if (!token) return
    setAssigning(true)
    try {
      await api(`/api/complaints/${complaint.id}/assign`, { method: 'POST', token })
      showToast({ kind: 'success', text: 'Complaint assigned to you.' })
      onRefresh()
    } catch {
      showToast({ kind: 'warn', text: 'Assign failed — using demo mode.' })
      onRefresh()
    } finally {
      setAssigning(false)
    }
  }

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
      onRefresh()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 animate-bubble-in">
      {/* Description */}
      <div className="text-[13px] text-txt-primary leading-relaxed bg-surface-secondary rounded-xl p-3">
        {complaint.description}
      </div>

      {/* Thread */}
      {(complaint.responses ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-widest text-txt-tertiary">Thread</div>
          {(complaint.responses ?? []).map(r => (
            <div key={r.id} className="bg-primary-light rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-primary">{r.respondedBy}</span>
                <span className="text-[10px] text-txt-tertiary">{fmt(r.respondedAt)}</span>
              </div>
              <div className="text-[12px] text-txt-primary">{r.message}</div>
              {r.action && (
                <div className="mt-1 text-[10px] font-semibold text-flag bg-flag-light inline-block px-2 py-0.5 rounded-full">
                  {r.action}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {complaint.state === 'new' && (
          <button
            onClick={handleAssign}
            disabled={assigning}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            {assigning ? 'Assigning…' : 'Assign to me'}
          </button>
        )}
      </div>

      {/* Reply box */}
      <form onSubmit={handleReply} className="flex items-center gap-2 border border-bdr rounded-xl p-2">
        <input
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          placeholder="Type a reply or action note…"
          className="flex-1 text-[13px] bg-transparent outline-none placeholder:text-txt-tertiary"
        />
        <button
          type="submit"
          disabled={!replyText.trim() || sending}
          className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center disabled:bg-slate-300 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  )
}

// ─── Main canvas ─────────────────────────────────────────────────────────────

export function ComplaintInboxCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()

  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterState, setFilterState] = useState('All')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCategory !== 'All') params.set('category', filterCategory)
      if (filterState !== 'All') params.set('state', filterState)
      const res = await api<ApiResponse>(`/api/complaints?${params.toString()}`, {
        token: token ?? undefined,
      })
      setComplaints(res.data ?? [])
    } catch {
      showToast({ kind: 'warn', text: 'Using demo data — API not reachable.' })
      setComplaints(DEMO_COMPLAINTS)
    } finally {
      setLoading(false)
    }
  }, [token, filterCategory, filterState, showToast])

  useEffect(() => { void load() }, [load])

  const visible = complaints.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.id.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      (c.complainant?.name ?? '').toLowerCase().includes(q) ||
      (c.location?.district ?? '').toLowerCase().includes(q) ||
      (c.category ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
          <Inbox className="w-5 h-5 text-rose-600" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-txt-primary">Complaint Inbox</div>
          <div className="text-[11px] text-txt-secondary">
            {loading ? 'Loading…' : `${visible.length} complaint${visible.length !== 1 ? 's' : ''}`}
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

      {/* Filters */}
      <div className="px-5 py-3 bg-white border-b border-bdr-light flex flex-wrap gap-2 items-center">
        <Filter className="w-3.5 h-3.5 text-txt-tertiary flex-shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search complaints…"
          className="flex-1 min-w-[160px] text-[12px] bg-surface-secondary rounded-lg px-3 py-1.5 outline-none border border-bdr-light focus:border-primary placeholder:text-txt-tertiary"
        />
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="text-[12px] bg-surface-secondary rounded-lg px-2 py-1.5 border border-bdr-light outline-none focus:border-primary text-txt-primary"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
          className="text-[12px] bg-surface-secondary rounded-lg px-2 py-1.5 border border-bdr-light outline-none focus:border-primary text-txt-primary capitalize"
        >
          {STATES.map(s => <option key={s} value={s} className="capitalize">{s === 'All' ? 'All states' : s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-12 text-txt-tertiary text-[13px]">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading complaints…
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-txt-tertiary text-[13px] gap-2">
            <Inbox className="w-8 h-8 opacity-30" />
            No complaints match your filters.
          </div>
        )}
        {!loading && visible.map(c => {
          const isOpen = expanded === c.id
          return (
            <div
              key={c.id}
              className="bg-white rounded-card border border-bdr-light shadow-card overflow-hidden"
            >
              {/* Row header — click to expand */}
              <button
                onClick={() => setExpanded(isOpen ? null : c.id)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-page/60 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[11px] font-bold text-txt-tertiary">{c.id}</span>
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] ${SEVERITY_BADGE[c.severity ?? 'low'] ?? ''}`}>
                      {c.severity ?? 'low'}
                    </span>
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] ${STATE_BADGE[c.state] ?? ''}`}>
                      {STATE_ICON[c.state]}{c.state.replace(/_/g, ' ')}
                    </span>
                    {c.category && (
                      <span className="text-[10px] text-txt-secondary bg-surface-secondary px-2 py-0.5 rounded-full">
                        {c.category}
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-txt-primary font-medium line-clamp-2">
                    {c.description}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {c.complainant?.name && (
                      <span className="text-[11px] text-txt-secondary flex items-center gap-1">
                        <User className="w-3 h-3" /> {c.complainant.name}
                      </span>
                    )}
                    {c.location?.district && (
                      <span className="text-[11px] text-txt-secondary">{c.location.district}</span>
                    )}
                    <span className="text-[11px] text-txt-tertiary">{fmt(c.receivedAt)}</span>
                    {(c.responses ?? []).length > 0 && (
                      <span className="text-[11px] text-primary flex items-center gap-0.5">
                        <MessageSquare className="w-3 h-3" /> {c.responses!.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 mt-1">
                  {isOpen ? <ChevronUp className="w-4 h-4 text-txt-tertiary" /> : <ChevronDown className="w-4 h-4 text-txt-tertiary" />}
                </div>
              </button>

              {/* Expanded thread */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-bdr-light">
                  <ThreadPanel
                    complaint={c}
                    token={token}
                    onRefresh={() => { void load() }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
