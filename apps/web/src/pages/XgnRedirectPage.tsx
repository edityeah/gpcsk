// XGN login form — fake browser URL bar + Govt of Gujarat / NIC header.
// Retargeted from KSK SidhRedirectPage to XGN, Gujarat NIC portal.

import { useState } from 'react'
import { Lock, ShieldCheck, ExternalLink, ChevronLeft } from 'lucide-react'
import { useApp } from '../context/AppContext.js'
import { api } from '../lib/api.js'
import GpcbLogo from '../components/GpcbLogo.js'
import SwiftChatLogo from '../components/SwiftChatLogo.js'
import { type AuthUser } from '../context/AuthContext.js'
import { useAuth } from '../context/AuthContext.js'

const DEMO_BY_ROLE: Record<string, { id: string; name: string }> = {
  consent_officer:                { id: 'XGN-CO-001',  name: 'Anjali Patel (Consent Officer)' },
  monitoring_officer:             { id: 'XGN-MO-001',  name: 'Rohit Solanki (Monitoring Officer)' },
  inspection_enforcement_officer: { id: 'XGN-IEO-001', name: 'Mehul Joshi (Inspection & Enforcement)' },
  complaints_officer:             { id: 'XGN-CMP-001', name: 'Priya Shah (Complaints Officer)' },
  senior_reviewer:                { id: 'XGN-SR-001',  name: 'Dr. K. Trivedi (Senior Reviewer / Member Secretary)' },
}
const DEFAULT_ROLE = 'senior_reviewer'

export function XgnRedirectPage() {
  const { goBack, navigate, showToast } = useApp()
  const { setSession } = useAuth()

  const [xgnId, setXgnId] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [busy, setBusy] = useState(false)

  const demoCreds = DEMO_BY_ROLE[DEFAULT_ROLE] ?? { id: 'XGN-SR-001', name: 'Dr. K. Trivedi (Senior Reviewer)' }

  function fillDemo() { setXgnId(demoCreds.id); setPassword('Demo@123'); setCaptcha('A8K2P') }

  async function submit() {
    if (!xgnId || !password) { showToast({ kind: 'warn', text: 'Enter XGN ID and password' }); return }
    setBusy(true)
    try {
      const r = await api<{ token: string; user: AuthUser }>('/api/auth/xgn/callback', {
        method: 'POST', body: { xgnId },
      })
      sessionStorage.setItem('gpcsk:pending-xgn-token', r.token)
      sessionStorage.setItem('gpcsk:pending-xgn-user', JSON.stringify(r.user))
      navigate('xgn_verifying')
    } catch {
      showToast({ kind: 'danger', text: 'Invalid XGN credentials' })
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Fake browser URL bar */}
      <div className="bg-white border-b border-bdr-light px-4 py-2 flex items-center gap-2">
        <button onClick={goBack} className="p-1 -ml-1 rounded hover:bg-slate-100">
          <ChevronLeft className="w-4 h-4 text-txt-secondary" />
        </button>
        <Lock className="w-4 h-4 text-ok" />
        <div className="text-xs font-mono text-txt-secondary truncate flex-1">https://xgn.gujarat.gov.in/auth/login</div>
        <ExternalLink className="w-4 h-4 text-txt-tertiary" />
      </div>

      {/* Govt header */}
      <div className="bg-[#0A2540] text-white">
        <div style={{ background: 'linear-gradient(to right, #FF9933 33%, #FFFFFF 33% 66%, #138808 66%)', height: 4 }} />
        <div className="px-6 py-4 flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded hover:bg-white/10 md:hidden">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="bg-white rounded-lg p-1.5 flex items-center"><GpcbLogo size={28} showText={false} /></div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider opacity-80">Government of Gujarat · NIC</div>
            <div className="font-semibold">Gujarat NIC Network · XGN</div>
          </div>
          <div className="hidden md:block bg-white rounded-lg px-2 py-1"><SwiftChatLogo size={22} showText={false} /></div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="bg-white rounded-card shadow-card w-full max-w-md border border-bdr-light">
          <div className="px-6 py-5 border-b border-bdr-light flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary-dark" />
              <div className="font-semibold">Sign in with XGN</div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1">XGN ID</label>
              <input value={xgnId} onChange={e => setXgnId(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-bdr-light rounded outline-none focus:border-primary" placeholder={demoCreds.id} />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1">Password</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                className="w-full px-3 py-2 border border-bdr-light rounded outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1">Captcha</label>
              <div className="flex gap-2">
                <div className="px-3 py-2 bg-slate-100 rounded font-mono select-none">A8K2P</div>
                <input value={captcha} onChange={e => setCaptcha(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 border border-bdr-light rounded outline-none focus:border-primary" placeholder="Enter captcha" />
              </div>
            </div>
            <button onClick={submit} disabled={busy} className="w-full py-2.5 rounded bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50">
              {busy ? 'Verifying…' : 'Sign in'}
            </button>
            <button onClick={fillDemo} className="w-full py-2 text-xs text-primary-dark hover:underline">
              Use demo credentials · <b>{demoCreds.name}</b>
            </button>
            <button onClick={goBack} className="w-full py-1 text-xs text-txt-secondary hover:text-txt-primary">← Back to login</button>
          </div>
          <div className="px-6 py-3 bg-slate-50 border-t border-bdr-light text-xs text-txt-tertiary text-center">
            © Gujarat NIC Network · Government of Gujarat
          </div>
        </div>
      </div>
    </div>
  )
}
