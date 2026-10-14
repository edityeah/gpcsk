/**
 * CanvasPanel — overlay (default) or expanded (fills the main panel).
 * PM-SETU port.
 *
 * Layout modes:
 *   * Overlay: right-side panel ~820px wide, greeting/chat still visible behind
 *   * Expanded: fills the whole main panel (absolute inset-0)
 *   * Mobile: always full-screen — the overlay would be too cramped
 *
 * Header, left→right: Back · module glyph · title + subtitle · "Ask Saathi"
 * (every screen except Saathi itself) · voice call · Expand/Collapse · Close.
 *
 * The panel is positioned absolutely inside <main> (which is `relative`), so
 * it covers the main area only, never the sidebar.
 */

import { Component, Suspense, useEffect, useState, type ReactNode } from 'react'
import { X, ArrowLeft, Maximize2, Minimize2, Sparkles, Loader2 } from 'lucide-react'
import { useChat, SAATHI_MODULE, type SaathiAbout } from '../context/ChatContext.js'
import { findModule } from '../nlp/moduleRegistry.js'
import { emojiFor } from '../roles/roleConfig.js'
import { CanvasCallButton } from '../components/CanvasCallButton.js'
import { CanvasSaathiProvider, usePublishedSaathi } from './CanvasSaathi.js'

export default function CanvasPanel() {
  const { canvasState, canvasStack, closeCanvas, backCanvas } = useChat()
  const [expanded, setExpanded] = useState(false)
  const open = canvasState.module !== null

  // A freshly opened canvas always starts as the overlay
  useEffect(() => { if (open) setExpanded(false) }, [canvasState.module, open])

  if (!open || !canvasState.module) return null

  const moduleId = canvasState.module
  const entry = findModule(moduleId)
  const args = (canvasState.args ?? {}) as Record<string, unknown>
  const isSaathi = moduleId === SAATHI_MODULE
  const about = isSaathi ? (args['about'] as SaathiAbout | null | undefined) : null

  // A Saathi thread started from a screen shows that screen's name; Back
  // returns to the screen it came from (previous entry on the stack).
  const title = isSaathi && about?.title ? `Saathi · ${about.title}` : (entry?.label.en ?? moduleId.replace(/^OPEN_/, '').replace(/_/g, ' '))
  const subtitle = isSaathi && about?.title ? 'This conversation is saved in your chats' : (entry?.description ?? '')
  const Component = entry?.component ?? null
  const depth = canvasStack.length

  return (
    <>
      {!expanded && (
        <button aria-label="Close canvas" onClick={closeCanvas} className="absolute inset-0 z-30 bg-black/20 md:hidden" />
      )}
      <div
        className={
          expanded
            ? 'absolute inset-0 z-40 bg-white flex flex-col'
            : 'absolute inset-0 md:inset-y-0 md:right-0 md:left-auto md:w-[min(820px,72%)] md:border-l md:border-bdr-strong md:shadow-canvas md:animate-canvas-slide z-40 bg-white flex flex-col'
        }
      >
        <CanvasSaathiProvider key={`${moduleId}:${depth}`}>
          <header className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-3 border-b border-bdr bg-gradient-to-b from-surface-page/50 to-white sticky top-0 z-10">
            <button type="button" onClick={backCanvas} title={depth > 1 ? 'Back' : 'Close'} className="p-1.5 rounded-pill hover:bg-slate-100 flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-txt-secondary" />
            </button>
            <div className="w-9 h-9 rounded bg-primary-light text-primary-dark flex items-center justify-center text-lg flex-shrink-0">
              {emojiFor(moduleId)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] md:text-[15px] font-bold text-txt-primary truncate">{title}</div>
              <div className="text-[11px] md:text-[12px] text-txt-secondary truncate">{subtitle}</div>
            </div>

            {!isSaathi && <AskSaathiHeaderButton moduleId={moduleId} title={title} subtitle={subtitle} />}

            <CanvasCallButton canvasName={moduleId} canvasLabel={title} />

            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              title={expanded ? 'Collapse' : 'Expand'}
              className="hidden md:flex p-1.5 rounded-pill hover:bg-slate-100 flex-shrink-0"
            >
              {expanded ? <Minimize2 className="w-4 h-4 text-txt-secondary" /> : <Maximize2 className="w-4 h-4 text-txt-secondary" />}
            </button>

            <button type="button" onClick={closeCanvas} title="Close" className="p-1.5 rounded-pill hover:bg-slate-100 flex-shrink-0">
              <X className="w-5 h-5 text-txt-secondary" />
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <CanvasErrorBoundary key={`${moduleId}:${depth}`}>
              {Component ? (
                <Suspense fallback={<Loading />}>
                  <Component {...args} />
                </Suspense>
              ) : (
                <NotImplemented id={moduleId} />
              )}
            </CanvasErrorBoundary>
          </div>
        </CanvasSaathiProvider>
      </div>
    </>
  )
}

/** "Ask Saathi" in a screen's header: starts a saved thread that knows what is on this screen. */
function AskSaathiHeaderButton({ moduleId, title, subtitle }: { moduleId: string; title: string; subtitle: string }) {
  const { askSaathi } = useChat()
  const { context, quickAsks } = usePublishedSaathi()
  const about: SaathiAbout = { canvasType: moduleId, title, subtitle, context, quickAsks }
  return (
    <button
      type="button"
      onClick={() => askSaathi({ about })}
      title="Ask Saathi about this screen"
      className="inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-pill bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-[11px] md:text-[12px] shadow-card hover:opacity-90 active:scale-95 transition flex-shrink-0"
    >
      <Sparkles className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Ask Saathi</span>
    </button>
  )
}

function Loading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex items-center gap-2 text-txt-secondary">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[13px]">Loading…</span>
      </div>
    </div>
  )
}

function NotImplemented({ id }: { id: string }) {
  return (
    <div className="p-6 text-sm text-txt-secondary">
      <div className="font-medium text-txt-primary mb-2">This screen is not available yet</div>
      <div>No canvas registered for <code className="px-1 py-0.5 rounded bg-surface-secondary">{id}</code>. Ask Saathi for help, or go back and open another app.</div>
    </div>
  )
}

/** Keeps one broken canvas from unmounting the whole home page. */
class CanvasErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { err: null }
  }
  static getDerivedStateFromError(err: Error) { return { err } }
  override componentDidCatch(err: Error) { console.error('[canvas]', err) }
  override render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="p-6 text-sm">
        <div className="font-bold text-danger mb-1">Something went wrong on this screen</div>
        <pre className="text-[11px] bg-slate-900 text-slate-100 rounded p-3 overflow-auto">{String(this.state.err.message || this.state.err)}</pre>
      </div>
    )
  }
}
