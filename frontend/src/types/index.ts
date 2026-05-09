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

export interface CompanySnapshot {
  stock_price: number | null
  price_change_pct: number | null
  market_cap_usd_bn: number | null
  timestamp: string
}

export interface CompanyOut {
  id: number
  name: string
  name_zh: string | null
  ticker: string | null
  exchange: string | null
  country: string | null
  minerals_focus: string[]
  description: string | null
  description_zh: string | null
  website: string | null
  latest_snapshot: CompanySnapshot | null
}

export interface ProducerMineralItem {
  id: number
  name: string
  name_zh: string | null
  symbol: string | null
  category: string
  criticality_score: number | null
}

export interface ProducerCountry {
  country: string
  lat: number
  lng: number
  mineral_count: number
  minerals: ProducerMineralItem[]
}

export interface PriceAlertOut {
  id: number
  mineral_id: number
  mineral_name: string
  mineral_name_zh: string | null
  direction: 'above' | 'below'
  threshold: number
  note: string | null
  active: boolean
  created_at: string
  last_triggered_at: string | null
  trigger_count: number
}

export interface AlertTriggerOut {
  id: number
  alert_id: number
  mineral_name: string
  direction: 'above' | 'below'
  threshold: number
  price_at_trigger: number
  triggered_at: string
}

export interface SignalItem {
  label: string
  value: string
  score: number
  direction: 'bull' | 'bear' | 'neutral'
}

export interface ForecastOut {
  mineral_id: number
  mineral_name: string
  data_points: number
  latest_price: number | null
  ma7: number | null
  ma30: number | null
  ma90: number | null
  rsi14: number | null
  momentum_7d_pct: number | null
  momentum_30d_pct: number | null
  volatility_30d_pct: number | null
  slope_pct_per_day: number | null
  forecast_7d_low: number | null
  forecast_7d_mid: number | null
  forecast_7d_high: number | null
  news_7d_total: number
  news_30d_policy: number
  news_30d_price: number
  news_30d_exploration: number
  composite_score: number
  outlook: '看涨' | '温和看涨' | '中性' | '温和看跌' | '看跌' | '数据不足'
  signal_breakdown: SignalItem[]
  outlook_text: string
}

export type MineralCategory = 'rare_earth' | 'battery' | 'strategic' | 'pgm' | 'industrial'
export type NewsCategory = 'policy' | 'industry' | 'price' | 'corporate' | 'exploration'
export type NewsLevel = 'government' | 'industry_assoc' | 'corporate'
