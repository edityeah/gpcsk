import type { PrismaClient } from '@prisma/client'

// ── Deterministic jitter ───────────────────────────────────────────────────

/** Returns a pseudo-random float in [min, max] derived from seed + axis. */
function jitterVal(seed: string, axis: string, min: number, max: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  for (let i = 0; i < axis.length; i++) {
    h = (Math.imul(37, h) + axis.charCodeAt(i)) | 0
  }
  const t = ((h >>> 0) % 10001) / 10000   // [0, 1]
  return min + t * (max - min)
}

/** Jitters a numeric norm value by ±fraction, deterministically. */
function jitterNorm(base: number, fraction: number, seed: string, axis: string): number {
  const t = jitterVal(seed, axis, 0, 1)
  const delta = base * fraction * (t * 2 - 1)   // [-fraction*base, +fraction*base]
  return Math.round((base + delta) * 100) / 100
}

// ── Norm constants ─────────────────────────────────────────────────────────

const INLET_NORMS = {
  pH: '6.5-8.5',
  COD: 2000,
  BOD: 700,
  SS: 300,
  'NH3-N': 50,
  'Phenolic Compounds': 1,
}

const FINAL_STDS = {
  pH: '6.5-8.5',
  COD: 250,
  BOD: 30,
  SS: 100,
  'NH3-N': 50,
  'Phenolic Compounds': 1,
}

// ── CETP definitions ───────────────────────────────────────────────────────

interface CetpDef {
  name: string
  capacityMld: number
  district: string
  memberUnitsCount: number
  hasOnlineCeqms: boolean
  spraydryerUnits: number | null
}

// Five real CETPs from the Feb-2026 GPCB monitoring report
// Ten synthesised across major industrial clusters
const CETP_DEFS: CetpDef[] = [
  // ── Real (Feb-2026 PDF) ────────────────────────────────────────────────
  {
    name: 'AHSPA (Ahmedabad Hazardous Solid and Polymer Association)',
    capacityMld: 30,
    district: 'Ahmedabad',
    memberUnitsCount: 50,
    hasOnlineCeqms: true,
    spraydryerUnits: null,
  },
  {
    name: 'Gujarat Vepari Maha Mandal CETP',
    capacityMld: 0.45,
    district: 'Ahmedabad',
    memberUnitsCount: 385,
    hasOnlineCeqms: false,
    spraydryerUnits: null,
  },
  {
    name: 'Naroda Enviro Project Ltd',
    capacityMld: 14,
    district: 'Ahmedabad',
    memberUnitsCount: 180,
    hasOnlineCeqms: true,
    spraydryerUnits: 75,
  },
  {
    name: 'Narol Dyestuff Enviro Society CETP',
    capacityMld: 0.1,
    district: 'Ahmedabad',
    memberUnitsCount: 19,
    hasOnlineCeqms: false,
    spraydryerUnits: null,
  },
  {
    name: 'Odhav Enviro Project Ltd',
    capacityMld: 1.2,
    district: 'Ahmedabad',
    memberUnitsCount: 45,
    hasOnlineCeqms: true,
    spraydryerUnits: 43,
  },
  // ── Synthesised ────────────────────────────────────────────────────────
  {
    name: 'Vatva CETP (Vatva Industries Association)',
    capacityMld: 22,
    district: 'Ahmedabad',
    memberUnitsCount: 220,
    hasOnlineCeqms: true,
    spraydryerUnits: 60,
  },
  {
    name: 'Ankleshwar Industrial Effluent Treatment Ltd',
    capacityMld: 50,
    district: 'Bharuch',
    memberUnitsCount: 310,
    hasOnlineCeqms: true,
    spraydryerUnits: 90,
  },
  {
    name: 'Vapi Waste & Effluent Management Co. Ltd (VWEMCL)',
    capacityMld: 55,
    district: 'Valsad',
    memberUnitsCount: 400,
    hasOnlineCeqms: true,
    spraydryerUnits: 120,
  },
  {
    name: 'Pandesara Effluent Treatment Society',
    capacityMld: 10,
    district: 'Surat',
    memberUnitsCount: 85,
    hasOnlineCeqms: false,
    spraydryerUnits: null,
  },
  {
    name: 'Sachin Enviro Management CETP',
    capacityMld: 15,
    district: 'Surat',
    memberUnitsCount: 130,
    hasOnlineCeqms: true,
    spraydryerUnits: 30,
  },
  {
    name: 'Naroda Industrial Estates Enviro CETP',
    capacityMld: 8,
    district: 'Ahmedabad',
    memberUnitsCount: 110,
    hasOnlineCeqms: false,
    spraydryerUnits: null,
  },
  {
    name: 'Mahi Industrial Effluent Treatment Ltd',
    capacityMld: 5,
    district: 'Anand',
    memberUnitsCount: 60,
    hasOnlineCeqms: false,
    spraydryerUnits: null,
  },
  {
    name: 'Dahej Industrial Effluent CETP',
    capacityMld: 40,
    district: 'Bharuch',
    memberUnitsCount: 95,
    hasOnlineCeqms: true,
    spraydryerUnits: 50,
  },
  {
    name: 'Hazira Industrial Complex Effluent Treatment',
    capacityMld: 20,
    district: 'Surat',
    memberUnitsCount: 70,
    hasOnlineCeqms: true,
    spraydryerUnits: 20,
  },
  {
    name: 'Jhagadia Chemical Industries CETP',
    capacityMld: 12,
    district: 'Bharuch',
    memberUnitsCount: 90,
    hasOnlineCeqms: false,
    spraydryerUnits: null,
  },
]

