import { useEffect, type ReactElement } from 'react'
import { useApp, type Screen } from './context/AppContext.js'
import { useAuth } from './context/AuthContext.js'
import { SplashPage } from './pages/SplashPage.js'
import { LanguagePage } from './pages/LanguagePage.js'
import { LoginPage } from './pages/LoginPage.js'
import { PhoneEntryPage } from './pages/PhoneEntryPage.js'
import { PhoneOtpPage } from './pages/PhoneOtpPage.js'
import { XgnRedirectPage } from './pages/XgnRedirectPage.js'
import { XgnVerifyingPage } from './pages/XgnVerifyingPage.js'
import { DemoRolePickerPage } from './pages/DemoRolePickerPage.js'
import { SuperHomePage } from './pages/SuperHomePage.js'

const ROUTES: Record<Screen, ReactElement> = {
  splash:           <SplashPage />,
  language:         <LanguagePage />,
  login:            <LoginPage />,
  phone_entry:      <PhoneEntryPage />,
  phone_otp:        <PhoneOtpPage />,
  xgn_redirect:     <XgnRedirectPage />,
  xgn_verifying:    <XgnVerifyingPage />,
  demo_role_picker: <DemoRolePickerPage />,
  home:             <SuperHomePage />,
}

export default function App() {
  const { screen, setScreen } = useApp()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (user && screen !== 'home') setScreen('home')
  }, [loading, user, screen, setScreen])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page">
        <div className="text-txt-secondary">Loading…</div>
      </div>
    )
  }
  return ROUTES[screen]
}
