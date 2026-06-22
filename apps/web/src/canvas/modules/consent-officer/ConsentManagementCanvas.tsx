import { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import { Layers } from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { Spinner } from '../../../components/ui/Spinner.js'
import { KpiStrip } from './AIVerificationCanvas.js'
import type { SummaryResponse } from './AIVerificationCanvas.js'

// ── Lazy-load sub-canvases (code-split) ───────────────────────────────────────

const ApplicationQueueCanvas = lazy(() => import('./ApplicationQueueCanvas.js'))
const AIVerificationCanvas    = lazy(() => import('./AIVerificationCanvas.js'))
const ConsentPipelineCanvas   = lazy(() => import('./ConsentPipelineCanvas.js'))
const RenewalRadarCanvas      = lazy(() => import('./RenewalRadarCanvas.js'))
const CapacityVsConsentCanvas = lazy(() => import('./CapacityVsConsentCanvas.js'))

// ── Tab definition ────────────────────────────────────────────────────────────

type TabKey = 'inbox' | 'ai-verify' | 'pipeline' | 'renewals' | 'capacity'

interface TabDef {
  key: TabKey
  icon: string
  label: string
  ariaLabel: string
}

const TABS: TabDef[] = [
  { key: 'inbox',    icon: '📥', label: 'Inbox',             ariaLabel: 'Application Inbox'          },
  { key: 'ai-verify',icon: '🔍', label: 'AI Verification',   ariaLabel: 'AI Document Verification'   },
  { key: 'pipeline', icon: '📋', label: 'Pipeline',          ariaLabel: 'Consent Pipeline'           },
  { key: 'renewals', icon: '🔄', label: 'Renewals',          ariaLabel: 'Renewal Radar'              },
  { key: 'capacity', icon: '📊', label: 'Capacity vs Consent', ariaLabel: 'Capacity vs Consent'      },
]

// ── KPI helpers ───────────────────────────────────────────────────────────────

interface ConsentsApiResponse {
  items: unknown[]
  nextCursor?: string
}

const ISSUE_STATUSES = ['BLANK', 'MISSING', 'BLURRED', 'UNCLEAR', 'UNSCANNED']

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  args?: Record<string, unknown>
}

export default function ConsentManagementCanvas(_: Props) {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('inbox')
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [renewalCount, setRenewalCount] = useState(0)
  const [kpiLoading, setKpiLoading] = useState(true)

  const loadKpi = useCallback(async () => {
    if (!token) return
    setKpiLoading(true)
    try {
      const [summaryData, renewalData] = await Promise.all([
        api<SummaryResponse>('/api/consents/doc-verification-summary', { token }),
        api<ConsentsApiResponse>('/api/consents?expiringWithinDays=30&limit=1', { token }),
      ])
      setSummary(summaryData)
      setRenewalCount(renewalData.items.length)
    } catch {
      // KPI strip will show dashes — non-fatal
    } finally {
      setKpiLoading(false)
    }
  }, [token])

  useEffect(() => { loadKpi() }, [loadKpi])

  // Compute "Approved last 30d" from summary is not directly available,
  // so we pass the raw summary and let KpiStrip handle it.

  // Build KPI data for the strip (inject renewalCount into a compatible shape)
  const enrichedSummary: SummaryResponse | null = summary
    ? {
        ...summary,
        // We surface renewalCount via the strip's renewalCount prop
      }
    : null

  return (
    <div className="flex flex-col h-full bg-surface-page rounded-card overflow-hidden animate-bubble-in">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
          <Layers className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-[15px] font-bold text-txt-primary">Consent Management</div>
          <div className="text-[11px] text-txt-secondary">
            AI-verified applications · human approval queue · renewal radar
          </div>
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────────────── */}
      {kpiLoading ? (
        <div className="flex items-center justify-center py-4 bg-white border-b border-bdr-light">
          <Spinner size={20} />
        </div>
      ) : (
        <KpiStrip summary={enrichedSummary} renewalCount={renewalCount} />
      )}

      {/* ── Tab row ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 bg-white border-b border-bdr-light overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            aria-label={tab.ariaLabel}
            onClick={() => setActiveTab(tab.key)}
            className={[
              'flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap flex-shrink-0',
              activeTab === tab.key
                ? 'border-primary text-primary bg-primary-light/40'
                : 'border-transparent text-txt-secondary hover:text-txt-primary hover:bg-surface-secondary',
            ].join(' ')}
          >
            <span role="img" aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab body ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <Spinner size={32} />
            </div>
          }
        >
          {activeTab === 'inbox' && (
            <ApplicationQueueCanvas />
          )}
          {activeTab === 'ai-verify' && (
            <AIVerificationCanvas hideKpi summary={enrichedSummary} />
          )}
          {activeTab === 'pipeline' && (
            <ConsentPipelineCanvas />
          )}
          {activeTab === 'renewals' && (
            <RenewalRadarCanvas />
          )}
          {activeTab === 'capacity' && (
            <CapacityVsConsentCanvas />
          )}
        </Suspense>
      </div>
    </div>
  )
}
