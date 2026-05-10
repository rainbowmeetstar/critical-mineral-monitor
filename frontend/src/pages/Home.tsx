import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api/client'
import type { ProducerCountry, TickerItem } from '../types'
import {
  Globe, AlertTriangle, TrendingUp, Activity, Layers,
  ChevronRight, X, Building2, Newspaper,
} from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────────

const CONTINENTS = [
  { label: '全球', center: [20, 0] as [number, number], zoom: 2 },
  { label: '亚洲', center: [35, 100] as [number, number], zoom: 3 },
  { label: '欧洲', center: [54, 15] as [number, number], zoom: 4 },
  { label: '非洲', center: [-5, 22] as [number, number], zoom: 3 },
  { label: '北美', center: [45, -100] as [number, number], zoom: 3 },
  { label: '南美', center: [-15, -60] as [number, number], zoom: 3 },
  { label: '大洋洲', center: [-25, 135] as [number, number], zoom: 4 },
]

const TRADE_FLOWS = [
  { path: [[35.86, 104.19], [37.09, -95.71]] as [number,number][], label: 'REE → 美国', color: '#f97316' },
  { path: [[35.86, 104.19], [51.16, 10.45]] as [number,number][], label: '电池金属 → 欧洲', color: '#f97316' },
  { path: [[-25.27, 133.77], [35.86, 104.19]] as [number,number][], label: '锂精矿 → 中国', color: '#a78bfa' },
  { path: [[-4.04, 21.76], [35.86, 104.19]] as [number,number][], label: '钴 → 中国', color: '#60a5fa' },
  { path: [[-35.67, -71.54], [35.86, 104.19]] as [number,number][], label: '铜/锂 → 中国', color: '#34d399' },
  { path: [[-35.67, -71.54], [37.09, -95.71]] as [number,number][], label: '铜 → 美国', color: '#34d399' },
  { path: [[-30.56, 22.94], [36.20, 138.25]] as [number,number][], label: 'PGM → 日本', color: '#fbbf24' },
  { path: [[-0.79, 113.92], [35.86, 104.19]] as [number,number][], label: '镍 → 中国', color: '#60a5fa' },
  { path: [[61.52, 105.32], [51.16, 10.45]] as [number,number][], label: '钯金 → 欧洲', color: '#e879f9' },
  { path: [[56.13, -106.35], [37.09, -95.71]] as [number,number][], label: '关键矿产 → 美国', color: '#34d399' },
  { path: [[48.02, 66.92], [35.86, 104.19]] as [number,number][], label: '铀/铬 → 中国', color: '#fbbf24' },
]

const CATEGORY_COLOR: Record<string, string> = {
  rare_earth: '#a78bfa',
  battery: '#34d399',
  strategic: '#60a5fa',
  pgm: '#fbbf24',
  industrial: '#94a3b8',
}

const ALERT_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  none: '#475569',
}

type Layer = 'influence' | 'alert' | 'risk' | 'trade' | 'mineral'

// ── Map controller for programmatic pan/zoom ───────────────────────────────────

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.8 })
  }, [center, zoom, map])
  return null
}

// ── News ticker ────────────────────────────────────────────────────────────────

function NewsTicker({ items }: { items: TickerItem[] }) {
  const text = items.map(i => i.text).join('   ·   ')
  if (!items.length) return (
    <div className="h-8 bg-stone-950 border-b border-stone-800 flex items-center px-4 text-xs text-stone-600">
      实时动态加载中...
    </div>
  )
  return (
    <div className="h-8 bg-stone-950 border-b border-stone-800 flex items-center overflow-hidden shrink-0">
      <div className="text-xs text-orange-400 font-semibold px-3 border-r border-stone-800 shrink-0 h-full flex items-center gap-1.5">
        <Activity className="w-3 h-3" />
        实时
      </div>
      <div className="flex-1 overflow-hidden">
        <div
          className="whitespace-nowrap text-xs text-stone-400 inline-flex gap-0"
          style={{ animation: 'ticker-scroll 60s linear infinite' }}
        >
          <span className="pr-16">{text}</span>
          <span className="pr-16">{text}</span>
        </div>
      </div>
    </div>
  )
}

// ── Layer panel ────────────────────────────────────────────────────────────────

const LAYERS: { id: Layer; label: string; desc: string; icon: typeof Globe }[] = [
  { id: 'influence', label: '全球影响力',   desc: '矿产关键度加权综合影响力',  icon: Globe },
  { id: 'alert',     label: '高度警报地区', desc: '近期触发价格预警的产地',     icon: AlertTriangle },
  { id: 'risk',      label: '风险监测地区', desc: '政策动态 / 高活跃度地区',   icon: Activity },
  { id: 'trade',     label: '贸易流动航线', desc: '主要关键矿产贸易运输路线',   icon: TrendingUp },
  { id: 'mineral',   label: '单矿产分布',   desc: '选择单一矿产查看产地分布',  icon: Layers },
]

