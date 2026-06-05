/**
 * ReportExportCanvas — stub
 *
 * Renders an "Export to PDF" button that triggers an 800 ms toast.
 * Full PDF generation is deferred to a later slice.
 */

import { useState } from 'react'
import { FileDown, FileText, ChevronRight, CheckCircle } from 'lucide-react'
import { useApp } from '../../../context/AppContext.js'

interface ReportTemplate {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const TEMPLATES: ReportTemplate[] = [
  {
    id: 'industry-summary',
    title: 'Industry Compliance Summary',
    description: 'Consent status, exceedance history, violations, and inspection cadence for selected industries.',
    icon: FileText,
  },
  {
    id: 'exceedance-report',
    title: 'Exceedance & Violation Report',
    description: 'All sensor exceedances and confirmed violations within a chosen date range.',
    icon: FileText,
  },
  {
    id: 'cetp-scorecard',
    title: 'CETP Monitoring Scorecard',
    description: 'Monthly inlet / final effluent performance across all CETPs.',
    icon: FileText,
  },
  {
    id: 'complaint-digest',
    title: 'Complaint Digest',
    description: 'Complaint volume, category breakdown, resolution rate, and hotspot map.',
    icon: FileText,
  },
  {
    id: 'enforcement-register',
    title: 'Enforcement Register',
    description: 'Show-cause notices, closure directions, and bank guarantee invocations by stage.',
    icon: FileText,
  },
  {
    id: 'festival-monitoring',
    title: 'Festival Monitoring Report',
    description: 'Before / during / after comparison for Ganesh Utsav or Diwali river-quality data.',
    icon: FileText,
  },
]

export function ReportExportCanvas() {
  const { showToast } = useApp()
  const [exporting, setExporting] = useState<string | null>(null)

  function handleExport(template: ReportTemplate) {
    if (exporting) return
    setExporting(template.id)
    // Stub: 800 ms delay, then toast
    setTimeout(() => {
      showToast({
        kind: 'success',
        text: `"${template.title}" export is ready. (PDF generation coming in a future slice.)`,
        duration: 3500,
      })
      setExporting(null)
    }, 800)
  }

  return (
    <div className="flex flex-col h-full bg-surface-page" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <div className="bg-white border-b border-bdr-light px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FileDown className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-txt-primary">Report Export</h1>
            <div className="text-[12px] text-txt-secondary">Generate PDF reports for offline review and sharing</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Notice banner */}
        <div className="flex items-start gap-3 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 mb-5">
          <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-blue-700 leading-relaxed">
            PDF generation is a stub in this prototype. Clicking "Export to PDF" will simulate the process
            and confirm readiness. Full generation (charts + tables + letterhead) ships in a future slice.
          </p>
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((tmpl) => {
            const Icon = tmpl.icon
            const isExporting = exporting === tmpl.id
            return (
              <div
                key={tmpl.id}
                className="rounded-2xl border border-bdr-light bg-white p-5 shadow-card flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-txt-primary leading-tight">{tmpl.title}</div>
                  <p className="text-[12px] text-txt-secondary leading-snug mt-1">{tmpl.description}</p>
                  <button
                    onClick={() => handleExport(tmpl)}
                    disabled={!!exporting}
                    className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                      isExporting
                        ? 'bg-primary/70 text-white cursor-wait'
                        : exporting
                        ? 'bg-slate-100 text-txt-tertiary cursor-not-allowed'
                        : 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                    }`}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    {isExporting ? 'Generating…' : 'Export to PDF'}
                    {!isExporting && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
