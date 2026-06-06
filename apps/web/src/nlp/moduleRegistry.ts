/**
 * Web-side module registry — mirrors apps/api/src/ai/actionRegistry.ts.
 *
 * Each entry describes a canvas module that the AI can open via a tool call,
 * or that the home page can render as a FeatureCard tile. Components are
 * wrapped in React.lazy() so that CanvasOverlay can code-split.
 *
 * The action `id` is the same string the API emits in
 *   { kind: 'canvas', module: '<id>', args }.
 *
 * `allowedRoles` mirrors the API's role gating.
 * `tone`         drives the FeatureCard icon background / text colour.
 * `description`  is shown as the card sub-line in the greeting grid.
 */

import { lazy, type LazyExoticComponent, type ComponentType } from 'react'
import type { Role } from '@gpcsk/shared'

export type SidebarGroup = 'Dashboards' | 'Workflows' | 'Tools'

export type Tone =
  | 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet'
  | 'orange' | 'teal' | 'fuchsia' | 'lime' | 'cyan' | 'pink' | 'slate'

export interface ModuleEntry {
  /** Action ID — matches apps/api/src/ai/actionRegistry.ts */
  id: string
  /** Lazy-loaded React component */
  component: LazyExoticComponent<ComponentType<any>>
  /** Roles permitted to see / open this module */
  allowedRoles: Role[]
  /** Trilingual short label */
  label: { en: string; gu: string; hi: string }
  /** lucide-react icon name (e.g. 'Activity') */
  icon: string
  /** Card icon background tone */
  tone: Tone
  /** One-liner description shown on the FeatureCard */
  description: string
  /** Sidebar grouping bucket */
  sidebarGroup: SidebarGroup
}

// ────────────────────────────────────────────────────────────────────────────
// Senior Reviewer mega-dashboards
// ────────────────────────────────────────────────────────────────────────────

const OPEN_WAR_ROOM: ModuleEntry = {
  id: 'OPEN_WAR_ROOM',
  component: lazy(() =>
    import('../canvas/modules/senior-reviewer/WarRoomCanvas.js').then((m) => ({
      default: m.WarRoomCanvas,
    })),
  ),
  allowedRoles: ['SENIOR_REVIEWER', 'INSPECTION_ENFORCEMENT_OFFICER'],
  label: { en: 'War Room', gu: 'વોર રૂમ', hi: 'वॉर रूम' },
  icon: 'Siren',
  tone: 'rose',
  description: 'Live anomalies — investigate + act',
  sidebarGroup: 'Dashboards',
}

const OPEN_GUJARAT_PULSE: ModuleEntry = {
  id: 'OPEN_GUJARAT_PULSE',
  component: lazy(() =>
    import('../canvas/modules/senior-reviewer/GujaratPollutionPulseCanvas.js').then((m) => ({
      default: m.GujaratPollutionPulseCanvas,
    })),
  ),
  allowedRoles: ['SENIOR_REVIEWER'],
  label: { en: 'Gujarat Pulse', gu: 'ગુજરાત પલ્સ', hi: 'गुजरात पल्स' },
  icon: 'Activity',
  tone: 'indigo',
  description: 'State-wide pollution overview',
  sidebarGroup: 'Dashboards',
}

const OPEN_INDUSTRY_RISK_INDEX: ModuleEntry = {
  id: 'OPEN_INDUSTRY_RISK_INDEX',
  component: lazy(() =>
    import('../canvas/modules/senior-reviewer/IndustryRiskIndexCanvas.js').then((m) => ({
      default: m.IndustryRiskIndexCanvas,
    })),
  ),
  allowedRoles: ['SENIOR_REVIEWER'],
  label: { en: 'Industry Risk Index', gu: 'ઉદ્યોગ જોખમ સૂચકાંક', hi: 'उद्योग जोखिम सूचकांक' },
  icon: 'AlertTriangle',
  tone: 'rose',
  description: 'Ranked composite risk score per industry',
  sidebarGroup: 'Dashboards',
}

const OPEN_ENFORCEMENT_PIPELINE: ModuleEntry = {
  id: 'OPEN_ENFORCEMENT_PIPELINE',
  component: lazy(() =>
    import('../canvas/modules/senior-reviewer/EnforcementPipelineCanvas.js').then((m) => ({
      default: m.EnforcementPipelineCanvas,
    })),
  ),
  allowedRoles: ['SENIOR_REVIEWER'],
  label: { en: 'Enforcement Pipeline', gu: 'અમલીકરણ પાઇપલાઇન', hi: 'प्रवर्तन पाइपलाइन' },
  icon: 'Gavel',
  tone: 'amber',
  description: 'Show-cause / closure / recovery kanban',
  sidebarGroup: 'Dashboards',
}

