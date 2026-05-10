import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap,
} from 'react-leaflet'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, Tooltip as RcTooltip, ResponsiveContainer,
} from 'recharts'
import 'leaflet/dist/leaflet.css'
import { api } from '../api/client'
import type { ProducerCountry, TickerItem } from '../types'
import {
  ChevronRight, X, Building2, Newspaper, MapPin, Zap,
} from 'lucide-react'

// ── Static data ────────────────────────────────────────────────────────────────

const CONTINENTS = [
  { label: '全球',  center: [20,   0]   as [number,number], zoom: 2 },
  { label: '亚洲',  center: [35,  100]  as [number,number], zoom: 3 },
  { label: '欧洲',  center: [54,  15]   as [number,number], zoom: 4 },
  { label: '非洲',  center: [-5,  22]   as [number,number], zoom: 3 },
  { label: '北美',  center: [45, -100]  as [number,number], zoom: 3 },
  { label: '南美',  center: [-15, -60]  as [number,number], zoom: 3 },
  { label: '大洋洲',center: [-25, 135]  as [number,number], zoom: 4 },
]

// from: [lat,lng], to: [lat,lng], mineral, volume (1-4), color
const TRADE_FLOWS = [
  { from:[35.86,104.19], to:[37.09,-95.71], label:'REE → 美国',      mineral:'稀土', volume:4, color:'#f97316' },
  { from:[35.86,104.19], to:[51.16,10.45],  label:'REE/锂 → 欧洲',   mineral:'稀土·锂', volume:3, color:'#f97316' },
  { from:[35.86,104.19], to:[36.20,138.25], label:'稀土 → 日本',      mineral:'稀土', volume:3, color:'#f97316' },
  { from:[-25.27,133.77],to:[35.86,104.19], label:'锂精矿 → 中国',    mineral:'锂', volume:4, color:'#a78bfa' },
  { from:[-4.04,21.76],  to:[35.86,104.19], label:'钴 → 中国',        mineral:'钴', volume:4, color:'#60a5fa' },
  { from:[-35.67,-71.54],to:[35.86,104.19], label:'铜/锂 → 中国',     mineral:'铜·锂', volume:3, color:'#34d399' },
  { from:[-35.67,-71.54],to:[37.09,-95.71], label:'铜 → 美国',        mineral:'铜', volume:2, color:'#34d399' },
  { from:[-30.56,22.94], to:[36.20,138.25], label:'PGM → 日本',       mineral:'铂族', volume:2, color:'#fbbf24' },
  { from:[-30.56,22.94], to:[51.16,10.45],  label:'PGM → 欧洲',       mineral:'铂族', volume:2, color:'#fbbf24' },
  { from:[-0.79,113.92], to:[35.86,104.19], label:'镍 → 中国',        mineral:'镍', volume:3, color:'#06b6d4' },
  { from:[61.52,105.32], to:[51.16,10.45],  label:'钯金/镍 → 欧洲',   mineral:'钯·镍', volume:2, color:'#e879f9' },
  { from:[56.13,-106.35],to:[37.09,-95.71], label:'矿产 → 美国',      mineral:'铀·镍', volume:2, color:'#34d399' },
  { from:[48.02,66.92],  to:[35.86,104.19], label:'铀/铬 → 中国',     mineral:'铀·铬', volume:2, color:'#fbbf24' },
]

const ALERT_COLOR: Record<string, string> = {
  critical:'#dc2626', high:'#ea580c', medium:'#d97706', none:'#475569',
}
const MINERAL_CAT_COLOR: Record<string, string> = {
  rare_earth:'#a78bfa', battery:'#34d399', strategic:'#60a5fa',
  pgm:'#fbbf24', industrial:'#94a3b8',
}
const CAT_ZH: Record<string,string> = {
  policy:'政策', industry:'行业', price:'价格', corporate:'企业', exploration:'勘探',
}
const CAT_COLOR: Record<string,string> = {
  policy:'bg-purple-500/20 text-purple-400',
  industry:'bg-orange-500/20 text-orange-400',
  price:'bg-amber-500/20 text-amber-400',
  corporate:'bg-emerald-500/20 text-emerald-400',
  exploration:'bg-sky-500/20 text-sky-400',
}
const RISK_COLOR: Record<string,string> = {
  critical:'text-red-400', high:'text-orange-400', medium:'text-amber-400', low:'text-emerald-400',
}
const RISK_BG: Record<string,string> = {
  critical:'bg-red-500/20 border-red-500/30',
  high:'bg-orange-500/20 border-orange-500/30',
  medium:'bg-amber-500/20 border-amber-500/30',
  low:'bg-emerald-500/20 border-emerald-500/30',
}
const RISK_LABEL: Record<string,string> = { critical:'高', high:'中高', medium:'中', low:'低' }
const PIE_COLORS = ['#f97316','#a78bfa','#34d399','#60a5fa','#fbbf24','#06b6d4']

