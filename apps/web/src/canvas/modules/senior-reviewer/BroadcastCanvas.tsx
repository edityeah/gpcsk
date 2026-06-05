/**
 * BroadcastCanvas — Senior Reviewer tool #6
 *
 * Compose + send broadcast to roles/regions → POST /api/broadcasts.
 * Recent broadcasts listed below.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle,
  Megaphone,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'
import { api } from '../../../lib/api.js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Broadcast {
  id: string
  title: string
  body: string
  audience: string[]
  sentAt: string
  sentBy: {
    id: string
    name: string
    role: string
  }
}

// ── Audience options ──────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS = [
  { value: 'CONSENT_OFFICER',                 label: 'Consent Officers' },
  { value: 'MONITORING_OFFICER',              label: 'Monitoring Officers' },
  { value: 'INSPECTION_ENFORCEMENT_OFFICER',  label: 'Inspection & Enforcement Officers' },
  { value: 'COMPLAINTS_OFFICER',              label: 'Complaints Officers' },
  { value: 'ALL_OFFICERS',                    label: 'All Officers (statewide)' },
  { value: 'REGION_AHMEDABAD',               label: 'Region: Ahmedabad' },
  { value: 'REGION_SURAT',                   label: 'Region: Surat' },
  { value: 'REGION_VADODARA',                label: 'Region: Vadodara' },
  { value: 'REGION_RAJKOT',                  label: 'Region: Rajkot' },
]

function audienceLabel(val: string): string {
  return AUDIENCE_OPTIONS.find(o => o.value === val)?.label ?? val
}

// ── Recent broadcast card ─────────────────────────────────────────────────────

function BroadcastCard({ b }: { b: Broadcast }) {
  return (
    <div className="bg-white rounded-card shadow-card p-4 border border-bdr-light animate-slide-in">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-[13px] text-txt-primary">{b.title}</div>
          <div className="text-[11px] text-txt-secondary mt-0.5 line-clamp-2">{b.body}</div>
        </div>
        <div className="text-[10px] text-txt-tertiary flex-shrink-0 whitespace-nowrap">
          {new Date(b.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <Users className="w-3 h-3 text-txt-tertiary" />
        {b.audience.map(a => (
          <span key={a} className="chip text-[9px] py-0.5 px-2">{audienceLabel(a)}</span>
        ))}
        <span className="ml-auto text-[10px] text-txt-tertiary">by {b.sentBy.name}</span>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function BroadcastCanvas() {
  const { token, user } = useAuth()
  const { showToast } = useApp()

  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [audience, setAudience] = useState<string[]>([])
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const isSR = user?.role === 'SENIOR_REVIEWER'

  const loadBroadcasts = useCallback(async () => {
    if (!token) return
    setLoadingList(true)
    try {
      const d = await api<{ items: Broadcast[] }>('/api/broadcasts', { token })
      setBroadcasts(d.items)
    } catch {
      // silent
    } finally {
      setLoadingList(false)
    }
  }, [token])

  useEffect(() => { void loadBroadcasts() }, [loadBroadcasts])

  function toggleAudience(val: string) {
    setAudience(prev =>
      prev.includes(val) ? prev.filter(a => a !== val) : [...prev, val],
    )
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim() || audience.length === 0 || !token) return
    setSending(true)
    try {
      await api<Broadcast>('/api/broadcasts', {
        method: 'POST',
        token,
        body: { title: title.trim(), body: body.trim(), audience },
      })
      showToast({ kind: 'success', text: 'Broadcast sent successfully.' })
      setTitle('')
      setBody('')
      setAudience([])
      setSent(true)
      setTimeout(() => setSent(false), 3000)
      await loadBroadcasts()
    } catch {
      showToast({ kind: 'danger', text: 'Failed to send broadcast.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Megaphone className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-[20px] font-bold text-txt-primary">Broadcast</h2>
          <p className="text-[12px] text-txt-tertiary mt-0.5">Compose and send a message to specific roles or regions.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Compose form */}
        <div className="bg-white rounded-card shadow-card p-6">
          <h3 className="font-bold text-[14px] text-txt-primary mb-4">Compose Message</h3>

          {!isSR ? (
            <div className="py-8 text-center text-txt-tertiary text-sm">
              Only Senior Reviewers can send broadcasts.
            </div>
          ) : (
            <form onSubmit={e => { void handleSend(e) }} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[11px] font-medium text-txt-secondary mb-1 uppercase tracking-wider">
                  Subject / Title *
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Heightened alert — Vapi industrial cluster"
                  maxLength={200}
                  className="w-full border border-bdr rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-primary transition-colors"
                />
                <div className="text-[10px] text-txt-tertiary text-right mt-0.5">{title.length}/200</div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-[11px] font-medium text-txt-secondary mb-1 uppercase tracking-wider">
                  Message Body *
                </label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={6}
                  maxLength={5000}
                  placeholder="Enter the broadcast message…"
                  className="w-full border border-bdr rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary resize-none transition-colors"
                />
                <div className="text-[10px] text-txt-tertiary text-right mt-0.5">{body.length}/5000</div>
              </div>

              {/* Audience picker */}
              <div>
                <label className="block text-[11px] font-medium text-txt-secondary mb-2 uppercase tracking-wider">
                  Audience * (select one or more)
                </label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_OPTIONS.map(opt => {
                    const selected = audience.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleAudience(opt.value)}
                        className={`chip text-[11px] transition-colors ${
                          selected
                            ? 'bg-primary text-white border-primary'
                            : 'bg-primary-light text-primary border-bdr-light hover:bg-primary-50'
                        }`}
                      >
                        {selected && <CheckCircle className="w-3 h-3" />}
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
                {audience.length > 0 && (
                  <p className="text-[11px] text-txt-secondary mt-1.5">
                    Sending to: {audience.map(audienceLabel).join(', ')}
                  </p>
                )}
              </div>

              {/* Send button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={sending || !title.trim() || !body.trim() || audience.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-bold text-[14px] hover:bg-primary-dark disabled:opacity-50 transition-colors shadow-modal"
                >
                  {sending ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : sent ? (
                    <><CheckCircle className="w-4 h-4" /> Sent!</>
                  ) : (
                    <><Send className="w-4 h-4" /> Send Broadcast</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Recent broadcasts */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-bold text-[13px] text-txt-primary">Recent Broadcasts</h3>
            <button
              onClick={() => { void loadBroadcasts() }}
              className="ml-auto text-[11px] text-primary flex items-center gap-1 hover:underline"
            >
              <RefreshCw className={`w-3 h-3 ${loadingList ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingList ? (
            <div className="flex items-center justify-center h-32 text-txt-secondary text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-txt-tertiary text-[13px] gap-2">
              <Megaphone className="w-8 h-8 text-txt-tertiary opacity-40" />
              No broadcasts sent yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {broadcasts.map(b => <BroadcastCard key={b.id} b={b} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
