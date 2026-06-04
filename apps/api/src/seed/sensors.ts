/**
 * Monitoring stations seed: OCEMS + AAQM (NAMP + SAMP) + VOC + MINARS/GEMS
 * Readings: OCEMS 4-hourly / AAQM monthly / VOC monthly / MINARS quarterly
 * Exceedances: auto-derived where value > norm * 1.05, capped ~5000
 */

import type { PrismaClient } from '@prisma/client'
import { VOC_PARAMETERS } from '@gpcsk/shared'

// ── PRNG (deterministic seeding, no randomness at runtime boundary) ─────────

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff
  }
}

function strHash(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) | 0
  }
  return h >>> 0
}

// ── Norm values (per CPCB / GPCB standards) ──────────────────────────────────

/** Central norms used for exceedance calculations during reading generation */
const NORM: Record<string, number> = {
  PM10:              100,
  PM2_5:              60,
  SO2:                80,
  NOx:                80,
  pH_WATER:            7,  // midpoint; flagged when <6 or >8.5 → use asymmetric check
  DO:                  5,  // mg/L minimum (lower is worse)
  BOD:                30,
  COD:               250,
  SS:                100,
  NH3_N:              50,
  PHENOLIC_COMPOUNDS:  1,
  // VOC individual norms not in Norm table; exceedances not generated for VOC monthly avg
}

// Numeric norm for MINARS water (DO is inverted — exceedance when BELOW 5)
const MINARS_NORMS: Record<string, { value: number; direction: 'above' | 'below' }> = {
  pH:  { value: 7.5, direction: 'above' }, // exceedance when pH > 8.5 or < 6; simplified: > 8.5
  DO:  { value: 5,   direction: 'below' }, // exceedance when DO < 5
  BOD: { value: 30,  direction: 'above' },
  COD: { value: 250, direction: 'above' },
}

// ── Station definitions ───────────────────────────────────────────────────────

interface StationDef {
  name: string
  type: 'OCEMS' | 'AAQM' | 'VOC' | 'MINARS' | 'GEMS'
  lat: number
  lng: number
  parameters: string[]
  industryUcNumber?: string  // only for OCEMS
  status?: string
}

// ── OCEMS: 80 stations at industries from the seed list ───────────────────────

const OCEMS_INDUSTRY_UC_NUMBERS: string[] = [
  // Ankleshwar (RED / heavy polluters first)
  'GPCB-UCN-001001', 'GPCB-UCN-001002', 'GPCB-UCN-001003', 'GPCB-UCN-001004',
  'GPCB-UCN-001005', 'GPCB-UCN-001006', 'GPCB-UCN-001007', 'GPCB-UCN-001008',
  'GPCB-UCN-001010', 'GPCB-UCN-001011', 'GPCB-UCN-001012', 'GPCB-UCN-001014',
  'GPCB-UCN-001015', 'GPCB-UCN-001016', 'GPCB-UCN-001018', 'GPCB-UCN-001019',
  // Vatva
  'GPCB-UCN-002001', 'GPCB-UCN-002002', 'GPCB-UCN-002003', 'GPCB-UCN-002005',
  'GPCB-UCN-002006', 'GPCB-UCN-002007', 'GPCB-UCN-002008', 'GPCB-UCN-002009',
  'GPCB-UCN-002010', 'GPCB-UCN-002012', 'GPCB-UCN-002013', 'GPCB-UCN-002015',
  // Naroda
  'GPCB-UCN-003002', 'GPCB-UCN-003003', 'GPCB-UCN-003004', 'GPCB-UCN-003005',
  'GPCB-UCN-003007', 'GPCB-UCN-003008', 'GPCB-UCN-003009',
  // Sachin (Surat)
  'GPCB-UCN-004001', 'GPCB-UCN-004002', 'GPCB-UCN-004006', 'GPCB-UCN-004009',
  'GPCB-UCN-004010', 'GPCB-UCN-004014',
  // Vapi
  'GPCB-UCN-005001', 'GPCB-UCN-005002', 'GPCB-UCN-005003', 'GPCB-UCN-005006',
  'GPCB-UCN-005007', 'GPCB-UCN-005008', 'GPCB-UCN-005010', 'GPCB-UCN-005011',
  'GPCB-UCN-005012',
  // Pandesara
  'GPCB-UCN-006001', 'GPCB-UCN-006002', 'GPCB-UCN-006003',
  // Jhagadia
  'GPCB-UCN-007001', 'GPCB-UCN-007003', 'GPCB-UCN-007004', 'GPCB-UCN-007007',
  'GPCB-UCN-007008',
  // Dahej
  'GPCB-UCN-008001', 'GPCB-UCN-008003', 'GPCB-UCN-008004', 'GPCB-UCN-008006',
  'GPCB-UCN-008007', 'GPCB-UCN-008008',
  // Panoli
  'GPCB-UCN-009001', 'GPCB-UCN-009003', 'GPCB-UCN-009004',
  // Hazira
  'GPCB-UCN-010001', 'GPCB-UCN-010002', 'GPCB-UCN-010004', 'GPCB-UCN-010005',
  // Morbi
  'GPCB-UCN-011003', 'GPCB-UCN-011005', 'GPCB-UCN-011008', 'GPCB-UCN-011009',
  // Distributed / rest
  'GPCB-UCN-013001', 'GPCB-UCN-013002', 'GPCB-UCN-013003',
]
// Trim / pad to exactly 80
const OCEMS_UC = OCEMS_INDUSTRY_UC_NUMBERS.slice(0, 80)

