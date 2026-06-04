import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Screen =
  | 'splash'
  | 'login'
  | 'phone_entry'
  | 'phone_otp'
  | 'xgn_redirect'
  | 'xgn_verifying'
  | 'demo_role_picker'
  | 'home'

export type Lang = 'en' | 'gu' | 'hi'

export interface ToastPayload {
  kind?: 'info' | 'success' | 'warn' | 'danger'
  text: string
  duration?: number
}

interface AppContextValue {
  screen: Screen
  /** @deprecated use navigate() */
  setScreen: (s: Screen) => void
  navigate: (s: Screen, replace?: boolean) => void
  goBack: () => void
  lang: Lang
  setLang: (code: Lang) => void
  toast: ToastPayload | null
  showToast: (t: ToastPayload) => void
}

const Ctx = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreenRaw] = useState<Screen>('splash')
  const [stack, setStack] = useState<Screen[]>(['splash'])
  const [lang, setLangRaw] = useState<Lang>('en')
  const [toast, setToast] = useState<ToastPayload | null>(null)

  const navigate = useCallback((id: Screen, replace = false) => {
    setScreenRaw(id)
    setStack(s => replace ? [...s.slice(0, -1), id] : [...s, id])
  }, [])

  const goBack = useCallback(() => {
    setStack(s => {
      if (s.length <= 1) return s
      const next = s.slice(0, -1)
      const prev = next[next.length - 1]
      if (prev) setScreenRaw(prev)
      return next
    })
  }, [])

  // setScreen kept for backwards compat — behaves like navigate
  const setScreen = useCallback((s: Screen) => navigate(s), [navigate])

  const setLang = useCallback((code: Lang) => setLangRaw(code), [])

  const showToast = useCallback((t: ToastPayload) => {
    setToast(t)
    const dur = t.duration ?? 2500
    setTimeout(() => setToast(null), dur)
  }, [])

  const value = useMemo<AppContextValue>(() => ({
    screen, setScreen, navigate, goBack,
    lang, setLang,
    toast, showToast,
  }), [screen, setScreen, navigate, goBack, lang, setLang, toast, showToast])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp called outside AppProvider')
  return v
}
