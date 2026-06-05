/**
 * Action registry — catalog of canvas modules that the AI can open.
 * Each entry defines the OpenAI function-calling schema and which roles
 * are permitted to invoke it.
 */

import type { Role } from '@gpcsk/shared'

export interface ActionDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?: string[]
  }
  allowedRoles: Role[]
}

export const actionRegistry: ActionDefinition[] = [
  // ── Senior Reviewer mega-dashboards ────────────────────────────────────────
  {
    name: 'OPEN_GUJARAT_PULSE',
    description:
      'Open the Gujarat Pollution Control Pulse dashboard — a senior-reviewer mega-dashboard showing statewide compliance health, active exceedances, consent pipeline status, and key performance indicators across all pollution streams.',
    parameters: {
      type: 'object',
      properties: {
        stream: {
          type: 'string',
          description: 'Optional pollution stream filter (air, water, hazardous_waste, noise)',
          enum: ['air', 'water', 'hazardous_waste', 'noise'],
        },
      },
    },
    allowedRoles: ['SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_INDUSTRY_RISK_INDEX',
    description:
      'Open the Industry Risk Index dashboard — AI-scored risk ranking of industries based on violation history, sensor exceedances, consent status, and inspection findings. Helps prioritise which industries need immediate attention.',
    parameters: {
      type: 'object',
      properties: {
        district: { type: 'string', description: 'Filter by district name' },
        category: {
          type: 'string',
          description: 'Industry category',
          enum: ['RED', 'ORANGE', 'GREEN', 'WHITE'],
        },
      },
    },
    allowedRoles: ['SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_ENFORCEMENT_PIPELINE',
    description:
      'Open the Enforcement Pipeline — a senior-reviewer view of all enforcement actions (show-cause, closure, bank guarantee, recovery) across all states in the maker-checker workflow. Shows pending approvals, recently committed notices, and action timelines.',
    parameters: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          description: 'Filter by enforcement action state',
          enum: ['DRAFT', 'PENDING_REVIEW', 'COMMITTED', 'RETURNED_FOR_REVISION', 'WITHDRAWN'],
        },
      },
    },
    allowedRoles: ['SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_TREND_LAB',
    description:
      'Open the Trend Lab — an analytical dashboard for exploring multi-year pollution trends, seasonal patterns, CETP performance trajectories, and predictive exceedance forecasts across Gujarat.',
    parameters: {
      type: 'object',
      properties: {
        parameter: { type: 'string', description: 'Pollution parameter to trend (e.g. PM10, COD, BOD, pH)' },
        period: { type: 'string', description: 'Time period: 3m, 6m, 1y, 3y', enum: ['3m', '6m', '1y', '3y'] },
      },
    },
    allowedRoles: ['SENIOR_REVIEWER'],
  },

  // ── Consent Officer modules ────────────────────────────────────────────────
  {
    name: 'OPEN_APPLICATION_QUEUE',
    description:
      'Open the Consent Application Queue — list of pending CTE, CTO, and HW-Auth applications with document completeness scores, AI-flagged issues, and recommendation status. Consent Officers use this to process and recommend decisions.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Application type filter',
          enum: ['CTE', 'CTO', 'HW_AUTH'],
        },
        state: {
          type: 'string',
          description: 'Application state filter',
          enum: ['draft', 'under_review', 'recommended', 'approved', 'rejected'],
        },
      },
    },
    allowedRoles: ['CONSENT_OFFICER', 'SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_CONSENT_PIPELINE',
    description:
      'Open the Consent Pipeline — a Kanban-style view of all consent applications moving through CTE → CTO → HW-Auth stages. Shows capacity vs consent discrepancies and document compliance AI check results.',
    parameters: {
      type: 'object',
      properties: {
        industryId: { type: 'string', description: 'Filter to a specific industry ID' },
      },
    },
    allowedRoles: ['CONSENT_OFFICER', 'SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_RENEWAL_RADAR',
    description:
      'Open the Renewal Radar — shows consents expiring in the next 30, 60, and 90 days with auto-renewal eligibility scores and reminder queues. Helps consent officers proactively manage renewal timelines.',
    parameters: {
      type: 'object',
      properties: {
        horizon: {
          type: 'string',
          description: 'Look-ahead window',
          enum: ['30d', '60d', '90d'],
        },
      },
    },
    allowedRoles: ['CONSENT_OFFICER', 'SENIOR_REVIEWER'],
  },

  // ── Monitoring Officer modules ──────────────────────────────────────────────
  {
    name: 'OPEN_OCEMS_LIVE_GRID',
    description:
      'Open the OCEMS / CEQMS Live Grid — real-time sensor readings from all Online Continuous Emission Monitoring Stations and Continuous Effluent Quality Monitoring Systems across Gujarat. Shows live parameter values, norm comparisons, and station health.',
    parameters: {
      type: 'object',
      properties: {
        stationType: {
          type: 'string',
          description: 'Station type filter',
          enum: ['OCEMS', 'CEQMS', 'AAQM', 'MINARS', 'GEMS', 'VOC'],
        },
        district: { type: 'string', description: 'Filter by district' },
      },
    },
    allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_EXCEEDANCE_FEED',
    description:
      'Open the Exceedance Feed — chronological list of all norm exceedances detected by sensors, with severity, breach magnitude, and disposition status (confirmed violation, sensor glitch, under review). Supports direct disposition actions.',
    parameters: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          description: 'Severity filter',
          enum: ['minor', 'major', 'critical'],
        },
        dispositionState: {
          type: 'string',
          description: 'Disposition state filter',
          enum: ['pending', 'confirmed_violation', 'sensor_glitch'],
        },
      },
    },
    allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_CETP_SCORECARD',
    description:
      'Open the CETP Scorecard — performance dashboard for Common Effluent Treatment Plants across Gujarat. Shows inlet vs outlet quality, member unit counts, bypass volumes, hazardous waste storage, CEQMS compliance, and monthly trend comparisons from lab reports.',
    parameters: {
      type: 'object',
      properties: {
        cetpId: { type: 'string', description: 'Open scorecard for a specific CETP ID' },
        district: { type: 'string', description: 'Filter by district' },
      },
    },
    allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_AAQM_MONITOR',
    description:
      'Open the Ambient Air Quality Monitor — live readings from AAQM stations for PM2.5, PM10, SO2, NOx, and other air quality parameters. Includes AQI calculations, norm breach alerts, and station status.',
    parameters: {
      type: 'object',
      properties: {
        parameter: {
          type: 'string',
          description: 'Air quality parameter',
          enum: ['PM2_5', 'PM10', 'SO2', 'NOX', 'CO', 'O3', 'NH3'],
        },
      },
    },
    allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_VOC_CLUSTER_MONITOR',
    description:
      'Open the VOC Cluster Monitor — Volatile Organic Compounds monitoring across industrial clusters. Detects concentration spikes, identifies probable source industries, and tracks cluster-level compliance trends.',
    parameters: {
      type: 'object',
      properties: {
        cluster: { type: 'string', description: 'Industrial cluster name or GIDC zone' },
      },
    },
    allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_FESTIVAL_PLANNER',
    description:
      'Open the Festival Monitoring Planner — planning and tracking tool for enhanced monitoring during festivals (Ganesh Utsav, Navratri, Diwali). Manages idol immersion water quality checks, noise monitoring assignments, and real-time compliance dashboard.',
    parameters: {
      type: 'object',
      properties: {
        festival: { type: 'string', description: 'Festival name (e.g. Ganesh Utsav, Navratri, Diwali)' },
      },
    },
    allowedRoles: ['MONITORING_OFFICER', 'SENIOR_REVIEWER'],
  },

  // ── Inspection & Enforcement Officer modules ───────────────────────────────
  {
    name: 'OPEN_INSPECTION_PRIORITISATION',
    description:
      'Open the Inspection Prioritisation List — AI-ranked list of industries due for inspection, sorted by risk score, time since last inspection, violation history, and CPCB category. Helps inspection officers schedule field visits efficiently.',
    parameters: {
      type: 'object',
      properties: {
        district: { type: 'string', description: 'Filter by district' },
        category: {
          type: 'string',
          description: 'Industry CPCB category',
          enum: ['RED', 'ORANGE', 'GREEN', 'WHITE'],
        },
      },
    },
    allowedRoles: ['INSPECTION_ENFORCEMENT_OFFICER', 'SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_DRAFT_NOTICE',
    description:
      'Open the Draft Notice editor — AI-assisted drafting of show-cause notices, closure directions, bank guarantee invocations, and recovery notices. Pre-fills with violation evidence, observed values vs norms, and relevant legal sections.',
    parameters: {
      type: 'object',
      properties: {
        industryId: { type: 'string', description: 'Industry ID for which to draft the notice' },
        noticeType: {
          type: 'string',
          description: 'Type of enforcement notice',
          enum: ['SHOW_CAUSE', 'CLOSURE_DIRECTION', 'BANK_GUARANTEE_INVOCATION', 'RECOVERY', 'SEALING'],
        },
        violationIds: {
          type: 'string',
          description: 'Comma-separated violation IDs to include as evidence',
        },
      },
      required: ['industryId', 'noticeType'],
    },
    allowedRoles: ['INSPECTION_ENFORCEMENT_OFFICER', 'SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_VIOLATIONS_REGISTER',
    description:
      'Open the Violations Register — comprehensive log of all detected violations across sensor, inspection, complaint, and audit sources. Supports filtering by severity, source, industry, parameter, and disposition state.',
    parameters: {
      type: 'object',
      properties: {
        industryId: { type: 'string', description: 'Filter to a specific industry' },
        severity: {
          type: 'string',
          description: 'Severity level',
          enum: ['minor', 'major', 'critical'],
        },
        source: {
          type: 'string',
          description: 'Detection source',
          enum: ['sensor', 'inspection', 'complaint', 'audit'],
        },
      },
    },
    allowedRoles: ['INSPECTION_ENFORCEMENT_OFFICER', 'SENIOR_REVIEWER'],
  },

  // ── Complaints Officer modules ──────────────────────────────────────────────
  {
    name: 'OPEN_COMPLAINT_INBOX',
    description:
      'Open the Complaint Inbox — list of all citizen and NGO complaints with auto-triage categories (noise, air, water, illegal dumping, odour), urgency scores, and response status. Supports direct assignment and response tracking.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Complaint status filter',
          enum: ['OPEN', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED'],
        },
        category: {
          type: 'string',
          description: 'Pollution stream category',
          enum: ['AIR', 'WATER', 'NOISE', 'HAZARDOUS_WASTE', 'SOLID_WASTE', 'ODOUR', 'OTHER'],
        },
      },
    },
    allowedRoles: ['COMPLAINTS_OFFICER', 'SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_COMPLAINT_HOTSPOT_MAP',
    description:
      'Open the Complaint Hotspot Map — geographic heatmap of complaint density across Gujarat. Clusters complaints by location and category, correlates with nearby industries, and highlights chronic complaint areas that may warrant proactive inspection.',
    parameters: {
      type: 'object',
      properties: {
        district: { type: 'string', description: 'Zoom to a specific district' },
        category: {
          type: 'string',
          description: 'Complaint category to highlight',
          enum: ['AIR', 'WATER', 'NOISE', 'HAZARDOUS_WASTE', 'SOLID_WASTE', 'ODOUR', 'OTHER'],
        },
      },
    },
    allowedRoles: ['COMPLAINTS_OFFICER', 'SENIOR_REVIEWER'],
  },

  // ── Shared / cross-role modules ────────────────────────────────────────────
  {
    name: 'OPEN_MAKER_CHECKER_QUEUE',
    description:
      'Open the Maker-Checker Queue — all enforcement actions and consent decisions awaiting Senior Reviewer approval. Shows age-in-queue, maker identity, action type, and attached evidence. Supports approve, return-for-revision, and view-details actions.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Queue type to view',
          enum: ['enforcement', 'consent', 'all'],
        },
      },
    },
    allowedRoles: ['SENIOR_REVIEWER'],
  },
  {
    name: 'OPEN_INDUSTRY_DEEP_DIVE',
    description:
      'Open the Industry Deep Dive — 360-degree profile of a specific industry showing consent history, sensor readings, inspection findings, violations, complaints, and enforcement actions in a unified timeline view.',
    parameters: {
      type: 'object',
      properties: {
        industryId: {
          type: 'string',
          description: 'Industry ID or UC number to open the deep dive for',
        },
        ucNumber: {
          type: 'string',
          description: 'UC number as an alternative to industryId',
        },
      },
    },
    allowedRoles: [
      'CONSENT_OFFICER',
      'MONITORING_OFFICER',
      'INSPECTION_ENFORCEMENT_OFFICER',
      'COMPLAINTS_OFFICER',
      'SENIOR_REVIEWER',
    ],
  },
]

/** Build the OpenAI tools array from the registry */
export function buildOpenAiTools(userRole: Role) {
  return actionRegistry
    .filter((action) => action.allowedRoles.includes(userRole))
    .map((action) => ({
      type: 'function' as const,
      function: {
        name: action.name,
        description: action.description,
        parameters: action.parameters,
      },
    }))
}

/** Look up an action by name */
export function findAction(name: string): ActionDefinition | undefined {
  return actionRegistry.find((a) => a.name === name)
}
