import { Prisma, type PrismaClient, type ViolationSource, type ViolationSeverity, type DispositionState } from '@prisma/client'

// ── Deterministic pseudo-random helper ───────────────────────────────────────
// Produces a number in [0, 1) from a string seed + integer counter.
function rng(seed: string, n: number): number {
  let h = n * 2654435761
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9)
  }
  h ^= h >>> 16
  return ((h >>> 0) / 0x100000000)
}

function pick<T>(arr: readonly T[], seed: string, n: number): T {
  const r = rng(seed, n)
  return arr[Math.floor(r * arr.length)] as T
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000)
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + months)
  return r
}

function subtractDays(d: Date, days: number): Date {
  return new Date(d.getTime() - days * 86_400_000)
}

// ── Observation templates ─────────────────────────────────────────────────────

const OBSERVATION_SETS = [
  {
    stackPM10: 'Stack PM10 measured at 145 µg/m³ against norm of 150 µg/m³. Baghouse filter operational.',
    effluentColour: 'Effluent appears light yellow; no strong odour detected at discharge point.',
    housekeeping: 'Housekeeping satisfactory. Spill containment bund intact. HW manifests available.',
    onlineCEQMS: 'Online CEQMS operational; data transmission to GPCB server verified on-site.',
  },
  {
    stackPM10: 'Stack PM10 at 182 µg/m³ exceeding norm of 150 µg/m³ during production peak. Corrective action initiated.',
    effluentColour: 'Final effluent dark brown; BOD and COD samples collected for lab analysis.',
    housekeeping: 'Minor spillage observed near drum storage area. Site manager directed to rectify.',
    onlineCEQMS: 'CEQMS data gap of 4 hours noted between 02:00–06:00; maintenance log requested.',
  },
  {
    stackPM10: 'Stack PM10 within limits at 98 µg/m³. ESP operating at 99.2% efficiency.',
    effluentColour: 'Effluent clear to pale blue. pH 7.2 at outlet — within prescribed range.',
    housekeeping: 'Excellent housekeeping; colour-coded storage bins, updated MSDS sheets on display.',
    onlineCEQMS: 'CEQMS all channels functional; real-time data accessible via GPCB dashboard.',
  },
  {
    stackPM10: 'Stack not accessible during inspection; maintenance shutdown underway. Records reviewed.',
    effluentColour: 'No discharge during inspection (plant shutdown). ETP holding tank levels within safe range.',
    housekeeping: 'PPE usage by workers observed to be non-compliant in one production bay. Notice issued.',
    onlineCEQMS: 'CEQMS power supply failure — UPS backup not functioning. Rectification within 48 h committed.',
  },
  {
    stackPM10: 'PM10 at 123 µg/m³; PM2.5 at 48 µg/m³. Both within norms. Wet scrubber in use.',
    effluentColour: 'Effluent treated through ZLD system. TDS at 1800 mg/L, COD at 210 mg/L — within limits.',
    housekeeping: 'Comprehensive waste log maintained. Hazardous waste sent to TSDF within stipulated period.',
    onlineCEQMS: 'All 6 CEQMS parameters transmitting correctly. Calibration records up to date.',
  },
  {
    stackPM10: 'PM10 at 195 µg/m³, PM2.5 at 87 µg/m³ — both exceeding norms. Production curtailed.',
    effluentColour: 'Black effluent observed; pH 9.8 (alkaline exceedance). Samples taken to GPCB lab.',
    housekeeping: 'Large accumulation of hazardous waste without proper labelling. Immediate notice issued.',
    onlineCEQMS: 'CEQMS offline for 3 days. No prior intimation to GPCB. Show-cause action recommended.',
  },
  {
    stackPM10: 'Stack PM10 at 138 µg/m³. FGD system recently installed and operational.',
    effluentColour: 'Effluent colour acceptable; BOD at 18 mg/L against norm of 30 mg/L. Good performance.',
    housekeeping: 'All consent conditions being complied with. Green belt maintained as stipulated.',
    onlineCEQMS: 'CEQMS functioning; SOx and NOx parameters within limits during inspection window.',
  },
  {
    stackPM10: 'PM10 near limits at 148 µg/m³. Plant management advised preventive maintenance of ESP.',
    effluentColour: 'Effluent colour light grey; suspended solids at 48 mg/L, slight exceedance (norm 45 mg/L).',
    housekeeping: 'Housekeeping moderate; one transformer bay had oil seepage. Corrective action underway.',
    onlineCEQMS: 'Data logger replaced last month. Calibration certificate verified. Transmitting normally.',
  },
]

