export const CONSENT_TYPES = ['CTE', 'CTO', 'HW_AUTH'] as const
export type ConsentType = (typeof CONSENT_TYPES)[number]

export const CONSENT_STATES = [
  'DRAFT',
  'UNDER_REVIEW',
  'RECOMMENDED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'RENEWED',
] as const
export type ConsentState = (typeof CONSENT_STATES)[number]

export const INDUSTRY_CATEGORIES = ['RED', 'ORANGE', 'GREEN', 'WHITE'] as const
export type IndustryCategory = (typeof INDUSTRY_CATEGORIES)[number]
