import type { Report, Trade } from './types';

export const MOCK_REPORT: Report = {
  id: 'mock-2026-03-29',
  report_date: '2026-03-29',
  market_summary:
    'European FAME0 markets firmed modestly today, supported by a recovery in soybean oil and tightening UCO availability out of Asia. HVO premiums held steady as refiners maintain cautious output amid uncertain feedstock margins. Sentiment is cautiously bullish ahead of Q2 mandate season.',
  key_news: [
    {
      headline: 'EU Commission proposes increased SAF blending mandate for 2026',
      source: 'Biofuels Digest',
      url: 'https://biofuelsdigest.com',
      price_impact:
        'Bullish for SAF and HVO demand, likely to support HEFA feedstock premiums',
      relevance: 'high',
    },
    {
      headline: 'UCO exports from China tighten as domestic collection declines',
      source: 'Reuters',
      url: 'https://reuters.com',
      price_impact:
        'Upward pressure on UCO prices in Europe, supporting FAME and HVO feedstock costs',
      relevance: 'high',
    },
    {
      headline: 'US soybean crop estimate revised upward by USDA',
      source: 'USDA',
      url: 'https://usda.gov',
      price_impact: 'Modest bearish pressure on soy oil and SME feedstock costs',
      relevance: 'medium',
    },
  ],
  macro_signals: [
    {
      name: 'Soybean Oil',
      direction: 'up',
      change_pct: 1.2,
      biofuels_implication: 'Upward pressure on FAME0 and SME feedstock costs',
    },
    {
      name: 'WTI Crude',
      direction: 'up',
      change_pct: 0.8,
      biofuels_implication:
        'Supportive for biofuel blending economics vs fossil diesel',
    },
    {
      name: 'EUR/USD',
      direction: 'down',
      change_pct: -0.3,
      biofuels_implication: 'Neutral — within normal trading range',
    },
    {
      name: 'Natural Gas',
      direction: 'flat',
      change_pct: 0.1,
      biofuels_implication: 'Neutral — within normal trading range',
    },
  ],
  short_term_outlook: {
    horizon: '1-5 days',
    summary:
      'FAME0 expected to hold firm near current levels. UCO tightness likely to persist. Watch Friday USDA weekly export data for soy direction.',
    key_risks: [
      'Sudden crude selloff compressing blending economics',
      'Surprise UCO supply from new Asian exporters',
    ],
    bias: 'bullish',
  },
  long_term_outlook: {
    horizon: '1-3 months',
    summary:
      'Q2 mandate season demand expected to support prices. RED III implementation uncertainty remains a wildcard. SAF ramp-up absorbing HVO capacity.',
    key_themes: [
      'Q2 seasonal demand pickup',
      'RED III GHG threshold implementation',
      'SAF capacity absorbing HVO supply',
    ],
    bias: 'neutral',
  },
  saf_note:
    'No publicly available SAF spot prices. EU mandate discussions ongoing — watch for ReFuelEU Aviation updates. HEFA pathway feedstock premiums remain elevated.',
  broker_notes: '',
  generated_at: '2026-03-29T07:00:00Z',
  version: '1.0',
};

export const MOCK_TRADES: Trade[] = [
  {
    id: 'trade-001',
    trade_date: '2026-03-28',
    broker_name: 'Sunco Brokers',
    commodity: 'FAME0',
    direction: 'Buy',
    volume_mt: 5000,
    price_eur_mt: 1250,
    counterparty: 'EuroEnergy GmbH',
    delivery_month: '2026-04',
    delivery_location: 'ARA',
    brokerage_fee_usd_mt: 2.5,
    notes: 'Q2 mandate season purchase',
    created_at: '2026-03-28T10:30:00Z',
  },
  {
    id: 'trade-002',
    trade_date: '2026-03-27',
    broker_name: 'Sunco Brokers',
    commodity: 'HVO',
    direction: 'Sell',
    volume_mt: 2000,
    price_eur_mt: 1820,
    counterparty: 'Nordic Fuel AS',
    delivery_month: '2026-05',
    delivery_location: 'Rotterdam',
    brokerage_fee_usd_mt: 3.0,
    notes: 'Forward sale, premium grade',
    created_at: '2026-03-27T14:15:00Z',
  },
  {
    id: 'trade-003',
    trade_date: '2026-03-26',
    broker_name: 'Sunco Brokers',
    commodity: 'RME',
    direction: 'Buy',
    volume_mt: 1000,
    price_eur_mt: 1380,
    counterparty: 'Agri Commodities SA',
    delivery_month: '2026-04',
    delivery_location: 'Hamburg',
    brokerage_fee_usd_mt: 2.0,
    notes: 'Spot purchase for blending',
    created_at: '2026-03-26T09:45:00Z',
  },
];
