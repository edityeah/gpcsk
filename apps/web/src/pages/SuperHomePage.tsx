/**
 * SuperHomePage — KSK-style two-column shell retargeted to GPCSK.
 *
 *  ┌──────────────────────┬──────────────────────────────────────────────┐
 *  │  Sidebar (280px)     │  Main (flex-1)                               │
 *  │  logo                │  TopBar (Saathi pill + Bell)                 │
 *  │  + New chat          │  GreetingPanel OR ChatThread                 │
 *  │  Search              │  MessageInput (always visible)               │
 *  │  Chat history groups │  CanvasOverlay (slides in from right)        │
 *  │  Profile pill bottom │                                              │
 *  └──────────────────────┴──────────────────────────────────────────────┘
 */

import { useEffect, useRef, useState, useCallback, type FormEvent } from 'react'
import * as Lucide from 'lucide-react'
import type { ComponentType } from 'react'
import {
  Bell,
  Plus,
  Search,
  Sparkles,
  Send,
  Mic,
  Phone,
  ChevronUp,
  MessageSquare,
  Menu,
  ArrowLeft,
  X,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Suspense } from 'react'
import { useApp } from '../context/AppContext.js'
import { useAuth } from '../context/AuthContext.js'
import { api } from '../lib/api.js'
import { ChatProvider, useChat } from '../context/ChatContext.js'
import { ChatBubble, TypingDots } from '../components/ChatBubble.js'
import GpcbLogo from '../components/GpcbLogo.js'
import { modulesForRole, findModule, suggestedPromptsFor } from '../nlp/moduleRegistry.js'
import type { ModuleEntry } from '../nlp/moduleRegistry.js'
import { CanvasSaathiSplit } from '../canvas/CanvasSaathiSplit.js'

// ── Design tokens ──────────────────────────────────────────────────────────

const TONES: Record<string, { bg: string; fg: string; ring: string }> = {
  indigo:  { bg: 'bg-indigo-100',  fg: 'text-indigo-600',  ring: 'hover:border-indigo-300' },
  emerald: { bg: 'bg-emerald-100', fg: 'text-emerald-600', ring: 'hover:border-emerald-300' },
  amber:   { bg: 'bg-amber-100',   fg: 'text-amber-600',   ring: 'hover:border-amber-300' },
  sky:     { bg: 'bg-sky-100',     fg: 'text-sky-600',     ring: 'hover:border-sky-300' },
  rose:    { bg: 'bg-rose-100',    fg: 'text-rose-600',    ring: 'hover:border-rose-300' },
  violet:  { bg: 'bg-violet-100',  fg: 'text-violet-600',  ring: 'hover:border-violet-300' },
  orange:  { bg: 'bg-orange-100',  fg: 'text-orange-600',  ring: 'hover:border-orange-300' },
  teal:    { bg: 'bg-teal-100',    fg: 'text-teal-600',    ring: 'hover:border-teal-300' },
  fuchsia: { bg: 'bg-fuchsia-100', fg: 'text-fuchsia-600', ring: 'hover:border-fuchsia-300' },
  lime:    { bg: 'bg-lime-100',    fg: 'text-lime-700',    ring: 'hover:border-lime-300' },
  cyan:    { bg: 'bg-cyan-100',    fg: 'text-cyan-600',    ring: 'hover:border-cyan-300' },
  pink:    { bg: 'bg-pink-100',    fg: 'text-pink-600',    ring: 'hover:border-pink-300' },
  slate:   { bg: 'bg-slate-100',   fg: 'text-slate-600',   ring: 'hover:border-slate-300' },
}

