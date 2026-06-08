/**
 * GujaratHeatmap — Real geographic map of Gujarat districts using Leaflet + OpenStreetMap.
 *
 * Replaces the previous 7×7 grid with actual lat/lng centroids and CircleMarkers
 * sized + coloured by criticality score.
 *
 * Data source: GET /api/stats/war-room/heatmap
 *   { districts: [{ districtId, districtName, criticality, breakdown }], generatedAt }
 */

import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import { RefreshCw } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistrictBreakdown {
  criticalCount: number
  majorCount: number
  anomalyCount: number
  openComplaints: number
  activeExceedances: number
}

interface DistrictScore {
  districtId: string
  districtName: string
  criticality: number   // 0–100
  breakdown: DistrictBreakdown
}

interface HeatmapResponse {
  districts: DistrictScore[]
  generatedAt: string
}

// ─── District centroids ────────────────────────────────────────────────────────
// All 33 Gujarat districts with canonical lat/lng centroids.

interface DistrictCentroid {
  lat: number
  lng: number
  name: string
}

const DISTRICT_CENTROIDS: DistrictCentroid[] = [
  { name: 'Ahmedabad',        lat: 23.0225, lng: 72.5714 },
  { name: 'Amreli',           lat: 21.6010, lng: 71.2204 },
  { name: 'Anand',            lat: 22.5645, lng: 72.9289 },
  { name: 'Aravalli',         lat: 23.5670, lng: 73.0270 },
  { name: 'Banaskantha',      lat: 24.1719, lng: 72.4380 },
  { name: 'Bharuch',          lat: 21.7051, lng: 72.9959 },
  { name: 'Bhavnagar',        lat: 21.7645, lng: 72.1519 },
  { name: 'Botad',            lat: 22.1704, lng: 71.6685 },
  { name: 'Chhota Udaipur',   lat: 22.3000, lng: 74.0167 },
  { name: 'Dahod',            lat: 22.8351, lng: 74.2616 },
  { name: 'Dang',             lat: 20.7549, lng: 73.6868 },
  { name: 'Devbhoomi Dwarka', lat: 22.2394, lng: 68.9678 },
  { name: 'Gandhinagar',      lat: 23.2156, lng: 72.6369 },
  { name: 'Gir Somnath',      lat: 20.9159, lng: 70.3629 },
  { name: 'Jamnagar',         lat: 22.4707, lng: 70.0577 },
  { name: 'Junagadh',         lat: 21.5222, lng: 70.4579 },
  { name: 'Kheda',            lat: 22.7510, lng: 72.6850 },
  { name: 'Kutch',            lat: 23.7337, lng: 69.8597 },
  { name: 'Mahisagar',        lat: 23.0118, lng: 73.5520 },
  { name: 'Mehsana',          lat: 23.5879, lng: 72.3693 },
  { name: 'Morbi',            lat: 22.8170, lng: 70.8378 },
  { name: 'Narmada',          lat: 21.8700, lng: 73.5000 },
  { name: 'Navsari',          lat: 20.9467, lng: 72.9520 },
  { name: 'Panchmahal',       lat: 22.7790, lng: 73.6143 },
  { name: 'Patan',            lat: 23.8493, lng: 72.1266 },
  { name: 'Porbandar',        lat: 21.6417, lng: 69.6293 },
  { name: 'Rajkot',           lat: 22.3039, lng: 70.8022 },
  { name: 'Sabarkantha',      lat: 23.5970, lng: 73.0117 },
  { name: 'Surat',            lat: 21.1702, lng: 72.8311 },
  { name: 'Surendranagar',    lat: 22.7300, lng: 71.6300 },
  { name: 'Tapi',             lat: 21.1153, lng: 73.4101 },
  { name: 'Vadodara',         lat: 22.3072, lng: 73.1812 },
  { name: 'Valsad',           lat: 20.6101, lng: 72.9342 },
]

/**
 * Normalise a district name for fuzzy matching.
 * Lower-cases, strips spaces, and maps common aliases so "Kutch"/"Kachchh",
 * "Dwarka"/"Devbhoomi Dwarka", etc. all resolve correctly.
 */
function normaliseDistrictName(name: string): string {
  const n = name.toLowerCase().replace(/\s+/g, '')
  // Canonical alias map
  const aliases: Record<string, string> = {
    kachchh: 'kutch',
    dwarka: 'devbhoomidwarka',
    devbhoomidwarka: 'devbhoomidwarka',
    girnationalpark: 'girsomnath',
    chhhotaudaipur: 'chhotaudaipur',
    chhotaudaipur: 'chhotaudaipur',
  }
  return aliases[n] ?? n
}

// Pre-build a lookup map: normalised name → centroid
const CENTROID_MAP = new Map<string, DistrictCentroid>()
for (const c of DISTRICT_CENTROIDS) {
  CENTROID_MAP.set(normaliseDistrictName(c.name), c)
}

// ─── Visual helpers ────────────────────────────────────────────────────────────

function radiusFor(criticality: number): number {
  return 10 + criticality * 0.4
}

