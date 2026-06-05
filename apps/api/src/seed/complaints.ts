import type { PrismaClient } from '@prisma/client'

// ── Deterministic pseudo-random helpers ──────────────────────────────────────

/** Deterministic hash of a string → unsigned 32-bit integer */
function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

/** Pick item from array deterministically */
function pick<T>(arr: readonly T[], seed: string, extra = 0): T {
  const idx = (hash32(seed + String(extra)) % arr.length + arr.length) % arr.length
  return arr[idx] as T
}

/** Random float in [min, max) deterministically */
function randFloat(min: number, max: number, seed: string): number {
  const h = hash32(seed) / 4294967296
  return min + h * (max - min)
}

/** Random integer in [min, max] deterministically */
function randInt(min: number, max: number, seed: string): number {
  return Math.floor(randFloat(min, max + 1, seed))
}

// ── GIDC cluster centres (lat, lng, zone name) ────────────────────────────────

const CLUSTERS = [
  { zone: 'Ankleshwar GIDC',        lat: 21.62, lng: 72.99 },
  { zone: 'Vatva GIDC',             lat: 22.95, lng: 72.62 },
  { zone: 'Naroda GIDC',            lat: 23.07, lng: 72.65 },
  { zone: 'Sachin GIDC',            lat: 21.08, lng: 72.86 },
  { zone: 'Vapi-I GIDC',            lat: 20.37, lng: 72.91 },
  { zone: 'Pandesara GIDC',         lat: 21.12, lng: 72.83 },
  { zone: 'Jhagadia GIDC',          lat: 21.70, lng: 72.97 },
  { zone: 'Dahej SEZ/GIDC',         lat: 21.71, lng: 72.56 },
  { zone: 'Panoli GIDC',            lat: 21.65, lng: 72.97 },
  { zone: 'Hazira Industrial Area', lat: 21.10, lng: 72.62 },
  { zone: 'Morbi Ceramics GIDC',    lat: 22.82, lng: 70.83 },
  { zone: 'Vadodara GIDC',          lat: 22.30, lng: 73.20 },
]

// ── Complaint categories and their distributions ──────────────────────────────

type ComplaintCategory = 'ODOUR' | 'EFFLUENT_DISCHARGE' | 'DUST' | 'NOISE' | 'BURNING' | 'OTHER'
type ComplaintSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL'
type ComplaintChannel  = 'WEB' | 'PHONE' | 'EMAIL' | 'WALK_IN'
type ComplaintState    = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'DUPLICATE'

// Weighted picks — expand arrays to reflect probability
const CHANNELS_WEIGHTED: ComplaintChannel[]  = [
  'WEB','WEB','WEB','WEB','WEB','WEB',           // 60 %
  'PHONE','PHONE','PHONE',                        // 25 % (padded below)
  'EMAIL',                                        // 10 %
  'WALK_IN',                                      //  5 %
] as const satisfies ComplaintChannel[]

// Fine-grained weight via numeric draw
function pickChannel(seed: string): ComplaintChannel {
  const r = randFloat(0, 100, seed)
  if (r < 60) return 'WEB'
  if (r < 85) return 'PHONE'
  if (r < 95) return 'EMAIL'
  return 'WALK_IN'
}

function pickCategory(seed: string): ComplaintCategory {
  const r = randFloat(0, 100, seed)
  if (r < 35) return 'ODOUR'
  if (r < 60) return 'EFFLUENT_DISCHARGE'
  if (r < 75) return 'DUST'
  if (r < 85) return 'NOISE'
  if (r < 93) return 'BURNING'
  return 'OTHER'
}

function pickSeverity(seed: string): ComplaintSeverity {
  const r = randFloat(0, 100, seed)
  if (r < 50) return 'MINOR'
  if (r < 85) return 'MAJOR'
  return 'CRITICAL'
}

function pickState(seed: string): ComplaintState {
  const r = randFloat(0, 100, seed)
  if (r < 25) return 'NEW'
  if (r < 50) return 'ASSIGNED'
  if (r < 70) return 'IN_PROGRESS'
  if (r < 90) return 'RESOLVED'
  if (r < 97) return 'CLOSED'
  return 'DUPLICATE'
}

// ── Realistic descriptions per category + zone ───────────────────────────────

