import { useState, useEffect, useCallback } from 'react'
import { GitBranch, Clock } from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
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
  industry: Industry
}

interface ApiResponse {
  items: ConsentItem[]
  nextCursor?: string
}

type KanbanState = 'DRAFT' | 'UNDER_REVIEW' | 'RECOMMENDED' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'RENEWED'

const COLUMNS: { key: KanbanState; label: string; color: string; bg: string }[] = [
  { key: 'DRAFT',        label: 'Draft',        color: 'text-txt-secondary', bg: 'bg-surface-secondary' },
  { key: 'UNDER_REVIEW', label: 'Under Review', color: 'text-warn',          bg: 'bg-warn-light' },
  { key: 'RECOMMENDED',  label: 'Recommended',  color: 'text-flag',          bg: 'bg-flag-light' },
  { key: 'APPROVED',     label: 'Approved',     color: 'text-ok',            bg: 'bg-ok-light' },
  { key: 'REJECTED',     label: 'Rejected',     color: 'text-danger',        bg: 'bg-danger-light' },
]

const CAT_DOT: Record<string, string> = {
  RED: 'bg-danger', ORANGE: 'bg-warn', GREEN: 'bg-ok', WHITE: 'bg-txt-tertiary',
}

interface Props {
  args?: Record<string, unknown>
}

export default function ConsentPipelineCanvas(_: Props) {
  const { token } = useAuth()
  const [grouped, setGrouped] = useState<Record<string, ConsentItem[]>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      // Load up to 100 recent items across all states
      const data = await api<ApiResponse>('/api/consents?limit=100', { token })
      const byState: Record<string, ConsentItem[]> = {}
      const byCount: Record<string, number> = {}

      for (const item of data.items) {
        if (!byState[item.state]) byState[item.state] = []
        byState[item.state]!.push(item)
        byCount[item.state] = (byCount[item.state] ?? 0) + 1
      }

      // Estimate totals from distribution (400 total seeded, scale from sample)
      const sampleSize = data.items.length
      for (const key of Object.keys(byCount)) {
        byCount[key] = byState[key]?.length ?? 0
      }

      setGrouped(byState)
      setCounts(byCount)
    } catch {
      setError('Failed to load pipeline data.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-page rounded-card">
        <Spinner size={36} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-page rounded-card">
        <p className="text-[13px] text-danger">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface-page rounded-card overflow-hidden animate-bubble-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
          <GitBranch className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-[14px] font-bold text-txt-primary">Consent Pipeline</div>
          <div className="text-[11px] text-txt-secondary">Kanban by state — recent 100 applications</div>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full px-5 py-4 min-w-max">
          {COLUMNS.map(col => {
            const colItems = grouped[col.key] ?? []
            const count = counts[col.key] ?? 0

            return (
              <div key={col.key} className="w-56 flex flex-col flex-shrink-0">
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${col.bg} mb-2`}>
                  <span className={`text-[12px] font-bold ${col.color}`}>{col.label}</span>
                  <span className={`text-[11px] font-bold ${col.color} bg-white/60 px-2 py-0.5 rounded-full`}>{count}</span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {colItems.slice(0, 8).map(item => (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl shadow-card border border-bdr-light px-3 py-2.5 cursor-default hover:border-primary transition-colors"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CAT_DOT[item.industry.category] ?? 'bg-txt-tertiary'}`} />
                        <span className="text-[11px] text-txt-tertiary truncate">{item.industry.ucNumber}</span>
                      </div>
                      <div className="text-[12px] font-semibold text-txt-primary leading-tight line-clamp-2">
                        {item.industry.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] border border-bdr text-txt-secondary px-1.5 py-0.5 rounded-full">{item.type}</span>
                        {item.validityTo && (
                          <span className="flex items-center gap-0.5 text-[10px] text-txt-tertiary">
                            <Clock className="w-3 h-3" />
                            {new Date(item.validityTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {colItems.length > 8 && (
                    <div className="text-center text-[11px] text-txt-tertiary py-1">
                      +{colItems.length - 8} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
