import { useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../api/client'

const PAGE_TITLES: Record<string, string> = {
  '/': '全球关键矿产风险态势',
  '/prices': '矿产价格行情',
  '/news': '全球资讯动态',
  '/minerals': '矿产数据库',
}

export default function Header() {
  const { pathname } = useLocation()
  const title = PAGE_TITLES[pathname] ?? '关键矿产监测平台'

  const { mutate: triggerRefresh, isPending } = useMutation({
    mutationFn: () => api.triggerCrawlAll(),
  })

  return (
    <header className="h-14 border-b border-stone-800 bg-stone-900/50 flex items-center justify-between px-6 shrink-0">
      <h1 className="font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="text-xs text-stone-500">
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
        <button
          onClick={() => triggerRefresh()}
          disabled={isPending}
          className="btn-ghost text-xs"
          title="刷新数据"
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? '刷新中...' : '刷新数据'}
        </button>
      </div>
    </header>
  )
}
