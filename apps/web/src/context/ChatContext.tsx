/**
 * ChatContext — owns the chat ↔ canvas flow.
 *
 *  - Server-backed thread list (GET /api/ai/threads) for the sidebar.
 *  - The home conversation (messages kept in memory per thread id).
 *  - Sending a user message → POST /api/ai/message → dispatch the response:
 *      { kind: 'canvas', module, args } → openCanvas(module, args)
 *      { kind: 'answer' | 'chart' }      → append assistant message.
 *  - The canvas navigation stack rendered by <CanvasPanel>.
 *  - askSaathi(): start a Saathi thread *about* the screen the officer is on
 *    (PM-SETU behaviour) — opens the OPEN_SAATHI canvas on top of the stack
 *    so Back returns to that screen.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api.js'
import { useAuth } from './AuthContext.js'
import { useApp } from './AppContext.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface Citation {
  docId: string
  docTitle: string
  snippet: string
}

export interface ChartDataPoint {
  x: string | number
  y: number
}

export interface ChartSeries {
  name: string
  data: ChartDataPoint[]
}

export interface ChartSpec {
  chartType: 'BAR' | 'LINE' | 'PIE' | 'AREA'
  title: string
  xLabel?: string
  yLabel?: string
  series: ChartSeries[]
  description?: string
  canvasHint?: string
}

export type ChatMessage =
  | {
      id: string
      role: 'user'
      content: string
      createdAt: string
      /** Canvas module id this message was sent from, for scoped filtering */
      canvasContext?: string
    }
  | {
      id: string
      role: 'assistant'
      kind: 'answer'
      content: string
      citations?: Citation[]
      module?: string
      args?: Record<string, unknown>
      createdAt: string
    }
  | {
      id: string
      role: 'assistant'
      kind: 'chart'
      content: string
      spec: ChartSpec
      createdAt: string
    }

export interface ChatThread {
  id: string
  title: string
  lastMessageAt: string
  messageCount?: number
}

export interface CanvasState {
  module: string | null
  args?: Record<string, unknown> | undefined
}

/** What a screen publishes when a Saathi thread is started from it. */
export interface SaathiAbout {
  canvasType: string
  title: string
  subtitle: string
  context: string
  quickAsks: string[]
}

export interface AiMessageResponse {
  kind: 'canvas' | 'answer' | 'chart'
  module?: string
  args?: Record<string, unknown>
  text?: string
  citations?: Citation[]
  spec?: ChartSpec
  threadId?: string
}

export interface SendMessageOptions {
  /** Canvas module id to tag this message with. */
  canvasContext?: string
}

interface ChatContextValue {
  threads: ChatThread[]
  currentThread: ChatThread | null
  messages: ChatMessage[]
  /** Derived view of the top of the canvas stack (null module = no canvas open) */
  canvasState: CanvasState
  /** Full canvas navigation stack — index 0 is the root, last entry is current */
  canvasStack: Array<{ module: string; args: Record<string, unknown> }>
  busy: boolean

  sendMessage: (content: string, opts?: SendMessageOptions) => Promise<void>
  newThread: () => void
  /** Open a saved thread — shows it in the Saathi canvas (PM-SETU behaviour). */
  openThread: (threadId: string) => void
  refreshThreads: () => Promise<void>
  openCanvas: (module: string, args?: Record<string, unknown>) => void
  /** Pop one level off the canvas stack. If stack becomes empty, canvas closes. */
  backCanvas: () => void
  closeCanvas: () => void
  /** Start a Saathi thread about a screen; `prompt` is sent as the first message. */
  askSaathi: (opts?: { about?: SaathiAbout | null; prompt?: string }) => void
}

const Ctx = createContext<ChatContextValue | null>(null)

export const SAATHI_MODULE = 'OPEN_SAATHI'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeLocalId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

interface ThreadsResponse {
  threads: Array<{ id: string; title: string | null; lastMessageAt: string; _count?: { messages: number } }>
}

