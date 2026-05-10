import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Database, Map, Building2, FileText, Newspaper, TrendingUp, GitBranch } from 'lucide-react'

const TOP_NAV = [
  { to: '/', label: '风险态势图', icon: LayoutDashboard },
]

const RISK_NAV = [
  { to: '/risk-forecast',        label: '政策新闻推送', icon: Newspaper },
  { to: '/risk-forecast/prices', label: '价格行情',     icon: TrendingUp },
  { to: '/risk-deduction',       label: '风险推演',     icon: GitBranch },
]

const BOTTOM_NAV = [
  { to: '/minerals',  label: '矿产数据库', icon: Database },
  { to: '/companies', label: '矿企动态',   icon: Building2 },
  { to: '/map',       label: '分布地图',   icon: Map },
  { to: '/briefing',  label: '分析简报',   icon: FileText },
]

type NavItemProps = { to: string; label: string; icon: React.FC<{ className?: string }>; end?: boolean }

function NavItem({ to, label, icon: Icon, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
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
  )
}

export default function Sidebar() {
  return (
    <aside className="w-56 bg-stone-900 border-r border-stone-800 flex flex-col shrink-0">
      <div className="px-5 py-6 border-b border-stone-800">
        <div className="text-xs text-orange-400 font-semibold tracking-widest uppercase mb-1">
          Critical Mineral
        </div>
        <div className="text-lg font-bold text-white">监测平台</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {TOP_NAV.map(item => (
          <NavItem key={item.to} {...item} end />
        ))}

        <div className="pt-3 pb-1">
          <div className="px-3 text-[10px] font-semibold text-stone-600 uppercase tracking-widest">
            风险预测
          </div>
        </div>
        {RISK_NAV.map(item => (
          <NavItem key={item.to} {...item} end />
        ))}

        <div className="pt-2" />

        {BOTTOM_NAV.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-stone-800 text-xs text-stone-600">
        数据来源: USGS · LME · Mining.com
      </div>
    </aside>
  )
}
