import { useState, useMemo } from 'react'
import { api } from '../api/client'
import { ChevronRight, Play, RotateCcw, Download, Zap, AlertTriangle, TrendingUp, Globe } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type EventTemplate = {
  id: string
  title: string
  tags: string[]
  date: string
  minerals: string[]
  cascadeType: CascadeType
  riskScore: number
}

type CascadeType = 'export_restriction' | 'supply_disruption' | 'price_spike' | 'geopolitical' | 'policy_change'

type CascadeNode = {
  id: string
  label: string
  detail: string
  source?: string
  strength: 'strong' | 'medium' | 'weak'
}

type CascadeColumn = {
  key: string
  label: string
  color: string
  headerColor: string
  nodes: CascadeNode[]
}

// ── Static event templates (simulating recent platform events) ────────────────

const RECENT_EVENTS: EventTemplate[] = [
  {
    id: 'ev1',
    title: '中国进一步限制镍、钴等关键材料出口',
    tags: ['政策', '出口限制'],
    date: '2025-05-10',
    minerals: ['钴', '镍', '锂'],
    cascadeType: 'export_restriction',
    riskScore: 8.2,
  },
  {
    id: 'ev2',
    title: '印尼拟提高镍矿出口税',
    tags: ['政策', '税收调整'],
    date: '2025-05-09',
    minerals: ['镍'],
    cascadeType: 'policy_change',
    riskScore: 6.5,
  },
  {
    id: 'ev3',
    title: '红海航运持续中断，运费上涨',
    tags: ['事件', '运输中断'],
    date: '2025-05-08',
    minerals: ['铁', '铜', '铝'],
    cascadeType: 'supply_disruption',
    riskScore: 5.8,
  },
  {
    id: 'ev4',
    title: '美国拟对中国电动汽车加征关税',
    tags: ['政策', '贸易保护'],
    date: '2025-05-07',
    minerals: ['锂', '钴', '锰'],
    cascadeType: 'geopolitical',
    riskScore: 7.1,
  },
  {
    id: 'ev5',
    title: '刚果（金）部分矿区武装冲突升级',
    tags: ['事件', '地缘冲突'],
    date: '2025-05-07',
    minerals: ['钴', '铜'],
    cascadeType: 'geopolitical',
    riskScore: 7.8,
  },
]

// ── Cascade templates per event type ─────────────────────────────────────────

