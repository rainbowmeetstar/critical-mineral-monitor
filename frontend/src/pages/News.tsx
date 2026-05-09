import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ExternalLink, Newspaper, Download } from 'lucide-react'

const CATEGORY_OPTIONS = [
  { value: '', label: '全部类别' },
  { value: 'policy', label: '政府政策' },
  { value: 'industry', label: '行业资讯' },
  { value: 'price', label: '价格动态' },
  { value: 'corporate', label: '企业公告' },
  { value: 'exploration', label: '勘探开发' },
]

const LEVEL_OPTIONS = [
  { value: '', label: '全部层级' },
  { value: 'government', label: '政府层面' },
  { value: 'industry_assoc', label: '行业协会' },
  { value: 'corporate', label: '企业层面' },
]

const CATEGORY_STYLE: Record<string, string> = {
  policy:      'bg-purple-500/15 text-purple-400 border-purple-500/30',
  industry:    'bg-orange-500/15 text-orange-400 border-orange-500/30',
  price:       'bg-amber-500/15 text-amber-400 border-amber-500/30',
  corporate:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  exploration: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
}

const CATEGORY_ZH: Record<string, string> = {
  policy: '政策', industry: '行业', price: '价格', corporate: '企业', exploration: '勘探',
}

const LEVEL_ZH: Record<string, string> = {
  government: '政府', industry_assoc: '行业协会', corporate: '企业',
}

export default function News() {
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [mineral, setMineral] = useState('')
  const [page, setPage] = useState(1)

  const { data: articles, isLoading } = useQuery({
    queryKey: ['news', category, level, mineral, page],
    queryFn: () => api.getNews({ category: category || undefined, level: level || undefined, mineral: mineral || undefined, page, limit: 20 }),
  })

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="card flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-stone-500 mb-1.5">类别</label>
          <div className="flex gap-1 flex-wrap">
            {CATEGORY_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => { setCategory(o.value); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  category === o.value ? 'bg-orange-600 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1.5">层级</label>
          <div className="flex gap-1 flex-wrap">
            {LEVEL_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => { setLevel(o.value); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  level === o.value ? 'bg-orange-600 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1.5">矿产关键词</label>
          <input
            value={mineral}
            onChange={e => { setMineral(e.target.value); setPage(1) }}
            placeholder="如: Lithium"
            className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-stone-500 outline-none focus:border-orange-500"
          />
        </div>
        <div className="ml-auto">
          <a
            href={api.exportNews(30, category || undefined)}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-white text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />导出 CSV
          </a>
        </div>
      </div>

      {/* Articles */}
      {isLoading ? (
        <div className="text-center text-stone-500 py-16">加载中...</div>
      ) : (articles?.length ?? 0) === 0 ? (
        <div className="card text-center py-16 text-stone-500">
          <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>暂无匹配资讯</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles!.map(a => {
            const catStyle = CATEGORY_STYLE[a.category ?? ''] ?? 'bg-stone-700/50 text-stone-400 border-stone-600'
            return (
              <div key={a.id} className="card hover:border-stone-700 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {a.category && (
                        <span className={`badge border ${catStyle}`}>
                          {CATEGORY_ZH[a.category] ?? a.category}
                        </span>
                      )}
                      {a.level && (
                        <span className="badge bg-stone-700/60 text-stone-400">
                          {LEVEL_ZH[a.level] ?? a.level}
                        </span>
                      )}
                      {a.country && (
                        <span className="text-xs text-stone-600">{a.country}</span>
                      )}
                    </div>

                    <a
                      href={a.url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group"
                    >
                      <h3 className="text-sm font-medium text-stone-200 group-hover:text-orange-300 transition-colors leading-snug">
                        {a.title}
                        <ExternalLink className="inline-block w-3 h-3 ml-1 opacity-0 group-hover:opacity-70 transition-opacity" />
                      </h3>
                    </a>

                    {a.summary && (
                      <p className="text-xs text-stone-500 mt-1.5 line-clamp-2 leading-relaxed">
                        {a.summary}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-stone-600">{a.source}</span>
                      {a.published_at && (
                        <span className="text-xs text-stone-600">
                          {formatDistanceToNow(parseISO(a.published_at), { addSuffix: true, locale: zhCN })}
                        </span>
                      )}
                      {(a.minerals_mentioned?.length ?? 0) > 0 && (
                        <div className="flex gap-1 ml-auto">
                          {a.minerals_mentioned!.slice(0, 4).map(m => (
                            <span key={m} className="badge bg-stone-800 text-stone-400 text-[10px]">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex gap-2 justify-center pt-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="btn-ghost disabled:opacity-30"
        >
          上一页
        </button>
        <span className="flex items-center text-sm text-stone-400">第 {page} 页</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={(articles?.length ?? 0) < 20}
          className="btn-ghost disabled:opacity-30"
        >
          下一页
        </button>
      </div>
    </div>
  )
}