const OPEN_TREND_LAB: ModuleEntry = {
  id: 'OPEN_TREND_LAB',
  component: lazy(() =>
    import('../canvas/modules/senior-reviewer/EnvironmentalTrendLabCanvas.js').then((m) => ({
      default: m.EnvironmentalTrendLabCanvas,
    })),
  ),
  allowedRoles: ['SENIOR_REVIEWER'],
  label: { en: 'Trend Lab', gu: 'ટ્રેન્ડ લેબ', hi: 'ट्रेंड लैब' },
  icon: 'LineChart',
  tone: 'sky',
  description: 'Period-over-period analysis for any station',
  sidebarGroup: 'Dashboards',
}

const OPEN_MAKER_CHECKER_QUEUE: ModuleEntry = {
  id: 'OPEN_MAKER_CHECKER_QUEUE',
  component: lazy(() =>
    import('../canvas/modules/senior-reviewer/MakerCheckerQueueCanvas.js').then((m) => ({
      default: m.MakerCheckerQueueCanvas,
    })),
  ),
  allowedRoles: ['SENIOR_REVIEWER'],
  label: { en: 'Maker-Checker Queue', gu: 'મેકર-ચેકર કતાર', hi: 'मेकर-चेकर कतार' },
  icon: 'CheckSquare',
  tone: 'emerald',
  description: 'Pending approvals awaiting your review',
  sidebarGroup: 'Workflows',
}

const OPEN_BROADCAST: ModuleEntry = {
  id: 'OPEN_BROADCAST',
  component: lazy(() =>
    import('../canvas/modules/senior-reviewer/BroadcastCanvas.js').then((m) => ({
      default: m.BroadcastCanvas,
    })),
  ),
  allowedRoles: ['SENIOR_REVIEWER'],
  label: { en: 'Broadcast', gu: 'બ્રોડકાસ્ટ', hi: 'प्रसारण' },
  icon: 'Megaphone',
  tone: 'violet',
  description: 'Compose statewide announcements',
  sidebarGroup: 'Tools',
}

// ────────────────────────────────────────────────────────────────────────────
// Consent Officer modules
// ────────────────────────────────────────────────────────────────────────────

const OPEN_APPLICATION_QUEUE: ModuleEntry = {
  id: 'OPEN_APPLICATION_QUEUE',
  component: lazy(() => import('../canvas/modules/consent-officer/ApplicationQueueCanvas.js')),
  allowedRoles: ['CONSENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Application Queue', gu: 'અરજી કતાર', hi: 'आवेदन कतार' },
  icon: 'Inbox',
  tone: 'indigo',
  description: 'Consent applications awaiting processing',
  sidebarGroup: 'Workflows',
}

const OPEN_CONSENT_PIPELINE: ModuleEntry = {
  id: 'OPEN_CONSENT_PIPELINE',
  component: lazy(() => import('../canvas/modules/consent-officer/ConsentPipelineCanvas.js')),
  allowedRoles: ['CONSENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Consent Pipeline', gu: 'સંમતિ પાઇપલાઇન', hi: 'सहमति पाइपलाइन' },
  icon: 'Workflow',
  tone: 'sky',
  description: 'End-to-end consent application status',
  sidebarGroup: 'Dashboards',
}

const OPEN_RENEWAL_RADAR: ModuleEntry = {
  id: 'OPEN_RENEWAL_RADAR',
  component: lazy(() => import('../canvas/modules/consent-officer/RenewalRadarCanvas.js')),
  allowedRoles: ['CONSENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Renewal Radar', gu: 'નવીકરણ રડાર', hi: 'नवीकरण रडार' },
  icon: 'Target',
  tone: 'amber',
  description: 'Industries with upcoming consent renewals',
  sidebarGroup: 'Dashboards',
}

const OPEN_CAPACITY_VS_CONSENT: ModuleEntry = {
  id: 'OPEN_CAPACITY_VS_CONSENT',
  component: lazy(() => import('../canvas/modules/consent-officer/CapacityVsConsentCanvas.js')),
  allowedRoles: ['CONSENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Capacity vs Consent', gu: 'ક્ષમતા વિ. સંમતિ', hi: 'क्षमता बनाम सहमति' },
  icon: 'BarChart3',
  tone: 'teal',
  description: 'Compare actual output against consented limits',
  sidebarGroup: 'Tools',
}

