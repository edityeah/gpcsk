/**
 * GPCSK Saathi roles — labels, scopes, taglines, home sections, suggestions.
 * Mirrors PM-SETU's roles/roleConfig.js: the home page is a sectioned
 * "Open an app" grid, one section per workflow area, built from the module
 * registry (which already carries role gating + descriptions).
 */

import type { Role } from '@gpcsk/shared'
import { moduleRegistry, type Category, type ModuleEntry } from '../nlp/moduleRegistry.js'

export const ROLE_LABELS: Record<Role, string> = {
  SENIOR_REVIEWER:                'Senior Reviewer',
  CONSENT_OFFICER:                'Consent Officer',
  MONITORING_OFFICER:             'Monitoring Officer',
  INSPECTION_ENFORCEMENT_OFFICER: 'Inspection & Enforcement',
  COMPLAINTS_OFFICER:             'Complaints Officer',
}

export const ROLE_SCOPES: Record<Role, string> = {
  SENIOR_REVIEWER:                'Statewide · all streams',
  CONSENT_OFFICER:                'CTE · CTO · HW authorisations',
  MONITORING_OFFICER:             'OCEMS · AAQM · CETP · VOC',
  INSPECTION_ENFORCEMENT_OFFICER: 'Field inspections · notices',
  COMPLAINTS_OFFICER:             'Citizen complaints · hotspots',
}

export const ROLE_TAGLINE: Record<Role, string> = {
  SENIOR_REVIEWER:                'Saathi · Review, decide, direct',
  CONSENT_OFFICER:                'Saathi · Verify, then consent',
  MONITORING_OFFICER:             'Saathi · Watch every station',
  INSPECTION_ENFORCEMENT_OFFICER: 'Saathi · Inspect, enforce, close',
  COMPLAINTS_OFFICER:             'Saathi · Hear, triage, resolve',
}

/** Emoji glyph per module — tiles and canvas headers (PM-SETU style). */
export const MODULE_EMOJI: Record<string, string> = {
  OPEN_PROGRAMS: '🔬', OPEN_WAR_ROOM: '🚨', OPEN_GUJARAT_PULSE: '🫀', OPEN_INDUSTRY_RISK_INDEX: '⚠️',
  OPEN_ENFORCEMENT_PIPELINE: '⚖️', OPEN_TREND_LAB: '📈', OPEN_MAKER_CHECKER_QUEUE: '✅', OPEN_BROADCAST: '📣',
  OPEN_CONSENT_MANAGEMENT: '📝', OPEN_AI_VERIFICATION: '🛡️', OPEN_APPLICATION_QUEUE: '📥', OPEN_CONSENT_PIPELINE: '🔁',
  OPEN_RENEWAL_RADAR: '🎯', OPEN_CAPACITY_VS_CONSENT: '📊', OPEN_DOCUMENT_COMPLETENESS: '📂', OPEN_CONSENT_DRAFT: '✍️',
  OPEN_OCEMS_LIVE_GRID: '🏭', OPEN_EXCEEDANCE_FEED: '🔴', OPEN_PREDICTED_EXCEEDANCE: '🔮', OPEN_VOC_CLUSTER_MONITOR: '🧪',
  OPEN_CETP_SCORECARD: '💧', OPEN_AAQM_MONITOR: '🌬️', OPEN_FESTIVAL_PLANNER: '🎉',
  OPEN_INSPECTION_PRIORITISATION: '🧭', OPEN_INSPECTION_SCHEDULER: '🗓️', OPEN_ONSITE_CHECKLIST: '📋', OPEN_DRAFT_NOTICE: '📨',
  OPEN_VIOLATIONS_REGISTER: '📕', OPEN_RISK_BASED_INSPECTIONS: '🔍',
  OPEN_COMPLAINT_INBOX: '📞', OPEN_AUTO_TRIAGE: '🧮', OPEN_COMPLAINT_HOTSPOT_MAP: '🗺️', OPEN_INDUSTRY_CORRELATION: '🔗',
  OPEN_CITIZEN_RESPONSE_TRACKER: '💬', OPEN_INDUSTRY_DEEP_DIVE: '🏢', OPEN_NOTIFICATIONS: '🔔', OPEN_REPORT_EXPORT: '📤',
  OPEN_SAATHI: '✨',
}

export function emojiFor(moduleId: string): string {
  return MODULE_EMOJI[moduleId] ?? '🗂'
}

export interface SectionMeta {
  key: string
  title: string
  subtitle: string
  accent: string
  ring: string
  dot: string
  categories: Category[]
}

