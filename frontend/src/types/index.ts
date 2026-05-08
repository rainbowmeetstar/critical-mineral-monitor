export interface MineralPrice {
  id: number
  mineral_id: number
  price: number
  price_change_pct: number | null
  unit: string | null
  source: string | null
  timestamp: string
}

export interface Mineral {
  id: number
  name: string
  name_zh: string | null
  symbol: string | null
  category: string | null
  subcategory: string | null
  atomic_number: number | null
  key_uses: string[] | null
  top_producers: string[] | null
  price_unit: string | null
  criticality_score: number | null
  latest_price: MineralPrice | null
}

export interface MineralDetail extends Mineral {
  description: string | null
  description_zh: string | null
  yahoo_symbol: string | null
}

export interface PriceHistory {
  mineral_id: number
  mineral_name: string
  symbol: string | null
  unit: string | null
  prices: MineralPrice[]
}

export interface NewsArticle {
  id: number
  title: string
  url: string | null
  source: string | null
  category: string | null
  level: string | null
  country: string | null
  published_at: string | null
  summary: string | null
  minerals_mentioned: string[] | null
  created_at: string
}

export interface DashboardStats {
  minerals_tracked: number
  news_articles: number
  price_records: number
  minerals_with_price_data: number
  news_by_category: Record<string, number>
  recent_news: Array<{
    id: number
    title: string
    source: string
    category: string
    published_at: string | null
  }>
}

export type MineralCategory = 'rare_earth' | 'battery' | 'strategic' | 'pgm' | 'industrial'
export type NewsCategory = 'policy' | 'industry' | 'price' | 'corporate' | 'exploration'
export type NewsLevel = 'government' | 'industry_assoc' | 'corporate'
