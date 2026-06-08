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
  peerStatus: RTCPeerConnectionState | 'new'
  transcripts: TranscriptLine[]
  startCall: (opts?: StartCallOptions) => Promise<void>
  endCall: () => void
  toggleMute: () => void
}

const Ctx = createContext<CallContextValue | null>(null)

const REALTIME_URL = 'https://api.openai.com/v1/realtime'
const REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17'
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
  const [peerStatus, setPeerStatus] = useState<RTCPeerConnectionState | 'new'>('new')
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([])

  // Refs — mutable without re-renders
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  // Accumulate assistant delta text until 'done'
  const assistantDeltaRef = useRef<string>('')

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
      peerStatus,
      transcripts,
      startCall,
      endCall,
      toggleMute,
    }),
    [isInCall, isConnecting, isMuted, peerStatus, transcripts, startCall, endCall, toggleMute],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCall(): CallContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCall called outside CallProvider')
  return v
}
