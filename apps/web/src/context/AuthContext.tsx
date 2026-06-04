import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '@gpcsk/shared'
import { api } from '../lib/api.js'

export interface AuthUser {
  id: string
  name: string
  role: Role
  region?: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  setSession: (token: string, user: AuthUser) => void
  signOut: () => void
}

const Ctx = createContext<AuthContextValue | null>(null)
const KEY = 'gpcsk:auth'

interface Stored { token: string; user: AuthUser }

function readStored(): Stored | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as Stored } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser]   = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = readStored()
    if (!stored) { setLoading(false); return }
    api<AuthUser>('/api/me', { token: stored.token })
      .then((me) => { setToken(stored.token); setUser(me) })
      .catch(() => localStorage.removeItem(KEY))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user, token, loading,
    setSession: (t, u) => {
      setToken(t); setUser(u)
      localStorage.setItem(KEY, JSON.stringify({ token: t, user: u }))
    },
    signOut: () => {
      setToken(null); setUser(null)
      localStorage.removeItem(KEY)
    },
  }), [user, token, loading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
