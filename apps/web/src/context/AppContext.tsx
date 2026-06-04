import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type Screen =
  | 'splash'
  | 'language'
  | 'login'
  | 'phone_entry'
  | 'phone_otp'
  | 'xgn_redirect'
  | 'xgn_verifying'
  | 'demo_role_picker'
  | 'home'

interface AppContextValue {
  screen: Screen
  setScreen: (s: Screen) => void
}

const Ctx = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('splash')
  const value = useMemo(() => ({ screen, setScreen }), [screen])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp called outside AppProvider')
  return v
}
