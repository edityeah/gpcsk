// IndustryCorrelationCanvas — Complaints Officer
// For a selected complaint, shows nearby industries from /api/industries (top risk).
// Link complaint to industry via PATCH /api/complaints/:id

import { useEffect, useState, useCallback } from 'react'
import {
  Link2,
  RefreshCw,
  AlertTriangle,
  Building2,
  ChevronDown,
  Check,
} from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

// ─── Real API types ───────────────────────────────────────────────────────────

interface ApiComplaint {
  id: string
  description: string
  category: string        // e.g. 'AIR_POLLUTION'
  severity: string        // 'MINOR' | 'MAJOR' | 'CRITICAL'
  state: string           // 'NEW' | 'ASSIGNED' | etc.
  lat: number | null
  lng: number | null
  industryId: string | null
}

interface ApiIndustry {
  id: string
  name: string
  ucNumber: string
  category: string        // 'RED' | 'ORANGE' | etc.
  lat: number | null
  lng: number | null
  sector: { code: string; name: string } | null
  district: { code: string; name: string } | null
}

interface ApiIndustriesResponse {
  items: ApiIndustry[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_BADGE: Record<string, string> = {
  RED:    'bg-danger-light text-danger font-bold',
  ORANGE: 'bg-orange-100 text-orange-700 font-semibold',
  GREEN:  'bg-ok-light text-ok font-semibold',
  WHITE:  'bg-surface-secondary text-txt-secondary',
}

const SEV_BADGE: Record<string, string> = {
  CRITICAL: 'bg-danger text-white',
  MAJOR:    'bg-orange-500 text-white',
  MINOR:    'bg-warn text-txt-primary',
}

const CAT_LABEL: Record<string, string> = {
  AIR_POLLUTION:    'Air Pollution',
  WATER_POLLUTION:  'Water Pollution',
  NOISE:            'Noise',
  HAZARDOUS_WASTE:  'Hazardous Waste',
  ODOUR:            'Odour',
  BURNING:          'Burning',
  ILLEGAL_DISCHARGE:'Illegal Discharge',
}

// Haversine distance in km
function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Main canvas ─────────────────────────────────────────────────────────────

export function IndustryCorrelationCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()

  const [complaints, setComplaints] = useState<ApiComplaint[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [industries, setIndustries] = useState<ApiIndustry[]>([])
  const [linkedId, setLinkedId] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingInd, setLoadingInd] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)

  // Load complaint list
  useEffect(() => {
    if (!token) return
    setLoadingList(true)
    api<ApiComplaint[] | { complaints?: ApiComplaint[]; data?: ApiComplaint[] }>(
      '/api/complaints?limit=20',
      { token },
    )
      .then(res => {
        const list: ApiComplaint[] = Array.isArray(res)
          ? (res as ApiComplaint[])
          : ((res as { complaints?: ApiComplaint[]; data?: ApiComplaint[] }).complaints
            ?? (res as { data?: ApiComplaint[] }).data
            ?? [])
        setComplaints(list)
        if (list.length > 0) {
          setSelectedId(list[0]!.id)
          setLinkedId(list[0]!.industryId)
        }
      })
      .catch(() => {
        showToast({ kind: 'danger', text: 'Failed to load complaints.' })
      })
      .finally(() => setLoadingList(false))
  }, [token, showToast])

  // Load industries sorted by risk (top 20 RED/ORANGE)
  const loadIndustries = useCallback(async (complaint: ApiComplaint) => {
    if (!token) return
    setLoadingInd(true)
    try {
      const res = await api<ApiIndustriesResponse>(
        '/api/industries?category=RED&limit=20',
        { token },
      )
      let list: ApiIndustry[] = Array.isArray(res)
        ? (res as unknown as ApiIndustry[])
        : (res.items ?? [])

      // Sort by distance to complaint if we have lat/lng
      if (complaint.lat !== null && complaint.lng !== null) {
        list = list
          .filter(ind => ind.lat !== null && ind.lng !== null)
          .sort((a, b) =>
            distKm(complaint.lat!, complaint.lng!, a.lat!, a.lng!) -
            distKm(complaint.lat!, complaint.lng!, b.lat!, b.lng!),
          )
          .slice(0, 10)
      } else {
        list = list.slice(0, 10)
      }
      setIndustries(list)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to load nearby industries.' })
      setIndustries([])
    } finally {
      setLoadingInd(false)
    }
  }, [token, showToast])

  useEffect(() => {
    const c = complaints.find(x => x.id === selectedId)
    if (c) {
      setLinkedId(c.industryId)
      void loadIndustries(c)
    }
  }, [selectedId, complaints, loadIndustries])

