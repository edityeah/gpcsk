/**
 * AskAiPanel — chat surface for Saathi.
 *
 * Scrollable message list backed by ChatContext, plus an input bar.
 * Submit → ChatContext.sendMessage. Shows typing dots while busy.
 * Citation chips on answer-type messages — click → toast doc title.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Mic, Sparkles } from 'lucide-react'
import { ChatBubble, TypingDots } from '../ChatBubble.js'
import { useChat, type Citation } from '../../context/ChatContext.js'
import { useApp } from '../../context/AppContext.js'
import { useAuth } from '../../context/AuthContext.js'

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  SENIOR_REVIEWER: [
    'Show me Gujarat pulse',
    'Open the enforcement pipeline',
    'What is the BOD norm for CETPs?',
  ],
  CONSENT_OFFICER: [
    'Open application queue',
    'Show renewals due in 60 days',
    'What documents are mandatory for a CTO?',
  ],
  MONITORING_OFFICER: [
    'Open OCEMS live grid',
    'Show me the exceedance feed',
    'What is the AAQM norm for PM2.5?',
  ],
  INSPECTION_ENFORCEMENT_OFFICER: [
    'Open inspection priorities',
    'Draft a show-cause notice',
    'Show me the violations register',
  ],
  COMPLAINTS_OFFICER: [
    'Open the complaint inbox',
    'Show me the hotspot map',
    'Which industries get the most complaints?',
  ],
}

export function AskAiPanel() {
  const { t } = useTranslation()
  const { messages, sendMessage, busy, currentThread } = useChat()
  const { showToast } = useApp()
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to the latest message
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, busy])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    void sendMessage(text)
  }

  function handleCitationClick(c: Citation) {
    showToast({ kind: 'info', text: c.docTitle })
  }

  function pickSuggestion(s: string) {
    if (busy) return
    setInput('')
    void sendMessage(s)
  }

  const suggestions = (user && SUGGESTIONS_BY_ROLE[user.role]) ?? []
  const showSuggestions = messages.length === 0

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-bdr-light bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-txt-primary truncate">
              {currentThread?.title ?? 'Saathi'}
            </div>
            <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">
              GPCSK AI companion
            </div>
          </div>
        </div>
      </div>

      {/* Message list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {showSuggestions ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-primary-light text-primary flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-[18px] font-bold text-txt-primary mb-1">
              Namaste{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h2>
            <p className="text-[13px] text-txt-secondary mb-5">{t('home.askAi')}</p>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    className="px-3 py-1.5 rounded-pill bg-surface-secondary border border-bdr-light text-[12px] text-txt-primary hover:bg-primary-light hover:border-primary/30 hover:text-primary transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {messages.map((m) => (
              <ChatBubble
                key={m.id}
                role={m.role}
                content={m.content}
                citations={m.role === 'assistant' ? m.citations : undefined}
                onCitationClick={handleCitationClick}
              />
            ))}
            {busy && (
              <div className="flex justify-start">
                <TypingDots />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-bdr-light bg-gradient-to-t from-surface-page/40 to-white px-4 py-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2.5 rounded-pill border border-bdr bg-white px-2 py-1.5 shadow-card">
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center flex-shrink-0"
              title="Voice (coming soon)"
            >
              <Mic className="w-4 h-4 text-primary" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('home.placeholder')}
              disabled={busy}
              className="flex-1 bg-transparent text-[14px] py-1.5 outline-none placeholder:text-txt-tertiary disabled:text-txt-tertiary"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 disabled:bg-slate-300"
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
    </div>
  )
}