const S = {
  watch:      { key: 'watch',      title: 'Watch the state',        subtitle: 'Live anomalies, state pulse, risk index, trends, broadcasts', accent: 'from-rose-50 to-white',    ring: 'ring-rose-200',    dot: 'bg-rose-500',    categories: ['WAR_ROOM', 'DASHBOARDS'] as Category[] },
  programs:   { key: 'programs',   title: 'Monitor the programs',   subtitle: 'OCEMS, AAQM, CETP, VOC, festival monitoring',                 accent: 'from-indigo-50 to-white',  ring: 'ring-indigo-200',  dot: 'bg-indigo-500',  categories: ['PROGRAMS'] as Category[] },
  consent:    { key: 'consent',    title: 'Consent & compliance',   subtitle: 'AI-verified applications, approval queue, renewals',         accent: 'from-violet-50 to-white',  ring: 'ring-violet-200',  dot: 'bg-violet-500',  categories: ['CONSENT'] as Category[] },
  enforce:    { key: 'enforce',    title: 'Inspect & enforce',      subtitle: 'Risk-based inspections, field checklists, notices, violations', accent: 'from-amber-50 to-white',   ring: 'ring-amber-200',   dot: 'bg-amber-500',   categories: ['INSPECTION'] as Category[] },
  complaints: { key: 'complaints', title: 'Citizen complaints',     subtitle: 'Inbox, auto-triage, hotspots, industry correlation, replies', accent: 'from-emerald-50 to-white', ring: 'ring-emerald-200', dot: 'bg-emerald-500', categories: ['COMPLAINTS'] as Category[] },
  alerts:     { key: 'alerts',     title: 'Updates & alerts',       subtitle: 'What changed since you last looked',                        accent: 'from-sky-50 to-white',     ring: 'ring-sky-200',     dot: 'bg-sky-500',     categories: [] as Category[] },
} satisfies Record<string, SectionMeta>

export const ROLE_SECTIONS: Record<Role, SectionMeta[]> = {
  SENIOR_REVIEWER:                [S.watch, S.programs, S.consent, S.enforce, S.complaints, S.alerts],
  CONSENT_OFFICER:                [S.consent, S.alerts],
  MONITORING_OFFICER:             [S.programs, S.alerts],
  INSPECTION_ENFORCEMENT_OFFICER: [S.watch, S.enforce, S.alerts],
  COMPLAINTS_OFFICER:             [S.complaints, S.alerts],
}

/** Modules that always sit in the "Updates & alerts" section for every role. */
const ALERT_MODULES = ['OPEN_NOTIFICATIONS']

export interface HomeSection extends SectionMeta {
  tiles: ModuleEntry[]
}

/** Sectioned "Open an app" grid for a role: hub canvases first, then the rest in registry order. */
export function sectionsFor(role: Role): HomeSection[] {
  const visible = moduleRegistry.filter((m) => m.allowedRoles.includes(role) || ALERT_MODULES.includes(m.id))
  return ROLE_SECTIONS[role]
    .map((meta) => {
      const tiles = meta.key === 'alerts'
        ? visible.filter((m) => ALERT_MODULES.includes(m.id))
        : visible.filter((m) => meta.categories.includes(m.category) && !ALERT_MODULES.includes(m.id))
      const ordered = [...tiles.filter((m) => m.isParent), ...tiles.filter((m) => !m.isParent)]
      return { ...meta, tiles: ordered }
    })
    .filter((s) => s.tiles.length > 0)
}

export const ROLE_SUGGESTIONS: Record<Role, string[]> = {
  SENIOR_REVIEWER: [
    "What's the worst anomaly right now?",
    'Which district is hottest this week?',
    'What is waiting for my sign-off?',
    "What's the BOD norm for CETPs?",
    'Top polluters in Ankleshwar',
  ],
  CONSENT_OFFICER: [
    'Which applications have flagged documents?',
    'Renewals due in the next 30 days',
    'What documents does a CTO need?',
    'Industries operating with expired consent',
  ],
  MONITORING_OFFICER: [
    "Today's OCEMS exceedances",
    'Which AAQM stations are live from CPCB?',
    'CETP scorecard for Naroda',
    'Which sensors dropped out this week?',
  ],
  INSPECTION_ENFORCEMENT_OFFICER: [
    'Top inspection priorities today',
    'Which RED industries are overdue?',
    'Draft a show-cause for Vatva Chemicals',
    'Open violations register',
  ],
  COMPLAINTS_OFFICER: [
    'Complaint hotspots this week',
    "Triage today's complaints",
    'Which industries correlate with odour complaints?',
    'Who is still waiting for a reply?',
  ],
}

/** Starter prompts inside the Saathi canvas when it is opened without a screen context. */
export const SAATHI_SUGGESTIONS: Record<Role, string[]> = {
  SENIOR_REVIEWER:                ['Summarise the state of Gujarat today', 'Open the War Room', 'What needs my decision?', 'Explain the maker-checker flow'],
  CONSENT_OFFICER:                ['Open the application queue', 'Which consents expire this month?', 'What is capacity vs consent?', 'Draft a consent order'],
  MONITORING_OFFICER:             ['Open OCEMS live grid', 'Air quality in Vapi right now', 'Which CETP is bypassing?', 'Predict the next exceedance'],
  INSPECTION_ENFORCEMENT_OFFICER: ['Open risk-based inspections', 'Schedule an inspection', 'Draft a closure direction', 'Show the violations register'],
  COMPLAINTS_OFFICER:             ['Open the complaint inbox', 'Show the hotspot map', 'Which complaints are unassigned?', 'Reply to a citizen'],
}

export function suggestionsFor(role: Role | undefined): string[] {
  return role ? ROLE_SUGGESTIONS[role] : []
}