  async function handleLink(industryId: string) {
    if (!selectedId) return
    setLinking(industryId)
    try {
      await api(`/api/complaints/${selectedId}`, {
        method: 'PATCH',
        token: token ?? undefined,
        body: { industryId },
      })
      showToast({ kind: 'success', text: 'Industry linked to complaint.' })
      setLinkedId(industryId)
      // Update local complaint list
      setComplaints(prev => prev.map(c => c.id === selectedId ? { ...c, industryId } : c))
    } catch {
      showToast({ kind: 'danger', text: 'Failed to link industry.' })
    } finally {
      setLinking(null)
    }
  }

  const selected = complaints.find(c => c.id === selectedId)

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-flag-light flex items-center justify-center">
          <Link2 className="w-5 h-5 text-flag" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-txt-primary">Industry Correlation</div>
          <div className="text-[11px] text-txt-secondary">Match complaints to nearby RED-category industries</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Complaint selector */}
        <div className="bg-white rounded-card border border-bdr-light shadow-card p-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-txt-tertiary mb-2">Select Complaint</div>
          {loadingList ? (
            <div className="text-[12px] text-txt-tertiary">Loading complaints…</div>
          ) : complaints.length === 0 ? (
            <div className="text-[12px] text-txt-tertiary">No complaints found.</div>
          ) : (
            <div className="relative">
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="w-full text-[13px] bg-surface-secondary border border-bdr-light rounded-xl px-3 py-2 pr-8 outline-none focus:border-primary appearance-none text-txt-primary"
              >
                {complaints.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.description.slice(0, 70)}{c.description.length > 70 ? '…' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-tertiary pointer-events-none" />
            </div>
          )}

          {selected && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {selected.category && (
                <span className="bg-primary-light text-primary px-2 py-0.5 rounded-full font-semibold">
                  {CAT_LABEL[selected.category] ?? selected.category.replace(/_/g, ' ')}
                </span>
              )}
              {selected.severity && (
                <span className={`px-2 py-0.5 rounded-full font-semibold ${SEV_BADGE[selected.severity] ?? ''}`}>
                  {selected.severity}
                </span>
              )}
              {linkedId && (
                <span className="bg-ok-light text-ok px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Linked
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nearby industries */}
        {loadingInd ? (
          <div className="flex items-center gap-2 py-8 justify-center text-txt-tertiary text-[13px]">
            <RefreshCw className="w-4 h-4 animate-spin" /> Finding nearby industries…
          </div>
        ) : industries.length === 0 ? (
          <div className="text-[13px] text-txt-tertiary text-center py-8">No industries found.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-txt-tertiary">
              Top RED-category Industries ({industries.length})
            </div>
            {industries.map(ind => {
              const isLinked = linkedId === ind.id
              const distanceKm = selected?.lat && selected?.lng && ind.lat && ind.lng
                ? distKm(selected.lat, selected.lng, ind.lat, ind.lng).toFixed(1)
                : null
              return (
                <div
                  key={ind.id}
                  className={`bg-white rounded-card border shadow-card p-4 transition-all ${
                    isLinked ? 'border-ok ring-1 ring-ok' : 'border-bdr-light'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-surface-secondary flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-txt-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-[13px] font-bold text-txt-primary">{ind.name}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${CATEGORY_BADGE[ind.category] ?? ''}`}>
                          {ind.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-txt-secondary mt-0.5">
                        {ind.sector?.name ?? '—'} · {ind.district?.name ?? '—'}
                        {distanceKm && ` · ~${distanceKm} km away`}
                      </div>
                      <div className="text-[11px] text-txt-tertiary mt-0.5">{ind.ucNumber}</div>
                    </div>

                    {/* Link button */}
                    <button
                      onClick={() => { void handleLink(ind.id) }}
                      disabled={linking === ind.id || isLinked}
                      className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                        isLinked
                          ? 'bg-ok-light text-ok cursor-default'
                          : 'bg-primary-light text-primary hover:bg-primary hover:text-white disabled:opacity-50'
                      }`}
                    >
                      {isLinked ? (
                        <><Check className="w-3 h-3" /> Linked</>
                      ) : linking === ind.id ? (
                        <><RefreshCw className="w-3 h-3 animate-spin" /> Linking…</>
                      ) : (
                        <><Link2 className="w-3 h-3" /> Link</>
                      )}
                    </button>
                  </div>

                  {isLinked && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-ok">
                      <AlertTriangle className="w-3 h-3" />
                      This industry is linked to the selected complaint.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
