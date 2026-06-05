/**
 * OnSiteChecklistCanvas
 *
 * On-site inspection form:
 *   - Industry selector (free-text ID for now; v2: searchable dropdown)
 *   - Scheduled date field
 *   - Parameter readings (key-value pairs, dynamic rows)
 *   - Mock photo capture (file input — stored as filename strings in demo)
 *   - Violations editor (add / remove; severity + parameter)
 *
 * On submit → POST /api/inspections (create + complete in two steps).
 * For the demo prototype the form schedules then immediately completes it
 * so the officer can capture field data without two round-trips.
 */

import { useState } from 'react'
import {
  Camera, Plus, Trash2, ClipboardList, AlertTriangle,
  CheckCircle2, ChevronDown,
} from 'lucide-react'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { useApp } from '../../../context/AppContext.js'

type Severity = 'MINOR' | 'MAJOR' | 'CRITICAL'
interface ViolationRow {
  id: string
  parameter: string
  observedValue: string
  normValue: string
  unit: string
  severity: Severity
}
interface ReadingRow {
  id: string
  parameter: string
  value: string
  unit: string
}

const SEVERITY_COLOR: Record<Severity, string> = {
  MINOR:    'bg-warn-light text-warn',
  MAJOR:    'bg-orange-100 text-orange-600',
  CRITICAL: 'bg-danger-light text-danger',
}

const INDUSTRY_OPTIONS = [
  { label: 'Vatva Industrial Estate (RED)', id: '' },
]

const DEFAULT_PARAMS = [
  { parameter: 'pH', unit: '' },
  { parameter: 'BOD', unit: 'mg/L' },
  { parameter: 'COD', unit: 'mg/L' },
  { parameter: 'SS', unit: 'mg/L' },
  { parameter: 'PM10', unit: 'µg/m³' },
  { parameter: 'SO₂', unit: 'µg/m³' },
  { parameter: 'NOₓ', unit: 'µg/m³' },
]

function uid() { return Math.random().toString(36).slice(2, 9) }

