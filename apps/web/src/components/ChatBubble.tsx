/**
 * ChatBubble — user / assistant chat bubble + optional citation chips + inline charts.
 *
 * Uses the KSK-cloned chat-bubble-user / chat-bubble-bot Tailwind classes
 * already defined in apps/web/src/index.css.
 */

import { FileText, BarChart2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Citation, ChartSpec } from '../context/ChatContext.js'

// ── Chart colours ───────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#1F66B4', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6',
  '#f97316', '#6366f1',
]

// ── Recharts data format ─────────────────────────────────────────────────────
// recharts expects an array of objects with named keys.
// We convert the multi-series format: [{x, y}] → [{name: x, series1: y, series2: y}]

function buildRechartsData(
  series: ChartSpec['series'],
): Record<string, string | number>[] {
  if (!series || series.length === 0) return []

  // Collect all x values in order
  const allX: (string | number)[] = []
  const xSeen = new Set<string | number>()
  for (const s of series) {
    for (const pt of s.data) {
      if (!xSeen.has(pt.x)) {
        allX.push(pt.x)
        xSeen.add(pt.x)
      }
    }
  }

  return allX.map((x) => {
    const row: Record<string, string | number> = { name: String(x) }
    for (const s of series) {
      const pt = s.data.find((d) => d.x === x)
      row[s.name] = pt ? pt.y : 0
    }
    return row
  })
}

// ── Pie data format ──────────────────────────────────────────────────────────

function buildPieData(series: ChartSpec['series']) {
  // For pie charts, flatten all series data points into {name, value}
  const result: Array<{ name: string; value: number }> = []
  for (const s of series) {
    for (const pt of s.data) {
      result.push({ name: String(pt.x), value: pt.y })
    }
  }
  return result
}

// ── Inline chart component ────────────────────────────────────────────────────

interface InlineChartProps {
  spec: ChartSpec
  onOpenCanvas?: (module: string) => void
}

function InlineChart({ spec, onOpenCanvas }: InlineChartProps) {
  const { chartType, title, xLabel, yLabel, series, description, canvasHint } = spec
  const data = buildRechartsData(series)
  const pieData = buildPieData(series)

  const seriesKeys = series.map((s) => s.name)

  const renderChart = () => {
    switch (chartType) {
      case 'PIE':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => v.toLocaleString()} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'LINE':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -2, fontSize: 11 } : undefined}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11 } : undefined}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {seriesKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={data.length < 20}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )

      case 'AREA':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -2, fontSize: 11 } : undefined}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11 } : undefined}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {seriesKeys.map((key, i) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  fill={CHART_COLORS[i % CHART_COLORS.length] + '33'}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )

      case 'BAR':
      default:
        return (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={data.length > 6 ? -35 : 0}
                textAnchor={data.length > 6 ? 'end' : 'middle'}
                height={data.length > 6 ? 60 : 30}
                label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -2, fontSize: 11 } : undefined}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11 } : undefined}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {seriesKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )
    }
  }

  return (
    <div className="w-full max-w-[640px] rounded-2xl bg-white border border-bdr-light shadow-card p-4 mt-1">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <BarChart2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-[13px] font-bold text-txt-primary">{title}</span>
          </div>
          {description && (
            <p className="text-[11px] text-txt-secondary leading-snug">{description}</p>
          )}
        </div>
      </div>

      {/* Chart */}
      {renderChart()}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-txt-tertiary">Source: real-time GPCB data</span>
        {canvasHint && onOpenCanvas && (
          <button
            type="button"
            onClick={() => onOpenCanvas(canvasHint)}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Open as canvas →
          </button>
        )}
      </div>
    </div>
  )
}

// ── ChatBubble ───────────────────────────────────────────────────────────────

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  chartSpec?: ChartSpec
  onCitationClick?: (c: Citation) => void
  onOpenCanvas?: (module: string) => void
}

export function ChatBubble({
  role,
  content,
  citations,
  chartSpec,
  onCitationClick,
  onOpenCanvas,
}: ChatBubbleProps) {
  const isUser = role === 'user'
  const bubbleClass = isUser ? 'chat-bubble-user' : 'chat-bubble-bot'

  if (!isUser && chartSpec) {
    // Chart message — render the chart card directly (no text bubble wrapper)
    return (
      <div className="flex flex-col items-start w-full">
        <InlineChart spec={chartSpec} onOpenCanvas={onOpenCanvas} />
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full`}>
      <div className={bubbleClass}>
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{content}</div>
      </div>

      {!isUser && citations && citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 max-w-[85%]">
          {citations.map((c, i) => (
            <button
              key={`${c.docId}-${i}`}
              type="button"
              onClick={() => onCitationClick?.(c)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-pill bg-primary-light text-primary text-[11px] font-medium hover:bg-primary-50 border border-primary/20 transition"
              title={c.snippet}
            >
              <FileText className="w-3 h-3" />
              <span className="truncate max-w-[180px]">{c.docTitle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Animated 3-dot "typing" indicator. */
export function TypingDots() {
  return (
    <div className="chat-bubble-bot inline-flex items-center gap-1 py-2">
      <span className="w-1.5 h-1.5 rounded-full bg-txt-tertiary animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-txt-tertiary animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-txt-tertiary animate-bounce" />
    </div>
  )
}
