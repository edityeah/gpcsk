/**
 * CallProvider — owns the OpenAI Realtime WebRTC call lifecycle.
 *
 * Exposes:
 *  isInCall       — true once RTCPeerConnection is connected
 *  isConnecting   — true while SDP negotiation in flight
 *  isMuted        — mic muted
 *  peerStatus     — RTCPeerConnectionState string
 *  transcripts    — last 20 lines of {role, text}
 *  startCall(opts?) — begins the call (optional contextHint)
 *  endCall()       — tears down peer connection
 *  toggleMute()    — toggles mic track enabled flag
 *
 * Placement in tree: inside AuthProvider + ChatProvider
 * (needs useAuth for the API token and useChat for openCanvas)
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api.js'
import { useAuth } from './AuthContext.js'
import { useChat } from './ChatContext.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TranscriptLine {
  role: 'user' | 'assistant'
  text: string
  id: string
}

interface StartCallOptions {
  /** Optional hint appended to system prompt, e.g. current canvas context */
  contextHint?: string
}

interface SessionResponse {
  client_secret: { value: string }
  model: string
  expires_at: number
  id?: string
}

interface CallContextValue {
  isInCall: boolean
  isConnecting: boolean
  isMuted: boolean
  isScreenSharing: boolean
  peerStatus: RTCPeerConnectionState | 'new'
  transcripts: TranscriptLine[]
  startCall: (opts?: StartCallOptions) => Promise<void>
  endCall: () => void
  toggleMute: () => void
  startScreenShare: () => Promise<void>
  stopScreenShare: () => void
}

const Ctx = createContext<CallContextValue | null>(null)

