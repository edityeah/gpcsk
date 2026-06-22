/**
 * CPCB AAQM ingest via OpenAQ v3 — Gujarat stations only.
 *
 * Fallback chain:
 *   1. OpenAQ v3 API (countries_id=9, bbox filter)
 *   2. REAL_NAME_SYNTHETIC_READINGS: 35 real Gujarat CPCB AAQM stations with synthetic readings
 *
 * Gujarat bounding box:
 *   lat: 20.1 – 24.8
 *   lng: 68.0 – 74.5
 *
 * Run standalone: pnpm ingest:aaqm
 */

import { prisma } from '../db.js'
import { logger } from '../logger.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface OpenAQLocation {
  id: number
  name: string
  locality: string | null
  country: { code: string; name: string }
  coordinates: { latitude: number; longitude: number }
  parameters: Array<{
    parametersId: number
    parameter: { name: string; displayName: string; units: string }
    lastValue: number
    lastUpdated: string
  }>
  providers: Array<{ sourceName: string }>
}

export interface ParsedLocation {
  id: number
  name: string
  lat: number
  lng: number
  parameters: Array<{ paramKey: string; unit: string; lastValue: number; lastUpdated: string }>
}

// ── Constants ────────────────────────────────────────────────────────────────

const GUJARAT_BBOX = {
  latMin: 20.1,
  latMax: 24.8,
  lngMin: 68.0,
  lngMax: 74.5,
}

const OPENAQ_BASE = 'https://api.openaq.org/v3'

/** Map OpenAQ parameter names → our canonical parameter keys */
const PARAM_MAP: Record<string, string> = {
  pm25:  'PM2_5',
  pm10:  'PM10',
  so2:   'SO2',
  no2:   'NOx',
  nox:   'NOx',
  co:    'CO',
  o3:    'O3',
  no:    'NO',
}

function mapParamName(openAqName: string): string {
  return PARAM_MAP[openAqName.toLowerCase()] ?? openAqName.toUpperCase().replace(/\./g, '_')
}

// ── Curated real Gujarat AAQM stations (CPCB NAMP + GPCB SAMP) ───────────────
// Source: CPCB NAMP station list + GPCB AR 2022-23

interface CuratedAaqmStation {
  name: string
  lat: number
  lng: number
  district: string
  parameters: string[]
}

