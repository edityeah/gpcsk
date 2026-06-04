import type { PrismaClient } from '@prisma/client'

// ── Sectors ──────────────────────────────────────────────────────────────

const SECTORS = [
  { code: 'DYESTUFF',          name: 'Dyestuff & Dye Intermediates' },
  { code: 'PHARMA',             name: 'Pharmaceuticals & Bulk Drugs' },
  { code: 'CHEMICAL_BULK',      name: 'Bulk Chemicals' },
  { code: 'CHEMICAL_SPECIALTY', name: 'Specialty Chemicals' },
  { code: 'TEXTILE',            name: 'Textiles & Garments' },
  { code: 'CEMENT',             name: 'Cement & Building Materials' },
  { code: 'STEEL',              name: 'Steel & Ferro Alloys' },
  { code: 'POWER',              name: 'Power Generation' },
  { code: 'REFINERY',           name: 'Petroleum Refining & Petrochemicals' },
  { code: 'PAPER',              name: 'Paper & Pulp' },
  { code: 'FOOD',               name: 'Food Processing' },
  { code: 'AUTO_ENGINEERING',   name: 'Auto Components & Engineering' },
] as const

// ── Districts (all 33 Gujarat districts) ─────────────────────────────────

const DISTRICTS = [
  { code: 'GJ-AHM', name: 'Ahmedabad' },
  { code: 'GJ-SRT', name: 'Surat' },
  { code: 'GJ-VAD', name: 'Vadodara' },
  { code: 'GJ-RJK', name: 'Rajkot' },
  { code: 'GJ-BRH', name: 'Bharuch' },
  { code: 'GJ-BHV', name: 'Bhavnagar' },
  { code: 'GJ-AND', name: 'Anand' },
  { code: 'GJ-KHD', name: 'Kheda' },
  { code: 'GJ-MHS', name: 'Mahisagar' },
  { code: 'GJ-PMH', name: 'Panchmahal' },
  { code: 'GJ-DHD', name: 'Dahod' },
  { code: 'GJ-MSN', name: 'Mehsana' },
  { code: 'GJ-PTN', name: 'Patan' },
  { code: 'GJ-BNK', name: 'Banaskantha' },
  { code: 'GJ-SBK', name: 'Sabarkantha' },
  { code: 'GJ-ARV', name: 'Aravalli' },
  { code: 'GJ-GND', name: 'Gandhinagar' },
  { code: 'GJ-KCH', name: 'Kutch' },
  { code: 'GJ-MRB', name: 'Morbi' },
  { code: 'GJ-SND', name: 'Surendranagar' },
  { code: 'GJ-JMN', name: 'Jamnagar' },
  { code: 'GJ-DDW', name: 'Devbhumi Dwarka' },
  { code: 'GJ-PBD', name: 'Porbandar' },
  { code: 'GJ-JNG', name: 'Junagadh' },
  { code: 'GJ-GSM', name: 'Gir Somnath' },
  { code: 'GJ-AMR', name: 'Amreli' },
  { code: 'GJ-BTD', name: 'Botad' },
  { code: 'GJ-TPI', name: 'Tapi' },
  { code: 'GJ-NRM', name: 'Narmada' },
  { code: 'GJ-NSR', name: 'Navsari' },
  { code: 'GJ-VLS', name: 'Valsad' },
  { code: 'GJ-DNG', name: 'Dang' },
  { code: 'GJ-CUD', name: 'Chhota Udaipur' },
] as const

// ── Talukas (~80 across industrial districts) ─────────────────────────────

