import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext.js'
import { useAuth, type AuthUser } from '../context/AuthContext.js'
import { api } from '../lib/api.js'

export function XgnVerifyingPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()
  const { setSession } = useAuth()

  useEffect(() => {
    const xgnId = sessionStorage.getItem('gpcsk:pending-xgn')
    if (!xgnId) { setScreen('login'); return }
    api<{ token: string; user: AuthUser }>('/api/auth/xgn/callback', { method: 'POST', body: { xgnId } })
      .then(({ token, user }) => {
        setSession(token, user)
        sessionStorage.removeItem('gpcsk:pending-xgn')
        setScreen('home')
      })
      .catch(() => setScreen('login'))
  }, [setSession, setScreen])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page">
      <p className="text-txt-secondary animate-pulse">{t('xgn.verifying')}</p>
    </div>
  )
}
