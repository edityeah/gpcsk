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

export type Category =
  | 'WAR_ROOM'
  | 'PROGRAMS'
  | 'CONSENT'
  | 'INSPECTION'
  | 'COMPLAINTS'
  | 'DASHBOARDS'
  | 'SETTINGS'

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
  /** Category — drives home-grid grouping and sidebar sections */
  category: Category
  /** True for parent/hub canvases that appear as hero cards in the home grid */
  isParent?: boolean
  /** Starter prompts shown in the CanvasSaathiSplit bottom chat panel */
  suggestedPrompts: string[]
}

// ────────────────────────────────────────────────────────────────────────────
// Programs — top-level entry (visible to SR + MO)
// ────────────────────────────────────────────────────────────────────────────

const OPEN_PROGRAMS: ModuleEntry = {
  id: 'OPEN_PROGRAMS',
  component: lazy(() =>
    import('../canvas/modules/programs/ProgramsCanvas.js').then((m) => ({
      default: m.ProgramsCanvas,
    })),
  ),
  allowedRoles: ['SENIOR_REVIEWER', 'MONITORING_OFFICER'],
  label: { en: 'Programs', gu: 'કાર્યક્રમો', hi: 'कार्यक्रम' },
  icon: 'LayoutGrid',
  tone: 'indigo',
  description: 'All monitoring streams in one place',
  sidebarGroup: 'Dashboards',
  category: 'PROGRAMS',
  isParent: true,
  suggestedPrompts: [
    'Which program has the most exceedances?',
    'Show me OCEMS',
    'Air quality status today',
    'Compare programs',
  ],
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
  category: 'WAR_ROOM',
  suggestedPrompts: [
    "What's the worst anomaly right now?",
    'Which CETP needs urgent action?',
    'Top 3 industries to inspect today',
    'Summarise open critical alerts',
    'Which district is the hottest?',
  ],
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
  category: 'DASHBOARDS',
  suggestedPrompts: [
    'Compare AIR vs WATER exceedances today',
    'What changed in the last 24 hours?',
    'Top hotspot district right now',
    'Worst-performing CETP this month',
  ],
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
  category: 'DASHBOARDS',
  suggestedPrompts: [
    'Why is the top industry ranked highest?',
    'Top 5 risk industries in Bharuch',
    'Highest risk industries with no inspection in 6 months',
    'Compare Ankleshwar vs Vatva',
  ],
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
  category: 'INSPECTION',
  suggestedPrompts: [
    'Show me actions pending review > 14 days',
    'How many show-cause notices were committed this month?',
    'Most common reason for revision?',
    'Avg time from draft to committed',
  ],
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
  category: 'DASHBOARDS',
  suggestedPrompts: [
    'Plot Sabarmati BOD over 12 months',
    'PM10 trend at Vatva over 30 days',
    'Compare Ankleshwar AAQM stations',
    'Festival monitoring spike analysis',
  ],
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
  category: 'INSPECTION',
  suggestedPrompts: [
    "What's the oldest pending item?",
    'Items breaching SLA',
    'Who has the most drafts pending?',
    'Approve the safe ones in bulk',
  ],
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
  category: 'DASHBOARDS',
  suggestedPrompts: [
    'Summarise what I\'m seeing',
    'Top items needing attention',
    'Trend over the last 30 days',
  ],
}

// ────────────────────────────────────────────────────────────────────────────
// Consent Officer modules
// ────────────────────────────────────────────────────────────────────────────

const OPEN_CONSENT_MANAGEMENT: ModuleEntry = {
  id: 'OPEN_CONSENT_MANAGEMENT',
  component: lazy(() =>
    import('../canvas/modules/consent-officer/ConsentManagementCanvas.js'),
  ),
  allowedRoles: ['CONSENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Consent Management', gu: 'સંમતિ વ્યવસ્થાપન', hi: 'सहमति प्रबंधन' },
  icon: 'Layers',
  tone: 'indigo',
  description: 'AI-verified applications · approval queue · renewal radar',
  sidebarGroup: 'Dashboards',
  category: 'CONSENT',
  isParent: true,
  suggestedPrompts: [
    'How many applications are awaiting human review?',
    'AI flagged issues today',
    'Renewals expiring this month',
    'Applications approved in the last 30 days',
    'Show applications with BLURRED or MISSING docs',
  ],
}

const OPEN_AI_VERIFICATION: ModuleEntry = {
  id: 'OPEN_AI_VERIFICATION',
  component: lazy(() =>
    import('../canvas/modules/consent-officer/AIVerificationCanvas.js').then((m) => ({
      default: m.default,
    })),
  ),
  allowedRoles: ['CONSENT_OFFICER'],
  label: { en: 'AI Verification', gu: 'AI ચકાસણી', hi: 'AI सत्यापन' },
  icon: 'ShieldCheck',
  tone: 'violet',
  description: 'Per-document AI review with approve / return actions',
  sidebarGroup: 'Workflows',
  category: 'CONSENT',
  suggestedPrompts: [
    'Applications with missing documents',
    'Which consents have the most AI-flagged issues?',
    'Applications with BLANK documents that need to be returned',
    'Show me the AI confidence breakdown',
    'Approve all clear applications',
  ],
}

