/**
 * GET /api/stats/headline — the five numbers each role should see before
 * opening any module. One fold on the home page (mirrors PM-SETU Saathi).
 *
 * Every item: { key, label, value, pct (0–100 for the ring, null when there
 * is no target), target, hint, tone, canvas }. Coverage before averages: a
 * figure with no source is "—", never 0.
 */

import type { Role } from '@gpcsk/shared'
import { prisma } from '../db.js'

export interface HeadlineItem {
  key: string
  label: string
  value: string
  pct: number | null
  target: string | null
  hint: string
  tone: 'indigo' | 'sky' | 'fuchsia' | 'amber' | 'rose' | 'emerald' | 'violet' | 'teal'
  canvas: string | null
}

export interface Headline {
  title: string
  items: HeadlineItem[]
}

const DAY = 24 * 60 * 60 * 1000
const ago = (days: number) => new Date(Date.now() - days * DAY)
const ahead = (days: number) => new Date(Date.now() + days * DAY)
const num = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'))
const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null)
const item = (o: Partial<HeadlineItem> & Pick<HeadlineItem, 'key' | 'label' | 'value'>): HeadlineItem => ({
  pct: null, target: null, hint: '', tone: 'indigo', canvas: null, ...o,
})

const OPEN_COMPLAINT_STATES = ['NEW', 'ASSIGNED', 'IN_PROGRESS'] as const

async function seniorReviewer(): Promise<Headline> {
  const [industries, stations, activeStations, exceedances24h, critical30d, pendingEnforcement, recommendedConsents, openComplaints, newComplaints7d] =
    await Promise.all([
      prisma.industry.count(),
      prisma.monitoringStation.count(),
      prisma.monitoringStation.count({ where: { status: 'active' } }),
      prisma.exceedance.count({ where: { detectedAt: { gte: ago(1) }, dispositionState: 'PENDING' } }),
      prisma.exceedance.count({ where: { detectedAt: { gte: ago(30) }, dispositionState: 'PENDING', severity: 'CRITICAL' } }),
      prisma.enforcementAction.count({ where: { state: 'PENDING_REVIEW' } }),
      prisma.consentApplication.count({ where: { state: 'RECOMMENDED' } }),
      prisma.complaint.count({ where: { state: { in: [...OPEN_COMPLAINT_STATES] } } }),
      prisma.complaint.count({ where: { receivedAt: { gte: ago(7) } } }),
    ])
  const online = pct(activeStations, stations)
  return {
    title: `Gujarat · ${num(industries)} industries · ${num(stations)} stations`,
    items: [
      item({ key: 'exc24', label: 'Exceedances (24 h)', value: num(exceedances24h), hint: `${num(critical30d)} critical pending · 30 d`, tone: exceedances24h > 0 ? 'rose' : 'emerald', canvas: 'OPEN_EXCEEDANCE_FEED' }),
      item({ key: 'critical', label: 'Critical anomalies', value: num(critical30d), hint: 'pending disposition · 30 d', tone: critical30d > 0 ? 'rose' : 'emerald', canvas: 'OPEN_WAR_ROOM' }),
      item({ key: 'signoff', label: 'Awaiting your sign-off', value: num(pendingEnforcement + recommendedConsents), hint: `${num(pendingEnforcement)} notices · ${num(recommendedConsents)} consents`, tone: pendingEnforcement + recommendedConsents > 0 ? 'violet' : 'emerald', canvas: 'OPEN_MAKER_CHECKER_QUEUE' }),
      item({ key: 'complaints', label: 'Open complaints', value: num(openComplaints), hint: `${num(newComplaints7d)} received this week`, tone: 'amber', canvas: 'OPEN_COMPLAINT_INBOX' }),
      item({ key: 'online', label: 'Stations reporting', value: online == null ? '—' : `${online}%`, pct: online, target: 'aim 95%+', hint: `${num(activeStations)} of ${num(stations)} online`, tone: online != null && online >= 95 ? 'emerald' : 'sky', canvas: 'OPEN_PROGRAMS' }),
    ],
  }
}

