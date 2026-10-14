/**
 * ChatContext — owns the chat ↔ canvas demo flow.
 *
 * Responsibilities:
 *  - In-memory thread list (lazily backed by GET /api/ai/threads later).
 *  - The active thread's messages.
 *  - Sending a user message → POST /api/ai/message → dispatch the response:
 *      { kind: 'canvas', module, args } → openCanvas(module, args)
 *      { kind: 'answer', text, citations }  → append assistant message.
 *  - Active canvas state for <CanvasHost>.
 *  - Manual canvas open (sidebar tile clicks).
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
}

export interface CanvasState {
  module: string | null
  args?: Record<string, unknown> | undefined
}

interface AiMessageResponse {
  kind: 'canvas' | 'answer' | 'chart'
  module?: string
  args?: Record<string, unknown>
  text?: string
  citations?: Citation[]
  spec?: ChartSpec
  threadId?: string
}

export interface SendMessageOptions {
  /** Canvas module id to tag this message with, for bottom-pane filtering. */
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
  openThread: (threadId: string) => void
  openCanvas: (module: string, args?: Record<string, unknown>) => void
  /** Pop one level off the canvas stack. If stack becomes empty, canvas closes. */
  backCanvas: () => void
  closeCanvas: () => void
}

const Ctx = createContext<ChatContextValue | null>(null)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeLocalId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
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

  // Derived view — keeps all existing consumers working unchanged
  const canvasTop = canvasStack[canvasStack.length - 1]
  const canvasState: CanvasState = canvasTop
    ? { module: canvasTop.module, args: canvasTop.args }
    : { module: null }
  const [busy, setBusy] = useState(false)

  // Reset chat state when the user signs out
  useEffect(() => {
    if (!user) {
      setThreads([])
      setCurrentThreadId(null)
      setMessagesByThread({})
      setCanvasStack([])
      setBusy(false)
    }
  }, [user])

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
  }, [])

  const openThread = useCallback((threadId: string) => {
    setCurrentThreadId(threadId)
  }, [])

  const sendMessage = useCallback(
    async (content: string, opts?: SendMessageOptions) => {
      const trimmed = content.trim()
      if (!trimmed || !token) return

      const canvasContext = opts?.canvasContext

      // Optimistic user message + ensure we have a thread bucket
      const userMsg: ChatMessage = {
        id: makeLocalId('m'),
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
        ...(canvasContext ? { canvasContext } : {}),
      }

      // If there's no current thread, mint a placeholder client-side
      // (the API will return the real threadId in the response).
      // Canvas-scoped messages must NOT create a new sidebar thread — they
      // append to the current thread (or a silent scratch thread that never
      // appears as a sidebar entry if there is truly no active thread).
      let threadId = currentThreadId
      const isNewThread = !threadId && !canvasContext
      if (!threadId && !canvasContext) {
        threadId = makeLocalId('t')
        setCurrentThreadId(threadId)
        setThreads((prev) => [
          {
            id: threadId!,
            title: trimmed.slice(0, 60),
            lastMessageAt: new Date().toISOString(),
          },
          ...prev,
        ])
      } else if (!threadId && canvasContext) {
        // Canvas message with no active thread — use a transient bucket that
        // is NOT added to the sidebar threads list.
        threadId = makeLocalId('t')
        setCurrentThreadId(threadId)
      }
      // At this point threadId is always a non-null string (assigned in all branches above).
      const tid = threadId as string

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
            // Only forward to the API once we have a server-issued thread id
            threadId: isNewThread ? undefined : tid,
            // Canvas context for metadata storage (backend stores, ignores for AI prompt)
            ...(canvasContext ? { canvasContext } : {}),
          },
        })

        // If the server minted a different (real) thread id, swap it in
        const serverId = res.threadId
        if (serverId && serverId !== tid) {
          setThreads((prev) =>
            prev.map((t) => (t.id === tid ? { ...t, id: serverId } : t)),
          )
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
          // Do NOT append a text bubble — the canvas opening is the response.
          // Adding "Opening war room…" text is noise; the UI already shows the panel.
        } else if (res.kind === 'chart' && res.spec) {
          const assistant: ChatMessage = {
            id: makeLocalId('m'),
            role: 'assistant',
            kind: 'chart',
            content: res.spec.title,
            spec: res.spec,
            createdAt: new Date().toISOString(),
          }
          setMessagesByThread((prev) => ({
            ...prev,
            [finalId]: [...(prev[finalId] ?? []), assistant],
          }))
        } else {
          const assistant: ChatMessage = {
            id: makeLocalId('m'),
            role: 'assistant',
            kind: 'answer',
            content: res.text ?? '',
            citations: res.citations ?? [],
            createdAt: new Date().toISOString(),
          }
          setMessagesByThread((prev) => ({
            ...prev,
            [finalId]: [...(prev[finalId] ?? []), assistant],
          }))
        }

        // Bump thread title + lastMessageAt
        setThreads((prev) =>
          prev.map((t) =>
            t.id === finalId
              ? { ...t, lastMessageAt: new Date().toISOString() }
              : t,
          ),
        )
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
        setMessagesByThread((prev) => ({
          ...prev,
          [tid]: [...(prev[tid] ?? []), assistant],
        }))
      } finally {
        setBusy(false)
      }
    },
    [token, lang, currentThreadId, openCanvas, showToast],
  )

  const value = useMemo<ChatContextValue>(
    () => ({
      threads,
      currentThread,
      messages,
      canvasState,
      canvasStack,
      busy,
      sendMessage,
      newThread,
      openThread,
      openCanvas,
      backCanvas,
      closeCanvas,
    }),
    [
      threads,
      currentThread,
      messages,
      canvasState,
      canvasStack,
      busy,
      sendMessage,
      newThread,
      openThread,
      openCanvas,
      backCanvas,
      closeCanvas,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useChat(): ChatContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useChat called outside ChatProvider')
  return v
}
