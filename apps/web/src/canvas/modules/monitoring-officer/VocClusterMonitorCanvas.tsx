/**
 * VocClusterMonitorCanvas — table of 25 VOC clusters with current readings vs CPCB limits.
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ArrowUpDown } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.js'
import { api } from '../../../lib/api.js'

interface VocCluster {
  id: string
  name: string
  district: string
  gidcZone: string
  benzene: number
  toluene: number
  xylene: number
  ethylbenzene: number
  formaldehyde: number
  acetaldehyde: number
  updatedAt: string
  status: 'ok' | 'warn' | 'critical'
}

// CPCB limits (µg/m³)
const CPCB_LIMITS = {
  benzene:      5,
  toluene:      200,
  xylene:       200,
  ethylbenzene: 200,
  formaldehyde: 100,
  acetaldehyde: 400,
}

const DEMO_CLUSTERS: VocCluster[] = [
  { id: 'v1',  name: 'Vatva Industrial Estate',       district: 'Ahmedabad', gidcZone: 'Vatva',       benzene: 6.2,  toluene: 145, xylene: 98,  ethylbenzene: 52,  formaldehyde: 78,  acetaldehyde: 210, updatedAt: new Date().toISOString(), status: 'critical' },
  { id: 'v2',  name: 'Naroda Industrial Estate',      district: 'Ahmedabad', gidcZone: 'Naroda',      benzene: 4.1,  toluene: 182, xylene: 155, ethylbenzene: 88,  formaldehyde: 95,  acetaldehyde: 350, updatedAt: new Date().toISOString(), status: 'warn' },
  { id: 'v3',  name: 'Ankleshwar GIDC',               district: 'Bharuch',   gidcZone: 'Ankleshwar',  benzene: 3.8,  toluene: 120, xylene: 90,  ethylbenzene: 44,  formaldehyde: 60,  acetaldehyde: 180, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v4',  name: 'Sachin GIDC',                   district: 'Surat',     gidcZone: 'Sachin',      benzene: 2.9,  toluene: 90,  xylene: 65,  ethylbenzene: 30,  formaldehyde: 45,  acetaldehyde: 140, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v5',  name: 'Vapi GIDC',                     district: 'Valsad',    gidcZone: 'Vapi',        benzene: 5.5,  toluene: 175, xylene: 188, ethylbenzene: 110, formaldehyde: 88,  acetaldehyde: 290, updatedAt: new Date().toISOString(), status: 'critical' },
  { id: 'v6',  name: 'Panoli GIDC',                   district: 'Bharuch',   gidcZone: 'Panoli',      benzene: 4.8,  toluene: 160, xylene: 120, ethylbenzene: 70,  formaldehyde: 82,  acetaldehyde: 260, updatedAt: new Date().toISOString(), status: 'warn' },
  { id: 'v7',  name: 'Dahej SEZ',                     district: 'Bharuch',   gidcZone: 'Dahej',       benzene: 3.2,  toluene: 130, xylene: 95,  ethylbenzene: 55,  formaldehyde: 58,  acetaldehyde: 195, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v8',  name: 'Jhagadia GIDC',                 district: 'Bharuch',   gidcZone: 'Jhagadia',    benzene: 4.4,  toluene: 155, xylene: 110, ethylbenzene: 65,  formaldehyde: 75,  acetaldehyde: 230, updatedAt: new Date().toISOString(), status: 'warn' },
  { id: 'v9',  name: 'Pandesara GIDC',                district: 'Surat',     gidcZone: 'Pandesara',   benzene: 2.5,  toluene: 80,  xylene: 55,  ethylbenzene: 25,  formaldehyde: 38,  acetaldehyde: 120, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v10', name: 'Hazira Industrial Area',         district: 'Surat',     gidcZone: 'Hazira',      benzene: 3.6,  toluene: 110, xylene: 85,  ethylbenzene: 48,  formaldehyde: 62,  acetaldehyde: 200, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v11', name: 'Morbi Ceramic Cluster',          district: 'Morbi',     gidcZone: 'Morbi',       benzene: 2.1,  toluene: 65,  xylene: 40,  ethylbenzene: 18,  formaldehyde: 28,  acetaldehyde: 88,  updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v12', name: 'Odhav GIDC',                    district: 'Ahmedabad', gidcZone: 'Odhav',       benzene: 4.9,  toluene: 165, xylene: 145, ethylbenzene: 92,  formaldehyde: 90,  acetaldehyde: 310, updatedAt: new Date().toISOString(), status: 'warn' },
  { id: 'v13', name: 'Changodar GIDC',                district: 'Ahmedabad', gidcZone: 'Changodar',   benzene: 3.0,  toluene: 100, xylene: 75,  ethylbenzene: 35,  formaldehyde: 50,  acetaldehyde: 160, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v14', name: 'Alang Ship-Breaking',            district: 'Bhavnagar', gidcZone: 'Alang',       benzene: 5.8,  toluene: 190, xylene: 175, ethylbenzene: 115, formaldehyde: 92,  acetaldehyde: 380, updatedAt: new Date().toISOString(), status: 'critical' },
  { id: 'v15', name: 'Porbandar GIDC',                district: 'Porbandar', gidcZone: 'Porbandar',   benzene: 2.2,  toluene: 70,  xylene: 50,  ethylbenzene: 22,  formaldehyde: 32,  acetaldehyde: 100, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v16', name: 'Rajkot GIDC',                   district: 'Rajkot',    gidcZone: 'Rajkot',      benzene: 2.8,  toluene: 88,  xylene: 62,  ethylbenzene: 28,  formaldehyde: 42,  acetaldehyde: 130, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v17', name: 'Surendranagar GIDC',             district: 'Surendranagar', gidcZone: 'Surendranagar', benzene: 1.8, toluene: 55, xylene: 38, ethylbenzene: 15, formaldehyde: 25, acetaldehyde: 75, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v18', name: 'Vadodara GIDC Makarpura',        district: 'Vadodara',  gidcZone: 'Makarpura',   benzene: 4.2,  toluene: 148, xylene: 112, ethylbenzene: 68,  formaldehyde: 80,  acetaldehyde: 245, updatedAt: new Date().toISOString(), status: 'warn' },
  { id: 'v19', name: 'Nandesari GIDC',                district: 'Vadodara',  gidcZone: 'Nandesari',   benzene: 3.5,  toluene: 118, xylene: 88,  ethylbenzene: 48,  formaldehyde: 65,  acetaldehyde: 205, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v20', name: 'Halol GIDC',                    district: 'Panchmahal', gidcZone: 'Halol',       benzene: 2.6,  toluene: 82,  xylene: 58,  ethylbenzene: 26,  formaldehyde: 40,  acetaldehyde: 125, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v21', name: 'Bharuch GIDC',                  district: 'Bharuch',   gidcZone: 'Bharuch',     benzene: 4.0,  toluene: 138, xylene: 104, ethylbenzene: 60,  formaldehyde: 72,  acetaldehyde: 218, updatedAt: new Date().toISOString(), status: 'warn' },
  { id: 'v22', name: 'Kalol GIDC',                    district: 'Gandhinagar', gidcZone: 'Kalol',      benzene: 2.3,  toluene: 74,  xylene: 52,  ethylbenzene: 24,  formaldehyde: 35,  acetaldehyde: 108, updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v23', name: 'Kadi GIDC',                     district: 'Mehsana',   gidcZone: 'Kadi',        benzene: 1.9,  toluene: 60,  xylene: 42,  ethylbenzene: 18,  formaldehyde: 28,  acetaldehyde: 85,  updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v24', name: 'Mehsana GIDC',                  district: 'Mehsana',   gidcZone: 'Mehsana',     benzene: 2.0,  toluene: 65,  xylene: 45,  ethylbenzene: 20,  formaldehyde: 30,  acetaldehyde: 92,  updatedAt: new Date().toISOString(), status: 'ok' },
  { id: 'v25', name: 'Gandhinagar GIDC',              district: 'Gandhinagar', gidcZone: 'Gandhinagar', benzene: 1.5, toluene: 48,  xylene: 32,  ethylbenzene: 14,  formaldehyde: 22,  acetaldehyde: 68,  updatedAt: new Date().toISOString(), status: 'ok' },
]

type SortKey = 'name' | 'benzene' | 'toluene' | 'status'

function statusBadge(status: VocCluster['status']) {
  if (status === 'critical') return <span className="badge badge-danger">Critical</span>
  if (status === 'warn') return <span className="badge badge-warn">Near limit</span>
  return <span className="badge badge-ok">Within norm</span>
}

function cellColour(value: number, limit: number): string {
  if (value >= limit) return 'text-danger font-bold'
  if (value >= limit * 0.8) return 'text-warn font-semibold'
  return 'text-txt-primary'
}

export function VocClusterMonitorCanvas() {
  const { token } = useAuth()
  const [clusters, setClusters] = useState<VocCluster[]>(DEMO_CLUSTERS)
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<VocCluster[]>('/api/voc-clusters', { token: token ?? undefined })
      setClusters(data)
    } catch {
      setClusters(DEMO_CLUSTERS)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const displayed = clusters
    .filter(c =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.district.toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'benzene') cmp = a.benzene - b.benzene
      else if (sortKey === 'toluene') cmp = a.toluene - b.toluene
      else if (sortKey === 'status') {
        const order = { critical: 0, warn: 1, ok: 2 }
        cmp = order[a.status] - order[b.status]
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
          <p className="text-[12px] text-txt-secondary mt-0.5">25 industrial clusters — current readings vs CPCB limits (µg/m³)</p>
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
        <table className="min-w-full text-[12px]">
          <thead className="bg-surface-secondary sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left"><SortBtn label="Cluster" k="name" /></th>
              <th className="px-3 py-3 text-left text-[11px] text-txt-tertiary font-medium">District</th>
              <th className="px-3 py-3 text-right"><SortBtn label={`Benzene (lim ${CPCB_LIMITS.benzene})`} k="benzene" /></th>
              <th className="px-3 py-3 text-right"><SortBtn label={`Toluene (lim ${CPCB_LIMITS.toluene})`} k="toluene" /></th>
              <th className="px-3 py-3 text-right text-[11px] text-txt-tertiary font-medium">Xylene (lim {CPCB_LIMITS.xylene})</th>
              <th className="px-3 py-3 text-right text-[11px] text-txt-tertiary font-medium">HCHO (lim {CPCB_LIMITS.formaldehyde})</th>
              <th className="px-3 py-3 text-right text-[11px] text-txt-tertiary font-medium">CH3CHO (lim {CPCB_LIMITS.acetaldehyde})</th>
              <th className="px-3 py-3 text-center"><SortBtn label="Status" k="status" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bdr-light">
            {displayed.map((c, i) => (
              <tr key={c.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-surface-secondary/40'} hover:bg-primary-light/20 transition-colors`}>
                <td className="px-4 py-2.5 font-medium text-txt-primary">{c.name}</td>
                <td className="px-3 py-2.5 text-txt-secondary">{c.district}</td>
                <td className={`px-3 py-2.5 text-right ${cellColour(c.benzene, CPCB_LIMITS.benzene)}`}>{c.benzene}</td>
                <td className={`px-3 py-2.5 text-right ${cellColour(c.toluene, CPCB_LIMITS.toluene)}`}>{c.toluene}</td>
                <td className={`px-3 py-2.5 text-right ${cellColour(c.xylene, CPCB_LIMITS.xylene)}`}>{c.xylene}</td>
                <td className={`px-3 py-2.5 text-right ${cellColour(c.formaldehyde, CPCB_LIMITS.formaldehyde)}`}>{c.formaldehyde}</td>
                <td className={`px-3 py-2.5 text-right ${cellColour(c.acetaldehyde, CPCB_LIMITS.acetaldehyde)}`}>{c.acetaldehyde}</td>
                <td className="px-3 py-2.5 text-center">{statusBadge(c.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {displayed.length === 0 && (
          <div className="py-12 text-center text-txt-tertiary text-[14px]">No clusters match your filter.</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-2 bg-white border-t border-bdr-light text-[11px] text-txt-tertiary flex-shrink-0">
        All values in µg/m³ · CPCB limits per Hazardous Waste Rules 2016 · HCHO = Formaldehyde, CH3CHO = Acetaldehyde
      </div>
    </div>
  )
}
