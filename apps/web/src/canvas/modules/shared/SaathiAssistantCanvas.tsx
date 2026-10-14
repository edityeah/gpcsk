/**
 * SaathiAssistantCanvas — the orchestrator conversation (PM-SETU port).
 *
 * One saved thread per conversation. Opened three ways:
 *   • "Saathi" in the top bar / "Talk to Saathi" on the home page → fresh thread
 *   • "Ask Saathi" from a screen → thread *about* that screen (`about` carries
 *     the screen's title, a data brief and its quick asks; `pendingPrompt` is
 *     sent as the first message)
 *   • a thread in the sidebar → `threadId` reloads the saved messages
 *
 * Replies of kind 'canvas' open that module on top of the stack.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'
import {
  useChat,
  type AiMessageResponse,
  type ChatMessage,
  type ChartSpec,
  type SaathiAbout,
} from '../../../context/ChatContext.js'
import { api } from '../../../lib/api.js'
import { ChatBubble, TypingDots } from '../../../components/ChatBubble.js'
import { ROLE_LABELS, SAATHI_SUGGESTIONS } from '../../../roles/roleConfig.js'

interface Props {
  threadId?: string
  about?: SaathiAbout | null
  pendingPrompt?: { text: string; nonce: number }
}

interface ServerMessage {
  id: string
  role: string
  content: string
  toolCalls: unknown
  createdAt: string
}

function fromServer(m: ServerMessage): ChatMessage | null {
  const createdAt = m.createdAt
  if (m.role === 'user') return { id: m.id, role: 'user', content: m.content, createdAt }
  if (m.role !== 'assistant') return null
  const calls = Array.isArray(m.toolCalls) ? (m.toolCalls as Array<Record<string, unknown>>) : []
  const chart = calls.find((c) => c['name'] === 'renderChart' && c['spec'])
  if (chart) return { id: m.id, role: 'assistant', kind: 'chart', content: m.content, spec: chart['spec'] as ChartSpec, createdAt }
  return { id: m.id, role: 'assistant', kind: 'answer', content: m.content, createdAt }
}

const localId = () => `m_${Math.random().toString(36).slice(2, 10)}`

export function SaathiAssistantCanvas({ threadId: initialThreadId, about, pendingPrompt }: Props) {
  const { token, user } = useAuth()
  const { lang, showToast } = useApp()
  const { openCanvas, refreshThreads } = useChat()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [loadingThread, setLoadingThread] = useState(!!initialThreadId)
  const threadIdRef = useRef<string | null>(initialThreadId ?? null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const sentPromptRef = useRef<string | null>(null)

  const role = user?.role
  const first = user?.name?.split(' ').find((p) => !p.endsWith('.')) ?? 'there'
  const quickAsks = about?.quickAsks?.length ? about.quickAsks : (role ? SAATHI_SUGGESTIONS[role] : [])
  const intro = about
    ? `Ask me anything about ${about.title}. I have what was on the screen when you opened this thread.`
    : `Hi ${first} — ask me about exceedances, consents, complaints or enforcement, or say which screen to open.`

  // Reload a saved thread
  useEffect(() => {
    let cancelled = false
    threadIdRef.current = initialThreadId ?? null
    if (!initialThreadId || !token) { setMessages([]); setLoadingThread(false); return }
    setLoadingThread(true)
    api<{ messages: ServerMessage[] }>(`/api/ai/threads/${initialThreadId}`, { token })
      .then((t) => { if (!cancelled) setMessages((t.messages ?? []).map(fromServer).filter((m): m is ChatMessage => !!m)) })
      .catch(() => { if (!cancelled) showToast({ kind: 'danger', text: 'Could not load that conversation.' }) })
      .finally(() => { if (!cancelled) setLoadingThread(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialThreadId, token])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, thinking])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !token || thinking) return
    setMessages((m) => [...m, { id: localId(), role: 'user', content: trimmed, createdAt: new Date().toISOString() }])
    setThinking(true)
    try {
      const res = await api<AiMessageResponse>('/api/ai/message', {
        method: 'POST',
        token,
        body: {
          content: trimmed,
          lang,
          threadId: threadIdRef.current ?? undefined,
          ...(about ? { canvasContext: about.canvasType, screenContext: screenBrief(about, role ? ROLE_LABELS[role] : '') } : {}),
        },
      })
      const isNew = !threadIdRef.current
      if (res.threadId) threadIdRef.current = res.threadId
      if (res.kind === 'canvas' && res.module) {
        setMessages((m) => [...m, { id: localId(), role: 'assistant', kind: 'answer', content: `Opening ${labelOf(res.module!)}…`, createdAt: new Date().toISOString() }])
        openCanvas(res.module, res.args)
      } else if (res.kind === 'chart' && res.spec) {
        setMessages((m) => [...m, { id: localId(), role: 'assistant', kind: 'chart', content: res.spec!.title, spec: res.spec!, createdAt: new Date().toISOString() }])
      } else {
        setMessages((m) => [...m, { id: localId(), role: 'assistant', kind: 'answer', content: res.text ?? '', citations: res.citations ?? [], createdAt: new Date().toISOString() }])
      }
      if (isNew) void refreshThreads()
    } catch {
      setMessages((m) => [...m, { id: localId(), role: 'assistant', kind: 'answer', content: 'Sorry — I could not reach the server. Please try again.', createdAt: new Date().toISOString() }])
    } finally {
      setThinking(false)
    }
  }

  // A prompt handed over by "Ask Saathi about this" is sent once, as the first message.
  useEffect(() => {
    if (!pendingPrompt || loadingThread) return
    const key = `${pendingPrompt.nonce}::${pendingPrompt.text}`
    if (sentPromptRef.current === key) return
    sentPromptRef.current = key
    void send(pendingPrompt.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt?.nonce, loadingThread])

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = input.trim()
    if (!t) return
    setInput('')
    void send(t)
  }

  return (
    <div className="h-full flex flex-col">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 md:px-5 py-4 flex flex-col gap-2.5">
        {quickAsks.length > 0 && (
          <div className="mb-3 rounded-2xl border border-bdr-light bg-gradient-to-b from-primary-light/30 to-white p-3">
            <div className="text-[11px] uppercase tracking-wider font-bold text-primary mb-2 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Try asking
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickAsks.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { void send(q) }}
                  disabled={thinking}
                  className="text-left text-[12px] px-3 py-2 rounded-xl border border-bdr-light bg-white hover:border-primary hover:bg-primary-light/40 transition leading-snug disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {loadingThread ? (
          <div className="text-[12px] text-txt-tertiary px-2">Loading conversation…</div>
        ) : messages.length === 0 ? (
          <ChatBubble role="assistant" content={intro} />
        ) : null}

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
        {thinking && <div className="flex justify-start"><TypingDots /></div>}
      </div>

      <div className="flex-shrink-0 px-3 md:px-4 py-3 border-t border-bdr bg-gradient-to-t from-surface-page/40 to-white">
        <form onSubmit={submit} className="flex items-center gap-2 rounded-pill border border-bdr bg-white shadow-card px-2 py-1.5">
          <Sparkles className="w-4 h-4 text-primary ml-2 flex-shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Saathi…"
            disabled={thinking}
            className="flex-1 bg-transparent text-[14px] px-2 py-1.5 outline-none placeholder:text-txt-tertiary disabled:text-txt-tertiary"
          />
          <button type="submit" disabled={!input.trim() || thinking} className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center disabled:bg-slate-300">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

function screenBrief(about: SaathiAbout, roleLabel: string): string {
  return [
    `Screen: "${about.title}"${about.subtitle ? ` — ${about.subtitle}` : ''} (module ${about.canvasType}), opened by a ${roleLabel}.`,
    about.context ? `DATA ON THE SCREEN:\n${about.context}` : 'The screen had not published its data; answer from role context and say so.',
  ].join('\n\n')
}

function labelOf(moduleId: string): string {
  return moduleId.replace(/^OPEN_/, '').replace(/_/g, ' ').toLowerCase()
}
