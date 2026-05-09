import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { FileText, Building2, Landmark, Globe, Layers, ExternalLink } from 'lucide-react'

type Audience = 'enterprise' | 'government'

const AUDIENCE_OPTIONS = [
  {
    value: 'enterprise' as Audience,
    label: '企业版',
    icon: Building2,
    color: 'text-blue-400',
    activeBg: 'bg-blue-600/20 border-blue-600/40',
    desc: '价格信号 · 矿企股价 · 市场资讯 · 风险预警',
  },
  {
    value: 'government' as Audience,
    icon: Landmark,
    label: '政府版',
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-600/20 border-emerald-600/40',
    desc: '供应安全 · 政策动态 · 战略矿产 · 勘探资讯',
  },
]

export default function Briefing() {
  const [audience, setAudience] = useState<Audience>('enterprise')
  const [selectedMineralId, setSelectedMineralId] = useState<number | null>(null)

  const { data: minerals } = useQuery({
    queryKey: ['minerals'],
    queryFn: () => api.getMinerals(),
  })

  const scope = selectedMineralId ? '单矿产简报' : '全局综合简报'
  const briefingUrl = selectedMineralId
    ? api.briefingMineral(selectedMineralId, audience)
    : api.briefingGlobal(audience)

  const selectedMineral = minerals?.find(m => m.id === selectedMineralId)
  const aud = AUDIENCE_OPTIONS.find(a => a.value === audience)!

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-orange-400" />
        <div>
          <h1 className="text-lg font-bold text-white">分析简报生成</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            面向企业或政府决策层，生成结构化矿产市场分析报告，可直接打印为 PDF
          </p>
        </div>
      </div>

      {/* Step 1: Audience */}
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

      {/* Step 2: Scope */}
      <div className="card space-y-3">
        <div className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
          Step 2 &nbsp;·&nbsp; 选择简报范围
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => setSelectedMineralId(null)}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedMineralId === null
                ? 'bg-orange-600/20 border-orange-600/40'
                : 'border-stone-700 hover:border-stone-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-white">全局综合简报</span>
            </div>
            <p className="text-xs text-stone-500 mt-1">覆盖所有追踪矿产，总览市场全局</p>
          </button>
          <button
            onClick={() => setSelectedMineralId(selectedMineralId ?? (minerals?.[0]?.id ?? null))}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedMineralId !== null
                ? 'bg-orange-600/20 border-orange-600/40'
                : 'border-stone-700 hover:border-stone-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white">单矿产深度简报</span>
            </div>
            <p className="text-xs text-stone-500 mt-1">聚焦某一矿产的深度分析</p>
          </button>
        </div>

        {/* Mineral selector */}
        {selectedMineralId !== null && (
          <div className="space-y-1.5">
            <div className="text-xs text-stone-500">选择矿产：</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
              {minerals?.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMineralId(m.id)}
                  className={`px-3 py-2 rounded-lg text-xs text-left transition-colors border ${
                    selectedMineralId === m.id
                      ? 'bg-orange-600/20 border-orange-600/40 text-white'
                      : 'border-stone-700 text-stone-400 hover:text-white hover:border-stone-600'
                  }`}
                >
                  <div className="font-medium">{m.name_zh ?? m.name}</div>
                  <div className="text-stone-500 mt-0.5">{m.symbol ?? m.category}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview card */}
      <div className="card bg-stone-800/40 border-dashed border-stone-700">
        <div className="text-xs text-stone-500 mb-3 uppercase tracking-widest font-semibold">简报预览</div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-stone-400">受众类型</span>
            <span className={`font-medium ${aud.color}`}>{aud.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400">覆盖范围</span>
            <span className="text-white font-medium">
              {selectedMineralId ? (selectedMineral?.name_zh ?? selectedMineral?.name ?? '—') : '全部矿产'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400">简报类型</span>
            <span className="text-white">{scope}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400">输出格式</span>
            <span className="text-stone-300">HTML（可打印为 PDF）</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-stone-700">
          <div className="text-xs text-stone-500 mb-3">简报包含内容：</div>
          <div className="grid grid-cols-2 gap-1.5">
            {audience === 'enterprise' ? [
              '价格行情总览', '矿企股价动态', '市场资讯摘要', '价格展望信号',
              '风险提示', '数据来源说明',
            ] : [
              '战略矿产供应安全评估', '价格行情总览（含关键度）',
              '政策与监管动态', '勘探与开发资讯',
              '风险提示', '数据来源说明',
            ].map(item => (
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
