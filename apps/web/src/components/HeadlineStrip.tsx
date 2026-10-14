/**
 * HeadlineStrip — one fold at the top of the home page: the five numbers
 * this role should see before opening any module. Each tile shows the value,
 * a ring against its target where one exists, and the coverage behind it.
 * Tapping a tile opens the module that owns the number. (PM-SETU port.)
 */

import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.js'
import { useChat } from '../context/ChatContext.js'

interface HeadlineItem {
  key: string
  label: string
  value: string
  pct: number | null
  target: string | null
  hint: string
  tone: keyof typeof TONE
  canvas: string | null
}

interface Headline {
  title: string
  items: HeadlineItem[]
}

const TONE = {
  indigo:  { ring: '#4f46e5', fg: 'text-indigo-700' },
  sky:     { ring: '#0284c7', fg: 'text-sky-700' },
  fuchsia: { ring: '#c026d3', fg: 'text-fuchsia-700' },
  amber:   { ring: '#d97706', fg: 'text-amber-700' },
  rose:    { ring: '#e11d48', fg: 'text-rose-700' },
  emerald: { ring: '#059669', fg: 'text-emerald-700' },
  violet:  { ring: '#7c3aed', fg: 'text-violet-700' },
  teal:    { ring: '#0d9488', fg: 'text-teal-700' },
} as const

function Ring({ pct, color, size = 40 }: { pct: number | null; color: string; size?: number }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-black/[0.06]" />
      {pct != null && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${(c * p) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-txt-primary" style={{ fontSize: 11, fontWeight: 700 }}>
        {pct == null ? '—' : `${Math.round(p)}%`}
      </text>
    </svg>
  )
}

export default function HeadlineStrip() {
  const { token, user } = useAuth()
  const { openCanvas } = useChat()
  const [data, setData] = useState<Headline | null>(null)
  const role = user?.role

  useEffect(() => {
    if (!token) return
    let on = true
    setData(null)
    api<Headline>('/api/stats/headline', { token })
      .then((d) => { if (on) setData(d) })
      .catch(() => { if (on) setData({ title: '', items: [] }) })
    return () => { on = false }
  }, [token, role])

  if (!data) {
    return (
      <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[92px] rounded-2xl bg-white border border-bdr-light animate-pulse" />)}
      </div>
    )
  }
  if (!data.items.length) return null

  return (
    <div className="mt-7">
      <div className="flex items-baseline justify-between gap-3 mb-2.5 px-0.5">
        <div className="text-[11px] font-bold uppercase tracking-[2px] text-txt-tertiary">Headline</div>
        {data.title && <div className="text-[12px] text-txt-secondary truncate">{data.title}</div>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {data.items.map((it) => {
          const t = TONE[it.tone] ?? TONE.indigo
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => it.canvas && openCanvas(it.canvas)}
              className={`text-left rounded-2xl bg-white border border-bdr-light p-3.5 hover:shadow-card transition flex items-start gap-3 min-w-0 ${it.canvas ? '' : 'cursor-default'}`}
            >
              <div className="flex-1 min-w-0">
                <div className={`text-[10px] font-bold uppercase tracking-wider ${t.fg} leading-tight line-clamp-2`}>{it.label}</div>
                <div className="text-[22px] leading-tight font-bold text-txt-primary mt-1 tabular-nums break-words">{it.value}</div>
                {it.target && <div className="text-[10px] text-txt-secondary truncate mt-0.5">{it.target}</div>}
                {it.hint && <div className="text-[10px] text-txt-tertiary truncate">{it.hint}</div>}
              </div>
              {(it.pct != null || it.target) && <Ring pct={it.pct} color={t.ring} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
