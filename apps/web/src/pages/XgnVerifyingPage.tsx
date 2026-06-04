// XGN Verifying — spinner page that completes the XGN auth flow.
// Reads the token/user stored by XgnRedirectPage (for XGN browser-form flow)
// OR calls /api/auth/xgn/callback with stored xgnId (for the old radio-select flow).

import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.js'
import { useAuth, type AuthUser } from '../context/AuthContext.js'
import { api } from '../lib/api.js'

const STEPS = [
  'Establishing secure channel…',
  'Verifying XGN credentials…',
  'Fetching role and accreditation…',
  'Loading personalised workspace…',
  'Almost there…',
]

export function XgnVerifyingPage() {
  const { navigate, showToast } = useApp()
  const { setSession } = useAuth()
  const [step, setStep] = useState(0)

  useEffect(() => {
    const tick = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 480)

    async function complete() {
      // Check if XgnRedirectPage already got a token (browser-form path).
      const storedToken = sessionStorage.getItem('gpcsk:pending-xgn-token')
      const storedUserStr = sessionStorage.getItem('gpcsk:pending-xgn-user')

      if (storedToken && storedUserStr) {
        try {
          const user = JSON.parse(storedUserStr) as AuthUser
          sessionStorage.removeItem('gpcsk:pending-xgn-token')
          sessionStorage.removeItem('gpcsk:pending-xgn-user')
          setSession(storedToken, user)
          navigate('home')
        } catch {
          showToast({ kind: 'danger', text: 'Session error. Please try again.' })
          navigate('login')
        }
        return
      }

      // Legacy: radio-select flow stored just the xgnId.
      const xgnId = sessionStorage.getItem('gpcsk:pending-xgn')
      if (!xgnId) { navigate('login'); return }
      try {
        const r = await api<{ token: string; user: AuthUser }>('/api/auth/xgn/callback', {
          method: 'POST', body: { xgnId },
        })
        sessionStorage.removeItem('gpcsk:pending-xgn')
        setSession(r.token, r.user)
        navigate('home')
      } catch {
        showToast({ kind: 'danger', text: 'XGN verification failed. Please try again.' })
        navigate('login')
      }
    }

    const done = setTimeout(complete, 480 * STEPS.length)
    return () => { clearInterval(tick); clearTimeout(done) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pct = ((step + 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-[#0A2540] text-white">
        <div className="tricolor-strip" />
        <div className="px-6 py-3 text-sm">Gujarat NIC Network · XGN</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="bg-white rounded-card shadow-card p-8 w-full max-w-md text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
          <div className="font-medium">{STEPS[step]}</div>
          <div className="w-full mt-6 h-2 bg-slate-100 rounded-pill overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
