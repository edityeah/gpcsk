/**
 * AskSaathiButton — Inline sparkle pill that sends a pre-canned question to the
 * canvas-scoped Saathi chat (the bottom pane of CanvasSaathiSplit).
 *
 * Usage inside a canvas:
 *   <AskSaathiButton prompt="Why is the top industry ranked highest?" />
 *   <AskSaathiButton prompt="Show benzene trend" label="Analyse" compact />
 *
 * The button calls ChatContext.sendMessage with canvasContext set to the
 * currently open canvas module id so the message appears in the split panel.
 */

import { Sparkles } from 'lucide-react'
import { useChat } from '../context/ChatContext.js'

interface AskSaathiButtonProps {
  /** Question to send when clicked. */
  prompt: string
  /** Button label. Defaults to "Ask Saathi". */
  label?: string
  /** Compact pill variant (smaller text + padding) for chart headers. */
  compact?: boolean
}

export function AskSaathiButton({ prompt, label = 'Ask Saathi', compact = false }: AskSaathiButtonProps) {
  const { sendMessage, canvasState, busy } = useChat()

  function handleClick() {
    if (busy) return
    const canvasContext = canvasState.module ?? undefined
    void sendMessage(prompt, { canvasContext })
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={prompt}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-primary-light text-primary text-[10px] font-bold hover:bg-primary hover:text-white transition disabled:opacity-50 select-none"
      >
        <Sparkles className="w-2.5 h-2.5 flex-shrink-0" />
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title={prompt}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-primary-light text-primary text-[12px] font-bold hover:bg-primary hover:text-white transition disabled:opacity-50 select-none"
    >
      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
      {label}
    </button>
  )
}