type LayerId = 'influence'|'alert'|'risk'|'trade'|'mineral'

// ── Bezier curve helper ────────────────────────────────────────────────────────

function bezierPath(from:[number,number], to:[number,number]): [number,number][] {
  const midLat = (from[0]+to[0])/2
  const midLng = (from[1]+to[1])/2
  const dist = Math.sqrt((to[0]-from[0])**2 + (to[1]-from[1])**2)
  const ctrl: [number,number] = [midLat + dist*0.22, midLng]
  const pts: [number,number][] = []
  for (let i=0; i<=40; i++) {
    const t=i/40
    pts.push([
      (1-t)*(1-t)*from[0] + 2*(1-t)*t*ctrl[0] + t*t*to[0],
      (1-t)*(1-t)*from[1] + 2*(1-t)*t*ctrl[1] + t*t*to[1],
    ])
  }
  return pts
}

// ── Map controller ─────────────────────────────────────────────────────────────

function MapController({ center, zoom }:{ center:[number,number]; zoom:number }) {
  const map = useMap()
  useEffect(()=>{ map.setView(center, zoom, { animate:true, duration:0.8 }) }, [center,zoom,map])
  return null
}

// ── Vertical news ticker ───────────────────────────────────────────────────────

function NewsTicker({ items }:{ items:TickerItem[] }) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(()=>{
    if (!items.length) return
    const t = setInterval(()=>{
      setVisible(false)
      setTimeout(()=>{ setIdx(i=>(i+1)%items.length); setVisible(true) }, 350)
    }, 3000)
    return ()=>clearInterval(t)
  }, [items.length])

  const item = items[idx]
  const typeStyle: Record<string,string> = {
    alert:'text-red-400 border-red-500/40 bg-red-500/10',
    price:'text-amber-400 border-amber-500/40 bg-amber-500/10',
    news:'text-orange-300 border-orange-500/40 bg-orange-500/10',
  }
  const typeLabel: Record<string,string> = { alert:'⚠ 预警', price:'价格变动', news:'最新态势' }

  return (
    <div className="h-9 shrink-0 bg-stone-950 border-b border-stone-800 flex items-center px-4 gap-3 overflow-hidden">
      <span className="text-xs font-bold text-orange-400 shrink-0 flex items-center gap-1">
        <Zap className="w-3 h-3" />最新动态
      </span>
      <div className={`h-5 px-1.5 rounded text-xs font-semibold border shrink-0 flex items-center ${typeStyle[item?.type??'news']??typeStyle.news}`}>
        {typeLabel[item?.type??'news']}
      </div>
      <div
        className="flex-1 overflow-hidden text-xs text-stone-300 transition-all duration-300"
        style={{ opacity: visible?1:0, transform: visible?'translateY(0)':'translateY(-8px)' }}
      >
        {item?.url
          ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-orange-300 transition-colors truncate block">{item.text}</a>
          : <span className="truncate block">{item?.text}</span>
        }
      </div>
      <span className="text-xs text-stone-600 shrink-0">
        {items.length>0 ? `${idx+1} / ${items.length}` : ''}
      </span>
    </div>
  )
}

// ── Layer panel ────────────────────────────────────────────────────────────────

const LAYER_CFG: { id:LayerId; label:string; desc:string; color:string }[] = [
  { id:'influence', label:'全球关键矿产影响力', desc:'综合影响力指数展示', color:'bg-orange-500' },
  { id:'alert',     label:'高度警报地区',       desc:'风险等级：高',      color:'bg-red-500' },
  { id:'risk',      label:'风险升高监测地区',   desc:'风险等级：中-高',   color:'bg-amber-500' },
  { id:'trade',     label:'贸易流动航线',       desc:'按矿产与贸易流向',  color:'bg-blue-500' },
  { id:'mineral',   label:'关键矿产分布',       desc:'可多选',            color:'bg-purple-500' },
]