const OPEN_DOCUMENT_COMPLETENESS: ModuleEntry = {
  id: 'OPEN_DOCUMENT_COMPLETENESS',
  component: lazy(() => import('../canvas/modules/consent-officer/DocumentCompletenessCanvas.js')),
  allowedRoles: ['CONSENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Document Completeness', gu: 'દસ્તાવેજ સંપૂર્ણતા', hi: 'दस्तावेज़ पूर्णता' },
  icon: 'FileCheck',
  tone: 'emerald',
  description: 'Missing documents by application batch',
  sidebarGroup: 'Tools',
}

const OPEN_CONSENT_DRAFT: ModuleEntry = {
  id: 'OPEN_CONSENT_DRAFT',
  component: lazy(() => import('../canvas/modules/consent-officer/ConsentDraftCanvas.js')),
  allowedRoles: ['CONSENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Consent Draft', gu: 'સંમતિ ડ્રાફ્ટ', hi: 'सहमति मसौदा' },
  icon: 'FileEdit',
  tone: 'violet',
  description: 'AI-assisted consent order drafting',
  sidebarGroup: 'Workflows',
}

// ────────────────────────────────────────────────────────────────────────────
// Monitoring Officer modules
// ────────────────────────────────────────────────────────────────────────────

const OPEN_OCEMS_LIVE_GRID: ModuleEntry = {
  id: 'OPEN_OCEMS_LIVE_GRID',
  component: lazy(() =>
    import('../canvas/modules/monitoring-officer/OcemsLiveGridCanvas.js').then((m) => ({
      default: m.OcemsLiveGridCanvas,
    })),
  ),
  allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'OCEMS Live Grid', gu: 'OCEMS લાઇવ ગ્રિડ', hi: 'OCEMS लाइव ग्रिड' },
  icon: 'Gauge',
  tone: 'sky',
  description: 'Real-time online continuous emissions monitoring',
  sidebarGroup: 'Dashboards',
}

const OPEN_EXCEEDANCE_FEED: ModuleEntry = {
  id: 'OPEN_EXCEEDANCE_FEED',
  component: lazy(() =>
    import('../canvas/modules/monitoring-officer/ExceedanceFeedCanvas.js').then((m) => ({
      default: m.ExceedanceFeedCanvas,
    })),
  ),
  allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Exceedance Feed', gu: 'ઉલ્લંઘન ફીડ', hi: 'अतिक्रमण फ़ीड' },
  icon: 'Activity',
  tone: 'rose',
  description: 'Live stream of norm exceedances',
  sidebarGroup: 'Workflows',
}

const OPEN_PREDICTED_EXCEEDANCE: ModuleEntry = {
  id: 'OPEN_PREDICTED_EXCEEDANCE',
  component: lazy(() =>
    import('../canvas/modules/monitoring-officer/PredictedExceedanceLabCanvas.js').then((m) => ({
      default: m.PredictedExceedanceLabCanvas,
    })),
  ),
  allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Predicted Exceedance', gu: 'અંદાજિત ઉલ્લંઘન', hi: 'अनुमानित अतिक्रमण' },
  icon: 'TrendingUp',
  tone: 'amber',
  description: 'ML-based exceedance forecasts by station',
  sidebarGroup: 'Tools',
}

const OPEN_VOC_CLUSTER_MONITOR: ModuleEntry = {
  id: 'OPEN_VOC_CLUSTER_MONITOR',
  component: lazy(() =>
    import('../canvas/modules/monitoring-officer/VocClusterMonitorCanvas.js').then((m) => ({
      default: m.VocClusterMonitorCanvas,
    })),
  ),
  allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'VOC Clusters', gu: 'VOC ક્લસ્ટર', hi: 'VOC क्लस्टर' },
  icon: 'FlaskConical',
  tone: 'violet',
  description: 'Volatile organic compound cluster monitoring',
  sidebarGroup: 'Dashboards',
}

const OPEN_CETP_SCORECARD: ModuleEntry = {
  id: 'OPEN_CETP_SCORECARD',
  component: lazy(() =>
    import('../canvas/modules/monitoring-officer/CetpScorecardCanvas.js').then((m) => ({
      default: m.CetpScorecardCanvas,
    })),
  ),
  allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'CETP Scorecard', gu: 'CETP સ્કોરકાર્ડ', hi: 'CETP स्कोरकार्ड' },
  icon: 'Droplets',
  tone: 'teal',
  description: 'Compliance scorecard for common effluent treatment plants',
  sidebarGroup: 'Dashboards',
}

