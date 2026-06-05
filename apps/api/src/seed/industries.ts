import { Prisma, type PrismaClient } from '@prisma/client'

// ── Helpers ───────────────────────────────────────────────────────────────

/** Deterministic jitter in range [-0.02, +0.02] based on a seed string */
function jitter(seed: string, axis: 'lat' | 'lng'): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  if (axis === 'lng') h = ~h
  // Map to [-0.02, 0.02]
  return ((h >>> 0) % 41 - 20) / 1000
}

type CategoryKey = 'RED' | 'ORANGE' | 'GREEN' | 'WHITE'

interface IndustryDef {
  name: string
  ucNumber: string
  category: CategoryKey
  sectorCode: string
  districtCode: string
  talukaName: string
  gidcZoneName: string
  baseLat: number
  baseLng: number
  capacity: Record<string, unknown>
}

const SCHEME = 'CPCB Red/Orange/Green/White (2016)'

// ── Ankleshwar ~25 (Pharma + Chemical Bulk + Dyestuff) ────────────────────
const ANKLESHWAR: IndustryDef[] = [
  { name: 'Aarti Industries Ltd – Ankleshwar',        ucNumber: 'GPCB-UCN-001001', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 120 } },
  { name: 'Bodal Chemicals Ltd – Ankleshwar',         ucNumber: 'GPCB-UCN-001002', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 80 } },
  { name: 'Clariant Chemicals India – Ankleshwar',    ucNumber: 'GPCB-UCN-001003', category: 'RED',    sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 60 } },
  { name: 'Deepak Nitrite Ltd – Ankleshwar',          ucNumber: 'GPCB-UCN-001004', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 150 } },
  { name: 'Excel Industries Ltd – Ankleshwar',        ucNumber: 'GPCB-UCN-001005', category: 'RED',    sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 45 } },
  { name: 'Gujarat Alkalies & Chemicals – Ankleshwar', ucNumber: 'GPCB-UCN-001006', category: 'RED',  sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 200 } },
  { name: 'Meghmani Organics – Ankleshwar',           ucNumber: 'GPCB-UCN-001007', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 90 } },
  { name: 'Navin Fluorine International – Ankleshwar', ucNumber: 'GPCB-UCN-001008', category: 'RED',   sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 55 } },
  { name: 'Prime Chemicals – Ankleshwar',             ucNumber: 'GPCB-UCN-001009', category: 'ORANGE', sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 30 } },
  { name: 'Rayon Bio-Tech Ltd – Ankleshwar',          ucNumber: 'GPCB-UCN-001010', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 20 } },
  { name: 'Shree Ram Dye Stuff – Ankleshwar',         ucNumber: 'GPCB-UCN-001011', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 40 } },
  { name: 'Unistar Pharma – Ankleshwar',              ucNumber: 'GPCB-UCN-001012', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 15 } },
  { name: 'Vikas Ecotech – Ankleshwar',               ucNumber: 'GPCB-UCN-001013', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 25 } },
  { name: 'Ankleshwar Dyes Industries',               ucNumber: 'GPCB-UCN-001014', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 35 } },
  { name: 'Bombay Drug House – Ankleshwar',           ucNumber: 'GPCB-UCN-001015', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 18 } },
  { name: 'Cadila Healthcare API – Ankleshwar',       ucNumber: 'GPCB-UCN-001016', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 22 } },
  { name: 'Gujarat Chem Industries – Ankleshwar',     ucNumber: 'GPCB-UCN-001017', category: 'ORANGE', sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 28 } },
  { name: 'Indian Dyestuff Industries – Ankleshwar',  ucNumber: 'GPCB-UCN-001018', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 50 } },
  { name: 'Lupin Ltd API – Ankleshwar',               ucNumber: 'GPCB-UCN-001019', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 30 } },
  { name: 'Macro Industries – Ankleshwar',            ucNumber: 'GPCB-UCN-001020', category: 'GREEN',  sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 12 } },
  { name: 'Paras Pharma – Ankleshwar',                ucNumber: 'GPCB-UCN-001021', category: 'ORANGE', sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 10 } },
  { name: 'Rishi Pharma – Ankleshwar',                ucNumber: 'GPCB-UCN-001022', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 8 } },
  { name: 'Sachdeva Dyes – Ankleshwar',               ucNumber: 'GPCB-UCN-001023', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 25 } },
  { name: 'Shubhkam Fine Chemicals – Ankleshwar',     ucNumber: 'GPCB-UCN-001024', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 20 } },
  { name: 'Tapi Agro Chemicals – Ankleshwar',         ucNumber: 'GPCB-UCN-001025', category: 'WHITE',  sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Ankleshwar', gidcZoneName: 'Ankleshwar GIDC', baseLat: 21.62, baseLng: 72.99, capacity: { productionTPD: 5 } },
]