const DESCRIPTIONS: Record<ComplaintCategory, string[]> = {
  ODOUR: [
    'Strong chemical odour from Vatva GIDC since early morning, unbearable inside homes',
    'Pungent sulphur-like smell from Ankleshwar industrial estate spreading to residential colony',
    'Foul chemical fumes detected near Naroda GIDC — residents reporting headaches and nausea',
    'Intense acidic odour originating from dyestuff units in Sachin GIDC since last night',
    'Persistent solvent smell from Panoli GIDC cluster, noticeable up to 3 km radius',
    'Ammonia-like stench from Jhagadia chemical zone affecting Jambuva village',
    'Rotten egg odour (H2S) near Ankleshwar GIDC estate since 11 PM last night',
    'Strong pesticide odour from Vapi GIDC Phase II, worse during wind reversal',
    'Chemical fumes from Dahej SEZ affecting fishermen near Moti Khavdi village',
    'Intermittent plastic-burning smell from Morbi ceramics belt since Tuesday',
    'Acid mist smell from Vatva early morning — children unable to go to school',
    'Chlorine-like smell detected at Naroda Enviro CETP vicinity in Kathwada',
    'Strong solvent vapour from pharmaceutical unit near Ankleshwar MIDC corridor',
    'Nauseous fumes from Hazira industrial area reaching Magdalla fishing harbour',
    'Intense dye odour permeating Odhav residential area from Odhav GIDC complex',
  ],
  EFFLUENT_DISCHARGE: [
    'Effluent visibly discoloured (dark brown) discharge in canal near Naroda GIDC',
    'Black liquid flowing from Vatva chemical units into the storm drain towards Kankaria lake',
    'Blue-coloured effluent observed in nallah adjacent to Sachin textile zone',
    'CETP overflow discharge of untreated effluent observed at Ankleshwar GIDC Phase II',
    'Foam-laden wastewater from Pandesara textile units entering Tapi river tributary',
    'Orange-coloured effluent discharge visible in Purna river near Ankleshwar',
    'Chemical waste illegally dumped near Vapi GIDC fence — seeping into groundwater',
    'Effluent discharge from Jhagadia chemical units visible in roadside drain',
    'Yellow effluent from Naroda dye units overflowing into main canal during heavy rain',
    'White alkaline discharge from Dahej plant visible at low tide on coastal area',
    'CETP pipe overflow discharging into Sabarmati tributary near Narol',
    'Oily sheen observed in water canal parallel to Hazira industrial zone',
    'Dark coloured liquid oozing from stacked drums near Panoli GIDC boundary wall',
    'Green-coloured effluent in stream near Sachin GIDC behind residential colony',
    'Untreated effluent from processing unit overflowing onto main road near Vapi',
  ],
  DUST: [
    'Black smoke and dust from stack at Industry Estate Ankleshwar visible from highway',
    'Cement dust from Morbi ceramics unit covering crops in adjacent agricultural land',
    'Continuous dust emission from clinker yard of Dahej port facility',
    'Suspended particulate matter from Hazira steel plant causing visibility drop',
    'Coal dust from thermal plant at Mundra settling on rooftops of Navinal village',
    'Silica dust from Morbi tile grinding operations — workers and residents exposed',
    'Fly ash from captive power plant at Jhagadia drifting into village since morning',
    'Fugitive dust from raw material handling at Vapi GIDC Phase III',
    'Dust cloud observed from Naroda GIDC after machinery startup this morning',
    'Stone dust from quarrying activity adjacent to Halol GIDC affecting school',
    'Road dust from heavy vehicle movement to Ankleshwar GIDC — visibility reduced',
    'Dry fly ash from Panoli waste storage site spreading to nearby paddy fields',
  ],
  NOISE: [
    'High-pitched machinery noise from Vatva chemical plant running all night — sleep disruption',
    'Continuous boiler noise from Ankleshwar GIDC unit exceeds 75 dB near boundary',
    'Night-time generator noise from Sachin textile mill disturbing Ambani Society residents',
    'Loud hammering from steel fabrication unit in Hazira industrial area since 9 PM',
    'Repeated explosion-like sounds from Dahej LNG terminal during venting operation',
    'Compressor noise from Vapi GIDC unit audible inside homes even with closed windows',
    'Pile-driving noise from construction at Naroda expansion zone — starts at 6 AM daily',
    'Kiln noise from Morbi ceramics cluster running through midnight on weekdays',
    'Furnace blower noise from Jhagadia chemical plant exceeding 80 dB at plant boundary',
  ],
  BURNING: [
    'Black smoke from stack at Industry Estate Ankleshwar — apparent uncontrolled combustion',
    'Open burning of solid waste observed inside Vatva GIDC premises at night',
    'Dense black smoke from boiler at Sachin unit visible from highway NH 48',
    'Chemical fire smoke rising from Vapi GIDC — residents requesting evacuation advisory',
    'Incinerator at Panoli pharma unit emitting visible dark smoke since morning',
    'Burning plastic smell and smoke from Hazira industrial zone near residential sector',
    'Waste oil burning in open pit visible near Jhagadia GIDC boundary wall',
    'Stubble burning mixed with industrial smoke near Ankleshwar GIDC Phase III',
  ],
  OTHER: [
    'Hazardous waste drums abandoned on roadside near Ankleshwar GIDC gate',
    'Untreated sludge spread on open land near Vatva GIDC without authorization',
    'Vehicles carrying uncovered chemical cargo leaking on residential road near Naroda',
    'Night-time illegal discharge of chemical sludge near Sachin GIDC bypass road',
    'Suspicious liquid seeping from boundary wall of Vapi unit after rainfall',
    'Expired chemical drums stacked near school boundary in Ankleshwar residential area',
    'GPCB seal broken on closed Naroda unit — operations resumed illegally',
    'Overloaded effluent tanker spillage on highway NH48 near Bharuch',
    'Unidentified chemical spill in stormwater drain near Morbi GIDC Phase I',
    'Elevated turbidity in bore wells near Panoli GIDC — suspected groundwater contamination',
    'Solid waste including hazardous material found dumped in Sabarmati river bed near Vatva',
    'Construction workers from Dahej plant discharging latrinal waste into canal',
  ],
}

