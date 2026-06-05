import { useState, useEffect, useCallback } from 'react'
import { BarChart2 } from 'lucide-react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ZAxis, Legend,
} from 'recharts'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.js'
import { Spinner } from '../../../components/ui/Spinner.js'

interface Industry {
  id: string
  name: string
  ucNumber: string
  category: string
  capacity: Record<string, unknown>
}

interface IndustriesApiResponse {
  items: Industry[]
  nextCursor?: string
}

interface ConsentItem {
  id: string
  type: string
  state: string
  parameters: Record<string, unknown>
  industry: Industry
}

interface ConsentsApiResponse {
  items: ConsentItem[]
  nextCursor?: string
}

interface ScatterPoint {
  x: number
  y: number
  name: string
  ucNumber: string
  category: string
}

const CAT_COLORS: Record<string, string> = {
  RED: '#E53935', ORANGE: '#FFB300', GREEN: '#4CAF50', WHITE: '#7383A5',
}

interface Props {
  args?: Record<string, unknown>
}

// Custom tooltip for scatter chart
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint }> }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-white border border-bdr rounded-xl shadow-card px-3 py-2 text-[12px]">
      <div className="font-bold text-txt-primary truncate max-w-[200px]">{d.name}</div>
      <div className="text-txt-secondary">{d.ucNumber}</div>
      <div className="mt-1 text-txt-primary">
        <span className="font-semibold">Capacity:</span> {d.x} TPD
      </div>
      <div className="text-txt-primary">
        <span className="font-semibold">Consent ceiling:</span> {d.y} TPD
      </div>
    </div>
  )
}

export default function CapacityVsConsentCanvas(_: Props) {
  const { token } = useAuth()
  const [points, setPoints] = useState<Record<string, ScatterPoint[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      // Get CTO consents (which have waterIntake.kLD as a proxy for consent ceiling)
      const consentsData = await api<ConsentsApiResponse>(
        '/api/consents?type=CTO&state=APPROVED&limit=80',
        { token },
      )

      const byCategory: Record<string, ScatterPoint[]> = {
        RED: [], ORANGE: [], GREEN: [], WHITE: [],
      }

      for (const item of consentsData.items) {
        const capacityTPD = (item.industry.capacity as { productionTPD?: number }).productionTPD ?? 0
        const params = item.parameters as { waterIntake?: { kLD?: number } }
        const consentCeiling = params.waterIntake?.kLD ?? 0

        if (capacityTPD <= 0 || consentCeiling <= 0) continue

        const cat = item.industry.category as string
        if (byCategory[cat] !== undefined) {
          byCategory[cat]!.push({
            x: capacityTPD,
            y: consentCeiling,
            name: item.industry.name,
            ucNumber: item.industry.ucNumber,
            category: cat,
          })
        }
      }

      setPoints(byCategory)
    } catch {
      setError('Failed to load capacity data.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const categories = Object.entries(points).filter(([, pts]) => pts.length > 0)
  const totalPoints = categories.reduce((s, [, pts]) => s + pts.length, 0)

  return (
    <div className="flex flex-col h-full bg-surface-page rounded-card overflow-hidden animate-bubble-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-bdr-light">
        <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
          <BarChart2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-[14px] font-bold text-txt-primary">Capacity vs Consent</div>
          <div className="text-[11px] text-txt-secondary">Production capacity (TPD) vs declared consent ceiling (kLD)</div>
        </div>
        <div className="ml-auto text-[13px] font-semibold text-txt-secondary">{totalPoints} industries</div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Spinner size={36} />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-[13px] text-danger">{error}</p>
        </div>
      ) : totalPoints === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-[13px] text-txt-tertiary">No approved CTO data available.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden px-5 py-4">
          <div className="bg-white rounded-xl shadow-card border border-bdr-light p-4 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Capacity (TPD)"
                  tick={{ fontSize: 11, fill: '#7383A5' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Capacity (TPD)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#7383A5' }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Consent Ceiling (kLD)"
                  tick={{ fontSize: 11, fill: '#7383A5' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Ceiling (kLD)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: '#7383A5' }}
                />
                <ZAxis range={[40, 40]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                  formatter={(value) => <span style={{ color: '#7383A5' }}>{value}</span>}
                />
                {categories.map(([cat, pts]) => (
                  <Scatter
                    key={cat}
                    name={cat}
                    data={pts}
                    fill={CAT_COLORS[cat] ?? '#7383A5'}
                    fillOpacity={0.7}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
