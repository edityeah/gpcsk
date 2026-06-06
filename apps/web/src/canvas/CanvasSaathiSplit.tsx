/**
 * CanvasSaathiSplit — Vertically resizable split layout for GPCSK canvases.
 *
 * Layout:
 *  ┌─────────────────────────────────────┐
 *  │  Top pane (canvas content) — flex   │
 *  ├─────── drag handle (6px) ───────────┤
 *  │  Bottom pane (Saathi chat panel)    │
 *  └─────────────────────────────────────┘
 *
 * The split ratio is stored in state (default 60/40). Drag the handle to
 * resize between 30% and 80% for the top pane.
 */

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { GripHorizontal, Mic, Send, Sparkles } from 'lucide-react'
import { useChat } from '../context/ChatContext.js'
import { ChatBubble, TypingDots } from '../components/ChatBubble.js'

// ── Props ──────────────────────────────────────────────────────────────────────

interface CanvasSaathiSplitProps {
  /** The dashboard content rendered in the top pane. */
  children: ReactNode
  /** Canvas module id, e.g. 'OPEN_WAR_ROOM'. Used to scope messages. */
  module: string
  /** 3-5 starter prompts shown as clickable chips in the bottom panel. */
  suggestedPrompts: string[]
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CanvasSaathiSplit({ children, module, suggestedPrompts }: CanvasSaathiSplitProps) {
  const { messages, busy, sendMessage, canvasState, openCanvas } = useChat()
  const [ratio, setRatio] = useState(0.6)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)

  // ── Drag logic ─────────────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newRatio = (e.clientY - rect.top) / rect.height
    setRatio(Math.min(0.8, Math.max(0.3, newRatio)))
  }, [])

  const handlePointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  useEffect(() => {
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  // ── Canvas-scoped messages ─────────────────────────────────────────────────
  // Show the last 6 messages that have canvasContext matching this module.
  // Fall back to the latest 4 thread messages if no canvas-tagged messages exist.

  const canvasMessages = (() => {
    const tagged = messages.filter((m) => {
      if (m.role === 'user') {
        return (m as { canvasContext?: string }).canvasContext === module
      }
      return false
    })
    if (tagged.length > 0) {
      // Show the tagged user messages + all assistant messages after them
      const firstTaggedIdx = messages.indexOf(tagged[0]!)
      return messages.slice(Math.max(0, firstTaggedIdx - 1)).slice(-6)
    }
    return messages.slice(-4)
  })()

  // ── Send with canvas context ───────────────────────────────────────────────

  function handleSend(text: string) {
    if (!text.trim() || busy) return
    void sendMessage(text, { canvasContext: module })
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full overflow-hidden"
      style={{ fontFamily: 'Montserrat, sans-serif' }}
    >
      {/* ── Top pane — canvas body ── */}
      <div
        className="overflow-y-auto min-h-0"
        style={{ flex: `${ratio} 1 0` }}
      >
        {children}
      </div>

      {/* ── Drag handle ── */}
      <div
        className="flex-shrink-0 flex items-center justify-center h-6 bg-surface-secondary hover:bg-primary-light border-t border-b border-bdr-light transition-colors select-none"
        style={{ cursor: 'row-resize' }}
        onPointerDown={handlePointerDown}
        title="Drag to resize"
      >
        <GripHorizontal className="w-4 h-4 text-txt-tertiary" />
      </div>

      {/* ── Bottom pane — embedded Saathi chat ── */}
      <div
        className="flex flex-col min-h-0 bg-surface-page border-t border-bdr-light"
        style={{ flex: `${1 - ratio} 1 0` }}
      >
        {/* Suggested prompts strip */}
        {suggestedPrompts.length > 0 && (
          <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-bdr-light bg-white">
            <div className="text-[10px] font-black uppercase tracking-[2px] text-primary mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              TRY ASKING
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestedPrompts.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(p)}
                  disabled={busy}
                  className="px-2.5 py-1 rounded-pill bg-surface-secondary hover:bg-primary-light border border-bdr-light text-[11px] text-txt-primary transition disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        <MessageList
          messages={canvasMessages}
          busy={busy}
          onOpenCanvas={(mod) => openCanvas(mod)}
          currentModule={module}
          currentCanvasModule={canvasState.module}
        />

        {/* Input bar */}
        <CanvasInputBar onSend={handleSend} busy={busy} />
      </div>
    </div>
  )
}

// ── Message list ───────────────────────────────────────────────────────────────

import type { ChatMessage } from '../context/ChatContext.js'

interface MessageListProps {
  messages: ChatMessage[]
  busy: boolean
  onOpenCanvas: (module: string) => void
  currentModule: string
  currentCanvasModule: string | null
}

function MessageList({ messages, busy, onOpenCanvas }: MessageListProps) {
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length, busy])

  if (messages.length === 0 && !busy) {
    return (
      <div className="flex-1 flex items-center justify-center text-txt-tertiary text-[12px] px-4 text-center">
        Ask anything about what you see above, or click a suggestion.
      </div>
    )
  }

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
      {messages.map((m) => (
        <ChatBubble
          key={m.id}
          role={m.role}
          content={m.content}
          citations={m.role === 'assistant' && m.kind === 'answer' ? m.citations : undefined}
          chartSpec={m.role === 'assistant' && m.kind === 'chart' ? m.spec : undefined}
          onOpenCanvas={onOpenCanvas}
        />
      ))}
      {busy && (
        <div className="flex justify-start">
          <TypingDots />
        </div>
      )}
    </div>
  )
}

// ── Input bar ──────────────────────────────────────────────────────────────────

interface CanvasInputBarProps {
  onSend: (text: string) => void
  busy: boolean
}

function CanvasInputBar({ onSend, busy }: CanvasInputBarProps) {
  const [value, setValue] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = value.trim()
    if (!t || busy) return
    setValue('')
    onSend(t)
  }

  return (
    <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-bdr-light">
      <form onSubmit={submit}>
        <div className="flex items-center gap-2 rounded-pill border border-bdr bg-white px-2 py-1 shadow-card">
          <button
            type="button"
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            title="Voice (coming soon)"
          >
            <Mic className="w-3.5 h-3.5 text-primary" />
          </button>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Message Saathi…"
            disabled={busy}
            className="flex-1 bg-transparent text-[12px] py-1 outline-none placeholder:text-txt-tertiary disabled:text-txt-tertiary"
          />
          <button
            type="submit"
            disabled={!value.trim() || busy}
            className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 disabled:bg-slate-300 transition"
            title="Send"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  )
}