// ── Complainant name pools ────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Ramesh','Suresh','Mahesh','Dinesh','Naresh','Hitesh','Rajesh','Mukesh',
  'Priya','Anita','Sunita','Kavita','Geeta','Rekha','Meena','Lata',
  'Amit','Anil','Ashok','Ajay','Vijay','Sanjay','Nikhil','Vishal',
  'Hetal','Dhwani','Ruchita','Bhavna','Jigna','Nisha','Shruti','Pooja',
  'Hasmukhbhai','Babubhai','Kantibhai','Manibhai','Parsottam','Jayantibhai',
  'Trupti','Jagruti','Dipti','Swati',
]

const LAST_NAMES = [
  'Patel','Shah','Modi','Mehta','Desai','Joshi','Bhatt','Trivedi',
  'Parikh','Dave','Raval','Chaudhary','Panchal','Solanki','Nair',
  'Chauhan','Pandya','Thakkar','Kapadia','Parekh','Vasani','Soni',
]

function complainantName(seed: string): string {
  return `${pick(FIRST_NAMES, seed + 'fn')} ${pick(LAST_NAMES, seed + 'ln')}`
}

function complainantPhone(seed: string): string {
  const digits = String(hash32(seed + 'ph') % 900000000 + 100000000)
  return `9${digits.slice(0, 9)}`
}

function complainantEmail(name: string, seed: string): string {
  const domain = pick(['gmail.com','yahoo.in','outlook.com','hotmail.com'], seed + 'em')
  const local = name.toLowerCase().replace(/\s+/, '.') + String(hash32(seed) % 99 + 1)
  return `${local}@${domain}`
}

// ── Complaint builder ─────────────────────────────────────────────────────────

interface SeedComplaint {
  channel: ComplaintChannel
  receivedAt: Date
  complainant: Record<string, unknown>
  lat: number
  lng: number
  category: ComplaintCategory
  severity: ComplaintSeverity
  description: string
  state: ComplaintState
  // industryId resolved later from DB
  ucNumber?: string
}

