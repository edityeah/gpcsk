/**
 * Demo personas — one seeded officer per role (apps/api/src/seed/users.ts).
 * Phone OTP is 1234; the role switcher uses POST /api/auth/demo-login.
 */

import type { Role } from '@gpcsk/shared'

export interface DemoUser {
  phone: string
  xgnId: string
  name: string
  contextLabel: string
}

export const DEMO_USERS: Record<Role, DemoUser> = {
  SENIOR_REVIEWER:                { phone: '9000000005', xgnId: 'XGN-SR-001',  name: 'Dr. K. Trivedi', contextLabel: 'Member Secretary · Gandhinagar HQ' },
  CONSENT_OFFICER:                { phone: '9000000001', xgnId: 'XGN-CO-001',  name: 'Anjali Patel',   contextLabel: 'Consent Officer · Gandhinagar HQ' },
  MONITORING_OFFICER:             { phone: '9000000002', xgnId: 'XGN-MO-001',  name: 'Rohit Solanki',  contextLabel: 'Monitoring Officer · Gandhinagar HQ' },
  INSPECTION_ENFORCEMENT_OFFICER: { phone: '9000000003', xgnId: 'XGN-IEO-001', name: 'Mehul Joshi',    contextLabel: 'Inspection & Enforcement · Ahmedabad RO' },
  COMPLAINTS_OFFICER:             { phone: '9000000004', xgnId: 'XGN-CMP-001', name: 'Priya Shah',     contextLabel: 'Complaints Officer · Gandhinagar HQ' },
}

export const DEMO_USER_ORDER: Role[] = [
  'SENIOR_REVIEWER',
  'CONSENT_OFFICER',
  'MONITORING_OFFICER',
  'INSPECTION_ENFORCEMENT_OFFICER',
  'COMPLAINTS_OFFICER',
]

export function getDemoUser(role: Role): DemoUser | null {
  return DEMO_USERS[role] ?? null
}
