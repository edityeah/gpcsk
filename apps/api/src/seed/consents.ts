import { Prisma, type PrismaClient } from '@prisma/client'

// ── Deterministic pseudo-random helpers ───────────────────────────────────

/** Simple deterministic hash for a string key → 0..1 float */
function seededFloat(key: string): number {
  let h = 5381
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(h, 33) + key.charCodeAt(i)) | 0
  }
  return ((h >>> 0) / 0xffffffff)
}

/** Pick an item from an array deterministically */
function pick<T>(arr: readonly T[], key: string): T {
  const idx = Math.floor(seededFloat(key) * arr.length)
  return arr[Math.min(idx, arr.length - 1)] as T
}

/** Return a Date offset by `daysAgo` from today (negative = future) */
function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Return a Date `yearsAgo` years in the past */
function yearsAgo(years: number, offsetDays = 0): Date {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  d.setDate(d.getDate() - offsetDays)
  d.setHours(0, 0, 0, 0)
  return d
}

/** clamp an integer [0, max) deterministically using a float seed */
function seededInt(f: number, max: number): number {
  return Math.min(Math.floor(f * max), max - 1)
}

// ── State distribution ────────────────────────────────────────────────────
//
//  APPROVED      55%  (220 / 400)
//  UNDER_REVIEW  12%  ( 48 / 400)
//  RECOMMENDED   10%  ( 40 / 400)
//  REJECTED       5%  ( 20 / 400)
//  EXPIRED        8%  ( 32 / 400)
//  RENEWED        5%  ( 20 / 400)
//  DRAFT          5%  ( 20 / 400)
//
//  Of the 220 APPROVED, ~50 should have validityTo within the next 90 days
//  (renewal-radar window: mix of ~17 / 17 / 16 for 30d / 60d / 90d).

const STATE_SLOTS = [
  ...Array(220).fill('APPROVED'),
  ...Array(48).fill('UNDER_REVIEW'),
  ...Array(40).fill('RECOMMENDED'),
  ...Array(20).fill('REJECTED'),
  ...Array(32).fill('EXPIRED'),
  ...Array(20).fill('RENEWED'),
  ...Array(20).fill('DRAFT'),
] as const

type ConsentStateStr =
  | 'APPROVED'
  | 'UNDER_REVIEW'
  | 'RECOMMENDED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'RENEWED'
  | 'DRAFT'

// ── Parameters templates per consent type ────────────────────────────────

function cteParameters(industryName: string): Record<string, unknown> {
  const f = seededFloat(`cte-param-${industryName}`)
  return {
    stackEmissions: {
      PM10_mgNm3:  parseFloat((40 + f * 60).toFixed(2)),
      SO2_mgNm3:   parseFloat((100 + f * 150).toFixed(2)),
      NOx_mgNm3:   parseFloat((150 + f * 200).toFixed(2)),
      HCl_mgNm3:   parseFloat((10  + f * 40).toFixed(2)),
    },
    waterIntake: {
      kLD: parseFloat((20 + seededFloat(`cte-w-${industryName}`) * 180).toFixed(1)),
    },
    greenBeltPercent: parseFloat((20 + f * 15).toFixed(1)),
    constructionArea_m2: Math.round(1000 + f * 9000),
  }
}

function ctoParameters(industryName: string): Record<string, unknown> {
  const f  = seededFloat(`cto-param-${industryName}`)
  const f2 = seededFloat(`cto-dis-${industryName}`)
  return {
    dischargeLimits: {
      pH:    { min: 6.5, max: 8.5 },
      COD_mgL: parseFloat((150 + f * 100).toFixed(2)),
      BOD_mgL: parseFloat((30  + f * 20).toFixed(2)),
      TSS_mgL: parseFloat((100 + f * 50).toFixed(2)),
      TDS_mgL: parseFloat((2100 + f2 * 900).toFixed(2)),
    },
    stackEmissions: {
      PM10_mgNm3:  parseFloat((40  + f * 60).toFixed(2)),
      SO2_mgNm3:   parseFloat((100 + f * 200).toFixed(2)),
      NOx_mgNm3:   parseFloat((150 + f * 150).toFixed(2)),
    },
    waterIntake: {
      kLD: parseFloat((20 + seededFloat(`cto-w-${industryName}`) * 280).toFixed(1)),
    },
    recyclePercent: parseFloat((60 + f * 35).toFixed(1)),
    effluentTreatment: pick(['ETP+STP', 'ETP', 'CETP-member', 'ZLD'], `cto-et-${industryName}`),
  }
}

