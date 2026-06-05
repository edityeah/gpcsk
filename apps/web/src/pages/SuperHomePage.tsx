/**
 * SuperHomePage — three-pane shell wired to ChatContext.
 *
 *   ┌─────────────┬───────────────────────┬───────────────────────┐
 *   │  Sidebar    │   AskAiPanel (chat)   │   CanvasPanel + Host  │
 *   │  chats +    │   message list +      │   lazy-loaded canvas  │
 *   │  tiles      │   input bar           │   from ChatContext    │
 *   └─────────────┴───────────────────────┴───────────────────────┘
 *
 * Wrapped in <ChatProvider> so every child consumes the same chat state.
 */

import { useState } from 'react'
import { LogOut, Menu, MessageSquare, X } from 'lucide-react'
import { useApp } from '../context/AppContext.js'
import { useAuth } from '../context/AuthContext.js'
import { ChatProvider, useChat } from '../context/ChatContext.js'
import { Sidebar } from '../components/shell/Sidebar.js'
import { AskAiPanel } from '../components/shell/AskAiPanel.js'
import { CanvasHost } from '../canvas/CanvasHost.js'
import Logo from '../components/Logo.js'

export function SuperHomePage() {
  return (
    <ChatProvider>
      <SuperHomeShell />
    </ChatProvider>
  )
}

function SuperHomeShell() {
  const { navigate } = useApp()
  const { user, signOut } = useAuth()
  const [showSidebar, setShowSidebar] = useState(false)

  function handleSignOut() {
    signOut()
    navigate('splash')
  }

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')

  return (
    <div
      className="h-screen flex bg-white overflow-hidden"
      style={{ fontFamily: 'Montserrat, sans-serif' }}
    >
      {/* ── Sidebar (chat history + tiles) ───────────────────────────── */}
      <div
        className={`${
          showSidebar ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden'
        } md:static md:flex`}
      >
        <Sidebar />
        {/* Mobile close button */}
        {showSidebar && (
          <button
            onClick={() => setShowSidebar(false)}
            className="absolute top-3 right-3 md:hidden p-2 rounded-lg bg-white shadow-card"
            title="Close menu"
          >
            <X className="w-4 h-4 text-txt-secondary" />
          </button>
        )}
      </div>
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* ── Main + Canvas ────────────────────────────────────────────── */}
      <main className="relative flex-1 flex flex-col min-w-0 bg-white">
        {/* Top bar */}
        <div className="flex items-center justify-between px-3 md:px-5 py-2.5 border-b border-bdr-light bg-white flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setShowSidebar(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
              title="Menu"
            >
              <Menu className="w-5 h-5 text-txt-secondary" />
            </button>
            <Logo size={28} showText={false} />
            <span className="text-[13px] font-bold text-txt-primary">GPCSK</span>
            {user && (
              <span className="hidden md:inline text-[12px] text-txt-tertiary">
                · {user.role.replace(/_/g, ' ').toLowerCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">
                {initials}
              </div>
              <div className="min-w-0 max-w-[140px]">
                <div className="text-[12px] font-bold text-txt-primary truncate">
                  {user?.name}
                </div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-[12px] text-txt-secondary hover:text-txt-primary px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Centre + right split */}
        <div className="flex-1 flex min-h-0">
          {/* Centre — chat */}
          <div className="flex-1 flex flex-col min-w-0">
            <AskAiPanel />
          </div>

          {/* Right — canvas */}
          <CanvasPane />
        </div>
      </main>
    </div>
  )
}

/**
 * Right-hand canvas pane — reads ChatContext.canvasState and renders
 * <CanvasHost>. Hidden until something is opened; falls back to empty
 * state when explicitly closed.
 */
function CanvasPane() {
  const { canvasState, closeCanvas } = useChat()
  const open = canvasState.module !== null

  // On lg+ the canvas pane is always visible (empty state until opened).
  // On <lg we show it only when a module is actively open.
  return (
    <section
      className={`${
        open ? 'flex' : 'hidden lg:flex'
      } lg:w-[46%] xl:w-[50%] flex-col border-l border-bdr-light bg-surface-secondary min-w-0`}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-bdr-light bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] uppercase tracking-wider text-txt-tertiary font-bold">
            Canvas
          </span>
          {canvasState.module && (
            <span className="text-[12px] text-txt-primary font-semibold truncate">
              · {canvasState.module.replace(/^OPEN_/, '').replace(/_/g, ' ').toLowerCase()}
            </span>
          )}
        </div>
        {open && (
          <button
            onClick={closeCanvas}
            className="p-1.5 rounded-lg hover:bg-surface-secondary"
            title="Close canvas"
          >
            <X className="w-3.5 h-3.5 text-txt-tertiary" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <CanvasHost module={canvasState.module} args={canvasState.args} />
      </div>
    </section>
  )
}
