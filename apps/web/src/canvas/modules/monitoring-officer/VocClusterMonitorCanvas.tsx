/**
 * VocClusterMonitorCanvas — table of VOC clusters with current readings vs CPCB limits.
 * Prefers /api/sensors/voc-clusters; falls back to /api/sensors/stations/latest?type=VOC.
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ArrowUpDown } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'
import { api } from '../../../lib/api.js'

// Real API shape from /api/sensors/stations/latest?type=VOC
interface ApiReading {
  parameter: string
  value: number
  unit: string
  norm: number | null
  normUnit: string | null
  timestamp: string
  validity: string
}

interface ApiVocStation {
  id: string
  name: string
  status: string
  type: string
  industry: { id: string; name: string; district?: { id: string; name: string } | null } | null
  district: { id: string; name: string } | null
  readings: ApiReading[]
}

interface ApiResponse {
  stations: ApiVocStation[]
}

// Internal display row
interface VocCluster {
  id: string
  name: string
  districtName: string
  benzene: number | null
  toluene: number | null
  xylene: number | null
  updatedAt: string
  status: 'critical' | 'warn' | 'ok' | 'unknown'
}

// CPCB limits (µg/m³)
const CPCB_LIMITS: Record<string, number> = {
  BENZENE:      5,
  TOLUENE:      200,
  XYLENE:       200,
  ETHYLBENZENE: 200,
  FORMALDEHYDE: 100,
  ACETALDEHYDE: 400,
}

type SortKey = 'name' | 'benzene' | 'toluene' | 'status'

function statusBadge(status: VocCluster['status']) {
  if (status === 'critical') return <span className="badge badge-danger">Critical</span>
  if (status === 'warn') return <span className="badge badge-warn">Near limit</span>
  if (status === 'ok') return <span className="badge badge-ok">Within norm</span>
  return <span className="badge badge-info">No data</span>
}

function cellColour(value: number | null, limit: number): string {
  if (value === null) return 'text-txt-tertiary'
  if (value >= limit) return 'text-danger font-bold'
  if (value >= limit * 0.8) return 'text-warn font-semibold'
  return 'text-txt-primary'
}

function getReading(readings: ApiReading[], param: string): number | null {
  const found = readings.find(r => r.parameter === param)
  return found?.value ?? null
}

function deriveStatus(readings: ApiReading[]): VocCluster['status'] {
  let critical = false
  let warn = false
  for (const r of readings) {
    const limit = CPCB_LIMITS[r.parameter]
    if (limit === undefined) continue
    if (r.value >= limit) critical = true
    else if (r.value >= limit * 0.8) warn = true
  }
  if (critical) return 'critical'
  if (warn) return 'warn'
  if (readings.length > 0) return 'ok'
  return 'unknown'
}

export function VocClusterMonitorCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()
  const [clusters, setClusters] = useState<VocCluster[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      // Prefer the dedicated VOC clusters endpoint; fall back to stations/latest
      let raw: ApiVocStation[] = []
      try {
        const res = await api<ApiResponse | ApiVocStation[]>('/api/sensors/voc-clusters', { token })
        raw = Array.isArray(res) ? (res as ApiVocStation[]) : ((res as ApiResponse).stations ?? [])
      } catch {
        const res = await api<ApiResponse | ApiVocStation[]>(
          '/api/sensors/stations/latest?type=VOC',
          { token },
        )
        raw = Array.isArray(res)
          ? (res as ApiVocStation[])
          : ((res as ApiResponse).stations ?? [])
      }

      const mapped: VocCluster[] = raw.map(s => ({
        id: s.id,
        name: s.name,
        districtName: s.district?.name ?? s.industry?.district?.name ?? '',
        benzene: getReading(s.readings, 'BENZENE'),
        toluene: getReading(s.readings, 'TOLUENE'),
        xylene:  getReading(s.readings, 'XYLENE'),
        updatedAt: s.readings[0]?.timestamp ?? new Date().toISOString(),
        status: deriveStatus(s.readings),
      }))
      setClusters(mapped)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load VOC cluster data.' })
      setClusters([])
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => { void load() }, [load])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const displayed = clusters
    .filter(c =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.districtName.toLowerCase().includes(filter.toLowerCase()),
    )
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'benzene') cmp = (a.benzene ?? -1) - (b.benzene ?? -1)
      else if (sortKey === 'toluene') cmp = (a.toluene ?? -1) - (b.toluene ?? -1)
      else if (sortKey === 'status') {
        const order: Record<string, number> = { critical: 0, warn: 1, ok: 2, unknown: 3 }
        cmp = (order[a.status] ?? 3) - (order[b.status] ?? 3)
      }
      return sortAsc ? cmp : -cmp
    })

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => handleSort(k)}
      className="flex items-center gap-1 text-[11px] font-semibold text-txt-secondary hover:text-primary"
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  )

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-bdr-light flex-shrink-0">
        <div>
          <h2 className="text-[16px] font-bold text-txt-primary">VOC Cluster Monitor</h2>
          <p className="text-[12px] text-txt-secondary mt-0.5">
            {loading ? 'Loading…' : `${clusters.length} VOC stations — current readings vs CPCB limits (µg/m³)`}
          </p>
        </div>
        <button onClick={() => { void load() }} className="p-2 rounded-lg hover:bg-surface-secondary text-txt-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter + summary */}
      <div className="px-6 py-3 bg-white border-b border-bdr-light flex items-center gap-4 flex-shrink-0">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by cluster or district…"
          className="flex-1 max-w-xs px-3 py-1.5 rounded-xl border border-bdr text-[13px] outline-none focus:border-primary bg-surface-secondary"
        />
        <div className="text-[12px] text-txt-secondary">
          <span className="text-danger font-semibold">{clusters.filter(c => c.status === 'critical').length}</span> critical &nbsp;·&nbsp;
          <span className="text-warn font-semibold">{clusters.filter(c => c.status === 'warn').length}</span> near limit &nbsp;·&nbsp;
          <span className="text-ok font-semibold">{clusters.filter(c => c.status === 'ok').length}</span> within norm
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-txt-tertiary text-[14px]">
            Loading VOC data…
          </div>
        ) : clusters.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-txt-tertiary text-[14px]">
            No VOC stations found.
          </div>
        ) : (
          <table className="min-w-full text-[12px]">
            <thead className="bg-surface-secondary sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left"><SortBtn label="Cluster" k="name" /></th>
                <th className="px-3 py-3 text-left text-[11px] text-txt-tertiary font-medium">District</th>
                <th className="px-3 py-3 text-right"><SortBtn label={`Benzene (lim ${CPCB_LIMITS.BENZENE})`} k="benzene" /></th>
                <th className="px-3 py-3 text-right"><SortBtn label={`Toluene (lim ${CPCB_LIMITS.TOLUENE})`} k="toluene" /></th>
                <th className="px-3 py-3 text-right text-[11px] text-txt-tertiary font-medium">Xylene (lim {CPCB_LIMITS.XYLENE})</th>
                <th className="px-3 py-3 text-center"><SortBtn label="Status" k="status" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr-light">
              {displayed.map((c, i) => (
                <tr key={c.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-surface-secondary/40'} hover:bg-primary-light/20 transition-colors`}>
                  <td className="px-4 py-2.5 font-medium text-txt-primary">{c.name}</td>
                  <td className="px-3 py-2.5 text-txt-secondary">{c.districtName || '—'}</td>
                  <td className={`px-3 py-2.5 text-right ${cellColour(c.benzene, CPCB_LIMITS.BENZENE ?? 5)}`}>
                    {c.benzene !== null ? c.benzene : '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-right ${cellColour(c.toluene, CPCB_LIMITS.TOLUENE ?? 200)}`}>
                    {c.toluene !== null ? c.toluene : '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-right ${cellColour(c.xylene, CPCB_LIMITS.XYLENE ?? 200)}`}>
                    {c.xylene !== null ? c.xylene : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center">{statusBadge(c.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && displayed.length === 0 && clusters.length > 0 && (
          <div className="py-12 text-center text-txt-tertiary text-[14px]">No clusters match your filter.</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-2 bg-white border-t border-bdr-light text-[11px] text-txt-tertiary flex-shrink-0">
        All values in µg/m³ · CPCB limits per Hazardous Waste Rules 2016
      </div>
    </div>
  )
}
