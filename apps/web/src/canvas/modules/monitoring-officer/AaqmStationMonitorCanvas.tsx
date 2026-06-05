/**
 * AaqmStationMonitorCanvas — 33-district × 4-param grid coloured by latest readings.
 * Hover shows station + value tooltip.
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { api } from '../../../lib/api.js'

type Param = 'PM10' | 'PM2_5' | 'SO2' | 'NOx'

interface AaqmStation {
  id: string
  district: string
  stationName: string
  PM10: number
  PM2_5: number
  SO2: number
  NOx: number
  updatedAt: string
}

// NAAQS ambient air quality standards (annual average, µg/m³)
const NAAQS: Record<Param, number> = {
  PM10:  60,
  PM2_5: 40,
  SO2:   20,
  NOx:   30,
}

const PARAMS: { key: Param; label: string }[] = [
  { key: 'PM10',  label: 'PM10' },
  { key: 'PM2_5', label: 'PM2.5' },
  { key: 'SO2',   label: 'SO₂' },
  { key: 'NOx',   label: 'NOₓ' },
]

// 33 districts of Gujarat with seeded AAQM data
const DEMO_STATIONS: AaqmStation[] = [
  { id: 'a1',  district: 'Ahmedabad',     stationName: 'AAQM-Ahmedabad-Central',  PM10: 82, PM2_5: 48, SO2: 18, NOx: 35, updatedAt: new Date().toISOString() },
  { id: 'a2',  district: 'Surat',         stationName: 'AAQM-Surat-Ring-Road',    PM10: 74, PM2_5: 42, SO2: 14, NOx: 28, updatedAt: new Date().toISOString() },
  { id: 'a3',  district: 'Vadodara',      stationName: 'AAQM-Vadodara-NRC',       PM10: 68, PM2_5: 39, SO2: 12, NOx: 24, updatedAt: new Date().toISOString() },
  { id: 'a4',  district: 'Rajkot',        stationName: 'AAQM-Rajkot-GPCB',        PM10: 61, PM2_5: 35, SO2: 10, NOx: 22, updatedAt: new Date().toISOString() },
  { id: 'a5',  district: 'Gandhinagar',   stationName: 'AAQM-Gandhinagar-Sec-30', PM10: 52, PM2_5: 28, SO2: 8,  NOx: 18, updatedAt: new Date().toISOString() },
  { id: 'a6',  district: 'Bharuch',       stationName: 'AAQM-Ankleshwar-GIDC',   PM10: 98, PM2_5: 56, SO2: 32, NOx: 48, updatedAt: new Date().toISOString() },
  { id: 'a7',  district: 'Valsad',        stationName: 'AAQM-Vapi-GIDC',          PM10: 88, PM2_5: 52, SO2: 28, NOx: 42, updatedAt: new Date().toISOString() },
  { id: 'a8',  district: 'Anand',         stationName: 'AAQM-Anand-AMUL',         PM10: 48, PM2_5: 25, SO2: 7,  NOx: 16, updatedAt: new Date().toISOString() },
  { id: 'a9',  district: 'Mehsana',       stationName: 'AAQM-Mehsana-GPCB',       PM10: 55, PM2_5: 30, SO2: 9,  NOx: 20, updatedAt: new Date().toISOString() },
  { id: 'a10', district: 'Morbi',         stationName: 'AAQM-Morbi-Ceramics',     PM10: 112, PM2_5: 65, SO2: 15, NOx: 38, updatedAt: new Date().toISOString() },
  { id: 'a11', district: 'Bhavnagar',     stationName: 'AAQM-Alang-Shipyard',     PM10: 95, PM2_5: 55, SO2: 25, NOx: 40, updatedAt: new Date().toISOString() },
  { id: 'a12', district: 'Jamnagar',      stationName: 'AAQM-Jamnagar-Refinery',  PM10: 78, PM2_5: 44, SO2: 22, NOx: 35, updatedAt: new Date().toISOString() },
  { id: 'a13', district: 'Kutch',         stationName: 'AAQM-Mundra-Port',         PM10: 70, PM2_5: 40, SO2: 16, NOx: 30, updatedAt: new Date().toISOString() },
  { id: 'a14', district: 'Navsari',       stationName: 'AAQM-Navsari-GPCB',       PM10: 58, PM2_5: 32, SO2: 10, NOx: 22, updatedAt: new Date().toISOString() },
  { id: 'a15', district: 'Narmada',       stationName: 'AAQM-Rajpipla',            PM10: 42, PM2_5: 22, SO2: 6,  NOx: 14, updatedAt: new Date().toISOString() },
  { id: 'a16', district: 'Panchmahal',    stationName: 'AAQM-Godhra',              PM10: 50, PM2_5: 27, SO2: 8,  NOx: 18, updatedAt: new Date().toISOString() },
  { id: 'a17', district: 'Dahod',         stationName: 'AAQM-Dahod',               PM10: 38, PM2_5: 20, SO2: 5,  NOx: 12, updatedAt: new Date().toISOString() },
  { id: 'a18', district: 'Mahisagar',     stationName: 'AAQM-Lunawada',            PM10: 36, PM2_5: 19, SO2: 5,  NOx: 11, updatedAt: new Date().toISOString() },
  { id: 'a19', district: 'Kheda',         stationName: 'AAQM-Nadiad',              PM10: 54, PM2_5: 30, SO2: 9,  NOx: 20, updatedAt: new Date().toISOString() },
  { id: 'a20', district: 'Sabarkantha',   stationName: 'AAQM-Himmatnagar',         PM10: 44, PM2_5: 24, SO2: 7,  NOx: 15, updatedAt: new Date().toISOString() },
  { id: 'a21', district: 'Aravalli',      stationName: 'AAQM-Modasa',              PM10: 40, PM2_5: 22, SO2: 6,  NOx: 13, updatedAt: new Date().toISOString() },
  { id: 'a22', district: 'Mahendragarh',  stationName: 'AAQM-Bayad',               PM10: 37, PM2_5: 20, SO2: 5,  NOx: 12, updatedAt: new Date().toISOString() },
  { id: 'a23', district: 'Banaskantha',   stationName: 'AAQM-Palanpur',            PM10: 46, PM2_5: 25, SO2: 7,  NOx: 16, updatedAt: new Date().toISOString() },
  { id: 'a24', district: 'Patan',         stationName: 'AAQM-Patan',               PM10: 43, PM2_5: 23, SO2: 7,  NOx: 15, updatedAt: new Date().toISOString() },
  { id: 'a25', district: 'Tapi',          stationName: 'AAQM-Vyara',               PM10: 35, PM2_5: 18, SO2: 5,  NOx: 11, updatedAt: new Date().toISOString() },
  { id: 'a26', district: 'Dang',          stationName: 'AAQM-Ahwa',                PM10: 28, PM2_5: 15, SO2: 4,  NOx: 9,  updatedAt: new Date().toISOString() },
  { id: 'a27', district: 'Surendranagar', stationName: 'AAQM-Wadhwan',             PM10: 52, PM2_5: 29, SO2: 8,  NOx: 19, updatedAt: new Date().toISOString() },
  { id: 'a28', district: 'Botad',         stationName: 'AAQM-Botad',               PM10: 48, PM2_5: 26, SO2: 7,  NOx: 17, updatedAt: new Date().toISOString() },
  { id: 'a29', district: 'Gir Somnath',   stationName: 'AAQM-Veraval',             PM10: 45, PM2_5: 24, SO2: 7,  NOx: 15, updatedAt: new Date().toISOString() },
  { id: 'a30', district: 'Amreli',        stationName: 'AAQM-Amreli',              PM10: 42, PM2_5: 22, SO2: 6,  NOx: 14, updatedAt: new Date().toISOString() },
  { id: 'a31', district: 'Devbhumi Dwarka', stationName: 'AAQM-Khambhalia',        PM10: 38, PM2_5: 20, SO2: 6,  NOx: 13, updatedAt: new Date().toISOString() },
  { id: 'a32', district: 'Porbandar',     stationName: 'AAQM-Porbandar',           PM10: 40, PM2_5: 21, SO2: 7,  NOx: 14, updatedAt: new Date().toISOString() },
  { id: 'a33', district: 'Chhota Udaipur', stationName: 'AAQM-Chhota Udaipur',    PM10: 32, PM2_5: 17, SO2: 5,  NOx: 10, updatedAt: new Date().toISOString() },
]

function getCellStyle(value: number, norm: number): string {
  const r = value / norm
  if (r >= 1.2) return 'bg-danger text-white'
  if (r >= 1.0) return 'bg-danger-light text-danger font-semibold'
  if (r >= 0.8) return 'bg-warn-light text-warn font-semibold'
  return 'bg-ok-light/50 text-ok'
}

export function AaqmStationMonitorCanvas() {
  const { token } = useAuth()
  const [stations, setStations] = useState<AaqmStation[]>(DEMO_STATIONS)
  const [loading, setLoading] = useState(false)
  const [hover, setHover] = useState<{ stationName: string; param: string; value: number; unit: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<AaqmStation[]>('/api/sensors/stations?type=AAQM', { token: token ?? undefined })
      if (data.length > 0) setStations(data)
    } catch {
      setStations(DEMO_STATIONS)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  const exceedCount = stations.filter(s =>
    PARAMS.some(p => s[p.key] >= NAAQS[p.key])
  ).length

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-bdr-light flex-shrink-0">
        <div>
          <h2 className="text-[16px] font-bold text-txt-primary">AAQM Station Monitor</h2>
          <p className="text-[12px] text-txt-secondary mt-0.5">33 districts × 4 parameters · coloured by NAAQS compliance</p>
        </div>
        <div className="flex items-center gap-3">
          {exceedCount > 0 && (
            <span className="badge badge-danger">{exceedCount} stations exceeding</span>
          )}
          <button onClick={() => { void load() }} className="p-2 rounded-lg hover:bg-surface-secondary text-txt-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-2 bg-white border-b border-bdr-light text-[11px] flex-shrink-0">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-ok-light inline-block" /> Within norm</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-warn-light inline-block" /> 80–100% of norm</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-danger-light inline-block" /> Exceeds norm</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-danger inline-block" /> &gt;120% norm</div>
        <span className="text-txt-tertiary ml-auto">Hover cell for detail · NAAQS annual standards</span>
      </div>

      {/* Hover tooltip */}
      {hover && (
        <div className="px-6 py-2 bg-primary-light border-b border-primary/20 text-[12px] text-primary flex-shrink-0 animate-slide-in">
          <strong>{hover.stationName}</strong> — {hover.param}: <strong>{hover.value} µg/m³</strong>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-card border border-bdr-light shadow-card overflow-hidden">
          <table className="min-w-full text-[12px]">
            <thead className="bg-surface-secondary sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-txt-secondary w-36">District</th>
                {PARAMS.map(p => (
                  <th key={p.key} className="px-4 py-2.5 text-center text-[11px] font-semibold text-txt-secondary">
                    <div>{p.label}</div>
                    <div className="text-txt-tertiary font-normal">≤ {NAAQS[p.key]} µg/m³</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr-light">
              {stations.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-surface-secondary/20'}>
                  <td className="px-4 py-2 font-medium text-txt-primary text-[11px]">{s.district}</td>
                  {PARAMS.map(p => {
                    const val = s[p.key]
                    const norm = NAAQS[p.key]
                    return (
                      <td
                        key={p.key}
                        className={`px-4 py-2 text-center cursor-default rounded-sm transition-all ${getCellStyle(val, norm)}`}
                        onMouseEnter={() => setHover({ stationName: s.stationName, param: p.label, value: val, unit: 'µg/m³' })}
                        onMouseLeave={() => setHover(null)}
                      >
                        {val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