const OCEMS_PARAMS = ['pH', 'COD', 'BOD', 'SS', 'NH3_N', 'PHENOLIC_COMPOUNDS']

// ── AAQM NAMP: 38 real GPCB AR locations ──────────────────────────────────────

const NAMP_STATIONS: StationDef[] = [
  { name: 'Cadila Narol',                 type: 'AAQM', lat: 22.9749, lng: 72.6175, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'LD College Ahmedabad',         type: 'AAQM', lat: 23.0225, lng: 72.5714, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Shardaben Hospital',           type: 'AAQM', lat: 23.0104, lng: 72.5946, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'RC Technical Ahmedabad',       type: 'AAQM', lat: 23.0200, lng: 72.5800, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Behrampura Ahmedabad',         type: 'AAQM', lat: 22.9950, lng: 72.5988, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Sukhramnagar Ahmedabad',       type: 'AAQM', lat: 23.0300, lng: 72.5650, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Dyno Wash Narol',              type: 'AAQM', lat: 22.9688, lng: 72.6211, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Sola Ahmedabad',               type: 'AAQM', lat: 23.0701, lng: 72.5200, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Dahej SEZ',                    type: 'AAQM', lat: 21.7120, lng: 72.5556, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Sarasvati Township Ahmedabad', type: 'AAQM', lat: 23.0450, lng: 72.5750, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Naroda Police Chowki Vatva',   type: 'AAQM', lat: 23.0650, lng: 72.6400, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'GEB GIDC Vapi',               type: 'AAQM', lat: 20.3720, lng: 72.9078, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Nagar Palika Vapi',            type: 'AAQM', lat: 20.3724, lng: 72.9120, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Yasho Industries Vapi',        type: 'AAQM', lat: 20.3660, lng: 72.9005, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'SVR College Surat',            type: 'AAQM', lat: 21.1702, lng: 72.8311, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'BRC Udhana Surat',             type: 'AAQM', lat: 21.1560, lng: 72.8550, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Air India Building Surat',     type: 'AAQM', lat: 21.1970, lng: 72.8310, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Plot 413 Pandesara Surat',     type: 'AAQM', lat: 21.1205, lng: 72.8260, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Plot 221 Pandesara Surat',     type: 'AAQM', lat: 21.1185, lng: 72.8225, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Chaltan Sugar Surat',          type: 'AAQM', lat: 21.2455, lng: 72.8700, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'CETP Palsana Surat',           type: 'AAQM', lat: 21.0950, lng: 72.9250, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Rallis India Ankleshwar',      type: 'AAQM', lat: 21.6315, lng: 72.9815, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Durga Traders Ankleshwar',     type: 'AAQM', lat: 21.6250, lng: 72.9760, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Panoli Industrial Estate',     type: 'AAQM', lat: 21.6501, lng: 72.9700, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'GIDC Office Jhagadia',         type: 'AAQM', lat: 21.7000, lng: 72.9700, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Nandesari CETP Vadodara',      type: 'AAQM', lat: 22.3960, lng: 73.2340, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'GPCB Office Vadodara',         type: 'AAQM', lat: 22.3072, lng: 73.1812, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Dandiya Bazar Vadodara',       type: 'AAQM', lat: 22.3002, lng: 73.2088, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Sterling Gelatin Karakhadi',   type: 'AAQM', lat: 22.3500, lng: 73.1900, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Manjusar Savali Vadodara',     type: 'AAQM', lat: 22.3720, lng: 73.0900, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Sardhara Corpn Rajkot',        type: 'AAQM', lat: 22.2965, lng: 70.8021, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'GPCB Office Rajkot',           type: 'AAQM', lat: 22.2965, lng: 70.8021, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Fisheries Office Jamnagar',    type: 'AAQM', lat: 22.4707, lng: 70.0577, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Amrut Chamber Mundra Kutch',   type: 'AAQM', lat: 22.8400, lng: 69.7230, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Eagle Sanitary Morbi',         type: 'AAQM', lat: 22.8180, lng: 70.8340, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Morbi Nagarpalika',            type: 'AAQM', lat: 22.8150, lng: 70.8280, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Zydus Pharmez Ahmedabad Rural',type: 'AAQM', lat: 22.9825, lng: 72.3810, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Tristar Sarigam',              type: 'AAQM', lat: 20.4260, lng: 72.9505, parameters: ['PM10','PM2_5','SO2','NOx'] },
]