const OPEN_AAQM_MONITOR: ModuleEntry = {
  id: 'OPEN_AAQM_MONITOR',
  component: lazy(() =>
    import('../canvas/modules/monitoring-officer/AaqmStationMonitorCanvas.js').then((m) => ({
      default: m.AaqmStationMonitorCanvas,
    })),
  ),
  allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'AAQM Monitor', gu: 'AAQM મોનિટર', hi: 'AAQM मॉनिटर' },
  icon: 'Wind',
  tone: 'cyan',
  description: 'Ambient air quality monitoring station overview',
  sidebarGroup: 'Dashboards',
}

const OPEN_FESTIVAL_PLANNER: ModuleEntry = {
  id: 'OPEN_FESTIVAL_PLANNER',
  component: lazy(() =>
    import('../canvas/modules/monitoring-officer/FestivalMonitoringPlannerCanvas.js').then((m) => ({
      default: m.FestivalMonitoringPlannerCanvas,
    })),
  ),
  allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Festival Planner', gu: 'તહેવાર પ્લાનર', hi: 'त्योहार योजनाकार' },
  icon: 'Sparkles',
  tone: 'fuchsia',
  description: 'Seasonal pollution monitoring plan builder',
  sidebarGroup: 'Tools',
}

// ────────────────────────────────────────────────────────────────────────────
// Inspection & Enforcement Officer modules
// ────────────────────────────────────────────────────────────────────────────

const OPEN_INSPECTION_PRIORITISATION: ModuleEntry = {
  id: 'OPEN_INSPECTION_PRIORITISATION',
  component: lazy(() =>
    import('../canvas/modules/inspection-enforcement/InspectionPrioritisationCanvas.js').then((m) => ({
      default: m.InspectionPrioritisationCanvas,
    })),
  ),
  allowedRoles: ['INSPECTION_ENFORCEMENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Inspection Priorities', gu: 'નિરીક્ષણ પ્રાથમિકતા', hi: 'निरीक्षण प्राथमिकता' },
  icon: 'ListChecks',
  tone: 'indigo',
  description: 'Risk-ranked list of industries due for inspection',
  sidebarGroup: 'Dashboards',
}

const OPEN_INSPECTION_SCHEDULER: ModuleEntry = {
  id: 'OPEN_INSPECTION_SCHEDULER',
  component: lazy(() =>
    import('../canvas/modules/inspection-enforcement/InspectionSchedulerCanvas.js').then((m) => ({
      default: m.InspectionSchedulerCanvas,
    })),
  ),
  allowedRoles: ['INSPECTION_ENFORCEMENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Inspection Scheduler', gu: 'નિરીક્ષણ સમયસૂચિ', hi: 'निरीक्षण अनुसूचक' },
  icon: 'CalendarDays',
  tone: 'sky',
  description: 'Plan and assign upcoming field inspections',
  sidebarGroup: 'Tools',
}

