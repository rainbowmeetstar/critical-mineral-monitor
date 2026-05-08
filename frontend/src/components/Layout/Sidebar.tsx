import { NavLink } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Newspaper, Database, Map, Bell } from 'lucide-react'

const NAV = [
  { to: '/',        label: '总览',     icon: LayoutDashboard },
  { to: '/prices',  label: '价格行情', icon: TrendingUp },
  { to: '/news',    label: '资讯动态', icon: Newspaper },
  { to: '/minerals',label: '矿产数据库',icon: Database },
  { to: '/map',     label: '分布地图', icon: Map },
  { to: '/alerts',  label: '价格预警', icon: Bell },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="text-xs text-sky-400 font-semibold tracking-widest uppercase mb-1">
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
                  ? 'bg-sky-600/20 text-sky-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-600">
        数据来源: USGS · LME · Mining.com
      </div>
    </aside>
  )
}