// ── Report generation helpers ──────────────────────────────────────────────

/**
 * Returns an array of the last 12 month-start Dates ending with the month
 * *before* the current month (so all months are fully closed).
 */
function last12Months(): Date[] {
  // Anchor: use a fixed point (May 2025) so the seed is deterministic
  // regardless of when it is run, matching the "12 months of historical data"
  // described in the spec.
  const anchor = new Date('2026-05-01T00:00:00.000Z')  // run date ≈ June 2026
  const months: Date[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(anchor)
    d.setUTCMonth(anchor.getUTCMonth() - i)
    d.setUTCDate(1)
    months.push(d)
  }
  return months  // [Jun-2025 … May-2026]
}

type ObservedReadings = {
  pH: number
  COD: number
  BOD: number
  SS: number
  'NH3-N': number
  'Phenolic Compounds': number
  [k: string]: number
}

/** Generates realistic observed-inlet values (slightly over norms is common). */
function observedInlet(seed: string): ObservedReadings {
  return {
    pH: jitterNorm(7.2, 0.08, seed, 'inlet-pH'),
    COD: jitterNorm(2200, 0.20, seed, 'inlet-COD'),   // often above 2000
    BOD: jitterNorm(750, 0.20, seed, 'inlet-BOD'),
    SS: jitterNorm(320, 0.20, seed, 'inlet-SS'),
    'NH3-N': jitterNorm(48, 0.25, seed, 'inlet-NH3'),
    'Phenolic Compounds': jitterNorm(0.9, 0.25, seed, 'inlet-phenol'),
  }
}

/**
 * Generates observed-final values. ~15% of reports have COD > 250 to drive
 * enforcement signals. The 15% is selected by a deterministic hash of the seed.
 */
function observedFinal(seed: string): ObservedReadings {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  const overLimit = (h >>> 0) % 100 < 15   // 15 % of reports

  const codFinal = overLimit
    ? jitterNorm(310, 0.15, seed, 'final-COD-over')    // 263–357, above 250
    : jitterNorm(195, 0.15, seed, 'final-COD-ok')      // 166–224, compliant

  return {
    pH: jitterNorm(7.3, 0.05, seed, 'final-pH'),
    COD: Math.round(codFinal * 100) / 100,
    BOD: jitterNorm(22, 0.20, seed, 'final-BOD'),
    SS: jitterNorm(75, 0.20, seed, 'final-SS'),
    'NH3-N': jitterNorm(35, 0.25, seed, 'final-NH3'),
    'Phenolic Compounds': jitterNorm(0.7, 0.25, seed, 'final-phenol'),
  }
}

/** Bypass: mostly 0; occasionally 1–5 MLD (≈10% of months). */
function bypassMld(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  if ((h >>> 0) % 10 === 0) {
    return Math.round(jitterVal(seed, 'bypass', 1, 5) * 100) / 100
  }
  return 0
}

// ── Seed function ──────────────────────────────────────────────────────────

export async function seedCetps(prisma: PrismaClient): Promise<void> {
  const months = last12Months()

  for (const def of CETP_DEFS) {
    // Upsert CETP by name (idempotent)
    const cetp = await prisma.cetp.upsert({
      where:  { name: def.name },
      update: {
        capacityMld:     def.capacityMld,
        district:        def.district,
        memberUnitsCount: def.memberUnitsCount,
        hasOnlineCeqms:  def.hasOnlineCeqms,
        spraydryerUnits: def.spraydryerUnits,
      },
      create: {
        name:            def.name,
        capacityMld:     def.capacityMld,
        district:        def.district,
        memberUnitsCount: def.memberUnitsCount,
        hasOnlineCeqms:  def.hasOnlineCeqms,
        spraydryerUnits: def.spraydryerUnits,
      },
    })

    for (const month of months) {
      // Seed string: deterministic per CETP × month
      const seed = `${def.name}|${month.toISOString()}`

      const storageMt  = Math.round(jitterVal(seed, 'hw-storage', 1000, 5000))
      const disposedMt = Math.round(storageMt * jitterVal(seed, 'hw-disposed', 0.80, 0.90))

      await prisma.cetpMonitoringReport.upsert({
        where: {
          cetpId_monthOf: {
            cetpId:  cetp.id,
            monthOf: month,
          },
        },
        update: {
          inletNorms:               INLET_NORMS,
          finalEffluentStds:        FINAL_STDS,
          observedInlet:            observedInlet(seed + '|inlet'),
          observedFinal:            observedFinal(seed + '|final'),
          bypassMld:                bypassMld(seed + '|bypass'),
          hazardousWasteStorageMt:  storageMt,
          hazardousWasteDisposedMt: disposedMt,
        },
        create: {
          cetpId:                   cetp.id,
          monthOf:                  month,
          inletNorms:               INLET_NORMS,
          finalEffluentStds:        FINAL_STDS,
          observedInlet:            observedInlet(seed + '|inlet'),
          observedFinal:            observedFinal(seed + '|final'),
          bypassMld:                bypassMld(seed + '|bypass'),
          hazardousWasteStorageMt:  storageMt,
          hazardousWasteDisposedMt: disposedMt,
        },
      })
    }
  }
}
