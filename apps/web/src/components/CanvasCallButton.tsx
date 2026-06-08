/**
 * CanvasCallButton — a small phone-icon button for canvas headers.
 *
 * When clicked it calls startCall() with a contextHint describing the
 * current canvas so the Realtime session is primed with context.
 *
 * Usage:
 *   <CanvasCallButton canvasName="OPEN_WAR_ROOM" canvasLabel="War Room" />
 */

import { Phone } from 'lucide-react'
import { useCall } from '../context/CallProvider.js'

interface CanvasCallButtonProps {
  canvasName: string
  canvasLabel: string
}

export function CanvasCallButton({ canvasName, canvasLabel }: CanvasCallButtonProps) {
  const { startCall, isInCall, isConnecting } = useCall()

  function handleClick() {
    void startCall({
      contextHint: `You are inside the ${canvasLabel} canvas (module: ${canvasName}). The officer is looking at this view. Prefer answering questions relevant to what they see here.`,
    })
  }

  const disabled = isInCall || isConnecting

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? 'Call in progress' : `Talk to Saathi about ${canvasLabel}`}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition disabled:opacity-40 bg-primary text-white hover:bg-primary-dark active:scale-95"
    >
      <Phone className="w-4 h-4" />
    </button>
  )
}
