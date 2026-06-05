/**
 * NotificationCanvas
 *
 * Lists notifications for the current user from /api/notifications.
 * Allows marking individual notifications as read via PATCH /api/notifications/:id/read.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Bell,
  CheckCheck,
  RefreshCw,
  AlertCircle,
  Info,
  AlertTriangle,
  Megaphone,
  Clock,
  ShieldAlert,
  Calendar,
} from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'

// ── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  userId: string
  category: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

interface NotificationsResponse {
  notifications: Notification[]
  nextCursor?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string) {
  const d = new Date(date)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  EXCEEDANCE_CRITICAL:      { label: 'Critical Exceedance',     icon: AlertCircle,  color: 'text-red-600 bg-red-50' },
  EXCEEDANCE_PREDICTED:     { label: 'Predicted Exceedance',    icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
  COMPLAINT_ASSIGNED:       { label: 'Complaint Assigned',      icon: Megaphone,    color: 'text-rose-600 bg-rose-50' },
  COMPLAINT_HOTSPOT_ALERT:  { label: 'Hotspot Alert',           icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  RENEWAL_DUE_30:           { label: 'Renewal Due (30 days)',   icon: Calendar,     color: 'text-orange-600 bg-orange-50' },
  RENEWAL_DUE_60:           { label: 'Renewal Due (60 days)',   icon: Calendar,     color: 'text-yellow-600 bg-yellow-50' },
  RENEWAL_DUE_90:           { label: 'Renewal Due (90 days)',   icon: Calendar,     color: 'text-yellow-600 bg-yellow-50' },
  INSPECTION_DUE:           { label: 'Inspection Due',          icon: Clock,        color: 'text-blue-600 bg-blue-50' },
  MAKER_CHECKER_PENDING:    { label: 'Awaiting Approval',       icon: ShieldAlert,  color: 'text-purple-600 bg-purple-50' },
  NOTICE_COMMITTED:         { label: 'Notice Committed',        icon: CheckCheck,   color: 'text-green-600 bg-green-50' },
  ANOMALY_FLAG:             { label: 'Anomaly Flagged',         icon: AlertCircle,  color: 'text-red-600 bg-red-50' },
  FESTIVAL_PLANNER_REMINDER:{ label: 'Festival Reminder',       icon: Bell,         color: 'text-teal-600 bg-teal-50' },
  BROADCAST:                { label: 'Broadcast',               icon: Megaphone,    color: 'text-indigo-600 bg-indigo-50' },
  GENERAL:                  { label: 'General',                 icon: Info,         color: 'text-slate-600 bg-slate-50' },
}

const PRIORITY_BADGE: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 border-red-200',
  HIGH:   'bg-amber-100 text-amber-700 border-amber-200',
  MEDIUM: 'bg-blue-50 text-blue-600 border-blue-100',
  LOW:    'bg-slate-100 text-slate-500 border-slate-200',
}

function extractTitle(n: Notification): string {
  if (typeof n.payload === 'object' && n.payload !== null) {
    if (typeof n.payload['title'] === 'string') return n.payload['title']
    if (typeof n.payload['message'] === 'string') return n.payload['message']
  }
  return CATEGORY_META[n.category]?.label ?? n.category.replace(/_/g, ' ')
}

function extractBody(n: Notification): string | null {
  if (typeof n.payload === 'object' && n.payload !== null) {
    if (typeof n.payload['body'] === 'string') return n.payload['body']
    if (typeof n.payload['description'] === 'string') return n.payload['description']
  }
  return null
}

// ── Notification card ─────────────────────────────────────────────────────────

function NotifCard({
  notif,
  onRead,
}: {
  notif: Notification
  onRead: (id: string) => void
}) {
  const meta = CATEGORY_META[notif.category] ?? CATEGORY_META['GENERAL']!
  const Icon = meta.icon
  const isRead = notif.readAt != null
  const title = extractTitle(notif)
  const body = extractBody(notif)

  return (
    <div
      className={`relative flex gap-3 rounded-2xl border p-4 transition-all ${
        isRead
          ? 'bg-white border-bdr-light opacity-70'
          : 'bg-white border-primary/20 shadow-card animate-bubble-in'
      }`}
    >
      {!isRead && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
      )}

      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-txt-primary leading-tight">{title}</span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${PRIORITY_BADGE[notif.priority] ?? ''}`}
          >
            {notif.priority}
          </span>
        </div>
        {body && <p className="text-[12px] text-txt-secondary mt-0.5 leading-snug line-clamp-2">{body}</p>}
        <div className="text-[11px] text-txt-tertiary mt-1">{fmt(notif.createdAt)}</div>
      </div>

      {/* Mark read */}
      {!isRead && (
        <button
          onClick={() => onRead(notif.id)}
          className="self-start flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 text-txt-tertiary hover:text-primary transition-colors"
          title="Mark as read"
        >
          <CheckCheck className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationCanvas() {
  const { token } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [marking, setMarking] = useState<Set<string>>(new Set())

  const load = useCallback(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    const qs = filter === 'unread' ? '?unreadOnly=true' : ''
    api<NotificationsResponse>(`/api/notifications${qs}`, { token })
      .then((r) => setNotifications(r.notifications))
      .catch((e: { message?: string }) => setError(e.message ?? 'Failed to load notifications'))
      .finally(() => setLoading(false))
  }, [token, filter])

  useEffect(() => {
    load()
  }, [load])

  const handleRead = async (id: string) => {
    if (!token || marking.has(id)) return
    setMarking((s) => new Set([...s, id]))
    try {
      const updated = await api<Notification>(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        token,
      })
      setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)))
    } catch {
      // silent — will retry on next load
    } finally {
      setMarking((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  const handleMarkAllRead = async () => {
    if (!token) return
    const unread = notifications.filter((n) => !n.readAt)
    await Promise.allSettled(unread.map((n) => handleRead(n.id)))
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length

  return (
    <div className="flex flex-col h-full bg-surface-page" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <div className="bg-white border-b border-bdr-light px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-txt-primary">Notifications</h1>
              <div className="text-[12px] text-txt-secondary">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-txt-secondary hover:bg-slate-100 hover:text-txt-primary transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
            <button
              onClick={load}
              className="p-2 rounded-lg hover:bg-slate-100 text-txt-tertiary hover:text-txt-primary transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-4">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                filter === f
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-txt-secondary hover:bg-surface-page hover:text-txt-primary'
              }`}
            >
              {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
            <span className="ml-2 text-[13px] text-txt-secondary">Loading…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <AlertCircle className="w-8 h-8 text-amber-500" />
            <div className="text-[13px] text-txt-secondary">{error}</div>
            <button onClick={load} className="text-[12px] text-primary hover:underline font-semibold">Retry</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Bell className="w-10 h-10 text-slate-300" />
            <div className="text-[13px] text-txt-tertiary">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <NotifCard key={n.id} notif={n} onRead={handleRead} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