const CASCADE_TEMPLATES: Record<CascadeType, Omit<CascadeColumn, 'key'>[]> = {
  export_restriction: [
    {
      label: '直接影响',
      color: 'border-orange-500/50 bg-orange-950/30',
      headerColor: 'text-orange-400',
      nodes: [
        { id: 'd1', label: '关键矿产供应减少', detail: '出口量下降15%~25%，相关矿产现货趋紧', source: 'USGS·海关数据', strength: 'strong' },
        { id: 'd2', label: '出口审批更严格', detail: '通关审批时间延长至2~6周', source: '海关政策文件', strength: 'strong' },
        { id: 'd3', label: '市场不确定性上升', detail: '企业囤货行为增加10%~15%', source: 'S&P Global', strength: 'medium' },
      ],
    },
    {
      label: '中间影响',
      color: 'border-amber-500/50 bg-amber-950/30',
      headerColor: 'text-amber-400',
      nodes: [
        { id: 'm1', label: '材料价格上涨', detail: '相关矿产价格上涨20%~30%', source: 'LME·上海有色网', strength: 'strong' },
        { id: 'm2', label: '替代材料需求增加', detail: '锰、铁、硫酸镍等替代品需求上升', source: 'IEA 2024行业报告', strength: 'medium' },
        { id: 'm3', label: '供应链重构启动', detail: '企业寻找替代来源与新供应商', source: 'McKinsey供应链研究', strength: 'medium' },
      ],
    },
    {
      label: '产业影响',
      color: 'border-sky-500/50 bg-sky-950/30',
      headerColor: 'text-sky-400',
      nodes: [
        { id: 'i1', label: '新能源汽车产业', detail: '电池成本上升，影响产能和利润', source: '中汽数据·BNEF报告', strength: 'strong' },
        { id: 'i2', label: '储能产业', detail: '储能系统成本上升，项目投资回报下降', source: '行业白皮书', strength: 'medium' },
        { id: 'i3', label: '电子消费品产业', detail: '终端产品成本上升，压缩企业利润空间', source: 'IDC 2024市场研究', strength: 'medium' },
        { id: 'i4', label: '航空航天/军工', detail: '高端材料受限，影响生产计划', source: '公开研报·国防部年报', strength: 'weak' },
      ],
    },
    {
      label: '国家/地区影响',
      color: 'border-emerald-500/50 bg-emerald-950/30',
      headerColor: 'text-emerald-400',
      nodes: [
        { id: 'c1', label: '美国', detail: '供应依赖中国，加快本土化与盟友合作', source: 'USGS 2024白宫声明', strength: 'strong' },
        { id: 'c2', label: '欧洲', detail: '供应链多元化加速，寻求非中供应渠道', source: 'EU委员会报告·国际能源署', strength: 'strong' },
        { id: 'c3', label: '日本/韩国', detail: '产业链受冲击，企业面临成本压力', source: 'JETRO 2024·韩贸易委员会报告', strength: 'medium' },
        { id: 'c4', label: '全球市场', detail: '供需失衡加剧，贸易流向重新调整', source: 'WTO 2024·UN Comtrade', strength: 'medium' },
      ],
    },
    {
      label: '最终结果',
      color: 'border-violet-500/50 bg-violet-950/30',
      headerColor: 'text-violet-400',
      nodes: [
        { id: 'r1', label: '关键矿产价格持续高位运行', detail: '预计持续3~6月，价格上涨20%~30%', source: 'LME·上海有色网·行业研报', strength: 'strong' },
        { id: 'r2', label: '全球供应链重构加速', detail: '区域化供应体系逐步形成', source: 'Bain&Company全球供应链报告', strength: 'strong' },
        { id: 'r3', label: '地缘政治紧张加剧', detail: '资源安全竞争升级，战略博弈增强', source: 'CSIS 2024地政治年度报告', strength: 'medium' },
        { id: 'r4', label: '下游企业利润承压', detail: '部分企业面临减产或转移风险', source: '上市公司财报·Wind数据', strength: 'medium' },
      ],
    },
  ],
  supply_disruption: [
    {
      label: '直接影响',
      color: 'border-orange-500/50 bg-orange-950/30',
      headerColor: 'text-orange-400',
      nodes: [
        { id: 'd1', label: '运输成本骤升', detail: '航运费率上涨30%~60%，绕行增加交货周期', source: '波罗的海航运指数', strength: 'strong' },
        { id: 'd2', label: '现货交货延误', detail: '到港时间延误2~4周', source: '港口数据', strength: 'strong' },
      ],
    },
    {
      label: '中间影响',
      color: 'border-amber-500/50 bg-amber-950/30',
      headerColor: 'text-amber-400',
      nodes: [
        { id: 'm1', label: '库存告急', detail: '下游企业库存水位降至近5年低点', source: '行业协会数据', strength: 'strong' },
        { id: 'm2', label: '价格短期上涨', detail: '现货溢价扩大至10%~20%', source: 'LME', strength: 'medium' },
      ],
    },
    {
      label: '产业影响',
      color: 'border-sky-500/50 bg-sky-950/30',
      headerColor: 'text-sky-400',
      nodes: [
        { id: 'i1', label: '制造业', detail: '部分企业被迫减产或调整生产计划', source: '制造业PMI数据', strength: 'strong' },
        { id: 'i2', label: '贸易商', detail: '持货待售意愿增强，囤积行为出现', source: '大宗商品研报', strength: 'medium' },
      ],
    },
    {
      label: '国家/地区影响',
      color: 'border-emerald-500/50 bg-emerald-950/30',
      headerColor: 'text-emerald-400',
      nodes: [
        { id: 'c1', label: '进口依赖国', detail: '受冲击最大，紧急开启战略储备', source: '各国战略物资局', strength: 'strong' },
        { id: 'c2', label: '周边替代产区', detail: '获益于订单转移，产量提升', source: '行业报告', strength: 'medium' },
      ],
    },
    {
      label: '最终结果',
      color: 'border-violet-500/50 bg-violet-950/30',
      headerColor: 'text-violet-400',
      nodes: [
        { id: 'r1', label: '短期价格冲击', detail: '持续1~3个月后随运力恢复回落', source: '历史类似事件分析', strength: 'strong' },
        { id: 'r2', label: '供应链韧性提升', detail: '企业加速建设多元化备选通道', source: '麦肯锡供应链报告', strength: 'medium' },
      ],
    },
  ],
  geopolitical: [
    {
      label: '直接影响',
      color: 'border-orange-500/50 bg-orange-950/30',
      headerColor: 'text-orange-400',
      nodes: [
        { id: 'd1', label: '产区安全风险上升', detail: '武装冲突或地缘摩擦导致矿区停产', source: '地区安全报告', strength: 'strong' },
        { id: 'd2', label: '外资企业撤离', detail: '部分外资矿企撤出或暂停项目', source: '企业公告', strength: 'medium' },
      ],
    },
    {
      label: '中间影响',
      color: 'border-amber-500/50 bg-amber-950/30',
      headerColor: 'text-amber-400',
      nodes: [
        { id: 'm1', label: '供应预期恶化', detail: '市场对该产区长期供应能力产生疑虑', source: 'IMF·世界银行', strength: 'strong' },
        { id: 'm2', label: '保险与融资成本上升', detail: '矿产项目保险费率大幅上升', source: 'Lloyd\'s市场报告', strength: 'medium' },
      ],
    },
    {
      label: '产业影响',
      color: 'border-sky-500/50 bg-sky-950/30',
      headerColor: 'text-sky-400',
      nodes: [
        { id: 'i1', label: '高依赖产业受冲击', detail: '依赖该产区的产业链面临中断风险', source: '行业协会研报', strength: 'strong' },
        { id: 'i2', label: '替代勘探加速', detail: '其他地区勘探投资加速布局', source: 'S&P Global Mining', strength: 'medium' },
      ],
    },
    {
      label: '国家/地区影响',
      color: 'border-emerald-500/50 bg-emerald-950/30',
      headerColor: 'text-emerald-400',
      nodes: [
        { id: 'c1', label: '冲突当事国', detail: '经济与社会稳定受到重大冲击', source: '联合国报告', strength: 'strong' },
        { id: 'c2', label: '资源消费大国', detail: '紧急启动供应来源多元化', source: 'IEA·USGS', strength: 'strong' },
      ],
    },
    {
      label: '最终结果',
      color: 'border-violet-500/50 bg-violet-950/30',
      headerColor: 'text-violet-400',
      nodes: [
        { id: 'r1', label: '供应中断风险上升', detail: '中期内该地区产量难以恢复', source: 'CSIS地缘政治报告', strength: 'strong' },
        { id: 'r2', label: '国际矿业格局重塑', detail: '友岸外包与战略合作协议加速签署', source: '外交部·G7声明', strength: 'medium' },
      ],
    },
  ],
  policy_change: [
    {
      label: '直接影响',
      color: 'border-orange-500/50 bg-orange-950/30',
      headerColor: 'text-orange-400',
      nodes: [
        { id: 'd1', label: '出口税成本转嫁', detail: '矿产出口价格相应上涨', source: '政府公告', strength: 'strong' },
        { id: 'd2', label: '下游买家成本上升', detail: '进口企业采购成本增加10%~20%', source: '贸易商数据', strength: 'strong' },
      ],
    },
    {
      label: '中间影响',
      color: 'border-amber-500/50 bg-amber-950/30',
      headerColor: 'text-amber-400',
      nodes: [
        { id: 'm1', label: '竞争格局变化', detail: '其他产国份额可能扩大', source: '行业分析', strength: 'medium' },
        { id: 'm2', label: '国内加工需求增加', detail: '政策促进本国精炼与加工', source: '工信部报告', strength: 'medium' },
      ],
    },
    {
      label: '产业影响',
      color: 'border-sky-500/50 bg-sky-950/30',
      headerColor: 'text-sky-400',
      nodes: [
        { id: 'i1', label: '全球精炼产能重新分布', detail: '加工环节向政策友好地区迁移', source: '麦肯锡金属报告', strength: 'medium' },
        { id: 'i2', label: '下游成本压力加大', detail: '依赖该矿产的制造商利润承压', source: '行业财务数据', strength: 'strong' },
      ],
    },
    {
      label: '国家/地区影响',
      color: 'border-emerald-500/50 bg-emerald-950/30',
      headerColor: 'text-emerald-400',
      nodes: [
        { id: 'c1', label: '政策实施国', detail: '短期财政收入增加，长期可能影响投资吸引力', source: 'IMF财政分析', strength: 'medium' },
        { id: 'c2', label: '进口国', detail: '寻求替代来源，加速供应多元化', source: '贸易统计', strength: 'strong' },
      ],
    },
    {
      label: '最终结果',
      color: 'border-violet-500/50 bg-violet-950/30',
      headerColor: 'text-violet-400',
      nodes: [
        { id: 'r1', label: '价格中枢上移', detail: '结构性成本上升推动价格长期走高', source: 'LME·行业研报', strength: 'strong' },
        { id: 'r2', label: '矿业投资格局重塑', detail: '资本流向成本洼地和政策稳定地区', source: 'Bloomberg Intelligence', strength: 'medium' },
      ],
    },
  ],
  price_spike: [
    {
      label: '直接影响',
      color: 'border-orange-500/50 bg-orange-950/30',
      headerColor: 'text-orange-400',
      nodes: [
        { id: 'd1', label: '现货价格跳涨', detail: '短期内价格上涨20%以上', source: 'LME·上海有色', strength: 'strong' },
        { id: 'd2', label: '套保需求激增', detail: '期货市场持仓量大幅增加', source: 'CME·SHFE', strength: 'medium' },
      ],
    },
    {
      label: '中间影响',
      color: 'border-amber-500/50 bg-amber-950/30',
      headerColor: 'text-amber-400',
      nodes: [
        { id: 'm1', label: '下游企业锁价', detail: '长单签约需求激增，期货套保增加', source: '期货公司报告', strength: 'strong' },
        { id: 'm2', label: '囤货行为出现', detail: '中间商加大库存，放大价格波动', source: '仓储数据', strength: 'medium' },
      ],
    },
    {
      label: '产业影响',
      color: 'border-sky-500/50 bg-sky-950/30',
      headerColor: 'text-sky-400',
      nodes: [
        { id: 'i1', label: '成本转嫁压力', detail: '上游成本向中下游传导', source: '产业链价格数据', strength: 'strong' },
        { id: 'i2', label: '产能扩张信号', detail: '高价激励矿企加快扩产计划', source: '采矿公司年报', strength: 'medium' },
      ],
    },
    {
      label: '国家/地区影响',
      color: 'border-emerald-500/50 bg-emerald-950/30',
      headerColor: 'text-emerald-400',
      nodes: [
        { id: 'c1', label: '产矿国受益', detail: '出口收入增加，财政改善', source: '世界银行', strength: 'strong' },
        { id: 'c2', label: '进口依赖国受压', detail: '制造业竞争力下降', source: 'OECD', strength: 'strong' },
      ],
    },
    {
      label: '最终结果',
      color: 'border-violet-500/50 bg-violet-950/30',
      headerColor: 'text-violet-400',
      nodes: [
        { id: 'r1', label: '价格回调后仍高位', detail: '供需再平衡需6~18个月', source: '历史周期分析', strength: 'strong' },
        { id: 'r2', label: '新增产能释放', detail: '高价刺激2~3年后产量增加', source: 'Wood Mackenzie', strength: 'medium' },
      ],
    },
  ],
}