// ── Provider ────────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth()
  const { lang, showToast } = useApp()

  const [threads, setThreads] = useState<ChatThread[]>([])
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  // messages keyed by thread id (kept in-memory only for the demo)
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ChatMessage[]>>({})
  const [canvasStack, setCanvasStack] = useState<Array<{ module: string; args: Record<string, unknown> }>>([])
  const [busy, setBusy] = useState(false)

  // Derived view — keeps all existing consumers working unchanged
  const canvasTop = canvasStack[canvasStack.length - 1]
  const canvasState: CanvasState = canvasTop
    ? { module: canvasTop.module, args: canvasTop.args }
    : { module: null }

  const refreshThreads = useCallback(async () => {
    if (!token) { setThreads([]); return }
    try {
      const r = await api<ThreadsResponse>('/api/ai/threads', { token })
      setThreads(
        (r.threads ?? []).map((t) => ({
          id: t.id,
          title: t.title ?? 'Conversation',
          lastMessageAt: t.lastMessageAt,
          messageCount: t._count?.messages,
        })),
      )
    } catch {
      /* sidebar stays as-is */
    }
  }, [token])

  // Reset chat state whenever the signed-in user changes (sign-out or role switch)
  const userId = user?.id ?? null
  useEffect(() => {
    setCurrentThreadId(null)
    setMessagesByThread({})
    setCanvasStack([])
    setBusy(false)
    if (!userId) setThreads([])
    else void refreshThreads()
  }, [userId, refreshThreads])

  const messages = currentThreadId ? (messagesByThread[currentThreadId] ?? []) : []
  const currentThread = threads.find((t) => t.id === currentThreadId) ?? null

  // ── Actions ──────────────────────────────────────────────────────────────

  const openCanvas = useCallback((module: string, args?: Record<string, unknown>) => {
    setCanvasStack((prev) => [...prev, { module, args: args ?? {} }])
  }, [])

  const backCanvas = useCallback(() => {
    setCanvasStack((prev) => prev.length > 0 ? prev.slice(0, -1) : prev)
  }, [])

  const closeCanvas = useCallback(() => {
    setCanvasStack([])
  }, [])

  const newThread = useCallback(() => {
    setCurrentThreadId(null)
    setCanvasStack([])
  }, [])

  const openThread = useCallback((threadId: string) => {
    setCanvasStack([{ module: SAATHI_MODULE, args: { threadId } }])
  }, [])

  const askSaathi = useCallback((opts?: { about?: SaathiAbout | null; prompt?: string }) => {
    const args: Record<string, unknown> = { about: opts?.about ?? null }
    if (opts?.prompt) args['pendingPrompt'] = { text: opts.prompt, nonce: Date.now() }
    setCanvasStack((prev) => {
      // Re-use the Saathi canvas if it is already on top (new question, same thread)
      const top = prev[prev.length - 1]
      if (top && top.module === SAATHI_MODULE) {
        return [...prev.slice(0, -1), { module: SAATHI_MODULE, args: { ...top.args, ...args } }]
      }
      return [...prev, { module: SAATHI_MODULE, args }]
    })
  }, [])

  const sendMessage = useCallback(
    async (content: string, opts?: SendMessageOptions) => {
      const trimmed = content.trim()
      if (!trimmed || !token) return

      const canvasContext = opts?.canvasContext

      const userMsg: ChatMessage = {
        id: makeLocalId('m'),
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
        ...(canvasContext ? { canvasContext } : {}),
      }

      // If there's no current thread, mint a placeholder client-side
      // (the API returns the real threadId in the response).
      let threadId = currentThreadId
      const isNewThread = !threadId
      if (!threadId) {
        threadId = makeLocalId('t')
        setCurrentThreadId(threadId)
      }
      const tid = threadId

      setMessagesByThread((prev) => ({
        ...prev,
        [tid]: [...(prev[tid] ?? []), userMsg],
      }))

      setBusy(true)
      try {
        const res = await api<AiMessageResponse>('/api/ai/message', {
          method: 'POST',
          token,
          body: {
            content: trimmed,
            lang,
            threadId: isNewThread ? undefined : tid,
            ...(canvasContext ? { canvasContext } : {}),
          },
        })

        // If the server minted a different (real) thread id, swap it in
        const serverId = res.threadId
        if (serverId && serverId !== tid) {
          setMessagesByThread((prev) => {
            const list = prev[tid] ?? []
            const { [tid]: _drop, ...rest } = prev
            void _drop
            return { ...rest, [serverId]: list }
          })
          setCurrentThreadId(serverId)
        }
        const finalId = serverId ?? tid

        if (res.kind === 'canvas' && res.module) {
          openCanvas(res.module, res.args)
          // The canvas opening is the response — no text bubble.
        } else if (res.kind === 'chart' && res.spec) {
          const assistant: ChatMessage = {
            id: makeLocalId('m'),
            role: 'assistant',
            kind: 'chart',
            content: res.spec.title,
            spec: res.spec,
            createdAt: new Date().toISOString(),
          }
          setMessagesByThread((prev) => ({ ...prev, [finalId]: [...(prev[finalId] ?? []), assistant] }))
        } else {
          const assistant: ChatMessage = {
            id: makeLocalId('m'),
            role: 'assistant',
            kind: 'answer',
            content: res.text ?? '',
            citations: res.citations ?? [],
            createdAt: new Date().toISOString(),
          }
          setMessagesByThread((prev) => ({ ...prev, [finalId]: [...(prev[finalId] ?? []), assistant] }))
        }

        void refreshThreads()
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to reach Saathi'
        showToast({ kind: 'danger', text: message })

        const assistant: ChatMessage = {
          id: makeLocalId('m'),
          role: 'assistant',
          kind: 'answer',
          content: 'Sorry — I could not reach the server. Please try again.',
          createdAt: new Date().toISOString(),
        }
        setMessagesByThread((prev) => ({ ...prev, [tid]: [...(prev[tid] ?? []), assistant] }))
      } finally {
        setBusy(false)
      }
    },
    [token, lang, currentThreadId, openCanvas, showToast, refreshThreads],
  )

  const value = useMemo<ChatContextValue>(
    () => ({
      threads, currentThread, messages, canvasState, canvasStack, busy,
      sendMessage, newThread, openThread, refreshThreads,
      openCanvas, backCanvas, closeCanvas, askSaathi,
    }),
    [threads, currentThread, messages, canvasState, canvasStack, busy,
     sendMessage, newThread, openThread, refreshThreads, openCanvas, backCanvas, closeCanvas, askSaathi],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useChat(): ChatContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useChat called outside ChatProvider')
  return v
}
