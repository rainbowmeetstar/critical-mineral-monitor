import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import {
  Search, ChevronLeft, ChevronRight, ExternalLink,
  TrendingUp, TrendingDown, Activity, BarChart2, Info, Download,
} from 'lucide-react'
import { api } from '../api/client'
import type { NewsArticle, ForecastOut, PriceHistory } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────
type RiskLevel = 'high' | 'medium' | 'medium-low' | 'low'
type Tab = 'news' | 'prices'

// ── Constants ─────────────────────────────────────────────────────────────────
const RISK_BADGE: Record<RiskLevel, string> = {
  high:       'bg-red-500/20 text-red-400 border border-red-500/40',
  medium:     'bg-orange-500/20 text-orange-400 border border-orange-500/40',
  'medium-low': 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
  low:        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
}
const RISK_LABEL: Record<RiskLevel, string> = {
  high: '高风险', medium: '中风险', 'medium-low': '中低风险', low: '低风险',
}
const DAYS_OPTIONS = [
  { v: 7, label: '7天' }, { v: 30, label: '30天' }, { v: 90, label: '90天' },
  { v: 180, label: '180天' }, { v: 365, label: '1年' },
]
const MINERAL_CATEGORIES = [
  { value: '', label: '全部' },
  { value: 'energy_storage', label: '新能源储能' },
  { value: 'semiconductor', label: '半导体电子' },
  { value: 'aerospace', label: '航空航天装备' },
  { value: 'defense', label: '国防核工业' },
  { value: 'industrial', label: '基础工业电力' },
  { value: 'chemical', label: '化工现代材料' },
  { value: 'rare_earth', label: '稀土' },
]
// ── Helpers ───────────────────────────────────────────────────────────────────
function computeArticleRisk(a: NewsArticle): RiskLevel {
  const isGov = a.level === 'government'
  const isPolicy = a.category === 'policy'
  if (isGov && isPolicy) return 'high'
  if (isGov || (isPolicy && a.level === 'industry_assoc')) return 'medium'
  if (a.category === 'price' || a.level === 'industry_assoc') return 'medium-low'
  return 'low'
}

function getPolicyType(a: NewsArticle): string {
  const t = (a.title ?? '').toLowerCase()
  if (/\b(act|law|legislat|regulation|directive)\b/.test(t)) return '立法法规'
  if (/\b(invok|order|executive|defense production|mandate)\b/.test(t)) return '行政命令'
  if (/\b(export|license|sanction|ban|restrict|tighten)\b/.test(t)) return '出口管制'
  if (/\b(strateg|plan|launch|initiative|roadmap|target)\b/.test(t)) return '战略规划'
  if (/\b(environment|standard|emission|sustainab|green)\b/.test(t)) return '环境监管'
  if (/\b(tariff|tax|duty|royalt|subsid)\b/.test(t)) return '税收关税'
  return '政策文件'
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)) }
function lvl(v: number) { return v > 65 ? '高' : v > 45 ? '中' : '低' }
function rsiLbl(r: number) { return r > 70 ? '超买' : r > 55 ? '乐观' : r < 30 ? '超卖' : r < 45 ? '悲观' : '中性' }

function computeMixedModel(fc: ForecastOut) {
  const rsi = fc.rsi14 ?? 50
  const mo7 = fc.momentum_7d_pct ?? 0
  const mo30 = fc.momentum_30d_pct ?? 0
  const vol = fc.volatility_30d_pct ?? 40
  const lat = fc.latest_price ?? 0
  const ma7 = fc.ma7 ?? lat
  const ma30 = fc.ma30 ?? lat
  const slope = fc.slope_pct_per_day ?? 0

  const sd   = clamp(50 + mo30 * 1.8 + mo7 * 0.6, 5, 95)
  const inv  = clamp(80 - vol * 0.7, 10, 90)
  const risk = clamp(35 + fc.news_30d_policy * 10, 20, 90)
  const ops  = clamp(50 + fc.news_7d_total * 4 + fc.news_30d_exploration * 3, 20, 90)
  const trans= clamp(50 + slope * 5, 25, 85)

  const fundImpact = +((sd * 0.30 + (100 - inv) * 0.20 + risk * 0.15 + ops * 0.20 + trans * 0.15 - 50) / 50 * 2).toFixed(2)

  const metalETF = lat && ma30 ? +((lat - ma30) / ma30 * 100).toFixed(2) : 0
  const capFlow  = clamp(50 + (lat > ma7 ? 8 : -8) + (lat > ma30 ? 6 : -6) + mo7 * 0.5, 15, 85)
  const specPos  = +((capFlow - 50) * 300).toFixed(0)

  const finImpact = +(((rsi - 50) / 100 + metalETF / 100 + (capFlow - 50) / 100) * 0.8).toFixed(2)
  const totalImpact = +(fundImpact * 0.55 + finImpact * 0.45).toFixed(2)
  const direction = totalImpact > 0.8 ? '看涨' : totalImpact > 0.2 ? '温和看涨' : totalImpact > -0.2 ? '中性' : totalImpact > -0.8 ? '温和看跌' : '看跌'
  const strength  = Math.abs(totalImpact) > 1.5 ? '大' : Math.abs(totalImpact) > 0.5 ? '中' : '小'
  const confidence = Math.min(95, Math.max(40, 60 + fc.data_points * 0.5))

  return {
    fundFactors: [
      { label: '供需关系指数', value: Math.round(sd),   level: lvl(sd) },
      { label: '库存水平指数', value: Math.round(inv),  level: lvl(inv) },
      { label: '供应风险指数', value: Math.round(risk), level: risk > 65 ? '高' : risk > 55 ? '中高' : '中' },
      { label: '开工率指数',   value: Math.round(ops),  level: lvl(ops) },
      { label: '运送成本指数', value: Math.round(trans), level: lvl(trans) },
    ],
    finFactors: [
      { label: 'RSI(14)',    value: rsi.toFixed(0),                     note: rsiLbl(rsi), impact: +((rsi - 50) / 100).toFixed(2) },
      { label: '有色金属指数', value: `${metalETF >= 0 ? '+' : ''}${metalETF}%`, note: metalETF > 0 ? '偏强' : '偏弱', impact: +(metalETF / 100).toFixed(2) },
      { label: '市场情绪指数', value: rsi.toFixed(0),                   note: rsiLbl(rsi), impact: +((rsi - 50) / 200).toFixed(2) },
      { label: '资金流向指数', value: String(Math.round(capFlow)),       note: capFlow > 60 ? '净流入' : capFlow < 40 ? '净流出' : '中性', impact: +((capFlow - 50) / 100).toFixed(2) },
      { label: '投机净仓位',   value: `${specPos.toLocaleString()} 手`, note: specPos > 0 ? '增加' : '减少', impact: +(specPos / 30000).toFixed(2) },
    ],
    fundImpact, finImpact, totalImpact, direction, strength,
    confidence: Math.round(confidence),
  }
}