// ── Violation parameter norms ─────────────────────────────────────────────────

interface ParamSpec {
  parameter: string
  unit: string
  norm: number
  minObs: number  // minimum observed value when violating
  maxObs: number  // maximum observed value when violating
}

const PARAM_SPECS: ParamSpec[] = [
  { parameter: 'PM10',               unit: 'µg/m³', norm: 150,  minObs: 155,  maxObs: 350  },
  { parameter: 'PM2_5',              unit: 'µg/m³', norm: 60,   minObs: 65,   maxObs: 150  },
  { parameter: 'SO2',                unit: 'µg/m³', norm: 80,   minObs: 90,   maxObs: 200  },
  { parameter: 'NOx',                unit: 'µg/m³', norm: 80,   minObs: 85,   maxObs: 180  },
  { parameter: 'COD',                unit: 'mg/L',  norm: 250,  minObs: 270,  maxObs: 650  },
  { parameter: 'BOD',                unit: 'mg/L',  norm: 30,   minObs: 35,   maxObs: 120  },
  { parameter: 'SS',                 unit: 'mg/L',  norm: 100,  minObs: 110,  maxObs: 280  },
  { parameter: 'pH',                 unit: '',      norm: 9.0,  minObs: 9.2,  maxObs: 11.5 },
  { parameter: 'NH3_N',              unit: 'mg/L',  norm: 50,   minObs: 55,   maxObs: 130  },
  { parameter: 'PHENOLIC_COMPOUNDS', unit: 'mg/L',  norm: 1.0,  minObs: 1.2,  maxObs: 4.5  },
]

// Source distribution: INSPECTION 60% / SENSOR 25% / COMPLAINT 10% / AUDIT 5%
const VIOLATION_SOURCES = [
  'INSPECTION', 'INSPECTION', 'INSPECTION', 'INSPECTION', 'INSPECTION', 'INSPECTION',
  'SENSOR',     'SENSOR',     'SENSOR',
  'COMPLAINT',
  'AUDIT',
] as const

// Severity distribution: MINOR 50% / MAJOR 35% / CRITICAL 15%
const VIOLATION_SEVERITIES = [
  'MINOR',  'MINOR',  'MINOR',  'MINOR',  'MINOR',  'MINOR',  'MINOR',  'MINOR',  'MINOR',  'MINOR',
  'MAJOR',  'MAJOR',  'MAJOR',  'MAJOR',  'MAJOR',  'MAJOR',  'MAJOR',
  'CRITICAL', 'CRITICAL', 'CRITICAL',
] as const

// Disposition distribution: PENDING 30% / CONFIRMED_VIOLATION 50% / RESOLVED 20%
const VIOLATION_DISPOSITIONS = [
  'PENDING',             'PENDING',             'PENDING',
  'CONFIRMED_VIOLATION', 'CONFIRMED_VIOLATION', 'CONFIRMED_VIOLATION', 'CONFIRMED_VIOLATION', 'CONFIRMED_VIOLATION',
  'RESOLVED',            'RESOLVED',
] as const

// ── Main seed function ────────────────────────────────────────────────────────

