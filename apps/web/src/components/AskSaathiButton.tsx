/**
 * AskSaathiButton — sparkle pill inside a canvas that opens a Saathi thread
 * about this screen with the question already sent (PM-SETU behaviour).
 *
 *   <AskSaathiButton prompt="Why is the top industry ranked highest?" />
 *   <AskSaathiButton prompt="Show benzene trend" label="Analyse" compact />
 *
 * The thread is grounded in whatever the canvas published via
 * useSaathiContext(); Back in the panel header returns to this screen.
 */

import { Sparkles } from 'lucide-react'
import { useChat, type SaathiAbout } from '../context/ChatContext.js'
import { usePublishedSaathi } from '../canvas/CanvasSaathi.js'
import { findModule } from '../nlp/moduleRegistry.js'

interface AskSaathiButtonProps {
  /** Question to send when clicked. */
  prompt: string
  /** Button label. Defaults to "Ask Saathi". */
  label?: string
  /** Compact pill variant (smaller text + padding) for chart headers. */
  compact?: boolean
}

export function AskSaathiButton({ prompt, label = 'Ask Saathi', compact = false }: AskSaathiButtonProps) {
  const { askSaathi, canvasState } = useChat()
  const { context, quickAsks } = usePublishedSaathi()

  function handleClick() {
    const moduleId = canvasState.module
    const entry = moduleId ? findModule(moduleId) : undefined
    const about: SaathiAbout | null = moduleId
      ? { canvasType: moduleId, title: entry?.label.en ?? moduleId, subtitle: entry?.description ?? '', context, quickAsks }
      : null
    askSaathi({ about, prompt })
  }

  const cls = compact
    ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-primary-light text-primary text-[10px] font-bold hover:bg-primary hover:text-white transition select-none'
    : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-primary-light text-primary text-[12px] font-bold hover:bg-primary hover:text-white transition select-none'

  return (
    <button type="button" onClick={handleClick} title={prompt} className={cls}>
      <Sparkles className={compact ? 'w-2.5 h-2.5 flex-shrink-0' : 'w-3.5 h-3.5 flex-shrink-0'} />
      {label}
    </button>
  )
}