// ── AAQM SAMP: 24 synthesised stations ───────────────────────────────────────

const SAMP_STATIONS: StationDef[] = [
  { name: 'Moraiya SAMP Ahmedabad',       type: 'AAQM', lat: 22.9620, lng: 72.3400, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Bavla SAMP Ahmedabad',         type: 'AAQM', lat: 22.8370, lng: 72.1870, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Mandal-Becharaji SAMP',        type: 'AAQM', lat: 23.5800, lng: 72.2600, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Sanand GIDC SAMP',             type: 'AAQM', lat: 22.9830, lng: 72.3600, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Kadi SAMP Mehsana',            type: 'AAQM', lat: 23.2990, lng: 72.3370, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Unjha SAMP Mehsana',           type: 'AAQM', lat: 23.8035, lng: 72.3999, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Bilimora SAMP Navsari',        type: 'AAQM', lat: 20.7640, lng: 72.9607, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Anklav SAMP Anand',            type: 'AAQM', lat: 22.7215, lng: 72.9877, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Karjan SAMP Vadodara',         type: 'AAQM', lat: 22.0600, lng: 73.1200, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Halol SAMP Vadodara',          type: 'AAQM', lat: 22.5011, lng: 73.4651, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Umbergaon SAMP Valsad',        type: 'AAQM', lat: 20.1888, lng: 72.7538, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Jetpur SAMP Rajkot',           type: 'AAQM', lat: 21.7543, lng: 70.6226, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Gondal SAMP Rajkot',           type: 'AAQM', lat: 21.9600, lng: 70.8001, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Wankaner SAMP Morbi',          type: 'AAQM', lat: 22.6099, lng: 71.0005, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Surendranagar SAMP',           type: 'AAQM', lat: 22.7278, lng: 71.6488, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Anjar SAMP Kutch',             type: 'AAQM', lat: 23.1146, lng: 70.0290, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Gandhidham SAMP Kutch',        type: 'AAQM', lat: 23.0809, lng: 70.1302, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Bhavnagar SAMP',              type: 'AAQM', lat: 21.7645, lng: 72.1519, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Sihor SAMP Bhavnagar',         type: 'AAQM', lat: 21.7058, lng: 71.9535, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Pardi SAMP Valsad',            type: 'AAQM', lat: 20.5180, lng: 72.9645, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Kamrej SAMP Surat',            type: 'AAQM', lat: 21.2550, lng: 72.9550, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Bardoli SAMP Surat',           type: 'AAQM', lat: 21.1197, lng: 73.1134, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Bharuch City SAMP',            type: 'AAQM', lat: 21.7051, lng: 72.9959, parameters: ['PM10','PM2_5','SO2','NOx'] },
  { name: 'Jamnagar City SAMP',           type: 'AAQM', lat: 22.4707, lng: 70.0577, parameters: ['PM10','PM2_5','SO2','NOx'] },
]

// ── VOC clusters: 25 ─────────────────────────────────────────────────────────

const VOC_PARAMS = VOC_PARAMETERS.slice() as string[]