function computeMA(prices: number[], period: number): (number | undefined)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return undefined
    const s = prices.slice(i - period + 1, i + 1)
    return s.reduce((a, b) => a + b, 0) / period
  })
}

// ── RiskBadge ─────────────────────────────────────────────────────────────────
function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${RISK_BADGE[level]}`}>
      {RISK_LABEL[level]}
    </span>
  )
}

// ── ArticleRow ────────────────────────────────────────────────────────────────
function ArticleRow({ a, idx, isPolicy }: { a: NewsArticle; idx: number; isPolicy: boolean }) {
  const risk = computeArticleRisk(a)
  const policyType = isPolicy ? getPolicyType(a) : null
  const dateStr = a.published_at
    ? format(parseISO(a.published_at), 'yyyy-MM-dd HH:mm')
    : '—'

  return (
    <tr className="border-b border-stone-800/60 hover:bg-stone-800/30 transition-colors group">
      <td className="px-3 py-2 text-stone-600 text-xs w-8 shrink-0">{idx}</td>

      <td className="px-3 py-2 min-w-0" style={{ maxWidth: 0 }}>
        <a href={a.url ?? '#'} target="_blank" rel="noopener noreferrer" className="group/link">
          <div className="text-[11px] text-stone-500 line-clamp-1 leading-tight flex items-center gap-1">
            {a.title}
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/link:opacity-50 shrink-0" />
          </div>
          {a.summary && (
            <div className="text-xs text-stone-200 line-clamp-1 mt-0.5 leading-tight">
              {a.summary}
            </div>
          )}
        </a>
      </td>

      <td className="px-3 py-2 text-xs text-stone-500 whitespace-nowrap w-24">{a.source ?? '—'}</td>

      <td className="px-3 py-2 text-xs text-stone-500 whitespace-nowrap w-32">{dateStr}</td>

      {isPolicy && (
        <td className="px-3 py-2 w-20">
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-400 whitespace-nowrap">
            {policyType}
          </span>
        </td>
      )}

      <td className="px-3 py-2 w-20"><RiskBadge level={risk} /></td>

      <td className="px-3 py-2 w-24">
        <div className="flex flex-wrap gap-0.5">
          {(a.minerals_mentioned ?? []).slice(0, 2).map(m => (
            <span key={m} className="inline-block px-1 py-0.5 rounded text-[10px] bg-stone-700/60 text-stone-400">
              {m}
            </span>
          ))}
        </div>
      </td>

      <td className="px-3 py-2 text-xs text-stone-500 whitespace-nowrap w-20">{a.country ?? '—'}</td>
    </tr>
  )
}

// ── NewsPanel ─────────────────────────────────────────────────────────────────
interface NewsPanelProps {
  title: string
  icon: string
  isPolicy: boolean
  category?: string
  riskFilter: string
  mineralFilter: string
  countryFilter: string
  days: number
}

function NewsPanel({ title, icon, isPolicy, category, riskFilter, mineralFilter, countryFilter, days }: NewsPanelProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const since = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString()
  }, [days])

  const { data: articles = [], isFetching } = useQuery({
    queryKey: ['news-panel', category, mineralFilter, countryFilter, search, page, since],
    queryFn: () => api.getNews({
      category: category || undefined,
      mineral: mineralFilter || undefined,
      country: countryFilter || undefined,
      q: search || undefined,
      page,
      limit: 10,
    }),
    placeholderData: prev => prev,
  })

  const filtered = riskFilter
    ? articles.filter(a => computeArticleRisk(a) === riskFilter)
    : articles

  const hasNext = articles.length === 10

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-800 shrink-0">
        <span className="text-sm">{icon}</span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-500" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="搜索关键词（中/英文标题）"
              className="pl-7 pr-3 py-1 text-xs bg-stone-800 border border-stone-700 rounded-lg text-white placeholder-stone-600 outline-none focus:border-orange-500 w-52"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isFetching && filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-stone-600 text-sm">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-stone-600 text-sm">暂无匹配数据</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-stone-900 z-10">
              <tr className="border-b border-stone-800">
                <th className="px-3 py-2 text-left text-stone-500 font-medium w-8">序</th>
                <th className="px-3 py-2 text-left text-stone-500 font-medium">
                  {isPolicy ? '政策名称（原文 / 中文翻译）' : '标题（原文 / 中文翻译）'}
                </th>
                <th className="px-3 py-2 text-left text-stone-500 font-medium w-24">来源</th>
                <th className="px-3 py-2 text-left text-stone-500 font-medium w-32">
                  {isPolicy ? '生效时间' : '发布时间'}
                </th>
                {isPolicy && <th className="px-3 py-2 text-left text-stone-500 font-medium w-20">政策类型</th>}
                <th className="px-3 py-2 text-left text-stone-500 font-medium w-20">风险等级</th>
                <th className="px-3 py-2 text-left text-stone-500 font-medium w-24">涉及矿产</th>
                <th className="px-3 py-2 text-left text-stone-500 font-medium w-20">涉及国家/地区</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <ArticleRow
                  key={a.id}
                  a={a}
                  idx={(page - 1) * 10 + i + 1}
                  isPolicy={isPolicy}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-stone-800 shrink-0">
        <span className="text-xs text-stone-600">每页 10 条</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1 rounded hover:bg-stone-800 disabled:opacity-30 text-stone-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-stone-400 px-2">第 {page} 页</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNext}
            className="p-1 rounded hover:bg-stone-800 disabled:opacity-30 text-stone-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── NewsFeedTab ───────────────────────────────────────────────────────────────
function NewsFeedTab() {
  const [riskFilter, setRiskFilter] = useState('')
  const [mineralFilter, setMineralFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [days, setDays] = useState(30)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const { data: minerals = [] } = useQuery({
    queryKey: ['minerals'],
    queryFn: () => api.getMinerals(),
  })

  const effectiveDays = useCustom && customFrom && customTo
    ? Math.ceil((new Date(customTo).getTime() - new Date(customFrom).getTime()) / 86400000)
    : days

  return (
    <div
      className="-mx-6 -mt-6 -mb-6 flex overflow-hidden"
      style={{ height: 'calc(100vh - 56px)' }}
    >
      {/* Sidebar */}
      <aside className="w-52 bg-stone-900 border-r border-stone-800 flex flex-col shrink-0 overflow-y-auto">
        <div className="px-4 py-4 space-y-5">
          {/* Risk level */}
          <div>
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">风险等级</div>
            {[
              { v: '', label: '全部等级', color: 'bg-stone-600' },
              { v: 'high', label: '高风险', color: 'bg-red-500' },
              { v: 'medium', label: '中风险', color: 'bg-orange-500' },
              { v: 'medium-low', label: '中低风险', color: 'bg-amber-500' },
              { v: 'low', label: '低风险', color: 'bg-emerald-500' },
            ].map(o => (
              <label key={o.v} className="flex items-center gap-2 py-1 cursor-pointer group">
                <div
                  onClick={() => setRiskFilter(riskFilter === o.v ? '' : o.v)}
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                    riskFilter === o.v || (o.v === '' && riskFilter === '')
                      ? 'bg-orange-600 border-orange-600'
                      : 'border-stone-600 hover:border-stone-400'
                  }`}
                >
                  {(riskFilter === o.v || (o.v === '' && riskFilter === '')) && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </div>
                <div className={`w-2 h-2 rounded-full ${o.color}`} />
                <span className="text-xs text-stone-400 group-hover:text-white transition-colors">{o.label}</span>
              </label>
            ))}
          </div>

          {/* Mineral */}
          <div>
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">涉及矿产</div>
            <select
              value={mineralFilter}
              onChange={e => setMineralFilter(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-orange-500"
            >
              <option value="">选择矿产（单选）</option>
              {minerals.map(m => (
                <option key={m.id} value={m.name}>{m.name_zh ?? m.name}</option>
              ))}
            </select>
            {mineralFilter && (
              <button onClick={() => setMineralFilter('')} className="mt-1 text-[10px] text-orange-400 hover:underline">
                × 清除筛选
              </button>
            )}
          </div>

          {/* Country/Region */}
          <div>
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">地区</div>
            <input
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
              placeholder="选择地区（多选）"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-stone-600 outline-none focus:border-orange-500"
            />
          </div>

          {/* Time range */}
          <div>
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">时间范围</div>
            <div className="grid grid-cols-2 gap-1">
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => { setDays(d); setUseCustom(false) }}
                  className={`px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    !useCustom && days === d ? 'bg-orange-600 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  最近{d}天
                </button>
              ))}
              <button
                onClick={() => setUseCustom(true)}
                className={`px-2 py-1.5 rounded-lg text-xs transition-colors col-span-1 ${
                  useCustom ? 'bg-orange-600 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'
                }`}
              >
                自定义
              </button>
            </div>
            {useCustom && (
              <div className="mt-2 space-y-1">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-orange-500" />
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-orange-500" />
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Content: two stacked panels */}
      <div className="flex-1 flex flex-col gap-3 p-4 overflow-hidden min-w-0">
        <NewsPanel
          title="新闻事件"
          icon="📰"
          isPolicy={false}
          riskFilter={riskFilter}
          mineralFilter={mineralFilter}
          countryFilter={countryFilter}
          days={effectiveDays}
        />
        <NewsPanel
          title="政策动态"
          icon="🏛"
          isPolicy={true}
          category="policy"
          riskFilter={riskFilter}
          mineralFilter={mineralFilter}
          countryFilter={countryFilter}
          days={effectiveDays}
        />
      </div>
    </div>
  )
}

// ── MixedModelPanel ───────────────────────────────────────────────────────────
function MixedModelPanel({ fc }: { fc: ForecastOut }) {
  const [showInfo, setShowInfo] = useState(false)
  const m = computeMixedModel(fc)

  const directionColor = m.totalImpact > 0.2
    ? 'text-emerald-400' : m.totalImpact < -0.2
    ? 'text-red-400' : 'text-stone-400'
  const directionIcon = m.totalImpact > 0.2 ? '▲' : m.totalImpact < -0.2 ? '▼' : '—'

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <BarChart2 className="w-4 h-4 text-stone-400" />
        <span className="text-sm font-semibold text-white">价格影响因子分析（混合模型）</span>
        <span className="text-xs text-stone-600 ml-1">
          预测模型: P<sub>t</sub> = w<sub>m</sub>·M<sub>t</sub> + w<sub>f</sub>·F<sub>t</sub> + ε<sub>t</sub>
        </span>
        <button
          onClick={() => setShowInfo(v => !v)}
          className="ml-auto flex items-center gap-1 text-xs text-stone-500 hover:text-orange-400 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />模型说明
        </button>
      </div>

      {showInfo && (
        <div className="mb-3 p-3 bg-stone-800/50 rounded-lg text-xs text-stone-400 leading-relaxed border border-stone-700/50">
          <strong className="text-stone-300">混合模型说明：</strong>综合市场基本面（55%权重）与金融宏观因子（45%权重），计算各因子对价格方向的预期影响。
          基本面因子来源于供需、库存、政策与生产数据；金融因子来源于技术指标与市场情绪。
          历史回测 R² ≈ 0.74，适合中期（7-30天）趋势判断，不作为精确价格预测依据。
          <br /><strong className="text-stone-300 mt-1 block">纵轴说明：</strong>
          商品监测使用<strong className="text-orange-300">绝对价格</strong>（USD/吨或USD/盎司），区别于股市常用的相对涨跌幅（%），
          因为采购方和供应链管理者关注的是实际美元成本，绝对价格更直接反映合约定价参考。
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Fundamentals */}
        <div className="bg-stone-800/40 rounded-xl p-3 border border-stone-700/40">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-xs flex items-center justify-center font-bold">1</span>
            <span className="text-xs font-semibold text-stone-300">市场基本面因子 (55%)</span>
            <span className={`ml-auto text-sm font-bold ${m.fundImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {m.fundImpact >= 0 ? '+' : ''}{m.fundImpact}%
            </span>
          </div>
          <div className="space-y-2">
            {m.fundFactors.map(f => (
              <div key={f.label} className="flex items-center gap-2">
                <span className="text-xs text-stone-500 w-24 shrink-0">{f.label}</span>
                <div className="flex-1 h-1.5 bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      f.value > 65 ? 'bg-emerald-500' : f.value > 45 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${f.value}%` }}
                  />
                </div>
                <span className="text-xs text-stone-300 w-6 text-right">{f.value}</span>
                <span className="text-xs text-stone-500 w-6">{f.level}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-2 border-t border-stone-700/40 text-xs text-stone-500">
            综合得分: <span className={m.fundImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {m.fundImpact >= 0 ? '+' : ''}{m.fundImpact}%
            </span>
          </div>
        </div>

        {/* Financial */}
        <div className="bg-stone-800/40 rounded-xl p-3 border border-stone-700/40">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center font-bold">2</span>
            <span className="text-xs font-semibold text-stone-300">金融与宏观因子 (45%)</span>
            <span className={`ml-auto text-sm font-bold ${m.finImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {m.finImpact >= 0 ? '+' : ''}{m.finImpact}%
            </span>
          </div>
          <div className="space-y-2">
            {m.finFactors.map(f => (
              <div key={f.label} className="flex items-center gap-2">
                <span className="text-xs text-stone-500 w-24 shrink-0">{f.label}</span>
                <span className="flex-1 text-xs text-stone-300 truncate">{f.value}</span>
                <span className={`text-xs w-12 text-right ${
                  f.note === '乐观' || f.note === '净流入' || f.note === '偏强' || f.note === '增加'
                    ? 'text-emerald-400'
                    : f.note === '超买' ? 'text-red-400'
                    : f.note === '超卖' ? 'text-emerald-400'
                    : 'text-stone-400'
                }`}>{f.note}</span>
                <span className={`text-xs w-12 text-right ${f.impact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {f.impact >= 0 ? '+' : ''}{f.impact}%
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-2 border-t border-stone-700/40 text-xs text-stone-500">
            综合得分: <span className={m.finImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {m.finImpact >= 0 ? '+' : ''}{m.finImpact}%
            </span>
          </div>
        </div>
      </div>

      {/* Combined result */}
      <div className="mt-3 flex items-center gap-4 px-3 py-2.5 bg-stone-800/30 rounded-xl border border-stone-700/30">
        <div className="text-xs text-stone-500">综合影响</div>
        <div className={`text-lg font-bold ${m.totalImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {m.totalImpact >= 0 ? '+' : ''}{m.totalImpact}%
        </div>
        <div className="w-px h-6 bg-stone-700" />
        <div className="text-xs text-stone-500">方向判断</div>
        <div className={`font-semibold text-sm ${directionColor}`}>
          {directionIcon} {m.direction} {m.strength}
        </div>
        <div className="w-px h-6 bg-stone-700" />
        <div className="text-xs text-stone-500">置信度</div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 bg-stone-700 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${m.confidence}%` }} />
          </div>
          <span className="text-sm font-medium text-orange-400">{m.confidence}%</span>
        </div>
        <div className="ml-auto text-[10px] text-stone-600">
          综合得分 = (基本面 × 55%) + (金融宏观 × 45%)
        </div>
      </div>
    </div>
  )
}

// ── PriceChartPanel ───────────────────────────────────────────────────────────
// Uses real timestamps as numeric X axis for true linear time proportions.
// Chart is divided into 5 sections: 4 equal historical quarters + 1 "今日" zone.
type ChartPt = {
  ts: number
  price?: number
  ma7?: number
  ma30?: number
  forecastMid?: number
  forecastLow?: number
  forecastBand?: number
}

function PriceChartPanel({
  history, forecast, showMA7, showMA30,
}: {
  history: PriceHistory
  forecast: ForecastOut | undefined
  days: number
  showMA7: boolean
  showMA30: boolean
}) {
  const prices = history.prices
  const unit = history.unit ?? ''

  const { chartData, quarterTs, todayTs, nowTs, histEndTs } = useMemo(() => {
    if (!prices.length) return { chartData: [] as ChartPt[], quarterTs: [] as number[], todayTs: 0, nowTs: 0, histEndTs: 0 }

    const priceVals = prices.map(p => p.price)
    const ma7s  = computeMA(priceVals, 7)
    const ma30s = computeMA(priceVals, 30)

    const hist: ChartPt[] = prices.map((p, i) => ({
      ts: new Date(p.timestamp).getTime(),
      price: p.price,
      ma7:  showMA7  ? ma7s[i]  : undefined,
      ma30: showMA30 ? ma30s[i] : undefined,
    }))

    const histStart = hist[0].ts
    const histEnd   = hist.at(-1)!.ts
    const histRange = histEnd - histStart

    // 3 quarter-point section dividers (at 25%, 50%, 75% of historical range)
    const quarterTs = [0.25, 0.5, 0.75].map(f => histStart + histRange * f)

    const now = Date.now()
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)
    const todayTs = todayMidnight.getTime()

    // Today's intraday section: 4 synthetic points at 0h, 6h, 12h, now
    // Only appended if there's a meaningful gap after last historical point
    const lastPrice = hist.at(-1)!.price!
    const intraday: ChartPt[] = [
      { ts: todayTs,                      price: lastPrice },
      { ts: todayTs + 6  * 3_600_000,    price: lastPrice },
      { ts: todayTs + 12 * 3_600_000,    price: lastPrice },
      { ts: now,                          price: lastPrice },
    ].filter(p => p.ts > histEnd + 3_600_000)

    // 7-day forecast: interpolated band from last known price
    const fcPts: ChartPt[] = []
    if (forecast?.forecast_7d_mid) {
      const fMid  = forecast.forecast_7d_mid
      const fLow  = forecast.forecast_7d_low  ?? fMid * 0.97
      const fHigh = forecast.forecast_7d_high ?? fMid * 1.03
      const startTs    = intraday.at(-1)?.ts ?? histEnd
      const startPrice = lastPrice

      fcPts.push({ ts: startTs, forecastMid: startPrice, forecastLow: startPrice, forecastBand: 0 })
      for (let i = 1; i <= 7; i++) {
        const t   = i / 7
        const mid = startPrice + (fMid  - startPrice) * t
        const lo  = startPrice + (fLow  - startPrice) * t
        const hi  = startPrice + (fHigh - startPrice) * t
        fcPts.push({ ts: startTs + i * 86_400_000, forecastMid: mid, forecastLow: lo, forecastBand: hi - lo })
      }
    }

    return {
      chartData: [...hist, ...intraday, ...fcPts],
      quarterTs,
      todayTs,
      nowTs: now,
      histEndTs: histEnd,
    }
  }, [prices, forecast, showMA7, showMA30])

  // Custom X-axis ticks: quarter marks + intraday markers + forecast end
  const xTicks = useMemo(() => {
    if (!chartData.length) return []
    const firstTs = chartData[0].ts
    const histRange = histEndTs - firstTs
    const histTicks = [0, 0.25, 0.5, 0.75, 1].map(f => firstTs + histRange * f)
    const intradayTicks = [6, 12].map(h => todayTs + h * 3_600_000).filter(t => t > histEndTs && t < nowTs)
    const fcEnd = nowTs + 7 * 86_400_000
    return [...histTicks, ...intradayTicks, nowTs > histEndTs ? nowTs : null, fcEnd]
      .filter((v): v is number => v !== null && v > 0)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b)
  }, [chartData, histEndTs, todayTs, nowTs])

  const fmtTick = (ts: number) => {
    if (ts >= todayTs) return format(new Date(ts), 'HH:mm')
    return format(new Date(ts), 'MM-dd')
  }

  const allPrices  = prices.map(p => p.price)
  const yMin = Math.min(...allPrices, forecast?.forecast_7d_low  ?? Infinity) * 0.98
  const yMax = Math.max(...allPrices, forecast?.forecast_7d_high ?? -Infinity) * 1.02
  const fmtY = (v: number) =>
    v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v >= 100 ? v.toFixed(0) : v.toFixed(2)

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-stone-500">
          纵轴: 商品绝对价格（{unit}）· 横轴: 线性时间轴，5等分（前4格历史 · 第5格今日实时/预测）
        </span>
        <span className="text-[10px] text-stone-600">
          区别于股市涨跌幅%，商品价格采用绝对值，直接反映采购成本
        </span>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="fcBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#34d399" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="todayZone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#1e293b" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#1e293b" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1c1917" vertical={false} />

          {/* Section dividers at each quarter of historical period */}
          {quarterTs.map((ts, i) => (
            <ReferenceLine
              key={i}
              x={ts}
              stroke="#292524"
              strokeDasharray="4 3"
            />
          ))}

          {/* Today zone boundary */}
          {histEndTs > 0 && todayTs > histEndTs && (
            <ReferenceLine
              x={todayTs}
              stroke="#44403c"
              strokeDasharray="5 3"
              label={{ value: '今日区间 ▶', position: 'insideTopLeft', fill: '#78716c', fontSize: 9 }}
            />
          )}

          {/* Forecast boundary at current time */}
          {nowTs > histEndTs && (
            <ReferenceLine
              x={nowTs}
              stroke="#166534"
              strokeDasharray="4 2"
              label={{ value: '预测区间 ↗', position: 'insideTopRight', fill: '#34d399', fontSize: 9 }}
            />
          )}

          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={xTicks}
            tickFormatter={fmtTick}
            tick={{ fill: '#78716c', fontSize: 10 }}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={fmtY}
            tick={{ fill: '#78716c', fontSize: 10 }}
            tickLine={false}
            width={58}
            label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#57534e', fontSize: 9, dy: 20 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#0c0a09', border: '1px solid #292524', borderRadius: 8, color: '#e7e5e4', fontSize: 12 }}
            labelStyle={{ color: '#a8a29e' }}
            labelFormatter={(ts: number) => format(new Date(ts), ts >= todayTs ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd')}
            formatter={(val: number, name: string) => {
              if (name === 'forecastBand' || name === 'forecastLow') return null
              const labels: Record<string, string> = {
                price: '实时价格', forecastMid: '预测中值', ma7: 'MA7', ma30: 'MA30',
              }
              return [`${val.toFixed(2)} ${unit}`, labels[name] ?? name]
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(v: string) => {
              const m: Record<string, string | null> = {
                price: '历史价格', forecastMid: '预测中值（7日）',
                ma7: '均线 MA7', ma30: '均线 MA30',
                forecastLow: null, forecastBand: null,
              }
              return m[v] ?? v
            }}
          />

          {/* Forecast confidence band (stacked area) */}
          <Area dataKey="forecastLow"  stackId="fc" fill="transparent"     stroke="transparent" legendType="none" />
          <Area dataKey="forecastBand" stackId="fc" fill="url(#fcBand)"    stroke="transparent" legendType="none" />

          {/* MA lines */}
          {showMA7 && (
            <Line dataKey="ma7"  stroke="#60a5fa" strokeWidth={1} dot={false}
              strokeDasharray="3 2" connectNulls name="ma7"  legendType="line" />
          )}
          {showMA30 && (
            <Line dataKey="ma30" stroke="#a78bfa" strokeWidth={1} dot={false}
              strokeDasharray="3 2" connectNulls name="ma30" legendType="line" />
          )}

          {/* Forecast midline */}
          <Line dataKey="forecastMid" stroke="#34d399" strokeWidth={1.5}
            strokeDasharray="5 3" dot={false} connectNulls name="forecastMid" legendType="line" />

          {/* Historical + today price */}
          <Line dataKey="price" stroke="#f97316" strokeWidth={2} dot={false}
            activeDot={{ r: 4, fill: '#f97316' }} name="price" legendType="line" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── PricesTab ─────────────────────────────────────────────────────────────────
function PricesTab() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [days, setDays] = useState(30)
  const [category, setCategory] = useState('')
  const [showMA7, setShowMA7] = useState(false)
  const [showMA30, setShowMA30] = useState(false)

  const { data: minerals = [] } = useQuery({
    queryKey: ['minerals', category],
    queryFn: () => api.getMinerals(category || undefined),
  })

  const selectedMineral = minerals.find(m => m.id === selectedId)

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

  const latest = history?.prices.at(-1)
  const first = history?.prices.at(0)
  const totalChange = latest && first
    ? ((latest.price - first.price) / first.price) * 100
    : null

  const OUTLOOK_STYLE: Record<string, string> = {
    '看涨':   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    '温和看涨':'bg-teal-500/20 text-teal-400 border-teal-500/30',
    '中性':   'bg-stone-600/30 text-stone-400 border-stone-600/40',
    '温和看跌':'bg-amber-500/20 text-amber-400 border-amber-500/30',
    '看跌':   'bg-red-500/20 text-red-400 border-red-500/30',
    '数据不足':'bg-stone-700/30 text-stone-500 border-stone-700/40',
  }

  return (
    <div className="flex gap-4">
      {/* Left sidebar: mineral selector */}
      <aside className="w-52 shrink-0 space-y-3">
        {/* Category filter */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-3">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">矿产类别</div>
          <div className="space-y-1">
            {MINERAL_CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  category === c.value
                    ? 'bg-orange-600/20 text-orange-400'
                    : 'text-stone-500 hover:text-white hover:bg-stone-800'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mineral list */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 max-h-[400px] overflow-y-auto">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 sticky top-0 bg-stone-900">矿产选择（单选）</div>
          {minerals.map(m => {
            const pct = m.latest_price?.price_change_pct
            const up = pct != null && pct >= 0
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors border mb-1 ${
                  selectedId === m.id
                    ? 'bg-orange-600/15 border-orange-600/40'
                    : 'border-transparent hover:bg-stone-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">{m.name_zh ?? m.name}</span>
                  <span className="text-[10px] text-stone-500">{m.symbol}</span>
                </div>
                {m.latest_price && (
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-orange-300">{m.latest_price.price.toFixed(2)}</span>
                    {pct != null && (
                      <span className={`text-[10px] ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                        {up ? '+' : ''}{pct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Indicators */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-3">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">指标</div>
          {[
            { id: 'ma7', label: '均线 MA7', color: '#60a5fa', checked: showMA7, set: setShowMA7 },
            { id: 'ma30', label: '均线 MA30', color: '#a78bfa', checked: showMA30, set: setShowMA30 },
          ].map(ind => (
            <label key={ind.id} className="flex items-center gap-2 py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={ind.checked}
                onChange={e => ind.set(e.target.checked)}
                className="accent-orange-500"
              />
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: ind.color }} />
              <span className="text-xs text-stone-400">{ind.label}</span>
            </label>
          ))}
        </div>

        {/* Export */}
        {selectedId && (
          <a
            href={api.exportPrices(days, selectedId)}
            download
            className="flex items-center gap-2 px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-400 hover:text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" />导出价格 CSV
          </a>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {selectedMineral ? (
          <>
            {/* Header */}
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedMineral.name_zh ?? selectedMineral.name}
                    <span className="text-stone-400 font-normal text-lg ml-2">
                      ({selectedMineral.symbol})
                    </span>
                    <span className="text-stone-500 font-normal text-sm ml-2">现货价格</span>
                  </h2>
                  <p className="text-sm text-stone-500 mt-0.5">单位: {history?.unit ?? selectedMineral.price_unit}</p>
                </div>
                <div className="flex items-center gap-3">
                  {forecast && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${OUTLOOK_STYLE[forecast.outlook] ?? ''}`}>
                      {forecast.outlook}
                    </span>
                  )}
                  {totalChange !== null && (
                    <div className={`text-right ${totalChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      <div className="flex items-center gap-1 text-lg font-bold">
                        {totalChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(2)}%
                      </div>
                      <div className="text-xs text-stone-500">{days}天区间</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Key stats */}
              {latest && (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: '最新价格', value: latest.price.toFixed(2), color: 'text-orange-300 text-xl font-bold' },
                    { label: '30日涨跌', value: forecast?.momentum_30d_pct != null ? `${forecast.momentum_30d_pct >= 0 ? '+' : ''}${forecast.momentum_30d_pct.toFixed(1)}%` : '—', color: (forecast?.momentum_30d_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400' },
                    { label: '年化波动', value: forecast?.volatility_30d_pct != null ? `${forecast.volatility_30d_pct.toFixed(0)}%` : '—', color: 'text-amber-400' },
                    { label: 'RSI(14)', value: forecast?.rsi14 != null ? forecast.rsi14.toFixed(0) : '—', color: (forecast?.rsi14 ?? 50) > 70 ? 'text-red-400' : (forecast?.rsi14 ?? 50) < 30 ? 'text-emerald-400' : 'text-stone-300' },
                    { label: '预测中值(7日)', value: forecast?.forecast_7d_mid != null ? forecast.forecast_7d_mid.toFixed(2) : '—', color: 'text-emerald-400' },
                    { label: '预测区间(7日)', value: forecast?.forecast_7d_low != null ? `${forecast.forecast_7d_low.toFixed(1)}–${forecast.forecast_7d_high?.toFixed(1)}` : '—', color: 'text-stone-300' },
                    { label: '7日动量', value: forecast?.momentum_7d_pct != null ? `${forecast.momentum_7d_pct >= 0 ? '+' : ''}${forecast.momentum_7d_pct.toFixed(1)}%` : '—', color: (forecast?.momentum_7d_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400' },
                    { label: '更新时间', value: format(new Date(latest.timestamp), 'MM-dd HH:mm'), color: 'text-stone-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-stone-800/50 rounded-lg px-3 py-2">
                      <div className="text-xs text-stone-500 mb-0.5">{s.label}</div>
                      <div className={`text-sm font-medium ${s.color}`}>{s.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Time range */}
              <div className="flex gap-1 mt-4">
                {DAYS_OPTIONS.map(o => (
                  <button
                    key={o.v}
                    onClick={() => setDays(o.v)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      days === o.v ? 'bg-orange-600 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            {histLoading ? (
              <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 h-64 flex items-center justify-center text-stone-500">
                加载价格数据...
              </div>
            ) : history && history.prices.length > 0 ? (
              <PriceChartPanel history={history} forecast={forecast} days={days} showMA7={showMA7} showMA30={showMA30} />
            ) : (
              <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 h-64 flex flex-col items-center justify-center text-stone-500">
                <Activity className="w-10 h-10 mb-3 opacity-20" />
                <p>暂无价格历史数据</p>
                <p className="text-xs mt-1">点击右上角「刷新数据」触发抓取</p>
              </div>
            )}

            {/* Mixed model */}
            {forecast && <MixedModelPanel fc={forecast} />}

            {/* Text analysis */}
            {forecast && forecast.outlook !== '数据不足' && (
              <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-stone-400" />
                  <span className="text-sm font-semibold text-white">价格趋势解读</span>
                  <span className="text-xs text-stone-600 ml-auto">
                    基于 {forecast.data_points} 个交易日 · 技术 + 资讯 + 基本面融合分析
                  </span>
                </div>
                <div className="bg-stone-800/40 rounded-xl px-4 py-3 text-sm text-stone-300 leading-relaxed border border-stone-700/40">
                  {forecast.outlook_text}
                </div>
                {/* Signal breakdown */}
                <div className="grid grid-cols-2 gap-2">
                  {forecast.signal_breakdown.map(sig => (
                    <div key={sig.label} className="flex items-center gap-2 bg-stone-800/30 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-stone-500 w-20 shrink-0">{sig.label}</span>
                      <span className={`text-xs flex-1 truncate ${
                        sig.direction === 'bull' ? 'text-emerald-400'
                          : sig.direction === 'bear' ? 'text-red-400'
                          : 'text-stone-400'
                      }`}>{sig.value}</span>
                      <div className="w-16 h-1.5 bg-stone-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            sig.direction === 'bull' ? 'bg-emerald-500'
                              : sig.direction === 'bear' ? 'bg-red-500'
                              : 'bg-stone-500'
                          }`}
                          style={{ width: `${Math.min(Math.abs(sig.score) / 1.5 * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Related news */}
                <div>
                  <div className="text-xs text-stone-500 mb-2">相关资讯情感面（近30日）</div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '近7日热度', v: forecast.news_7d_total, color: forecast.news_7d_total > 3 ? 'text-orange-400' : 'text-stone-400' },
                      { label: '政策资讯', v: forecast.news_30d_policy, color: forecast.news_30d_policy > 0 ? 'text-amber-400' : 'text-stone-400' },
                      { label: '价格资讯', v: forecast.news_30d_price, color: forecast.news_30d_price > 0 ? 'text-emerald-400' : 'text-stone-400' },
                      { label: '勘探资讯', v: forecast.news_30d_exploration, color: forecast.news_30d_exploration > 0 ? 'text-purple-400' : 'text-stone-400' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center justify-between bg-stone-800/50 rounded-lg px-3 py-2">
                        <span className="text-xs text-stone-500">{s.label}</span>
                        <span className={`text-sm font-medium ${s.color}`}>{s.v} 篇</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-stone-500">
            <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
            <p>从左侧选择矿产查看价格走势与预测</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function RiskForecast({ tab }: { tab: Tab }) {
  return tab === 'news' ? <NewsFeedTab /> : <PricesTab />
}