// [districtCode, talukaName]
const TALUKAS: Array<[string, string]> = [
  // Ahmedabad
  ['GJ-AHM', 'Sanand'],
  ['GJ-AHM', 'Bavla'],
  ['GJ-AHM', 'Dholka'],
  ['GJ-AHM', 'Vatva'],
  ['GJ-AHM', 'Naroda'],
  ['GJ-AHM', 'City (Ahmedabad)'],
  ['GJ-AHM', 'Daskroi'],
  ['GJ-AHM', 'Detroj-Rampura'],
  // Surat
  ['GJ-SRT', 'Sachin'],
  ['GJ-SRT', 'Pandesara'],
  ['GJ-SRT', 'Olpad'],
  ['GJ-SRT', 'Bardoli'],
  ['GJ-SRT', 'Kamrej'],
  ['GJ-SRT', 'Palsana'],
  // Bharuch
  ['GJ-BRH', 'Ankleshwar'],
  ['GJ-BRH', 'Jhagadia'],
  ['GJ-BRH', 'Panoli'],
  ['GJ-BRH', 'Dahej'],
  ['GJ-BRH', 'Hazira'],
  ['GJ-BRH', 'Bharuch City'],
  ['GJ-BRH', 'Amod'],
  // Vadodara
  ['GJ-VAD', 'Padra'],
  ['GJ-VAD', 'Halol'],
  ['GJ-VAD', 'Karjan'],
  ['GJ-VAD', 'Waghodia'],
  ['GJ-VAD', 'Savli'],
  ['GJ-VAD', 'Vadodara City'],
  // Rajkot
  ['GJ-RJK', 'Lodhika'],
  ['GJ-RJK', 'Shapar-Veraval'],
  ['GJ-RJK', 'Rajkot City'],
  ['GJ-RJK', 'Gondal'],
  ['GJ-RJK', 'Jetpur'],
  // Morbi
  ['GJ-MRB', 'Morbi City'],
  ['GJ-MRB', 'Wankaner'],
  ['GJ-MRB', 'Halvad'],
  ['GJ-MRB', 'Maliya Miyana'],
  // Kutch
  ['GJ-KCH', 'Bhachau'],
  ['GJ-KCH', 'Anjar'],
  ['GJ-KCH', 'Gandhidham'],
  ['GJ-KCH', 'Mundra'],
  ['GJ-KCH', 'Bhuj'],
  ['GJ-KCH', 'Nakhatrana'],
  ['GJ-KCH', 'Lakhpat'],
  // Valsad (Vapi area)
  ['GJ-VLS', 'Vapi'],
  ['GJ-VLS', 'Pardi'],
  ['GJ-VLS', 'Umbergaon'],
  ['GJ-VLS', 'Valsad City'],
  // Jamnagar
  ['GJ-JMN', 'Jamnagar City'],
  ['GJ-JMN', 'Kalavad'],
  ['GJ-JMN', 'Lalpur'],
  // Anand
  ['GJ-AND', 'Anand City'],
  ['GJ-AND', 'Anklav'],
  ['GJ-AND', 'Petlad'],
  // Gandhinagar
  ['GJ-GND', 'Gandhinagar City'],
  ['GJ-GND', 'Kalol'],
  ['GJ-GND', 'Mansa'],
  // Mehsana
  ['GJ-MSN', 'Mehsana City'],
  ['GJ-MSN', 'Unjha'],
  ['GJ-MSN', 'Visnagar'],
  // Navsari
  ['GJ-NSR', 'Navsari City'],
  ['GJ-NSR', 'Jalalpore'],
  ['GJ-NSR', 'Bilimora'],
  // Bhavnagar
  ['GJ-BHV', 'Bhavnagar City'],
  ['GJ-BHV', 'Sihor'],
  ['GJ-BHV', 'Talaja'],
  // Surendranagar
  ['GJ-SND', 'Wadhwan'],
  ['GJ-SND', 'Chotila'],
  ['GJ-SND', 'Patdi'],
  // Panchmahal
  ['GJ-PMH', 'Godhra'],
  ['GJ-PMH', 'Kalol (Panchmahals)'],
  // Kheda
  ['GJ-KHD', 'Nadiad'],
  ['GJ-KHD', 'Matar'],
  // Narmada
  ['GJ-NRM', 'Rajpipla'],
  ['GJ-NRM', 'Sagbara'],
  // Tapi
  ['GJ-TPI', 'Vyara'],
  ['GJ-TPI', 'Songadh'],
  // Banaskantha
  ['GJ-BNK', 'Deesa'],
  ['GJ-BNK', 'Disa'],
]

// ── GIDC Zones (~25 real industrial estates) ──────────────────────────────

// [name, districtCode]
const GIDC_ZONES: Array<[string, string]> = [
  ['Ankleshwar GIDC',       'GJ-BRH'],
  ['Vatva GIDC',            'GJ-AHM'],
  ['Naroda GIDC',           'GJ-AHM'],
  ['Sachin GIDC',           'GJ-SRT'],
  ['Vapi-I GIDC',           'GJ-VLS'],
  ['Vapi-II GIDC',          'GJ-VLS'],
  ['Vapi-III GIDC',         'GJ-VLS'],
  ['Pandesara GIDC',        'GJ-SRT'],
  ['Jhagadia GIDC',         'GJ-BRH'],
  ['Dahej SEZ/GIDC',        'GJ-BRH'],
  ['Panoli GIDC',           'GJ-BRH'],
  ['Hazira Industrial Area','GJ-SRT'],
  ['Morbi Ceramics GIDC',   'GJ-MRB'],
  ['Vadodara GIDC',         'GJ-VAD'],
  ['Halol GIDC',            'GJ-VAD'],
  ['Lodhika GIDC',          'GJ-RJK'],
  ['Kandla SEZ/GIDC',       'GJ-KCH'],
  ['Mundra Port & SEZ',     'GJ-KCH'],
  ['Surendranagar GIDC',    'GJ-SND'],
  ['Kalol GIDC',            'GJ-GND'],
  ['Sanand-I GIDC',         'GJ-AHM'],
  ['Sanand-II GIDC',        'GJ-AHM'],
  ['Bavla GIDC',            'GJ-AHM'],
  ['Bhachau-Gandhidham GIDC','GJ-KCH'],
  ['Bhuj GIDC',             'GJ-KCH'],
  ['Patdi GIDC',            'GJ-SND'],
  ['Dholka GIDC',           'GJ-AHM'],
]