function LayerPanel({
  active, onSelect,
  minerals, selectedMineral, onSelectMineral,
}: {
  active: Layer
  onSelect: (l: Layer) => void
  minerals: { id: number; name: string; name_zh: string | null }[]
  selectedMineral: number | null
  onSelectMineral: (id: number | null) => void
}) {
  return (
    <div className="w-52 shrink-0 bg-stone-900 border-r border-stone-800 flex flex-col overflow-y-auto">
      <div className="px-4 py-3 border-b border-stone-800">
        <div className="text-xs font-semibold text-stone-400 uppercase tracking-widest">图层选择</div>
      </div>
      <div className="flex-1 px-2 py-3 space-y-1">
        {LAYERS.map(l => {
          const Icon = l.icon
          const isActive = active === l.id
          return (
            <button
              key={l.id}
              onClick={() => onSelect(l.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-orange-600/20 border border-orange-600/40'
                  : 'border border-transparent hover:bg-stone-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-orange-400' : 'text-stone-500'}`} />
                <span className={`text-sm font-medium ${isActive ? 'text-orange-300' : 'text-stone-300'}`}>
                  {l.label}
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-0.5 pl-5.5">{l.desc}</p>
            </button>
          )
        })}

        {active === 'mineral' && (
          <div className="mt-2 space-y-1 max-h-64 overflow-y-auto pr-1">
            <div className="text-xs text-stone-600 px-3 pb-1">选择矿产：</div>
            {minerals.map(m => (
              <button
                key={m.id}
                onClick={() => onSelectMineral(selectedMineral === m.id ? null : m.id)}
                className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                  selectedMineral === m.id
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-600/30'
                    : 'text-stone-400 hover:text-white hover:bg-stone-800'
                }`}
              >
                {m.name_zh ?? m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-stone-800">
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">图例</div>
        {active === 'influence' && (
          <div className="space-y-1.5 text-xs text-stone-500">
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-orange-500 opacity-90 inline-block shrink-0" />高影响力</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500 opacity-60 inline-block shrink-0" />中等影响力</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500 opacity-40 inline-block shrink-0" />低影响力</div>
          </div>
        )}
        {(active === 'alert' || active === 'risk') && (
          <div className="space-y-1.5 text-xs text-stone-500">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block shrink-0" />高度警报</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block shrink-0" />风险升高</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block shrink-0" />持续监测</div>
          </div>
        )}
        {active === 'trade' && (
          <div className="space-y-1.5 text-xs text-stone-500">
            {[['#f97316','中国出口'], ['#a78bfa','澳洲-亚洲'], ['#34d399','南美供应'], ['#60a5fa','非洲-亚洲'], ['#fbbf24','贵金属']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-2">
                <span className="w-5 h-0.5 inline-block shrink-0" style={{ background: c }} />
                {l}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Country detail panel ───────────────────────────────────────────────────────

const CAT_ZH: Record<string, string> = {
  policy: '政策', industry: '行业', price: '价格', corporate: '企业', exploration: '勘探',
}
const CAT_COLOR: Record<string, string> = {
  policy: 'bg-purple-500/20 text-purple-400',
  industry: 'bg-orange-500/20 text-orange-400',
  price: 'bg-amber-500/20 text-amber-400',
  corporate: 'bg-emerald-500/20 text-emerald-400',
  exploration: 'bg-sky-500/20 text-sky-400',
}
const MINERAL_CAT_COLOR: Record<string, string> = {
  rare_earth: 'bg-purple-500/20 text-purple-300',
  battery: 'bg-emerald-500/20 text-emerald-300',
  strategic: 'bg-blue-500/20 text-blue-300',
  pgm: 'bg-yellow-500/20 text-yellow-300',
  industrial: 'bg-stone-600/30 text-stone-400',
}

function AlertBadge({ level }: { level: string }) {
  const cfg: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    none: 'bg-stone-700/30 text-stone-500 border-stone-700',
  }
  const labels: Record<string, string> = { critical: '高度警报', high: '风险升高', medium: '持续监测', none: '平稳' }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg[level] ?? cfg.none}`}>
      {labels[level] ?? level}
    </span>
  )
}

function CountryPanel({
  country, alertLevel, onClose,
}: {
  country: string
  alertLevel: string
  onClose: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['country', country],
    queryFn: () => api.getCountryDetail(country),
  })

  return (
    <div className="w-80 shrink-0 bg-stone-900 border-l border-stone-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-800 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-white text-base">{country}</h2>
          <AlertBadge level={alertLevel} />
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-stone-800 text-stone-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-stone-600 text-sm">加载中...</div>
      ) : !data ? null : (
        <div className="flex-1 overflow-y-auto">
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-px bg-stone-800 border-b border-stone-800">
            {[
              { label: '影响力', value: data.influence_score },
              { label: '矿产种数', value: data.minerals.length },
              { label: '近期资讯', value: data.recent_news.length + '+' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-stone-900 px-3 py-3 text-center">
                <div className="text-lg font-bold text-orange-300">{value}</div>
                <div className="text-xs text-stone-500">{label}</div>
              </div>
            ))}
          </div>

          {/* Minerals */}
          {data.minerals.length > 0 && (
            <section className="px-4 py-3 border-b border-stone-800">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">矿产资源</div>
              <div className="space-y-1.5">
                {data.minerals.map(m => {
                  const pct = m.latest_price?.price_change_pct
                  return (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${MINERAL_CAT_COLOR[m.category ?? ''] ?? 'bg-stone-700 text-stone-400'}`}>
                        {m.symbol ?? m.name.slice(0, 2)}
                      </span>
                      <span className="text-sm text-stone-200 flex-1 truncate">{m.name_zh ?? m.name}</span>
                      {m.criticality_score && (
                        <span className="text-xs text-stone-500">★{m.criticality_score}</span>
                      )}
                      {pct != null && (
                        <span className={`text-xs ${pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Recent news */}
          {data.recent_news.length > 0 && (
            <section className="px-4 py-3 border-b border-stone-800">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">
                <span className="flex items-center gap-1.5"><Newspaper className="w-3 h-3" />近期事件</span>
              </div>
              <ul className="space-y-2.5">
                {data.recent_news.slice(0, 5).map(n => (
                  <li key={n.id} className="text-xs">
                    <div className="flex items-start gap-1.5">
                      {n.category && (
                        <span className={`badge mt-0.5 shrink-0 ${CAT_COLOR[n.category] ?? 'bg-stone-700 text-stone-400'}`}>
                          {CAT_ZH[n.category] ?? n.category}
                        </span>
                      )}
                      <div>
                        {n.url ? (
                          <a href={n.url} target="_blank" rel="noopener noreferrer"
                            className="text-stone-300 hover:text-orange-300 line-clamp-2 transition-colors">
                            {n.title}
                          </a>
                        ) : (
                          <p className="text-stone-300 line-clamp-2">{n.title}</p>
                        )}
                        <p className="text-stone-600 mt-0.5">{n.source}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Related countries (supply chain) */}
          {data.related_countries.length > 0 && (
            <section className="px-4 py-3 border-b border-stone-800">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">
                产业链关联国家
              </div>
              <div className="space-y-1.5">
                {data.related_countries.slice(0, 6).map(r => (
                  <div key={r.country} className="flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-stone-600 shrink-0" />
                    <span className="text-sm text-stone-300 flex-1">{r.country}</span>
                    <span className="text-xs text-stone-600 truncate max-w-[100px]">
                      {r.shared_minerals.slice(0, 2).join('·')}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Companies */}
          {data.companies.length > 0 && (
            <section className="px-4 py-3">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">
                <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" />关联企业</span>
              </div>
              <div className="space-y-2">
                {data.companies.slice(0, 5).map(co => {
                  const pct = co.latest_snapshot?.price_change_pct
                  return (
                    <div key={co.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-stone-200 truncate">{co.name_zh ?? co.name}</div>
                        <div className="text-xs text-stone-600">{co.ticker} · {co.exchange}</div>
                      </div>
                      {pct != null && (
                        <span className={`text-xs font-medium ${pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Home() {
  const [activeLayer, setActiveLayer] = useState<Layer>('influence')
  const [selectedMineral, setSelectedMineral] = useState<number | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedCountryAlert, setSelectedCountryAlert] = useState<string>('none')
  const [continent, setContinent] = useState(CONTINENTS[0])

  const { data: producers = [] } = useQuery({
    queryKey: ['map'],
    queryFn: api.getProducerMap,
    refetchInterval: 5 * 60_000,
  })
  const { data: ticker = [] } = useQuery({
    queryKey: ['map-ticker'],
    queryFn: api.getMapTicker,
    refetchInterval: 60_000,
  })
  const { data: minerals = [] } = useQuery({
    queryKey: ['minerals'],
    queryFn: () => api.getMinerals(),
  })

  const handleCountryClick = (country: ProducerCountry) => {
    setSelectedCountry(country.country)
    setSelectedCountryAlert(country.alert_level ?? 'none')
  }

  // Filter + style producers based on active layer
  const visibleProducers = (() => {
    if (activeLayer === 'alert') return producers.filter(p => p.alert_level === 'critical' || p.alert_level === 'high')
    if (activeLayer === 'risk') return producers.filter(p => p.alert_level !== 'none')
    if (activeLayer === 'mineral' && selectedMineral !== null)
      return producers.filter(p => p.minerals.some(m => m.id === selectedMineral))
    return producers
  })()

  const getCircleProps = (p: ProducerCountry) => {
    if (activeLayer === 'influence') {
      const score = p.influence_score ?? 0
      const radius = 5 + Math.sqrt(score) * 2.5
      const opacity = 0.35 + (score / 100) * 0.55
      return { radius, color: '#f97316', fillColor: '#f97316', fillOpacity: opacity, weight: 1 }
    }
    if (activeLayer === 'alert' || activeLayer === 'risk') {
      const color = ALERT_COLOR[p.alert_level ?? 'none']
      return { radius: 10, color, fillColor: color, fillOpacity: 0.55, weight: 1.5 }
    }
    if (activeLayer === 'mineral') {
      const mineral = p.minerals.find(m => m.id === selectedMineral)
      const color = CATEGORY_COLOR[mineral?.category ?? ''] ?? '#60a5fa'
      return { radius: 10, color, fillColor: color, fillOpacity: 0.6, weight: 1.5 }
    }
    return { radius: 8, color: '#64748b', fillColor: '#64748b', fillOpacity: 0.4, weight: 1 }
  }

  return (
    <div
      className="-mx-6 -mt-6 -mb-6 flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 56px)' }}
    >
      {/* Ticker */}
      <NewsTicker items={ticker} />

      {/* Body: layer panel + map + country panel */}
      <div className="flex flex-1 overflow-hidden">
        <LayerPanel
          active={activeLayer}
          onSelect={l => { setActiveLayer(l); if (l !== 'mineral') setSelectedMineral(null) }}
          minerals={minerals.map(m => ({ id: m.id, name: m.name, name_zh: m.name_zh }))}
          selectedMineral={selectedMineral}
          onSelectMineral={setSelectedMineral}
        />

        {/* Map area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Continent switcher */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex gap-1 bg-stone-900/90 backdrop-blur border border-stone-700 rounded-lg p-1">
            {CONTINENTS.map(c => (
              <button
                key={c.label}
                onClick={() => setContinent(c)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  continent.label === c.label
                    ? 'bg-orange-600 text-white'
                    : 'text-stone-400 hover:text-white hover:bg-stone-700'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <MapContainer
            center={continent.center}
            zoom={continent.zoom}
            style={{ height: '100%', width: '100%', background: '#0c0a09' }}
            zoomControl={false}
          >
            <MapController center={continent.center} zoom={continent.zoom} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            />

            {/* Trade flow routes */}
            {(activeLayer === 'trade') && TRADE_FLOWS.map((flow, i) => (
              <Polyline
                key={i}
                positions={flow.path}
                pathOptions={{ color: flow.color, weight: 2, opacity: 0.65, dashArray: '6 4' }}
              >
                <Popup>
                  <span style={{ fontSize: 12 }}>{flow.label}</span>
                </Popup>
              </Polyline>
            ))}

            {/* Country markers */}
            {activeLayer !== 'trade' && visibleProducers.map(p => {
              const props = getCircleProps(p)
              const isSelected = selectedCountry === p.country
              return (
                <CircleMarker
                  key={p.country}
                  center={[p.lat, p.lng]}
                  radius={props.radius + (isSelected ? 3 : 0)}
                  pathOptions={{
                    ...props,
                    weight: isSelected ? 2.5 : props.weight,
                    color: isSelected ? '#ffffff' : props.color,
                  }}
                  eventHandlers={{ click: () => handleCountryClick(p) }}
                >
                  <Popup>
                    <div style={{ minWidth: 140, fontFamily: 'sans-serif', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.country}</div>
                      <div style={{ color: '#78716c', marginBottom: 2 }}>
                        {p.mineral_count} 种矿产 · 影响力 {p.influence_score}
                      </div>
                      <button
                        onClick={() => handleCountryClick(p)}
                        style={{ color: '#f97316', fontSize: 11, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                      >
                        查看详情 →
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>

          {/* Bottom layer info strip */}
          {activeLayer === 'trade' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-stone-900/90 backdrop-blur border border-stone-700 rounded-lg px-4 py-2 text-xs text-stone-400">
              显示 {TRADE_FLOWS.length} 条主要关键矿产贸易航线 · 点击路线查看详情
            </div>
          )}
          {activeLayer === 'influence' && (
            <div className="absolute bottom-4 right-4 z-[1000] bg-stone-900/90 backdrop-blur border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-400">
              圆点大小 = 综合影响力 · 共 {producers.length} 个产地
            </div>
          )}
        </div>

        {/* Country detail side panel */}
        {selectedCountry && (
          <CountryPanel
            country={selectedCountry}
            alertLevel={selectedCountryAlert}
            onClose={() => setSelectedCountry(null)}
          />
        )}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0) }
          to   { transform: translateX(-50%) }
        }
      `}</style>
    </div>
  )
}
