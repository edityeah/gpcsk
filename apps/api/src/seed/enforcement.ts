import type { PrismaClient } from '@prisma/client'
import { writeAudit } from '../audit/service.js'

/**
 * Seed ~35 EnforcementActions linked to industries that already have
 * CONFIRMED_VIOLATION violations.
 *
 * Distribution:
 *   Types : SHOW_CAUSE 15 / CLOSURE_DIRECTION 8 / BANK_GUARANTEE_INVOCATION 4 / RECOVERY 5 / SEALING 3
 *   States: DRAFT 8 / PENDING_REVIEW 12 / COMMITTED 10 / RETURNED_FOR_REVISION 3 / WITHDRAWN 2
 *
 * All draftedById = IEO user; reviewedById (where applicable) = SR user.
 * Historic AuditLog entries are written for each state transition.
 */
export async function seedEnforcementActions(prisma: PrismaClient): Promise<void> {
  // ── Resolve user IDs ────────────────────────────────────────────────────────
  const ieo = await prisma.user.findFirstOrThrow({
    where: { role: 'INSPECTION_ENFORCEMENT_OFFICER' },
    select: { id: true },
  })
  const sr = await prisma.user.findFirstOrThrow({
    where: { role: 'SENIOR_REVIEWER' },
    select: { id: true },
  })

  const ieoId = ieo.id
  const srId = sr.id

  // ── Collect industries with CONFIRMED_VIOLATION violations ──────────────────
  const confirmedViolations = await prisma.violation.findMany({
    where: { dispositionState: 'CONFIRMED_VIOLATION' },
    select: { id: true, industryId: true, observedValue: true, normValue: true, parameter: true },
    orderBy: { industryId: 'asc' },
  })

  // Group violation IDs by industry (keep max 3 per industry)
  const byIndustry = new Map<string, Array<{ id: string; observedValue: number | null; normValue: number | null; parameter: string }>>()
  for (const v of confirmedViolations) {
    const existing = byIndustry.get(v.industryId) ?? []
    existing.push(v)
    byIndustry.set(v.industryId, existing)
  }

  // Take the first 35 distinct industries (we have 45 so plenty)
  const industryIds = Array.from(byIndustry.keys()).slice(0, 35)

  // ── Helper to compute evidence JSON from violation records ──────────────────
  function makeEvidence(
    vs: Array<{ id: string; observedValue: number | null; normValue: number | null; parameter: string }>,
    count: number,
  ) {
    const maxBreach = vs.reduce((max, v) => {
      if (v.observedValue == null || v.normValue == null || v.normValue === 0) return max
      const pct = ((v.observedValue - v.normValue) / v.normValue) * 100
      return pct > max ? pct : max
    }, 0)
    return {
      summary: `${count} confirmed violation${count > 1 ? 's' : ''} on parameters: ${vs.map(v => v.parameter).join(', ')}`,
      violation_count: count,
      max_breach_pct: Math.round(maxBreach * 10) / 10,
    }
  }

  // ── Date helpers ─────────────────────────────────────────────────────────────
  function daysAgo(n: number): Date {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
  }

  // ── Action definitions ───────────────────────────────────────────────────────
  // Each entry maps to one industryId from the list above.
  // (type, state, draftedDaysAgo, reviewedDaysAgo?, reviewerNotes?, deliveryChannel?, deliveryStatus?)
  type ActionDef = {
    type: 'SHOW_CAUSE' | 'CLOSURE_DIRECTION' | 'BANK_GUARANTEE_INVOCATION' | 'RECOVERY' | 'SEALING'
    state: 'DRAFT' | 'PENDING_REVIEW' | 'COMMITTED' | 'RETURNED_FOR_REVISION' | 'WITHDRAWN'
    draftedDaysAgo: number
    reviewedDaysAgo?: number
    reviewerNotes?: string
    deliveryChannel?: string
    deliveryStatus?: string
    violationCount: 1 | 2 | 3
  }

  const defs: ActionDef[] = [
    // ── DRAFT (8) ──────────────────────────────────────────────────────────────
    { type: 'SHOW_CAUSE',               state: 'DRAFT', draftedDaysAgo: 2,  violationCount: 1 },
    { type: 'SHOW_CAUSE',               state: 'DRAFT', draftedDaysAgo: 5,  violationCount: 1 },
    { type: 'SHOW_CAUSE',               state: 'DRAFT', draftedDaysAgo: 7,  violationCount: 2 },
    { type: 'CLOSURE_DIRECTION',        state: 'DRAFT', draftedDaysAgo: 3,  violationCount: 1 },
    { type: 'CLOSURE_DIRECTION',        state: 'DRAFT', draftedDaysAgo: 6,  violationCount: 2 },
    { type: 'RECOVERY',                 state: 'DRAFT', draftedDaysAgo: 4,  violationCount: 1 },
    { type: 'SEALING',                  state: 'DRAFT', draftedDaysAgo: 1,  violationCount: 1 },
    { type: 'BANK_GUARANTEE_INVOCATION',state: 'DRAFT', draftedDaysAgo: 8,  violationCount: 2 },

    // ── PENDING_REVIEW (12) ────────────────────────────────────────────────────
    { type: 'SHOW_CAUSE',               state: 'PENDING_REVIEW', draftedDaysAgo: 10, violationCount: 1 },
    { type: 'SHOW_CAUSE',               state: 'PENDING_REVIEW', draftedDaysAgo: 12, violationCount: 2 },
    { type: 'SHOW_CAUSE',               state: 'PENDING_REVIEW', draftedDaysAgo: 9,  violationCount: 1 },
    { type: 'SHOW_CAUSE',               state: 'PENDING_REVIEW', draftedDaysAgo: 14, violationCount: 3 },
    { type: 'SHOW_CAUSE',               state: 'PENDING_REVIEW', draftedDaysAgo: 11, violationCount: 2 },
    { type: 'CLOSURE_DIRECTION',        state: 'PENDING_REVIEW', draftedDaysAgo: 8,  violationCount: 2 },
    { type: 'CLOSURE_DIRECTION',        state: 'PENDING_REVIEW', draftedDaysAgo: 15, violationCount: 3 },
    { type: 'CLOSURE_DIRECTION',        state: 'PENDING_REVIEW', draftedDaysAgo: 13, violationCount: 1 },
    { type: 'RECOVERY',                 state: 'PENDING_REVIEW', draftedDaysAgo: 10, violationCount: 2 },
    { type: 'RECOVERY',                 state: 'PENDING_REVIEW', draftedDaysAgo: 7,  violationCount: 1 },
    { type: 'BANK_GUARANTEE_INVOCATION',state: 'PENDING_REVIEW', draftedDaysAgo: 16, violationCount: 2 },
    { type: 'SEALING',                  state: 'PENDING_REVIEW', draftedDaysAgo: 9,  violationCount: 1 },

    // ── COMMITTED (10) ────────────────────────────────────────────────────────
    { type: 'SHOW_CAUSE',               state: 'COMMITTED', draftedDaysAgo: 20, reviewedDaysAgo: 15,
      reviewerNotes: 'Approved — issue within 7 days.',
      deliveryChannel: 'EMAIL', deliveryStatus: 'DELIVERED', violationCount: 1 },
    { type: 'SHOW_CAUSE',               state: 'COMMITTED', draftedDaysAgo: 22, reviewedDaysAgo: 17,
      reviewerNotes: 'Approved — issue within 7 days.',
      deliveryChannel: 'EMAIL', deliveryStatus: 'DELIVERED', violationCount: 2 },
    { type: 'SHOW_CAUSE',               state: 'COMMITTED', draftedDaysAgo: 25, reviewedDaysAgo: 20,
      reviewerNotes: 'Approved — issue within 7 days.',
      deliveryChannel: 'EMAIL', deliveryStatus: 'QUEUED',   violationCount: 1 },
    { type: 'CLOSURE_DIRECTION',        state: 'COMMITTED', draftedDaysAgo: 18, reviewedDaysAgo: 12,
      reviewerNotes: 'Approved — issue within 7 days.',
      deliveryChannel: 'EMAIL', deliveryStatus: 'DELIVERED', violationCount: 3 },
    { type: 'CLOSURE_DIRECTION',        state: 'COMMITTED', draftedDaysAgo: 28, reviewedDaysAgo: 22,
      reviewerNotes: 'Approved — issue within 7 days.',
      deliveryChannel: 'EMAIL', deliveryStatus: 'DELIVERED', violationCount: 2 },
    { type: 'BANK_GUARANTEE_INVOCATION',state: 'COMMITTED', draftedDaysAgo: 21, reviewedDaysAgo: 16,
      reviewerNotes: 'Approved — issue within 7 days.',
      deliveryChannel: 'EMAIL', deliveryStatus: 'QUEUED',   violationCount: 2 },
    { type: 'BANK_GUARANTEE_INVOCATION',state: 'COMMITTED', draftedDaysAgo: 26, reviewedDaysAgo: 19,
      reviewerNotes: 'Approved — issue within 7 days.',
      deliveryChannel: 'EMAIL', deliveryStatus: 'DELIVERED', violationCount: 1 },
    { type: 'RECOVERY',                 state: 'COMMITTED', draftedDaysAgo: 23, reviewedDaysAgo: 18,
      reviewerNotes: 'Approved — issue within 7 days.',
      deliveryChannel: 'EMAIL', deliveryStatus: 'DELIVERED', violationCount: 1 },
    { type: 'RECOVERY',                 state: 'COMMITTED', draftedDaysAgo: 29, reviewedDaysAgo: 24,
      reviewerNotes: 'Approved — issue within 7 days.',
      deliveryChannel: 'EMAIL', deliveryStatus: 'QUEUED',   violationCount: 2 },
    { type: 'SEALING',                  state: 'COMMITTED', draftedDaysAgo: 27, reviewedDaysAgo: 21,
      reviewerNotes: 'Approved — issue within 7 days.',
      deliveryChannel: 'EMAIL', deliveryStatus: 'DELIVERED', violationCount: 2 },

    // ── RETURNED_FOR_REVISION (3) ──────────────────────────────────────────────
    { type: 'SHOW_CAUSE',               state: 'RETURNED_FOR_REVISION', draftedDaysAgo: 15, reviewedDaysAgo: 10,
      reviewerNotes: 'Insufficient evidence on stack #3; resubmit.', violationCount: 1 },
    { type: 'CLOSURE_DIRECTION',        state: 'RETURNED_FOR_REVISION', draftedDaysAgo: 19, reviewedDaysAgo: 13,
      reviewerNotes: 'Insufficient evidence on stack #3; resubmit.', violationCount: 2 },
    { type: 'SHOW_CAUSE',               state: 'RETURNED_FOR_REVISION', draftedDaysAgo: 17, reviewedDaysAgo: 11,
      reviewerNotes: 'Insufficient evidence on stack #3; resubmit.', violationCount: 1 },

    // ── WITHDRAWN (2) ─────────────────────────────────────────────────────────
    { type: 'SHOW_CAUSE', state: 'WITHDRAWN', draftedDaysAgo: 12, violationCount: 1 },
    { type: 'SHOW_CAUSE', state: 'WITHDRAWN', draftedDaysAgo: 14, violationCount: 1 },
  ]

  // Sanity check: defs length must match industryIds we need
  if (defs.length > industryIds.length) {
    throw new Error(
      `Need ${defs.length} distinct industries but only ${industryIds.length} have CONFIRMED_VIOLATION violations`,
    )
  }

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]!
    const industryId = industryIds[i]!
    const violations = (byIndustry.get(industryId) ?? []).slice(0, def.violationCount)
    const violationIds = violations.map(v => v.id)
    const evidence = makeEvidence(violations, violations.length)

    const draftedAt = daysAgo(def.draftedDaysAgo)

    const reviewedAt = def.reviewedDaysAgo != null ? daysAgo(def.reviewedDaysAgo) : undefined
    const reviewedById = reviewedAt != null ? srId : undefined

    // Build the record
    const action = await prisma.enforcementAction.create({
      data: {
        industryId,
        type: def.type,
        draftedById: ieoId,
        draftedAt,
        evidence,
        violationIds,
        state: def.state,
        reviewedById,
        reviewedAt,
        reviewerNotes: def.reviewerNotes ?? null,
        letterFileUrl: null,
        deliveryChannel: def.deliveryChannel ?? null,
        deliveryStatus: def.deliveryStatus ?? null,
      },
    })

    // ── Audit log: DRAFTED transition always ──────────────────────────────────
    await writeAudit({
      actorId: ieoId,
      entity: 'EnforcementAction',
      entityId: action.id,
      action: 'DRAFTED',
      before: null as never,
      after: { state: 'DRAFT', type: def.type, industryId } as never,
      reason: `Enforcement action drafted by IEO`,
    })

    // ── For states beyond DRAFT: SUBMITTED_FOR_REVIEW ─────────────────────────
    if (
      def.state === 'PENDING_REVIEW' ||
      def.state === 'COMMITTED' ||
      def.state === 'RETURNED_FOR_REVISION'
    ) {
      const submittedAt = new Date(draftedAt.getTime() + 2 * 24 * 60 * 60 * 1000)
      await writeAudit({
        actorId: ieoId,
        entity: 'EnforcementAction',
        entityId: action.id,
        action: 'SUBMITTED_FOR_REVIEW',
        before: { state: 'DRAFT' } as never,
        after: { state: 'PENDING_REVIEW' } as never,
        reason: `Submitted for Senior Reviewer approval`,
      })
      void submittedAt // referenced in concept; timestamps in AuditLog default to now
    }

    // ── For COMMITTED: APPROVED ───────────────────────────────────────────────
    if (def.state === 'COMMITTED') {
      await writeAudit({
        actorId: srId,
        entity: 'EnforcementAction',
        entityId: action.id,
        action: 'APPROVED',
        before: { state: 'PENDING_REVIEW' } as never,
        after: { state: 'COMMITTED', reviewerNotes: def.reviewerNotes } as never,
        reason: def.reviewerNotes,
      })
    }

    // ── For RETURNED_FOR_REVISION: RETURNED ───────────────────────────────────
    if (def.state === 'RETURNED_FOR_REVISION') {
      await writeAudit({
        actorId: srId,
        entity: 'EnforcementAction',
        entityId: action.id,
        action: 'RETURNED',
        before: { state: 'PENDING_REVIEW' } as never,
        after: { state: 'RETURNED_FOR_REVISION', reviewerNotes: def.reviewerNotes } as never,
        reason: def.reviewerNotes,
      })
    }

    // ── For WITHDRAWN: WITHDRAWN ──────────────────────────────────────────────
    if (def.state === 'WITHDRAWN') {
      await writeAudit({
        actorId: ieoId,
        entity: 'EnforcementAction',
        entityId: action.id,
        action: 'WITHDRAWN',
        before: { state: 'DRAFT' } as never,
        after: { state: 'WITHDRAWN' } as never,
        reason: `Maker recalled the action before submission`,
      })
    }
  }
}
