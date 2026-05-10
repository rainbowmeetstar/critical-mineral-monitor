import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown, Download, Activity, Newspaper, BarChart2 } from 'lucide-react'
import type { ForecastOut } from '../types'

// ── Outlook badge ──────────────────────────────────────────────────────────────
const OUTLOOK_STYLE: Record<string, string> = {
  '看涨':   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  '温和看涨':'bg-teal-500/20 text-teal-400 border-teal-500/30',
  '中性':   'bg-stone-600/30 text-stone-400 border-stone-600/40',
  '温和看跌':'bg-amber-500/20 text-amber-400 border-amber-500/30',
  '看跌':   'bg-red-500/20 text-red-400 border-red-500/30',
  '数据不足':'bg-stone-700/30 text-stone-500 border-stone-700/40',
}
const OUTLOOK_ICON: Record<string, string> = {
  '看涨': '▲', '温和看涨': '↗', '中性': '—', '温和看跌': '↘', '看跌': '▼', '数据不足': '?',
}

function ForecastCard({ forecast }: { forecast: ForecastOut }) {
  const badgeStyle = OUTLOOK_STYLE[forecast.outlook] ?? OUTLOOK_STYLE['中性']
  const isInsufficient = forecast.outlook === '数据不足'

  return (
    <div className="mt-5 border-t border-stone-800 pt-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <Activity className="w-4 h-4 text-stone-400 shrink-0" />
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">智能价格展望</span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeStyle}`}>
          {OUTLOOK_ICON[forecast.outlook]} {forecast.outlook}
        </span>
        <span className="text-xs text-stone-600 ml-auto">
          基于{forecast.data_points}个交易日 · 技术+资讯融合分析
        </span>
      </div>

      {isInsufficient ? (
        <p className="text-xs text-stone-600 text-center py-3">
          历史数据补充中（当前{forecast.data_points}条），稍后刷新即可查看完整分析。
        </p>
      ) : (
        <>
          {/* Natural language outlook */}
          <div className="bg-stone-800/40 rounded-xl px-4 py-3 text-sm text-stone-300 leading-relaxed border border-stone-700/40">
            {forecast.outlook_text}
          </div>

          {/* Technical indicators row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
            {[
              { label: 'MA7',   v: forecast.ma7?.toFixed(2)   ?? '—', color: '' },
              { label: 'MA30',  v: forecast.ma30?.toFixed(2)  ?? '—', color: '' },
              { label: 'MA90',  v: forecast.ma90?.toFixed(2)  ?? '—', color: '' },
              { label: 'RSI(14)', v: forecast.rsi14 != null ? forecast.rsi14.toFixed(0) : '—',
                color: (forecast.rsi14 ?? 50) > 70 ? 'text-red-400' : (forecast.rsi14 ?? 50) < 30 ? 'text-emerald-400' : '' },
              { label: '7日涨跌', v: forecast.momentum_7d_pct != null ? `${forecast.momentum_7d_pct >= 0 ? '+' : ''}${forecast.momentum_7d_pct.toFixed(1)}%` : '—',
                color: (forecast.momentum_7d_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: '30日涨跌', v: forecast.momentum_30d_pct != null ? `${forecast.momentum_30d_pct >= 0 ? '+' : ''}${forecast.momentum_30d_pct.toFixed(1)}%` : '—',
                color: (forecast.momentum_30d_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: '年化波动', v: forecast.volatility_30d_pct != null ? `${forecast.volatility_30d_pct.toFixed(0)}%` : '—', color: 'text-amber-400' },
              { label: '7日预测区间', v: forecast.forecast_7d_low != null ? `${forecast.forecast_7d_low.toFixed(1)}–${forecast.forecast_7d_high?.toFixed(1)}` : '—', color: 'text-orange-300' },
            ].map(({ label, v, color }) => (
              <div key={label} className="bg-stone-800/60 rounded-lg px-2.5 py-2 text-center">
                <div className="text-xs text-stone-500 mb-0.5">{label}</div>
                <div className={`text-sm font-medium ${color || 'text-white'}`}>{v}</div>
              </div>
            ))}
          </div>

          {/* Signal breakdown + news */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Signal breakdown */}
            <div className="bg-stone-800/30 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart2 className="w-3.5 h-3.5 text-stone-500" />
                <span className="text-xs text-stone-500 font-medium">信号分解</span>
                <span className="ml-auto text-xs text-stone-600">综合评分 {forecast.composite_score > 0 ? '+' : ''}{forecast.composite_score.toFixed(2)}</span>
              </div>
              <div className="space-y-1.5">
                {forecast.signal_breakdown.map(sig => (
                  <div key={sig.label} className="flex items-center gap-2">
                    <span className="text-xs text-stone-500 w-20 shrink-0">{sig.label}</span>
                    <span className={`text-xs flex-1 ${sig.direction === 'bull' ? 'text-emerald-400' : sig.direction === 'bear' ? 'text-red-400' : 'text-stone-400'}`}>
                      {sig.value}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <div className="w-16 h-1.5 bg-stone-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${sig.direction === 'bull' ? 'bg-emerald-500' : sig.direction === 'bear' ? 'bg-red-500' : 'bg-stone-500'}`}
                          style={{ width: `${Math.min(Math.abs(sig.score) / 1.5 * 100, 100)}%`, marginLeft: sig.score < 0 ? 'auto' : undefined }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* News sentiment */}
            <div className="bg-stone-800/30 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Newspaper className="w-3.5 h-3.5 text-stone-500" />
                <span className="text-xs text-stone-500 font-medium">资讯情感面（近30日）</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '近7日热度', v: forecast.news_7d_total, color: forecast.news_7d_total > 3 ? 'text-orange-400' : 'text-stone-400' },
                  { label: '政策资讯', v: forecast.news_30d_policy, color: forecast.news_30d_policy > 0 ? 'text-amber-400' : 'text-stone-400' },
                  { label: '价格资讯', v: forecast.news_30d_price, color: forecast.news_30d_price > 0 ? 'text-emerald-400' : 'text-stone-400' },
                  { label: '勘探资讯', v: forecast.news_30d_exploration, color: forecast.news_30d_exploration > 0 ? 'text-purple-400' : 'text-stone-400' },
                ].map(({ label, v, color }) => (
                  <div key={label} className="flex items-center justify-between bg-stone-800/60 rounded-lg px-2.5 py-1.5">
                    <span className="text-xs text-stone-500">{label}</span>
                    <span className={`text-sm font-medium ${color}`}>{v} 篇</span>
                  </div>
                ))}
              </div>
              {forecast.news_7d_total === 0 && forecast.news_30d_policy === 0 && (
                <p className="text-xs text-stone-600 mt-2 text-center">暂无相关资讯，已基于技术面分析</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

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

  const { data: forecast } = useQuery({
    queryKey: ['forecast', selectedId],
    queryFn: () => api.getForecast(selectedId!),
    enabled: !!selectedId,
    staleTime: 5 * 60_000,
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
                  ? 'bg-orange-600 text-white'
                  : 'bg-stone-800 text-stone-400 hover:text-white'
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-white text-xs transition-colors"
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
                  ? 'bg-orange-600 text-white'
                  : 'bg-stone-800 text-stone-400 hover:text-white'
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
          <h3 className="font-medium text-stone-300 text-sm mb-3 sticky top-0 bg-stone-900 py-1">
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
                    ? 'bg-orange-600/20 border border-orange-600/40'
                    : 'hover:bg-stone-800 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">{m.name_zh ?? m.name}</span>
                  <span className="text-xs text-stone-500">{m.symbol}</span>
                </div>
                {m.latest_price ? (
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-orange-300">{m.latest_price.price.toFixed(2)}</span>
                    {pct !== null && pct !== undefined && (
                      <span className={`text-xs ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                        {up ? '+' : ''}{pct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-stone-600 mt-0.5">暂无价格</div>
                )}
              </button>
            )
          })}
          {!minerals?.length && (
            <p className="text-stone-500 text-sm text-center py-8">暂无数据</p>
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
                    <span className="text-stone-500 font-normal text-base ml-2">
                      ({selectedMineral.symbol})
                    </span>
                  </h2>
                  <p className="text-sm text-stone-500 mt-0.5">
                    单位: {history?.unit ?? selectedMineral.price_unit}
                  </p>
                </div>
                {totalChange !== null && (
                  <div className={`text-right ${totalChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    <div className="flex items-center gap-1 justify-end text-lg font-bold">
                      {totalChange >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(2)}%
                    </div>
                    <div className="text-xs text-stone-500">{days}天区间涨跌</div>
                  </div>
                )}
              </div>

              {histLoading ? (
                <div className="h-64 flex items-center justify-center text-stone-500">加载价格数据...</div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#78716c', fontSize: 11 }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: '#78716c', fontSize: 11 }}
                      tickLine={false}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0c0a09',
                        border: '1px solid #292524',
                        borderRadius: '8px',
                        color: '#e7e5e4',
                      }}
                      labelStyle={{ color: '#a8a29e' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#f97316' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-stone-500">
                  <TrendingUp className="w-10 h-10 mb-3 opacity-20" />
                  <p>暂无价格历史数据</p>
                  <p className="text-xs mt-1">点击右上角「刷新数据」触发抓取</p>
                </div>
              )}

              {/* AI Forecast Card */}
              {forecast && <ForecastCard forecast={forecast} />}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-stone-500 py-20">
              <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
              <p>从左侧选择矿产查看价格走势</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