const OPEN_APPLICATION_QUEUE: ModuleEntry = {
  id: 'OPEN_APPLICATION_QUEUE',
  component: lazy(() => import('../canvas/modules/consent-officer/ApplicationQueueCanvas.js')),
  allowedRoles: ['CONSENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Application Queue', gu: 'અરજી કતાર', hi: 'आवेदन कतार' },
  icon: 'Inbox',
  tone: 'indigo',
  description: 'Consent applications awaiting processing',
  sidebarGroup: 'Workflows',
  category: 'CONSENT',
  suggestedPrompts: [
    'Applications waiting >30 days',
    'Renewals due next 30 days',
    'Document-incomplete applications',
    'Top sectors applying for CTE',
  ],
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
  category: 'CONSENT',
  suggestedPrompts: [
    'Capacity vs declared consent outliers',
    'CTOs expiring this quarter',
    'HW Auth pipeline status',
    'Most-rejected reasons',
  ],
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
  category: 'CONSENT',
  suggestedPrompts: [
    "What's expiring in 30 days?",
    'By district',
    'Industries with no renewal application yet',
    'Risk if these are not renewed',
  ],
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
  category: 'CONSENT',
  suggestedPrompts: [
    'Summarise what I\'m seeing',
    'Top items needing attention',
    'Trend over the last 30 days',
  ],
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
  category: 'CONSENT',
  suggestedPrompts: [
    'Summarise what I\'m seeing',
    'Top items needing attention',
    'Trend over the last 30 days',
  ],
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
  category: 'CONSENT',
  suggestedPrompts: [
    'Summarise what I\'m seeing',
    'Top items needing attention',
    'Trend over the last 30 days',
  ],
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
  category: 'PROGRAMS',
  suggestedPrompts: [
    'Which OCEMS stations are exceeding now?',
    'Group exceedances by parameter',
    'Show only critical stations',
    'Compare last hour vs avg',
  ],
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
  category: 'PROGRAMS',
  suggestedPrompts: [
    'Latest CRITICAL exceedances',
    'Group by industry',
    'Confirm or sensor-glitch the recent COD spike',
    'Trend over the last 7 days',
  ],
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
  category: 'PROGRAMS',
  suggestedPrompts: [
    'Summarise what I\'m seeing',
    'Top items needing attention',
    'Trend over the last 30 days',
  ],
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
  category: 'PROGRAMS',
  suggestedPrompts: [
    'Top benzene exceedances',
    'Compare Vatva vs Ankleshwar VOC clusters',
    'Which VOC parameters are most over norm?',
    'Trend at top cluster over 30 days',
  ],
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
  category: 'PROGRAMS',
  suggestedPrompts: [
    'Which CETPs reported bypass?',
    'Compare AHSPA vs Naroda Enviro',
    'CETPs trending worse over 3 months',
    'Member-unit count by CETP',
  ],
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
  category: 'PROGRAMS',
  suggestedPrompts: [
    'Worst PM2.5 districts today',
    'Compare Vapi vs Ankleshwar AAQM',
    'How many SAMP stations are down?',
    'AQI trend over last month',
  ],
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
  category: 'PROGRAMS',
  suggestedPrompts: [
    'Plan Ganesh Utsav 2026 monitoring',
    'Compare 2024 vs 2025 Sabarmati BOD spikes',
    'What worked last year?',
    'Stations to deploy on Day 0',
  ],
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
  category: 'INSPECTION',
  suggestedPrompts: [
    'Top 5 industries to inspect this week',
    'Who has the most overdue inspections?',
    'High-risk industries we have never visited',
    'Suggest a route for Ankleshwar',
  ],
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
  category: 'INSPECTION',
  suggestedPrompts: [
    'Summarise what I\'m seeing',
    'Top items needing attention',
    'Trend over the last 30 days',
  ],
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
  category: 'INSPECTION',
  suggestedPrompts: [
    'Summarise what I\'m seeing',
    'Top items needing attention',
    'Trend over the last 30 days',
  ],
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
  category: 'INSPECTION',
  suggestedPrompts: [
    'Draft a show-cause for the top exceedance',
    "Last week's similar notices for reference",
    'What sections of the Air Act apply here?',
    'Suggest evidence chips',
  ],
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
  category: 'INSPECTION',
  suggestedPrompts: [
    'Critical violations this quarter',
    'Repeat offenders',
    'Violations by sector',
    'What was the average resolution time?',
  ],
}