// ── Vatva ~20 (Dyestuff + Chemical) ──────────────────────────────────────
const VATVA: IndustryDef[] = [
  { name: 'Atul Ltd – Vatva',                        ucNumber: 'GPCB-UCN-002001', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 100 } },
  { name: 'Alembic Pharmaceuticals – Vatva',         ucNumber: 'GPCB-UCN-002002', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 45 } },
  { name: 'Astron Chemical – Vatva',                 ucNumber: 'GPCB-UCN-002003', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 60 } },
  { name: 'BASF India – Vatva',                      ucNumber: 'GPCB-UCN-002004', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 80 } },
  { name: 'Colourtex Industries – Vatva',            ucNumber: 'GPCB-UCN-002005', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 55 } },
  { name: 'Divi`s Laboratories – Vatva',             ucNumber: 'GPCB-UCN-002006', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 30 } },
  { name: 'Dystar India – Vatva',                    ucNumber: 'GPCB-UCN-002007', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 70 } },
  { name: 'Galil Chemicals – Vatva',                 ucNumber: 'GPCB-UCN-002008', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 40 } },
  { name: 'Huntsman Advanced Materials – Vatva',     ucNumber: 'GPCB-UCN-002009', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 90 } },
  { name: 'Jay Chemical Industries – Vatva',         ucNumber: 'GPCB-UCN-002010', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 65 } },
  { name: 'Kansai Nerolac Paints – Vatva',           ucNumber: 'GPCB-UCN-002011', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 50 } },
  { name: 'Mangal Industries – Vatva',               ucNumber: 'GPCB-UCN-002012', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 35 } },
  { name: 'Narmada Chematur Petrochemicals – Vatva', ucNumber: 'GPCB-UCN-002013', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 110 } },
  { name: 'Omkar Speciality Chemicals – Vatva',      ucNumber: 'GPCB-UCN-002014', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 22 } },
  { name: 'Prestige Chemicals – Vatva',              ucNumber: 'GPCB-UCN-002015', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 28 } },
  { name: 'Sayaji Industries – Vatva',               ucNumber: 'GPCB-UCN-002016', category: 'GREEN',  sectorCode: 'FOOD',               districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 15 } },
  { name: 'Shanti Dyes & Intermediates – Vatva',     ucNumber: 'GPCB-UCN-002017', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 48 } },
  { name: 'Swastik Industries – Vatva',              ucNumber: 'GPCB-UCN-002018', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 18 } },
  { name: 'Torrent Pharmaceuticals – Vatva',         ucNumber: 'GPCB-UCN-002019', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 40 } },
  { name: 'Vapi Bulk Chemicals – Vatva Unit',        ucNumber: 'GPCB-UCN-002020', category: 'WHITE',  sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-AHM', talukaName: 'Vatva',  gidcZoneName: 'Vatva GIDC', baseLat: 22.95, baseLng: 72.62, capacity: { productionTPD: 8 } },
]

// ── Naroda ~12 (Chemical + Dyestuff) ─────────────────────────────────────
const NARODA: IndustryDef[] = [
  { name: 'Ahmedabad Textile Industry – Naroda',     ucNumber: 'GPCB-UCN-003001', category: 'ORANGE', sectorCode: 'TEXTILE',            districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 20 } },
  { name: 'Aakar Dyes – Naroda',                     ucNumber: 'GPCB-UCN-003002', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 30 } },
  { name: 'Benzo Chem Industries – Naroda',          ucNumber: 'GPCB-UCN-003003', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 45 } },
  { name: 'Ciba India – Naroda',                     ucNumber: 'GPCB-UCN-003004', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 55 } },
  { name: 'Dye Industries Complex – Naroda',         ucNumber: 'GPCB-UCN-003005', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 38 } },
  { name: 'Gujarat Reclaim Rubber – Naroda',         ucNumber: 'GPCB-UCN-003006', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 15 } },
  { name: 'Hitech Finechem – Naroda',                ucNumber: 'GPCB-UCN-003007', category: 'RED',    sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 22 } },
  { name: 'Indofil Industries – Naroda',             ucNumber: 'GPCB-UCN-003008', category: 'RED',    sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 40 } },
  { name: 'Kiri Industries – Naroda',                ucNumber: 'GPCB-UCN-003009', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 70 } },
  { name: 'Laxmi Colourants – Naroda',               ucNumber: 'GPCB-UCN-003010', category: 'ORANGE', sectorCode: 'DYESTUFF',           districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 18 } },
  { name: 'Punit Resins – Naroda',                   ucNumber: 'GPCB-UCN-003011', category: 'GREEN',  sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 10 } },
  { name: 'Sigma Industries – Naroda',               ucNumber: 'GPCB-UCN-003012', category: 'WHITE',  sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-AHM', talukaName: 'Naroda', gidcZoneName: 'Naroda GIDC', baseLat: 23.07, baseLng: 72.65, capacity: { productionTPD: 6 } },
]

