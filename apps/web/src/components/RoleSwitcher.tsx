/**
 * RoleSwitcher — dropdown that lets a signed-in officer hot-swap to any other
 * demo persona (PM-SETU behaviour). Rendered above the profile pill at the
 * bottom of the sidebar.
 *
 * Demo-only affordance: uses POST /api/auth/demo-login, which only exists for
 * the seeded officers. Gate behind a feature flag before any real rollout.
 */

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import type { Role } from '@gpcsk/shared'
import { useAuth, type AuthUser } from '../context/AuthContext.js'
import { useApp } from '../context/AppContext.js'
import { api } from '../lib/api.js'
import { ROLE_LABELS } from '../roles/roleConfig.js'
import { DEMO_USERS, DEMO_USER_ORDER } from '../roles/demoUsers.js'

const ROLE_AVATAR_TONE: Record<Role, { bg: string; text: string }> = {
  SENIOR_REVIEWER:                { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  CONSENT_OFFICER:                { bg: 'bg-violet-100',  text: 'text-violet-700' },
  MONITORING_OFFICER:             { bg: 'bg-sky-100',     text: 'text-sky-700' },
  INSPECTION_ENFORCEMENT_OFFICER: { bg: 'bg-amber-100',   text: 'text-amber-700' },
  COMPLAINTS_OFFICER:             { bg: 'bg-emerald-100', text: 'text-emerald-700' },
}

function initial(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  const first = parts.find((p) => !p.endsWith('.')) ?? parts[0] ?? '?'
  return first.charAt(0).toUpperCase()
}

export default function RoleSwitcher({ onClose }: { onClose?: () => void }) {
  const { user, setSession, signOut } = useAuth()
  const { navigate, showToast } = useApp()
  const [switching, setSwitching] = useState<Role | null>(null)
  const role = user?.role

  async function pickRole(target: Role) {
    if (target === role) { onClose?.(); return }
    setSwitching(target)
    try {
      const r = await api<{ token: string; user: AuthUser }>('/api/auth/demo-login', {
        method: 'POST', body: { role: target },
      })
      setSession(r.token, r.user)
      onClose?.()
    } catch {
      showToast({ kind: 'danger', text: `Couldn't switch to ${ROLE_LABELS[target]} — check seeded user.` })
    } finally {
      setSwitching(null)
    }
  }

  function handleSignOut() {
    signOut()
    navigate('login')
    onClose?.()
  }

  return (
    <div className="bg-white rounded-2xl shadow-modal border border-bdr-light p-1.5 min-w-[280px]">
      <div className="px-3 py-2 text-[10px] uppercase tracking-[2px] font-bold text-txt-tertiary border-b border-bdr-light">
        Switch user
      </div>
      <div className="py-1">
        {DEMO_USER_ORDER.map((r) => {
          const demo = DEMO_USERS[r]
          const active = r === role
          const isSwitchingHere = switching === r
          const tone = ROLE_AVATAR_TONE[r]
          return (
            <button
              key={r}
              type="button"
              onClick={() => { void pickRole(r) }}
              disabled={!!switching}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                active ? 'bg-primary-light/40' : 'hover:bg-surface-page'
              } disabled:opacity-60 disabled:cursor-wait`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 ${tone.bg} ${tone.text}`}>
                {initial(demo.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-txt-primary leading-tight">{ROLE_LABELS[r]}</div>
                <div className="text-[11px] text-txt-secondary truncate">{demo.name} · {demo.contextLabel}</div>
              </div>
              {isSwitchingHere && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />}
              {active && !isSwitchingHere && (
                <span className="text-[11px] font-bold text-primary flex-shrink-0">Active</span>
              )}
            </button>
          )
        })}
      </div>
      <div className="border-t border-bdr-light mt-1 pt-1">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold text-danger hover:bg-rose-50"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  )
}
