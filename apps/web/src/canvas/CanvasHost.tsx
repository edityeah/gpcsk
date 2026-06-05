/**
 * CanvasHost — renders a lazy-loaded canvas module by ID.
 *
 * The host consumes a `{ module, args }` shape (typically from ChatContext),
 * looks the module up in moduleRegistry, and renders it under <Suspense>.
 *
 * When `module` is null we render an empty state inviting the user to ask
 * Saathi or pick a tile from the sidebar.
 */

import { Suspense } from 'react'
import { LayoutDashboard, Loader2 } from 'lucide-react'
import { findModule } from '../nlp/moduleRegistry.js'

interface CanvasHostProps {
  module: string | null
  args?: Record<string, unknown> | undefined
}

export function CanvasHost({ module, args }: CanvasHostProps) {
  if (!module) {
    return <EmptyState />
  }

  const entry = findModule(module)
  if (!entry) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-[14px] font-bold text-danger mb-2">Unknown canvas module</div>
          <div className="text-[12px] text-txt-secondary">
            No canvas registered for <code className="px-1 py-0.5 rounded bg-surface-secondary">{module}</code>.
          </div>
        </div>
      </div>
    )
  }

  const Component = entry.component
  const passProps = (args ?? {}) as Record<string, unknown>

  return (
    <Suspense fallback={<LoadingState />}>
      <Component {...passProps} />
    </Suspense>
  )
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary-light text-primary flex items-center justify-center mb-3">
          <LayoutDashboard className="w-6 h-6" />
        </div>
        <div className="text-[14px] font-bold text-txt-primary mb-1">Canvas</div>
        <div className="text-[12px] text-txt-secondary leading-relaxed">
          Ask Saathi to open a dashboard, or pick a tile from the sidebar. The selected canvas will appear here.
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="flex items-center gap-2 text-txt-secondary">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[13px]">Loading canvas…</span>
      </div>
    </div>
  )
}