const OPEN_RISK_BASED_INSPECTIONS: ModuleEntry = {
  id: 'OPEN_RISK_BASED_INSPECTIONS',
  component: lazy(() =>
    import('../canvas/modules/inspection-enforcement/RiskBasedInspectionsCanvas.js').then((m) => ({
      default: m.RiskBasedInspectionsCanvas,
    })),
  ),
  allowedRoles: ['INSPECTION_ENFORCEMENT_OFFICER', 'SENIOR_REVIEWER'],
  label: { en: 'Risk-Based Inspections', gu: 'જોખમ-આધારિત નિરીક્ષણ', hi: 'जोखिम-आधारित निरीक्षण' },
  icon: 'Target',
  tone: 'rose',
  description: 'AI-suggested inspection priorities',
  sidebarGroup: 'Workflows',
  category: 'INSPECTION',
  isParent: true,
  suggestedPrompts: [
    'How many AI-suggested inspections this week?',
    'Top 5 industries to inspect now',
    'Confirm the highest-risk one',
    'Dismiss low-confidence suggestions',
  ],
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
  category: 'COMPLAINTS',
  suggestedPrompts: [
    'Show me critical complaints today',
    'Anonymous complaints last week',
    'Complaints near Naroda GIDC',
    'Which categories spiked this month?',
  ],
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
  category: 'COMPLAINTS',
  suggestedPrompts: [
    'Summarise what I\'m seeing',
    'Top items needing attention',
    'Trend over the last 30 days',
  ],
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
  category: 'COMPLAINTS',
  suggestedPrompts: [
    'Top 3 hotspots right now',
    'Compare district hotspots over 30 days',
    'Hotspots near Red-category industries',
    'Where to assign more officers?',
  ],
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
  category: 'COMPLAINTS',
  suggestedPrompts: [
    'Summarise what I\'m seeing',
    'Top items needing attention',
    'Trend over the last 30 days',
  ],
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
  category: 'COMPLAINTS',
  suggestedPrompts: [
    'Complaints aging past SLA',
    'Show only IN_PROGRESS items I own',
    'Reply templates for odour complaints',
    'Statistics this week',
  ],
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
  category: 'SETTINGS',
  suggestedPrompts: [
    'Recent violations for this industry',
    'Inspection history',
    'Complaint timeline',
    'Generate a 1-pager',
  ],
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
  category: 'SETTINGS',
  suggestedPrompts: [
    'What needs my attention?',
    'Mark all read',
    'Filter to maker-checker only',
    'Notifications by category',
  ],
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
  category: 'SETTINGS',
  suggestedPrompts: [
    'Summarise what I\'m seeing',
    'Top items needing attention',
    'Trend over the last 30 days',
  ],
}

// ────────────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────────────


// ────────────────────────────────────────────────────────────────────────────
// Saathi — the orchestrator conversation (web-only canvas; not an AI tool)
// ────────────────────────────────────────────────────────────────────────────

const OPEN_SAATHI: ModuleEntry = {
  id: 'OPEN_SAATHI',
  component: lazy(() =>
    import('../canvas/modules/shared/SaathiAssistantCanvas.js').then((m) => ({
      default: m.SaathiAssistantCanvas,
    })),
  ),
  allowedRoles: ['SENIOR_REVIEWER', 'CONSENT_OFFICER', 'MONITORING_OFFICER', 'INSPECTION_ENFORCEMENT_OFFICER', 'COMPLAINTS_OFFICER'],
  label: { en: 'Saathi', gu: 'સાથી', hi: 'साथी' },
  icon: 'Sparkles',
  tone: 'indigo',
  description: 'Your GPCSK companion · opens any screen, answers anything',
  sidebarGroup: 'Tools',
  category: 'SETTINGS',
  suggestedPrompts: [],
}

export const moduleRegistry: ModuleEntry[] = [
  // Programs — top-level overview
  OPEN_PROGRAMS,
  // Senior Reviewer
  OPEN_WAR_ROOM,
  OPEN_GUJARAT_PULSE,
  OPEN_INDUSTRY_RISK_INDEX,
  OPEN_ENFORCEMENT_PIPELINE,
  OPEN_TREND_LAB,
  OPEN_MAKER_CHECKER_QUEUE,
  OPEN_BROADCAST,
  // Consent
  OPEN_CONSENT_MANAGEMENT,
  OPEN_AI_VERIFICATION,
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
  OPEN_RISK_BASED_INSPECTIONS,
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
  OPEN_SAATHI,
]

/** Look up a module entry by its action ID */
export function findModule(id: string): ModuleEntry | undefined {
  return moduleRegistry.find((m) => m.id === id)
}

/** Filter modules visible to a given role */
export function modulesForRole(role: Role): ModuleEntry[] {
  return moduleRegistry.filter((m) => m.allowedRoles.includes(role))
}

/** Filter modules by category, optionally also gating by role */
export function modulesForCategory(category: Category, role?: Role): ModuleEntry[] {
  return moduleRegistry.filter(
    (m) => m.category === category && (!role || m.allowedRoles.includes(role)),
  )
}

/** Return only parent/hub canvases visible to a role */
export function parentModulesForRole(role: Role): ModuleEntry[] {
  return moduleRegistry.filter((m) => m.isParent && m.allowedRoles.includes(role))
}

const DEFAULT_PROMPTS: string[] = [
  "Summarise what I'm seeing",
  'Top items needing attention',
  'Trend over the last 30 days',
]

/**
 * Returns the suggestedPrompts for a canvas module id.
 * Falls back to a generic set if the module is not registered.
 */
export function suggestedPromptsFor(moduleId: string): string[] {
  const entry = findModule(moduleId)
  return entry?.suggestedPrompts ?? DEFAULT_PROMPTS
}
