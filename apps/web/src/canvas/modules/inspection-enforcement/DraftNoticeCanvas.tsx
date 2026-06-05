/**
 * DraftNoticeCanvas
 *
 * Form for drafting SHOW_CAUSE / CLOSURE_DIRECTION enforcement notices.
 *
 *   - Notice type toggle (SHOW_CAUSE / CLOSURE_DIRECTION)
 *   - Industry ID field
 *   - Violation chips (add/remove from free-text input)
 *   - AI-template default for the evidence body (mocked — populated on load)
 *   - "Save Draft" → POST /api/enforcement (state: DRAFT)
 *   - "Submit for Senior Review" → POST /api/enforcement + /api/enforcement/:id/submit
 *
 * Maker-checker flow: after submit the notice moves to PENDING_REVIEW and the
 * Senior Reviewer sees it in their MakerCheckerQueueCanvas.
 */

import { useState } from 'react'
import { FileText, Send, Save, X, Plus, AlertTriangle, ChevronDown } from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

type NoticeType = 'SHOW_CAUSE' | 'CLOSURE_DIRECTION'

const AI_TEMPLATES: Record<NoticeType, string> = {
  SHOW_CAUSE: `Dear Sir/Madam,

Whereas it has been brought to the notice of the Gujarat Pollution Control Board (GPCB) that your industry is in violation of the provisions of the Environment (Protection) Act, 1986 / Water (Prevention & Control of Pollution) Act, 1974 / Air (Prevention & Control of Pollution) Act, 1981 and the conditions of the Consent to Operate granted to your unit.

The following parameter exceedances / non-compliances were observed during the inspection conducted by the GPCB authorised officer:

[VIOLATIONS LISTED ABOVE]

You are hereby called upon to show cause, within 15 days of receipt of this notice, as to why action under the above-mentioned Acts should not be initiated against you.

Yours faithfully,
Authorised Officer, GPCB`,

  CLOSURE_DIRECTION: `Dear Sir/Madam,

Whereas the Gujarat Pollution Control Board has received credible evidence / conducted inspections and is satisfied that the operations of your unit are causing environmental pollution and damage to the public health, in contravention of the provisions of the Environment (Protection) Act, 1986.

Having regard to the foregoing and exercising the powers conferred by Section 5 of the Environment (Protection) Act, 1986, the Board hereby directs your unit to:

1. IMMEDIATELY cease and desist all operations that are causing pollution.
2. Take remedial measures as directed below within [X] days.

Failure to comply with this direction will entail further legal action including prosecution under the applicable provisions.

Yours faithfully,
Member Secretary, GPCB`,
}

interface DraftedAction {
  id: string
  state: string
}