async function consentOfficer(): Promise<Headline> {
  const [queue, recommended, renewals30, expiredActive, underReview, approved90, rejected90] = await Promise.all([
    prisma.consentApplication.count({ where: { state: { in: ['DRAFT', 'UNDER_REVIEW'] } } }),
    prisma.consentApplication.count({ where: { state: 'RECOMMENDED' } }),
    prisma.consentApplication.count({ where: { state: { in: ['APPROVED', 'RENEWED'] }, validityTo: { gte: new Date(), lte: ahead(30) } } }),
    prisma.consentApplication.count({ where: { state: { in: ['APPROVED', 'RENEWED'] }, validityTo: { lt: new Date() } } }),
    prisma.consentApplication.findMany({ where: { state: 'UNDER_REVIEW' }, select: { docVerification: true } }),
    prisma.consentApplication.count({ where: { state: 'APPROVED', updatedAt: { gte: ago(90) } } }),
    prisma.consentApplication.count({ where: { state: 'REJECTED', updatedAt: { gte: ago(90) } } }),
  ])
  // Applications where the AI verifier flagged at least one document.
  const flagged = underReview.filter((a) => {
    const dv = a.docVerification as Record<string, unknown> | null
    if (!dv || typeof dv !== 'object') return false
    return Object.values(dv).some((v) => {
      const status = typeof v === 'string' ? v : (v as { status?: string } | null)?.status
      return status && status !== 'OK'
    })
  }).length
  const approvalRate = pct(approved90, approved90 + rejected90)
  return {
    title: `Consent desk · ${num(queue + recommended)} applications in flight`,
    items: [
      item({ key: 'queue', label: 'In your queue', value: num(queue), hint: 'draft + under review', tone: 'indigo', canvas: 'OPEN_APPLICATION_QUEUE' }),
      item({ key: 'flagged', label: 'Docs flagged by AI', value: num(flagged), hint: 'blank · missing · blurred · unclear', tone: flagged > 0 ? 'rose' : 'emerald', canvas: 'OPEN_AI_VERIFICATION' }),
      item({ key: 'recommended', label: 'With the checker', value: num(recommended), hint: 'recommended · awaiting Member Secretary', tone: 'violet', canvas: 'OPEN_CONSENT_PIPELINE' }),
      item({ key: 'renewals', label: 'Renewals due (30 d)', value: num(renewals30), hint: `${num(expiredActive)} already expired`, tone: renewals30 > 0 ? 'amber' : 'emerald', canvas: 'OPEN_RENEWAL_RADAR' }),
      item({ key: 'approval', label: 'Approval rate (90 d)', value: approvalRate == null ? '—' : `${approvalRate}%`, pct: approvalRate, target: 'decided applications', hint: `${num(approved90)} approved · ${num(rejected90)} rejected`, tone: 'sky', canvas: 'OPEN_CONSENT_PIPELINE' }),
    ],
  }
}