export function OnSiteChecklistCanvas() {
  const { token } = useAuth()
  const { showToast } = useApp()

  const [industryId, setIndustryId] = useState('')
  const [scheduledAt, setScheduledAt] = useState(new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState('')
  const [readings, setReadings] = useState<ReadingRow[]>(
    DEFAULT_PARAMS.map(p => ({ id: uid(), parameter: p.parameter, value: '', unit: p.unit })),
  )
  const [photos, setPhotos] = useState<string[]>([])
  const [violations, setViolations] = useState<ViolationRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // --- Readings helpers ---
  function updateReading(id: string, field: keyof ReadingRow, value: string) {
    setReadings(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  function addReading() {
    setReadings(rows => [...rows, { id: uid(), parameter: '', value: '', unit: '' }])
  }
  function removeReading(id: string) {
    setReadings(rows => rows.filter(r => r.id !== id))
  }

  // --- Violations helpers ---
  function addViolation() {
    setViolations(rows => [...rows, {
      id: uid(), parameter: '', observedValue: '', normValue: '', unit: '', severity: 'MINOR',
    }])
  }
  function updateViolation(id: string, field: keyof ViolationRow, value: string) {
    setViolations(rows => rows.map(v => v.id === id ? { ...v, [field]: value } : v))
  }
  function removeViolation(id: string) {
    setViolations(rows => rows.filter(v => v.id !== id))
  }

  // --- Photo mock ---
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    const names = Array.from(files).map(f => f.name)
    setPhotos(p => [...new Set([...p, ...names])])
  }
  function removePhoto(name: string) { setPhotos(p => p.filter(x => x !== name)) }

  // --- Submit ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!industryId.trim()) {
      showToast({ kind: 'warn', text: 'Enter an industry ID.' })
      return
    }
    setSubmitting(true)
    try {
      // Step 1: schedule
      const insp = await api<{ id: string }>('/api/inspections', {
        method: 'POST',
        token: token ?? undefined,
        body: { industryId: industryId.trim(), scheduledAt: new Date(scheduledAt).toISOString() },
      })

      // Build observations from readings
      const observationMap: Record<string, unknown> = { notes }
      for (const r of readings) {
        if (r.parameter && r.value !== '') {
          observationMap[r.parameter] = { value: r.value, unit: r.unit }
        }
      }

      // Step 2: complete immediately with field data
      await api(`/api/inspections/${insp.id}/complete`, {
        method: 'POST',
        token: token ?? undefined,
        body: {
          observations: observationMap,
          photos,
          violations: violations
            .filter(v => v.parameter.trim())
            .map(v => ({
              parameter: v.parameter,
              observedValue: v.observedValue !== '' ? parseFloat(v.observedValue) : undefined,
              normValue: v.normValue !== '' ? parseFloat(v.normValue) : undefined,
              unit: v.unit || undefined,
              severity: v.severity,
              source: 'INSPECTION',
            })),
        },
      })

      showToast({ kind: 'success', text: 'Inspection filed successfully.' })
      setSubmitted(true)
    } catch {
      showToast({ kind: 'danger', text: 'Failed to submit inspection.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in bg-surface-page">
        <CheckCircle2 className="w-16 h-16 text-ok" />
        <h2 className="text-[20px] font-bold text-txt-primary">Inspection Filed</h2>
        <p className="text-[14px] text-txt-secondary max-w-sm text-center">
          The inspection has been recorded with all readings, photos, and violations.
        </p>
        <button
          onClick={() => {
            setSubmitted(false)
            setIndustryId('')
            setReadings(DEFAULT_PARAMS.map(p => ({ id: uid(), parameter: p.parameter, value: '', unit: p.unit })))
            setViolations([])
            setPhotos([])
            setNotes('')
          }}
          className="px-6 py-2 rounded-pill bg-primary text-white font-bold text-[14px] hover:bg-primary-dark"
        >
          File another
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface-page animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-bdr bg-white flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-txt-primary">On-Site Checklist</h2>
          <p className="text-[12px] text-txt-secondary">Record field readings, photos and violations</p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Industry + Date */}
        <section className="rounded-xl border border-bdr bg-white p-4 space-y-3 shadow-card">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-txt-tertiary">Inspection Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-txt-secondary mb-1">Industry ID *</label>
              <input
                value={industryId}
                onChange={e => setIndustryId(e.target.value)}
                placeholder="Paste industry UUID…"
                className="w-full px-3 py-2 rounded-lg border border-bdr text-[13px] outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-txt-secondary mb-1">Visit date & time *</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-bdr text-[13px] outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-txt-secondary mb-1">General observations / notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Overall site condition, compliance posture, any immediate actions taken…"
              className="w-full px-3 py-2 rounded-lg border border-bdr text-[13px] outline-none focus:ring-2 focus:ring-primary/30 bg-white resize-none"
            />
          </div>
        </section>

        {/* Parameter readings */}
        <section className="rounded-xl border border-bdr bg-white p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-txt-tertiary">Parameter Readings</h3>
            <button type="button" onClick={addReading}
              className="flex items-center gap-1 text-[12px] text-primary font-semibold hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add row
            </button>
          </div>
          <div className="space-y-2">
            {readings.map(row => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center">
                <input
                  value={row.parameter}
                  onChange={e => updateReading(row.id, 'parameter', e.target.value)}
                  placeholder="Parameter"
                  className="px-2 py-1.5 rounded-lg border border-bdr text-[12px] outline-none focus:ring-1 focus:ring-primary/30 bg-white"
                />
                <input
                  value={row.value}
                  onChange={e => updateReading(row.id, 'value', e.target.value)}
                  placeholder="Observed value"
                  type="number"
                  step="any"
                  className="px-2 py-1.5 rounded-lg border border-bdr text-[12px] outline-none focus:ring-1 focus:ring-primary/30 bg-white"
                />
                <input
                  value={row.unit}
                  onChange={e => updateReading(row.id, 'unit', e.target.value)}
                  placeholder="Unit"
                  className="px-2 py-1.5 rounded-lg border border-bdr text-[12px] outline-none focus:ring-1 focus:ring-primary/30 bg-white"
                />
                <button type="button" onClick={() => removeReading(row.id)}
                  className="p-1.5 rounded-lg hover:bg-danger-light text-txt-tertiary hover:text-danger transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Photos */}
        <section className="rounded-xl border border-bdr bg-white p-4 shadow-card">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-txt-tertiary mb-3">Site Photos</h3>
          <label className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-bdr hover:border-primary cursor-pointer transition-colors text-[13px] text-txt-secondary hover:text-primary">
            <Camera className="w-5 h-5" />
            <span>Attach photos (demo: file names stored)</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {photos.map(name => (
                <div key={name} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-page border border-bdr text-[11px] text-txt-secondary">
                  <Camera className="w-3 h-3 text-txt-tertiary" />
                  <span className="max-w-[120px] truncate">{name}</span>
                  <button type="button" onClick={() => removePhoto(name)} className="text-txt-tertiary hover:text-danger">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Violations */}
        <section className="rounded-xl border border-bdr bg-white p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-txt-tertiary">
              Violations Detected <span className="text-txt-tertiary font-normal normal-case">({violations.length})</span>
            </h3>
            <button type="button" onClick={addViolation}
              className="flex items-center gap-1 text-[12px] text-danger font-semibold hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add violation
            </button>
          </div>
          {violations.length === 0 && (
            <p className="text-[12px] text-txt-tertiary italic">No violations recorded.</p>
          )}
          <div className="space-y-3">
            {violations.map(v => (
              <div key={v.id} className={`rounded-xl border p-3 space-y-2 ${SEVERITY_COLOR[v.severity]}`} style={{ borderColor: 'currentColor', opacity: 0.9 }}>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                  <input
                    value={v.parameter}
                    onChange={e => updateViolation(v.id, 'parameter', e.target.value)}
                    placeholder="Parameter (e.g. BOD, PM10)"
                    className="px-2 py-1.5 rounded-lg border border-bdr text-[12px] outline-none focus:ring-1 focus:ring-primary/30 bg-white text-txt-primary col-span-1"
                  />
                  <button type="button" onClick={() => removeViolation(v.id)}
                    className="p-1.5 rounded-lg hover:bg-white text-current transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase">Observed</label>
                    <input value={v.observedValue} onChange={e => updateViolation(v.id, 'observedValue', e.target.value)}
                      placeholder="value" type="number" step="any"
                      className="w-full mt-0.5 px-2 py-1 rounded-lg border border-bdr text-[12px] outline-none bg-white text-txt-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase">Norm</label>
                    <input value={v.normValue} onChange={e => updateViolation(v.id, 'normValue', e.target.value)}
                      placeholder="limit" type="number" step="any"
                      className="w-full mt-0.5 px-2 py-1 rounded-lg border border-bdr text-[12px] outline-none bg-white text-txt-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase">Unit</label>
                    <input value={v.unit} onChange={e => updateViolation(v.id, 'unit', e.target.value)}
                      placeholder="mg/L…"
                      className="w-full mt-0.5 px-2 py-1 rounded-lg border border-bdr text-[12px] outline-none bg-white text-txt-primary" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold uppercase">Severity</label>
                  <div className="relative">
                    <select
                      value={v.severity}
                      onChange={e => updateViolation(v.id, 'severity', e.target.value)}
                      className="appearance-none pl-2 pr-6 py-1 rounded-lg border border-bdr text-[12px] outline-none bg-white text-txt-primary font-semibold"
                    >
                      <option value="MINOR">MINOR</option>
                      <option value="MAJOR">MAJOR</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1.5 w-3 h-3 pointer-events-none text-txt-tertiary" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Submit */}
        <div className="pb-6 flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-pill bg-primary text-white font-bold text-[14px] hover:bg-primary-dark disabled:opacity-50 transition-colors shadow-modal"
          >
            {submitting ? (
              <><span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full inline-block" /> Submitting…</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> File Inspection</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
