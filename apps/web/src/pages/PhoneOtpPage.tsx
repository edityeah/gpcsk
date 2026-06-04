import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useApp } from '../context/AppContext.js'
import { useAuth, type AuthUser } from '../context/AuthContext.js'
import { api } from '../lib/api.js'
import { PHONE_KEY } from './PhoneEntryPage.js'

export function PhoneOtpPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()
  const { setSession } = useAuth()
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const phone = sessionStorage.getItem(PHONE_KEY) ?? ''
    if (!phone) { setScreen('phone_entry'); return }
    setBusy(true); setErr(null)
    try {
      const { token, user } = await api<{ token: string; user: AuthUser }>('/api/auth/phone/verify-otp', { method: 'POST', body: { phone, otp } })
      setSession(token, user)
      sessionStorage.removeItem(PHONE_KEY)
      setScreen('home')
    } catch (e) {
      const code = (e as { code?: string }).code
      setErr(code === 'invalid_otp' ? t('phone.invalidOtp') : t('phone.userNotFound'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-page">
      <header className="px-6 py-4">
        <button onClick={() => setScreen('phone_entry')} className="flex items-center gap-2 text-txt-secondary hover:text-txt-primary">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold mb-1">{t('phone.otpTitle')}</h2>
          <p className="text-txt-secondary text-sm mb-6">{t('phone.otpSubtitle')}</p>
          <input
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••"
            className="w-full rounded-card border border-bdr px-4 py-3 text-2xl tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-primary"
            inputMode="numeric"
          />
          {err && <p className="text-danger text-sm mt-2">{err}</p>}
          <button onClick={submit} disabled={busy || otp.length < 4} className="mt-6 w-full rounded-card bg-primary text-white py-3 font-medium shadow-card hover:bg-primary-dark disabled:opacity-50">
            {busy ? t('common.loading') : t('phone.verify')}
          </button>
        </div>
      </main>
    </div>
  )
}
