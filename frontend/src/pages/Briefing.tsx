import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { FileText, Building2, Landmark, Globe, ExternalLink, Calendar, MapPin, RefreshCw } from 'lucide-react'

type Audience = 'enterprise' | 'government'
type Days = 7 | 30

const AUDIENCE_OPTIONS = [
  {
    value: 'enterprise' as Audience,
    label: '企业版',
    icon: Building2,
    color: 'text-blue-400',
    activeBg: 'bg-blue-600/20 border-blue-600/40',
    desc: '矿产价格 · 风险提示 · 购买建议 · 市场资讯',
  },
  {
    value: 'government' as Audience,
    icon: Landmark,
    label: '政府版',
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-600/20 border-emerald-600/40',
    desc: '政策动向 · 贸易情况 · 外交举措 · 供应安全',
  },
]

const DAYS_OPTIONS: { value: Days; label: string }[] = [
  { value: 7,  label: '近一周' },
  { value: 30, label: '近一月' },
]

export default function Briefing() {
  const [audience, setAudience] = useState<Audience>('enterprise')
  const [days, setDays] = useState<Days>(7)
  const [selectedCountry, setSelectedCountry] = useState<string>('')

  const { data: activeCountries, isLoading: loadingCountries, refetch } = useQuery({
    queryKey: ['active-countries', days],
    queryFn: () => api.getActiveCountries(days),
  })

  const aud = AUDIENCE_OPTIONS.find(a => a.value === audience)!

  const briefingUrl = api.briefingCountry(audience, days, selectedCountry || undefined)

  const contentItems = audience === 'enterprise'
    ? ['各国相关矿产价格行情', '价格趋势与展望信号', '风险提示与预警', '购买建议参考', '市场资讯摘要']
    : ['政策动向与立法举措', '贸易限制与外交情况', '供应安全评估', '勘探开发动态', '战略矿产风险']

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-orange-400" />
        <div>
          <h1 className="text-lg font-bold text-white">分析简报生成</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            按国家汇总近期关键矿产动态，生成政府或企业决策简报，可打印为 PDF
          </p>
        </div>
      </div>

      {/* Audience */}
      <div className="card space-y-3">
        <div className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
          Step 1 &nbsp;·&nbsp; 选择受众类型
        </div>
        <div className="grid grid-cols-2 gap-3">
          {AUDIENCE_OPTIONS.map(opt => {
            const Icon = opt.icon
            const active = audience === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setAudience(opt.value)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  active ? opt.activeBg : 'border-stone-700 hover:border-stone-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${active ? opt.color : 'text-stone-500'}`} />
                  <span className={`font-semibold text-sm ${active ? 'text-white' : 'text-stone-400'}`}>
                    {opt.label}
                  </span>
                  {active && (
                    <span className="ml-auto text-xs bg-orange-600 text-white px-2 py-0.5 rounded-full">
                      已选
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">{opt.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Time range */}
      <div className="card space-y-3">
        <div className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
          Step 2 &nbsp;·&nbsp; 选择时间范围
        </div>
        <div className="flex gap-2">
          {DAYS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setDays(opt.value); setSelectedCountry('') }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all ${
                days === opt.value
                  ? 'bg-orange-600/20 border-orange-600/40 text-orange-300 font-medium'
                  : 'border-stone-700 text-stone-400 hover:border-stone-600 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Country selection */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
            Step 3 &nbsp;·&nbsp; 选择国家（可选）
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-300"
          >
            <RefreshCw className="w-3 h-3" />刷新
          </button>
        </div>

        <button
          onClick={() => setSelectedCountry('')}
          className={`w-full p-3 rounded-xl border text-left transition-all ${
            selectedCountry === ''
              ? 'bg-orange-600/20 border-orange-600/40'
              : 'border-stone-700 hover:border-stone-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-white">全部活跃国家</span>
            {activeCountries && (
              <span className="ml-auto text-xs text-stone-500">
                {activeCountries.length} 个国家有{DAYS_OPTIONS.find(d => d.value === days)?.label}动态
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-1 ml-6">汇总所有有动态的国家，生成综合报告</p>
        </button>

        {loadingCountries ? (
          <div className="text-xs text-stone-500 text-center py-4">加载活跃国家...</div>
        ) : activeCountries && activeCountries.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {activeCountries.map(({ country, count }) => (
              <button
                key={country}
                onClick={() => setSelectedCountry(country)}
                className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                  selectedCountry === country
                    ? 'bg-orange-600/20 border-orange-600/40'
                    : 'border-stone-700 hover:border-stone-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className={`w-3 h-3 ${selectedCountry === country ? 'text-orange-400' : 'text-stone-600'}`} />
                  <span className={`text-sm font-medium ${selectedCountry === country ? 'text-white' : 'text-stone-400'}`}>
                    {country}
                  </span>
                  <span className="ml-auto text-[10px] text-stone-600">{count}条</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-stone-600 text-center py-3">
            暂无{DAYS_OPTIONS.find(d => d.value === days)?.label}活跃国家数据
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="card bg-stone-800/40 border-dashed border-stone-700">
        <div className="text-xs text-stone-500 mb-3 uppercase tracking-widest font-semibold">简报预览</div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-stone-400">受众类型</span>
            <span className={`font-medium ${aud.color}`}>{aud.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400">时间范围</span>
            <span className="text-white font-medium">{DAYS_OPTIONS.find(d => d.value === days)?.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400">覆盖范围</span>
            <span className="text-white font-medium">
              {selectedCountry || `全部活跃国家（${activeCountries?.length ?? '—'}个）`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400">输出格式</span>
            <span className="text-stone-300">HTML（可打印为 PDF）</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-stone-700">
          <div className="text-xs text-stone-500 mb-3">简报包含内容：</div>
          <div className="grid grid-cols-2 gap-1.5">
            {contentItems.map(item => (
              <div key={item} className="flex items-center gap-1.5 text-xs text-stone-400">
                <span className="text-emerald-500">✓</span>{item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generate button */}
      <a
        href={briefingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors"
      >
        <FileText className="w-4 h-4" />
        生成分析简报
        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
      </a>
      <p className="text-center text-xs text-stone-600">
        在新标签页打开 · 按 Ctrl+P（或 ⌘P）导出 PDF
      </p>
    </div>
  )
}
