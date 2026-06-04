import { useEffect, type ReactElement } from 'react'
import { useApp, type Screen } from './context/AppContext.js'
import { useAuth } from './context/AuthContext.js'
import { SplashPage } from './pages/SplashPage.js'
import { LoginPage } from './pages/LoginPage.js'
import { PhoneEntryPage } from './pages/PhoneEntryPage.js'
import { PhoneOtpPage } from './pages/PhoneOtpPage.js'
import { XgnRedirectPage } from './pages/XgnRedirectPage.js'
import { XgnVerifyingPage } from './pages/XgnVerifyingPage.js'
import { DemoRolePickerPage } from './pages/DemoRolePickerPage.js'
import { SuperHomePage } from './pages/SuperHomePage.js'
import Toast from './components/Toast.js'

const ROUTES: Record<Screen, ReactElement> = {
  splash:           <SplashPage />,
  login:            <LoginPage />,
  phone_entry:      <PhoneEntryPage />,
  phone_otp:        <PhoneOtpPage />,
  xgn_redirect:     <XgnRedirectPage />,
  xgn_verifying:    <XgnVerifyingPage />,
  demo_role_picker: <DemoRolePickerPage />,
  home:             <SuperHomePage />,
}

export default function App() {
  const { screen, navigate } = useApp()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (user && screen !== 'home') navigate('home')
  }, [loading, user, screen, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page">
        <div className="text-txt-secondary">Loading…</div>
      </div>
    )
  }
  return (
    <>
      {ROUTES[screen]}
      <Toast />
    </>
  )
}
