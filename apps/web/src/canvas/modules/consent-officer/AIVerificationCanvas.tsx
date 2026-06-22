import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { Spinner } from '../../../components/ui/Spinner.js'

// ── Types ─────────────────────────────────────────────────────────────────────

type DocStatus = 'OK' | 'BLANK' | 'MISSING' | 'BLURRED' | 'UNCLEAR' | 'UNSCANNED'
type HumanReviewStatus = 'PENDING' | 'APPROVED' | 'RETURNED' | null

interface DocItem {
  name: string
  status: DocStatus
  aiNote?: string
}

interface DocVerification {
  aiReviewedAt: string | null
  humanReviewStatus: HumanReviewStatus
  documents: DocItem[]
  aiConfidence?: number
}

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
  industry: Industry
  docVerification: DocVerification
}

interface ConsentsApiResponse {
  items: ConsentItem[]
  nextCursor?: string
}

interface SummaryResponse {
  totalReviewed: number
  totalAppsAwaitingHumanReview: number
  byStatus: Record<string, number>
}

interface Props {
  args?: Record<string, unknown>
  /** If provided the KPI strip is hidden (parent already shows it) */
  hideKpi?: boolean
  summary?: SummaryResponse | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOC_STATUS_META: Record<DocStatus, { label: string; pill: string; dot: string }> = {
  OK:        { label: 'OK',        pill: 'bg-ok-light text-ok',               dot: 'bg-ok'        },
  BLANK:     { label: 'Blank',     pill: 'bg-danger-light text-danger',        dot: 'bg-danger'    },
  MISSING:   { label: 'Missing',   pill: 'bg-warn-light text-warn',            dot: 'bg-warn'      },
  BLURRED:   { label: 'Blurred',   pill: 'bg-orange-100 text-orange-600',      dot: 'bg-orange-500'},
  UNCLEAR:   { label: 'Unclear',   pill: 'bg-sky-100 text-sky-600',            dot: 'bg-sky-500'   },
  UNSCANNED: { label: 'Unscanned', pill: 'bg-surface-secondary text-txt-tertiary border border-bdr', dot: 'bg-txt-tertiary' },
}

const ISSUE_STATUSES: DocStatus[] = ['BLANK', 'MISSING', 'BLURRED', 'UNCLEAR', 'UNSCANNED']

const STATUS_STRIP: { key: DocStatus; emoji: string; bg: string; text: string }[] = [
  { key: 'OK',        emoji: '🟢', bg: 'bg-ok-light',               text: 'text-ok'           },
  { key: 'BLANK',     emoji: '🔴', bg: 'bg-danger-light',            text: 'text-danger'       },
  { key: 'MISSING',   emoji: '🟡', bg: 'bg-warn-light',              text: 'text-warn'         },
  { key: 'BLURRED',   emoji: '🟠', bg: 'bg-orange-100',              text: 'text-orange-600'   },
  { key: 'UNCLEAR',   emoji: '🔵', bg: 'bg-sky-100',                 text: 'text-sky-600'      },
  { key: 'UNSCANNED', emoji: '⚪', bg: 'bg-surface-secondary',       text: 'text-txt-secondary'},
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function issueCount(docs: DocItem[]): number {
  return docs.filter(d => ISSUE_STATUSES.includes(d.status)).length
}

function issueBreakdown(docs: DocItem[]): string {
  const counts: Partial<Record<DocStatus, number>> = {}
  for (const d of docs) {
    if (ISSUE_STATUSES.includes(d.status)) {
      counts[d.status] = (counts[d.status] ?? 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([s, n]) => `${n} ${s.toLowerCase()}`)
    .join(', ')
}

function confidenceFromDocs(docs: DocItem[]): number {
  if (docs.length === 0) return 0
  const okCount = docs.filter(d => d.status === 'OK').length
  return Math.round((okCount / docs.length) * 100)
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

function KpiStrip({ summary, renewalCount }: { summary: SummaryResponse | null; renewalCount: number }) {
  const flaggedCount = summary
    ? (ISSUE_STATUSES.reduce((s, k) => s + (summary.byStatus[k] ?? 0), 0))
    : null

  const tiles = [
    {
      label: 'Awaiting human review',
      value: summary?.totalAppsAwaitingHumanReview ?? null,
      color: 'text-warn',
      bg: 'bg-warn-light',
    },
    {
      label: 'AI flagged issues',
      value: flaggedCount,
      color: 'text-danger',
      bg: 'bg-danger-light',
    },
    {
      label: 'Renewals due ≤30d',
      value: renewalCount,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Approved last 30d',
      value: null, // not available from summary — placeholder
      color: 'text-ok',
      bg: 'bg-ok-light',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-3 px-5 py-3 bg-white border-b border-bdr-light">
      {tiles.map((t) => (
        <div key={t.label} className={`rounded-xl px-3 py-2.5 ${t.bg}`}>
          <div className={`text-[22px] font-bold leading-none ${t.color}`}>
            {t.value === null ? <span className="text-[14px] text-txt-tertiary">—</span> : t.value}
          </div>
          <div className="text-[10px] text-txt-secondary mt-1 leading-tight">{t.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Doc chip ──────────────────────────────────────────────────────────────────

function DocChip({ doc }: { doc: DocItem }) {
  const [tip, setTip] = useState(false)
  const meta = DOC_STATUS_META[doc.status]

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        onFocus={() => setTip(true)}
        onBlur={() => setTip(false)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold ${meta.pill} transition-opacity hover:opacity-90`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
        <span className="max-w-[120px] truncate">{doc.name}</span>
        <span className="opacity-70">{meta.label}</span>
      </button>
      {tip && doc.aiNote && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 bg-txt-primary text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-modal max-w-[220px] whitespace-normal leading-snug pointer-events-none">
          {doc.aiNote}
        </div>
      )}
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function ConsentRow({
  item,
  onApprove,
  onReturn,
}: {
  item: ConsentItem
  onApprove: (id: string) => void
  onReturn: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [acting, setActing] = useState(false)

  const dv = item.docVerification
  const docs = dv.documents
  const issues = issueCount(docs)
  const confidence = dv.aiConfidence ?? confidenceFromDocs(docs)
  const hrStatus = dv.humanReviewStatus
  const isReviewed = hrStatus === 'APPROVED' || hrStatus === 'RETURNED'

  const confColor =
    confidence >= 80 ? 'bg-ok' :
    confidence >= 50 ? 'bg-warn' : 'bg-danger'

  async function handleApprove() {
    setActing(true)
    await onApprove(item.id)
    setActing(false)
  }

  async function handleReturn() {
    setActing(true)
    await onReturn(item.id)
    setActing(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-card border border-bdr-light overflow-hidden transition-all">
      {/* Row header */}
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-page/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Industry + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-txt-primary truncate">{item.industry.name}</span>
            <span className="text-[10px] border border-bdr text-txt-tertiary px-1.5 py-0.5 rounded-full flex-shrink-0">{item.type}</span>
            {hrStatus && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                hrStatus === 'APPROVED' ? 'bg-ok-light text-ok' :
                hrStatus === 'RETURNED' ? 'bg-danger-light text-danger' :
                'bg-warn-light text-warn'
              }`}>
                {hrStatus}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-txt-tertiary">{item.industry.ucNumber}</span>
            {item.submittedAt && (
              <span className="text-[10px] text-txt-tertiary">
                · submitted {new Date(item.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* AI summary + confidence */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {docs.length === 0 ? (
            <span className="text-[11px] text-txt-tertiary italic">No AI data</span>
          ) : issues === 0 ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-ok">
              <CheckCircle className="w-3.5 h-3.5" /> All clear
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-warn">
              <AlertTriangle className="w-3.5 h-3.5" />
              {issues} issue{issues !== 1 ? 's' : ''} &mdash; {issueBreakdown(docs)}
            </span>
          )}

          {/* Confidence bar */}
          {docs.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-1.5 bg-bdr-light rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${confColor}`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="text-[10px] text-txt-tertiary">{confidence}%</span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 text-txt-tertiary self-center">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-bdr-light px-4 py-3 bg-surface-page/40">
          {docs.length === 0 ? (
            <p className="text-[12px] text-txt-tertiary italic">No document verification data available for this application.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {docs.map((doc, i) => (
                <DocChip key={i} doc={doc} />
              ))}
            </div>
          )}

          {/* Actions */}
          {!isReviewed && docs.length > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-bdr-light">
              <button
                disabled={acting}
                onClick={handleApprove}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-ok text-white text-[12px] font-bold shadow-card disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve for review
              </button>
              <button
                disabled={acting}
                onClick={handleReturn}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface border border-bdr text-txt-primary text-[12px] font-semibold disabled:opacity-50 hover:bg-surface-secondary transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Return to industry
              </button>
            </div>
          )}

          {isReviewed && (
            <div className={`mt-3 pt-3 border-t border-bdr-light text-[11px] font-semibold ${
              hrStatus === 'APPROVED' ? 'text-ok' : 'text-danger'
            }`}>
              {hrStatus === 'APPROVED' ? 'Approved for further review' : 'Returned to industry with note'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AIVerificationCanvas({ hideKpi = false, summary: externalSummary = null }: Props) {
  const { token } = useAuth()
  const [items, setItems] = useState<ConsentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<SummaryResponse | null>(externalSummary)
  const [renewalCount, setRenewalCount] = useState(0)

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [consentsData, summaryData, renewalData] = await Promise.all([
        api<ConsentsApiResponse>('/api/consents?limit=50', { token }),
        externalSummary ? Promise.resolve(externalSummary) : api<SummaryResponse>('/api/consents/doc-verification-summary', { token }),
        api<ConsentsApiResponse>('/api/consents?expiringWithinDays=30&limit=1', { token }),
      ])

      // Normalise: inject docVerification if the field comes back as plain JSON
      const normalised: ConsentItem[] = consentsData.items.map(item => {
        const rawDv = ((item as unknown) as Record<string, unknown>)['docVerification'] as Record<string, unknown> | null | undefined ?? {}
        const dv: DocVerification = {
          aiReviewedAt: (rawDv['aiReviewedAt'] as string | null) ?? null,
          humanReviewStatus: (rawDv['humanReviewStatus'] as HumanReviewStatus) ?? null,
          documents: Array.isArray(rawDv['documents']) ? (rawDv['documents'] as DocItem[]) : [],
          aiConfidence: rawDv['aiConfidence'] as number | undefined,
        }
        return { ...item, docVerification: dv }
      })

      setItems(normalised)
      if (!externalSummary) setSummary(summaryData)
      setRenewalCount(renewalData.items.length)
    } catch {
      setError('Failed to load verification data.')
    } finally {
      setLoading(false)
    }
  }, [token, externalSummary])

  useEffect(() => { loadData() }, [loadData])

  // Keep external summary in sync
  useEffect(() => {
    if (externalSummary) setSummary(externalSummary)
  }, [externalSummary])

  async function handleApprove(id: string) {
    if (!token) return
    try {
      await api(`/api/consents/${id}/human-review`, {
        method: 'POST',
        token,
        body: { status: 'APPROVED', notes: 'Approved for further review via AI Verification canvas' },
      })
      setItems(prev => prev.map(item =>
        item.id === id
          ? { ...item, docVerification: { ...item.docVerification, humanReviewStatus: 'APPROVED' } }
          : item,
      ))
    } catch {
      // silently ignore — row will remain actionable
    }
  }

  async function handleReturn(id: string) {
    if (!token) return
    try {
      await api(`/api/consents/${id}/human-review`, {
        method: 'POST',
        token,
        body: { status: 'RETURNED', notes: 'Returned to industry — documents require correction' },
      })
      setItems(prev => prev.map(item =>
        item.id === id
          ? { ...item, docVerification: { ...item.docVerification, humanReviewStatus: 'RETURNED' } }
          : item,
      ))
    } catch {
      // silently ignore
    }
  }

  // AI status breakdown strip counts
  const stripCounts: Record<DocStatus, number> = { OK: 0, BLANK: 0, MISSING: 0, BLURRED: 0, UNCLEAR: 0, UNSCANNED: 0 }
  for (const item of items) {
    for (const doc of item.docVerification.documents) {
      if (doc.status in stripCounts) stripCounts[doc.status]++
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-page rounded-card overflow-hidden animate-bubble-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-[14px] font-bold text-txt-primary">AI Document Verification</div>
          <div className="text-[11px] text-txt-secondary">AI-reviewed docs · approve or return per application</div>
        </div>
      </div>

      {/* KPI strip */}
      {!hideKpi && <KpiStrip summary={summary} renewalCount={renewalCount} />}

      {/* AI status breakdown strip */}
      {!loading && !error && (
        <div className="flex items-center gap-1 px-5 py-2.5 bg-white border-b border-bdr-light overflow-x-auto">
          {STATUS_STRIP.map(({ key, emoji, bg, text }) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-[11px] font-semibold flex-shrink-0 ${bg} ${text}`}
            >
              {emoji} {key} {stripCounts[key]}
            </span>
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Spinner size={32} />
          </div>
        ) : error ? (
          <div className="text-[13px] text-danger text-center py-10">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-[13px] text-txt-tertiary text-center py-10">No applications found.</div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <ConsentRow
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onReturn={handleReturn}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export { KpiStrip }
export type { SummaryResponse }
