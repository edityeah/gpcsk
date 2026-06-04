export const ROLES = [
  'CONSENT_OFFICER',
  'MONITORING_OFFICER',
  'INSPECTION_ENFORCEMENT_OFFICER',
  'COMPLAINTS_OFFICER',
  'SENIOR_REVIEWER',
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, { en: string; gu: string }> = {
  CONSENT_OFFICER:                { en: 'Consent Officer',                gu: 'સંમતિ અધિકારી' },
  MONITORING_OFFICER:             { en: 'Monitoring Officer',             gu: 'દેખરેખ અધિકારી' },
  INSPECTION_ENFORCEMENT_OFFICER: { en: 'Inspection & Enforcement Officer', gu: 'નિરીક્ષણ અને અમલીકરણ અધિકારી' },
  COMPLAINTS_OFFICER:             { en: 'Complaints Officer',             gu: 'ફરિયાદ અધિકારી' },
  SENIOR_REVIEWER:                { en: 'Senior Reviewer',                gu: 'વરિષ્ઠ સમીક્ષક' },
}
