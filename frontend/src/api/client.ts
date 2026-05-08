import { Mineral, MineralDetail, PriceHistory, NewsArticle, DashboardStats, ProducerCountry } from '../types'

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

async function post(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST' })
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
}
