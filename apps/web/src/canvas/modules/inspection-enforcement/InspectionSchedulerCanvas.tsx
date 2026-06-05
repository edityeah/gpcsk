/**
 * InspectionSchedulerCanvas
 *
 * Month-grid calendar showing all scheduled / completed inspections.
 * Clicking a completed row shows a "Mark Completed" inline CTA that
 * POSTs to /api/inspections/:id/complete (no violations, for quick field update).
 * Supports pre-selecting an industry via the `prefillIndustryId` prop
 * (wired from InspectionPrioritisationCanvas's "Schedule" button).
 */

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertTriangle, RefreshCw, Plus } from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

interface InspectionItem {
  id: string
  scheduledAt: string
  state: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  industry: { id: string; name: string; ucNumber: string; category: string }
  inspector: { id: string; name: string } | null
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

const STATE_ICON: Record<string, React.ReactNode> = {
  SCHEDULED: <Clock className="w-3 h-3 text-warn inline-block" />,
  COMPLETED: <CheckCircle2 className="w-3 h-3 text-ok inline-block" />,
  CANCELLED: <AlertTriangle className="w-3 h-3 text-txt-tertiary inline-block" />,
}

const STATE_DOT: Record<string, string> = {
  SCHEDULED: 'bg-warn',
  COMPLETED: 'bg-ok',
  CANCELLED: 'bg-slate-300',
}

export function InspectionSchedulerCanvas({
  prefillIndustryId,
}: {
  prefillIndustryId?: string
}) {
  const { token } = useAuth()
  const { showToast } = useApp()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [inspections, setInspections] = useState<InspectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null) // selected day (yyyy-mm-dd)
  const [showForm, setShowForm] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [industryId, setIndustryId] = useState(prefillIndustryId ?? '')
  const [submitting, setSubmitting] = useState(false)

  async function loadMonth() {
    setLoading(true)
    const fromDate = new Date(year, month, 1).toISOString()
    const toDate   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    try {
      const data = await api<{ items: InspectionItem[] }>(
        `/api/inspections?since=${fromDate}&until=${toDate}&limit=100`,
        { token: token ?? undefined },
      )
      setInspections(data.items)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load inspections.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadMonth() }, [year, month, token])

  // Pre-fill and open form when coming from prioritisation canvas
  useEffect(() => {
    if (prefillIndustryId) {
      setIndustryId(prefillIndustryId)
      setShowForm(true)
    }
  }, [prefillIndustryId])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelected(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelected(null)
  }

  // Group by date
  const byDate = new Map<string, InspectionItem[]>()
  for (const item of inspections) {
    const d = isoDate(new Date(item.scheduledAt))
    const existing = byDate.get(d) ?? []
    existing.push(item)
    byDate.set(d, existing)
  }

  const days = daysInMonth(year, month)
  const startDay = firstWeekday(year, month)
  const todayStr = isoDate(now)

  const selectedItems = selected ? (byDate.get(selected) ?? []) : []

