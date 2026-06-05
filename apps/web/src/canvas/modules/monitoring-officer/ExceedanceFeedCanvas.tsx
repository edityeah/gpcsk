/**
 * ExceedanceFeedCanvas — chronological feed of pending exceedances.
 * Polls /api/exceedances?dispositionState=PENDING.
 * Expand row to "Confirm violation" / "Mark sensor glitch".
 */

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle, Zap, RefreshCw } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { api } from '../../../lib/api.js'
import { useApp } from '../../../context/AppContext.js'

interface Exceedance {
  id: string
  parameter: string
  observedValue: number
  normValue: number
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL'
  detectedAt: string
  dispositionState: 'PENDING' | 'CONFIRMED_VIOLATION' | 'SENSOR_GLITCH'
  station: {
    id: string
    name: string
    type: string
    industry: {
      id: string
      name: string
      districtId: string | null
    } | null
  }
}

interface ExceedanceApiResponse {
  exceedances: Exceedance[]
  nextCursor?: string
  count?: number
}

const SEVERITY_STYLES: Record<string, string> = {
  MINOR:    'badge badge-warn',
  MAJOR:    'badge badge-flag',
  CRITICAL: 'badge badge-danger',
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function ExceedanceFeedCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [items, setItems] = useState<Exceedance[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api<ExceedanceApiResponse | Exceedance[]>(
        '/api/exceedances?dispositionState=PENDING&limit=50',
        { token: token ?? undefined },
      )
      const list: Exceedance[] = Array.isArray(res)
        ? res
        : ((res as ExceedanceApiResponse).exceedances ?? [])
      setItems(list)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load exceedances.' })
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => {
    void load()
    const interval = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(interval)
  }, [load])

  async function handleDispose(id: string, action: 'confirmed_violation' | 'sensor_glitch') {
    setActing(id)
    try {
      await api(`/api/exceedances/${id}/disposition`, {
        method: 'POST',
        body: { action },
        token: token ?? undefined,
      })
      showToast({
        kind: action === 'confirmed_violation' ? 'warn' : 'success',
        text: action === 'confirmed_violation' ? 'Violation confirmed — enforcement draft created.' : 'Marked as sensor glitch.',
      })
      setItems(prev => prev.filter(e => e.id !== id))
      setExpanded(null)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to update disposition.' })
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-bdr-light flex-shrink-0">
        <div>
          <h2 className="text-[16px] font-bold text-txt-primary">Exceedance Feed</h2>
          <p className="text-[12px] text-txt-secondary mt-0.5">Pending exceedances awaiting disposition — newest first</p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className="badge badge-danger">{items.length} pending</span>
          )}
          <button
            onClick={() => { void load() }}
            className="p-2 rounded-lg hover:bg-surface-secondary text-txt-secondary"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-txt-tertiary text-[14px]">Loading exceedances…</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <CheckCircle className="w-8 h-8 text-ok" />
            <span className="text-[14px] text-txt-secondary">All exceedances resolved</span>
          </div>
        ) : (
          items.map(exc => {
            const isExpanded = expanded === exc.id
            const breach = Math.round(((exc.observedValue - exc.normValue) / exc.normValue) * 100)
            const industryName = exc.station.industry?.name ?? exc.station.name
            const stationName = exc.station.name
            return (
              <div
                key={exc.id}
                className="bg-white rounded-card border border-bdr-light shadow-card overflow-hidden animate-bubble-in"
              >
                {/* Summary row */}
                <button
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-surface-secondary/50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : exc.id)}
                >
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    exc.severity === 'CRITICAL' ? 'text-danger' : exc.severity === 'MAJOR' ? 'text-flag' : 'text-warn'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-txt-primary">{industryName}</span>
                      <span className={SEVERITY_STYLES[exc.severity]}>{exc.severity}</span>
                    </div>
                    <div className="text-[12px] text-txt-secondary mt-0.5">
                      {stationName} · {exc.parameter}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-[12px]">
                      <span className="font-semibold text-danger">
                        {exc.observedValue} <span className="text-txt-tertiary font-normal">(norm {exc.normValue})</span>
                      </span>
                      <span className="text-danger font-medium">+{breach}% over limit</span>
                      <span className="text-txt-tertiary">{timeAgo(exc.detectedAt)}</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-txt-tertiary flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-txt-tertiary flex-shrink-0 mt-1" />}
                </button>

                {/* Expanded actions */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-bdr-light bg-surface-secondary/40 animate-slide-in">
                    <div className="text-[12px] text-txt-secondary py-3">
                      Detected at {new Date(exc.detectedAt).toLocaleString()} · Station {stationName}
                    </div>
                    <div className="flex gap-3">
                      <button
                        disabled={acting === exc.id}
                        onClick={() => { void handleDispose(exc.id, 'confirmed_violation') }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-danger text-white text-[13px] font-semibold hover:bg-danger/90 disabled:opacity-60 transition-colors"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        Confirm violation
                      </button>
                      <button
                        disabled={acting === exc.id}
                        onClick={() => { void handleDispose(exc.id, 'sensor_glitch') }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-bdr text-txt-primary text-[13px] font-semibold hover:bg-surface-secondary disabled:opacity-60 transition-colors"
                      >
                        <Zap className="w-4 h-4 text-txt-secondary" />
                        Mark sensor glitch
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