const STRENGTH_COLORS: Record<string, string> = {
  strong: 'border-l-orange-400',
  medium: 'border-l-amber-600',
  weak:   'border-l-stone-600',
}

const STRENGTH_LABELS: Record<string, string> = {
  strong: '>70%',
  medium: '30~70%',
  weak:   '<30%',
}

// ── Risk gauge ────────────────────────────────────────────────────────────────

function RiskGauge({ score }: { score: number }) {
  const pct = score / 10
  const r = 56
  const circ = Math.PI * r  // half circle
  const dash = circ * pct
  const color = score >= 8 ? '#ef4444' : score >= 6 ? '#f97316' : score >= 4 ? '#eab308' : '#22c55e'
  const label = score >= 8 ? '极高' : score >= 6 ? '高' : score >= 4 ? '中' : '低'
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="140" height="80" viewBox="0 0 140 80">
        {/* Track */}
        <path d="M 14 76 A 56 56 0 0 1 126 76" fill="none" stroke="#292524" strokeWidth="12" strokeLinecap="round" />
        {/* Value arc */}
        <path
          d="M 14 76 A 56 56 0 0 1 126 76"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="70" y="66" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>{label}</text>
      </svg>
      <div className="text-xs text-stone-500">综合风险评分：<span className="font-bold text-white">{score.toFixed(1)}</span>/10</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RiskDeduction() {
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [customText, setCustomText] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [analyzed, setAnalyzed] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [reportType, setReportType] = useState<'enterprise' | 'government'>('enterprise')

  const toggleEvent = (id: string) => {
    setSelectedEvents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setAnalyzed(false)
  }

  const hasInput = selectedEvents.size > 0 || customText.trim().length > 10

  // Merge selected event cascade types
  const { cascadeColumns, riskScore, affectedMinerals } = useMemo(() => {
    if (!analyzed || !hasInput) {
      return { cascadeColumns: [] as CascadeColumn[], riskScore: 0, affectedMinerals: [] as string[] }
    }

    const selectedTemplates = RECENT_EVENTS.filter(e => selectedEvents.has(e.id))

    // If nothing selected but custom text entered, default to export_restriction
    const primaryType: CascadeType = selectedTemplates[0]?.cascadeType ?? 'export_restriction'
    const baseScore = selectedTemplates.reduce((s, e) => Math.max(s, e.riskScore), 5.0)
    const combinedScore = Math.min(10, baseScore + (selectedTemplates.length > 1 ? 0.8 : 0) + (customText.trim() ? 0.3 : 0))

    const minerals = Array.from(new Set(selectedTemplates.flatMap(e => e.minerals)))

    const template = CASCADE_TEMPLATES[primaryType]
    const cols: CascadeColumn[] = template.map((col, i) => ({
      ...col,
      key: `col-${i}`,
    }))

    return { cascadeColumns: cols, riskScore: combinedScore, affectedMinerals: minerals }
  }, [analyzed, hasInput, selectedEvents, customText])

  const handleAnalyze = () => {
    if (!hasInput) return
    setIsAnalyzing(true)
    setTimeout(() => {
      setIsAnalyzing(false)
      setAnalyzed(true)
    }, 1400)
  }

  const handleReset = () => {
    setSelectedEvents(new Set())
    setCustomText('')
    setUrlInput('')
    setAnalyzed(false)
  }

  const primaryEvent = RECENT_EVENTS.find(e => selectedEvents.has(e.id))
  const briefingUrl = analyzed
    ? api.briefingGlobal(reportType)
    : '#'

  return (
    <div className="flex gap-4 h-full min-h-0" style={{ height: 'calc(100vh - 3.5rem - 2rem)' }}>
      {/* ── Left: Input Panel ── */}
      <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Platform events */}
        <div className="card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-600/30 text-orange-400 text-xs font-bold flex items-center justify-center">1</span>
            <span className="text-xs font-semibold text-stone-300">平台事件 <span className="text-stone-600 font-normal">（可多选）</span></span>
          </div>
          {RECENT_EVENTS.map(ev => (
            <label key={ev.id} className={`flex gap-2 cursor-pointer p-2 rounded-lg border transition-colors ${selectedEvents.has(ev.id) ? 'border-orange-600/50 bg-orange-950/30' : 'border-stone-800 hover:border-stone-700'}`}>
              <input
                type="checkbox"
                className="mt-0.5 accent-orange-500 shrink-0"
                checked={selectedEvents.has(ev.id)}
                onChange={() => toggleEvent(ev.id)}
              />
              <div className="min-w-0">
                <div className="text-xs text-white leading-snug">{ev.title}</div>
                <div className="flex gap-1 flex-wrap mt-1">
                  {ev.tags.map(t => (
                    <span key={t} className="text-[9px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                  <span className="text-[9px] text-stone-600">{ev.date}</span>
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* URL input */}
        <div className="card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-600/30 text-orange-400 text-xs font-bold flex items-center justify-center">2</span>
            <span className="text-xs font-semibold text-stone-300">新闻链接 <span className="text-stone-600 font-normal">（自动识别）</span></span>
          </div>
          <div className="flex gap-1">
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="粘贴新闻链接..."
              className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-xs text-white placeholder-stone-600 outline-none focus:border-orange-500 min-w-0"
            />
            <button className="px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-xs text-stone-300 shrink-0">解析</button>
          </div>
          <div className="text-[9px] text-stone-600">支持 Reuters、Bloomberg、财新、界面等主流媒体链接</div>
        </div>

        {/* Custom text */}
        <div className="card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-600/30 text-orange-400 text-xs font-bold flex items-center justify-center">3</span>
            <span className="text-xs font-semibold text-stone-300">自定义事件描述</span>
          </div>
          <textarea
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder={'描述事件内容，例如："假设刚果发生政变导致钴矿供应中断"'}
            rows={4}
            className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-xs text-white placeholder-stone-600 outline-none focus:border-orange-500 resize-none"
          />
          <div className="text-right text-[9px] text-stone-600">{customText.length}/300</div>
          <div className="text-[9px] text-stone-600">建议包含：国家/地区、事件类型、涉及矿产、时间等关键信息</div>
        </div>

        {/* Explanation */}
        <div className="card p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-600/30 text-orange-400 text-xs font-bold flex items-center justify-center">4</span>
            <span className="text-xs font-semibold text-stone-300">分析说明</span>
          </div>
          <div className="text-[10px] text-stone-500 leading-relaxed">
            系统将基于历史数据、产业链关联、市场动态和地缘政治等多维度信息，进行影响传导推演和风险评估。推演结果仅供参考，不构成投资或决策建议。
          </div>
        </div>
      </div>

      {/* ── Center: Cascade Diagram ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto">
        <div className="card p-4 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-400" />
              <span className="font-semibold text-white text-sm">影响传导图谱</span>
            </div>
            {analyzed && (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                分析完成 · 基于{selectedEvents.size}个事件
              </div>
            )}
          </div>

          {!analyzed ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-stone-800 flex items-center justify-center">
                <Zap className="w-8 h-8 text-stone-600" />
              </div>
              <div>
                <div className="text-stone-400 text-sm font-medium">选择事件后开始推演</div>
                <div className="text-stone-600 text-xs mt-1">将生成5级影响传导链路图</div>
              </div>
              {/* Preview columns labels */}
              <div className="flex items-center gap-2 mt-4">
                {['直接影响', '中间影响', '产业影响', '国家/地区', '最终结果'].map((l, i) => (
                  <div key={l} className="flex items-center gap-1">
                    <div className="px-2 py-1 rounded bg-stone-800 text-stone-600 text-[10px]">{l}</div>
                    {i < 4 && <ChevronRight className="w-3 h-3 text-stone-700" />}
                  </div>
                ))}
              </div>
            </div>
          ) : isAnalyzing ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-sm text-stone-400">正在推演影响传导链路...</div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-1 min-w-[800px] h-full">
                {cascadeColumns.map((col, i) => (
                  <div key={col.key} className="flex-1 flex items-start gap-1 min-w-0">
                    <div className="flex-1 flex flex-col gap-2">
                      <div className={`text-xs font-semibold text-center pb-2 border-b border-stone-800 ${col.headerColor}`}>{col.label}</div>
                      {col.nodes.map(node => (
                        <div
                          key={node.id}
                          className={`rounded-lg border ${col.color} border-l-2 ${STRENGTH_COLORS[node.strength]} p-2.5`}
                        >
                          <div className="text-xs font-semibold text-white leading-tight">{node.label}</div>
                          <div className="text-[10px] text-stone-400 mt-1 leading-relaxed">{node.detail}</div>
                          {node.source && (
                            <div className="text-[9px] text-stone-600 mt-1.5">来源：{node.source}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    {i < cascadeColumns.length - 1 && (
                      <div className="flex items-start pt-8 shrink-0 px-0.5">
                        <ChevronRight className="w-4 h-4 text-stone-600" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-stone-800 flex items-center gap-4 flex-wrap text-[10px] text-stone-500">
            <span className="font-semibold">图例：</span>
            {Object.entries(STRENGTH_LABELS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span className={`inline-block w-3 h-3 border-l-2 ${STRENGTH_COLORS[k]} bg-stone-800 rounded-sm`} />
                {k === 'strong' ? '强影响路径' : k === 'medium' ? '中等影响路径' : '弱影响路径'}（{v}）
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Results Panel ── */}
      <div className="w-56 shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Analyze button */}
        <button
          onClick={analyzed ? handleReset : handleAnalyze}
          disabled={!hasInput || isAnalyzing}
          className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
            analyzed
              ? 'bg-stone-700 hover:bg-stone-600 text-white'
              : hasInput
              ? 'bg-orange-600 hover:bg-orange-500 text-white'
              : 'bg-stone-800 text-stone-600 cursor-not-allowed'
          }`}
        >
          {analyzed ? (
            <><RotateCcw className="w-4 h-4" />清空事件</>
          ) : isAnalyzing ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />推演中...</>
          ) : (
            <><Play className="w-4 h-4" />开始推演</>
          )}
        </button>

        {/* Risk results */}
        {analyzed && (
          <>
            <div className="card p-3 space-y-3">
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">风险推演结果</div>
              <RiskGauge score={riskScore} />
            </div>

            <div className="card p-3 space-y-2">
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">影响概览</div>
              <div className="space-y-1.5 text-[10px] text-stone-400">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-orange-400 mt-0.5 shrink-0" />
                  <span>受影响矿产：{affectedMinerals.join('、') || '综合矿产'}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <TrendingUp className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                  <span>主要影响产业：新能源汽车、储能、电子消费品、航空航天等</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Globe className="w-3 h-3 text-sky-400 mt-0.5 shrink-0" />
                  <span>影响周期：中期（3~12个月）</span>
                </div>
              </div>
            </div>

            {primaryEvent && (
              <div className="card p-3 space-y-2">
                <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">趋势预测</div>
                <div className="space-y-1.5 text-[10px]">
                  <div className="text-stone-500 font-semibold mb-1">价格变动预测（中期3~12月）</div>
                  {affectedMinerals.slice(0, 3).map((m, i) => (
                    <div key={m} className="flex items-center justify-between">
                      <span className="text-stone-400">{m}价：</span>
                      <span className={i === 0 ? 'text-red-400 font-semibold' : 'text-orange-400 font-semibold'}>
                        ↑ {i === 0 ? '20%~30%' : i === 1 ? '15%~25%' : '维持高位'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-stone-500 border-t border-stone-800 pt-2 mt-1 leading-relaxed">
                  关键矿产资源安全竞争加剧，各国加快战略储备与本土开发，供应链区域化趋势增强。
                </div>
              </div>
            )}

            <div className="card p-3 space-y-2">
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">报告生成</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setReportType('enterprise')}
                  className={`px-2 py-2 rounded-lg text-[10px] text-center transition-colors border ${
                    reportType === 'enterprise'
                      ? 'border-orange-600/50 bg-orange-950/40 text-orange-300'
                      : 'border-stone-700 text-stone-500 hover:text-stone-300'
                  }`}
                >
                  <div className="font-semibold">企业版报告</div>
                  <div className="text-stone-600 mt-0.5">价格、成本、购买建议</div>
                </button>
                <button
                  onClick={() => setReportType('government')}
                  className={`px-2 py-2 rounded-lg text-[10px] text-center transition-colors border ${
                    reportType === 'government'
                      ? 'border-emerald-600/50 bg-emerald-950/40 text-emerald-300'
                      : 'border-stone-700 text-stone-500 hover:text-stone-300'
                  }`}
                >
                  <div className="font-semibold">政府版报告</div>
                  <div className="text-stone-600 mt-0.5">宏观经济、政策建议</div>
                </button>
              </div>
              <a
                href={briefingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />生成报告
              </a>
            </div>
          </>
        )}

        {!analyzed && (
          <div className="card p-4 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-8 h-8 text-stone-700" />
            <div className="text-xs text-stone-600 leading-relaxed">
              选择事件后点击"开始推演"，系统将生成影响传导图谱和风险评分
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