// ── Norms (~40 CPCB key parameter limits) ─────────────────────────────────

type NormInput = {
  parameter: string
  stream: 'AIR' | 'WATER' | 'HAZARDOUS_WASTE' | 'NOISE_MSW'
  category?: string
  value: number
  unit: string
  regulator: string
  source: string
}

const NORMS: NormInput[] = [
  // ── Air Ambient (CPCB 2009 National Ambient Air Quality Standards) ──────
  // Industrial / Residential / Rural / Other areas — 24-hourly
  { parameter: 'PM10',             stream: 'AIR', category: 'Industrial-24h',  value: 100,    unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'PM10',             stream: 'AIR', category: 'Sensitive-24h',   value: 60,     unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'PM2.5',            stream: 'AIR', category: 'Industrial-24h',  value: 60,     unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'PM2.5',            stream: 'AIR', category: 'Sensitive-24h',   value: 40,     unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'SO2',              stream: 'AIR', category: 'Industrial-24h',  value: 80,     unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'SO2',              stream: 'AIR', category: 'Sensitive-24h',   value: 80,     unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'NOx',              stream: 'AIR', category: 'Industrial-24h',  value: 80,     unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'NOx',              stream: 'AIR', category: 'Sensitive-24h',   value: 80,     unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'NH3',              stream: 'AIR', category: 'Industrial-24h',  value: 400,    unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'O3',               stream: 'AIR', category: 'Industrial-8h',   value: 100,    unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'CO',               stream: 'AIR', category: 'Industrial-8h',   value: 2000,   unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'Lead (Pb)',        stream: 'AIR', category: 'Industrial-24h',  value: 1.0,    unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'Benzene',          stream: 'AIR', category: 'Industrial-Annual',value: 5,     unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  { parameter: 'Benzo(a)Pyrene',   stream: 'AIR', category: 'Industrial-Annual',value: 0.001, unit: 'µg/m³', regulator: 'CPCB', source: 'CPCB NAAQS 2009' },
  // ── Water Effluent (CPCB General Standards — Schedule VI EPA) ────────────
  { parameter: 'pH',               stream: 'WATER', category: 'Effluent-General-Min', value: 5.5,  unit: 'pH units', regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'pH',               stream: 'WATER', category: 'Effluent-General-Max', value: 9.0,  unit: 'pH units', regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'BOD',              stream: 'WATER', category: 'Effluent-General',     value: 30,   unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'COD',              stream: 'WATER', category: 'Effluent-General',     value: 250,  unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'Suspended Solids', stream: 'WATER', category: 'Effluent-General',     value: 100,  unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'NH3-N',            stream: 'WATER', category: 'Effluent-General',     value: 50,   unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'Phenolics',        stream: 'WATER', category: 'Effluent-General',     value: 1.0,  unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'Oil & Grease',     stream: 'WATER', category: 'Effluent-General',     value: 10,   unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'TDS',              stream: 'WATER', category: 'Effluent-Inland',      value: 2100, unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'Temperature',      stream: 'WATER', category: 'Effluent-General',     value: 45,   unit: '°C',       regulator: 'CPCB', source: 'EPA Schedule VI' },
  // Heavy metals in effluent
  { parameter: 'Chromium (Hex)',   stream: 'WATER', category: 'Effluent-HeavyMetal',  value: 0.1,  unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'Chromium (Total)', stream: 'WATER', category: 'Effluent-HeavyMetal',  value: 2.0,  unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'Lead (Pb)',        stream: 'WATER', category: 'Effluent-HeavyMetal',  value: 0.1,  unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'Mercury (Hg)',     stream: 'WATER', category: 'Effluent-HeavyMetal',  value: 0.01, unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'Cadmium (Cd)',     stream: 'WATER', category: 'Effluent-HeavyMetal',  value: 2.0,  unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'Arsenic (As)',     stream: 'WATER', category: 'Effluent-HeavyMetal',  value: 0.2,  unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  { parameter: 'Cyanide',         stream: 'WATER', category: 'Effluent-General',      value: 0.2,  unit: 'mg/L',     regulator: 'CPCB', source: 'EPA Schedule VI' },
  // ── CETP Standards ────────────────────────────────────────────────────────
  { parameter: 'pH',              stream: 'WATER', category: 'CETP-Min',              value: 6.0,  unit: 'pH units', regulator: 'CPCB', source: 'CPCB CETP Guidelines' },
  { parameter: 'pH',              stream: 'WATER', category: 'CETP-Max',              value: 9.0,  unit: 'pH units', regulator: 'CPCB', source: 'CPCB CETP Guidelines' },
  { parameter: 'BOD',             stream: 'WATER', category: 'CETP-Final',            value: 30,   unit: 'mg/L',     regulator: 'CPCB', source: 'CPCB CETP Guidelines' },
  { parameter: 'COD',             stream: 'WATER', category: 'CETP-Final',            value: 250,  unit: 'mg/L',     regulator: 'CPCB', source: 'CPCB CETP Guidelines' },
  // ── Noise Standards ───────────────────────────────────────────────────────
  { parameter: 'Noise-Day',       stream: 'NOISE_MSW', category: 'Industrial',        value: 75,   unit: 'dB(A)',    regulator: 'CPCB', source: 'Noise Pollution Rules 2000' },
  { parameter: 'Noise-Night',     stream: 'NOISE_MSW', category: 'Industrial',        value: 70,   unit: 'dB(A)',    regulator: 'CPCB', source: 'Noise Pollution Rules 2000' },
  { parameter: 'Noise-Day',       stream: 'NOISE_MSW', category: 'Residential',       value: 55,   unit: 'dB(A)',    regulator: 'CPCB', source: 'Noise Pollution Rules 2000' },
  { parameter: 'Noise-Night',     stream: 'NOISE_MSW', category: 'Residential',       value: 45,   unit: 'dB(A)',    regulator: 'CPCB', source: 'Noise Pollution Rules 2000' },
  { parameter: 'Noise-Day',       stream: 'NOISE_MSW', category: 'Silence Zone',      value: 50,   unit: 'dB(A)',    regulator: 'CPCB', source: 'Noise Pollution Rules 2000' },
  { parameter: 'Noise-Night',     stream: 'NOISE_MSW', category: 'Silence Zone',      value: 40,   unit: 'dB(A)',    regulator: 'CPCB', source: 'Noise Pollution Rules 2000' },
]

// ── Seed function ─────────────────────────────────────────────────────────

export async function seedReference(prisma: PrismaClient): Promise<void> {
  // Sectors
  for (const s of SECTORS) {
    await prisma.sector.upsert({
      where:  { code: s.code },
      update: { name: s.name },
      create: { code: s.code, name: s.name },
    })
  }

  // Districts
  for (const d of DISTRICTS) {
    await prisma.district.upsert({
      where:  { code: d.code },
      update: { name: d.name },
      create: { code: d.code, name: d.name },
    })
  }

  // Talukas — keyed by (districtId, name); upsert via findFirst + create
  for (const [districtCode, talukaName] of TALUKAS) {
    const district = await prisma.district.findUniqueOrThrow({ where: { code: districtCode } })
    const existing = await prisma.taluka.findFirst({
      where: { districtId: district.id, name: talukaName },
    })
    if (!existing) {
      await prisma.taluka.create({ data: { name: talukaName, districtId: district.id } })
    }
  }

  // GidcZones — keyed by name; upsert via findFirst + create/update
  for (const [zoneName, districtCode] of GIDC_ZONES) {
    const district = await prisma.district.findUniqueOrThrow({ where: { code: districtCode } })
    const existing = await prisma.gidcZone.findFirst({ where: { name: zoneName } })
    if (!existing) {
      await prisma.gidcZone.create({ data: { name: zoneName, districtId: district.id } })
    } else if (existing.districtId !== district.id) {
      await prisma.gidcZone.update({
        where: { id: existing.id },
        data:  { districtId: district.id },
      })
    }
  }

  // Norms — unique on (parameter, stream, category, regulator).
  // All entries in NORMS carry a category; fall back to '' for the index key
  // if somehow undefined (Prisma's compound unique treats NULL as a separate row).
  for (const n of NORMS) {
    await prisma.norm.upsert({
      where: {
        parameter_stream_category_regulator: {
          parameter: n.parameter,
          stream:    n.stream,
          category:  n.category ?? '',
          regulator: n.regulator,
        },
      },
      update: { value: n.value, unit: n.unit, source: n.source },
      create: {
        parameter: n.parameter,
        stream:    n.stream,
        category:  n.category,
        value:     n.value,
        unit:      n.unit,
        regulator: n.regulator,
        source:    n.source,
      },
    })
  }
}
