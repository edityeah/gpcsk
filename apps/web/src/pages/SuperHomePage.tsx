/**
 * SuperHomePage — PM-SETU Saathi shell retargeted to GPCSK.
 *
 *  ┌──────────────────────┬──────────────────────────────────────────────┐
 *  │  Sidebar (280px)     │  Main (flex-1, relative)                     │
 *  │  logo                │  Top bar (call pill · Saathi · bell)         │
 *  │  + New chat          │  GreetingPanel: tagline · Hi {name} 👋 ·     │
 *  │  Search chats        │    Talk to Saathi · Headline strip ·         │
 *  │  Today / This week / │    sectioned "Open an app" grid · Try asking │
 *  │    Earlier threads   │  — or ChatThread once a conversation starts  │
 *  │  Profile pill →      │  MessageInput (always visible)               │
 *  │    Switch user       │  CanvasPanel (overlay from the right)        │
 *  └──────────────────────┴──────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Bell, Plus, Search, Sparkles, Send, Mic, Phone, ChevronUp, MessageSquare, Menu } from 'lucide-react'
import { useApp } from '../context/AppContext.js'
import { useAuth } from '../context/AuthContext.js'
import { api } from '../lib/api.js'
import { ChatProvider, useChat, SAATHI_MODULE, type ChatMessage, type ChatThread } from '../context/ChatContext.js'
import { CallProvider, useCall } from '../context/CallProvider.js'
import { CallStatusPill } from '../components/CallStatusPill.js'
import { ChatBubble, TypingDots } from '../components/ChatBubble.js'
import GpcbLogo from '../components/GpcbLogo.js'
import RoleSwitcher from '../components/RoleSwitcher.js'
import HeadlineStrip from '../components/HeadlineStrip.js'
import CanvasPanel from '../canvas/CanvasPanel.js'
import type { ModuleEntry } from '../nlp/moduleRegistry.js'
import { ROLE_LABELS, ROLE_SCOPES, ROLE_TAGLINE, sectionsFor, suggestionsFor, emojiFor, type HomeSection } from '../roles/roleConfig.js'

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

// ── Public export ──────────────────────────────────────────────────────────

export function SuperHomePage() {
  return (
    <ChatProvider>
      <CallProvider>
        <Shell />
      </CallProvider>
    </ChatProvider>
  )
}

// ── Shell ──────────────────────────────────────────────────────────────────

function Shell() {
  const [showSidebar, setShowSidebar] = useState(false)
  const { openCanvas } = useChat()

  return (
    <div className="h-screen flex bg-white overflow-hidden" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <Sidebar showSidebar={showSidebar} onClose={() => setShowSidebar(false)} />
      {showSidebar && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setShowSidebar(false)} />}

      <main className="relative flex-1 flex flex-col min-w-0 bg-white">
        <div className="flex items-center justify-between md:justify-end px-3 md:px-6 py-3 border-b border-bdr bg-gradient-to-b from-surface-page/40 to-white flex-shrink-0">
          <button type="button" onClick={() => setShowSidebar(true)} className="md:hidden p-2 rounded-lg hover:bg-slate-100">
            <Menu className="w-5 h-5 text-txt-secondary" />
          </button>
          <div className="md:hidden"><GpcbLogo size={28} showText={false} /></div>
          <div className="flex items-center gap-2 md:gap-3">
            <CallStatusPill />
            <VoiceQuickButton />
            <button
              type="button"
              onClick={() => openCanvas(SAATHI_MODULE)}
              title="Talk to Saathi"
              className="inline-flex items-center gap-1.5 md:gap-2 pl-2.5 pr-3 md:pl-3 md:pr-4 py-1.5 md:py-2 rounded-pill bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-[11px] md:text-[12px] shadow-card hover:opacity-90 active:scale-95 transition"
            >
              <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Saathi</span>
            </button>
            <BellButton />
          </div>
        </div>

        <ContentArea />
        <CanvasPanel />
      </main>
    </div>
  )
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

function groupThreads(threads: ChatThread[]) {
  const now = Date.now()
  const DAY = 86_400_000
  const age = (t: ChatThread) => now - new Date(t.lastMessageAt).getTime()
  return {
    today:   threads.filter((t) => age(t) < DAY),
    week:    threads.filter((t) => age(t) >= DAY && age(t) < 7 * DAY),
    earlier: threads.filter((t) => age(t) >= 7 * DAY),
  }
}

function Sidebar({ showSidebar, onClose }: { showSidebar: boolean; onClose: () => void }) {
  const { threads, newThread, openThread, canvasState } = useChat()
  const [query, setQuery] = useState('')

  const filtered = threads.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
  const { today, week, earlier } = groupThreads(filtered)
  const activeThreadId = canvasState.module === SAATHI_MODULE ? (canvasState.args?.['threadId'] as string | undefined) : undefined

  function startNewChat() { newThread(); onClose() }
  function pick(t: ChatThread) { openThread(t.id); onClose() }

  return (
    <aside className={`${showSidebar ? 'fixed inset-0 z-40' : 'hidden'} md:flex md:static w-[280px] flex-shrink-0 flex-col border-r border-bdr-strong bg-surface-secondary`}>
      <div className="px-4 pt-5 pb-4 flex items-center justify-center"><LogoBlock /></div>
      <div className="px-4">
        <button type="button" onClick={startNewChat} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-pill bg-primary text-white font-bold text-[14px] shadow-modal active:opacity-80 hover:bg-primary-dark transition">
          <Plus className="w-4 h-4" /> New chat
        </button>
      </div>
      <div className="px-4 mt-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-pill bg-white border border-bdr">
          <Search className="w-3.5 h-3.5 text-txt-tertiary" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-txt-tertiary" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 mt-3 pb-3">
        {threads.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-txt-tertiary leading-relaxed">No conversations yet. Open an app or ask Saathi.</div>
        ) : (
          <>
            <ThreadGroup title="Today" threads={today} activeId={activeThreadId} onPick={pick} />
            <ThreadGroup title="This week" threads={week} activeId={activeThreadId} onPick={pick} />
            <ThreadGroup title="Earlier" threads={earlier} activeId={activeThreadId} onPick={pick} />
          </>
        )}
      </div>
      <div className="p-3 border-t border-bdr"><ProfilePill /></div>
    </aside>
  )
}

function LogoBlock() {
  return (
    <div className="inline-flex items-center gap-2.5">
      <GpcbLogo size={44} showText={false} />
      <div className="flex flex-col leading-none">
        <span className="font-extrabold text-[15px] text-txt-primary" style={{ fontFamily: 'Montserrat, sans-serif' }}>GPCSK Saathi</span>
        <span className="text-[10px] font-medium mt-0.5 text-txt-secondary">Pollution control review centre</span>
      </div>
    </div>
  )
}

function ThreadGroup({ title, threads, activeId, onPick }: { title: string; threads: ChatThread[]; activeId?: string | undefined; onPick: (t: ChatThread) => void }) {
  if (!threads.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary px-2 mb-1">{title}</div>
      {threads.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t)}
          className={`w-full text-left px-3 py-2 rounded-xl text-[13px] flex items-center gap-2 ${activeId === t.id ? 'bg-primary-light text-primary' : 'text-txt-primary hover:bg-surface-page'}`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-txt-tertiary flex-shrink-0" />
          <span className="truncate flex-1">{t.title || 'Conversation'}</span>
        </button>
      ))}
    </div>
  )
}

function ProfilePill() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const initials = (user?.name ?? '?').split(' ').filter((p) => !p.endsWith('.')).map((s) => s[0]).slice(0, 2).join('') || '?'
  const subline = user ? `${ROLE_LABELS[user.role]} · ${ROLE_SCOPES[user.role]}` : ''

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-surface-page">
        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-[13px] font-bold flex-shrink-0">{initials}</div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[13px] font-bold text-txt-primary truncate">{user?.name}</div>
          <div className="text-[11px] text-txt-secondary truncate">{subline}</div>
        </div>
        <ChevronUp className={`w-4 h-4 text-txt-tertiary transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
      {open && <div className="absolute bottom-full mb-2 left-0 right-0 z-10"><RoleSwitcher onClose={() => setOpen(false)} /></div>}
    </div>
  )
}

// ── Top bar buttons ─────────────────────────────────────────────────────────

function VoiceQuickButton() {
  const { startCall, isInCall, isConnecting } = useCall()
  const disabled = isInCall || isConnecting
  return (
    <button
      type="button"
      onClick={() => { void startCall() }}
      disabled={disabled}
      title={disabled ? 'Call in progress' : 'Call Saathi'}
      className="w-10 h-10 rounded-full border border-bdr-light flex items-center justify-center hover:bg-surface-page disabled:opacity-40 transition bg-white"
    >
      <Phone className="w-[17px] h-[17px] text-primary" />
    </button>
  )
}

function BellButton() {
  const { openCanvas } = useChat()
  const { token } = useAuth()
  const [unread, setUnread] = useState(0)

  const fetchCount = useCallback(() => {
    if (!token) return
    api<{ count: number }>('/api/notifications/unread-count', { token })
      .then((r) => setUnread(r.count))
      .catch(() => { /* silent */ })
  }, [token])

  useEffect(() => {
    fetchCount()
    const id = setInterval(fetchCount, 8_000)
    return () => clearInterval(id)
  }, [fetchCount])

  return (
    <button type="button" onClick={() => openCanvas('OPEN_NOTIFICATIONS')} className="relative w-10 h-10 rounded-full hover:bg-surface-page border border-bdr-light flex items-center justify-center">
      <Bell className="w-[18px] h-[18px] text-txt-secondary" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold border-2 border-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}

