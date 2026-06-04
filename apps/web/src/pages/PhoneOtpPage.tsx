// GPCSK Phone OTP — 4-digit boxes. Auto-advance, paste support, 40s resend timer.

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../context/AppContext.js'
import { useAuth, type AuthUser } from '../context/AuthContext.js'
import { api } from '../lib/api.js'
import SwiftChatLogo from '../components/SwiftChatLogo.js'
import GpcbLogo from '../components/GpcbLogo.js'
import { PHONE_KEY } from './PhoneEntryPage.js'

const OTP_LEN = 4
const OTP_TIMER = 40

export function PhoneOtpPage() {
  const { goBack, navigate, showToast } = useApp()
  const { setSession } = useAuth()
  const phone = sessionStorage.getItem(PHONE_KEY) ?? ''

  const [otp, setOtp] = useState<string[]>(Array(OTP_LEN).fill(''))
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [secs, setSecs] = useState(OTP_TIMER)
  const [busy, setBusy] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => setSecs(s => {
      if (s <= 1) { clearInterval(timerRef.current!); return 0 }
      return s - 1
    }), 1000)
    refs.current[0]?.focus()
    return () => clearInterval(timerRef.current!)
  }, [])

  function handleChange(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1)
    setOtp(prev => { const n = [...prev]; n[i] = d; return n })
    setStatus('idle')
    if (d && i < OTP_LEN - 1) refs.current[i + 1]?.focus()
  }
  function handleKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus()
  }
  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN)
    if (!text) return
    e.preventDefault()
    setOtp(prev => {
      const n = [...prev]
      text.split('').forEach((d, i) => { n[i] = d })
      return n
    })
    refs.current[Math.min(text.length, OTP_LEN - 1)]?.focus()
  }

  const filled = otp.every(d => d !== '')

  async function confirm() {
    if (!filled || busy) return
    if (!phone) { navigate('phone_entry'); return }
    setBusy(true)
    try {
      const r = await api<{ token: string; user: AuthUser }>('/api/auth/phone/verify-otp', {
        method: 'POST', body: { phone, otp: otp.join('') },
      })
      setStatus('success')
      setSession(r.token, r.user)
      setTimeout(() => { sessionStorage.removeItem(PHONE_KEY); navigate('home') }, 900)
    } catch {
      setStatus('error')
      setBusy(false)
    }
  }

  function resend() {
    clearInterval(timerRef.current!)
    setSecs(OTP_TIMER)
    setOtp(Array(OTP_LEN).fill(''))
    setStatus('idle')
    refs.current[0]?.focus()
    timerRef.current = setInterval(() => setSecs(s => {
      if (s <= 1) { clearInterval(timerRef.current!); return 0 }
      return s - 1
    }), 1000)
    api('/api/auth/phone/request-otp', { method: 'POST', body: { phone } }).catch(() => {})
    showToast({ kind: 'success', text: 'OTP resent ✓' })
  }

  function boxStyle(d: string): React.CSSProperties {
    const base: React.CSSProperties = { width: 56, height: 56, fontSize: 24, fontWeight: 700, borderRadius: 16, border: '2px solid', outline: 'none', textAlign: 'center', fontFamily: 'Montserrat, sans-serif' }
    if (status === 'error')   return { ...base, background: '#FFF0F0', borderColor: '#EF4444', color: '#EF4444' }
    if (status === 'success') return { ...base, background: '#F0FFF4', borderColor: '#10B981', color: '#10B981' }
    if (d)                    return { ...base, background: '#EEF3FF', borderColor: '#386AF6', color: '#1A1F36' }
    return { ...base, background: '#F8FAFC', borderColor: '#E2E8F0', color: '#1A1F36' }
  }

  const mask = phone ? `+91 ••••• ${phone.slice(-5)}` : '+91 ••••• •••••'

  const formBody = (
    <div className="px-6 pb-6">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold leading-tight mb-2" style={{ color: '#1A1F36' }}>
          Enter your<br />
          <span style={{ color: '#386AF6' }}>Verification code</span>
        </h1>
        <p className="text-[14px] text-txt-secondary leading-relaxed">
          Please enter the {OTP_LEN}-digit code sent to <span className="font-semibold text-txt-primary">{mask}</span>{' '}
          <button onClick={goBack} className="text-primary font-semibold">✏️</button>
        </p>
      </div>

      <div className="flex gap-3 mb-2" onPaste={handlePaste}>
        {otp.map((d, i) => (
          <input key={i} ref={el => { refs.current[i] = el }}
            type="tel" inputMode="numeric" maxLength={1} autoComplete="one-time-code"
            value={d} onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKey(i, e)}
            style={boxStyle(d)} />
        ))}
      </div>

      <div className="h-6 mb-4">
        {status === 'error'   && <p className="text-[13px] font-semibold" style={{ color: '#EF4444' }}>Oops! Wrong code. Please try again.</p>}
        {status === 'success' && <p className="text-[13px] font-semibold" style={{ color: '#10B981' }}>Hurray! OTP Verification Successful 🎉</p>}
      </div>

      <button onClick={confirm} disabled={!filled || status === 'success' || busy}
        className="w-full py-4 rounded-2xl font-bold text-[16px] text-white disabled:opacity-40 disabled:pointer-events-none"
        style={{
          background: filled ? 'linear-gradient(135deg, #386AF6 0%, #5B85F8 100%)' : '#CBD5E1',
          boxShadow: filled ? '0 4px 16px rgba(56,106,246,0.35)' : 'none',
        }}>
        Confirm
      </button>

      <div className="flex items-center justify-center mt-5">
        {secs > 0
          ? <p className="text-[13px] text-txt-secondary">Resend code in <span className="font-bold text-primary">{secs}s</span></p>
          : <p className="text-[13px] text-txt-secondary">Did not receive code? <button onClick={resend} className="font-bold text-primary">Resend OTP</button></p>}
      </div>

      <p className="text-center text-[10px] text-txt-tertiary mt-4">Demo OTP is <span className="font-mono font-bold">1234</span></p>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="hidden md:flex flex-col overflow-hidden"
        style={{ flex: '1 1 0', background: 'linear-gradient(135deg, #EEF3FF 0%, #F5F0FF 100%)' }}>
        <div className="p-6">
          <button onClick={goBack} className="inline-flex items-center gap-1 text-[13px] font-semibold text-txt-secondary hover:text-txt-primary">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-10 text-center">
          <div className="text-[140px]">🔐</div>
          <h3 className="text-[18px] font-bold text-txt-primary">Quick &amp; Secure</h3>
          <p className="text-[13px] text-txt-secondary max-w-[260px] leading-relaxed mx-auto">Your OTP expires in {OTP_TIMER} seconds. Never share it with anyone.</p>
        </div>
      </div>

      <div className="md:hidden flex-1 flex flex-col overflow-y-auto bg-white">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <button onClick={goBack} className="inline-flex items-center gap-1 text-[13px] font-semibold text-txt-secondary hover:text-txt-primary px-2 py-1 rounded-lg hover:bg-slate-100">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className='flex items-center gap-3'><SwiftChatLogo size={26} /><div className='w-px h-6 bg-bdr' /><GpcbLogo size={22} showText={false} /></div>
        </div>
        {formBody}
      </div>

      <div className="hidden md:flex flex-col justify-center" style={{ width: 'clamp(340px, 38%, 460px)', flexShrink: 0, padding: '0 16px' }}>
        <div className="px-6 mb-6 mt-6">
          <div className='flex items-center gap-3'><SwiftChatLogo size={28} /><div className='w-px h-6 bg-bdr' /><GpcbLogo size={24} showText={false} /></div>
        </div>
        {formBody}
      </div>
    </div>
  )
}