export function DraftNoticeCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()

  const [noticeType, setNoticeType] = useState<NoticeType>('SHOW_CAUSE')
  const [industryId, setIndustryId] = useState('')
  const [chips, setChips] = useState<string[]>([])
  const [chipInput, setChipInput] = useState('')
  const [body, setBody] = useState(AI_TEMPLATES['SHOW_CAUSE'])
  const [submitting, setSubmitting] = useState(false)
  const [savedDraft, setSavedDraft] = useState<DraftedAction | null>(null)

  function switchType(t: NoticeType) {
    setNoticeType(t)
    setBody(AI_TEMPLATES[t])
  }

  function addChip() {
    const val = chipInput.trim()
    if (val && !chips.includes(val)) setChips(c => [...c, val])
    setChipInput('')
  }
  function removeChip(chip: string) { setChips(c => c.filter(x => x !== chip)) }

  async function saveDraft() {
    if (!industryId.trim()) { showToast({ kind: 'warn', text: 'Enter an industry ID.' }); return }
    setSubmitting(true)
    try {
      const action = await api<DraftedAction>('/api/enforcement', {
        method: 'POST',
        token: token ?? undefined,
        body: {
          industryId: industryId.trim(),
          type: noticeType,
          evidence: {
            body,
            violations: chips,
          },
          violationIds: [],
        },
      })
      setSavedDraft(action)
      showToast({ kind: 'success', text: 'Notice saved as draft.' })
    } catch {
      showToast({ kind: 'danger', text: 'Failed to save draft.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function submitForReview() {
    let actionId = savedDraft?.id
    if (!actionId) {
      // Save draft first if not done
      if (!industryId.trim()) { showToast({ kind: 'warn', text: 'Enter an industry ID.' }); return }
      setSubmitting(true)
      try {
        const action = await api<DraftedAction>('/api/enforcement', {
          method: 'POST',
          token: token ?? undefined,
          body: {
            industryId: industryId.trim(),
            type: noticeType,
            evidence: { body, violations: chips },
            violationIds: [],
          },
        })
        setSavedDraft(action)
        actionId = action.id
      } catch {
        showToast({ kind: 'danger', text: 'Failed to save draft before submit.' })
        setSubmitting(false)
        return
      }
    }

    try {
      await api(`/api/enforcement/${actionId}/submit`, {
        method: 'POST',
        token: token ?? undefined,
        body: {},
      })
      showToast({ kind: 'success', text: 'Notice submitted for Senior Reviewer approval.' })
      setSavedDraft(null)
      setIndustryId('')
      setChips([])
      setBody(AI_TEMPLATES[noticeType])
    } catch {
      showToast({ kind: 'danger', text: 'Failed to submit notice.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-page animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-bdr bg-white flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-danger-light flex items-center justify-center">
          <FileText className="w-5 h-5 text-danger" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-txt-primary">Draft Enforcement Notice</h2>
          <p className="text-[12px] text-txt-secondary">Maker step — Senior Reviewer approves before issue</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Notice type toggle */}
        <div className="flex gap-2">
          {(['SHOW_CAUSE', 'CLOSURE_DIRECTION'] as NoticeType[]).map(t => (
            <button
              key={t}
              onClick={() => switchType(t)}
              className={`px-4 py-2 rounded-pill text-[13px] font-semibold border transition-all
                ${noticeType === t
                  ? 'bg-danger text-white border-danger shadow-modal'
                  : 'bg-white text-txt-secondary border-bdr hover:border-danger hover:text-danger'
                }`}
            >
              {t === 'SHOW_CAUSE' ? 'Show Cause' : 'Closure Direction'}
            </button>
          ))}
        </div>

        {/* Industry */}
        <div className="rounded-xl border border-bdr bg-white p-4 shadow-card space-y-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-txt-tertiary">Industry</h3>
          <input
            value={industryId}
            onChange={e => setIndustryId(e.target.value)}
            placeholder="Industry UUID (from Risk Index or Violations Register)"
            className="w-full px-3 py-2 rounded-lg border border-bdr text-[13px] outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          />
        </div>

        {/* Violations chips */}
        <div className="rounded-xl border border-bdr bg-white p-4 shadow-card">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-txt-tertiary mb-3">
            Violation Tags
          </h3>
          <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
            {chips.map(chip => (
              <span key={chip} className="chip flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-danger" />
                {chip}
                <button onClick={() => removeChip(chip)} type="button" className="hover:text-danger">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {chips.length === 0 && (
              <span className="text-[12px] text-txt-tertiary italic">No violations added yet.</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={chipInput}
              onChange={e => setChipInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChip() } }}
              placeholder="e.g. BOD exceedance, PM10 breach…"
              className="flex-1 px-3 py-1.5 rounded-lg border border-bdr text-[13px] outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            />
            <button type="button" onClick={addChip}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-light text-primary text-[12px] font-semibold hover:bg-primary hover:text-white transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {/* Notice body (AI-template) */}
        <div className="rounded-xl border border-bdr bg-white p-4 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-txt-tertiary">Notice Body</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-pill bg-primary-light text-primary font-semibold">AI Draft</span>
          </div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={16}
            className="w-full px-3 py-2 rounded-lg border border-bdr text-[12px] font-mono outline-none focus:ring-2 focus:ring-primary/30 bg-white resize-none leading-relaxed"
          />
        </div>

        {/* Status chip if already saved */}
        {savedDraft && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary-light border border-primary/20 text-[13px] text-primary">
            <FileText className="w-4 h-4" />
            Draft saved — ID: <span className="font-mono font-bold truncate max-w-[200px]">{savedDraft.id}</span>
            <span className="ml-auto badge badge-info">{savedDraft.state}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-pill border border-bdr bg-white text-txt-primary font-semibold text-[13px] hover:border-primary hover:text-primary disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => void submitForReview()}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-pill bg-danger text-white font-bold text-[14px] hover:opacity-90 disabled:opacity-50 transition-colors shadow-modal"
          >
            {submitting ? (
              <><span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" /> Submitting…</>
            ) : (
              <><Send className="w-4 h-4" /> Submit for Senior Review</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
