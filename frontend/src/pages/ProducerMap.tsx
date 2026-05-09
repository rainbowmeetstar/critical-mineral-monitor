import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

const CATEGORY_COLOR: Record<string, string> = {
  rare_earth: '#a78bfa',
  battery:    '#34d399',
  strategic:  '#60a5fa',
  pgm:        '#fbbf24',
}

const CATEGORY_LABEL: Record<string, string> = {
  rare_earth: '稀土',
  battery:    '电池金属',
  strategic:  '战略矿产',
  pgm:        '铂族金属',
}

function dominantCategory(minerals: { category: string }[]): string {
  const counts: Record<string, number> = {}
  for (const m of minerals) counts[m.category] = (counts[m.category] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'strategic'
}

export default function ProducerMap() {
  const { data: producers = [], isLoading } = useQuery({
    queryKey: ['map'],
    queryFn: api.getProducerMap,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">全球关键矿产分布</h1>
        <div className="flex gap-3 text-xs text-stone-400">
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: CATEGORY_COLOR[k] }}
              />
              {v}
            </span>
          ))}
        </div>
      </div>

      <div
        className="rounded-xl overflow-hidden border border-stone-800"
        style={{ height: 'calc(100vh - 11rem)' }}
      >
        {isLoading ? (
          <div className="h-full flex items-center justify-center bg-stone-900 text-stone-500">
            加载地图数据...
          </div>
        ) : (
          <MapContainer
            center={[20, 10]}
            zoom={2}
            minZoom={2}
            maxZoom={8}
            scrollWheelZoom
            style={{ height: '100%', width: '100%', background: '#0c0a09' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {producers.map(p => {
              const cat = dominantCategory(p.minerals)
              const color = CATEGORY_COLOR[cat] ?? '#60a5fa'
              const radius = 4 + Math.sqrt(p.mineral_count) * 5
              return (
                <CircleMarker
                  key={p.country}
                  center={[p.lat, p.lng]}
                  radius={radius}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.55,
                    weight: 1.5,
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 160, fontFamily: 'sans-serif' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                        {p.country}
                        <span style={{ fontWeight: 400, color: '#a8a29e', fontSize: 12, marginLeft: 6 }}>
                          {p.mineral_count} 种矿产
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {p.minerals
                          .slice()
                          .sort((a, b) => (b.criticality_score ?? 0) - (a.criticality_score ?? 0))
                          .map(m => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: CATEGORY_COLOR[m.category] ?? '#60a5fa',
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#a8a29e', width: 24 }}>
                                {m.symbol}
                              </span>
                              <span style={{ fontSize: 12 }}>
                                {m.name_zh ?? m.name}
                              </span>
                              {m.criticality_score === 10 && (
                                <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 'auto' }}>★</span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        )}
      </div>
    </div>
  )
}
