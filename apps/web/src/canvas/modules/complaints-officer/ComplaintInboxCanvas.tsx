/**
 * ComplaintInboxCanvas — Complaints Officer
 *
 * Lists complaints from /api/complaints (returns Complaint[] directly, not wrapped),
 * supports filters, expandable row with thread, Assign + Reply actions.
 *
 * API enums are UPPERCASE; we render them via human-readable label maps.
 */

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
  MapPin,
  Phone,
  Mail,
  Globe,
  Footprints,
} from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

// ─── API shape (uppercase enums, matching apps/api/src/complaints/router.ts) ─

type ComplaintState = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'DUPLICATE'
type Severity = 'MINOR' | 'MAJOR' | 'CRITICAL'
type Channel = 'WEB' | 'PHONE' | 'EMAIL' | 'WALK_IN'

interface ComplaintResponse {
  id: string
  respondedById: string
  respondedAt: string
  message: string
  action?: string | null
  respondedBy?: { id: string; name: string } | null
}

interface Complaint {
  id: string
  channel: Channel
  receivedAt: string
  complainant?: { name?: string; phone?: string; email?: string; anonymous?: boolean } | null
  lat?: number | null
  lng?: number | null
  category?: string | null
  severity: Severity
  description: string
  attachments?: unknown[]
  industryId?: string | null
  state: ComplaintState
  assignedToId?: string | null
  industry?: { id: string; name: string } | null
  assignedTo?: { id: string; name: string } | null
  responses?: ComplaintResponse[]
  createdAt: string
  updatedAt: string
}

// ─── Display label maps ──────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: 'Critical',
  MAJOR: 'Major',
  MINOR: 'Minor',
}

const SEVERITY_BADGE: Record<Severity, string> = {
  CRITICAL: 'bg-danger-light text-danger font-bold',
  MAJOR: 'bg-orange-100 text-orange-700 font-semibold',
  MINOR: 'bg-ok-light text-ok',
}

const STATE_LABEL: Record<ComplaintState, string> = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  DUPLICATE: 'Duplicate',
}

const STATE_BADGE: Record<ComplaintState, string> = {
  NEW: 'bg-primary-light text-primary font-bold',
  ASSIGNED: 'bg-indigo-100 text-indigo-700',
  IN_PROGRESS: 'bg-warn-light text-yellow-800',
  RESOLVED: 'bg-ok-light text-ok',
  CLOSED: 'bg-surface-secondary text-txt-tertiary',
  DUPLICATE: 'bg-flag-light text-flag',
}

const STATE_ICON: Record<ComplaintState, React.ReactNode> = {
  NEW: <Clock className="w-3 h-3" />,
  ASSIGNED: <User className="w-3 h-3" />,
  IN_PROGRESS: <RefreshCw className="w-3 h-3" />,
  RESOLVED: <CheckCircle2 className="w-3 h-3" />,
  CLOSED: <CheckCircle2 className="w-3 h-3" />,
  DUPLICATE: <AlertTriangle className="w-3 h-3" />,
}

const CHANNEL_ICON: Record<Channel, React.ReactNode> = {
  WEB: <Globe className="w-3 h-3" />,
  PHONE: <Phone className="w-3 h-3" />,
  EMAIL: <Mail className="w-3 h-3" />,
  WALK_IN: <Footprints className="w-3 h-3" />,
}

const CHANNEL_LABEL: Record<Channel, string> = {
  WEB: 'Web',
  PHONE: 'Phone',
  EMAIL: 'Email',
  WALK_IN: 'Walk-in',
}

// Canonical seed categories; left as plain strings since the API has no closed enum.
const CATEGORY_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'ALL',                label: 'All categories' },
  { value: 'ODOUR',              label: 'Odour' },
  { value: 'EFFLUENT_DISCHARGE', label: 'Effluent discharge' },
  { value: 'DUST',               label: 'Dust' },
  { value: 'NOISE',              label: 'Noise' },
  { value: 'BURNING',            label: 'Burning' },
  { value: 'HAZARDOUS_WASTE',    label: 'Hazardous waste' },
  { value: 'AIR_POLLUTION',      label: 'Air pollution' },
  { value: 'WATER_POLLUTION',    label: 'Water pollution' },
  { value: 'OTHER',              label: 'Other' },
]