// ── Role-specific suggestions ──────────────────────────────────────────────

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  SENIOR_REVIEWER: [
    'Show me Gujarat Pulse',
    'Top polluters in Ankleshwar',
    "What's the BOD norm for CETPs?",
    'Pending approvals',
  ],
  CONSENT_OFFICER: [
    'Renewals due next 30 days',
    'Industries waiting for consent',
    'What documents need a CTO?',
  ],
  MONITORING_OFFICER: [
    "Today's OCEMS exceedances",
    'AAQM stations in Vapi',
    'CETP scorecard for Naroda',
  ],
  INSPECTION_ENFORCEMENT_OFFICER: [
    'Top inspection priorities',
    'Draft a show-cause for Vatva Chemicals',
    'Open violations register',
  ],
  COMPLAINTS_OFFICER: [
    'Complaint hotspots this week',
    "Triage today's complaints",
    'Reply to citizen X',
  ],
}

// ── Icon resolver ──────────────────────────────────────────────────────────

type IconProps = { className?: string }
type IconComponent = ComponentType<IconProps>

function iconByName(name: string): IconComponent {
  const lib = Lucide as unknown as Record<string, IconComponent>
  return lib[name] ?? (lib['LayoutDashboard'] as IconComponent)
}

// ── Thread time groups ─────────────────────────────────────────────────────

interface ChatThread { id: string; title: string; lastMessageAt: string }

function groupThreads(threads: ChatThread[]) {
  const now = Date.now()
  const DAY  = 24 * 60 * 60 * 1000
  const WEEK = 7 * DAY
  return {
    thisWeek: threads.filter((t) => {
      const d = now - new Date(t.lastMessageAt).getTime()
      return d < WEEK
    }),
    earlier: threads.filter((t) => {
      const d = now - new Date(t.lastMessageAt).getTime()
      return d >= WEEK
    }),
  }
}

// ── Public export ──────────────────────────────────────────────────────────

export function SuperHomePage() {
  return (
    <ChatProvider>
      <Shell />
    </ChatProvider>
  )
}

// ── Shell ──────────────────────────────────────────────────────────────────

function Shell() {
  const [showSidebar, setShowSidebar] = useState(false)

  return (
    <div className="h-screen flex bg-white overflow-hidden" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Sidebar */}
      <Sidebar
        showSidebar={showSidebar}
        onClose={() => setShowSidebar(false)}
      />
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Main — relative so CanvasOverlay is scoped to this area only */}
      <main className="relative flex-1 flex flex-col min-w-0 bg-white">
        {/* Top header bar — right-aligned only */}
        <div className="flex items-center justify-between md:justify-end px-3 md:px-6 py-3 border-b border-bdr-strong bg-gradient-to-b from-surface-page/40 to-white flex-shrink-0">
          <button
            onClick={() => setShowSidebar(true)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100"
          >
            <Menu className="w-5 h-5 text-txt-secondary" />
          </button>
          <div className="flex items-center gap-2 md:gap-3">
            <SaathiQuickButton />
            <BellButton />
          </div>
        </div>

        {/* Content area */}
        <ContentArea />

        {/* War Room floating pill — visible only for SENIOR_REVIEWER */}
        <WarRoomPill />

        {/* Canvas overlay — absolute, scoped to main */}
        <CanvasOverlay />
      </main>
    </div>
  )
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  showSidebar: boolean
  onClose: () => void
}