// OpenAI Realtime WebRTC call endpoint (new path; the legacy /v1/realtime
// is gone — SDP exchange happens at /v1/realtime/calls).
const REALTIME_URL = 'https://api.openai.com/v1/realtime/calls'
const REALTIME_MODEL = 'gpt-realtime'
const MAX_TRANSCRIPTS = 20

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function CallProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const { openCanvas } = useChat()

  const [isInCall, setIsInCall] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [peerStatus, setPeerStatus] = useState<RTCPeerConnectionState | 'new'>('new')
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([])

  // Refs — mutable without re-renders
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  // Accumulate assistant delta text until 'done'
  const assistantDeltaRef = useRef<string>('')

  // Screen share refs
  const screenStreamRef = useRef<MediaStream | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const screenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Transcript helpers ────────────────────────────────────────────────────

  function appendTranscript(role: 'user' | 'assistant', text: string) {
    if (!text.trim()) return
    setTranscripts((prev) => {
      const line: TranscriptLine = { role, text, id: makeId() }
      const next = [...prev, line]
      return next.length > MAX_TRANSCRIPTS ? next.slice(-MAX_TRANSCRIPTS) : next
    })
  }

  // ── Data channel event handler ────────────────────────────────────────────

  function handleDataChannelMessage(raw: string) {
    let event: Record<string, unknown>
    try {
      event = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }

    const type = event['type'] as string | undefined

    switch (type) {
      // ── Assistant speech transcript (streamed delta) ──────────────────────
      case 'response.audio_transcript.delta': {
        const delta = event['delta'] as string | undefined
        if (delta) assistantDeltaRef.current += delta
        break
      }
      case 'response.audio_transcript.done': {
        const final = (event['transcript'] as string | undefined) ?? assistantDeltaRef.current
        if (final) appendTranscript('assistant', final)
        assistantDeltaRef.current = ''
        break
      }

      // ── User speech transcript ────────────────────────────────────────────
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = event['transcript'] as string | undefined
        if (transcript) appendTranscript('user', transcript)
        break
      }

      // ── Function call results ─────────────────────────────────────────────
      case 'response.function_call_arguments.done': {
        const name = event['name'] as string | undefined
        const callId = event['call_id'] as string | undefined
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(event['arguments'] as string || '{}') as Record<string, unknown>
        } catch {
          args = {}
        }

        if (name === 'rag_search') {
          void handleRagSearch(callId ?? '', args)
        } else if (name === 'open_canvas') {
          void handleOpenCanvas(callId ?? '', args)
        }
        break
      }

      default:
        break
    }
  }

  // ── RAG search handler ────────────────────────────────────────────────────

  async function handleRagSearch(callId: string, args: Record<string, unknown>) {
    if (!token || !dcRef.current || dcRef.current.readyState !== 'open') return

    const query = (args['query'] as string | undefined) ?? ''
    let passages: Array<{ docId: string; docTitle: string; snippet: string }> = []

    try {
      const result = await api<{ passages: typeof passages }>('/api/voice/rag-search', {
        method: 'POST',
        token,
        body: { query },
      })
      passages = result.passages
    } catch {
      passages = []
    }

    const resultText = passages.length > 0
      ? passages.map((p, i) => `[${i + 1}] ${p.docTitle}: ${p.snippet}`).join('\n')
      : 'No relevant passages found.'

    // Send function result back to the model via data channel
    dcRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: resultText,
      },
    }))

    // Ask the model to generate a response now
    dcRef.current.send(JSON.stringify({ type: 'response.create' }))
  }

  // ── Open canvas handler ───────────────────────────────────────────────────

  async function handleOpenCanvas(callId: string, args: Record<string, unknown>) {
    if (!token || !dcRef.current || dcRef.current.readyState !== 'open') return

    const name = (args['name'] as string | undefined) ?? ''
    const canvasArgs = (args['args'] as Record<string, unknown> | undefined) ?? {}

    let ok = false
    try {
      await api('/api/voice/canvas-intent', {
        method: 'POST',
        token,
        body: { name, args: canvasArgs },
      })
      ok = true
      // Dispatch canvas open in the app
      openCanvas(name, canvasArgs)
    } catch {
      ok = false
    }

    // Return result to the model
    dcRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: ok ? `Opened ${name}` : `Could not open ${name} — permission denied or unknown module.`,
      },
    }))
    dcRef.current.send(JSON.stringify({ type: 'response.create' }))
  }

  // ── stopScreenShare ───────────────────────────────────────────────────────

  const stopScreenShare = useCallback(() => {
    if (screenIntervalRef.current !== null) {
      clearInterval(screenIntervalRef.current)
      screenIntervalRef.current = null
    }
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    // Clean up off-screen elements
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null
      screenVideoRef.current = null
    }
    screenCanvasRef.current = null
    setIsScreenSharing(false)
  }, [])

  // ── startScreenShare ──────────────────────────────────────────────────────

  const startScreenShare = useCallback(async () => {
    if (!isInCall || isScreenSharing) return
    if (!dcRef.current || dcRef.current.readyState !== 'open') return

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      screenStreamRef.current = stream

      // Create off-screen video element
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      video.style.display = 'none'
      document.body.appendChild(video)
      screenVideoRef.current = video
      await video.play()

      // Create off-screen canvas element
      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      canvas.style.display = 'none'
      document.body.appendChild(canvas)
      screenCanvasRef.current = canvas

      // Stop when the user clicks browser's native "Stop sharing"
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopScreenShare()
      })

      // Capture and send a frame every 2 seconds
      screenIntervalRef.current = setInterval(() => {
        const vid = screenVideoRef.current
        const cvs = screenCanvasRef.current
        const dc = dcRef.current
        if (!vid || !cvs || !dc || dc.readyState !== 'open') return

        // Preserve aspect ratio, max 1280×720
        const vw = vid.videoWidth || 1280
        const vh = vid.videoHeight || 720
        const scale = Math.min(1280 / vw, 720 / vh, 1)
        const dw = Math.round(vw * scale)
        const dh = Math.round(vh * scale)
        cvs.width = dw
        cvs.height = dh
        const ctx = cvs.getContext('2d')
        if (!ctx) return
        ctx.drawImage(vid, 0, 0, dw, dh)

        const dataUrl = cvs.toDataURL('image/jpeg', 0.6)

        // Send the image as a user message content item.
        // We do NOT auto-trigger response.create on each frame — the model
        // accumulates visual context and will reference the screen when the
        // user's next spoken turn arrives or when the model is already
        // responding.  This avoids the model interrupting itself every 2s.
        try {
          dc.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_image', image_url: dataUrl }],
            },
          }))
        } catch {
          // Data channel closed mid-send — ignore
        }
      }, 2000)

      setIsScreenSharing(true)
    } catch (err) {
      console.error('[CallProvider] startScreenShare error', err)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInCall, isScreenSharing, stopScreenShare])

  // ── startCall ─────────────────────────────────────────────────────────────

  const startCall = useCallback(async (opts?: StartCallOptions) => {
    if (!token || isConnecting || isInCall) return
    setIsConnecting(true)
    setTranscripts([])
    assistantDeltaRef.current = ''

    try {
      // 1. Mint ephemeral session
      const session = await api<SessionResponse>('/api/voice/session', {
        method: 'POST',
        token,
        body: opts?.contextHint ? { contextHint: opts.contextHint } : {},
      })
      const clientSecret = session.client_secret.value

      // 2. Capture microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      // 3. Create RTCPeerConnection
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      pc.onconnectionstatechange = () => {
        setPeerStatus(pc.connectionState)
        if (pc.connectionState === 'connected') {
          setIsInCall(true)
          setIsConnecting(false)
        }
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          setIsInCall(false)
          setIsConnecting(false)
        }
      }

      // 4. Attach remote audio track
      pc.ontrack = (e) => {
        if (!audioRef.current) {
          const el = document.createElement('audio')
          el.autoplay = true
          el.style.display = 'none'
          document.body.appendChild(el)
          audioRef.current = el
        }
        audioRef.current.srcObject = e.streams[0] ?? null
      }

      // 5. Add local audio track
      for (const track of stream.getAudioTracks()) {
        pc.addTrack(track, stream)
      }

      // 6. Open data channel (must be before createOffer)
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onmessage = (e) => handleDataChannelMessage(e.data as string)

      // 7. Create SDP offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // 8. Exchange SDP with OpenAI Realtime endpoint
      const sdpRes = await fetch(`${REALTIME_URL}?model=${REALTIME_MODEL}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })

      if (!sdpRes.ok) {
        throw new Error(`SDP exchange failed: ${sdpRes.status}`)
      }

      const answerSdp = await sdpRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

    } catch (err) {
      console.error('[CallProvider] startCall error', err)
      setIsConnecting(false)
      setIsInCall(false)
      // Clean up partial state
      pcRef.current?.close()
      pcRef.current = null
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isConnecting, isInCall, openCanvas])

  // ── endCall ───────────────────────────────────────────────────────────────

  const endCall = useCallback(() => {
    // Stop screen share first (clears its interval + stream)
    if (screenIntervalRef.current !== null) {
      clearInterval(screenIntervalRef.current)
      screenIntervalRef.current = null
    }
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null
      screenVideoRef.current.remove()
      screenVideoRef.current = null
    }
    if (screenCanvasRef.current) {
      screenCanvasRef.current.remove()
      screenCanvasRef.current = null
    }
    setIsScreenSharing(false)

    pcRef.current?.close()
    pcRef.current = null
    dcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    if (audioRef.current) {
      audioRef.current.srcObject = null
      audioRef.current.remove()
      audioRef.current = null
    }
    setIsInCall(false)
    setIsConnecting(false)
    setIsMuted(false)
    setPeerStatus('new')
    assistantDeltaRef.current = ''
  }, [])

  // ── toggleMute ────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled
    })
    setIsMuted((m) => !m)
  }, [])

  // ── Value ─────────────────────────────────────────────────────────────────

  const value = useMemo<CallContextValue>(
    () => ({
      isInCall,
      isConnecting,
      isMuted,
      isScreenSharing,
      peerStatus,
      transcripts,
      startCall,
      endCall,
      toggleMute,
      startScreenShare,
      stopScreenShare,
    }),
    [isInCall, isConnecting, isMuted, isScreenSharing, peerStatus, transcripts, startCall, endCall, toggleMute, startScreenShare, stopScreenShare],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCall(): CallContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCall called outside CallProvider')
  return v
}
