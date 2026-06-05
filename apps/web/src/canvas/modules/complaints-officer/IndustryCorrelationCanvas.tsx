// IndustryCorrelationCanvas — Complaints Officer
// For a selected complaint, shows nearby industries with exceedance counts.
// "Link to industry" → PATCH /api/complaints/:id

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComplaintSummary {
  id: string
  description: string
  location?: { district?: string; taluka?: string }
  category?: string
  severity?: string
  state: string
  industry?: { id: string; name: string } | null
}

interface NearbyIndustry {
  id: string
  name: string
  sector: string
  category: string          // Red / Orange / Green / White
  district: string
  distanceKm?: number
  exceedanceCount: number
  recentExceedances: Array<{ parameter: string; severity: string; detectedAt: string }>
}

interface CorrelationResponse {
  complaint: ComplaintSummary
  nearbyIndustries: NearbyIndustry[]
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_COMPLAINTS: ComplaintSummary[] = [
  { id: 'C-001', description: 'Black smoke from GIDC Vatva stack', category: 'Air Pollution', severity: 'high', state: 'new', location: { district: 'Ahmedabad', taluka: 'Vatva' } },
  { id: 'C-002', description: 'Dye effluent in drain at Sachin GIDC', category: 'Water Pollution', severity: 'critical', state: 'assigned', location: { district: 'Surat', taluka: 'Sachin' }, industry: { id: 'IND-054', name: 'Sachin Dye & Chem Pvt Ltd' } },
  { id: 'C-003', description: 'Waste drums at Ankleshwar GIDC', category: 'Hazardous Waste', severity: 'medium', state: 'in_progress', location: { district: 'Bharuch', taluka: 'Ankleshwar' } },
]

const DEMO_NEARBY: NearbyIndustry[] = [
  {
    id: 'IND-021', name: 'Vatva Chemical Works Pvt Ltd', sector: 'Chemical', category: 'Red',
    district: 'Ahmedabad', distanceKm: 0.4, exceedanceCount: 18,
    recentExceedances: [
      { parameter: 'PM10', severity: 'critical', detectedAt: new Date(Date.now() - 3600_000).toISOString() },
      { parameter: 'SO2', severity: 'high', detectedAt: new Date(Date.now() - 86400_000).toISOString() },
    ],
  },
  {
    id: 'IND-022', name: 'Gujarat Dye Intermediate Ltd', sector: 'Dyes & Pigments', category: 'Red',
    district: 'Ahmedabad', distanceKm: 0.9, exceedanceCount: 11,
    recentExceedances: [
      { parameter: 'NOx', severity: 'high', detectedAt: new Date(Date.now() - 7200_000).toISOString() },
    ],
  },
  {
    id: 'IND-023', name: 'Naroda Enviro Projects Ltd', sector: 'CETP', category: 'Orange',
    district: 'Ahmedabad', distanceKm: 1.5, exceedanceCount: 7,
    recentExceedances: [
      { parameter: 'COD', severity: 'medium', detectedAt: new Date(Date.now() - 172800_000).toISOString() },
    ],
  },
  {
    id: 'IND-024', name: 'Vatva Dyestuff Mfg Co', sector: 'Chemical', category: 'Red',
    district: 'Ahmedabad', distanceKm: 2.1, exceedanceCount: 3,
    recentExceedances: [],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_BADGE: Record<string, string> = {
  Red: 'bg-danger-light text-danger font-bold',
  Orange: 'bg-orange-100 text-orange-700 font-semibold',
  Green: 'bg-ok-light text-ok font-semibold',
  White: 'bg-surface-secondary text-txt-secondary',
}

const SEV_BADGE: Record<string, string> = {
  critical: 'bg-danger text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-warn text-txt-primary',
  low: 'bg-ok-light text-ok',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── Main canvas ─────────────────────────────────────────────────────────────

export function IndustryCorrelationCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()

  const [complaints, setComplaints] = useState<ComplaintSummary[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [correlation, setCorrelation] = useState<CorrelationResponse | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingCorr, setLoadingCorr] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)

  // Load complaint list
  useEffect(() => {
    setLoadingList(true)
    api<{ data: ComplaintSummary[] }>('/api/complaints?limit=20', { token: token ?? undefined })
      .then(res => {
        setComplaints(res.data ?? [])
        if (res.data?.length) setSelectedId(res.data[0]!.id)
      })
      .catch(() => {
        setComplaints(DEMO_COMPLAINTS)
        setSelectedId(DEMO_COMPLAINTS[0]!.id)
      })
      .finally(() => setLoadingList(false))
  }, [token])

  // Load correlation when complaint selected
  const loadCorrelation = useCallback(async (id: string) => {
    if (!id) return
    setLoadingCorr(true)
    try {
      const res = await api<CorrelationResponse>(`/api/complaints/${id}/correlation`, {
        token: token ?? undefined,
      })
      setCorrelation(res)
    } catch {
      // Demo fallback
      const c = DEMO_COMPLAINTS.find(x => x.id === id) ?? DEMO_COMPLAINTS[0]!
      setCorrelation({ complaint: c, nearbyIndustries: DEMO_NEARBY })
    } finally {
      setLoadingCorr(false)
    }
  }, [token])

  useEffect(() => {
    if (selectedId) void loadCorrelation(selectedId)
  }, [selectedId, loadCorrelation])

  async function handleLink(industryId: string) {
    if (!correlation) return
    setLinking(industryId)
    try {
      await api(`/api/complaints/${correlation.complaint.id}`, {
        method: 'PATCH',
        token: token ?? undefined,
        body: { industryId },
      })
      showToast({ kind: 'success', text: 'Industry linked to complaint.' })
      void loadCorrelation(correlation.complaint.id)
    } catch {
      showToast({ kind: 'warn', text: 'Link saved in demo mode.' })
      setCorrelation(prev => prev ? {
        ...prev,
        complaint: {
          ...prev.complaint,
          industry: { id: industryId, name: prev.nearbyIndustries.find(i => i.id === industryId)?.name ?? industryId },
        },
      } : null)
    } finally {
      setLinking(null)
    }
  }

  const linked = correlation?.complaint.industry?.id

  return (
    <div className="h-full flex flex-col bg-surface-page overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-flag-light flex items-center justify-center">
          <Link2 className="w-5 h-5 text-flag" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-txt-primary">Industry Correlation</div>
          <div className="text-[11px] text-txt-secondary">Match complaints to nearby industries with exceedances</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Complaint selector */}
        <div className="bg-white rounded-card border border-bdr-light shadow-card p-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-txt-tertiary mb-2">Select Complaint</div>
          {loadingList ? (
            <div className="text-[12px] text-txt-tertiary">Loading complaints…</div>
          ) : (
            <div className="relative">
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="w-full text-[13px] bg-surface-secondary border border-bdr-light rounded-xl px-3 py-2 pr-8 outline-none focus:border-primary appearance-none text-txt-primary"
              >
                {complaints.map(c => (
                  <option key={c.id} value={c.id}>
                    [{c.id}] {c.description.slice(0, 60)}{c.description.length > 60 ? '…' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-tertiary pointer-events-none" />
            </div>
          )}

          {correlation?.complaint && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {correlation.complaint.category && (
                <span className="bg-primary-light text-primary px-2 py-0.5 rounded-full font-semibold">
                  {correlation.complaint.category}
                </span>
              )}
              {correlation.complaint.severity && (
                <span className={`px-2 py-0.5 rounded-full font-semibold ${SEV_BADGE[correlation.complaint.severity] ?? ''}`}>
                  {correlation.complaint.severity}
                </span>
              )}
              {correlation.complaint.location?.district && (
                <span className="text-txt-secondary">{correlation.complaint.location.district}</span>
              )}
              {linked && (
                <span className="bg-ok-light text-ok px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Linked: {correlation.complaint.industry?.name}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nearby industries */}
        {loadingCorr ? (
          <div className="flex items-center gap-2 py-8 justify-center text-txt-tertiary text-[13px]">
            <RefreshCw className="w-4 h-4 animate-spin" /> Finding nearby industries…
          </div>
        ) : correlation && correlation.nearbyIndustries.length === 0 ? (
          <div className="text-[13px] text-txt-tertiary text-center py-8">No nearby industries found.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-txt-tertiary">
              Nearby Industries ({correlation?.nearbyIndustries.length ?? 0})
            </div>
            {(correlation?.nearbyIndustries ?? []).map(ind => (
              <div
                key={ind.id}
                className={`bg-white rounded-card border shadow-card p-4 transition-all ${
                  linked === ind.id ? 'border-ok ring-1 ring-ok' : 'border-bdr-light'
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
                      {ind.sector} · {ind.district}
                      {ind.distanceKm !== undefined && ` · ${ind.distanceKm} km away`}
                    </div>

                    {/* Exceedance summary */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {ind.exceedanceCount > 0 ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-danger">
                          <AlertTriangle className="w-3 h-3" />
                          {ind.exceedanceCount} exceedances
                        </span>
                      ) : (
                        <span className="text-[11px] text-ok font-semibold">No exceedances</span>
                      )}
                    </div>

                    {/* Recent exceedances */}
                    {ind.recentExceedances.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {ind.recentExceedances.map((ex, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px]">
                            <span className={`px-1.5 py-0.5 rounded-full font-bold ${SEV_BADGE[ex.severity] ?? ''}`}>{ex.severity}</span>
                            <span className="text-txt-secondary font-semibold">{ex.parameter}</span>
                            <span className="text-txt-tertiary">{fmt(ex.detectedAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Link button */}
                  <button
                    onClick={() => { void handleLink(ind.id) }}
                    disabled={linking === ind.id || linked === ind.id}
                    className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      linked === ind.id
                        ? 'bg-ok-light text-ok cursor-default'
                        : 'bg-primary-light text-primary hover:bg-primary hover:text-white disabled:opacity-50'
                    }`}
                  >
                    {linked === ind.id ? (
                      <><Check className="w-3 h-3" /> Linked</>
                    ) : linking === ind.id ? (
                      <><RefreshCw className="w-3 h-3 animate-spin" /> Linking…</>
                    ) : (
                      <><Link2 className="w-3 h-3" /> Link</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
