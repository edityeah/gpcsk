import { useState } from 'react'
import { FileCheck, CheckCircle, AlertCircle, Loader, Sparkles } from 'lucide-react'

interface CheckItem {
  id: string
  label: string
  desc: string
  status: 'ok' | 'warn' | 'missing' | 'checking'
}

const INITIAL_CHECKLIST: CheckItem[] = [
  { id: 'consent_form',    label: 'Consent Application Form',       desc: 'Form XII / XIII as per GPCB format', status: 'ok'      },
  { id: 'site_plan',       label: 'Site Plan & Layout Drawing',     desc: 'Scaled drawing with north direction', status: 'ok'      },
  { id: 'etp_design',      label: 'ETP Design Document',            desc: 'Effluent Treatment Plant SLD',        status: 'warn'    },
  { id: 'green_belt',      label: 'Green Belt Compliance Plan',     desc: '≥ 20% of plot area as per CPCB',     status: 'ok'      },
  { id: 'stack_details',   label: 'Stack Emission Parameters',      desc: 'Height, diameter, temperature, vel.', status: 'ok'      },
  { id: 'hw_manifest',     label: 'HW Manifest & Storage Plan',     desc: 'Schedule I/II categorisation',        status: 'missing' },
  { id: 'env_clearance',   label: 'Environmental Clearance Letter', desc: 'From MoEFCC if applicable',           status: 'ok'      },
  { id: 'factory_licence', label: 'Factory Licence / NOC',          desc: 'From Factories Inspector',            status: 'warn'    },
  { id: 'water_audit',     label: 'Water Audit Report',             desc: 'Consumption vs recycled balance',     status: 'missing' },
  { id: 'fee_challan',     label: 'Fee Payment Challan',            desc: 'GPCB Schedule fee proof',             status: 'ok'      },
]

const STATUS_META = {
  ok:       { icon: <CheckCircle className="w-4 h-4" />,  color: 'text-ok',           bg: 'bg-ok-light',      label: 'Complete'  },
  warn:     { icon: <AlertCircle className="w-4 h-4" />,  color: 'text-warn',         bg: 'bg-warn-light',    label: 'Partial'   },
  missing:  { icon: <AlertCircle className="w-4 h-4" />,  color: 'text-danger',       bg: 'bg-danger-light',  label: 'Missing'   },
  checking: { icon: <Loader className="w-4 h-4 animate-spin" />, color: 'text-primary', bg: 'bg-primary-light', label: 'Checking' },
}

interface Props {
  args?: Record<string, unknown>
}

export default function DocumentCompletenessCanvas(_: Props) {
  const [items, setItems] = useState<CheckItem[]>(INITIAL_CHECKLIST)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  const okCount    = items.filter(i => i.status === 'ok').length
  const warnCount  = items.filter(i => i.status === 'warn').length
  const missCount  = items.filter(i => i.status === 'missing').length
  const total      = items.length
  const score      = Math.round((okCount / total) * 100)

  async function runAiCheck() {
    if (running) return
    setRunning(true)
    setDone(false)

    // Mark all as "checking"
    setItems(prev => prev.map(i => ({ ...i, status: 'checking' as const })))

    // Stagger resolution: each item resolves after delay
    for (let i = 0; i < INITIAL_CHECKLIST.length; i++) {
      await new Promise<void>(res => setTimeout(res, 80 * (i + 1)))
      const original = INITIAL_CHECKLIST[i]!
      // AI "resolves" warn → ok, missing → warn (partial improvement)
      const resolved: CheckItem['status'] =
        original.status === 'ok'      ? 'ok' :
        original.status === 'warn'    ? 'ok' :
        original.status === 'missing' ? 'warn' :
        'ok'
      setItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: resolved } : item))
    }

    setRunning(false)
    setDone(true)
  }

  return (
    <div className="flex flex-col h-full bg-surface-page rounded-card overflow-hidden animate-bubble-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
          <FileCheck className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold text-txt-primary">Document Completeness</div>
          <div className="text-[11px] text-txt-secondary">AI-assisted checklist validation</div>
        </div>
        <button
          onClick={runAiCheck}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-primary text-white text-[12px] font-bold shadow-modal disabled:opacity-60 active:opacity-80 transition-opacity"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {running ? 'Checking…' : 'Run AI check'}
        </button>
      </div>

      {/* Score bar */}
      <div className="bg-white px-5 py-3 border-b border-bdr-light">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-txt-secondary">
              <span className="font-bold text-ok">{okCount}</span> complete
            </span>
            <span className="text-[11px] text-txt-secondary">
              <span className="font-bold text-warn">{warnCount}</span> partial
            </span>
            <span className="text-[11px] text-txt-secondary">
              <span className="font-bold text-danger">{missCount}</span> missing
            </span>
          </div>
          <span className="text-[13px] font-bold text-txt-primary">{score}%</span>
        </div>
        <div className="h-2 bg-bdr-light rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${score}%`,
              background: score >= 80 ? '#4CAF50' : score >= 60 ? '#FFB300' : '#E53935',
            }}
          />
        </div>
        {done && (
          <div className="mt-1.5 text-[11px] text-ok font-semibold">AI check complete — review updated statuses.</div>
        )}
      </div>

      {/* Checklist */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {items.map(item => {
          const meta = STATUS_META[item.status]
          return (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-card border border-bdr-light px-4 py-3 flex items-center gap-3 transition-all"
            >
              <div className={`flex-shrink-0 ${meta.color}`}>{meta.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-txt-primary">{item.label}</div>
                <div className="text-[11px] text-txt-secondary">{item.desc}</div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.bg} ${meta.color}`}>
                {meta.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