const OPEN_ONSITE_CHECKLIST: ModuleEntry = {
  id: 'OPEN_ONSITE_CHECKLIST',
  component: lazy(() =>
    import('../canvas/modules/inspection-enforcement/OnSiteChecklistCanvas.js').then((m) => ({
      default: m.OnSiteChecklistCanvas,
    })),
  ),
  allowedRoles: ['INSPECTION_ENFORCEMENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'On-site Checklist', gu: 'સ્થળ ચેકલિસ્ટ', hi: 'साइट चेकलिस्ट' },
  icon: 'ClipboardList',
  tone: 'amber',
  description: 'Digital inspection checklist for field use',
  sidebarGroup: 'Tools',
}

const OPEN_DRAFT_NOTICE: ModuleEntry = {
  id: 'OPEN_DRAFT_NOTICE',
  component: lazy(() =>
    import('../canvas/modules/inspection-enforcement/DraftNoticeCanvas.js').then((m) => ({
      default: m.DraftNoticeCanvas,
    })),
  ),
  allowedRoles: ['INSPECTION_ENFORCEMENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Draft Notice', gu: 'ડ્રાફ્ટ નોટિસ', hi: 'मसौदा सूचना' },
  icon: 'FileEdit',
  tone: 'rose',
  description: 'AI-drafted show-cause and closure notices',
  sidebarGroup: 'Workflows',
}

const OPEN_VIOLATIONS_REGISTER: ModuleEntry = {
  id: 'OPEN_VIOLATIONS_REGISTER',
  component: lazy(() =>
    import('../canvas/modules/inspection-enforcement/ViolationsRegisterCanvas.js').then((m) => ({
      default: m.ViolationsRegisterCanvas,
    })),
  ),
  allowedRoles: ['INSPECTION_ENFORCEMENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Violations Register', gu: 'ઉલ્લંઘન રજિસ્ટર', hi: 'उल्लंघन रजिस्टर' },
  icon: 'BookOpen',
  tone: 'violet',
  description: 'Searchable log of all recorded violations',
  sidebarGroup: 'Dashboards',
}

// ────────────────────────────────────────────────────────────────────────────
// Complaints Officer modules
// ────────────────────────────────────────────────────────────────────────────

const OPEN_COMPLAINT_INBOX: ModuleEntry = {
  id: 'OPEN_COMPLAINT_INBOX',
  component: lazy(() =>
    import('../canvas/modules/complaints-officer/ComplaintInboxCanvas.js').then((m) => ({
      default: m.ComplaintInboxCanvas,
    })),
  ),
  allowedRoles: ['COMPLAINTS_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Complaint Inbox', gu: 'ફરિયાદ ઇનબોક્સ', hi: 'शिकायत इनबॉक्स' },
  icon: 'Inbox',
  tone: 'indigo',
  description: 'Incoming citizen pollution complaints',
  sidebarGroup: 'Workflows',
}

const OPEN_AUTO_TRIAGE: ModuleEntry = {
  id: 'OPEN_AUTO_TRIAGE',
  component: lazy(() =>
    import('../canvas/modules/complaints-officer/AutoTriageCanvas.js').then((m) => ({
      default: m.AutoTriageCanvas,
    })),
  ),
  allowedRoles: ['COMPLAINTS_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Auto-Triage', gu: 'ઓટો-ટ્રાયેજ', hi: 'ऑटो-ट्रायेज' },
  icon: 'PieChart',
  tone: 'amber',
  description: 'AI-classified complaint severity distribution',
  sidebarGroup: 'Tools',
}

const OPEN_COMPLAINT_HOTSPOT_MAP: ModuleEntry = {
  id: 'OPEN_COMPLAINT_HOTSPOT_MAP',
  component: lazy(() =>
    import('../canvas/modules/complaints-officer/ComplaintHotspotMapCanvas.js').then((m) => ({
      default: m.ComplaintHotspotMapCanvas,
    })),
  ),
  allowedRoles: ['COMPLAINTS_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Hotspot Map', gu: 'હોટસ્પોટ નકશો', hi: 'हॉटस्पॉट मानचित्र' },
  icon: 'Map',
  tone: 'rose',
  description: 'Geographical clustering of complaint hotspots',
  sidebarGroup: 'Dashboards',
}

const OPEN_INDUSTRY_CORRELATION: ModuleEntry = {
  id: 'OPEN_INDUSTRY_CORRELATION',
  component: lazy(() =>
    import('../canvas/modules/complaints-officer/IndustryCorrelationCanvas.js').then((m) => ({
      default: m.IndustryCorrelationCanvas,
    })),
  ),
  allowedRoles: ['COMPLAINTS_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Industry Correlation', gu: 'ઉદ્યોગ સહસંબંધ', hi: 'उद्योग सहसंबंध' },
  icon: 'Network',
  tone: 'teal',
  description: 'Link complaints to responsible industries',
  sidebarGroup: 'Tools',
}

const OPEN_CITIZEN_RESPONSE_TRACKER: ModuleEntry = {
  id: 'OPEN_CITIZEN_RESPONSE_TRACKER',
  component: lazy(() =>
    import('../canvas/modules/complaints-officer/CitizenResponseTrackerCanvas.js').then((m) => ({
      default: m.CitizenResponseTrackerCanvas,
    })),
  ),
  allowedRoles: ['COMPLAINTS_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Citizen Responses', gu: 'નાગરિક પ્રતિસાદ', hi: 'नागरिक प्रतिक्रिया' },
  icon: 'Trello',
  tone: 'violet',
  description: 'Track reply status for every citizen complaint',
  sidebarGroup: 'Workflows',
}

// ────────────────────────────────────────────────────────────────────────────
// Shared / cross-role (contextual — not shown in the tile grid)
// ────────────────────────────────────────────────────────────────────────────

const ALL_ROLES: Role[] = [
  'CONSENT_OFFICER',
  'MONITORING_OFFICER',
  'INSPECTION_ENFORCEMENT_OFFICER',
  'COMPLAINTS_OFFICER',
  'SENIOR_REVIEWER',
]

const OPEN_INDUSTRY_DEEP_DIVE: ModuleEntry = {
  id: 'OPEN_INDUSTRY_DEEP_DIVE',
  component: lazy(() =>
    import('../canvas/modules/shared/IndustryDeepDiveCanvas.js').then((m) => ({
      default: m.IndustryDeepDiveCanvas,
    })),
  ),
  allowedRoles: ALL_ROLES,
  label: { en: 'Industry Deep Dive', gu: 'ઉદ્યોગ ડીપ ડાઇવ', hi: 'उद्योग गहरा अध्ययन' },
  icon: 'Factory',
  tone: 'slate',
  description: 'Full profile for any registered industry',
  sidebarGroup: 'Tools',
}

const OPEN_NOTIFICATIONS: ModuleEntry = {
  id: 'OPEN_NOTIFICATIONS',
  component: lazy(() =>
    import('../canvas/modules/shared/NotificationCanvas.js').then((m) => ({
      default: m.NotificationCanvas,
    })),
  ),
  allowedRoles: ALL_ROLES,
  label: { en: 'Notifications', gu: 'સૂચનાઓ', hi: 'सूचनाएँ' },
  icon: 'Bell',
  tone: 'sky',
  description: 'System alerts and action reminders',
  sidebarGroup: 'Tools',
}

const OPEN_REPORT_EXPORT: ModuleEntry = {
  id: 'OPEN_REPORT_EXPORT',
  component: lazy(() =>
    import('../canvas/modules/shared/ReportExportCanvas.js').then((m) => ({
      default: m.ReportExportCanvas,
    })),
  ),
  allowedRoles: ALL_ROLES,
  label: { en: 'Report Export', gu: 'રિપોર્ટ નિકાસ', hi: 'रिपोर्ट निर्यात' },
  icon: 'Download',
  tone: 'slate',
  description: 'Export dashboards and data to PDF / Excel',
  sidebarGroup: 'Tools',
}

// ────────────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────────────

export const moduleRegistry: ModuleEntry[] = [
  // Senior Reviewer
  OPEN_WAR_ROOM,
  OPEN_GUJARAT_PULSE,
  OPEN_INDUSTRY_RISK_INDEX,
  OPEN_ENFORCEMENT_PIPELINE,
  OPEN_TREND_LAB,
  OPEN_MAKER_CHECKER_QUEUE,
  OPEN_BROADCAST,
  // Consent
  OPEN_APPLICATION_QUEUE,
  OPEN_CONSENT_PIPELINE,
  OPEN_RENEWAL_RADAR,
  OPEN_CAPACITY_VS_CONSENT,
  OPEN_DOCUMENT_COMPLETENESS,
  OPEN_CONSENT_DRAFT,
  // Monitoring
  OPEN_OCEMS_LIVE_GRID,
  OPEN_EXCEEDANCE_FEED,
  OPEN_PREDICTED_EXCEEDANCE,
  OPEN_VOC_CLUSTER_MONITOR,
  OPEN_CETP_SCORECARD,
  OPEN_AAQM_MONITOR,
  OPEN_FESTIVAL_PLANNER,
  // Inspection & Enforcement
  OPEN_INSPECTION_PRIORITISATION,
  OPEN_INSPECTION_SCHEDULER,
  OPEN_ONSITE_CHECKLIST,
  OPEN_DRAFT_NOTICE,
  OPEN_VIOLATIONS_REGISTER,
  // Complaints
  OPEN_COMPLAINT_INBOX,
  OPEN_AUTO_TRIAGE,
  OPEN_COMPLAINT_HOTSPOT_MAP,
  OPEN_INDUSTRY_CORRELATION,
  OPEN_CITIZEN_RESPONSE_TRACKER,
  // Shared (contextual — not in tile grid)
  OPEN_INDUSTRY_DEEP_DIVE,
  OPEN_NOTIFICATIONS,
  OPEN_REPORT_EXPORT,
]

/** Look up a module entry by its action ID */
export function findModule(id: string): ModuleEntry | undefined {
  return moduleRegistry.find((m) => m.id === id)
}

/** Filter modules visible to a given role */
export function modulesForRole(role: Role): ModuleEntry[] {
  return moduleRegistry.filter((m) => m.allowedRoles.includes(role))
}
