import { useState, useEffect, useCallback } from 'react'
import { FileText, ChevronRight, ChevronLeft, Filter } from 'lucide-react'
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
  feeStatus: string
  industry: Industry
}

interface ApiResponse {
  items: ConsentItem[]
  nextCursor?: string
}

type FilterType = '' | 'CTE' | 'CTO' | 'HW_AUTH'
type FilterState = '' | 'DRAFT' | 'UNDER_REVIEW' | 'RECOMMENDED' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'RENEWED'

const STATE_COLORS: Record<string, string> = {
  APPROVED:     'bg-ok-light text-ok',
  RECOMMENDED:  'bg-flag-light text-flag',
  UNDER_REVIEW: 'bg-warn-light text-warn',
  DRAFT:        'bg-surface text-txt-secondary border border-bdr',
  REJECTED:     'bg-danger-light text-danger',
  EXPIRED:      'bg-surface text-txt-tertiary border border-bdr',
  RENEWED:      'bg-ok-light text-ok',
}

const CAT_COLORS: Record<string, string> = {
  RED:    'bg-danger-light text-danger',
  ORANGE: 'bg-warn-light text-warn',
  GREEN:  'bg-ok-light text-ok',
  WHITE:  'bg-surface-secondary text-txt-secondary border border-bdr',
}

interface Props {
  args?: Record<string, unknown>
  onSelectId?: (id: string) => void
}

export default function ApplicationQueueCanvas({ onSelectId }: Props) {
  const { token } = useAuth()
  const [items, setItems] = useState<ConsentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<FilterType>('')
  const [filterState, setFilterState] = useState<FilterState>('')
  const [cursor, setCursor] = useState<string | undefined>()
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [cursorStack, setCursorStack] = useState<string[]>([])

  const load = useCallback(async (cur?: string) => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '15' })
      if (filterType)  params.set('type', filterType)
      if (filterState) params.set('state', filterState)
      if (cur)         params.set('cursor', cur)

      const data = await api<ApiResponse>(`/api/consents?${params.toString()}`, { token })
      setItems(data.items)
      setNextCursor(data.nextCursor)
    } catch {
      setError('Failed to load applications.')
    } finally {
      setLoading(false)
    }
  }, [token, filterType, filterState])

  useEffect(() => {
    setCursor(undefined)
    setCursorStack([])
    setNextCursor(undefined)
    load(undefined)
  }, [load])

  function handleNext() {
    if (!nextCursor) return
    setCursorStack(s => cursor ? [...s, cursor] : s)
    setCursor(nextCursor)
    load(nextCursor)
  }

  function handlePrev() {
    const stack = [...cursorStack]
    const prev = stack.pop()
    setCursorStack(stack)
    setCursor(prev)
    load(prev)
  }

  return (
    <div className="flex flex-col h-full bg-surface-page rounded-card overflow-hidden animate-bubble-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-[14px] font-bold text-txt-primary">Application Queue</div>
          <div className="text-[11px] text-txt-secondary">All consent applications</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-5 py-3 bg-white border-b border-bdr-light flex-wrap">
        <Filter className="w-3.5 h-3.5 text-txt-tertiary flex-shrink-0" />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as FilterType)}
          className="text-[12px] border border-bdr rounded-lg px-2 py-1 bg-white text-txt-primary outline-none focus:border-primary"
        >
          <option value="">All types</option>
          <option value="CTE">CTE</option>
          <option value="CTO">CTO</option>
          <option value="HW_AUTH">HW_AUTH</option>
        </select>
        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value as FilterState)}
          className="text-[12px] border border-bdr rounded-lg px-2 py-1 bg-white text-txt-primary outline-none focus:border-primary"
        >
          <option value="">All states</option>
          <option value="DRAFT">Draft</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="RECOMMENDED">Recommended</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
          <option value="RENEWED">Renewed</option>
        </select>
      </div>

      {/* Table */}
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
              <button
                key={item.id}
                onClick={() => onSelectId?.(item.id)}
                className="w-full text-left bg-white rounded-xl shadow-card border border-bdr-light px-4 py-3 hover:border-primary transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-txt-primary truncate">{item.industry.name}</div>
                    <div className="text-[11px] text-txt-secondary mt-0.5">{item.industry.ucNumber}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAT_COLORS[item.industry.category] ?? ''}`}>
                      {item.industry.category}
                    </span>
                    <ChevronRight className="w-4 h-4 text-txt-tertiary group-hover:text-primary" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] font-bold text-txt-tertiary border border-bdr px-2 py-0.5 rounded-full">{item.type}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATE_COLORS[item.state] ?? ''}`}>
                    {item.state.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.feeStatus === 'PAID' ? 'bg-ok-light text-ok' : 'bg-warn-light text-warn'}`}>
                    {item.feeStatus}
                  </span>
                  {item.validityTo && (
                    <span className="text-[10px] text-txt-tertiary">
                      Valid to {new Date(item.validityTo).toLocaleDateString('en-IN')}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-t border-bdr-light">
        <button
          onClick={handlePrev}
          disabled={cursorStack.length === 0}
          className="flex items-center gap-1 text-[12px] text-primary disabled:text-txt-tertiary disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="text-[11px] text-txt-tertiary">{items.length} records</span>
        <button
          onClick={handleNext}
          disabled={!nextCursor}
          className="flex items-center gap-1 text-[12px] text-primary disabled:text-txt-tertiary disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