  async function markComplete(id: string) {
    setCompleting(id)
    try {
      await api(`/api/inspections/${id}/complete`, {
        method: 'POST',
        token: token ?? undefined,
        body: { observations: {}, photos: [], violations: [] },
      })
      showToast({ kind: 'success', text: 'Inspection marked as completed.' })
      void loadMonth()
    } catch {
      showToast({ kind: 'danger', text: 'Failed to complete inspection.' })
    } finally {
      setCompleting(null)
    }
  }

  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!industryId || !scheduleDate) return
    setSubmitting(true)
    try {
      await api('/api/inspections', {
        method: 'POST',
        token: token ?? undefined,
        body: { industryId, scheduledAt: new Date(scheduleDate).toISOString() },
      })
      showToast({ kind: 'success', text: 'Inspection scheduled.' })
      setShowForm(false)
      setScheduleDate('')
      void loadMonth()
    } catch {
      showToast({ kind: 'danger', text: 'Failed to schedule inspection.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-page animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-bdr bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-surface-page transition-colors">
              <ChevronLeft className="w-4 h-4 text-txt-secondary" />
            </button>
            <h2 className="text-[15px] font-bold text-txt-primary w-44 text-center">
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-surface-page transition-colors">
              <ChevronRight className="w-4 h-4 text-txt-secondary" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void loadMonth()} disabled={loading}
            className="p-2 rounded-lg hover:bg-surface-page disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-txt-secondary ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[12px] font-semibold hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Schedule
          </button>
        </div>
      </div>

      {/* Schedule form */}
      {showForm && (
        <form
          onSubmit={(e) => void handleScheduleSubmit(e)}
          className="px-6 py-4 bg-primary-light border-b border-bdr flex-shrink-0 flex flex-wrap gap-3 items-end"
        >
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">Industry ID</label>
            <input
              value={industryId}
              onChange={e => setIndustryId(e.target.value)}
              placeholder="Industry UUID"
              className="px-3 py-1.5 rounded-lg border border-bdr text-[13px] bg-white outline-none focus:ring-2 focus:ring-primary/30 w-56"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">Date</label>
            <input
              type="date"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-bdr text-[13px] bg-white outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>
          <button type="submit" disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-primary text-white text-[13px] font-semibold hover:bg-primary-dark disabled:opacity-50">
            {submitting ? 'Scheduling…' : 'Confirm'}
          </button>
          <button type="button" onClick={() => setShowForm(false)}
            className="px-4 py-1.5 rounded-lg border border-bdr text-[13px] text-txt-secondary hover:bg-white">
            Cancel
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 px-6 pt-4 text-[11px] font-bold uppercase tracking-wider text-txt-tertiary text-center flex-shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="pb-2">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5 px-6 pb-4 flex-shrink-0">
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayItems = byDate.get(dateStr) ?? []
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selected
            return (
              <button
                key={dateStr}
                onClick={() => setSelected(isSelected ? null : dateStr)}
                className={`
                  relative min-h-[60px] rounded-xl p-1.5 text-left transition-all border
                  ${isToday ? 'border-primary bg-primary-light' : 'border-transparent hover:border-bdr bg-white'}
                  ${isSelected ? 'ring-2 ring-primary' : ''}
                `}
              >
                <span className={`text-[12px] font-bold ${isToday ? 'text-primary' : 'text-txt-primary'}`}>
                  {day}
                </span>
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {dayItems.slice(0, 3).map(item => (
                    <span key={item.id} className={`w-2 h-2 rounded-full ${STATE_DOT[item.state] ?? 'bg-slate-300'}`} title={item.industry.name} />
                  ))}
                  {dayItems.length > 3 && (
                    <span className="text-[9px] text-txt-tertiary">+{dayItems.length - 3}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected day panel */}
        {selected && (
          <div className="mx-6 mb-6 rounded-xl border border-bdr bg-white shadow-card animate-slide-in">
            <div className="px-4 py-3 border-b border-bdr-light">
              <h3 className="text-[13px] font-bold text-txt-primary">
                {new Date(selected + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-[11px] text-txt-secondary mt-0.5">
                {selectedItems.length === 0 ? 'No inspections' : `${selectedItems.length} inspection(s)`}
              </p>
            </div>
            {selectedItems.length === 0 && (
              <div className="px-4 py-8 text-center text-txt-tertiary text-[13px]">No inspections scheduled for this day.</div>
            )}
            {selectedItems.map(item => (
              <div key={item.id} className="px-4 py-3 border-b border-bdr-light last:border-b-0 flex items-center gap-3">
                <span>{STATE_ICON[item.state]}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] text-txt-primary truncate">{item.industry.name}</div>
                  <div className="text-[11px] text-txt-tertiary">{item.industry.ucNumber} · {item.state}</div>
                </div>
                {item.state === 'SCHEDULED' && (
                  <button
                    onClick={() => void markComplete(item.id)}
                    disabled={completing === item.id}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-ok text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {completing === item.id ? 'Saving…' : 'Mark Completed'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
