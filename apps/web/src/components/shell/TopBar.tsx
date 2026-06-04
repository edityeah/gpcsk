import { Bell, LayoutDashboard, MessageSquare, User, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext.js'
import { useApp } from '../../context/AppContext.js'

export function TopBar() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { setScreen } = useApp()
  if (!user) return null

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-bdr-light bg-white">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        <span className="font-semibold text-txt-primary">{t('appNameShort')}</span>
        <span className="hidden md:inline text-txt-secondary text-sm">· {t(`roles.${user.role}`)}</span>
      </div>
      <div className="flex items-center gap-1">
        <button className="p-2 rounded-card hover:bg-surface-secondary" title="Notifications"><Bell className="w-5 h-5 text-txt-secondary" /></button>
        <button className="p-2 rounded-card hover:bg-surface-secondary" title="Canvas"><LayoutDashboard className="w-5 h-5 text-txt-secondary" /></button>
        <button className="p-2 rounded-card hover:bg-surface-secondary" title="Profile"><User className="w-5 h-5 text-txt-secondary" /></button>
        <button onClick={() => { signOut(); setScreen('login') }} className="p-2 rounded-card hover:bg-surface-secondary" title={t('common.signOut')}>
          <LogOut className="w-5 h-5 text-txt-secondary" />
        </button>
      </div>
    </header>
  )
}
