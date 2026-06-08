/**
 * FloatingCallPill — fixed bottom-center overlay visible only when isInCall.
 *
 * Layout (left→right):
 *   [pulsing Saathi avatar] [live transcript lines] [Mic/MicOff] [red PhoneOff]
 *
 * Width: 480px on desktop, full-width minus 16px on mobile.
 * z-index: 60 (above CanvasOverlay which is z-20).
 */

import { Mic, MicOff, PhoneOff } from 'lucide-react'
import { useCall } from '../context/CallProvider.js'

export function FloatingCallPill() {
  const { isInCall, isConnecting, isMuted, transcripts, peerStatus, endCall, toggleMute } = useCall()

  if (!isInCall && !isConnecting) return null

  // Show only the most recent 2 transcript lines
  const recent = transcripts.slice(-2)

  const statusLabel = isConnecting
    ? 'Connecting…'
    : peerStatus === 'connected'
      ? 'Live'
      : peerStatus

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-4 py-3 rounded-pill bg-white border border-bdr shadow-modal"
      style={{ width: 'min(480px, calc(100vw - 16px))' }}
      role="status"
      aria-live="polite"
    >
      {/* Pulsing avatar */}
      <div className="relative flex-shrink-0 w-9 h-9">
        {/* pulse ring */}
        <span
          className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring"
          aria-hidden="true"
        />
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center relative z-10">
          <span className="text-white text-[11px] font-bold">AI</span>
        </div>
      </div>

      {/* Transcript + status */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">
          Saathi · {statusLabel}
        </div>
        {recent.length === 0 ? (
          <div className="text-[12px] text-txt-tertiary italic">Listening…</div>
        ) : (
          recent.map((line) => (
            <div
              key={line.id}
              className={`text-[12px] leading-snug truncate ${
                line.role === 'user' ? 'text-txt-secondary' : 'text-txt-primary font-medium'
              }`}
            >
              {line.role === 'user' ? 'You: ' : 'Saathi: '}
              {line.text}
            </div>
          ))
        )}
      </div>

      {/* Mute toggle */}
      <button
        type="button"
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition ${
          isMuted
            ? 'bg-warn-light text-warn border border-warn/30'
            : 'bg-surface-page text-txt-secondary hover:bg-surface-secondary border border-bdr-light'
        }`}
        aria-pressed={isMuted}
      >
        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>

      {/* End call */}
      <button
        type="button"
        onClick={endCall}
        title="End call"
        className="w-9 h-9 rounded-full bg-danger text-white flex items-center justify-center flex-shrink-0 hover:bg-red-700 transition"
      >
        <PhoneOff className="w-4 h-4" />
      </button>
    </div>
  )
}
