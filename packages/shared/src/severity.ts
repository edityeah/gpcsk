export const SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const
export type Severity = (typeof SEVERITIES)[number]

export const MAKER_CHECKER_STATES = [
  'DRAFT',
  'PENDING_REVIEW',
  'COMMITTED',
  'RETURNED_FOR_REVISION',
  'WITHDRAWN',
] as const
export type MakerCheckerState = (typeof MAKER_CHECKER_STATES)[number]
