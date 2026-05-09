import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { TrendingUp, TrendingDown, Search, Info, Download } from 'lucide-react'

const CATEGORIES = [
  { value: '', label: '全部', color: 'bg-stone-700 text-stone-300' },
  { value: 'rare_earth', label: '稀土元素', color: 'bg-violet-600/80 text-violet-200' },
  { value: 'battery', label: '电池金属', color: 'bg-emerald-600/80 text-emerald-200' },
  { value: 'strategic', label: '战略矿产', color: 'bg-amber-600/80 text-amber-200' },
  { value: 'pgm', label: '铂族金属', color: 'bg-orange-600/80 text-orange-200' },
]

const CAT_BADGE: Record<string, string> = {
  rare_earth: 'bg-violet-500/20 text-violet-400',
  battery:    'bg-emerald-500/20 text-emerald-400',
  strategic:  'bg-amber-500/20 text-amber-400',
  pgm:        'bg-orange-500/20 text-orange-400',
  industrial: 'bg-stone-500/20 text-stone-400',
}
const CAT_ZH: Record<string, string> = {
  rare_earth: '稀土', battery: '电池', strategic: '战略', pgm: '铂族', industrial: '工业',
}
const SUBCAT_ZH: Record<string, string> = {
  LREE: '轻稀土', HREE: '重稀土', battery_metal: '电池金属', base_metal: '基础金属',
  pgm: 'PGM', noble_metal: '贵金属', refractory_metal: '难熔金属',
  transition_metal: '过渡金属', post_transition_metal: '后过渡金属', metalloid: '准金属',
  non_metal: '非金属', alkali_metal: '碱金属',
}

function CriticalityBar({ score }: { score: number | null }) {
  if (!score) return null
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-stone-800 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500"
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className="text-xs text-stone-500 w-6 text-right">{score}/10</span>
    </div>
  )
}

export default function Minerals() {
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const { data: minerals, isLoading } = useQuery({
    queryKey: ['minerals', category],
    queryFn: () => api.getMinerals(category || undefined),
  })

  const filtered = minerals?.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.name.toLowerCase().includes(q) ||
      m.name_zh?.includes(q) ||
      m.symbol?.toLowerCase().includes(q)
    )
  }) ?? []

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -transtone-y-1/2 w-4 h-4 text-stone-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索矿产名称或符号..."
            className="w-full bg-stone-800 border border-stone-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-stone-500 outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                category === c.value ? c.color : 'bg-stone-800 text-stone-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-stone-600">
        <span>共 {filtered.length} 种矿产</span>
        <a
          href={api.exportMinerals()}
          download
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-white transition-colors"
        >
          <Download className="w-3.5 h-3.5" />导出 CSV
        </a>
      </div>

      {isLoading ? (
        <div className="text-center text-stone-500 py-16">加载中...</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(m => {
            const isOpen = expanded === m.id
            const pct = m.latest_price?.price_change_pct
            const up = pct !== null && pct !== undefined && pct >= 0
            return (
              <div key={m.id} className="card">
                <div
                  className="flex items-center gap-4 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : m.id)}
                >
                  {/* Symbol badge */}
                  <div className="w-12 h-12 rounded-lg bg-stone-800 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-orange-300">{m.symbol ?? '?'}</span>
                    {m.atomic_number && (
                      <span className="absolute text-[8px] text-stone-600 mt-8">{m.atomic_number}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white">{m.name}</span>
                      {m.name_zh && <span className="text-stone-400 text-sm">{m.name_zh}</span>}
                      {m.category && (
                        <span className={`badge ${CAT_BADGE[m.category] ?? 'bg-stone-700 text-stone-400'}`}>
                          {CAT_ZH[m.category] ?? m.category}
                        </span>
                      )}
                      {m.subcategory && (
                        <span className="badge bg-stone-800 text-stone-500 text-[10px]">
                          {SUBCAT_ZH[m.subcategory] ?? m.subcategory}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <CriticalityBar score={m.criticality_score ?? null} />
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    {m.latest_price ? (
                      <>
                        <div className="text-lg font-bold text-orange-300">
                          {m.latest_price.price.toFixed(2)}
                        </div>
                        <div className="text-xs text-stone-500">{m.latest_price.unit}</div>
                        {pct !== null && pct !== undefined && (
                          <div className={`text-xs flex items-center justify-end gap-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(pct).toFixed(2)}%
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-stone-600">暂无价格</div>
                    )}
                  </div>

                  <Info className={`w-4 h-4 shrink-0 transition-colors ${isOpen ? 'text-orange-400' : 'text-stone-600'}`} />
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-stone-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {m.key_uses && m.key_uses.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">主要用途</h4>
                        <ul className="space-y-1">
                          {m.key_uses.map(u => (
                            <li key={u} className="text-stone-300 text-xs flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-orange-400 shrink-0" />
                              {u}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {m.top_producers && m.top_producers.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">主要生产国</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {m.top_producers.map((p, i) => (
                            <span
                              key={p}
                              className={`badge ${
                                i === 0 ? 'bg-orange-600/30 text-orange-300' : 'bg-stone-700/60 text-stone-400'
                              }`}
                            >
                              {i === 0 && '★ '}{p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