export async function seedInspections(prisma: PrismaClient): Promise<void> {
  // Skip if already seeded (idempotent)
  const existing = await prisma.inspection.count()
  if (existing >= 200) return

  // Fetch all industries and the IEO user
  const industries = await prisma.industry.findMany({ select: { id: true } })
  if (industries.length === 0) throw new Error('seedInspections: no industries found — run seedIndustries first')

  const ieoUsers = await prisma.user.findMany({
    where: { role: 'INSPECTION_ENFORCEMENT_OFFICER' },
    select: { id: true },
  })
  if (ieoUsers.length === 0) throw new Error('seedInspections: no IEO users found — run seedDemoUsers first')

  const now = new Date()
  const industryIds = industries.map((i) => i.id)
  const inspectorIds = ieoUsers.map((u) => u.id)

  // ── 200 COMPLETED inspections (scheduledAt + completedAt in last 12 months) ─

  for (let i = 0; i < 200; i++) {
    const seed = `insp-completed-${i}`

    // Random scheduledAt in last 12 months
    const daysAgo = Math.floor(rng(seed, 1) * 360) + 1   // 1..360
    const scheduledAt = subtractDays(now, daysAgo)

    // completedAt is 0–3 days after scheduledAt (same day or slightly delayed)
    const completionOffset = Math.floor(rng(seed, 2) * 4) // 0..3
    const completedAt = addDays(scheduledAt, completionOffset)

    // nextDueAt = completedAt + 6 months
    const nextDueAt = addMonths(completedAt, 6)

    const industryId = pick(industryIds, seed, 3)
    const inspectorId = pick(inspectorIds, seed, 4)
    const obsSet = pick(OBSERVATION_SETS, seed, 5)

    await prisma.inspection.create({
      data: {
        industryId,
        inspectorId,
        scheduledAt,
        completedAt,
        nextDueAt,
        state: 'COMPLETED',
        observations: obsSet as unknown as Prisma.InputJsonValue,
        photos: [] as unknown as Prisma.InputJsonValue,
      },
    })
  }

  // ── 50 SCHEDULED inspections (scheduledAt in next 30 days) ──────────────────

  for (let i = 0; i < 50; i++) {
    const seed = `insp-scheduled-${i}`

    // Random scheduledAt in next 30 days
    const daysAhead = Math.floor(rng(seed, 1) * 30) + 1   // 1..30
    const scheduledAt = addDays(now, daysAhead)

    const industryId = pick(industryIds, seed, 2)
    const inspectorId = pick(inspectorIds, seed, 3)

    await prisma.inspection.create({
      data: {
        industryId,
        inspectorId,
        scheduledAt,
        completedAt: null,
        nextDueAt: null,
        state: 'SCHEDULED',
        observations: {},
        photos: [] as unknown as Prisma.InputJsonValue,
      },
    })
  }

  // ── 120 Violations ───────────────────────────────────────────────────────────
  // Linked to ~60% of completed inspections; some have 2+.
  // Get all completed inspection IDs just created.
  const completedInspections = await prisma.inspection.findMany({
    where: { state: 'COMPLETED' },
    select: { id: true, industryId: true, completedAt: true },
    orderBy: { scheduledAt: 'asc' },
  })

  // Choose ~60% of completed inspections to have at least one violation.
  // We target exactly 120 violations spread across ~72 inspections (60% of 120 ≈ 72).
  // Strategy: first pass, collect which inspections get violations.
  const violationInspectionIndices: number[] = []
  for (let i = 0; i < completedInspections.length; i++) {
    if (rng(`vi-sel-${i}`, i) < 0.60) {
      violationInspectionIndices.push(i)
    }
  }

  // Distribute 120 violations across violationInspectionIndices.
  // Some get 2+ (roughly 20% get a second violation).
  const assignments: number[] = [] // each entry is an index into completedInspections
  for (const idx of violationInspectionIndices) {
    assignments.push(idx)
    // ~20% chance of a second violation
    if (rng(`vi-extra-${idx}`, idx) < 0.20) {
      assignments.push(idx)
    }
    if (assignments.length >= 120) break
  }
  // Trim or extend to exactly 120
  while (assignments.length < 120 && violationInspectionIndices.length > 0) {
    const extra = violationInspectionIndices[assignments.length % violationInspectionIndices.length]
    assignments.push(extra as number)
  }
  const finalAssignments = assignments.slice(0, 120)

  for (let vi = 0; vi < finalAssignments.length; vi++) {
    const inspIdx = finalAssignments[vi] as number
    const insp = completedInspections[inspIdx]!
    const seed = `viol-${vi}`

    const paramSpec = pick(PARAM_SPECS, seed, 1)
    const source = pick(VIOLATION_SOURCES, seed, 2)
    const severity = pick(VIOLATION_SEVERITIES, seed, 3)
    const disposition = pick(VIOLATION_DISPOSITIONS, seed, 4)

    // Observed value: random in [minObs, maxObs]
    const obsRange = paramSpec.maxObs - paramSpec.minObs
    const observedValue = paramSpec.minObs + rng(seed, 5) * obsRange

    // detectedAt = completedAt of the parent inspection (or within ±1 day for sensor/complaint sources)
    const baseDate = insp.completedAt ?? new Date()
    const detectedAt = source === 'INSPECTION'
      ? baseDate
      : addDays(baseDate, Math.floor(rng(seed, 6) * 3) - 1)

    // For non-INSPECTION sources, inspectionId is null
    const inspectionId = source === 'INSPECTION' ? insp.id : null

    await prisma.violation.create({
      data: {
        industryId: insp.industryId,
        inspectionId,
        source: source as ViolationSource,
        parameter: paramSpec.parameter,
        observedValue: Math.round(observedValue * 100) / 100,
        normValue: paramSpec.norm,
        unit: paramSpec.unit || null,
        severity: severity as ViolationSeverity,
        detectedAt,
        dispositionState: disposition as DispositionState,
      },
    })
  }
}