function hwAuthParameters(industryName: string): Record<string, unknown> {
  const f = seededFloat(`hw-param-${industryName}`)
  return {
    hazardousWaste: {
      storageCapacity_MT: parseFloat((5 + f * 95).toFixed(2)),
      annualGeneration_MT: parseFloat((2 + f * 48).toFixed(2)),
      category: pick(['Category 1', 'Category 2', 'Category 3', 'Category 4'], `hw-cat-${industryName}`),
    },
    disposalMethod: pick(
      ['TSDF', 'Co-processing', 'Incineration', 'Secured Landfill', 'Recycling'],
      `hw-disp-${industryName}`,
    ),
    stackEmissions: {
      PM10_mgNm3: parseFloat((50 + f * 80).toFixed(2)),
    },
    waterIntake: {
      kLD: parseFloat((5 + seededFloat(`hw-w-${industryName}`) * 50).toFixed(1)),
    },
  }
}

// ── Validity window calculation ───────────────────────────────────────────

type ConsentTypeStr = 'CTE' | 'CTO' | 'HW_AUTH'

function validityYears(type: ConsentTypeStr): number {
  if (type === 'CTO') return 5
  if (type === 'CTE') return 3
  return 5 // HW_AUTH
}

// ── Main seed function ────────────────────────────────────────────────────

