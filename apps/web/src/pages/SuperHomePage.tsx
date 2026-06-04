// GPCSK Home — KSK shell layout.
// Sidebar with search + chat history. Main panel: greeting, feature cards (slice 2+ placeholders),
// and chat input. Mobile collapses sidebar to hamburger.

import { useState } from 'react'
import { Bell, LogOut, Plus, Search, Send, Mic, Menu, MessageSquare } from 'lucide-react'
import { useApp } from '../context/AppContext.js'
import { useAuth } from '../context/AuthContext.js'
import Logo from '../components/Logo.js'

const PLACEHOLDER_CARDS = [
  { id: 'consent',       icon: '📋', title: 'Consent Management',        desc: 'Applications, renewals, compliance decisions.',    tone: 'indigo'  },
  { id: 'monitoring',    icon: '📡', title: 'Ambient Monitoring',         desc: 'AAQM stations, OCEMS feeds, exceedance alerts.',   tone: 'sky'     },
  { id: 'enforcement',   icon: '⚖️', title: 'Inspection & Enforcement',   desc: 'Site inspections, directives, closure notices.',   tone: 'amber'   },
  { id: 'complaints',    icon: '📣', title: 'Complaints',                 desc: 'Public complaints, investigation, resolution.',   tone: 'rose'    },
]

type Tone = 'indigo' | 'sky' | 'amber' | 'rose'
const TONES: Record<Tone, { bg: string; fg: string; ring: string }> = {
  indigo:  { bg: 'bg-indigo-100',  fg: 'text-indigo-600',  ring: 'hover:border-indigo-300' },
  sky:     { bg: 'bg-sky-100',     fg: 'text-sky-600',     ring: 'hover:border-sky-300' },
  amber:   { bg: 'bg-amber-100',   fg: 'text-amber-600',   ring: 'hover:border-amber-300' },
  rose:    { bg: 'bg-rose-100',    fg: 'text-rose-600',    ring: 'hover:border-rose-300' },
}

export function SuperHomePage() {
  const { navigate, showToast } = useApp()
  const { user, signOut } = useAuth()
  const [showSidebar, setShowSidebar] = useState(false)
  const [input, setInput] = useState('')

  const first = user?.name?.split(' ')[0] ?? 'there'
  const initials = (user?.name ?? '?').split(' ').map((s: string) => s[0]).slice(0, 2).join('')

  function handleSignOut() {
    signOut()
    navigate('splash')
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    showToast({ kind: 'info', text: 'AI chat coming in slice 2.' })
    setInput('')
  }

  return (
    <div className="h-screen flex bg-white overflow-hidden" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Sidebar */}
      <aside className={`${showSidebar ? 'fixed inset-0 z-40' : 'hidden'} md:flex md:static w-[280px] flex-shrink-0 flex-col border-r border-bdr-strong bg-surface-secondary`}>
        <div className="px-4 pt-5 pb-4 flex items-center justify-center">
          <Logo size={52} showText={true} />
        </div>

        <div className="px-4">
          <button
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-pill bg-primary text-white font-bold text-[14px] shadow-modal active:opacity-80">
            <Plus className="w-4 h-4" /> New chat
          </button>
        </div>

        <div className="px-4 mt-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-pill bg-white border border-bdr">
            <Search className="w-3.5 h-3.5 text-txt-tertiary" />
            <input placeholder="Search chats" className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-txt-tertiary" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 mt-3 pb-3">
          <div className="px-3 py-4 text-[11px] text-txt-tertiary leading-relaxed">
            No conversations yet. Start one by opening a module or typing a message.
          </div>
        </div>

        <div className="p-3 border-t border-bdr">
          <div className="flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-surface-page cursor-pointer" onClick={handleSignOut}>
            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-[13px] font-bold flex-shrink-0">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-txt-primary truncate">{user?.name}</div>
              <div className="text-[11px] text-txt-secondary truncate">{user?.role?.replace(/_/g, ' ')}</div>
            </div>
            <LogOut className="w-4 h-4 text-txt-tertiary" />
          </div>
        </div>
      </aside>
      {showSidebar && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setShowSidebar(false)} />}

      {/* Main */}
      <main className="relative flex-1 flex flex-col min-w-0 bg-white">
        <div className="flex items-center justify-between md:justify-end px-3 md:px-6 py-3 border-b border-bdr bg-gradient-to-b from-surface-page/40 to-white flex-shrink-0">
          <button onClick={() => setShowSidebar(true)} className="md:hidden p-2 rounded-lg hover:bg-slate-100">
            <Menu className="w-5 h-5 text-txt-secondary" />
          </button>
          <button onClick={handleSignOut} className="flex items-center gap-2 text-[12px] text-txt-secondary hover:text-txt-primary px-3 py-1.5 rounded-lg hover:bg-slate-100">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-10 pt-6 md:pt-10 pb-6">
            <div className="text-center">
              <div className="text-[12px] font-bold uppercase tracking-[3px] text-primary mb-3">Saathi · Your GPCSK companion</div>
              <h1 className="text-[26px] md:text-[42px] font-bold text-txt-primary leading-tight">
                Namaste, {first} <span aria-hidden>👋</span>,
              </h1>
              <h2 className="text-[22px] md:text-[36px] font-bold text-txt-primary leading-tight mt-1">
                what can I help with?
              </h2>
              <p className="text-[14px] text-txt-secondary mt-3 max-w-2xl mx-auto">
                Type below or open an app. Saathi helps with consent tracking, inspection reports, complaints and ambient monitoring — all over SwiftChat.
              </p>
            </div>

            <div className="mt-12">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-4 h-4 text-primary" />
                <div className="text-[12px] font-bold uppercase tracking-[2px] text-primary">Open an app</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PLACEHOLDER_CARDS.map(card => {
                  const t = TONES[card.tone as Tone] ?? TONES.indigo
                  return (
                    <button key={card.id} onClick={() => showToast({ kind: 'info', text: `${card.title} coming in slice 2.` })}
                      className={`text-left rounded-2xl bg-white border border-bdr-light p-4 transition-all hover:shadow-card ${t.ring} group`}>
                      <div className={`w-11 h-11 rounded-2xl ${t.bg} ${t.fg} flex items-center justify-center text-[20px] mb-3`}>
                        {card.icon}
                      </div>
                      <div className="font-bold text-[14px] text-txt-primary leading-tight">{card.title}</div>
                      <p className="text-[12px] text-txt-secondary leading-snug mt-1 line-clamp-2">{card.desc}</p>
                      <div className="mt-2 text-[10px] font-bold text-txt-tertiary uppercase tracking-wider">Slice 2</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Chat input */}
        <div className="flex-shrink-0 border-t border-bdr bg-gradient-to-t from-surface-page/40 to-white px-4 md:px-10 py-4">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2.5 rounded-pill border border-bdr bg-white px-2 py-1.5 shadow-card">
              <button type="button" className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center flex-shrink-0">
                <Mic className="w-4 h-4 text-primary" />
              </button>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Message Saathi…"
                className="flex-1 bg-transparent text-[14px] py-1.5 outline-none placeholder:text-txt-tertiary"
              />
              <button type="submit" disabled={!input.trim()}
                className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 disabled:bg-slate-300">
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center text-[11px] text-txt-tertiary mt-2">
              English · ગુજરાતી · हिन्दी
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
