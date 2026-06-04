import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useApp } from '../context/AppContext.js'
import { api } from '../lib/api.js'

const PHONE_KEY = 'gpcsk:pending-phone'

export function PhoneEntryPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()
  const [phone, setPhone] = useState('')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)

  async function submit() {
    if (!/^\d{10}$/.test(phone)) { setErr('Enter a 10-digit phone'); return }
    setBusy(true); setErr(null)
    try {
      await api('/api/auth/phone/request-otp', { method: 'POST', body: { phone } })
      sessionStorage.setItem(PHONE_KEY, phone)
      setScreen('phone_otp')
    } catch {
      setErr('Could not send OTP. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-page">
      <header className="px-6 py-4">
        <button onClick={() => setScreen('login')} className="flex items-center gap-2 text-txt-secondary hover:text-txt-primary">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold text-txt-primary mb-1">{t('phone.enterTitle')}</h2>
          <p className="text-txt-secondary mb-6 text-sm">{t('phone.otpSubtitle')}</p>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder={t('phone.enterPlaceholder')}
            className="w-full rounded-card border border-bdr px-4 py-3 text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
            inputMode="numeric"
          />
          {err && <p className="text-danger text-sm mt-2">{err}</p>}
          <button onClick={submit} disabled={busy} className="mt-6 w-full rounded-card bg-primary text-white py-3 font-medium shadow-card hover:bg-primary-dark disabled:opacity-50">
            {busy ? t('common.loading') : t('phone.sendOtp')}
          </button>
        </div>
      </main>
    </div>
  )
}

export { PHONE_KEY }
