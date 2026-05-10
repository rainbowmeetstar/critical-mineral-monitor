import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { TrendingUp, TrendingDown, ExternalLink, Building2 } from 'lucide-react'

const EXCHANGE_COLOR: Record<string, string> = {
  NYSE:  'bg-blue-500/20 text-blue-400',
  ASX:   'bg-emerald-500/20 text-emerald-400',
  OTC:   'bg-stone-500/20 text-stone-400',
  HKEx:  'bg-red-500/20 text-red-400',
  SHEx:  'bg-red-500/20 text-red-400',
}

const MINERAL_OPTIONS = [
  '', 'Lithium', 'Cobalt', 'Nickel', 'Copper', 'Neodymium',
  'Rare Earth', 'Aluminum', 'Platinum', 'Palladium',
]

export default function Companies() {
  const [mineralFilter, setMineralFilter] = useState('')

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies', mineralFilter],
    queryFn: () => api.getCompanies(mineralFilter || undefined),
    refetchInterval: 5 * 60_000,
  })

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-stone-500">矿产筛选:</span>
        {MINERAL_OPTIONS.map(m => (
          <button
            key={m}
            onClick={() => setMineralFilter(m)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              mineralFilter === m
                ? 'bg-orange-600 text-white'
                : 'bg-stone-800 text-stone-400 hover:text-white'
            }`}
          >
            {m || '全部'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center text-stone-500 py-16">加载中...</div>
      ) : companies.length === 0 ? (
        <div className="card text-center py-16 text-stone-500">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>暂无企业数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map(c => {
            const snap = c.latest_snapshot
            const up = snap?.price_change_pct != null && snap.price_change_pct >= 0
            return (
              <div key={c.id} className="card flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white text-sm truncate">
                        {c.name_zh ?? c.name}
                      </h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${EXCHANGE_COLOR[c.exchange ?? ''] ?? 'bg-stone-700 text-stone-400'}`}>
                        {c.ticker}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">{c.country} · {c.exchange}</p>
                  </div>
                  {c.website && (
                    <a href={c.website} target="_blank" rel="noopener noreferrer"
                       className="text-stone-600 hover:text-stone-400 shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Stock price */}
                {snap ? (
                  <div className="flex items-center justify-between bg-stone-800/60 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-lg font-bold text-orange-300">
                        {snap.stock_price?.toFixed(2) ?? '—'}
                      </p>
                      {snap.market_cap_usd_bn && (
                        <p className="text-xs text-stone-500">
                          市值 ~${snap.market_cap_usd_bn.toFixed(1)}B
                        </p>
                      )}
                    </div>
                    {snap.price_change_pct != null && (
                      <div className={`flex items-center gap-1 text-sm font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                        {up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {up ? '+' : ''}{snap.price_change_pct.toFixed(2)}%
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-stone-800/40 rounded-lg px-3 py-2 text-xs text-stone-600">
                    暂无行情数据
                  </div>
                )}

                {/* Minerals */}
                <div className="flex flex-wrap gap-1.5">
                  {(c.minerals_focus ?? []).map(m => (
                    <span key={m} className="text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded">
                      {m}
                    </span>
                  ))}
                </div>

                {/* Description */}
                <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">
                  {c.description_zh ?? c.description}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