function Sidebar({ showSidebar, onClose }: SidebarProps) {
  const { threads, currentThread, newThread, openThread } = useChat()
  const [query, setQuery] = useState('')

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(query.toLowerCase()),
  )
  const { thisWeek, earlier } = groupThreads(filteredThreads)

  function handleNewChat() {
    newThread()
    onClose()
  }

  function handleOpenThread(t: ChatThread) {
    openThread(t.id)
    onClose()
  }

  return (
    <aside
      className={`${
        showSidebar ? 'fixed inset-0 z-40' : 'hidden'
      } md:flex md:static w-[280px] flex-shrink-0 flex-col border-r border-bdr-strong bg-surface-secondary shadow-[1px_0_0_0_rgba(15,23,42,0.04)]`}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-center">
        <GpcskLogoBlock />
      </div>

      {/* + New chat */}
      <div className="px-4">
        <button
          type="button"
          onClick={handleNewChat}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-pill bg-primary text-white font-bold text-[14px] shadow-modal active:opacity-80 hover:bg-primary-dark transition"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mt-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-pill bg-white border border-bdr">
          <Search className="w-3.5 h-3.5 text-txt-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-txt-tertiary"
          />
        </div>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-3 mt-3 pb-3">
        {threads.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-txt-tertiary leading-relaxed">
            No conversations yet. Ask Saathi anything to begin.
          </div>
        ) : (
          <>
            <ThreadGroup
              title="This week"
              threads={thisWeek}
              currentId={currentThread?.id}
              onPick={handleOpenThread}
            />
            <ThreadGroup
              title="Earlier"
              threads={earlier}
              currentId={currentThread?.id}
              onPick={handleOpenThread}
            />
          </>
        )}
      </div>

      {/* Profile pill */}
      <div className="p-3 border-t border-bdr">
        <ProfilePill />
      </div>
    </aside>
  )
}

// ── GPCSK Logo block ───────────────────────────────────────────────────────

function GpcskLogoBlock() {
  return (
    <div className="flex flex-col items-center gap-1 h-16 justify-center">
      <GpcbLogo size={36} showText={false} />
      <div
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: '-0.3px',
          color: '#1F66B4',
          lineHeight: 1,
        }}
      >
        GPCSK
      </div>
      <div
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontSize: 9,
          color: '#64748b',
          letterSpacing: '0.02em',
          textAlign: 'center',
        }}
      >
        Samiksha Kendra
      </div>
    </div>
  )
}

// ── Thread group ───────────────────────────────────────────────────────────

interface ThreadGroupProps {
  title: string
  threads: ChatThread[]
  currentId?: string
  onPick: (t: ChatThread) => void
}

