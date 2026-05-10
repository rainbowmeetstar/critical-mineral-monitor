import { Mineral, MineralDetail, PriceHistory, NewsArticle, DashboardStats, ProducerCountry, PriceAlertOut, AlertTriggerOut, CompanyOut, ForecastOut, TickerItem, CountryDetail } from '../types'

const BASE = (import.meta.env.VITE_API_BASE ?? '') + '/api/v1'

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v))
      }
    })
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`)
  return res.json()
}

async function post(path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export const api = {
  getMinerals: (category?: string) =>
    get<Mineral[]>('/minerals', { category }),

  getMineral: (id: number) =>
    get<MineralDetail>(`/minerals/${id}`),

  getPriceHistory: (id: number, days = 30) =>
    get<PriceHistory>(`/minerals/${id}/prices`, { days }),

  getForecast: (id: number) =>
    get<ForecastOut>(`/minerals/${id}/forecast`),

  getNews: (params?: {
    category?: string
    level?: string
    mineral?: string
    country?: string
    page?: number
    limit?: number
  }) => get<NewsArticle[]>('/news', params as Record<string, string | number | undefined>),

  getStats: () =>
    get<DashboardStats>('/stats'),

  triggerCrawlAll: () => post('/crawl/all'),
  triggerCrawlPrices: () => post('/crawl/prices'),
  triggerCrawlNews: () => post('/crawl/news'),

  getProducerMap: () => get<ProducerCountry[]>('/map'),
  getMapTicker: () => get<TickerItem[]>('/map/ticker'),
  getCountryDetail: (country: string) => get<CountryDetail>(`/map/country/${encodeURIComponent(country)}`),
  getCompanies: (mineral?: string) => get<CompanyOut[]>('/companies', { mineral }),

  getAlerts: () => get<PriceAlertOut[]>('/alerts'),
  createAlert: (body: { mineral_id: number; direction: string; threshold: number; note?: string }) =>
    post('/alerts', body) as Promise<PriceAlertOut>,
  deleteAlert: (id: number) => fetch(`${BASE}/alerts/${id}`, { method: 'DELETE' }),
  getAlertTriggers: () => get<AlertTriggerOut[]>('/alerts/triggers'),

  exportMinerals: () => `${BASE}/export/minerals`,
  exportPrices: (days = 30, mineralId?: number) => {
    const p = new URLSearchParams({ days: String(days) })
    if (mineralId) p.set('mineral_id', String(mineralId))
    return `${BASE}/export/prices?${p}`
  },
  exportNews: (days = 30, category?: string) => {
    const p = new URLSearchParams({ days: String(days) })
    if (category) p.set('category', category)
    return `${BASE}/export/news?${p}`
  },

  briefingGlobal: (audience: 'enterprise' | 'government') =>
    `${BASE}/briefing/global?audience=${audience}`,
  briefingMineral: (mineralId: number, audience: 'enterprise' | 'government') =>
    `${BASE}/briefing/mineral/${mineralId}?audience=${audience}`,
}