export async function seedConsents(prisma: PrismaClient): Promise<void> {
  // 1. Load industries + users once
  const industries = await prisma.industry.findMany({ select: { id: true, name: true } })
  if (industries.length === 0) {
    throw new Error('seedConsents: no industries found — run seedIndustries first')
  }

  const coUser = await prisma.user.findFirst({ where: { role: 'CONSENT_OFFICER' } })
  const srUser = await prisma.user.findFirst({ where: { role: 'SENIOR_REVIEWER' } })

  if (!coUser) throw new Error('seedConsents: CONSENT_OFFICER user not found')
  if (!srUser) throw new Error('seedConsents: SENIOR_REVIEWER user not found')

  const makerId   = coUser.id
  const checkerId = srUser.id

  // 2. Shuffle the state slots deterministically (Fisher-Yates with seeded floats)
  const stateSlots = [...STATE_SLOTS] as ConsentStateStr[]
  for (let i = stateSlots.length - 1; i > 0; i--) {
    const j = seededInt(seededFloat(`shuffle-${i}`), i + 1)
    const tmp = stateSlots[i] as ConsentStateStr
    stateSlots[i] = stateSlots[j] as ConsentStateStr
    stateSlots[j] = tmp
  }

  // 3. Identify which APPROVED slots become renewal-radar entries (first 50)
  //    validityTo set to now + 30 / 60 / 90 days cyclically
  const renewalBuckets = [30, 60, 90] as const
  let renewalRadarCount = 0

  // 4. Consent types cycle: CTE / CTO / HW_AUTH to spread evenly
  const consentTypes: ConsentTypeStr[] = ['CTE', 'CTO', 'HW_AUTH']

  // 5. Upsert all applications
  //    Total target: stateSlots.length (400)
  for (let i = 0; i < stateSlots.length; i++) {
    const state = stateSlots[i] as ConsentStateStr
    const industry = industries[i % industries.length]!
    const type     = consentTypes[i % consentTypes.length]!
    const key      = `consent-${i}-${industry.id}-${type}`

    // Spread submittedAt over last 5 years
    const submittedDaysAgo = Math.round(seededFloat(key + '-sub') * 5 * 365)
    const submittedAt = daysAgo(submittedDaysAgo)

    // Compute validity window for terminal + approved states
    let validityFrom: Date | undefined
    let validityTo: Date | undefined

    const valYears = validityYears(type)

    const isTerminal = state === 'APPROVED' || state === 'EXPIRED' || state === 'RENEWED'

    if (isTerminal) {
      validityFrom = new Date(submittedAt)
      validityFrom.setDate(validityFrom.getDate() + 30) // 30 days after submission

      if (state === 'APPROVED') {
        // First 50 APPROVED → renewal radar (within next 30/60/90 days)
        if (renewalRadarCount < 50) {
          const bucketDays = renewalBuckets[renewalRadarCount % renewalBuckets.length]!
          validityTo = daysAgo(-(bucketDays)) // future
          validityFrom = new Date(validityTo)
          validityFrom.setFullYear(validityFrom.getFullYear() - valYears)
          renewalRadarCount++
        } else {
          // Regular approved: validityFrom = past, validityTo = further in past or future
          validityTo = new Date(validityFrom)
          validityTo.setFullYear(validityTo.getFullYear() + valYears)
        }
      } else if (state === 'EXPIRED') {
        // validityTo is in the past
        validityTo = new Date(validityFrom)
        validityTo.setFullYear(validityTo.getFullYear() + valYears)
        // Ensure it is in the past
        if (validityTo > new Date()) {
          validityTo = daysAgo(30 + seededInt(seededFloat(key + '-exp'), 365))
          validityFrom = new Date(validityTo)
          validityFrom.setFullYear(validityFrom.getFullYear() - valYears)
        }
      } else {
        // RENEWED: was approved, now renewed — validityTo is in the future
        validityTo = new Date(validityFrom)
        validityTo.setFullYear(validityTo.getFullYear() + valYears)
        // Make it a recent renewal
        validityFrom = daysAgo(60 + seededInt(seededFloat(key + '-ren'), 300))
        validityTo   = new Date(validityFrom)
        validityTo.setFullYear(validityTo.getFullYear() + valYears)
      }
    }

    // Maker / checker assignment rules
    //  - DRAFT / UNDER_REVIEW → no checker
    //  - All other states → both maker + checker
    const needsChecker = state !== 'DRAFT' && state !== 'UNDER_REVIEW'

    // Fee status: PAID for most; PENDING for DRAFT, and ~10% others
    let feeStatus: string
    if (state === 'DRAFT') {
      feeStatus = 'PENDING'
    } else if (seededFloat(key + '-fee') < 0.9) {
      feeStatus = 'PAID'
    } else {
      feeStatus = 'PENDING'
    }

    // Parameters JSON per type
    let parameters: Record<string, unknown>
    if (type === 'CTE') {
      parameters = cteParameters(industry.name + key)
    } else if (type === 'CTO') {
      parameters = ctoParameters(industry.name + key)
    } else {
      parameters = hwAuthParameters(industry.name + key)
    }

    // Reviewer notes for rejected / returned
    let reviewerNotes: string | undefined
    if (state === 'REJECTED') {
      reviewerNotes = pick(
        [
          'Incomplete ETP design details. Resubmit with revised drawings.',
          'Stack height insufficient per CPCB norms. Update parameters and reapply.',
          'HW storage facility does not meet Schedule I norms. Rectify and reapply.',
          'Discharge limits exceed GPCB norms for COD/BOD. Install advanced ETP.',
          'Green belt area below 20% of total plot. Compliance required before grant.',
        ],
        key + '-notes',
      )
    }

    // Unique key: industryId + type + submittedAt (use index as tiebreaker via key)
    // We use upsert on a composite that includes index to allow multiple per industry
    // Prisma doesn't have a composite unique on these fields, so we use findFirst + create
    const existing = await prisma.consentApplication.findFirst({
      where: {
        industryId:  industry.id,
        type:        type as never,
        submittedAt,
      },
      select: { id: true },
    })

    if (!existing) {
      await prisma.consentApplication.create({
        data: {
          industryId:   industry.id,
          type:         type as never,
          submittedAt,
          validityFrom: validityFrom ?? null,
          validityTo:   validityTo   ?? null,
          state:        state as never,
          parameters: parameters as Prisma.InputJsonValue,
          feeStatus,
          makerId,
          checkerId:    needsChecker ? checkerId : null,
          reviewerNotes: reviewerNotes ?? null,
        },
      })
    }
  }
}