// ── Content area — greeting or chat thread ─────────────────────────────────

function ContentArea() {
  const { messages, busy, sendMessage } = useChat()
  const greeted = messages.length === 0

  function handleSend(text: string) {
    if (!text.trim() || busy) return
    void sendMessage(text)
  }

  return (
    <>
      {greeted ? <GreetingPanel onSend={handleSend} /> : <ChatThreadView messages={messages} />}
      <MessageInput onSend={handleSend} />
    </>
  )
}

function GreetingPanel({ onSend }: { onSend: (text: string) => void }) {
  const { user } = useAuth()
  const { openCanvas } = useChat()
  const role = user?.role
  const sections = role ? sectionsFor(role) : []
  const chips = suggestionsFor(role)
  const first = user?.name?.split(' ').find((p) => !p.endsWith('.')) ?? 'there'

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-10 pt-6 md:pt-10 pb-6">
        <div className="text-center">
          <div className="text-[12px] font-bold uppercase tracking-[3px] text-primary mb-3">{role ? ROLE_TAGLINE[role] : 'Saathi'}</div>
          <h1 className="text-[26px] md:text-[40px] font-bold text-txt-primary leading-tight">Hi {first} <span aria-hidden>👋</span>,</h1>
          <h2 className="text-[20px] md:text-[32px] font-bold text-txt-primary leading-tight mt-1">what can I help with?</h2>
          {role && <p className="text-[13px] text-txt-secondary mt-3 max-w-2xl mx-auto">{ROLE_LABELS[role]} · {ROLE_SCOPES[role]}</p>}
          <div className="mt-5">
            <button type="button" onClick={() => openCanvas(SAATHI_MODULE)} className="inline-flex items-center gap-2.5 px-6 py-3 rounded-pill bg-primary text-white font-bold text-[15px] shadow-modal hover:opacity-90 active:scale-95 transition">
              <Phone className="w-4 h-4" /> Talk to Saathi
            </button>
          </div>
        </div>

        <HeadlineStrip />

        <SectionedGrid sections={sections} onPick={(m) => openCanvas(m.id)} />

        {chips.length > 0 && (
          <div className="mt-10">
            <div className="text-[11px] uppercase tracking-wider font-bold text-txt-tertiary mb-2">Try asking</div>
            <div className="flex flex-wrap gap-2">
              {chips.slice(0, 5).map((c, i) => (
                <button key={i} type="button" onClick={() => onSend(c)} className="px-3.5 py-2 rounded-pill bg-surface-page hover:bg-primary-light border border-bdr-light text-[13px] text-txt-primary">{c}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionedGrid({ sections, onPick }: { sections: HomeSection[]; onPick: (m: ModuleEntry) => void }) {
  if (!sections.length) return null
  return (
    <div className="mt-8 space-y-5">
      {sections.map((s) => (
        <section key={s.key} className={`rounded-2xl bg-gradient-to-br ${s.accent} border border-bdr-light ring-1 ${s.ring}/40 p-4`}>
          <div className="mb-3">
            <div className="text-[13px] font-bold text-txt-primary inline-flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.title}</div>
            <div className="text-[12px] text-txt-secondary mt-0.5">{s.subtitle}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {s.tiles.map((m) => <FeatureCard key={m.id} module={m} onClick={() => onPick(m)} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

function FeatureCard({ module: m, onClick }: { module: ModuleEntry; onClick: () => void }) {
  const t = TONES[m.tone] ?? TONES['indigo']!
  return (
    <button type="button" onClick={onClick} className={`text-left rounded-2xl bg-white border border-bdr-light p-4 transition-all hover:shadow-card ${t.ring}`}>
      <div className={`w-11 h-11 rounded-2xl ${t.bg} ${t.fg} flex items-center justify-center text-[20px] mb-3`}>{emojiFor(m.id)}</div>
      <div className="font-bold text-[14px] text-txt-primary leading-tight">{m.label.en}</div>
      <p className="text-[12px] text-txt-secondary leading-snug mt-1 line-clamp-2">{m.description}</p>
    </button>
  )
}

function ChatThreadView({ messages }: { messages: ChatMessage[] }) {
  const { busy, openCanvas } = useChat()
  const listRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [messages.length, busy])
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
            onOpenCanvas={(mod) => openCanvas(mod)}
          />
        ))}
        {busy && <div className="flex justify-start"><TypingDots /></div>}
      </div>
    </div>
  )
}

function MessageInput({ onSend }: { onSend: (text: string) => void }) {
  const [v, setV] = useState('')
  const { busy } = useChat()
  const { startCall, isInCall, isConnecting } = useCall()

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
          <button type="button" onClick={() => { void startCall() }} disabled={isInCall || isConnecting} title="Speak to Saathi" className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center flex-shrink-0 disabled:opacity-40">
            <Mic className="w-4 h-4 text-primary" />
          </button>
          <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Message Saathi…" disabled={busy} className="flex-1 bg-transparent text-[14px] py-1.5 outline-none placeholder:text-txt-tertiary disabled:text-txt-tertiary" />
          <button type="submit" disabled={!v.trim() || busy} className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 disabled:bg-slate-300">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="text-center text-[11px] text-txt-tertiary mt-2">Voice · English · ગુજરાતી · हिन्दी</div>
      </form>
    </div>
  )
}
