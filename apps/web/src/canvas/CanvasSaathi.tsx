/**
 * CanvasSaathi — lets any canvas publish "what is on screen" so the
 * "Ask Saathi" button in the panel header (and the AskSaathiButton inside
 * canvases) can start a thread grounded in the live data.
 *
 *   const { data } = useLoad(...)
 *   useSaathiContext(data ? brief(data) : '', ['What is overdue?'])
 *
 * Call the hook unconditionally (before any early return).
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

interface Published {
  context: string
  quickAsks: string[]
}

interface CanvasSaathiValue {
  published: Published
  setPublished: (p: Published) => void
}

const Ctx = createContext<CanvasSaathiValue | null>(null)

export function CanvasSaathiProvider({ children }: { children: ReactNode }) {
  const [published, setPublished] = useState<Published>({ context: '', quickAsks: [] })
  const value = useMemo(() => ({ published, setPublished }), [published])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSaathiContext(context: string, quickAsks?: string[]): void {
  const ctx = useContext(Ctx)
  const asks = JSON.stringify(quickAsks ?? [])
  useEffect(() => {
    if (!ctx) return
    ctx.setPublished({ context: context || '', quickAsks: quickAsks ?? [] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, asks])
}

export function usePublishedSaathi(): Published {
  return useContext(Ctx)?.published ?? { context: '', quickAsks: [] }
}

/** Compact JSON of a canvas's loaded data for the thread prompt (bounded size). */
export function brief(obj: unknown, max = 3500): string {
  try {
    const seen = new WeakSet<object>()
    const s = JSON.stringify(obj, (k, v: unknown) => {
      if (['embedding', 'photos', 'attachments', 'letterFileUrl', 'evidence'].includes(k)) return undefined
      if (v && typeof v === 'object') {
        if (seen.has(v)) return undefined
        seen.add(v)
        if (Array.isArray(v) && v.length > 40) return v.slice(0, 40)
      }
      return v
    })
    return s.length > max ? `${s.slice(0, max)}…(truncated)` : s
  } catch {
    return ''
  }
}