const VOC_STATIONS: StationDef[] = [
  { name: 'Swami Shanti Prakash Moraiya',  type: 'VOC', lat: 22.9650, lng: 72.3350, parameters: VOC_PARAMS },
  { name: 'Loxim Sanand',                  type: 'VOC', lat: 22.9980, lng: 72.3750, parameters: VOC_PARAMS },
  { name: 'Vatva GIDC VOC Cluster',        type: 'VOC', lat: 22.9500, lng: 72.6210, parameters: VOC_PARAMS },
  { name: 'Udhyog Nagar Naroda',           type: 'VOC', lat: 23.0680, lng: 72.6480, parameters: VOC_PARAMS },
  { name: 'Odhav Industrial VOC',          type: 'VOC', lat: 23.0405, lng: 72.6598, parameters: VOC_PARAMS },
  { name: 'Gangotri Anjar Kutch',          type: 'VOC', lat: 23.1180, lng: 70.0600, parameters: VOC_PARAMS },
  { name: 'Lunva Kutch',                   type: 'VOC', lat: 22.8920, lng: 69.8250, parameters: VOC_PARAMS },
  { name: 'Mundra Industrial VOC',         type: 'VOC', lat: 22.8400, lng: 69.7230, parameters: VOC_PARAMS },
  { name: 'Rallis Ankleshwar VOC',         type: 'VOC', lat: 21.6315, lng: 72.9840, parameters: VOC_PARAMS },
  { name: 'Hikal Panoli VOC',              type: 'VOC', lat: 21.6510, lng: 72.9710, parameters: VOC_PARAMS },
  { name: 'DCM Shreeram Jagadia VOC',      type: 'VOC', lat: 21.7050, lng: 72.9700, parameters: VOC_PARAMS },
  { name: 'Dahej SEZ VOC Cluster',         type: 'VOC', lat: 21.7120, lng: 72.5570, parameters: VOC_PARAMS },
  { name: 'Sachin Industrial VOC',         type: 'VOC', lat: 21.0850, lng: 72.8650, parameters: VOC_PARAMS },
  { name: 'Pandesara Dyeing VOC',          type: 'VOC', lat: 21.1200, lng: 72.8240, parameters: VOC_PARAMS },
  { name: 'Udhna-Magdalla VOC Surat',      type: 'VOC', lat: 21.1580, lng: 72.8500, parameters: VOC_PARAMS },
  { name: 'Palsana CETP VOC',              type: 'VOC', lat: 21.0960, lng: 72.9260, parameters: VOC_PARAMS },
  { name: 'Vapi Phase-I VOC',              type: 'VOC', lat: 20.3720, lng: 72.9100, parameters: VOC_PARAMS },
  { name: 'Sarigam Industrial VOC',        type: 'VOC', lat: 20.4270, lng: 72.9520, parameters: VOC_PARAMS },
  { name: 'Halol GIDC VOC Cluster',        type: 'VOC', lat: 22.5020, lng: 73.4660, parameters: VOC_PARAMS },
  { name: 'Nandesari GIDC VOC',            type: 'VOC', lat: 22.3970, lng: 73.2350, parameters: VOC_PARAMS },
  { name: 'Hazira Industrial VOC',         type: 'VOC', lat: 21.1020, lng: 72.6250, parameters: VOC_PARAMS },
  { name: 'Jhagadia GIDC VOC',             type: 'VOC', lat: 21.7030, lng: 72.9680, parameters: VOC_PARAMS },
  { name: 'Rajkot Shapar-Veraval VOC',     type: 'VOC', lat: 22.5380, lng: 70.8120, parameters: VOC_PARAMS },
  { name: 'Detroj-Rampura Ahmedabad VOC',  type: 'VOC', lat: 22.9650, lng: 72.2550, parameters: VOC_PARAMS },
  { name: 'Kandla SEZ VOC Cluster',        type: 'VOC', lat: 23.0310, lng: 70.2200, parameters: VOC_PARAMS },
]

// ── MINARS / GEMS: 5 river/lake stations ─────────────────────────────────────

const MINARS_STATIONS: StationDef[] = [
  { name: 'Sabarmati Vasna-Narol',   type: 'MINARS', lat: 22.9800, lng: 72.6000, parameters: ['pH','DO','BOD','COD'] },
  { name: 'Mahi Vasad',              type: 'MINARS', lat: 22.4660, lng: 73.1290, parameters: ['pH','DO','BOD','COD'] },
  { name: 'Narmada Garudeshwar',     type: 'MINARS', lat: 21.8840, lng: 73.6620, parameters: ['pH','DO','BOD','COD'] },
  { name: 'Tapi Kathor',             type: 'MINARS', lat: 21.3030, lng: 73.0000, parameters: ['pH','DO','BOD','COD'] },
  { name: 'Lake Kankaria Ahmedabad', type: 'GEMS',   lat: 22.9900, lng: 72.6060, parameters: ['pH','DO','BOD','COD'] },
]

// ── Status assignment (95% active, 5% down/calibration) ──────────────────────

function stationStatus(seed: string): string {
  const rng = mulberry32(strHash(seed))
  const v = rng()
  if (v < 0.03) return 'down'
  if (v < 0.05) return 'calibration'
  return 'active'
}

// ── Value generation helpers ───────────────────────────────────────────────────

interface ParamRange {
  min: number
  max: number
  norm?: number
  noiseSd: number
}

