import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { TrendingUp, TrendingDown, Newspaper, Database, Activity, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const CATEGORY_LABEL: Record<string, { label: string; color: string }> = {
  policy:      { label: '政策',   color: 'bg-purple-500/20 text-purple-400' },
  industry:    { label: '行业',   color: 'bg-sky-500/20 text-sky-400' },
  price:       { label: '价格',   color: 'bg-amber-500/20 text-amber-400' },
  corporate:   { label: '企业',   color: 'bg-emerald-500/20 text-emerald-400' },
  exploration: { label: '勘探',   color: 'bg-orange-500/20 text-orange-400' },
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: number | string; sub?: string
  icon: React.FC<{className?: string}>; color: string
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function Home() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval: 60_000,
  })

  const { data: minerals } = useQuery({
    queryKey: ['minerals'],
    queryFn: () => api.getMinerals(),
  })

  const mineralsWithPrice = minerals?.filter(m => m.latest_price !== null) ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <Activity className="w-6 h-6 animate-pulse mr-2" />
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 p-4">
        <AlertCircle className="w-5 h-5" />
        无法连接到后端服务，请确认后端已启动
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="追踪矿产种类"
          value={stats?.minerals_tracked ?? 0}
          icon={Database}
          color="bg-sky-600/20 text-sky-400"
        />
        <StatCard
          label="资讯文章"
          value={stats?.news_articles ?? 0}
          icon={Newspaper}
          color="bg-purple-600/20 text-purple-400"
        />
        <StatCard
          label="价格记录数"
          value={stats?.price_records ?? 0}
          sub="来自 LME / COMEX / NYMEX"
          icon={TrendingUp}
          color="bg-emerald-600/20 text-emerald-400"
        />
        <StatCard
          label="有价格数据的矿产"
          value={stats?.minerals_with_price_data ?? 0}
          icon={Activity}
          color="bg-amber-600/20 text-amber-400"
        />
      </div>

      {/* Latest Prices */}
      {mineralsWithPrice.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">最新价格快照</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {mineralsWithPrice.slice(0, 8).map(m => {
              const pct = m.latest_price?.price_change_pct
              const up = pct !== null && pct !== undefined && pct >= 0
              return (
                <div key={m.id} className="bg-slate-800/60 rounded-lg p-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm font-medium text-white">
                      {m.name_zh ?? m.name}
                    </span>
                    <span className="text-xs text-slate-500">{m.symbol}</span>
                  </div>
                  <div className="text-lg font-bold text-sky-300">
                    {m.latest_price?.price.toFixed(2)}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-slate-500">{m.latest_price?.unit}</span>
                    {pct !== null && pct !== undefined && (
                      <span className={`text-xs flex items-center gap-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(pct).toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* News by Category */}
      {stats?.news_by_category && Object.keys(stats.news_by_category).length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">资讯分类概况</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.news_by_category).map(([cat, count]) => {
              const cfg = CATEGORY_LABEL[cat] ?? { label: cat, color: 'bg-slate-700 text-slate-300' }
              return (
                <div key={cat} className={`badge px-3 py-1.5 text-sm ${cfg.color}`}>
                  {cfg.label} · {count} 条
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent News */}
      {(stats?.recent_news?.length ?? 0) > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">最新资讯</h2>
          <ul className="space-y-3">
            {stats!.recent_news.map(n => {
              const cfg = CATEGORY_LABEL[n.category] ?? { label: n.category, color: 'bg-slate-700 text-slate-300' }
              return (
                <li key={n.id} className="flex items-start gap-3 py-2 border-b border-slate-800 last:border-0">
                  <span className={`badge mt-0.5 shrink-0 ${cfg.color}`}>{cfg.label}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 leading-snug line-clamp-2">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {n.source} · {n.published_at
                        ? formatDistanceToNow(new Date(n.published_at), { addSuffix: true, locale: zhCN })
                        : ''}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {(stats?.news_articles === 0) && (
        <div className="card text-center py-10 text-slate-500">
          <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>暂无资讯数据。点击右上角「刷新数据」启动首次抓取。</p>
        </div>
      )}
    </div>
  )
}
