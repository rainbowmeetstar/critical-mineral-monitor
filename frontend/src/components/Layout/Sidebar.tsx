import { NavLink } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Newspaper, Database, Map, Bell, Building2, FileText } from 'lucide-react'

const NAV = [
  { to: '/',          label: '风险态势图', icon: LayoutDashboard },
  { to: '/prices',    label: '价格行情', icon: TrendingUp },
  { to: '/news',      label: '资讯动态', icon: Newspaper },
  { to: '/minerals',  label: '矿产数据库',icon: Database },
  { to: '/companies', label: '矿企动态', icon: Building2 },
  { to: '/map',       label: '分布地图', icon: Map },
  { to: '/alerts',    label: '价格预警', icon: Bell },
  { to: '/briefing',  label: '分析简报', icon: FileText },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-stone-900 border-r border-stone-800 flex flex-col shrink-0">
      <div className="px-5 py-6 border-b border-stone-800">
        <div className="text-xs text-orange-400 font-semibold tracking-widest uppercase mb-1">
          Critical Mineral
        </div>
        <div className="text-lg font-bold text-white">监测平台</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-orange-600/20 text-orange-400 font-medium'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-stone-800 text-xs text-stone-600">
        数据来源: USGS · LME · Mining.com
      </div>
    </aside>
  )
}