function colorFor(criticality: number): string {
  if (criticality === 0) return '#94A3B8'   // slate-400 — muted / no data
  if (criticality <= 25)  return '#10B981'  // emerald-500
  if (criticality <= 50)  return '#F59E0B'  // amber-500
  if (criticality <= 75)  return '#EF4444'  // red-500
  return '#B91C1C'                           // red-700 — severe
}

// ─── Legend ────────────────────────────────────────────────────────────────────

function MapLegend() {
  const items = [
    { color: '#94A3B8', label: 'No data' },
    { color: '#10B981', label: '1–25' },
    { color: '#F59E0B', label: '26–50' },
    { color: '#EF4444', label: '51–75' },
    { color: '#B91C1C', label: '76+' },
  ]
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        right: 12,
        zIndex: 1000,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
        fontFamily: 'Montserrat, sans-serif',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', color: '#94A3B8', marginBottom: 6 }}>
        Criticality
      </div>
      {items.map(({ color, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: '#475569' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GujaratHeatmapProps {
  /** If provided, the component uses this score map instead of fetching */
  scoreMap?: Map<string, DistrictScore>
  /** Show loading state */
  externalLoading?: boolean
  /** Called when user clicks a district marker */
  onDistrictClick?: (districtId: string) => void
}

export function GujaratHeatmap({ scoreMap: externalMap, externalLoading, onDistrictClick }: GujaratHeatmapProps = {}) {
  const { token } = useAuth()
  const [scores, setScores] = useState<Map<string, DistrictScore>>(new Map())
  const [loading, setLoading] = useState(true)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  // SSR-safety: only mount MapContainer after first client render
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api<HeatmapResponse>('/api/stats/war-room/heatmap', { token })
      const map = new Map<string, DistrictScore>()
      for (const d of res.districts) {
        map.set(normaliseDistrictName(d.districtName), d)
        map.set(d.districtId, d)
      }
      setScores(map)
      setGeneratedAt(res.generatedAt)
    } catch {
      // Silently fail — show empty heatmap (circles at 0 / grey)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (externalMap !== undefined) {
      setScores(externalMap)
      setLoading(false)
    } else {
      void load()
    }
  }, [externalMap, load])

  const activeLoading = externalLoading ?? loading

  return (
    <div className="bg-white rounded-2xl border border-bdr-light shadow-card p-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[3px] text-txt-tertiary">
            District Criticality Heatmap
          </div>
          {generatedAt && (
            <div className="text-[10px] text-txt-tertiary mt-0.5">
              Updated {new Date(generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
          )}
        </div>
        {activeLoading && <RefreshCw className="w-3.5 h-3.5 text-txt-tertiary animate-spin" />}
      </div>

      {/* Map container */}
      <div style={{ height: 500, width: '100%', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
        {mounted && (
          <MapContainer
            center={[22.5, 71.5]}
            zoom={7}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%' }}
            attributionControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {DISTRICT_CENTROIDS.map((centroid) => {
              const key = normaliseDistrictName(centroid.name)
              const score = scores.get(key)
              const criticality = score?.criticality ?? 0
              const color = colorFor(criticality)
              const radius = radiusFor(criticality)
              const b = score?.breakdown

              return (
                <CircleMarker
                  key={centroid.name}
                  center={[centroid.lat, centroid.lng]}
                  radius={radius}
                  pathOptions={{
                    fillColor: color,
                    color: color,
                    fillOpacity: 0.65,
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: () => {
                      if (score && onDistrictClick) {
                        onDistrictClick(score.districtId)
                      }
                    },
                  }}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -radius]}
                    opacity={1}
                  >
                    <div style={{ fontFamily: 'Montserrat, sans-serif', minWidth: 160 }}>
                      <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 2 }}>{centroid.name}</div>
                      <div style={{ fontSize: 11, color: criticality > 50 ? '#EF4444' : criticality > 25 ? '#F59E0B' : '#10B981', fontWeight: 700, marginBottom: 4 }}>
                        Criticality: {Math.round(criticality)}
                      </div>
                      {b && (
                        <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.6 }}>
                          <div>Critical: {b.criticalCount} &nbsp; Major: {b.majorCount}</div>
                          <div>Anomalies: {b.anomalyCount}</div>
                          <div>Complaints: {b.openComplaints} &nbsp; Exceedances: {b.activeExceedances}</div>
                        </div>
                      )}
                    </div>
                  </Tooltip>

                  {/* Permanent district name label — only for high-criticality districts to reduce clutter */}
                  {criticality >= 20 && (
                    <Tooltip
                      permanent
                      direction="center"
                      opacity={0.9}
                      className="leaflet-district-label"
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                        {centroid.name}
                      </span>
                    </Tooltip>
                  )}
                </CircleMarker>
              )
            })}
          </MapContainer>
        )}

        {/* Legend — absolutely positioned over the map */}
        {mounted && <MapLegend />}

        {/* Loading overlay */}
        {activeLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.55)',
              zIndex: 2000,
              borderRadius: 12,
            }}
          >
            <RefreshCw className="w-6 h-6 text-txt-tertiary animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
