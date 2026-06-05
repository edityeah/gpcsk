/**
 * Seed notifications for all 5 demo users.
 *
 * Strategy per role (described in task spec):
 *   SENIOR_REVIEWER      — MAKER_CHECKER_PENDING, NOTICE_COMMITTED, ANOMALY_FLAG, COMPLAINT_HOTSPOT_ALERT, BROADCAST
 *   CONSENT_OFFICER      — RENEWAL_DUE_30/60/90, GENERAL
 *   MONITORING_OFFICER   — EXCEEDANCE_CRITICAL, EXCEEDANCE_PREDICTED, ANOMALY_FLAG
 *   IEO                  — INSPECTION_DUE, ANOMALY_FLAG, MAKER_CHECKER_PENDING
 *   COMPLAINTS_OFFICER   — COMPLAINT_ASSIGNED, COMPLAINT_HOTSPOT_ALERT
 *
 * Each notification gets a realistic payload referencing actual DB entities.
 * createdAt is jittered across last 14 days, weighted towards last 48h.
 * ~50 % of notifications are unread (readAt = null).
 */

import type { PrismaClient } from '@prisma/client'

// ── Deterministic helpers ─────────────────────────────────────────────────────

function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0
  }
  return h
}

function seededFloat(key: string): number {
  return hash32(key) / 4294967296
}

/** Jitter createdAt across last 14 days, weighted towards last 48h */
function jitteredDate(seed: string, index: number): Date {
  const f = seededFloat(seed + String(index))
  // 60% chance in last 48h, 40% spread over 14 days
  const hoursAgo = f < 0.6
    ? f * 48                     // 0–48h
    : 48 + (f - 0.6) * 0.4 * (14 * 24 - 48) / 0.4  // 48h–14d
  return new Date(Date.now() - hoursAgo * 3_600_000)
}

/** 50% chance of being read */
function isRead(seed: string): boolean {
  return seededFloat('read' + seed) > 0.5
}

function readAt(createdAt: Date, seed: string): Date | null {
  if (!isRead(seed)) return null
  // Read some hours after creation
  const hoursLater = seededFloat('readLater' + seed) * 6 + 0.1
  const d = new Date(createdAt.getTime() + hoursLater * 3_600_000)
  return d > new Date() ? new Date() : d
}

// ── Main seed function ────────────────────────────────────────────────────────

