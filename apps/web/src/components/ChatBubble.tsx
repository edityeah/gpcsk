/**
 * ChatBubble — user / assistant chat bubble + optional citation chips.
 *
 * Uses the KSK-cloned chat-bubble-user / chat-bubble-bot Tailwind classes
 * already defined in apps/web/src/index.css.
 */

import { FileText } from 'lucide-react'
import type { Citation } from '../context/ChatContext.js'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  onCitationClick?: (c: Citation) => void
}

export function ChatBubble({ role, content, citations, onCitationClick }: ChatBubbleProps) {
  const isUser = role === 'user'
  const bubbleClass = isUser ? 'chat-bubble-user' : 'chat-bubble-bot'

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full`}>
      <div className={bubbleClass}>
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{content}</div>
      </div>

      {!isUser && citations && citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 max-w-[85%]">
          {citations.map((c, i) => (
            <button
              key={`${c.docId}-${i}`}
              type="button"
              onClick={() => onCitationClick?.(c)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-pill bg-primary-light text-primary text-[11px] font-medium hover:bg-primary-50 border border-primary/20 transition"
              title={c.snippet}
            >
              <FileText className="w-3 h-3" />
              <span className="truncate max-w-[180px]">{c.docTitle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Animated 3-dot "typing" indicator. */
export function TypingDots() {
  return (
    <div className="chat-bubble-bot inline-flex items-center gap-1 py-2">
      <span className="w-1.5 h-1.5 rounded-full bg-txt-tertiary animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-txt-tertiary animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-txt-tertiary animate-bounce" />
    </div>
  )
}