// ── Sachin/Surat ~15 (Textile + Dyestuff) ────────────────────────────────
const SACHIN: IndustryDef[] = [
  { name: 'Aditya Birla Chemicals – Sachin',         ucNumber: 'GPCB-UCN-004001', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 60 } },
  { name: 'Alok Industries – Sachin',                ucNumber: 'GPCB-UCN-004002', category: 'ORANGE', sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 80 } },
  { name: 'Bombay Rayon Fashions – Sachin',          ucNumber: 'GPCB-UCN-004003', category: 'ORANGE', sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 55 } },
  { name: 'Decora Textiles – Sachin',                ucNumber: 'GPCB-UCN-004004', category: 'GREEN',  sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 20 } },
  { name: 'Garware Polyester – Sachin',              ucNumber: 'GPCB-UCN-004005', category: 'ORANGE', sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 45 } },
  { name: 'Indo Gulf Fertilizers – Sachin',          ucNumber: 'GPCB-UCN-004006', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 90 } },
  { name: 'Jyoti Textiles – Sachin',                 ucNumber: 'GPCB-UCN-004007', category: 'GREEN',  sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 15 } },
  { name: 'Kotak Yarn – Sachin',                     ucNumber: 'GPCB-UCN-004008', category: 'ORANGE', sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 25 } },
  { name: 'Lanxess Chemicals India – Sachin',        ucNumber: 'GPCB-UCN-004009', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 70 } },
  { name: 'Magenta Dyes – Sachin',                   ucNumber: 'GPCB-UCN-004010', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 35 } },
  { name: 'Prime Textiles – Sachin',                 ucNumber: 'GPCB-UCN-004011', category: 'WHITE',  sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 8 } },
  { name: 'Reliance Industries – Sachin Polyester',  ucNumber: 'GPCB-UCN-004012', category: 'ORANGE', sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 120 } },
  { name: 'Surat Textile Mills – Sachin',            ucNumber: 'GPCB-UCN-004013', category: 'ORANGE', sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 40 } },
  { name: 'Tasmai Dyestuff – Sachin',                ucNumber: 'GPCB-UCN-004014', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 28 } },
  { name: 'Versatile Synthetics – Sachin',           ucNumber: 'GPCB-UCN-004015', category: 'GREEN',  sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Sachin',    gidcZoneName: 'Sachin GIDC', baseLat: 21.08, baseLng: 72.86, capacity: { productionTPD: 12 } },
]