const PARAM_RANGES: Record<string, ParamRange> = {
  PM10:              { min: 60,   max: 180,  norm: 100, noiseSd: 15 },
  PM2_5:             { min: 20,   max: 90,   norm: 60,  noiseSd: 10 },
  SO2:               { min: 12,   max: 30,   norm: 80,  noiseSd: 4  }, // AR shows low SO2 mostly
  NOx:               { min: 18,   max: 60,   norm: 80,  noiseSd: 8  },
  pH:                { min: 6.0,  max: 9.0,  norm: 7.5, noiseSd: 0.4 },
  DO:                { min: 2.0,  max: 9.0,  norm: 5,   noiseSd: 0.8 },
  BOD:               { min: 20,   max: 50,   norm: 30,  noiseSd: 5  },
  COD:               { min: 150,  max: 400,  norm: 250, noiseSd: 30 },
  SS:                { min: 60,   max: 200,  norm: 100, noiseSd: 20 },
  NH3_N:             { min: 20,   max: 80,   norm: 50,  noiseSd: 10 },
  PHENOLIC_COMPOUNDS:{ min: 0.5,  max: 2.5,  norm: 1,   noiseSd: 0.2 },
}

// Box-Muller for gaussian noise
function gaussian(rng: () => number, mean: number, sd: number): number {
  const u1 = Math.max(rng(), 1e-9)
  const u2 = rng()
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * sd
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/**
 * Generate a realistic value for a parameter at a given station + timestamp.
 * About 10% of COD readings are seeded over norm to create exceedances.
 */
function genValue(param: string, stationSeed: string, ts: Date): number {
  const range  = PARAM_RANGES[param]
  if (!range) return 0
  const seed   = strHash(`${stationSeed}:${param}:${ts.getTime()}`)
  const rng    = mulberry32(seed)
  const center = range.norm ?? ((range.min + range.max) / 2)
  let v = gaussian(rng, center, range.noiseSd)
  v = clamp(v, range.min, range.max)
  // Occasionally push above norm to create exceedances (keeps ~10% over for COD/BOD)
  if (param === 'COD' && rng() < 0.10) {
    v = clamp(center * (1.05 + rng() * 0.60), range.min, range.max * 1.2)
  } else if (param === 'BOD' && rng() < 0.08) {
    v = clamp(center * (1.05 + rng() * 0.50), range.min, range.max * 1.2)
  } else if (param === 'pH' && rng() < 0.06) {
    v = rng() < 0.5 ? clamp(5.0 + rng() * 1.0, 4.5, 6.0) : clamp(9.0 + rng() * 1.0, 9.0, 10.0)
  } else if (param === 'NH3_N' && rng() < 0.07) {
    v = clamp(center * (1.05 + rng() * 0.45), range.min, range.max * 1.2)
  }
  return Math.round(v * 100) / 100
}

function paramUnit(param: string): string {
  const units: Record<string, string> = {
    PM10: 'µg/m³', PM2_5: 'µg/m³', SO2: 'µg/m³', NOx: 'µg/m³',
    pH: 'pH', DO: 'mg/L', BOD: 'mg/L', COD: 'mg/L', SS: 'mg/L',
    NH3_N: 'mg/L', PHENOLIC_COMPOUNDS: 'mg/L',
  }
  return units[param] ?? 'µg/m³'
}

// ── Exceedance helpers ────────────────────────────────────────────────────────

interface ExceedanceDef {
  stationId: string
  readingId: string
  parameter: string
  observedValue: number
  normValue: number
  breachMagnitude: number
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL'
  detectedAt: Date
  dispositionState: 'PENDING' | 'CONFIRMED_VIOLATION' | 'SENSOR_GLITCH'
  dispositionActorId?: string
}

function exceedanceSeverity(breach: number): 'MINOR' | 'MAJOR' | 'CRITICAL' {
  if (breach > 0.50) return 'CRITICAL'
  if (breach > 0.25) return 'MAJOR'
  return 'MINOR'
}

/**
 * Check whether a value exceeds its norm by >5%.
 * pH is special: exceedance when <5.7 or >8.5.
 * DO is inverted: exceedance when value < 5 * 0.95.
 */
function isExceedance(param: string, value: number): { breach: number; normUsed: number } | null {
  if (param === 'pH') {
    if (value > 8.5) {
      const n = 8.5
      const breach = (value - n) / n
      return breach > 0.05 ? { breach, normUsed: n } : null
    }
    if (value < 6.0) {
      const n = 6.0
      const breach = (n - value) / n
      return breach > 0.05 ? { breach, normUsed: n } : null
    }
    return null
  }
  if (param === 'DO') {
    const n = MINARS_NORMS.DO?.value ?? 5
    if (value < n * 0.95) {
      const breach = (n - value) / n
      return { breach, normUsed: n }
    }
    return null
  }
  const n = NORM[param]
  if (n == null) return null
  const breach = (value - n) / n
  return breach > 0.05 ? { breach, normUsed: n } : null
}

// ── Main seed function ────────────────────────────────────────────────────────

export async function seedSensors(prisma: PrismaClient): Promise<void> {
  const now = new Date()

  // ── 1. Fetch the MONITORING_OFFICER user for non-PENDING dispositions ───────
  const monitoringOfficer = await prisma.user.findFirst({ where: { role: 'MONITORING_OFFICER' } })
  const moId = monitoringOfficer?.id

  // ── 2. Fetch industries (for OCEMS FK lookup) ────────────────────────────────
  const industries = await prisma.industry.findMany({ select: { id: true, ucNumber: true, lat: true, lng: true, name: true } })
  const industryByUc = new Map(industries.map(i => [i.ucNumber, i]))

  // ── 3. Build all station defs ─────────────────────────────────────────────────
  // OCEMS stations
  const ocemsStations: StationDef[] = OCEMS_UC.map(uc => {
    const ind = industryByUc.get(uc)
    return {
      name: `OCEMS @ ${ind?.name ?? uc}`,
      type: 'OCEMS' as const,
      lat:  (ind?.lat ?? 22.0) + (strHash(uc + 'lat') % 100 - 50) / 5000,
      lng:  (ind?.lng ?? 72.0) + (strHash(uc + 'lng') % 100 - 50) / 5000,
      parameters: OCEMS_PARAMS,
      industryUcNumber: uc,
    }
  })

  const allStationDefs: StationDef[] = [
    ...ocemsStations,
    ...NAMP_STATIONS,
    ...SAMP_STATIONS,
    ...VOC_STATIONS,
    ...MINARS_STATIONS,
  ]

  // ── 4. Upsert stations ────────────────────────────────────────────────────────
  const stationIds: Map<string, string> = new Map()

  for (const def of allStationDefs) {
    const industryId = def.industryUcNumber ? industryByUc.get(def.industryUcNumber)?.id : undefined
    const status     = stationStatus(def.name)
    const existing   = await prisma.monitoringStation.findFirst({ where: { name: def.name } })

    let id: string
    if (existing) {
      id = existing.id
      await prisma.monitoringStation.update({
        where: { id },
        data:  { status, parameters: def.parameters },
      })
    } else {
      const created = await prisma.monitoringStation.create({
        data: {
          type:       def.type,
          name:       def.name,
          lat:        def.lat,
          lng:        def.lng,
          parameters: def.parameters,
          status,
          industryId: industryId ?? null,
        },
      })
      id = created.id
    }
    stationIds.set(def.name, id)
  }

  // ── 5. Clear old readings + exceedances (idempotent re-seed) ─────────────────
  // We delete only readings for stations we just upserted to stay idempotent
  const stationIdArray = [...stationIds.values()]

  // Delete exceedances first (FK constraint)
  await prisma.exceedance.deleteMany({ where: { stationId: { in: stationIdArray } } })
  await prisma.sensorReading.deleteMany({ where: { stationId: { in: stationIdArray } } })

  // ── 6. OCEMS readings: 4-hourly, last 30 days ────────────────────────────────
  // 30 days × 6 readings/day = 180 per (station, param)
  // 80 stations × 6 params × 180 = 86 400 rows, batched by 10 000

  const OCEMS_BATCH = 10_000
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000)

  // Build timestamps array (4-hourly for 30 days)
  const ocemsTimes: Date[] = []
  for (let d = 0; d < 30; d++) {
    for (let h = 0; h < 24; h += 4) {
      const ts = new Date(thirtyDaysAgo)
      ts.setDate(ts.getDate() + d)
      ts.setHours(h, 0, 0, 0)
      ocemsTimes.push(ts)
    }
  }

  let batch: Array<{
    stationId: string; parameter: string; value: number;
    unit: string; timestamp: Date; validity: 'VALID' | 'FLAGGED'
  }> = []

  // Collect reading records with potential exceedances separately
  // We'll build (stationId, param, ts, value) and push exceedances after
  const pendingExceedances: ExceedanceDef[] = []

  // Map readingId is only known after insert; so we do a two-pass for OCEMS:
  // pass-1: bulk insert all readings, pass-2: re-query to get IDs for exceedances.
  // But since createMany doesn't return IDs, we'll create a local signature map.
  // Strategy: use (stationId + param + timestamp.getTime()) as a unique composite
  // for lookups after batch insertions. We store them in a Map<string, ExceedanceDef>.
  const exceedanceLookup: Map<string, Omit<ExceedanceDef, 'readingId'>> = new Map()

  for (const stDef of ocemsStations) {
    const stId = stationIds.get(stDef.name)
    if (!stId) continue
    const status = stationStatus(stDef.name)
    if (status === 'down') continue  // no readings for down stations

    for (const param of OCEMS_PARAMS) {
      for (const ts of ocemsTimes) {
        const value    = genValue(param, stDef.name, ts)
        const validity: 'VALID' | 'FLAGGED' = status === 'calibration' ? 'FLAGGED' : 'VALID'

        batch.push({ stationId: stId, parameter: param, value, unit: paramUnit(param), timestamp: ts, validity })

        // Tag exceedance candidates
        const exc = isExceedance(param, value)
        if (exc) {
          const sig = `${stId}:${param}:${ts.getTime()}`
          const rng2 = mulberry32(strHash(sig))
          const dv   = rng2()
          let dispositionState: 'PENDING' | 'CONFIRMED_VIOLATION' | 'SENSOR_GLITCH'
          if (dv < 0.55)      dispositionState = 'PENDING'
          else if (dv < 0.85) dispositionState = 'CONFIRMED_VIOLATION'
          else                dispositionState = 'SENSOR_GLITCH'

          exceedanceLookup.set(sig, {
            stationId:         stId,
            parameter:         param,
            observedValue:     value,
            normValue:         exc.normUsed,
            breachMagnitude:   exc.breach,
            severity:          exceedanceSeverity(exc.breach),
            detectedAt:        ts,
            dispositionState,
            dispositionActorId: dispositionState !== 'PENDING' ? moId : undefined,
          })
        }

        if (batch.length >= OCEMS_BATCH) {
          await prisma.sensorReading.createMany({ data: batch })
          batch = []
        }
      }
    }
  }
  if (batch.length > 0) {
    await prisma.sensorReading.createMany({ data: batch })
    batch = []
  }

  // ── 7. AAQM readings: monthly avg last 12 months ──────────────────────────────
  const aaqmStations = [...NAMP_STATIONS, ...SAMP_STATIONS]
  const aaqmBatch: typeof batch = []

  for (const stDef of aaqmStations) {
    const stId = stationIds.get(stDef.name)
    if (!stId) continue
    const status = stationStatus(stDef.name)
    if (status === 'down') continue

    for (let m = 0; m < 12; m++) {
      const ts = new Date(now)
      ts.setMonth(ts.getMonth() - m)
      ts.setDate(1)
      ts.setHours(0, 0, 0, 0)

      for (const param of ['PM10', 'PM2_5', 'SO2', 'NOx']) {
        const value    = genValue(param, stDef.name, ts)
        const validity: 'VALID' | 'FLAGGED' = status === 'calibration' ? 'FLAGGED' : 'VALID'
        aaqmBatch.push({ stationId: stId, parameter: param, value, unit: paramUnit(param), timestamp: ts, validity })
      }
    }
  }
  // Flush AAQM in one go (12 × 62 × 4 = 2 976 rows)
  for (let i = 0; i < aaqmBatch.length; i += OCEMS_BATCH) {
    await prisma.sensorReading.createMany({ data: aaqmBatch.slice(i, i + OCEMS_BATCH) })
  }

  // AAQM exceedances (PM10 > 100)
  for (const stDef of aaqmStations) {
    const stId = stationIds.get(stDef.name)
    if (!stId) continue
    // Re-generate to check exceedances (values were already inserted)
    for (let m = 0; m < 12; m++) {
      const ts = new Date(now)
      ts.setMonth(ts.getMonth() - m)
      ts.setDate(1)
      ts.setHours(0, 0, 0, 0)
      for (const param of ['PM10', 'PM2_5', 'SO2', 'NOx']) {
        const value = genValue(param, stDef.name, ts)
        const exc   = isExceedance(param, value)
        if (exc) {
          const sig = `${stId}:${param}:${ts.getTime()}`
          const rng2 = mulberry32(strHash(sig))
          const dv   = rng2()
          let dispositionState: 'PENDING' | 'CONFIRMED_VIOLATION' | 'SENSOR_GLITCH'
          if (dv < 0.55)      dispositionState = 'PENDING'
          else if (dv < 0.85) dispositionState = 'CONFIRMED_VIOLATION'
          else                dispositionState = 'SENSOR_GLITCH'

          exceedanceLookup.set(sig, {
            stationId:         stId,
            parameter:         param,
            observedValue:     value,
            normValue:         exc.normUsed,
            breachMagnitude:   exc.breach,
            severity:          exceedanceSeverity(exc.breach),
            detectedAt:        ts,
            dispositionState,
            dispositionActorId: dispositionState !== 'PENDING' ? moId : undefined,
          })
        }
      }
    }
  }

  // ── 8. VOC readings: monthly per cluster ─────────────────────────────────────
  const vocBatch: typeof batch = []
  for (const stDef of VOC_STATIONS) {
    const stId = stationIds.get(stDef.name)
    if (!stId) continue
    const status = stationStatus(stDef.name)
    if (status === 'down') continue

    for (let m = 0; m < 12; m++) {
      const ts = new Date(now)
      ts.setMonth(ts.getMonth() - m)
      ts.setDate(1)
      ts.setHours(0, 0, 0, 0)

      for (const param of VOC_PARAMS) {
        const rng  = mulberry32(strHash(`${stDef.name}:${param}:${ts.getTime()}`))
        const base = rng() * 80 + 5  // VOC values 5–85 µg/m³
        const value = Math.round(base * 100) / 100
        vocBatch.push({ stationId: stId, parameter: param, value, unit: 'µg/m³', timestamp: ts, validity: 'VALID' })
      }
    }
  }
  for (let i = 0; i < vocBatch.length; i += OCEMS_BATCH) {
    await prisma.sensorReading.createMany({ data: vocBatch.slice(i, i + OCEMS_BATCH) })
  }

  // ── 9. MINARS/GEMS readings: quarterly ────────────────────────────────────────
  const minarsBatch: typeof batch = []
  for (const stDef of MINARS_STATIONS) {
    const stId = stationIds.get(stDef.name)
    if (!stId) continue
    const status = stationStatus(stDef.name)
    if (status === 'down') continue

    // 4 quarters
    for (let q = 0; q < 4; q++) {
      const ts = new Date(now)
      ts.setMonth(ts.getMonth() - q * 3)
      ts.setDate(1)
      ts.setHours(0, 0, 0, 0)

      for (const param of ['pH', 'DO', 'BOD', 'COD']) {
        const value = genValue(param, stDef.name, ts)
        minarsBatch.push({ stationId: stId, parameter: param, value, unit: paramUnit(param), timestamp: ts, validity: 'VALID' })

        // MINARS exceedances
        const exc = isExceedance(param, value)
        if (exc) {
          const sig  = `${stId}:${param}:${ts.getTime()}`
          const rng2 = mulberry32(strHash(sig))
          const dv   = rng2()
          let dispositionState: 'PENDING' | 'CONFIRMED_VIOLATION' | 'SENSOR_GLITCH'
          if (dv < 0.55)      dispositionState = 'PENDING'
          else if (dv < 0.85) dispositionState = 'CONFIRMED_VIOLATION'
          else                dispositionState = 'SENSOR_GLITCH'

          exceedanceLookup.set(sig, {
            stationId:         stId,
            parameter:         param,
            observedValue:     value,
            normValue:         exc.normUsed,
            breachMagnitude:   exc.breach,
            severity:          exceedanceSeverity(exc.breach),
            detectedAt:        ts,
            dispositionState,
            dispositionActorId: dispositionState !== 'PENDING' ? moId : undefined,
          })
        }
      }
    }
  }
  if (minarsBatch.length > 0) {
    await prisma.sensorReading.createMany({ data: minarsBatch })
  }

  // ── 10. Insert exceedances (attach readingId where we can match) ──────────────
  // After all readings inserted, look them up by (stationId, parameter, timestamp)
  // Cap total exceedances at 5000
  const CAP = 5000
  let exceedanceCount = 0
  const exceedanceEntries = [...exceedanceLookup.entries()]

  // Shuffle deterministically to get a spread across stations
  exceedanceEntries.sort(([a], [b]) => (strHash(a) < strHash(b) ? -1 : 1))

  const exceedanceBatch: Array<{
    stationId: string; readingId: string | null; parameter: string;
    observedValue: number; normValue: number; breachMagnitude: number;
    severity: 'MINOR' | 'MAJOR' | 'CRITICAL'; detectedAt: Date;
    dispositionState: 'PENDING' | 'CONFIRMED_VIOLATION' | 'SENSOR_GLITCH';
    dispositionActorId: string | null; dispositionAt: Date | null;
  }> = []

  for (const [sig, def] of exceedanceEntries) {
    if (exceedanceCount >= CAP) break

    // Try to find the reading ID
    const [stationId, parameter, tsStr] = sig.split(':')
    const ts = new Date(Number(tsStr))
    let readingId: string | null = null
    try {
      const reading = await prisma.sensorReading.findFirst({
        where: { stationId: stationId!, parameter, timestamp: ts },
        select: { id: true },
      })
      readingId = reading?.id ?? null
    } catch {
      // ignore
    }

    exceedanceBatch.push({
      stationId: def.stationId,
      readingId,
      parameter:  def.parameter,
      observedValue: def.observedValue,
      normValue:  def.normValue,
      breachMagnitude: def.breachMagnitude,
      severity:   def.severity,
      detectedAt: def.detectedAt,
      dispositionState:    def.dispositionState,
      dispositionActorId:  def.dispositionActorId ?? null,
      dispositionAt:       def.dispositionState !== 'PENDING' ? def.detectedAt : null,
    })
    exceedanceCount++
  }

  // Batch-insert exceedances
  for (let i = 0; i < exceedanceBatch.length; i += 1000) {
    await prisma.exceedance.createMany({ data: exceedanceBatch.slice(i, i + 1000) })
  }

  pendingExceedances.length  // satisfy no-unused lint
}