function ThreadGroup({ title, threads, currentId, onPick }: ThreadGroupProps) {
  if (!threads.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary px-2 mb-1">
        {title}
      </div>
      {threads.map((t) => {
        const active = currentId === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className={`w-full text-left px-3 py-2 rounded-xl text-[13px] flex items-center gap-2 transition ${
              active
                ? 'bg-primary-light text-primary'
                : 'text-txt-primary hover:bg-surface-page'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-txt-tertiary flex-shrink-0" />
            <span className="truncate flex-1">{t.title || 'Conversation'}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Profile pill ───────────────────────────────────────────────────────────

function ProfilePill() {
  const { user } = useAuth()
  const { navigate } = useApp()
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')

  const roleLabel =
    user?.role
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) ?? ''

  function handleSignOut() {
    signOut()
    navigate('login')
    setOpen(false)
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-surface-page transition"
      >
        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-[13px] font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[13px] font-bold text-txt-primary truncate">{user?.name}</div>
          <div className="text-[11px] text-txt-secondary truncate">{roleLabel}</div>
        </div>
        <ChevronUp
          className={`w-4 h-4 text-txt-tertiary transition-transform ${open ? '' : 'rotate-180'}`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 right-0 z-10 bg-white border border-bdr rounded-2xl shadow-modal overflow-hidden">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-txt-primary hover:bg-surface-page transition"
          >
            <Lucide.LogOut className="w-4 h-4 text-txt-tertiary" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ── Saathi quick button ────────────────────────────────────────────────────

function SaathiQuickButton() {
  const { newThread, closeCanvas } = useChat()
  return (
    <button
      type="button"
      onClick={() => { closeCanvas?.(); newThread?.() }}
      title="New conversation with Saathi"
      className="inline-flex items-center gap-1.5 md:gap-2 pl-2.5 pr-3 md:pl-3 md:pr-4 py-1.5 md:py-2 rounded-pill bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-[11px] md:text-[12px] shadow-card hover:opacity-90 active:scale-95 transition"
    >
      <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" />
      <span className="hidden sm:inline">Saathi</span>
    </button>
  )
}

// ── Bell button ────────────────────────────────────────────────────────────

function BellButton() {
  const { openCanvas } = useChat()
  const { token } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchCount = useCallback(() => {
    if (!token) return
    api<{ count: number }>('/api/notifications/unread-count', { token })
      .then(r => setUnreadCount(r.count))
      .catch(() => {/* silent */})
  }, [token])

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 60_000)
    return () => clearInterval(interval)
  }, [fetchCount])

  return (
    <button
      type="button"
      onClick={() => openCanvas('OPEN_NOTIFICATIONS')}
      className="relative w-10 h-10 rounded-full hover:bg-surface-page border border-bdr-light flex items-center justify-center transition"
    >
      <Bell className="w-[18px] h-[18px] text-txt-secondary" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

// ── Content area — greeting or chat thread ─────────────────────────────────

function ContentArea() {
  const { messages, busy, sendMessage, canvasState } = useChat()
  const { user } = useAuth()
  const { showToast } = useApp()

  // Only show messages that were NOT sent from inside a canvas in the main chat thread.
  const mainChatMessages = messages.filter((m) => !(m as { canvasContext?: string }).canvasContext)

  const greetedView = mainChatMessages.length === 0 && !canvasState.module
  const role = user?.role ?? 'SENIOR_REVIEWER'
  const chips = SUGGESTIONS_BY_ROLE[role] ?? []

  // Modules for this role, excluding shared contextual ones
  const HIDDEN_FROM_GRID = new Set(['OPEN_INDUSTRY_DEEP_DIVE', 'OPEN_NOTIFICATIONS', 'OPEN_REPORT_EXPORT'])
  const modules: ModuleEntry[] = user
    ? modulesForRole(user.role).filter((m) => !HIDDEN_FROM_GRID.has(m.id))
    : []

  function handleSend(text: string) {
    if (!text.trim() || busy) return
    void sendMessage(text)
  }

  function handleVoice() {
    showToast({ kind: 'info', text: 'Voice coming soon' })
  }

  return (
    <>
      {greetedView ? (
        <GreetingPanel
          modules={modules}
          chips={chips}
          onSend={handleSend}
          onVoice={handleVoice}
        />
      ) : (
        <ChatThread messages={mainChatMessages} />
      )}
      <MessageInput onSend={handleSend} />
    </>
  )
}

// ── Greeting panel ─────────────────────────────────────────────────────────

interface GreetingPanelProps {
  modules: ModuleEntry[]
  chips: string[]
  onSend: (text: string) => void
  onVoice: () => void
}

function GreetingPanel({ modules, chips, onSend, onVoice }: GreetingPanelProps) {
  const { user } = useAuth()
  const { openCanvas } = useChat()
  // For names like "Dr. K. Trivedi" we want "Dr. Trivedi" — skip middle initials.
  // For "Anjali Patel" we want just "Anjali". Honorific is anything ending in "."
  const greetingName = (() => {
    const full = user?.name?.trim() ?? ''
    if (!full) return 'there'
    const parts = full.split(/\s+/)
    const hasHonorific = parts[0]?.endsWith('.')
    if (hasHonorific && parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1]}`  // "Dr. Trivedi"
    }
    return parts[0] ?? full  // "Anjali"
  })()

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-10 pt-6 md:pt-10 pb-6">
        {/* Greeting */}
        <div className="text-center">
          <div className="text-[12px] font-bold uppercase tracking-[3px] text-primary mb-3">
            SAATHI · YOUR POLLUTION OVERSIGHT COMPANION
          </div>
          <h1 className="text-[26px] md:text-[42px] font-bold text-txt-primary leading-tight">
            Namaste, {greetingName} <span aria-hidden>👋</span>
          </h1>
          <h2 className="text-[22px] md:text-[36px] font-bold text-txt-primary leading-tight mt-1">
            what can I help with?
          </h2>
          <p className="text-[14px] text-txt-secondary mt-3 max-w-2xl mx-auto">
            Ask me about pollution data, exceedances, complaints, consent
            applications, enforcement actions… I open dashboards, draft notices,
            and route you to the right action.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={onVoice}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-pill bg-primary text-white font-bold text-[15px] shadow-modal hover:opacity-90 active:scale-95 transition"
            >
              <Phone className="w-4 h-4" />
              Talk to Saathi
            </button>
          </div>
        </div>

        {/* OPEN AN APP */}
        {modules.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <div className="text-[12px] font-bold uppercase tracking-[2px] text-primary">
                Open an App
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {modules.map((m) => (
                <FeatureCard
                  key={m.id}
                  module={m}
                  onClick={() => openCanvas(m.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Try asking */}
        {chips.length > 0 && (
          <div className="mt-10">
            <div className="text-[11px] uppercase tracking-wider font-bold text-txt-tertiary mb-2">
              Try asking
            </div>
            <div className="flex flex-wrap gap-2">
              {chips.slice(0, 5).map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSend(c)}
                  className="px-3.5 py-2 rounded-pill bg-surface-page hover:bg-primary-light border border-bdr-light text-[13px] text-txt-primary transition"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Feature card ───────────────────────────────────────────────────────────

interface FeatureCardProps {
  module: ModuleEntry
  onClick: () => void
}

function FeatureCard({ module: m, onClick }: FeatureCardProps) {
  const tone = m.tone ?? 'indigo'
  const t = TONES[tone] ?? TONES['indigo']!
  const Icon = iconByName(m.icon)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl bg-white border border-bdr-light p-4 transition-all hover:shadow-card ${t.ring} group`}
    >
      <div
        className={`w-11 h-11 rounded-2xl ${t.bg} ${t.fg} flex items-center justify-center mb-3`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="font-bold text-[14px] text-txt-primary leading-tight">
        {m.label.en}
      </div>
      <p className="text-[12px] text-txt-secondary leading-snug mt-1 line-clamp-2">
        {m.description ?? ''}
      </p>
    </button>
  )
}

// ── Chat thread ────────────────────────────────────────────────────────────

import type { ChatMessage } from '../context/ChatContext.js'

interface ChatThreadProps {
  messages: ChatMessage[]
}

function ChatThread({ messages }: ChatThreadProps) {
  const { busy, openCanvas } = useChat()
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, busy])

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-8 flex flex-col gap-3">
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            role={m.role}
            content={m.content}
            citations={m.role === 'assistant' && m.kind === 'answer' ? m.citations : undefined}
            chartSpec={m.role === 'assistant' && m.kind === 'chart' ? m.spec : undefined}
            onOpenCanvas={(module) => openCanvas(module)}
          />
        ))}
        {busy && (
          <div className="flex justify-start">
            <TypingDots />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Message input ──────────────────────────────────────────────────────────

interface MessageInputProps {
  onSend: (text: string) => void
}

function MessageInput({ onSend }: MessageInputProps) {
  const [v, setV] = useState('')
  const { busy } = useChat()

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = v.trim()
    if (!t || busy) return
    setV('')
    onSend(t)
  }

  return (
    <div className="flex-shrink-0 border-t border-bdr bg-gradient-to-t from-surface-page/40 to-white px-4 md:px-10 py-4">
      <form onSubmit={submit} className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 rounded-pill border border-bdr bg-white px-2 py-1.5 shadow-card">
          <button
            type="button"
            className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center flex-shrink-0"
            title="Voice (coming soon)"
          >
            <Mic className="w-4 h-4 text-primary" />
          </button>
          <input
            value={v}
            onChange={(e) => setV(e.target.value)}
            placeholder="Message Saathi…"
            disabled={busy}
            className="flex-1 bg-transparent text-[14px] py-1.5 outline-none placeholder:text-txt-tertiary disabled:text-txt-tertiary"
          />
          <button
            type="submit"
            disabled={!v.trim() || busy}
            className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 disabled:bg-slate-300 transition"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="text-center text-[11px] text-txt-tertiary mt-2">
          English · ગુજરાતી · हिन्दी
        </div>
      </form>
    </div>
  )
}

// ── War Room floating pill (Senior Reviewer only) ─────────────────────────

function WarRoomPill() {
  const { user } = useAuth()
  const { openCanvas } = useChat()

  if (user?.role !== 'SENIOR_REVIEWER') return null

  return (
    <button
      type="button"
      onClick={() => openCanvas('OPEN_WAR_ROOM')}
      className="fixed bottom-24 right-6 z-10 inline-flex items-center gap-2 px-4 py-2.5 rounded-pill bg-rose-600 text-white font-bold text-[13px] shadow-modal hover:bg-rose-700 active:scale-95 transition-all"
    >
      <Lucide.ShieldAlert className="w-4 h-4" />
      War Room
    </button>
  )
}

// ── Canvas overlay ─────────────────────────────────────────────────────────

function CanvasOverlay() {
  const { canvasState, closeCanvas } = useChat()
  const [expanded, setExpanded] = useState(false)
  const open = canvasState.module !== null

  // Reset to half-width whenever a new canvas opens
  useEffect(() => {
    if (open) setExpanded(false)
  }, [canvasState.module, open])

  const entry = canvasState.module ? findModule(canvasState.module) : null
  const title =
    entry?.label.en ??
    (canvasState.module
      ? canvasState.module.replace(/^OPEN_/, '').replace(/_/g, ' ').toLowerCase()
      : 'Canvas')

  if (!open) return null

  const Component = entry?.component ?? null
  const passProps = (canvasState.args ?? {}) as Record<string, unknown>

  return (
    <div
      className={`absolute right-0 top-0 bottom-0 z-20 flex flex-col bg-white shadow-canvas animate-canvas-slide ${
        expanded ? 'w-full' : 'w-full md:w-3/5'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-bdr-light bg-white flex-shrink-0">
        <button
          type="button"
          onClick={closeCanvas}
          className="w-9 h-9 rounded-xl hover:bg-surface-secondary flex items-center justify-center transition"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4 text-txt-secondary" />
        </button>
        <span className="flex-1 text-[14px] font-bold text-txt-primary truncate">{title}</span>
        {/* Maximize / Minimize toggle */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-9 h-9 rounded-xl hover:bg-surface-secondary flex items-center justify-center transition"
          title={expanded ? 'Restore' : 'Maximize'}
        >
          {expanded
            ? <Minimize2 className="w-4 h-4 text-txt-secondary" />
            : <Maximize2 className="w-4 h-4 text-txt-secondary" />
          }
        </button>
        <button
          type="button"
          onClick={closeCanvas}
          className="w-9 h-9 rounded-xl hover:bg-surface-secondary flex items-center justify-center transition"
          title="Close"
        >
          <X className="w-4 h-4 text-txt-tertiary" />
        </button>
      </div>

      {/* Canvas content — wrapped in CanvasSaathiSplit for the embedded chat panel */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <CanvasSaathiSplit
          module={canvasState.module!}
          suggestedPrompts={suggestedPromptsFor(canvasState.module!)}
        >
          {Component ? (
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center">
                  <div className="flex items-center gap-2 text-txt-secondary">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-[13px]">Loading…</span>
                  </div>
                </div>
              }
            >
              <Component {...passProps} />
            </Suspense>
          ) : (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center max-w-sm">
                <div className="text-[14px] font-bold text-danger mb-2">
                  Unknown canvas module
                </div>
                <div className="text-[12px] text-txt-secondary">
                  No canvas registered for{' '}
                  <code className="px-1 py-0.5 rounded bg-surface-secondary">
                    {canvasState.module}
                  </code>
                  .
                </div>
              </div>
            </div>
          )}
        </CanvasSaathiSplit>
      </div>
    </div>
  )
}