// UCNumbers to use as industry links — ~70 spread across all clusters
const INDUSTRY_UC_NUMBERS = [
  'GPCB-UCN-001001','GPCB-UCN-001002','GPCB-UCN-001003','GPCB-UCN-001004','GPCB-UCN-001005',
  'GPCB-UCN-001006','GPCB-UCN-001007','GPCB-UCN-001008','GPCB-UCN-001010','GPCB-UCN-001011',
  'GPCB-UCN-001014','GPCB-UCN-001016','GPCB-UCN-001019',
  'GPCB-UCN-002001','GPCB-UCN-002002','GPCB-UCN-002003','GPCB-UCN-002005','GPCB-UCN-002006',
  'GPCB-UCN-002007','GPCB-UCN-002009','GPCB-UCN-002010','GPCB-UCN-002013','GPCB-UCN-002017',
  'GPCB-UCN-003002','GPCB-UCN-003003','GPCB-UCN-003004','GPCB-UCN-003005','GPCB-UCN-003007',
  'GPCB-UCN-003008','GPCB-UCN-003009',
  'GPCB-UCN-004001','GPCB-UCN-004006','GPCB-UCN-004009','GPCB-UCN-004010','GPCB-UCN-004014',
  'GPCB-UCN-005001','GPCB-UCN-005003','GPCB-UCN-005006','GPCB-UCN-005007','GPCB-UCN-005008',
  'GPCB-UCN-005010','GPCB-UCN-005012',
  'GPCB-UCN-006002','GPCB-UCN-006003','GPCB-UCN-006004',
  'GPCB-UCN-007001','GPCB-UCN-007003','GPCB-UCN-007004','GPCB-UCN-007007','GPCB-UCN-007008',
  'GPCB-UCN-008001','GPCB-UCN-008002','GPCB-UCN-008003','GPCB-UCN-008004','GPCB-UCN-008005',
  'GPCB-UCN-008006','GPCB-UCN-008007',
  'GPCB-UCN-009001','GPCB-UCN-009003','GPCB-UCN-009005','GPCB-UCN-009006',
  'GPCB-UCN-010001','GPCB-UCN-010002','GPCB-UCN-010004','GPCB-UCN-010005',
  'GPCB-UCN-011001','GPCB-UCN-011003','GPCB-UCN-011004','GPCB-UCN-011005',
] // 70 entries

/** Generate a receivedAt date in the last 90 days, weighted towards the last 14 days */
function generateReceivedAt(seed: string, nowMs: number): Date {
  // 60% chance to be in last 14d, 40% chance to be in 14-90d window
  const bias = randFloat(0, 1, seed + 'bias')
  let daysBack: number
  if (bias < 0.60) {
    daysBack = randFloat(0, 14, seed + 'days')
  } else {
    daysBack = randFloat(14, 90, seed + 'days')
  }
  return new Date(nowMs - daysBack * 24 * 60 * 60 * 1000)
}

function buildComplaint(idx: number, nowMs: number): SeedComplaint {
  const seed = `complaint-${idx}`

  // Pick cluster
  const cluster = pick(CLUSTERS, seed + 'cl')

  // Add ±0.05 jitter
  const lat = cluster.lat + randFloat(-0.05, 0.05, seed + 'lat')
  const lng = cluster.lng + randFloat(-0.05, 0.05, seed + 'lng')

  const channel  = pickChannel(seed + 'ch')
  const category = pickCategory(seed + 'cat')
  const severity = pickSeverity(seed + 'sev')
  const state    = pickState(seed + 'st')
  const isAnon   = randFloat(0, 1, seed + 'anon') < 0.20

  const name  = complainantName(seed)
  const phone = complainantPhone(seed)
  const email = complainantEmail(name, seed)

  const complainant: Record<string, unknown> = isAnon
    ? { anonymous: true }
    : { name, phone, email, anonymous: false }

  const descriptions = DESCRIPTIONS[category]
  const description  = pick(descriptions, seed + 'desc')

  const receivedAt = generateReceivedAt(seed, nowMs)

  // ~70 of 180 get an industry link (probability ~39%)
  const linkIndustry = randFloat(0, 1, seed + 'link') < (70 / 180)
  const ucNumber     = linkIndustry
    ? pick(INDUSTRY_UC_NUMBERS, seed + 'uc')
    : undefined

  return { channel, receivedAt, complainant, lat, lng, category, severity, description, state, ucNumber }
}

// ── Response templates ────────────────────────────────────────────────────────