const STATE_FILTERS: Array<{ value: 'ALL' | ComplaintState; label: string }> = [
  { value: 'ALL',         label: 'All states' },
  { value: 'NEW',         label: 'New' },
  { value: 'ASSIGNED',    label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED',    label: 'Resolved' },
  { value: 'CLOSED',      label: 'Closed' },
  { value: 'DUPLICATE',   label: 'Duplicate' },
]

function categoryLabel(raw?: string | null): string {
  if (!raw) return 'Uncategorised'
  const known = CATEGORY_FILTERS.find(c => c.value === raw)
  if (known) return known.label
  return raw.replace(/_/g, ' ').toLowerCase().replace(/^\w/, ch => ch.toUpperCase())
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtLatLng(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`
}

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
    } catch (e) {
      showToast({ kind: 'danger', text: `Assign failed: ${(e as { code?: string }).code ?? 'unknown'}` })
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
    } catch (e) {
      showToast({ kind: 'danger', text: `Reply failed: ${(e as { code?: string }).code ?? 'unknown'}` })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 animate-bubble-in">
      <div className="text-[13px] text-txt-primary leading-relaxed bg-surface-secondary rounded-xl p-3">
        {complaint.description}
      </div>

      {(complaint.responses ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-widest text-txt-tertiary">Thread</div>
          {(complaint.responses ?? []).map(r => (
            <div key={r.id} className="bg-primary-light rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-primary">{r.respondedBy?.name ?? r.respondedById}</span>
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

      <div className="flex items-center gap-2 pt-1">
        {complaint.state === 'NEW' && (
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
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [filterState, setFilterState] = useState<'ALL' | ComplaintState>('ALL')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCategory !== 'ALL') params.set('category', filterCategory)
      if (filterState !== 'ALL') params.set('state', filterState)
      // API returns Complaint[] directly. Also tolerate { data: [...] } in case
      // it changes; some seeds also nest under .complaints or .items.
      const res = await api<unknown>(`/api/complaints?${params.toString()}`, {
        token: token ?? undefined,
      })
      const arr: Complaint[] =
        Array.isArray(res) ? res as Complaint[] :
        Array.isArray((res as { data?: unknown }).data) ? (res as { data: Complaint[] }).data :
        Array.isArray((res as { complaints?: unknown }).complaints) ? (res as { complaints: Complaint[] }).complaints :
        Array.isArray((res as { items?: unknown }).items) ? (res as { items: Complaint[] }).items :
        []
      setComplaints(arr)
      setError(null)
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not load complaints.')
      setComplaints([])
      showToast({ kind: 'danger', text: 'Failed to load complaints from the server.' })
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
      (c.industry?.name ?? '').toLowerCase().includes(q) ||
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
            {loading ? 'Loading…' : `${visible.length} of ${complaints.length} complaint${complaints.length !== 1 ? 's' : ''}`}
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
          {CATEGORY_FILTERS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value as 'ALL' | ComplaintState)}
          className="text-[12px] bg-surface-secondary rounded-lg px-2 py-1.5 border border-bdr-light outline-none focus:border-primary text-txt-primary"
        >
          {STATE_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {error && (
        <div className="mx-5 mt-3 px-4 py-2.5 bg-danger-light border border-danger/30 rounded-card text-danger text-[12px]">
          {error}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {loading && complaints.length === 0 && (
          <div className="flex items-center justify-center py-12 text-txt-tertiary text-[13px]">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading complaints…
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-txt-tertiary text-[13px] gap-2">
            <Inbox className="w-8 h-8 opacity-30" />
            {complaints.length === 0 ? 'No complaints in the inbox yet.' : 'No complaints match your filters.'}
          </div>
        )}
        {!loading && visible.map(c => {
          const isOpen = expanded === c.id
          const coords = fmtLatLng(c.lat, c.lng)
          return (
            <div
              key={c.id}
              className="bg-white rounded-card border border-bdr-light shadow-card overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isOpen ? null : c.id)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-page/60 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[11px] font-bold text-txt-tertiary">{c.id.slice(-8)}</span>
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] ${SEVERITY_BADGE[c.severity]}`}>
                      {SEVERITY_LABEL[c.severity]}
                    </span>
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] ${STATE_BADGE[c.state]}`}>
                      {STATE_ICON[c.state]}{STATE_LABEL[c.state]}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-txt-secondary bg-surface-secondary px-2 py-0.5 rounded-full">
                      {CHANNEL_ICON[c.channel]}{CHANNEL_LABEL[c.channel]}
                    </span>
                    {c.category && (
                      <span className="text-[10px] text-txt-secondary bg-surface-secondary px-2 py-0.5 rounded-full">
                        {categoryLabel(c.category)}
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-txt-primary font-medium line-clamp-2">
                    {c.description}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {c.complainant?.name && !c.complainant.anonymous && (
                      <span className="text-[11px] text-txt-secondary flex items-center gap-1">
                        <User className="w-3 h-3" /> {c.complainant.name}
                      </span>
                    )}
                    {c.complainant?.anonymous && (
                      <span className="text-[11px] text-txt-tertiary italic">Anonymous</span>
                    )}
                    {c.industry?.name && (
                      <span className="text-[11px] text-primary flex items-center gap-1">
                        {c.industry.name}
                      </span>
                    )}
                    {coords && (
                      <span className="text-[11px] text-txt-secondary flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {coords}
                      </span>
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
