// GPCSK Demo Role Picker — KSK button style + SwiftChat/GPCB header.

import { ChevronLeft } from 'lucide-react'
import { ROLES, type Role } from '@gpcsk/shared'
import { useApp } from '../context/AppContext.js'
import { useAuth, type AuthUser } from '../context/AuthContext.js'
import { api } from '../lib/api.js'
import SwiftChatLogo from '../components/SwiftChatLogo.js'
import GpcbLogo from '../components/GpcbLogo.js'

const ROLE_LABELS: Record<string, string> = {
  CONSENT_OFFICER:                'Consent Officer',
  MONITORING_OFFICER:             'Monitoring Officer',
  INSPECTION_ENFORCEMENT_OFFICER: 'Inspection & Enforcement Officer',
  COMPLAINTS_OFFICER:             'Complaints Officer',
  SENIOR_REVIEWER:                'Senior Reviewer',
}

const ROLE_DESCS: Record<string, string> = {
  CONSENT_OFFICER:                'Manages consent applications and compliance decisions for industrial units.',
  MONITORING_OFFICER:             'Oversees ambient air quality, CETP effluent, and OCEMS data streams.',
  INSPECTION_ENFORCEMENT_OFFICER: 'Conducts site inspections and enforces environmental directives.',
  COMPLAINTS_OFFICER:             'Handles public complaints about pollution incidents.',
  SENIOR_REVIEWER:                'Member Secretary / Senior Reviewer overseeing all GPCSK workflows.',
}

export function DemoRolePickerPage() {
  const { goBack, navigate, showToast } = useApp()
  const { setSession } = useAuth()

  async function pick(role: Role) {
    try {
      const { token, user } = await api<{ token: string; user: AuthUser }>('/api/auth/demo-login', {
        method: 'POST', body: { role },
      })
      setSession(token, user)
      navigate('home')
    } catch {
      showToast({ kind: 'danger', text: 'Demo login failed. Please try again.' })
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-bdr-light">
        <button onClick={goBack} className="inline-flex items-center gap-1 text-[13px] font-semibold text-txt-secondary hover:text-txt-primary px-2 py-1 rounded-lg hover:bg-slate-100">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className='flex items-center gap-3'>
          <SwiftChatLogo size={26} />
          <div className='w-px h-6 bg-bdr' />
          <GpcbLogo size={22} showText={false} />
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center px-6 pt-8 pb-12">
        <div className="w-full max-w-md">
          <h2 className="text-[24px] font-bold text-txt-primary mb-1">Demo Role Picker</h2>
          <p className="text-txt-secondary text-[14px] mb-6">Pick a role to sign in as. Only available in development.</p>

          <div className="flex flex-col gap-3">
            {ROLES.map(role => (
              <button
                key={role}
                onClick={() => pick(role)}
                className="text-left rounded-card bg-white border border-bdr-light px-4 py-3 hover:border-primary hover:shadow-card transition-all active:scale-[0.98]"
              >
                <div className="font-bold text-[14px] text-txt-primary">{ROLE_LABELS[role] ?? role}</div>
                <div className="text-[12px] text-txt-secondary mt-0.5 leading-snug">{ROLE_DESCS[role] ?? ''}</div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