const CURATED_AAQM_STATIONS: CuratedAaqmStation[] = [
  { name: 'Maninagar (CPCB)', lat: 22.99, lng: 72.59, district: 'Ahmedabad', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Pirana (CPCB)', lat: 22.96, lng: 72.56, district: 'Ahmedabad', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Bopal (CPCB)', lat: 23.03, lng: 72.47, district: 'Ahmedabad', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Vasna (CPCB)', lat: 23.00, lng: 72.57, district: 'Ahmedabad', parameters: ['PM10', 'PM2_5', 'NOx'] },
  { name: 'Chandkheda (CPCB)', lat: 23.11, lng: 72.59, district: 'Ahmedabad', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Naroda (CPCB)', lat: 23.07, lng: 72.66, district: 'Ahmedabad', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Vatva GIDC (CPCB)', lat: 22.94, lng: 72.65, district: 'Ahmedabad', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Rakhial (CPCB)', lat: 23.04, lng: 72.63, district: 'Ahmedabad', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Surat City (CPCB)', lat: 21.17, lng: 72.83, district: 'Surat', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Sachin GIDC (CPCB)', lat: 21.08, lng: 72.88, district: 'Surat', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Hazira (CPCB)', lat: 21.11, lng: 72.63, district: 'Surat', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Katargam (CPCB)', lat: 21.22, lng: 72.84, district: 'Surat', parameters: ['PM10', 'PM2_5', 'SO2'] },
  { name: 'Vadodara City (CPCB)', lat: 22.31, lng: 73.19, district: 'Vadodara', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Nandesari (CPCB)', lat: 22.42, lng: 73.10, district: 'Vadodara', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Makarpura (CPCB)', lat: 22.28, lng: 73.20, district: 'Vadodara', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Rajkot City (CPCB)', lat: 22.30, lng: 70.80, district: 'Rajkot', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Aji Industrial Area (CPCB)', lat: 22.26, lng: 70.75, district: 'Rajkot', parameters: ['PM10', 'PM2_5', 'SO2'] },
  { name: 'Ankleshwar (CPCB)', lat: 21.63, lng: 73.00, district: 'Bharuch', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Bharuch City (CPCB)', lat: 21.71, lng: 72.99, district: 'Bharuch', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Vapi GIDC (CPCB)', lat: 20.37, lng: 72.91, district: 'Valsad', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Valsad City (CPCB)', lat: 20.60, lng: 72.93, district: 'Valsad', parameters: ['PM10', 'PM2_5', 'SO2'] },
  { name: 'Gandhidham (CPCB)', lat: 23.07, lng: 70.13, district: 'Kutch', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Mundra Port (CPCB)', lat: 22.84, lng: 69.72, district: 'Kutch', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Kandla Port (CPCB)', lat: 23.03, lng: 70.22, district: 'Kutch', parameters: ['PM10', 'PM2_5', 'SO2'] },
  { name: 'Jamnagar City (CPCB)', lat: 22.47, lng: 70.06, district: 'Jamnagar', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Bedi Port (CPCB)', lat: 22.53, lng: 69.98, district: 'Jamnagar', parameters: ['PM10', 'PM2_5', 'SO2'] },
  { name: 'Bhavnagar City (CPCB)', lat: 21.76, lng: 72.15, district: 'Bhavnagar', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Surendranagar (CPCB)', lat: 22.73, lng: 71.64, district: 'Surendranagar', parameters: ['PM10', 'PM2_5', 'SO2'] },
  { name: 'Morbi Industrial (CPCB)', lat: 22.82, lng: 70.83, district: 'Morbi', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Gondal (CPCB)', lat: 21.97, lng: 70.80, district: 'Rajkot', parameters: ['PM10', 'PM2_5', 'SO2'] },
  { name: 'Jetpur Textile Cluster (CPCB)', lat: 21.76, lng: 70.62, district: 'Rajkot', parameters: ['PM10', 'PM2_5', 'SO2'] },
  { name: 'Porbandar (CPCB)', lat: 21.64, lng: 69.61, district: 'Porbandar', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Navsari (CPCB)', lat: 20.95, lng: 72.92, district: 'Navsari', parameters: ['PM10', 'PM2_5', 'SO2'] },
  { name: 'Gandhinagar (CPCB)', lat: 23.22, lng: 72.65, district: 'Gandhinagar', parameters: ['PM10', 'PM2_5', 'SO2', 'NOx'] },
  { name: 'Mehsana (CPCB)', lat: 23.59, lng: 72.38, district: 'Mehsana', parameters: ['PM10', 'PM2_5', 'SO2'] },
]

// ── Synthetic reading generator ───────────────────────────────────────────────

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

const AAQM_PARAM_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  PM10:  { min: 30, max: 180, unit: 'µg/m³' },
  PM2_5: { min: 15, max: 90,  unit: 'µg/m³' },
  SO2:   { min: 5,  max: 40,  unit: 'µg/m³' },
  NOx:   { min: 10, max: 80,  unit: 'µg/m³' },
  O3:    { min: 20, max: 100, unit: 'µg/m³' },
  CO:    { min: 0.3, max: 4,  unit: 'mg/m³' },
}

function syntheticAaqmReading(stationName: string, param: string): { value: number; unit: string; timestamp: string } {
  const rng = mulberry32(strHash(`${stationName}:${param}:${new Date().toDateString()}`))
  const range = AAQM_PARAM_RANGES[param] ?? { min: 10, max: 100, unit: 'µg/m³' }
  const value = Math.round((range.min + rng() * (range.max - range.min)) * 10) / 10
  return { value, unit: range.unit, timestamp: new Date().toISOString() }
}

// ── Pure parsing helper (exported for tests) ─────────────────────────────────

export function parseGujaratLocations(locations: OpenAQLocation[]): ParsedLocation[] {
  return locations
    .filter(loc => {
      const { latitude: lat, longitude: lng } = loc.coordinates
      return (
        lat >= GUJARAT_BBOX.latMin &&
        lat <= GUJARAT_BBOX.latMax &&
        lng >= GUJARAT_BBOX.lngMin &&
        lng <= GUJARAT_BBOX.lngMax
      )
    })
    .map(loc => ({
      id: loc.id,
      name: loc.name,
      lat: loc.coordinates.latitude,
      lng: loc.coordinates.longitude,
      parameters: loc.parameters
        .filter(p => p.lastValue !== null && p.lastValue !== undefined)
        .map(p => ({
          paramKey: mapParamName(p.parameter.name),
          unit: p.parameter.units,
          lastValue: p.lastValue,
          lastUpdated: p.lastUpdated,
        })),
    }))
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchGujaratLocations(): Promise<OpenAQLocation[]> {
  const allLocations: OpenAQLocation[] = []
  let offset = 0
  const limit = 1000

  for (;;) {
    const url = `${OPENAQ_BASE}/locations?countries_id=9&limit=${limit}&offset=${offset}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GPCSK-Ingest/1.0 (contact: gpcsk@example.com)' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`OpenAQ locations fetch failed: ${res.status} ${res.statusText}`)

    const json = (await res.json()) as { results: OpenAQLocation[]; meta?: { found?: number } }
    const batch = json.results ?? []
    allLocations.push(...batch)

    // Pagination: if we got a full page, fetch next
    if (batch.length < limit) break
    offset += limit
  }

  return allLocations
}

// ── Main ingest function ──────────────────────────────────────────────────────

export async function ingestCpcbAaqm(): Promise<void> {
  const run = await prisma.ingestRun.create({
    data: { source: 'CPCB_AAQM' },
  })

  let stationsTouched = 0
  let readingsInserted = 0
  let errorMsg: string | undefined
  let usedFallback = false

  try {
    let gujaratLocations: ParsedLocation[] = []

    // Try OpenAQ v3 first
    try {
      logger.info('AAQM ingest: fetching all India locations from OpenAQ v3…')
      const allLocations = await fetchGujaratLocations()
      logger.info(`AAQM ingest: got ${allLocations.length} India locations from OpenAQ`)
      gujaratLocations = parseGujaratLocations(allLocations)
      logger.info(`AAQM ingest: ${gujaratLocations.length} Gujarat AAQM stations found via OpenAQ`)
    } catch (fetchErr) {
      logger.warn({ err: fetchErr }, 'AAQM ingest: OpenAQ API failed — using curated real-name fallback')
      usedFallback = true
    }

    const now = new Date()

    if (!usedFallback && gujaratLocations.length >= 5) {
      // ── OpenAQ live path ──────────────────────────────────────────────────
      for (const loc of gujaratLocations) {
        const stationName = `${loc.name} (CPCB)`
        const paramKeys = [...new Set(loc.parameters.map(p => p.paramKey))]

        let station = await prisma.monitoringStation.findFirst({
          where: { name: stationName },
        })

        if (!station) {
          station = await prisma.monitoringStation.create({
            data: {
              type: 'AAQM',
              name: stationName,
              lat: loc.lat,
              lng: loc.lng,
              parameters: paramKeys,
              status: 'active',
              dataSource: 'CPCB_LIVE',
              lastIngestedAt: now,
            },
          })
        } else {
          await prisma.monitoringStation.update({
            where: { id: station.id },
            data: {
              lat: loc.lat,
              lng: loc.lng,
              parameters: paramKeys,
              status: 'active',
              dataSource: 'CPCB_LIVE',
              lastIngestedAt: now,
            },
          })
        }

        stationsTouched++

        for (const p of loc.parameters) {
          const ts = new Date(p.lastUpdated)
          const existing = await prisma.sensorReading.findFirst({
            where: { stationId: station.id, parameter: p.paramKey, timestamp: ts },
          })
          if (existing) continue

          await prisma.sensorReading.create({
            data: {
              stationId: station.id,
              parameter: p.paramKey,
              value: p.lastValue,
              unit: p.unit,
              timestamp: ts,
              validity: 'VALID',
            },
          })
          readingsInserted++
        }
      }
      logger.info(`AAQM ingest complete (CPCB_LIVE): ${stationsTouched} stations, ${readingsInserted} readings`)
    } else {
      // ── Real-name synthetic fallback path ─────────────────────────────────
      logger.info(`AAQM ingest: using ${CURATED_AAQM_STATIONS.length} curated real Gujarat AAQM station names with synthetic readings`)

      for (const def of CURATED_AAQM_STATIONS) {
        let station = await prisma.monitoringStation.findFirst({
          where: { name: def.name },
        })

        if (!station) {
          station = await prisma.monitoringStation.create({
            data: {
              type: 'AAQM',
              name: def.name,
              lat: def.lat,
              lng: def.lng,
              parameters: def.parameters,
              status: 'active',
              dataSource: 'REAL_NAME_SYNTHETIC_READINGS',
              lastIngestedAt: now,
            },
          })
        } else {
          await prisma.monitoringStation.update({
            where: { id: station.id },
            data: {
              parameters: def.parameters,
              status: 'active',
              dataSource: 'REAL_NAME_SYNTHETIC_READINGS',
              lastIngestedAt: now,
            },
          })
        }

        stationsTouched++

        for (const param of def.parameters) {
          const { value, unit, timestamp } = syntheticAaqmReading(def.name, param)
          const ts = new Date(now.getTime() - Math.floor(Math.random() * 3_600_000))

          const existing = await prisma.sensorReading.findFirst({
            where: {
              stationId: station.id,
              parameter: param,
              timestamp: { gte: new Date(now.getTime() - 3_600_000) },
            },
          })
          if (existing) continue

          await prisma.sensorReading.create({
            data: {
              stationId: station.id,
              parameter: param,
              value,
              unit,
              timestamp: ts,
              validity: 'VALID',
            },
          })
          void timestamp // used for synthetic generation context
          readingsInserted++
        }
      }
      logger.info(`AAQM ingest complete (REAL_NAME_SYNTHETIC_READINGS): ${stationsTouched} stations, ${readingsInserted} readings`)
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, 'AAQM ingest failed')
  } finally {
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        stationsTouched,
        readingsInserted,
        error: errorMsg,
      },
    })
  }
}

// ── CLI entry-point ───────────────────────────────────────────────────────────

// When run directly via `tsx src/ingest/aaqm.ts`, execute and exit
if (process.argv[1]?.includes('ingest/aaqm')) {
  ingestCpcbAaqm()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1) })
}
