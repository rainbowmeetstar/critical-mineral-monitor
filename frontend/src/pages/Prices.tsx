import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown, Download } from 'lucide-react'

const DAYS_OPTIONS = [7, 30, 90, 365]
const CATEGORY_FILTER = [
  { value: '', label: '全部' },
  { value: 'rare_earth', label: '稀土' },
  { value: 'battery', label: '电池金属' },
  { value: 'strategic', label: '战略矿产' },
  { value: 'pgm', label: '铂族金属' },
]

export default function Prices() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [days, setDays] = useState(30)
  const [category, setCategory] = useState('')

  const { data: minerals } = useQuery({
    queryKey: ['minerals', category],
    queryFn: () => api.getMinerals(category || undefined),
  })

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['price-history', selectedId, days],
    queryFn: () => api.getPriceHistory(selectedId!, days),
    enabled: !!selectedId,
  })

  const selectedMineral = minerals?.find(m => m.id === selectedId)

  const chartData = history?.prices.map(p => ({
    date: format(new Date(p.timestamp), 'MM-dd HH:mm'),
    price: p.price,
  })) ?? []

  const latest = history?.prices.at(-1)
  const first = history?.prices.at(0)
  const totalChange = latest && first
    ? ((latest.price - first.price) / first.price) * 100
    : null

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {CATEGORY_FILTER.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                category === c.value
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectedId && (
            <a
              href={api.exportPrices(days, selectedId)}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />导出 CSV
            </a>
          )}
          <div className="flex gap-1">
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                days === d
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {d}天
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Mineral List */}
        <div className="col-span-1 card h-[600px] overflow-y-auto space-y-1 pr-1">
          <h3 className="font-medium text-slate-300 text-sm mb-3 sticky top-0 bg-slate-900 py-1">
            选择矿产
          </h3>
          {minerals?.map(m => {
            const pct = m.latest_price?.price_change_pct
            const up = pct !== null && pct !== undefined && pct >= 0
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  selectedId === m.id
                    ? 'bg-sky-600/20 border border-sky-600/40'
                    : 'hover:bg-slate-800 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">{m.name_zh ?? m.name}</span>
                  <span className="text-xs text-slate-500">{m.symbol}</span>
                </div>
                {m.latest_price ? (
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-sky-300">{m.latest_price.price.toFixed(2)}</span>
                    {pct !== null && pct !== undefined && (
                      <span className={`text-xs ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                        {up ? '+' : ''}{pct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 mt-0.5">暂无价格</div>
                )}
              </button>
            )
          })}
          {!minerals?.length && (
            <p className="text-slate-500 text-sm text-center py-8">暂无数据</p>
          )}
        </div>

        {/* Chart */}
        <div className="col-span-2 lg:col-span-3 card">
          {selectedMineral ? (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {selectedMineral.name_zh ?? selectedMineral.name}
                    <span className="text-slate-500 font-normal text-base ml-2">
                      ({selectedMineral.symbol})
                    </span>
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    单位: {history?.unit ?? selectedMineral.price_unit}
                  </p>
                </div>
                {totalChange !== null && (
                  <div className={`text-right ${totalChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    <div className="flex items-center gap-1 justify-end text-lg font-bold">
                      {totalChange >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(2)}%
                    </div>
                    <div className="text-xs text-slate-500">{days}天区间涨跌</div>
                  </div>
                )}
              </div>

              {histLoading ? (
                <div className="h-64 flex items-center justify-center text-slate-500">加载价格数据...</div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={false}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        color: '#e2e8f0',
                      }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#0ea5e9' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                  <TrendingUp className="w-10 h-10 mb-3 opacity-20" />
                  <p>暂无价格历史数据</p>
                  <p className="text-xs mt-1">点击右上角「刷新数据」触发抓取</p>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20">
              <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
              <p>从左侧选择矿产查看价格走势</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
