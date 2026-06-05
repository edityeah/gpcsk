import { useState, useEffect, useCallback } from 'react'
import { RadarIcon, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { Spinner } from '../../../components/ui/Spinner.js'

interface Industry {
  id: string
  name: string
  ucNumber: string
  category: string
}

interface ConsentItem {
  id: string
  type: 'CTE' | 'CTO' | 'HW_AUTH'
  state: string
  validityTo: string | null
  industry: Industry
}

interface ApiResponse {
  items: ConsentItem[]
  nextCursor?: string
}

interface BucketedItem extends ConsentItem {
  daysLeft: number
  bucket: '30d' | '60d' | '90d'
}

const BUCKET_COLORS = { '30d': '#E53935', '60d': '#FFB300', '90d': '#4CAF50' }
const BUCKET_LABELS = { '30d': '≤ 30 days', '60d': '31–60 days', '90d': '61–90 days' }

interface Props {
  args?: Record<string, unknown>
}

export default function RenewalRadarCanvas(_: Props) {
  const { token } = useAuth()
  const [items, setItems] = useState<BucketedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await api<ApiResponse>('/api/consents?expiringWithinDays=90&limit=100', { token })
      const now = Date.now()
      const bucketed: BucketedItem[] = data.items
        .filter(i => i.validityTo)
        .map(i => {
          const daysLeft = Math.ceil((new Date(i.validityTo!).getTime() - now) / 86400000)
          const bucket: '30d' | '60d' | '90d' = daysLeft <= 30 ? '30d' : daysLeft <= 60 ? '60d' : '90d'
          return { ...i, daysLeft, bucket }
        })
        .sort((a, b) => a.daysLeft - b.daysLeft)

      setItems(bucketed)
    } catch {
      setError('Failed to load renewal radar data.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const chartData = [
    { name: '≤ 30d', count: items.filter(i => i.bucket === '30d').length, fill: BUCKET_COLORS['30d'] },
    { name: '31–60d', count: items.filter(i => i.bucket === '60d').length, fill: BUCKET_COLORS['60d'] },
    { name: '61–90d', count: items.filter(i => i.bucket === '90d').length, fill: BUCKET_COLORS['90d'] },
  ]

  return (
    <div className="flex flex-col h-full bg-surface-page rounded-card overflow-hidden animate-bubble-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-danger-light flex items-center justify-center flex-shrink-0">
          <RadarIcon className="w-5 h-5 text-danger" />
        </div>
        <div>
          <div className="text-[14px] font-bold text-txt-primary">Renewal Radar</div>
          <div className="text-[11px] text-txt-secondary">Consents expiring within 90 days</div>
        </div>
        <div className="ml-auto text-[22px] font-bold text-txt-primary">{items.length}</div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Spinner size={36} />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-[13px] text-danger">{error}</p>
        </div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="bg-white px-5 py-4 border-b border-bdr-light">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7383A5' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#7383A5' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #CFD8E6', fontSize: 12 }}
                  formatter={(v: number) => [v, 'Consents']}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 justify-center">
              {(['30d', '60d', '90d'] as const).map(b => (
                <div key={b} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: BUCKET_COLORS[b] }} />
                  <span className="text-[10px] text-txt-secondary">{BUCKET_LABELS[b]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {items.length === 0 && (
              <div className="text-center text-[13px] text-txt-tertiary py-8">No upcoming renewals.</div>
            )}
            {items.map(item => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-card border border-bdr-light px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-txt-primary truncate">{item.industry.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-txt-tertiary">{item.industry.ucNumber}</span>
                    <span className="text-[10px] border border-bdr text-txt-secondary px-1.5 py-0.5 rounded-full">{item.type}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <div
                    className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full"
                    style={{
                      background: `${BUCKET_COLORS[item.bucket]}20`,
                      color: BUCKET_COLORS[item.bucket],
                    }}
                  >
                    <Clock className="w-3 h-3" />
                    {item.daysLeft}d left
                  </div>
                  <div className="text-[10px] text-txt-tertiary mt-1">
                    {new Date(item.validityTo!).toLocaleDateString('en-IN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
