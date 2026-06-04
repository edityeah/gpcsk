import { useTranslation } from 'react-i18next'
import { Phone, Building2, FlaskConical } from 'lucide-react'
import { useApp } from '../context/AppContext.js'
import { TricolorStrip } from '../components/TricolorStrip.js'

export function LoginPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()

  const buttons = [
    { icon: Phone,         label: t('login.phone'), onClick: () => setScreen('phone_entry') },
    { icon: Building2,     label: t('login.xgn'),   onClick: () => setScreen('xgn_redirect') },
    { icon: FlaskConical,  label: t('login.demo'),  onClick: () => setScreen('demo_role_picker') },
  ] as const

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page px-6">
      <TricolorStrip className="w-40 mb-8 rounded" />
      <h2 className="text-2xl font-semibold text-txt-primary text-center">{t('login.title')}</h2>
      <p className="text-txt-secondary mt-2 mb-8 text-center">{t('login.subtitle')}</p>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {buttons.map(({ icon: Icon, label, onClick }) => (
          <button key={label} onClick={onClick} className="w-full flex items-center gap-3 rounded-card bg-white border border-bdr px-4 py-3 text-left shadow-card hover:bg-surface-secondary">
            <Icon className="w-5 h-5 text-primary" />
            <span className="font-medium text-txt-primary">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
