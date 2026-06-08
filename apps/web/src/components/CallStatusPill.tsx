/**
 * CallStatusPill — inline pill rendered in the top-right header bar when a
 * call is active.  Replaces the old fixed-bottom FloatingCallPill.
 *
 * Layout (left→right):
 *   [pulsing 24px avatar] | [label / subtitle stack] | [MicToggle] [ScreenShare] [PhoneOff]
 *
 * Renders null when not in call and not connecting.
 */

import { Mic, MicOff, PhoneOff, MonitorUp, MonitorOff } from 'lucide-react'
import { useCall } from '../context/CallProvider.js'

export function CallStatusPill() {
  const {
    isInCall,
    isConnecting,
    isMuted,
    peerStatus,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    endCall,
    toggleMute,
  } = useCall()

  if (!isInCall && !isConnecting) return null

  const statusLabel = isConnecting
    ? 'Connecting…'
    : peerStatus === 'connected'
      ? 'On call'
      : peerStatus

  const subtitle = isScreenSharing ? 'On call · sharing screen' : statusLabel

  return (
    <div
      className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-pill bg-white border border-bdr shadow-card max-w-[360px]"
      role="status"
      aria-live="polite"
    >
      {/* Pulsing 24px avatar */}
      <div className="relative flex-shrink-0 w-6 h-6">
        <span
          className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring"
          aria-hidden="true"
        />
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center relative z-10">
          <span className="text-white text-[8px] font-bold">AI</span>
        </div>
      </div>

      {/* Label / subtitle */}
      <div className="flex-1 min-w-0 leading-none">
        <div className="text-[11px] font-bold text-primary truncate">
          Saathi
        </div>
        <div className="text-[10px] text-txt-tertiary truncate">{subtitle}</div>
      </div>

      {/* Mic toggle */}
      <button
        type="button"
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition ${
          isMuted
            ? 'bg-warn-light text-warn border border-warn/30'
            : 'bg-surface-page text-txt-secondary hover:bg-surface-secondary border border-bdr-light'
        }`}
        aria-pressed={isMuted}
      >
        {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      </button>

      {/* Screen share toggle */}
      {isInCall && (
        <button
          type="button"
          onClick={() => { void (isScreenSharing ? stopScreenShare() : startScreenShare()) }}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition ${
            isScreenSharing
              ? 'bg-primary text-white border border-primary/50'
              : 'bg-surface-page text-txt-secondary hover:bg-surface-secondary border border-bdr-light'
          }`}
          aria-pressed={isScreenSharing}
        >
          {isScreenSharing
            ? <MonitorOff className="w-3.5 h-3.5" />
            : <MonitorUp className="w-3.5 h-3.5" />
          }
        </button>
      )}

      {/* End call */}
      <button
        type="button"
        onClick={endCall}
        title="End call"
        className="w-7 h-7 rounded-full bg-danger text-white flex items-center justify-center flex-shrink-0 hover:bg-red-700 transition"
      >
        <PhoneOff className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// Thin re-export so any legacy import of FloatingCallPill continues to work.
export { CallStatusPill as FloatingCallPill }