export async function seedNotifications(prisma: PrismaClient): Promise<void> {
  // Skip if already seeded
  const existing = await prisma.notification.count()
  if (existing > 0) {
    return
  }

  // ── Resolve user IDs ────────────────────────────────────────────────────────
  const users = await prisma.user.findMany({
    where: { role: { in: ['SENIOR_REVIEWER', 'CONSENT_OFFICER', 'MONITORING_OFFICER', 'INSPECTION_ENFORCEMENT_OFFICER', 'COMPLAINTS_OFFICER'] } },
    select: { id: true, role: true, name: true },
  })

  const byRole = new Map<string, string>()
  for (const u of users) {
    byRole.set(u.role, u.id)
  }

  const srId   = byRole.get('SENIOR_REVIEWER')!
  const coId   = byRole.get('CONSENT_OFFICER')!
  const moId   = byRole.get('MONITORING_OFFICER')!
  const ieoId  = byRole.get('INSPECTION_ENFORCEMENT_OFFICER')!
  const cmpId  = byRole.get('COMPLAINTS_OFFICER')!

  // ── Collect entities ────────────────────────────────────────────────────────

  // Enforcement actions in PENDING_REVIEW (for SR maker-checker)
  const pendingReview = await prisma.enforcementAction.findMany({
    where: { state: 'PENDING_REVIEW' },
    include: { industry: { select: { id: true, name: true } } },
    orderBy: { draftedAt: 'asc' },
    take: 8,
  })

  // Recently committed enforcement (for SR notice committed)
  const committed = await prisma.enforcementAction.findMany({
    where: { state: 'COMMITTED' },
    include: { industry: { select: { id: true, name: true } } },
    orderBy: { reviewedAt: 'desc' },
    take: 5,
  })

  // Top critical exceedances last 24h (for SR anomaly + MO exceedance)
  const since24h = new Date(Date.now() - 24 * 3_600_000)
  const criticalExceedances = await prisma.exceedance.findMany({
    where: { severity: 'CRITICAL', dispositionState: 'PENDING', detectedAt: { gte: since24h } },
    include: { station: { select: { id: true, name: true, industry: { select: { id: true, name: true } } } } },
    orderBy: { breachMagnitude: 'desc' },
    take: 10,
  })

  // All PENDING critical exceedances (fallback when last 24h too few)
  const allCritical = criticalExceedances.length >= 5 ? criticalExceedances : await prisma.exceedance.findMany({
    where: { severity: 'CRITICAL', dispositionState: 'PENDING' },
    include: { station: { select: { id: true, name: true, industry: { select: { id: true, name: true } } } } },
    orderBy: { breachMagnitude: 'desc' },
    take: 10,
  })

  // Consents expiring within 90 days (for CO renewal)
  const now = new Date()
  const in90d = new Date(now.getTime() + 90 * 24 * 3_600_000)
  const in60d = new Date(now.getTime() + 60 * 24 * 3_600_000)
  const in30d = new Date(now.getTime() + 30 * 24 * 3_600_000)

  const expiringConsents = await prisma.consentApplication.findMany({
    where: {
      state: { in: ['APPROVED', 'RENEWED'] },
      validityTo: { lte: in90d, gte: now },
    },
    include: { industry: { select: { id: true, name: true, category: true } } },
    orderBy: { validityTo: 'asc' },
    take: 20,
  })

  const due30 = expiringConsents.filter(c => c.validityTo && c.validityTo <= in30d).slice(0, 8)
  const due60 = expiringConsents.filter(c => c.validityTo && c.validityTo > in30d && c.validityTo <= in60d).slice(0, 8)
  const due90 = expiringConsents.filter(c => c.validityTo && c.validityTo > in60d && c.validityTo <= in90d).slice(0, 4)

  // Scheduled inspections within next 7 days (for IEO inspection due)
  const in7d = new Date(now.getTime() + 7 * 24 * 3_600_000)
  const scheduledInspections = await prisma.inspection.findMany({
    where: { state: 'SCHEDULED', scheduledAt: { lte: in7d } },
    include: { industry: { select: { id: true, name: true } } },
    orderBy: { scheduledAt: 'asc' },
    take: 8,
  })

  // Enforcement actions RETURNED_FOR_REVISION drafted by IEO (for IEO anomaly)
  const returnedForIeo = await prisma.enforcementAction.findMany({
    where: { state: 'RETURNED_FOR_REVISION', draftedById: ieoId },
    include: { industry: { select: { id: true, name: true } } },
    take: 3,
  })

  // PENDING_REVIEW actions drafted by IEO (for IEO maker checker)
  const ieoMakerChecker = await prisma.enforcementAction.findMany({
    where: { state: 'PENDING_REVIEW', draftedById: ieoId },
    include: { industry: { select: { id: true, name: true } } },
    take: 4,
  })

  // IN_PROGRESS complaints assigned to complaints officer (for CMP)
  const assignedComplaints = await prisma.complaint.findMany({
    where: { state: 'IN_PROGRESS', assignedToId: cmpId },
    include: { industry: { select: { id: true, name: true } } },
    orderBy: { receivedAt: 'desc' },
    take: 8,
  })

  // Fallback — any IN_PROGRESS complaint
  const allInProgress = assignedComplaints.length > 0
    ? assignedComplaints
    : await prisma.complaint.findMany({
        where: { state: { in: ['IN_PROGRESS', 'ASSIGNED'] } },
        include: { industry: { select: { id: true, name: true } } },
        orderBy: { receivedAt: 'desc' },
        take: 8,
      })

  // Offline stations (for MO anomaly)
  const offlineStations = await prisma.monitoringStation.findMany({
    where: { status: { not: 'active' } },
    include: { industry: { select: { id: true, name: true } } },
    take: 5,
  })

  // ── Build notification records ──────────────────────────────────────────────

  const rows: Array<{
    userId: string
    category: string
    priority: string
    payload: object
    createdAt: Date
    readAt: Date | null
  }> = []

  let idx = 0

  function push(userId: string, category: string, priority: string, payload: object, seedKey: string) {
    const createdAt = jitteredDate(seedKey, idx)
    const ra = readAt(createdAt, seedKey + String(idx))
    rows.push({ userId, category, priority, payload, createdAt, readAt: ra })
    idx++
  }

  // ── SENIOR_REVIEWER ─────────────────────────────────────────────────────────

  // MAKER_CHECKER_PENDING — one per PENDING_REVIEW enforcement, cap 8
  for (const ea of pendingReview) {
    push(srId, 'MAKER_CHECKER_PENDING',
      ea.type === 'CLOSURE_DIRECTION' ? 'URGENT' : 'HIGH',
      {
        title: `${humanType(ea.type)} awaiting your approval`,
        body: `${ea.industry.name} — submitted ${daysSince(ea.draftedAt)} ago. Review and approve or return.`,
        enforcementActionId: ea.id,
        industryId: ea.industry.id,
        industryName: ea.industry.name,
        type: ea.type,
        draftedAt: ea.draftedAt,
        actionCanvas: 'OPEN_MAKER_CHECKER_QUEUE',
      },
      `sr-mc-${ea.id}`,
    )
  }

  // NOTICE_COMMITTED — recently committed enforcement
  for (const ea of committed.slice(0, 3)) {
    push(srId, 'NOTICE_COMMITTED', 'MEDIUM',
      {
        title: `${humanType(ea.type)} committed for ${ea.industry.name}`,
        body: `Notice successfully committed and queued for delivery. Review timeline in Enforcement Pipeline.`,
        enforcementActionId: ea.id,
        industryId: ea.industry.id,
        industryName: ea.industry.name,
        type: ea.type,
        committedAt: ea.reviewedAt,
        actionCanvas: 'OPEN_ENFORCEMENT_PIPELINE',
      },
      `sr-committed-${ea.id}`,
    )
  }

  // ANOMALY_FLAG — top 5 critical exceedances
  for (const ex of allCritical.slice(0, 5)) {
    push(srId, 'ANOMALY_FLAG', 'URGENT',
      {
        title: `Critical ${ex.parameter} exceedance at ${ex.station.name}`,
        body: `${ex.observedValue.toFixed(1)} vs norm ${ex.normValue.toFixed(1)} — breach ${ex.breachMagnitude.toFixed(0)}%. Requires immediate attention.`,
        exceedanceId: ex.id,
        stationId: ex.station.id,
        stationName: ex.station.name,
        industryId: ex.station.industry?.id,
        industryName: ex.station.industry?.name,
        parameter: ex.parameter,
        observedValue: ex.observedValue,
        normValue: ex.normValue,
        breachMagnitude: ex.breachMagnitude,
        actionCanvas: 'OPEN_OCEMS_LIVE_GRID',
      },
      `sr-anomaly-${ex.id}`,
    )
  }

  // COMPLAINT_HOTSPOT_ALERT (1-2)
  const hotspotZones = [
    { zone: 'Ankleshwar GIDC', count: 8, lat: 21.62, lng: 72.99 },
    { zone: 'Vatva GIDC', count: 6, lat: 22.95, lng: 72.62 },
  ]
  for (const hs of hotspotZones) {
    push(srId, 'COMPLAINT_HOTSPOT_ALERT', 'HIGH',
      {
        title: `Complaint hotspot: ${hs.zone}`,
        body: `${hs.count} complaints within 1 km in the last 7 days. Coordinate with Complaints Officer for escalation.`,
        zone: hs.zone,
        count: hs.count,
        lat: hs.lat,
        lng: hs.lng,
        actionCanvas: 'OPEN_COMPLAINT_HOTSPOT_MAP',
      },
      `sr-hotspot-${hs.zone}`,
    )
  }

  // BROADCAST (2)
  push(srId, 'BROADCAST', 'MEDIUM',
    {
      title: 'State-wide DIWALI monitoring advisory',
      body: 'Enhanced PM10 / PM2.5 monitoring protocol activated for Diwali period 24 Oct – 28 Oct. All AAQM stations to report every 4h.',
      actionCanvas: 'OPEN_BROADCAST',
    },
    'sr-broadcast-diwali',
  )
  push(srId, 'BROADCAST', 'LOW',
    {
      title: 'CPCB revised BOD norm for Textile sector',
      body: 'CPCB has revised the BOD discharge standard for textile industries from 30 to 20 mg/L effective 1 Jan 2025.',
      actionCanvas: 'OPEN_GUJARAT_PULSE',
    },
    'sr-broadcast-bod',
  )

  // ── CONSENT_OFFICER ─────────────────────────────────────────────────────────

  // RENEWAL_DUE_30
  for (const c of due30) {
    const daysLeft = c.validityTo ? Math.ceil((c.validityTo.getTime() - now.getTime()) / 86_400_000) : 0
    push(coId, 'RENEWAL_DUE_30', 'HIGH',
      {
        title: `Consent expiring in ${daysLeft} days — ${c.industry.name}`,
        body: `${c.type} consent expires ${c.validityTo?.toLocaleDateString('en-IN')}. Initiate renewal to avoid lapse.`,
        consentId: c.id,
        industryId: c.industry.id,
        industryName: c.industry.name,
        industryCategory: c.industry.category,
        consentType: c.type,
        validityTo: c.validityTo,
        daysRemaining: daysLeft,
        actionCanvas: 'OPEN_RENEWAL_RADAR',
      },
      `co-r30-${c.id}`,
    )
  }

  // RENEWAL_DUE_60
  for (const c of due60) {
    const daysLeft = c.validityTo ? Math.ceil((c.validityTo.getTime() - now.getTime()) / 86_400_000) : 0
    push(coId, 'RENEWAL_DUE_60', 'MEDIUM',
      {
        title: `Consent due for renewal — ${c.industry.name}`,
        body: `${c.type} consent expires in ${daysLeft} days (${c.validityTo?.toLocaleDateString('en-IN')}). Schedule renewal review.`,
        consentId: c.id,
        industryId: c.industry.id,
        industryName: c.industry.name,
        industryCategory: c.industry.category,
        consentType: c.type,
        validityTo: c.validityTo,
        daysRemaining: daysLeft,
        actionCanvas: 'OPEN_RENEWAL_RADAR',
      },
      `co-r60-${c.id}`,
    )
  }

  // RENEWAL_DUE_90
  for (const c of due90) {
    const daysLeft = c.validityTo ? Math.ceil((c.validityTo.getTime() - now.getTime()) / 86_400_000) : 0
    push(coId, 'RENEWAL_DUE_90', 'MEDIUM',
      {
        title: `Upcoming renewal — ${c.industry.name}`,
        body: `${c.type} consent expires in ${daysLeft} days. Begin document preparation.`,
        consentId: c.id,
        industryId: c.industry.id,
        industryName: c.industry.name,
        consentType: c.type,
        validityTo: c.validityTo,
        daysRemaining: daysLeft,
        actionCanvas: 'OPEN_RENEWAL_RADAR',
      },
      `co-r90-${c.id}`,
    )
  }

  // GENERAL (pad to ~18 total for CO)
  push(coId, 'GENERAL', 'LOW',
    {
      title: 'GPCB e-consent portal scheduled maintenance',
      body: 'Portal will be unavailable on Sunday 08 Jun 2025 between 02:00–06:00 hrs for routine DB upgrade.',
      actionCanvas: 'OPEN_APPLICATION_QUEUE',
    },
    'co-general-maint',
  )
  push(coId, 'GENERAL', 'LOW',
    {
      title: 'New SOP for HWM consent conditions',
      body: 'Revised conditions for Hazardous Waste Management consents published. Review before next CTO processing.',
      actionCanvas: 'OPEN_CONSENT_DRAFT',
    },
    'co-general-sop',
  )

  // ── MONITORING_OFFICER ──────────────────────────────────────────────────────

  // EXCEEDANCE_CRITICAL — top 10 critical PENDING
  for (const ex of allCritical.slice(0, 10)) {
    push(moId, 'EXCEEDANCE_CRITICAL', 'URGENT',
      {
        title: `CRITICAL: ${ex.parameter} at ${ex.station.name}`,
        body: `Observed ${ex.observedValue.toFixed(1)} ${ex.parameter} vs norm ${ex.normValue.toFixed(1)} — ${ex.breachMagnitude.toFixed(0)}% above limit. Disposition required.`,
        exceedanceId: ex.id,
        stationId: ex.station.id,
        stationName: ex.station.name,
        industryId: ex.station.industry?.id,
        industryName: ex.station.industry?.name,
        parameter: ex.parameter,
        observedValue: ex.observedValue,
        normValue: ex.normValue,
        breachMagnitude: ex.breachMagnitude,
        severity: ex.severity,
        detectedAt: ex.detectedAt,
        actionCanvas: 'OPEN_EXCEEDANCE_FEED',
      },
      `mo-crit-${ex.id}`,
    )
  }

  // EXCEEDANCE_PREDICTED (3-5 fictional trend forecasts)
  const predictedForecasts = [
    { parameter: 'COD', station: 'Ankleshwar OCEMS-07', pct: 115, hours: 6 },
    { parameter: 'PM10', station: 'Vatva AAQM-01', pct: 108, hours: 12 },
    { parameter: 'BOD', station: 'Naroda OCEMS-03', pct: 103, hours: 4 },
    { parameter: 'SO2', station: 'Vapi AAQM-02', pct: 110, hours: 8 },
  ]
  for (const f of predictedForecasts) {
    push(moId, 'EXCEEDANCE_PREDICTED', 'HIGH',
      {
        title: `Predicted ${f.parameter} exceedance — ${f.station}`,
        body: `ML model predicts ${f.parameter} will reach ${f.pct}% of norm within ${f.hours}h based on trend. Pre-emptive action recommended.`,
        parameter: f.parameter,
        stationName: f.station,
        predictedBreachPct: f.pct,
        estimatedHoursToBreak: f.hours,
        actionCanvas: 'OPEN_PREDICTED_EXCEEDANCE',
      },
      `mo-pred-${f.station}-${f.parameter}`,
    )
  }

  // ANOMALY_FLAG — offline stations
  for (const st of offlineStations.slice(0, 3)) {
    push(moId, 'ANOMALY_FLAG', 'HIGH',
      {
        title: `Station offline: ${st.name}`,
        body: `${st.name} at ${st.industry?.name ?? 'Unknown'} has stopped reporting. Check connectivity and sensor integrity.`,
        stationId: st.id,
        stationName: st.name,
        industryId: st.industry?.id,
        industryName: st.industry?.name,
        status: st.status,
        actionCanvas: 'OPEN_OCEMS_LIVE_GRID',
      },
      `mo-offline-${st.id}`,
    )
  }

  // Pad MO to ~18 with additional anomalies
  push(moId, 'ANOMALY_FLAG', 'MEDIUM',
    {
      title: 'Unusual NH3-N spike at Sachin CETP',
      body: 'NH3-N reading of 87 mg/L detected — 74% above CTO norm of 50 mg/L. Investigate effluent from Pharmaceutical cluster.',
      parameter: 'NH3-N',
      observedValue: 87,
      normValue: 50,
      stationName: 'Sachin CETP',
      actionCanvas: 'OPEN_CETP_SCORECARD',
    },
    'mo-nh3-sachin',
  )
  push(moId, 'ANOMALY_FLAG', 'MEDIUM',
    {
      title: 'DO depletion in Sabarmati — MINARS-3',
      body: 'Dissolved Oxygen fell to 2.1 mg/L against minimum standard of 5 mg/L. Investigate upstream discharge sources.',
      parameter: 'DO',
      observedValue: 2.1,
      normValue: 5,
      stationName: 'Sabarmati MINARS-3',
      actionCanvas: 'OPEN_OCEMS_LIVE_GRID',
    },
    'mo-do-sabarmati',
  )

  // ── INSPECTION_ENFORCEMENT_OFFICER ──────────────────────────────────────────

  // INSPECTION_DUE — next 8 scheduled within 7 days
  for (const ins of scheduledInspections) {
    const daysToInspect = Math.ceil((ins.scheduledAt.getTime() - now.getTime()) / 86_400_000)
    push(ieoId, 'INSPECTION_DUE', 'HIGH',
      {
        title: `Inspection due in ${daysToInspect} day${daysToInspect !== 1 ? 's' : ''} — ${ins.industry.name}`,
        body: `Scheduled inspection on ${ins.scheduledAt.toLocaleDateString('en-IN')}. Prepare on-site checklist and coordinate with industry.`,
        inspectionId: ins.id,
        industryId: ins.industry.id,
        industryName: ins.industry.name,
        scheduledAt: ins.scheduledAt,
        daysToInspection: daysToInspect,
        actionCanvas: 'OPEN_INSPECTION_SCHEDULER',
      },
      `ieo-due-${ins.id}`,
    )
  }

  // ANOMALY_FLAG — returned-for-revision enforcement
  for (const ea of returnedForIeo) {
    push(ieoId, 'ANOMALY_FLAG', 'HIGH',
      {
        title: `Notice returned for revision — ${ea.industry.name}`,
        body: `Senior Reviewer has returned the ${humanType(ea.type)} for ${ea.industry.name}. Review notes and resubmit.`,
        enforcementActionId: ea.id,
        industryId: ea.industry.id,
        industryName: ea.industry.name,
        type: ea.type,
        reviewerNotes: ea.reviewerNotes,
        actionCanvas: 'OPEN_DRAFT_NOTICE',
      },
      `ieo-returned-${ea.id}`,
    )
  }

  // Pad if returnedForIeo was empty
  if (returnedForIeo.length === 0) {
    push(ieoId, 'ANOMALY_FLAG', 'MEDIUM',
      {
        title: 'CEQMS data gap — Vatva Chemicals',
        body: 'Online CEQMS at Vatva Chemicals has not transmitted data for 18 hours. Verify equipment during next site visit.',
        stationName: 'Vatva Chemicals CEQMS-01',
        gapHours: 18,
        actionCanvas: 'OPEN_OCEMS_LIVE_GRID',
      },
      'ieo-ceqms-gap',
    )
  }

  // MAKER_CHECKER_PENDING — IEO's own drafted items in PENDING_REVIEW
  for (const ea of ieoMakerChecker) {
    push(ieoId, 'MAKER_CHECKER_PENDING', 'MEDIUM',
      {
        title: `${humanType(ea.type)} pending SR approval — ${ea.industry.name}`,
        body: `Your ${humanType(ea.type)} submitted ${daysSince(ea.draftedAt)} ago is awaiting Senior Reviewer approval.`,
        enforcementActionId: ea.id,
        industryId: ea.industry.id,
        industryName: ea.industry.name,
        type: ea.type,
        draftedAt: ea.draftedAt,
        actionCanvas: 'OPEN_DRAFT_NOTICE',
      },
      `ieo-mc-${ea.id}`,
    )
  }

  // Pad IEO to ~18
  push(ieoId, 'INSPECTION_DUE', 'MEDIUM',
    {
      title: 'Quarterly inspection cycle due — Jhagadia GIDC cluster',
      body: '15 RED-category industries in Jhagadia GIDC are due for Q2 FY2025 mandatory inspection. Schedule before 30 Jun.',
      count: 15,
      zone: 'Jhagadia GIDC',
      actionCanvas: 'OPEN_INSPECTION_PRIORITISATION',
    },
    'ieo-quarterly-jhagadia',
  )
  push(ieoId, 'INSPECTION_DUE', 'LOW',
    {
      title: 'Field inspection plan for Sachin GIDC submitted',
      body: 'Monthly inspection plan approved by Regional Officer. 6 inspections scheduled this week.',
      zone: 'Sachin GIDC',
      count: 6,
      actionCanvas: 'OPEN_INSPECTION_SCHEDULER',
    },
    'ieo-plan-sachin',
  )

  // ── COMPLAINTS_OFFICER ──────────────────────────────────────────────────────

  // COMPLAINT_ASSIGNED — IN_PROGRESS complaints
  for (const c of allInProgress) {
    push(cmpId, 'COMPLAINT_ASSIGNED', 'HIGH',
      {
        title: `Complaint IN_PROGRESS — ${c.industry?.name ?? 'Unlinked complaint'}`,
        body: `${c.category ?? 'Odour/effluent'} complaint received ${daysSince(c.receivedAt)} ago. Resolution deadline approaching.`,
        complaintId: c.id,
        industryId: c.industry?.id,
        industryName: c.industry?.name,
        category: c.category,
        severity: c.severity,
        receivedAt: c.receivedAt,
        actionCanvas: 'OPEN_COMPLAINT_INBOX',
      },
      `cmp-assigned-${c.id}`,
    )
  }

  // COMPLAINT_HOTSPOT_ALERT — clusters >= 5 complaints near GIDC, top 3
  const gidicHotspots = [
    { zone: 'Ankleshwar GIDC', count: 9, lat: 21.62, lng: 72.99 },
    { zone: 'Naroda GIDC', count: 6, lat: 23.07, lng: 72.65 },
    { zone: 'Vapi-I GIDC', count: 5, lat: 20.37, lng: 72.91 },
  ]
  for (const hs of gidicHotspots) {
    push(cmpId, 'COMPLAINT_HOTSPOT_ALERT', 'HIGH',
      {
        title: `Hotspot alert: ${hs.count} complaints near ${hs.zone}`,
        body: `${hs.count} complaints logged within 1 km of ${hs.zone} in the last 7 days. Coordinate field inspection with IEO team.`,
        zone: hs.zone,
        count: hs.count,
        lat: hs.lat,
        lng: hs.lng,
        radiusKm: 1,
        actionCanvas: 'OPEN_COMPLAINT_HOTSPOT_MAP',
      },
      `cmp-hotspot-${hs.zone}`,
    )
  }

  // Pad CMP to ~18
  push(cmpId, 'COMPLAINT_ASSIGNED', 'MEDIUM',
    {
      title: 'New complaint batch from GPCB portal — 12 pending',
      body: '12 new web portal complaints received overnight. Triage and assign before 11:00 hrs.',
      count: 12,
      channel: 'WEB',
      actionCanvas: 'OPEN_AUTO_TRIAGE',
    },
    'cmp-batch-12',
  )
  push(cmpId, 'GENERAL', 'LOW',
    {
      title: 'SLA dashboard: 4 complaints approaching 30-day resolution deadline',
      body: 'Please check Citizen Response Tracker — 4 complaints will breach the 30-day SLA in the next 48 hours.',
      count: 4,
      actionCanvas: 'OPEN_CITIZEN_RESPONSE_TRACKER',
    },
    'cmp-sla-4',
  )

  // ── Bulk insert ─────────────────────────────────────────────────────────────
  // createMany does not support relations, use createMany with direct fields
  await prisma.notification.createMany({
    data: rows.map(r => ({
      userId:    r.userId,
      category:  r.category as never,
      priority:  r.priority as never,
      payload:   r.payload as never,
      createdAt: r.createdAt,
      readAt:    r.readAt,
    })),
    skipDuplicates: true,
  })
}

// ── Local helpers ────────────────────────────────────────────────────────────

function humanType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function daysSince(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day'
  return `${days} days`
}
