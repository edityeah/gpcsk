import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { ROLES, type Role } from '@gpcsk/shared'
import { useApp } from '../context/AppContext.js'
import { useAuth, type AuthUser } from '../context/AuthContext.js'
import { api } from '../lib/api.js'

export function DemoRolePickerPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()
  const { setSession } = useAuth()

  async function pick(role: Role) {
    try {
      const { token, user } = await api<{ token: string; user: AuthUser }>('/api/auth/demo-login', { method: 'POST', body: { role } })
      setSession(token, user)
      setScreen('home')
    } catch {
      setScreen('login')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-page">
      <header className="px-6 py-4">
        <button onClick={() => setScreen('login')} className="flex items-center gap-2 text-txt-secondary hover:text-txt-primary">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </button>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <h2 className="text-xl font-semibold mb-1">{t('demo.title')}</h2>
        <p className="text-txt-secondary text-sm mb-6 text-center">{t('demo.subtitle')}</p>
        <div className="w-full max-w-sm flex flex-col gap-2">
          {ROLES.map(role => (
            <button key={role} onClick={() => pick(role)} className="rounded-card bg-white border border-bdr px-4 py-3 text-left shadow-card hover:bg-surface-secondary">
              <div className="font-medium text-txt-primary">{t(`roles.${role}`)}</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
