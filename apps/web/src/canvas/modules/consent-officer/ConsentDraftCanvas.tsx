import { useState, useEffect, useCallback } from 'react'
import { PenLine, ThumbsUp, ThumbsDown, ChevronDown, AlertCircle } from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'
import { Spinner } from '../../../components/ui/Spinner.js'

interface Industry {
  id: string
  name: string
  ucNumber: string
  category: string
}

interface ConsentItem {
  id: string
  type: 'CTE' | 'CTO' | 'HW_AUTH'
  state: string
  submittedAt: string
  validityTo: string | null
  feeStatus: string
  parameters: Record<string, unknown>
  reviewerNotes: string | null
  industry: Industry
}

interface ConsentsApiResponse {
  items: ConsentItem[]
}

const STATE_COLORS: Record<string, string> = {
  APPROVED:     'bg-ok-light text-ok',
  RECOMMENDED:  'bg-flag-light text-flag',
  UNDER_REVIEW: 'bg-warn-light text-warn',
  DRAFT:        'bg-surface-secondary text-txt-secondary border border-bdr',
  REJECTED:     'bg-danger-light text-danger',
  EXPIRED:      'bg-surface-secondary text-txt-tertiary border border-bdr',
  RENEWED:      'bg-ok-light text-ok',
}

interface Props {
  args?: Record<string, unknown>
}