const RESPONSE_MESSAGES: Record<ComplaintCategory, string[]> = {
  ODOUR: [
    'Field inspection conducted at reported location. Stack emission test underway. Industry directed to maintain emission control equipment in operational state.',
    'Site visit completed. ETP odour control scrubbers found offline at the unit. Show-cause notice issued. Industry given 7-day rectification deadline.',
    'Ambient air monitoring deployed at complaint point. Preliminary readings elevated for H2S. Lab samples sent for analysis. Complainant will be updated.',
    'Industry representative called. They acknowledged maintenance work on odour control unit. Work to be completed within 48 hours. Follow-up inspection scheduled.',
    'Inspection team found ETP bypass valve partially open at boundary. Sealed. Notice issued for ETP protocol violation.',
  ],
  EFFLUENT_DISCHARGE: [
    'Emergency inspection team dispatched. Effluent samples collected from discharge point. Industry directed to stop discharge until COD levels within norms.',
    'Grab samples taken from canal. COD 485 mg/L against norm of 250 mg/L. Industry show-cause notice issued. 15-day remediation deadline.',
    'On-site CETP outlet inspection done. CETP outlet values within norm. Likely source is an unauthorised bypass. Investigation ongoing.',
    'Industry directed to ensure zero discharge during rainfall events. CETP capacity audit scheduled. Samples sent to regional lab.',
    'Visual inspection confirmed discharge. Online COD meter at CETP found tampered. FIR lodged. Matter escalated to Senior Reviewer for closure action.',
  ],
  DUST: [
    'Stack emission test conducted. PM values found at 148 mg/Nm3 against norm of 100 mg/Nm3. Industry asked to improve bag filters within 10 days.',
    'Ambient monitoring at boundary showed PM10 at 230 µg/m3. Industry issued directive to install windbreak nets for raw material storage areas.',
    'Site visit done. Water sprinkling at coal yard inadequate. Industry directed to increase sprinkling frequency to 4 times per day.',
    'Dust suppression measures inspected. Inadequate enclosure on material handling conveyor identified. Rectification notice issued.',
  ],
  NOISE: [
    'Noise meter readings at industry boundary at 11 PM: 72 dB(A) against night norm of 45 dB(A). Industry directed to install acoustic enclosure around compressor.',
    'Ambient noise monitoring conducted. Readings within permissible limits at nearest habitation. Complaint closed.',
    'Industry found running auxiliary boiler vent without silencer after midnight. Notice issued. Silencer to be installed within 5 days.',
    'Vibration monitoring deployed. Unit instructed to perform equipment balancing on identified machinery. Follow-up due in 2 weeks.',
  ],
  BURNING: [
    'Inspection found common area fire for solid waste burning. ETP sludge management SOP violated. Notice issued. Burning activity immediately stopped.',
    'Incinerator temperature log found below required 850°C threshold. Industry directed to fix burner and restart with proper temperature control.',
    'No evidence of burning found during inspection. May have been a one-time incident. Complainant informed. Case monitored for 30 days.',
    'Dense smoke source identified as boiler startup without adequate air supply. Industry instructed on proper cold-start procedure.',
  ],
  OTHER: [
    'Hazardous waste manifest check conducted. Discrepancy in quantities found. Industry issued stop-work notice pending HW audit.',
    'Inspection of boundary area — no visible illegal dump. Monitoring camera to be installed at access gate. Complaint noted for follow-up.',
    'Complaint verified. Vehicle transporting hazardous goods without proper labelling and manifest. District transport authority notified.',
    'Groundwater sample collected from bore well near complaint site. Analysis pending. Complainant advised not to use water until results received.',
    'Complaint referred to Municipal Corporation for stormwater drain maintenance. GPCB follow-up on industry side scheduled.',
  ],
}

const ACTIONS = [
  'show_cause_notice_issued',
  'inspection_scheduled',
  'lab_samples_collected',
  'closure_direction_issued',
  'monitoring_deployed',
  'rectification_directed',
  'complaint_closed_no_violation',
  'matter_escalated',
  'industry_called_for_hearing',
  'field_visit_completed',
]

// ── Main seed function ────────────────────────────────────────────────────────