// ── Vapi (all phases) ~15 (Chemical + Dyestuff) ───────────────────────────
const VAPI: IndustryDef[] = [
  { name: 'Akzo Nobel India – Vapi',                 ucNumber: 'GPCB-UCN-005001', category: 'RED',    sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-I GIDC',   baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 65 } },
  { name: 'Arch Pharmalabs – Vapi',                  ucNumber: 'GPCB-UCN-005002', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-II GIDC',  baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 20 } },
  { name: 'Bayer CropScience – Vapi',                ucNumber: 'GPCB-UCN-005003', category: 'RED',    sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-I GIDC',   baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 50 } },
  { name: 'Chem India – Vapi',                       ucNumber: 'GPCB-UCN-005004', category: 'ORANGE', sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-II GIDC',  baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 30 } },
  { name: 'Doshi Ion Exchange – Vapi',               ucNumber: 'GPCB-UCN-005005', category: 'GREEN',  sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-III GIDC', baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 12 } },
  { name: 'Global Dyes & Chemicals – Vapi',          ucNumber: 'GPCB-UCN-005006', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-I GIDC',   baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 42 } },
  { name: 'INEOS India – Vapi',                      ucNumber: 'GPCB-UCN-005007', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-II GIDC',  baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 80 } },
  { name: 'Jubilant Organosys – Vapi',               ucNumber: 'GPCB-UCN-005008', category: 'RED',    sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-I GIDC',   baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 55 } },
  { name: 'Konar Chemicals – Vapi',                  ucNumber: 'GPCB-UCN-005009', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-III GIDC', baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 22 } },
  { name: 'Lanxess India – Vapi',                    ucNumber: 'GPCB-UCN-005010', category: 'RED',    sectorCode: 'DYESTUFF',           districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-I GIDC',   baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 60 } },
  { name: 'Neon Laboratories – Vapi',                ucNumber: 'GPCB-UCN-005011', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-II GIDC',  baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 18 } },
  { name: 'Pfizer India – Vapi',                     ucNumber: 'GPCB-UCN-005012', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-I GIDC',   baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 35 } },
  { name: 'Shalimar Paints – Vapi',                  ucNumber: 'GPCB-UCN-005013', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-III GIDC', baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 28 } },
  { name: 'Ultra Marine & Pigments – Vapi',          ucNumber: 'GPCB-UCN-005014', category: 'ORANGE', sectorCode: 'DYESTUFF',           districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-II GIDC',  baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 15 } },
  { name: 'Vapi Acrylic Industries',                 ucNumber: 'GPCB-UCN-005015', category: 'WHITE',  sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-VLS', talukaName: 'Vapi', gidcZoneName: 'Vapi-III GIDC', baseLat: 20.37, baseLng: 72.91, capacity: { productionTPD: 6 } },
]

// ── Pandesara ~8 (Textile) ────────────────────────────────────────────────
const PANDESARA: IndustryDef[] = [
  { name: 'Arvind Ltd – Pandesara',                  ucNumber: 'GPCB-UCN-006001', category: 'ORANGE', sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Pandesara', gidcZoneName: 'Pandesara GIDC', baseLat: 21.12, baseLng: 72.83, capacity: { productionTPD: 60 } },
  { name: 'DCM Shriram – Pandesara',                 ucNumber: 'GPCB-UCN-006002', category: 'RED',    sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Pandesara', gidcZoneName: 'Pandesara GIDC', baseLat: 21.12, baseLng: 72.83, capacity: { productionTPD: 45 } },
  { name: 'Grasim Industries – Pandesara',           ucNumber: 'GPCB-UCN-006003', category: 'RED',    sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Pandesara', gidcZoneName: 'Pandesara GIDC', baseLat: 21.12, baseLng: 72.83, capacity: { productionTPD: 80 } },
  { name: 'Indo Rama Synthetics – Pandesara',        ucNumber: 'GPCB-UCN-006004', category: 'ORANGE', sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Pandesara', gidcZoneName: 'Pandesara GIDC', baseLat: 21.12, baseLng: 72.83, capacity: { productionTPD: 55 } },
  { name: 'Jindal Poly Films – Pandesara',           ucNumber: 'GPCB-UCN-006005', category: 'GREEN',  sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Pandesara', gidcZoneName: 'Pandesara GIDC', baseLat: 21.12, baseLng: 72.83, capacity: { productionTPD: 30 } },
  { name: 'Mafatlal Industries – Pandesara',         ucNumber: 'GPCB-UCN-006006', category: 'ORANGE', sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Pandesara', gidcZoneName: 'Pandesara GIDC', baseLat: 21.12, baseLng: 72.83, capacity: { productionTPD: 40 } },
  { name: 'Raymond Ltd – Pandesara',                 ucNumber: 'GPCB-UCN-006007', category: 'ORANGE', sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Pandesara', gidcZoneName: 'Pandesara GIDC', baseLat: 21.12, baseLng: 72.83, capacity: { productionTPD: 50 } },
  { name: 'Sutlej Textiles – Pandesara',             ucNumber: 'GPCB-UCN-006008', category: 'WHITE',  sectorCode: 'TEXTILE',            districtCode: 'GJ-SRT', talukaName: 'Pandesara', gidcZoneName: 'Pandesara GIDC', baseLat: 21.12, baseLng: 72.83, capacity: { productionTPD: 10 } },
]

// ── Jhagadia ~8 (Chemical) ────────────────────────────────────────────────
const JHAGADIA: IndustryDef[] = [
  { name: 'AARTI Industries – Jhagadia',             ucNumber: 'GPCB-UCN-007001', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Jhagadia', gidcZoneName: 'Jhagadia GIDC', baseLat: 21.70, baseLng: 72.97, capacity: { productionTPD: 100 } },
  { name: 'Chemco Pharma – Jhagadia',                ucNumber: 'GPCB-UCN-007002', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Jhagadia', gidcZoneName: 'Jhagadia GIDC', baseLat: 21.70, baseLng: 72.97, capacity: { productionTPD: 25 } },
  { name: 'Degussa India – Jhagadia',                ucNumber: 'GPCB-UCN-007003', category: 'RED',    sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Jhagadia', gidcZoneName: 'Jhagadia GIDC', baseLat: 21.70, baseLng: 72.97, capacity: { productionTPD: 50 } },
  { name: 'Glenmark Pharmaceuticals – Jhagadia',     ucNumber: 'GPCB-UCN-007004', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Jhagadia', gidcZoneName: 'Jhagadia GIDC', baseLat: 21.70, baseLng: 72.97, capacity: { productionTPD: 30 } },
  { name: 'Jhagadia Organics',                       ucNumber: 'GPCB-UCN-007005', category: 'ORANGE', sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Jhagadia', gidcZoneName: 'Jhagadia GIDC', baseLat: 21.70, baseLng: 72.97, capacity: { productionTPD: 35 } },
  { name: 'Linde India – Jhagadia',                  ucNumber: 'GPCB-UCN-007006', category: 'GREEN',  sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Jhagadia', gidcZoneName: 'Jhagadia GIDC', baseLat: 21.70, baseLng: 72.97, capacity: { productionTPD: 10 } },
  { name: 'Raj Chemicals – Jhagadia',                ucNumber: 'GPCB-UCN-007007', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Jhagadia', gidcZoneName: 'Jhagadia GIDC', baseLat: 21.70, baseLng: 72.97, capacity: { productionTPD: 40 } },
  { name: 'UPL Ltd – Jhagadia',                      ucNumber: 'GPCB-UCN-007008', category: 'RED',    sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Jhagadia', gidcZoneName: 'Jhagadia GIDC', baseLat: 21.70, baseLng: 72.97, capacity: { productionTPD: 60 } },
]

// ── Dahej ~10 (Chemical Bulk + Refinery) ──────────────────────────────────
const DAHEJ: IndustryDef[] = [
  { name: 'BASF India – Dahej',                      ucNumber: 'GPCB-UCN-008001', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Dahej', gidcZoneName: 'Dahej SEZ/GIDC', baseLat: 21.71, baseLng: 72.56, capacity: { productionTPD: 120 } },
  { name: 'Borealis India – Dahej',                  ucNumber: 'GPCB-UCN-008002', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Dahej', gidcZoneName: 'Dahej SEZ/GIDC', baseLat: 21.71, baseLng: 72.56, capacity: { productionTPD: 150 } },
  { name: 'ONGC Petro Additions – Dahej',            ucNumber: 'GPCB-UCN-008003', category: 'RED',    sectorCode: 'REFINERY',           districtCode: 'GJ-BRH', talukaName: 'Dahej', gidcZoneName: 'Dahej SEZ/GIDC', baseLat: 21.71, baseLng: 72.56, capacity: { productionTPD: 500 } },
  { name: 'Deepak Fertilisers – Dahej',              ucNumber: 'GPCB-UCN-008004', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Dahej', gidcZoneName: 'Dahej SEZ/GIDC', baseLat: 21.71, baseLng: 72.56, capacity: { productionTPD: 200 } },
  { name: 'Gujarat Fluorochemicals – Dahej',         ucNumber: 'GPCB-UCN-008005', category: 'RED',    sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Dahej', gidcZoneName: 'Dahej SEZ/GIDC', baseLat: 21.71, baseLng: 72.56, capacity: { productionTPD: 80 } },
  { name: 'INEOS Styrolution – Dahej',               ucNumber: 'GPCB-UCN-008006', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Dahej', gidcZoneName: 'Dahej SEZ/GIDC', baseLat: 21.71, baseLng: 72.56, capacity: { productionTPD: 180 } },
  { name: 'Lotte Chemical – Dahej',                  ucNumber: 'GPCB-UCN-008007', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Dahej', gidcZoneName: 'Dahej SEZ/GIDC', baseLat: 21.71, baseLng: 72.56, capacity: { productionTPD: 250 } },
  { name: 'Meghmani Finechem – Dahej',               ucNumber: 'GPCB-UCN-008008', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Dahej', gidcZoneName: 'Dahej SEZ/GIDC', baseLat: 21.71, baseLng: 72.56, capacity: { productionTPD: 100 } },
  { name: 'Petronet LNG – Dahej',                    ucNumber: 'GPCB-UCN-008009', category: 'ORANGE', sectorCode: 'REFINERY',           districtCode: 'GJ-BRH', talukaName: 'Dahej', gidcZoneName: 'Dahej SEZ/GIDC', baseLat: 21.71, baseLng: 72.56, capacity: { productionTPD: 300 } },
  { name: 'Sun Pharmaceutical – Dahej',              ucNumber: 'GPCB-UCN-008010', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Dahej', gidcZoneName: 'Dahej SEZ/GIDC', baseLat: 21.71, baseLng: 72.56, capacity: { productionTPD: 40 } },
]

// ── Panoli ~6 (Pharma + Chemical Specialty) ───────────────────────────────
const PANOLI: IndustryDef[] = [
  { name: 'Abbott India API – Panoli',               ucNumber: 'GPCB-UCN-009001', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Panoli', gidcZoneName: 'Panoli GIDC', baseLat: 21.65, baseLng: 72.97, capacity: { productionTPD: 20 } },
  { name: 'Astra Zeneca India – Panoli',             ucNumber: 'GPCB-UCN-009002', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Panoli', gidcZoneName: 'Panoli GIDC', baseLat: 21.65, baseLng: 72.97, capacity: { productionTPD: 15 } },
  { name: 'Gharda Chemicals – Panoli',               ucNumber: 'GPCB-UCN-009003', category: 'RED',    sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Panoli', gidcZoneName: 'Panoli GIDC', baseLat: 21.65, baseLng: 72.97, capacity: { productionTPD: 50 } },
  { name: 'Novartis India – Panoli',                 ucNumber: 'GPCB-UCN-009004', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Panoli', gidcZoneName: 'Panoli GIDC', baseLat: 21.65, baseLng: 72.97, capacity: { productionTPD: 18 } },
  { name: 'Panoli Intermediates',                    ucNumber: 'GPCB-UCN-009005', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-BRH', talukaName: 'Panoli', gidcZoneName: 'Panoli GIDC', baseLat: 21.65, baseLng: 72.97, capacity: { productionTPD: 30 } },
  { name: 'Wockhardt Pharma – Panoli',               ucNumber: 'GPCB-UCN-009006', category: 'RED',    sectorCode: 'PHARMA',             districtCode: 'GJ-BRH', talukaName: 'Panoli', gidcZoneName: 'Panoli GIDC', baseLat: 21.65, baseLng: 72.97, capacity: { productionTPD: 12 } },
]

// ── Hazira ~6 (Steel + Power + Refinery) ─────────────────────────────────
const HAZIRA: IndustryDef[] = [
  { name: 'ArcelorMittal Hazira Steel',              ucNumber: 'GPCB-UCN-010001', category: 'RED',    sectorCode: 'STEEL',              districtCode: 'GJ-SRT', talukaName: 'Olpad', gidcZoneName: 'Hazira Industrial Area', baseLat: 21.10, baseLng: 72.62, capacity: { productionTPD: 1000 } },
  { name: 'ESSAR Steel – Hazira',                    ucNumber: 'GPCB-UCN-010002', category: 'RED',    sectorCode: 'STEEL',              districtCode: 'GJ-SRT', talukaName: 'Olpad', gidcZoneName: 'Hazira Industrial Area', baseLat: 21.10, baseLng: 72.62, capacity: { productionTPD: 800 } },
  { name: 'Linde Gas India – Hazira',                ucNumber: 'GPCB-UCN-010003', category: 'GREEN',  sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-SRT', talukaName: 'Olpad', gidcZoneName: 'Hazira Industrial Area', baseLat: 21.10, baseLng: 72.62, capacity: { productionTPD: 50 } },
  { name: 'NTPC Hazira Power',                       ucNumber: 'GPCB-UCN-010004', category: 'RED',    sectorCode: 'POWER',              districtCode: 'GJ-SRT', talukaName: 'Olpad', gidcZoneName: 'Hazira Industrial Area', baseLat: 21.10, baseLng: 72.62, capacity: { productionTPD: 300 } },
  { name: 'Shell Hazira LNG & Port',                 ucNumber: 'GPCB-UCN-010005', category: 'RED',    sectorCode: 'REFINERY',           districtCode: 'GJ-SRT', talukaName: 'Olpad', gidcZoneName: 'Hazira Industrial Area', baseLat: 21.10, baseLng: 72.62, capacity: { productionTPD: 400 } },
  { name: 'Torrent Power – Hazira',                  ucNumber: 'GPCB-UCN-010006', category: 'ORANGE', sectorCode: 'POWER',              districtCode: 'GJ-SRT', talukaName: 'Olpad', gidcZoneName: 'Hazira Industrial Area', baseLat: 21.10, baseLng: 72.62, capacity: { productionTPD: 200 } },
]

// ── Morbi ~10 (Cement/Ceramics) ───────────────────────────────────────────
const MORBI: IndustryDef[] = [
  { name: 'Asian Granito India – Morbi',             ucNumber: 'GPCB-UCN-011001', category: 'ORANGE', sectorCode: 'CEMENT',             districtCode: 'GJ-MRB', talukaName: 'Morbi City', gidcZoneName: 'Morbi Ceramics GIDC', baseLat: 22.82, baseLng: 70.83, capacity: { productionTPD: 1500 } },
  { name: 'Cera Sanitaryware – Morbi',               ucNumber: 'GPCB-UCN-011002', category: 'ORANGE', sectorCode: 'CEMENT',             districtCode: 'GJ-MRB', talukaName: 'Morbi City', gidcZoneName: 'Morbi Ceramics GIDC', baseLat: 22.82, baseLng: 70.83, capacity: { productionTPD: 500 } },
  { name: 'Euro Ceramics – Morbi',                   ucNumber: 'GPCB-UCN-011003', category: 'ORANGE', sectorCode: 'CEMENT',             districtCode: 'GJ-MRB', talukaName: 'Morbi City', gidcZoneName: 'Morbi Ceramics GIDC', baseLat: 22.82, baseLng: 70.83, capacity: { productionTPD: 800 } },
  { name: 'Kajaria Ceramics – Morbi',                ucNumber: 'GPCB-UCN-011004', category: 'ORANGE', sectorCode: 'CEMENT',             districtCode: 'GJ-MRB', talukaName: 'Morbi City', gidcZoneName: 'Morbi Ceramics GIDC', baseLat: 22.82, baseLng: 70.83, capacity: { productionTPD: 2000 } },
  { name: 'Morbi Ceramics Industries',               ucNumber: 'GPCB-UCN-011005', category: 'RED',    sectorCode: 'CEMENT',             districtCode: 'GJ-MRB', talukaName: 'Morbi City', gidcZoneName: 'Morbi Ceramics GIDC', baseLat: 22.82, baseLng: 70.83, capacity: { productionTPD: 600 } },
  { name: 'Nitco Ltd – Morbi',                       ucNumber: 'GPCB-UCN-011006', category: 'ORANGE', sectorCode: 'CEMENT',             districtCode: 'GJ-MRB', talukaName: 'Morbi City', gidcZoneName: 'Morbi Ceramics GIDC', baseLat: 22.82, baseLng: 70.83, capacity: { productionTPD: 700 } },
  { name: 'Orient Bell – Morbi',                     ucNumber: 'GPCB-UCN-011007', category: 'ORANGE', sectorCode: 'CEMENT',             districtCode: 'GJ-MRB', talukaName: 'Morbi City', gidcZoneName: 'Morbi Ceramics GIDC', baseLat: 22.82, baseLng: 70.83, capacity: { productionTPD: 900 } },
  { name: 'Somany Ceramics – Morbi',                 ucNumber: 'GPCB-UCN-011008', category: 'ORANGE', sectorCode: 'CEMENT',             districtCode: 'GJ-MRB', talukaName: 'Morbi City', gidcZoneName: 'Morbi Ceramics GIDC', baseLat: 22.82, baseLng: 70.83, capacity: { productionTPD: 1200 } },
  { name: 'VARMORA Granito – Morbi',                 ucNumber: 'GPCB-UCN-011009', category: 'RED',    sectorCode: 'CEMENT',             districtCode: 'GJ-MRB', talukaName: 'Morbi City', gidcZoneName: 'Morbi Ceramics GIDC', baseLat: 22.82, baseLng: 70.83, capacity: { productionTPD: 1000 } },
  { name: 'Wanbury Ltd – Morbi',                     ucNumber: 'GPCB-UCN-011010', category: 'GREEN',  sectorCode: 'CEMENT',             districtCode: 'GJ-MRB', talukaName: 'Morbi City', gidcZoneName: 'Morbi Ceramics GIDC', baseLat: 22.82, baseLng: 70.83, capacity: { productionTPD: 200 } },
]

// ── Vadodara-GIDC + Halol ~5 ──────────────────────────────────────────────
const VADODARA: IndustryDef[] = [
  { name: 'Alstom T&D India – Vadodara GIDC',        ucNumber: 'GPCB-UCN-012001', category: 'GREEN',  sectorCode: 'AUTO_ENGINEERING',   districtCode: 'GJ-VAD', talukaName: 'Waghodia',  gidcZoneName: 'Vadodara GIDC', baseLat: 22.30, baseLng: 73.20, capacity: { productionTPD: 15 } },
  { name: 'Gujrat Glass Ltd – Halol',                ucNumber: 'GPCB-UCN-012002', category: 'RED',    sectorCode: 'CEMENT',             districtCode: 'GJ-VAD', talukaName: 'Halol',     gidcZoneName: 'Halol GIDC',    baseLat: 22.50, baseLng: 73.47, capacity: { productionTPD: 80 } },
  { name: 'Hindustan Zinc – Halol',                  ucNumber: 'GPCB-UCN-012003', category: 'RED',    sectorCode: 'STEEL',              districtCode: 'GJ-VAD', talukaName: 'Halol',     gidcZoneName: 'Halol GIDC',    baseLat: 22.50, baseLng: 73.47, capacity: { productionTPD: 50 } },
  { name: 'Saraswati Industries – Vadodara GIDC',    ucNumber: 'GPCB-UCN-012004', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-VAD', talukaName: 'Waghodia',  gidcZoneName: 'Vadodara GIDC', baseLat: 22.30, baseLng: 73.20, capacity: { productionTPD: 22 } },
  { name: 'Vadodara Petrochemicals – Vadodara GIDC', ucNumber: 'GPCB-UCN-012005', category: 'RED',    sectorCode: 'REFINERY',           districtCode: 'GJ-VAD', talukaName: 'Savli',     gidcZoneName: 'Vadodara GIDC', baseLat: 22.30, baseLng: 73.20, capacity: { productionTPD: 100 } },
]

// ── Distributed ~10 (assorted zones + sectors) ────────────────────────────
const DISTRIBUTED: IndustryDef[] = [
  { name: 'Adani Power – Mundra',                    ucNumber: 'GPCB-UCN-013001', category: 'RED',    sectorCode: 'POWER',              districtCode: 'GJ-KCH', talukaName: 'Mundra',       gidcZoneName: 'Mundra Port & SEZ',      baseLat: 22.84, baseLng: 69.72, capacity: { productionTPD: 1000 } },
  { name: 'GNFC Bharuch – Bharuch City',             ucNumber: 'GPCB-UCN-013002', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Bharuch City', gidcZoneName: 'Ankleshwar GIDC',        baseLat: 21.72, baseLng: 72.99, capacity: { productionTPD: 180 } },
  { name: 'Gujarat Narmada Valley Fertilisers',      ucNumber: 'GPCB-UCN-013003', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-BRH', talukaName: 'Bharuch City', gidcZoneName: 'Ankleshwar GIDC',        baseLat: 21.71, baseLng: 72.95, capacity: { productionTPD: 220 } },
  { name: 'Kandla Port Chemical Hub',                ucNumber: 'GPCB-UCN-013004', category: 'ORANGE', sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-KCH', talukaName: 'Gandhidham',   gidcZoneName: 'Kandla SEZ/GIDC',        baseLat: 23.03, baseLng: 70.22, capacity: { productionTPD: 150 } },
  { name: 'Nirma Ltd Detergents – Sanand',           ucNumber: 'GPCB-UCN-013005', category: 'ORANGE', sectorCode: 'CHEMICAL_SPECIALTY', districtCode: 'GJ-AHM', talukaName: 'Sanand',       gidcZoneName: 'Sanand-I GIDC',          baseLat: 22.98, baseLng: 72.37, capacity: { productionTPD: 80 } },
  { name: 'Orient Paper – Bharuch',                  ucNumber: 'GPCB-UCN-013006', category: 'RED',    sectorCode: 'PAPER',              districtCode: 'GJ-BRH', talukaName: 'Amod',         gidcZoneName: 'Ankleshwar GIDC',        baseLat: 21.78, baseLng: 72.84, capacity: { productionTPD: 60 } },
  { name: 'Panasonic Energy India – Kalol',          ucNumber: 'GPCB-UCN-013007', category: 'GREEN',  sectorCode: 'AUTO_ENGINEERING',   districtCode: 'GJ-GND', talukaName: 'Kalol',        gidcZoneName: 'Kalol GIDC',             baseLat: 23.25, baseLng: 72.50, capacity: { productionTPD: 20 } },
  { name: 'Patdi Salt Industries – Patdi',           ucNumber: 'GPCB-UCN-013008', category: 'WHITE',  sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-SND', talukaName: 'Patdi',        gidcZoneName: 'Patdi GIDC',             baseLat: 23.29, baseLng: 71.91, capacity: { productionTPD: 10 } },
  { name: 'Tata Chemicals – Mithapur (Okhamandal)',  ucNumber: 'GPCB-UCN-013009', category: 'RED',    sectorCode: 'CHEMICAL_BULK',      districtCode: 'GJ-DDW', talukaName: 'Jamnagar City', gidcZoneName: 'Kandla SEZ/GIDC',        baseLat: 22.46, baseLng: 69.03, capacity: { productionTPD: 200 } },
  { name: 'Welspun Corp – Anjar',                    ucNumber: 'GPCB-UCN-013010', category: 'RED',    sectorCode: 'STEEL',              districtCode: 'GJ-KCH', talukaName: 'Anjar',        gidcZoneName: 'Bhachau-Gandhidham GIDC', baseLat: 23.12, baseLng: 70.03, capacity: { productionTPD: 300 } },
]

// ── Master list ───────────────────────────────────────────────────────────

export const ALL_INDUSTRIES: IndustryDef[] = [
  ...ANKLESHWAR,  // 25
  ...VATVA,       // 20
  ...NARODA,      // 12
  ...SACHIN,      // 15
  ...VAPI,        // 15
  ...PANDESARA,   //  8
  ...JHAGADIA,    //  8
  ...DAHEJ,       // 10
  ...PANOLI,      //  6
  ...HAZIRA,      //  6
  ...MORBI,       // 10
  ...VADODARA,    //  5
  ...DISTRIBUTED, // 10
]
// Total: 150

// ── Seed function ─────────────────────────────────────────────────────────

export async function seedIndustries(prisma: PrismaClient): Promise<void> {
  // Pre-fetch all reference rows once
  const sectors   = await prisma.sector.findMany()
  const districts = await prisma.district.findMany()
  const talukas   = await prisma.taluka.findMany({ include: { district: true } })
  const zones     = await prisma.gidcZone.findMany()

  const sectorByCode   = new Map(sectors.map(s => [s.code, s]))
  const districtByCode = new Map(districts.map(d => [d.code, d]))
  // Taluka key: "<districtCode>|<talukaName>"
  const talukaKey      = (dc: string, tn: string) => `${dc}|${tn}`
  const talukaByKey    = new Map(talukas.map(t => [talukaKey(t.district.code, t.name), t]))
  const zoneByName     = new Map(zones.map(z => [z.name, z]))

  for (const ind of ALL_INDUSTRIES) {
    const sector   = sectorByCode.get(ind.sectorCode)
    const district = districtByCode.get(ind.districtCode)
    const taluka   = talukaByKey.get(talukaKey(ind.districtCode, ind.talukaName))
    const zone     = zoneByName.get(ind.gidcZoneName)

    const lat = ind.baseLat + jitter(ind.ucNumber, 'lat')
    const lng = ind.baseLng + jitter(ind.ucNumber, 'lng')

    await prisma.industry.upsert({
      where:  { ucNumber: ind.ucNumber },
      update: {
        name:                 ind.name,
        category:             ind.category,
        sectorId:             sector?.id,
        districtId:           district?.id,
        talukaId:             taluka?.id,
        gidcZoneId:           zone?.id,
        lat,
        lng,
        capacity:             ind.capacity as Prisma.InputJsonValue,
        classificationScheme: SCHEME,
      },
      create: {
        name:                 ind.name,
        ucNumber:             ind.ucNumber,
        category:             ind.category,
        sectorId:             sector?.id,
        districtId:           district?.id,
        talukaId:             taluka?.id,
        gidcZoneId:           zone?.id,
        lat,
        lng,
        capacity:             ind.capacity as Prisma.InputJsonValue,
        classificationScheme: SCHEME,
      },
    })
  }
}