function LayerPanel({
  active, onToggle, minerals, selectedMinerals, onToggleMineral,
}:{
  active:Set<LayerId>; onToggle:(l:LayerId)=>void
  minerals:{id:number;name:string;name_zh:string|null;symbol:string|null}[]
  selectedMinerals:Set<number>; onToggleMineral:(id:number)=>void
}) {
  const [search, setSearch] = useState('')
  const filtered = minerals.filter(m=>
    !search || (m.name_zh??m.name).toLowerCase().includes(search.toLowerCase()) || (m.symbol??'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="w-52 shrink-0 bg-stone-950/90 border-r border-stone-800 flex flex-col">
      <div className="px-3 py-2.5 border-b border-stone-800">
        <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">图层控制（可多选）</div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {LAYER_CFG.map((l,i)=>{
          const on = active.has(l.id)
          return (
            <div key={l.id}>
              <button
                onClick={()=>onToggle(l.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all text-left ${on?'bg-stone-800':'hover:bg-stone-900'}`}
              >
                <span className={`w-5 h-5 rounded shrink-0 flex items-center justify-center text-xs font-bold text-white ${l.color}`}>{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium leading-tight ${on?'text-white':'text-stone-400'}`}>{l.label}</div>
                  <div className="text-xs text-stone-600 truncate">{l.desc}</div>
                </div>
                <div className={`w-9 h-5 rounded-full transition-colors shrink-0 relative ${on?'bg-orange-500':'bg-stone-700'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on?'left-4':'left-0.5'}`}/>
                </div>
              </button>
              {l.id==='mineral' && on && (
                <div className="ml-2 mt-1 mb-1 space-y-1">
                  <input
                    className="w-full px-2 py-1 text-xs bg-stone-800 border border-stone-700 rounded text-stone-300 placeholder-stone-600 focus:outline-none focus:border-orange-500"
                    placeholder="搜索矿产"
                    value={search}
                    onChange={e=>setSearch(e.target.value)}
                  />
                  {selectedMinerals.size>0 && (
                    <div className="text-xs text-stone-500 flex justify-between px-1">
                      <span>已选 {selectedMinerals.size}/{minerals.length}</span>
                      <button className="text-orange-400 hover:text-orange-300" onClick={()=>minerals.forEach(m=>{ if(selectedMinerals.has(m.id)) onToggleMineral(m.id) })}>清空</button>
                    </div>
                  )}
                  <div className="max-h-44 overflow-y-auto space-y-0.5 pr-0.5">
                    {filtered.map(m=>(
                      <label key={m.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-stone-800 cursor-pointer">
                        <input type="checkbox" checked={selectedMinerals.has(m.id)}
                          onChange={()=>onToggleMineral(m.id)}
                          className="accent-orange-500 w-3 h-3"
                        />
                        <span className={`text-xs font-mono w-6 shrink-0 ${MINERAL_CAT_COLOR[m.symbol??'']??'text-stone-500'}`}>{m.symbol}</span>
                        <span className="text-xs text-stone-300">{m.name_zh??m.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="px-3 py-3 border-t border-stone-800 space-y-3">
        <div className="text-xs font-bold text-stone-600 uppercase tracking-widest">图例说明</div>
        {active.has('influence') && (
          <div className="space-y-1">
            <div className="text-xs text-stone-600 mb-0.5">影响力（综合影响力指数）</div>
            {[['极高 (80-100)','w-5 h-5 opacity-95'],['高 (60-80)','w-4 h-4 opacity-75'],['中 (40-60)','w-3 h-3 opacity-55'],['低 (0-40)','w-2 h-2 opacity-40']].map(([l,c])=>(
              <div key={l} className="flex items-center gap-2 text-xs text-stone-500">
                <span className={`${c} rounded-full bg-orange-500 shrink-0 inline-block`}/>
                {l}
              </div>
            ))}
          </div>
        )}
        {(active.has('alert')||active.has('risk')) && (
          <div className="space-y-1">
            <div className="text-xs text-stone-600 mb-0.5">区域风险</div>
            {[['bg-red-500','高度警报（高风险）'],['bg-orange-500','风险升高（中-高风险）'],['bg-amber-500','持续监测']].map(([c,l])=>(
              <div key={l} className="flex items-center gap-2 text-xs text-stone-500">
                <span className={`w-3 h-3 rounded-full ${c} shrink-0`}/>{l}
              </div>
            ))}
          </div>
        )}
        {active.has('trade') && (
          <div className="space-y-1">
            <div className="text-xs text-stone-600 mb-0.5">贸易流动量（年贸易额）</div>
            {[['#f97316','稀土供应链'],['#a78bfa','锂矿贸易'],['#34d399','铜矿流向'],['#60a5fa','钴镍流向'],['#fbbf24','铂族金属']].map(([c,l])=>(
              <div key={l} className="flex items-center gap-2 text-xs text-stone-500">
                <span className="w-5 h-0.5 shrink-0" style={{background:c}}/>
                {l}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Risk radar chart ───────────────────────────────────────────────────────────

function RiskRadar({ data }:{ data:{supply:number;price:number;geopolitical:number;industry:number;environmental:number} }) {
  const radarData = [
    { label:'供应风险', value:data.supply },
    { label:'价格风险', value:data.price },
    { label:'地缘政治', value:data.geopolitical },
    { label:'产业风险', value:data.industry },
    { label:'环境风险', value:data.environmental },
  ]
  return (
    <ResponsiveContainer width="100%" height={160}>
      <RadarChart data={radarData} margin={{top:10,right:20,bottom:10,left:20}}>
        <PolarGrid stroke="#44403c" />
        <PolarAngleAxis dataKey="label" tick={{ fill:'#78716c', fontSize:10 }} />
        <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false} />
        <Radar dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.25} strokeWidth={1.5} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ── Mineral share donut ────────────────────────────────────────────────────────

function MineralDonut({ data }:{ data:{name:string;value:number}[] }) {
  return (
    <div className="flex items-center gap-3">
      <ResponsiveContainer width={80} height={80}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={24} outerRadius={36} dataKey="value" strokeWidth={0}>
            {data.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
          </Pie>
          <RcTooltip formatter={(v:number)=>[`${v}%`]} contentStyle={{background:'#1c1917',border:'1px solid #44403c',borderRadius:6,fontSize:11}} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1">
        {data.map((d,i)=>(
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{background:PIE_COLORS[i%PIE_COLORS.length]}}/>
            <span className="text-stone-400 flex-1 truncate">{d.name}</span>
            <span className="text-stone-300 font-medium">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Simple relationship graph ──────────────────────────────────────────────────

function RelationGraph({ center, related }:{ center:string; related:{country:string;shared_minerals:string[]}[] }) {
  const nodes = related.slice(0,6)
  const r = 68, cx = 110, cy = 90
  return (
    <svg width={220} height={180} className="w-full">
      {nodes.map((n,i)=>{
        const angle = (i/nodes.length)*2*Math.PI - Math.PI/2
        const x = cx + r*Math.cos(angle)
        const y = cy + r*Math.sin(angle)
        return (
          <g key={n.country}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#f97316" strokeWidth={1} strokeOpacity={0.35} strokeDasharray="3 2"/>
            <circle cx={x} cy={y} r={16} fill="#292524" stroke="#f97316" strokeWidth={1} strokeOpacity={0.5}/>
            <text x={x} y={y-1} textAnchor="middle" dominantBaseline="middle" fill="#e7e5e4" fontSize={7} fontWeight={600}>
              {n.country.slice(0,5)}
            </text>
            <text x={x} y={y+8} textAnchor="middle" fill="#78716c" fontSize={6}>
              {n.shared_minerals[0]?.slice(0,4)}
            </text>
          </g>
        )
      })}
      <circle cx={cx} cy={cy} r={22} fill="#292524" stroke="#f97316" strokeWidth={1.5}/>
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={8} fontWeight={700}>
        {center.slice(0,6)}
      </text>
    </svg>
  )
}

// ── Country detail panel ───────────────────────────────────────────────────────

function CountryPanel({ country, onClose }:{ country:string; alertLevel:string; onClose:()=>void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['country', country],
    queryFn: () => api.getCountryDetail(country),
  })

  return (
    <div className="w-80 shrink-0 bg-stone-950 border-l border-stone-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-800 shrink-0 flex items-start justify-between">
        <div>
          <h2 className="font-bold text-white text-base leading-tight">{country}</h2>
          {data && (
            <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-semibold border ${RISK_BG[data.risk.risk_level]}`}>
              <span className={RISK_COLOR[data.risk.risk_level]}>风险等级：{RISK_LABEL[data.risk.risk_level]}</span>
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-stone-800 text-stone-500 hover:text-white transition-colors shrink-0 mt-0.5">
          <X className="w-4 h-4"/>
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-stone-600 text-sm">加载中...</div>
      ) : !data ? null : (
        <div className="flex-1 overflow-y-auto divide-y divide-stone-800">

          {/* Risk score + radar */}
          <section className="px-4 py-3">
            <div className="flex items-center gap-4 mb-2">
              <div>
                <div className={`text-3xl font-black ${RISK_COLOR[data.risk.risk_level]}`}>{data.risk.risk_score}</div>
                <div className="text-xs text-stone-500">/100 综合风险</div>
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                  {[['供应',data.risk.supply],['价格',data.risk.price],['地缘',data.risk.geopolitical],['产业',data.risk.industry]].map(([l,v])=>(
                    <div key={String(l)} className="flex items-center gap-1">
                      <span className="text-stone-500 w-6">{l}</span>
                      <div className="flex-1 h-1 bg-stone-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{width:`${v}%`}}/>
                      </div>
                      <span className="text-stone-400 w-6 text-right">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <RiskRadar data={data.risk}/>
          </section>

          {/* Mineral share */}
          {data.mineral_share.length > 0 && (
            <section className="px-4 py-3">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">
                关键矿产占比（全球供应占比）
              </div>
              <MineralDonut data={data.mineral_share}/>
            </section>
          )}

          {/* Mining sites */}
          {data.mining_sites.length > 0 && (
            <section className="px-4 py-3">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3"/>矿产基地（主要矿区）
              </div>
              <div className="space-y-2">
                {data.mining_sites.map(s=>(
                  <div key={s.name} className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-stone-200 font-medium leading-tight">{s.name}</div>
                      <div className="text-xs text-stone-500">{s.location} · {s.mineral}</div>
                    </div>
                    <div className="text-xs text-stone-600 text-right shrink-0">{s.output}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Minerals list */}
          {data.minerals.length > 0 && (
            <section className="px-4 py-3">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">矿产资源</div>
              <div className="grid grid-cols-2 gap-1.5">
                {data.minerals.map(m=>{
                  const pct = m.latest_price?.price_change_pct
                  return (
                    <div key={m.id} className="flex items-center gap-1.5 bg-stone-900 rounded px-2 py-1.5">
                      <span className="text-xs font-mono w-6 shrink-0" style={{color:MINERAL_CAT_COLOR[m.category??'']??'#78716c'}}>{m.symbol}</span>
                      <span className="text-xs text-stone-300 flex-1 truncate">{m.name_zh??m.name}</span>
                      {pct!=null && (
                        <span className={`text-xs font-medium ${pct>=0?'text-emerald-400':'text-red-400'}`}>
                          {pct>=0?'+':''}{pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Current events */}
          {data.recent_news.length > 0 && (
            <section className="px-4 py-3">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Newspaper className="w-3 h-3"/>当前事件（最新动态）
              </div>
              <div className="space-y-2.5">
                {data.recent_news.slice(0,5).map(n=>(
                  <div key={n.id} className="text-xs">
                    <div className="flex items-start gap-1.5">
                      {n.category && (
                        <span className={`badge mt-0.5 shrink-0 ${CAT_COLOR[n.category]??'bg-stone-700 text-stone-400'}`}>{CAT_ZH[n.category]??n.category}</span>
                      )}
                      <div>
                        {n.url
                          ? <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-stone-300 hover:text-orange-300 line-clamp-2 transition-colors">{n.title}</a>
                          : <p className="text-stone-300 line-clamp-2">{n.title}</p>
                        }
                        <p className="text-stone-600 mt-0.5">{n.source}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Companies */}
          {data.companies.length > 0 && (
            <section className="px-4 py-3">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Building2 className="w-3 h-3"/>关联企业
              </div>
              <div className="space-y-2">
                {data.companies.slice(0,4).map(co=>{
                  const pct = co.latest_snapshot?.price_change_pct
                  return (
                    <div key={co.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-stone-200 truncate">{co.name_zh??co.name}</div>
                        <div className="text-xs text-stone-600">{co.ticker} · {co.exchange}</div>
                      </div>
                      {pct!=null && (
                        <span className={`text-xs font-semibold ${pct>=0?'text-emerald-400':'text-red-400'}`}>
                          {pct>=0?'+':''}{pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Relationship graph */}
          {data.related_countries.length > 0 && (
            <section className="px-4 py-3">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">
                关联关系图（产业依赖 / 贸易关系）
              </div>
              <RelationGraph center={country} related={data.related_countries}/>
              <div className="mt-2 space-y-1">
                {data.related_countries.slice(0,4).map(r=>(
                  <div key={r.country} className="flex items-center gap-2 text-xs">
                    <ChevronRight className="w-3 h-3 text-stone-600"/>
                    <span className="text-stone-300 w-20 shrink-0">{r.country}</span>
                    <span className="text-stone-600 truncate">{r.shared_minerals.slice(0,3).join(' · ')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Home component ────────────────────────────────────────────────────────

export default function Home() {
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(
    ()=>new Set(['influence','alert','risk','trade'] as LayerId[])
  )
  const [selectedMinerals, setSelectedMinerals] = useState<Set<number>>(()=>new Set())
  const [selectedCountry, setSelectedCountry] = useState<string|null>(null)
  const [selectedAlert, setSelectedAlert]   = useState<string>('none')
  const [continent, setContinent]           = useState(CONTINENTS[0])

  const { data: producers=[] } = useQuery({
    queryKey:['map'], queryFn:api.getProducerMap, refetchInterval:5*60_000,
  })
  const { data: ticker=[] } = useQuery({
    queryKey:['map-ticker'], queryFn:api.getMapTicker, refetchInterval:60_000,
  })
  const { data: minerals=[] } = useQuery({
    queryKey:['minerals'], queryFn:()=>api.getMinerals(),
  })

  const toggleLayer = useCallback((l:LayerId)=>{
    setActiveLayers(prev=>{ const s=new Set(prev); s.has(l)?s.delete(l):s.add(l); return s })
  },[])
  const toggleMineral = useCallback((id:number)=>{
    setSelectedMinerals(prev=>{ const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s })
  },[])

  const handleClick = (p:ProducerCountry)=>{
    setSelectedCountry(p.country); setSelectedAlert(p.alert_level??'none')
  }

  // Build visible markers for each layer
  const influenceMarkers = activeLayers.has('influence') ? producers : []
  const alertMarkers  = activeLayers.has('alert') ? producers.filter(p=>p.alert_level==='critical'||p.alert_level==='high') : []
  const riskMarkers   = activeLayers.has('risk')  ? producers.filter(p=>p.alert_level==='medium') : []
  const mineralMarkers = activeLayers.has('mineral') && selectedMinerals.size>0
    ? producers.filter(p=>p.minerals.some(m=>selectedMinerals.has(m.id))) : []
  const showTrade = activeLayers.has('trade')

  return (
    <div className="-mx-6 -mt-6 -mb-6 flex flex-col overflow-hidden" style={{height:'calc(100vh - 56px)'}}>
      <NewsTicker items={ticker}/>

      <div className="flex flex-1 overflow-hidden">
        <LayerPanel
          active={activeLayers} onToggle={toggleLayer}
          minerals={minerals.map(m=>({id:m.id,name:m.name,name_zh:m.name_zh,symbol:m.symbol}))}
          selectedMinerals={selectedMinerals} onToggleMineral={toggleMineral}
        />

        {/* Map */}
        <div className="flex-1 relative overflow-hidden">
          {/* Continent switcher */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex gap-1 bg-stone-900/90 backdrop-blur border border-stone-700 rounded-xl p-1">
            <span className="text-xs text-stone-500 px-2 flex items-center">视图范围：</span>
            {CONTINENTS.map(c=>(
              <button key={c.label} onClick={()=>setContinent(c)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${continent.label===c.label?'bg-orange-600 text-white':'text-stone-400 hover:text-white hover:bg-stone-700'}`}>
                {c.label}
              </button>
            ))}
          </div>

          <MapContainer
            center={continent.center} zoom={continent.zoom}
            style={{height:'100%',width:'100%',background:'#0c0a09'}}
            zoomControl={false}
          >
            <MapController center={continent.center} zoom={continent.zoom}/>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            />

            {/* Trade flow curved lines */}
            {showTrade && TRADE_FLOWS.map((f,i)=>(
              <Polyline key={i} positions={bezierPath(f.from as [number,number], f.to as [number,number])}
                pathOptions={{color:f.color, weight:f.volume*0.7, opacity:0.65, dashArray:'7 4'}}>
                <Popup>
                  <div style={{fontFamily:'sans-serif',fontSize:12}}>
                    <div style={{fontWeight:700,marginBottom:3}}>{f.label}</div>
                    <div style={{color:'#78716c'}}>矿产：{f.mineral}</div>
                    <div style={{color:'#78716c'}}>流量：{'●'.repeat(f.volume)+'○'.repeat(4-f.volume)}</div>
                  </div>
                </Popup>
              </Polyline>
            ))}

            {/* Destination arrows for trade flows */}
            {showTrade && TRADE_FLOWS.map((f,i)=>(
              <CircleMarker key={`arrow-${i}`}
                center={f.to as [number,number]} radius={3}
                pathOptions={{color:f.color,fillColor:f.color,fillOpacity:0.9,weight:0}}>
              </CircleMarker>
            ))}

            {/* Influence circles */}
            {influenceMarkers.map(p=>{
              const s=p.influence_score??0
              const radius=5+Math.sqrt(s)*2.2
              const opacity=0.3+(s/100)*0.6
              const sel=selectedCountry===p.country
              return (
                <CircleMarker key={`inf-${p.country}`} center={[p.lat,p.lng]}
                  radius={radius+(sel?4:0)}
                  pathOptions={{color:sel?'#fff':'#f97316',fillColor:'#f97316',fillOpacity:opacity,weight:sel?2:1}}
                  eventHandlers={{click:()=>handleClick(p)}}>
                  <Popup>
                    <div style={{fontFamily:'sans-serif',fontSize:12,minWidth:130}}>
                      <div style={{fontWeight:700,marginBottom:3}}>{p.country}</div>
                      <div style={{color:'#78716c'}}>影响力指数 {s} · {p.mineral_count} 种矿产</div>
                      <button onClick={()=>handleClick(p)} style={{color:'#f97316',fontSize:11,cursor:'pointer',background:'none',border:'none',padding:0,marginTop:4}}>查看详情 →</button>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}

            {/* Alert markers */}
            {alertMarkers.map(p=>(
              <CircleMarker key={`alert-${p.country}`} center={[p.lat,p.lng]} radius={12}
                pathOptions={{color:ALERT_COLOR[p.alert_level??'none'],fillColor:ALERT_COLOR[p.alert_level??'none'],fillOpacity:0.55,weight:2}}
                eventHandlers={{click:()=>handleClick(p)}}>
                <Popup><span style={{fontSize:12,fontFamily:'sans-serif'}}>{p.country} — {p.alert_level==='critical'?'高度警报':'风险升高'}</span></Popup>
              </CircleMarker>
            ))}

            {/* Risk markers */}
            {riskMarkers.map(p=>(
              <CircleMarker key={`risk-${p.country}`} center={[p.lat,p.lng]} radius={9}
                pathOptions={{color:'#d97706',fillColor:'#d97706',fillOpacity:0.45,weight:1.5}}
                eventHandlers={{click:()=>handleClick(p)}}>
              </CircleMarker>
            ))}

            {/* Per-mineral markers */}
            {mineralMarkers.map(p=>{
              const mineral = p.minerals.find(m=>selectedMinerals.has(m.id))
              const color = MINERAL_CAT_COLOR[mineral?.category??''] ?? '#60a5fa'
              return (
                <CircleMarker key={`min-${p.country}`} center={[p.lat,p.lng]} radius={10}
                  pathOptions={{color,fillColor:color,fillOpacity:0.6,weight:1.5}}
                  eventHandlers={{click:()=>handleClick(p)}}>
                  <Popup>
                    <span style={{fontSize:12,fontFamily:'sans-serif'}}>{p.country} — {mineral?.name_zh??mineral?.name}</span>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>

          {/* Bottom status bar */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-stone-900/80 backdrop-blur border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-500">
            数据来源: USGS · LME · Mining.com · 彭博 · 路透社等 &nbsp;·&nbsp; 更新时间: {new Date().toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>

        {/* Country detail panel */}
        {selectedCountry && (
          <CountryPanel country={selectedCountry} alertLevel={selectedAlert} onClose={()=>setSelectedCountry(null)}/>
        )}
      </div>
    </div>
  )
}