export async function seedComplaints(prisma: PrismaClient): Promise<{ complaints: number; responses: number }> {
  const now = new Date('2026-06-05T00:00:00Z').getTime()
  const TOTAL = 180

  // Fetch the complaints officer (assignedToId for ASSIGNED/IN_PROGRESS)
  const complaintsOfficer = await prisma.user.findFirst({
    where: { role: 'COMPLAINTS_OFFICER' },
  })

  // Build industryId lookup map
  const industries = await prisma.industry.findMany({ select: { id: true, ucNumber: true } })
  const industryByUC = new Map(industries.map(i => [i.ucNumber, i.id]))

  // Build complaint definitions
  const complaintDefs = Array.from({ length: TOTAL }, (_, i) => buildComplaint(i, now))

  let complaintsCreated = 0
  let responsesCreated  = 0

  // Use a stable complaint-level key to allow idempotent re-runs: store a lookup of
  // (description + truncatedReceivedAt) to avoid duplicates.
  const existingDescriptions = new Set(
    (await prisma.complaint.findMany({ select: { description: true } }))
      .map(c => c.description)
  )

  const createdIds: Array<{ id: string; state: string; category: string }> = []

  for (let i = 0; i < complaintDefs.length; i++) {
    const def = complaintDefs[i]!

    // Skip if a complaint with same description already exists (idempotency)
    if (existingDescriptions.has(def.description)) {
      // Still track it for response creation
      const existing = await prisma.complaint.findFirst({
        where: { description: def.description },
        select: { id: true, state: true, category: true },
      })
      if (existing) {
        createdIds.push({ id: existing.id, state: existing.state, category: existing.category ?? 'OTHER' })
      }
      continue
    }

    const industryId = def.ucNumber ? industryByUC.get(def.ucNumber) : undefined

    // Assign to complaints officer for ASSIGNED/IN_PROGRESS states
    const assignedToId =
      (def.state === 'ASSIGNED' || def.state === 'IN_PROGRESS') && complaintsOfficer
        ? complaintsOfficer.id
        : undefined

    const complaint = await prisma.complaint.create({
      data: {
        channel:     def.channel,
        receivedAt:  def.receivedAt,
        complainant: def.complainant as never,
        lat:         def.lat,
        lng:         def.lng,
        category:    def.category,
        severity:    def.severity,
        description: def.description,
        state:       def.state,
        industryId:  industryId ?? null,
        assignedToId: assignedToId ?? null,
      },
    })

    existingDescriptions.add(def.description)
    createdIds.push({ id: complaint.id, state: def.state, category: def.category })
    complaintsCreated++
  }

  // ── Create ~80 ComplaintResponses for IN_PROGRESS / RESOLVED complaints ────
  // Respondent is the complaints officer
  if (!complaintsOfficer) {
    return { complaints: complaintsCreated, responses: 0 }
  }

  const respondableStates = new Set(['IN_PROGRESS', 'RESOLVED'])
  const respondableComplaints = createdIds.filter(c => respondableStates.has(c.state))

  // Aim for ~80 total responses across IN_PROGRESS + RESOLVED, 1-3 per complaint
  // We'll add responses until we hit ~80 or run out of respondable complaints
  let responseIdx = 0
  for (const c of respondableComplaints) {
    if (responsesCreated >= 80) break

    const responseCount = randInt(1, 3, `resp-count-${c.id}`)
    const messages      = RESPONSE_MESSAGES[c.category as ComplaintCategory] ??
                          RESPONSE_MESSAGES['OTHER']

    // Base time: a few days after the complaint was received (approximate)
    const complaintObj = await prisma.complaint.findUnique({ where: { id: c.id }, select: { receivedAt: true } })
    const receivedMs   = complaintObj?.receivedAt.getTime() ?? now

    for (let r = 0; r < responseCount && responsesCreated < 80; r++) {
      // Check if response already exists (idempotency)
      const alreadyExists = await prisma.complaintResponse.findFirst({
        where: { complaintId: c.id, respondedById: complaintsOfficer.id },
        select: { id: true },
      })
      if (alreadyExists && r === 0) {
        // All responses for this complaint were already seeded; move on
        responsesCreated += responseCount // count them to not overshoot target
        break
      }

      const respondedAt = new Date(
        receivedMs + randFloat(1, 5 + r * 2, `resp-time-${c.id}-${r}`) * 24 * 60 * 60 * 1000
      )

      const message = pick(messages, `resp-msg-${c.id}-${r}`)
      const action  = pick(ACTIONS, `resp-action-${c.id}-${r}`)

      await prisma.complaintResponse.create({
        data: {
          complaintId:   c.id,
          respondedById: complaintsOfficer.id,
          respondedAt,
          message,
          action,
        },
      })

      responsesCreated++
      responseIdx++
    }
  }

  return { complaints: complaintsCreated, responses: responsesCreated }
}