export default function ConsentDraftCanvas(_: Props) {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [consents, setConsents] = useState<ConsentItem[]>([])
  const [selected, setSelected] = useState<ConsentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState<'recommend' | 'reject' | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const loadConsents = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      // Load DRAFT and UNDER_REVIEW consents for drafting
      const [draft, underReview] = await Promise.all([
        api<ConsentsApiResponse>('/api/consents?state=DRAFT&limit=20', { token }),
        api<ConsentsApiResponse>('/api/consents?state=UNDER_REVIEW&limit=20', { token }),
      ])
      const all = [...draft.items, ...underReview.items]
      setConsents(all)
      if (all.length > 0) setSelected(all[0]!)
    } catch {
      setError('Failed to load consent applications.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadConsents() }, [loadConsents])

  async function handleAction(action: 'recommend' | 'reject') {
    if (!selected || !token) return
    setSubmitting(action)
    try {
      const endpoint = action === 'recommend'
        ? `/api/consents/${selected.id}/recommend`
        : `/api/consents/${selected.id}/reject`

      await api<ConsentItem>(endpoint, {
        method: 'POST',
        token,
        body: notes ? { reason: notes } : {},
      })

      showToast({
        kind: action === 'recommend' ? 'success' : 'warn',
        text: action === 'recommend'
          ? `Recommended: ${selected.industry.name}`
          : `Rejected: ${selected.industry.name}`,
      })

      // Remove the acted-on consent from the list and select next
      setConsents(prev => {
        const next = prev.filter(c => c.id !== selected.id)
        setSelected(next[0] ?? null)
        return next
      })
      setNotes('')
    } catch (e) {
      const err = e as { message?: string; code?: string }
      showToast({
        kind: 'danger',
        text: err.code === 'invalid_state_transition'
          ? 'Cannot act: consent is not in a draftable state.'
          : err.message ?? 'Action failed.',
      })
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-page rounded-card overflow-hidden animate-bubble-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
          <PenLine className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold text-txt-primary">Consent Draft</div>
          <div className="text-[11px] text-txt-secondary">Review application — recommend or reject</div>
        </div>
        <span className="text-[12px] font-bold text-txt-secondary">{consents.length} pending</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Spinner size={36} />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-[13px] text-danger">{error}</p>
        </div>
      ) : consents.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <AlertCircle className="w-8 h-8 text-txt-tertiary" />
          <p className="text-[13px] text-txt-tertiary">No pending applications to review.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Application selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="w-full bg-white border border-bdr rounded-xl px-4 py-3 flex items-center justify-between shadow-card text-left"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-txt-primary truncate">{selected?.industry.name}</div>
                <div className="text-[11px] text-txt-secondary">{selected?.industry.ucNumber} · {selected?.type}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-txt-tertiary flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-bdr rounded-xl shadow-modal overflow-hidden max-h-48 overflow-y-auto">
                {consents.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelected(c); setDropdownOpen(false); setNotes('') }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-surface-secondary ${selected?.id === c.id ? 'bg-primary-light' : ''}`}
                  >
                    <div className="text-[12px] font-semibold text-txt-primary truncate">{c.industry.name}</div>
                    <div className="text-[10px] text-txt-secondary">{c.industry.ucNumber} · {c.type} · {c.state.replace(/_/g, ' ')}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Application details */}
          {selected && (
            <div className="bg-white rounded-xl shadow-card border border-bdr-light p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-txt-secondary uppercase tracking-wider">Application Details</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATE_COLORS[selected.state] ?? ''}`}>
                  {selected.state.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">Industry</div>
                  <div className="text-[12px] font-semibold text-txt-primary mt-0.5">{selected.industry.name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">UC Number</div>
                  <div className="text-[12px] font-semibold text-txt-primary mt-0.5">{selected.industry.ucNumber}</div>
                </div>
                <div>
                  <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">Consent Type</div>
                  <div className="text-[12px] font-semibold text-txt-primary mt-0.5">{selected.type}</div>
                </div>
                <div>
                  <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">Category</div>
                  <div className="text-[12px] font-semibold text-txt-primary mt-0.5">{selected.industry.category}</div>
                </div>
                <div>
                  <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">Submitted</div>
                  <div className="text-[12px] font-semibold text-txt-primary mt-0.5">
                    {new Date(selected.submittedAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">Fee</div>
                  <div className={`text-[12px] font-semibold mt-0.5 ${selected.feeStatus === 'PAID' ? 'text-ok' : 'text-warn'}`}>
                    {selected.feeStatus}
                  </div>
                </div>
              </div>

              {selected.reviewerNotes && (
                <div className="bg-warn-light rounded-lg p-3 border border-warn/20">
                  <div className="text-[10px] font-bold text-warn uppercase tracking-wider mb-1">Previous reviewer notes</div>
                  <div className="text-[12px] text-txt-primary">{selected.reviewerNotes}</div>
                </div>
              )}

              {/* Parameters preview */}
              <div>
                <div className="text-[10px] text-txt-tertiary uppercase tracking-wider mb-1.5">Key Parameters</div>
                <div className="bg-surface-page rounded-lg p-2.5 text-[11px] text-txt-secondary font-mono leading-relaxed max-h-28 overflow-y-auto">
                  {JSON.stringify(selected.parameters, null, 2)
                    .split('\n')
                    .slice(0, 12)
                    .join('\n')}
                </div>
              </div>
            </div>
          )}

          {/* Notes textarea */}
          <div>
            <label className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider block mb-1.5">
              Notes / Reason
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes for the recommendation or rejection reason…"
              rows={3}
              className="w-full border border-bdr rounded-xl px-3 py-2.5 text-[13px] text-txt-primary placeholder:text-txt-tertiary outline-none focus:border-primary resize-none bg-white"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleAction('recommend')}
              disabled={!!submitting || !selected}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-ok text-white font-bold text-[13px] shadow-card disabled:opacity-50 active:opacity-80 transition-opacity"
            >
              {submitting === 'recommend' ? <Spinner size={16} className="border-white" /> : <ThumbsUp className="w-4 h-4" />}
              Recommend
            </button>
            <button
              onClick={() => handleAction('reject')}
              disabled={!!submitting || !selected}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-danger text-white font-bold text-[13px] shadow-card disabled:opacity-50 active:opacity-80 transition-opacity"
            >
              {submitting === 'reject' ? <Spinner size={16} className="border-white" /> : <ThumbsDown className="w-4 h-4" />}
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
