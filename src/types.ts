export interface MacroSignal {
  name: string;
  direction: 'up' | 'down' | 'flat';
  change_pct: number;
  biofuels_implication: string;
}

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  price_impact: string;
  relevance: 'high' | 'medium' | 'low';
}

export interface Outlook {
  horizon: string;
  summary: string;
  key_risks?: string[];
  key_themes?: string[];
  bias: 'bullish' | 'bearish' | 'neutral';
}

export interface Report {
  id: string;
  report_date: string;
  market_summary: string;
  key_news: NewsItem[];
  macro_signals: MacroSignal[];
  short_term_outlook: Outlook;
  long_term_outlook: Outlook;
  saf_note: string;
  broker_notes: string;
  generated_at: string;
  version: string;
}

export interface Trade {
  id: string;
  trade_date: string;
  broker_name: string;
  commodity: string;
  direction: 'Buy' | 'Sell';
  volume_mt: number;
  price_eur_mt: number;
  counterparty: string;
  delivery_month: string;
  delivery_location: string;
  brokerage_fee_usd_mt: number;
  notes: string;
  created_at: string;
}

export interface Position {
  commodity: string;
  delivery_month: string;
  net_volume_mt: number;
  avg_price_eur_mt: number;
  trade_count: number;
  direction: 'long' | 'short' | 'flat';
}

export interface PnLItem {
  commodity: string;
  delivery_month: string;
  net_volume_mt: number;
  avg_price_eur_mt: number;
  current_price_eur_mt: number | null;
  direction: string;
  unrealised_pnl_eur: number | null;
}

export interface PnLResult {
  pnl_breakdown: PnLItem[];
  total_unrealised_pnl_eur: number;
  total_brokerage_usd: number;
  current_prices_used: Record<string, number>;
  positions_with_no_price: string[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  message: string;
}