async function monitoringOfficer(): Promise<Headline> {
  const [stations, active, exceedances24h, liveStations, lastIngest, bypassCetps, offline] = await Promise.all([
    prisma.monitoringStation.count(),
    prisma.monitoringStation.count({ where: { status: 'active' } }),
    prisma.exceedance.count({ where: { detectedAt: { gte: ago(1) }, dispositionState: 'PENDING' } }),
    prisma.monitoringStation.count({ where: { dataSource: 'CPCB_LIVE' } }),
    prisma.monitoringStation.findFirst({ where: { lastIngestedAt: { not: null } }, orderBy: { lastIngestedAt: 'desc' }, select: { lastIngestedAt: true } }),
    prisma.cetpMonitoringReport.findMany({ where: { monthOf: { gte: ago(45) }, bypassMld: { gt: 0 } }, select: { cetpId: true }, distinct: ['cetpId'] }),
    prisma.monitoringStation.count({ where: { status: { not: 'active' } } }),
  ])
  const online = pct(active, stations)
  const ingestedAt = lastIngest?.lastIngestedAt
  const ingestHint = ingestedAt ? `last pull ${new Date(ingestedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'no live pull yet'
  return {
    title: `Monitoring · ${num(stations)} stations across OCEMS · AAQM · CETP · VOC`,
    items: [
      item({ key: 'online', label: 'Stations online', value: online == null ? '—' : `${online}%`, pct: online, target: 'aim 95%+', hint: `${num(active)} of ${num(stations)} reporting`, tone: online != null && online >= 95 ? 'emerald' : 'amber', canvas: 'OPEN_PROGRAMS' }),
      item({ key: 'exc24', label: 'Exceedances (24 h)', value: num(exceedances24h), hint: 'pending disposition', tone: exceedances24h > 0 ? 'rose' : 'emerald', canvas: 'OPEN_EXCEEDANCE_FEED' }),
      item({ key: 'live', label: 'CPCB live stations', value: num(liveStations), hint: ingestHint, tone: liveStations > 0 ? 'emerald' : 'amber', canvas: 'OPEN_AAQM_MONITOR' }),
      item({ key: 'bypass', label: 'CETPs reporting bypass', value: num(bypassCetps.length), hint: 'bypass MLD > 0 · latest month', tone: bypassCetps.length > 0 ? 'rose' : 'emerald', canvas: 'OPEN_CETP_SCORECARD' }),
      item({ key: 'dropouts', label: 'Sensor dropouts', value: num(offline), hint: 'stations not active', tone: offline > 0 ? 'amber' : 'emerald', canvas: 'OPEN_OCEMS_LIVE_GRID' }),
    ],
  }
}

async function inspectionOfficer(): Promise<Headline> {
  const now = new Date()
  const [thisWeek, overdue, openViolations, suggestions, notices, completed30, scheduled30] = await Promise.all([
    prisma.inspection.count({ where: { state: 'SCHEDULED', scheduledAt: { gte: now, lte: ahead(7) } } }),
    prisma.inspection.count({ where: { state: 'SCHEDULED', scheduledAt: { lt: now } } }),
    prisma.violation.count({ where: { dispositionState: 'PENDING' } }),
    prisma.riskBasedSuggestion.count({ where: { state: 'SUGGESTED' } }),
    prisma.enforcementAction.count({ where: { state: { in: ['DRAFT', 'PENDING_REVIEW'] } } }),
    prisma.inspection.count({ where: { state: 'COMPLETED', completedAt: { gte: ago(30) } } }),
    prisma.inspection.count({ where: { scheduledAt: { gte: ago(30), lte: now } } }),
  ])
  const completion = pct(completed30, scheduled30)
  return {
    title: `Field · ${num(thisWeek)} inspections this week · ${num(overdue)} overdue`,
    items: [
      item({ key: 'week', label: 'Inspections this week', value: num(thisWeek), hint: 'scheduled · next 7 days', tone: 'indigo', canvas: 'OPEN_INSPECTION_SCHEDULER' }),
      item({ key: 'overdue', label: 'Overdue inspections', value: num(overdue), hint: 'scheduled date passed', tone: overdue > 0 ? 'rose' : 'emerald', canvas: 'OPEN_INSPECTION_PRIORITISATION' }),
      item({ key: 'violations', label: 'Open violations', value: num(openViolations), hint: 'pending disposition', tone: openViolations > 0 ? 'amber' : 'emerald', canvas: 'OPEN_VIOLATIONS_REGISTER' }),
      item({ key: 'risk', label: 'AI risk suggestions', value: num(suggestions), hint: `${num(notices)} notices in draft / review`, tone: suggestions > 0 ? 'violet' : 'emerald', canvas: 'OPEN_RISK_BASED_INSPECTIONS' }),
      item({ key: 'completion', label: 'Completion (30 d)', value: completion == null ? '—' : `${completion}%`, pct: completion, target: 'of inspections due', hint: `${num(completed30)} completed · ${num(scheduled30)} due`, tone: completion != null && completion >= 80 ? 'emerald' : 'amber', canvas: 'OPEN_INSPECTION_SCHEDULER' }),
    ],
  }
}

async function complaintsOfficer(): Promise<Headline> {
  const [new7d, open, unassigned, received30, resolved30, hotspots] = await Promise.all([
    prisma.complaint.count({ where: { receivedAt: { gte: ago(7) } } }),
    prisma.complaint.count({ where: { state: { in: [...OPEN_COMPLAINT_STATES] } } }),
    prisma.complaint.count({ where: { state: { in: [...OPEN_COMPLAINT_STATES] }, assignedToId: null } }),
    prisma.complaint.count({ where: { receivedAt: { gte: ago(30) } } }),
    prisma.complaint.count({ where: { receivedAt: { gte: ago(30) }, state: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*)::bigint AS cnt FROM (
        SELECT 1 FROM "Complaint"
        WHERE lat IS NOT NULL AND lng IS NOT NULL AND "receivedAt" >= ${ago(14)}
        GROUP BY ROUND(lat::numeric, 1), ROUND(lng::numeric, 1)
        HAVING COUNT(*) >= 2
      ) h
    `,
  ])
  const hotspotCount = Number(hotspots[0]?.cnt ?? 0)
  const resolution = pct(resolved30, received30)
  return {
    title: `Complaints · ${num(open)} open · ${num(new7d)} new this week`,
    items: [
      item({ key: 'new', label: 'New this week', value: num(new7d), hint: 'all channels', tone: 'indigo', canvas: 'OPEN_COMPLAINT_INBOX' }),
      item({ key: 'open', label: 'Open complaints', value: num(open), hint: 'new · assigned · in progress', tone: open > 0 ? 'amber' : 'emerald', canvas: 'OPEN_COMPLAINT_INBOX' }),
      item({ key: 'unassigned', label: 'Awaiting triage', value: num(unassigned), hint: 'no officer assigned', tone: unassigned > 0 ? 'rose' : 'emerald', canvas: 'OPEN_AUTO_TRIAGE' }),
      item({ key: 'hotspots', label: 'Hotspot zones (14 d)', value: num(hotspotCount), hint: '2+ complaints in the same grid cell', tone: hotspotCount > 0 ? 'rose' : 'emerald', canvas: 'OPEN_COMPLAINT_HOTSPOT_MAP' }),
      item({ key: 'resolution', label: 'Resolved (30 d)', value: resolution == null ? '—' : `${resolution}%`, pct: resolution, target: 'aim 90%+', hint: `${num(resolved30)} of ${num(received30)} received`, tone: resolution != null && resolution >= 90 ? 'emerald' : 'sky', canvas: 'OPEN_CITIZEN_RESPONSE_TRACKER' }),
    ],
  }
}

export async function buildHeadline(role: Role): Promise<Headline> {
  switch (role) {
    case 'SENIOR_REVIEWER':                return seniorReviewer()
    case 'CONSENT_OFFICER':                return consentOfficer()
    case 'MONITORING_OFFICER':             return monitoringOfficer()
    case 'INSPECTION_ENFORCEMENT_OFFICER': return inspectionOfficer()
    case 'COMPLAINTS_OFFICER':             return complaintsOfficer()
    default:                               return { title: '', items: [] }
  }
}
