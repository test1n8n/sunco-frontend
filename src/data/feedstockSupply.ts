/**
 * Curated biofuel feedstock production shares and trade flows.
 *
 * Sources:
 *   - USDA FAS PSD (oilseeds, palm, soy, rapeseed, sunflower)
 *   - MPOB (Malaysian palm oil specifics)
 *   - Transport & Environment reports (UCO supply chains, EU imports)
 *   - EIA (US biofuel feedstock inputs)
 *   - UFOP / ePURE / UNICA (EU/Brazil ethanol/biodiesel)
 *   - IEA Renewables (HVO/SAF capacity)
 *   - Company reports (Neste, DGD, World Energy for HVO/SAF)
 *   - UN Comtrade (bilateral trade for HS-coded commodities)
 *
 * Reference year: 2024 (most recent full-year data available).
 * Numbers are industry-consensus estimates, not audited.
 * Update annually or when major supply shifts happen.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type Region = 'americas' | 'europe' | 'asia_pacific' | 'africa' | 'middle_east';
export type FeedstockCategory = 'conventional' | 'advanced' | 'saf' | 'finished';

export interface CountryShare {
  country: string;       // ISO alpha-2
  countryName: string;
  region: Region;
  share_pct: number;
  production_kt: number; // thousand tonnes/year
}

export interface Feedstock {
  code: string;
  name: string;
  category: FeedstockCategory;
  description: string;
  totalProduction_kt: number;
  unit: string;
  year: number;
  source: string;
  countries: CountryShare[];
}

export interface TradeFlow {
  feedstock: string;     // matches Feedstock.code
  category: FeedstockCategory;
  exporter: string;      // ISO alpha-2
  exporterName: string;
  importer: string;      // ISO alpha-2
  importerName: string;
  volume_kt: number;
  pct_of_global_trade: number;
  year: number;
  notes?: string;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

export const REGION_COLORS: Record<Region, string> = {
  americas:     '#3b82f6', // blue
  europe:       '#f59e0b', // amber
  asia_pacific: '#10b981', // emerald
  africa:       '#ef4444', // red
  middle_east:  '#8b5cf6', // violet
};

export const REGION_LABELS: Record<Region, string> = {
  americas:     'Americas',
  europe:       'Europe',
  asia_pacific: 'Asia-Pacific',
  africa:       'Africa',
  middle_east:  'Middle East',
};

export const CATEGORY_LABELS: Record<FeedstockCategory, string> = {
  conventional: 'Conventional Biodiesel',
  advanced:     'Advanced Biofuels',
  saf:          'SAF Feedstocks',
  finished:     'Finished Products',
};

// ─── Production shares ──────────────────────────────────────────────────────

export const FEEDSTOCKS: Feedstock[] = [
  // ═══ CONVENTIONAL BIODIESEL ═══════════════════════════════════════════════
  {
    code: 'PALM_OIL',
    name: 'Palm Oil',
    category: 'conventional',
    description: 'Largest global vegetable oil by volume. Primary FAME feedstock in SE Asia. Facing RED III phase-out in EU due to deforestation concerns.',
    totalProduction_kt: 78000,
    unit: 'kt',
    year: 2024,
    source: 'USDA FAS / MPOB',
    countries: [
      { country: 'ID', countryName: 'Indonesia',   region: 'asia_pacific', share_pct: 58.0, production_kt: 45200 },
      { country: 'MY', countryName: 'Malaysia',     region: 'asia_pacific', share_pct: 25.0, production_kt: 19500 },
      { country: 'TH', countryName: 'Thailand',     region: 'asia_pacific', share_pct: 3.8,  production_kt: 2950 },
      { country: 'CO', countryName: 'Colombia',     region: 'americas',     share_pct: 2.3,  production_kt: 1800 },
      { country: 'NG', countryName: 'Nigeria',      region: 'africa',       share_pct: 1.8,  production_kt: 1400 },
      { country: 'GT', countryName: 'Guatemala',    region: 'americas',     share_pct: 1.0,  production_kt: 780 },
      { country: 'HN', countryName: 'Honduras',     region: 'americas',     share_pct: 0.8,  production_kt: 620 },
    ],
  },
  {
    code: 'SOYBEAN_OIL',
    name: 'Soybean Oil',
    category: 'conventional',
    description: 'Second-largest vegetable oil. US and Brazilian soy crush drives supply. Key feedstock for US biodiesel and renewable diesel.',
    totalProduction_kt: 62000,
    unit: 'kt',
    year: 2024,
    source: 'USDA FAS',
    countries: [
      { country: 'CN', countryName: 'China',        region: 'asia_pacific', share_pct: 27.0, production_kt: 16740 },
      { country: 'US', countryName: 'United States', region: 'americas',     share_pct: 18.5, production_kt: 11470 },
      { country: 'BR', countryName: 'Brazil',        region: 'americas',     share_pct: 17.0, production_kt: 10540 },
      { country: 'AR', countryName: 'Argentina',     region: 'americas',     share_pct: 13.0, production_kt: 8060 },
      { country: 'IN', countryName: 'India',         region: 'asia_pacific', share_pct: 4.5,  production_kt: 2790 },
      { country: 'EU', countryName: 'EU-27',         region: 'europe',       share_pct: 4.0,  production_kt: 2480 },
    ],
  },
  {
    code: 'RAPESEED_OIL',
    name: 'Rapeseed / Canola Oil',
    category: 'conventional',
    description: 'Dominant biodiesel feedstock in Europe (RME). EU is the largest crusher; Canada is the largest seed exporter.',
    totalProduction_kt: 28500,
    unit: 'kt',
    year: 2024,
    source: 'USDA FAS / UFOP',
    countries: [
      { country: 'EU', countryName: 'EU-27',         region: 'europe',       share_pct: 34.0, production_kt: 9690 },
      { country: 'CN', countryName: 'China',          region: 'asia_pacific', share_pct: 20.0, production_kt: 5700 },
      { country: 'CA', countryName: 'Canada',         region: 'americas',     share_pct: 14.0, production_kt: 3990 },
      { country: 'IN', countryName: 'India',          region: 'asia_pacific', share_pct: 10.0, production_kt: 2850 },
      { country: 'JP', countryName: 'Japan',          region: 'asia_pacific', share_pct: 3.5,  production_kt: 1000 },
      { country: 'AU', countryName: 'Australia',      region: 'asia_pacific', share_pct: 3.0,  production_kt: 855 },
      { country: 'UA', countryName: 'Ukraine',        region: 'europe',       share_pct: 3.0,  production_kt: 855 },
    ],
  },
  {
    code: 'SUNFLOWER_OIL',
    name: 'Sunflower Oil',
    category: 'conventional',
    description: 'Used for biodiesel in some EU markets. Supply heavily disrupted by Ukraine conflict since 2022.',
    totalProduction_kt: 21000,
    unit: 'kt',
    year: 2024,
    source: 'USDA FAS',
    countries: [
      { country: 'UA', countryName: 'Ukraine',       region: 'europe',       share_pct: 28.0, production_kt: 5880 },
      { country: 'RU', countryName: 'Russia',        region: 'europe',       share_pct: 27.0, production_kt: 5670 },
      { country: 'EU', countryName: 'EU-27',         region: 'europe',       share_pct: 15.0, production_kt: 3150 },
      { country: 'AR', countryName: 'Argentina',     region: 'americas',     share_pct: 7.0,  production_kt: 1470 },
      { country: 'TR', countryName: 'Turkey',        region: 'europe',       share_pct: 5.0,  production_kt: 1050 },
    ],
  },
  {
    code: 'TALLOW',
    name: 'Tallow / Animal Fats',
    category: 'conventional',
    description: 'By-product of meat processing. Growing demand for HVO/renewable diesel feedstock. Increasingly competing with oleochemical uses.',
    totalProduction_kt: 10500,
    unit: 'kt',
    year: 2024,
    source: 'USDA / National Renderers Association',
    countries: [
      { country: 'US', countryName: 'United States', region: 'americas',     share_pct: 32.0, production_kt: 3360 },
      { country: 'BR', countryName: 'Brazil',        region: 'americas',     share_pct: 14.0, production_kt: 1470 },
      { country: 'AU', countryName: 'Australia',     region: 'asia_pacific', share_pct: 10.0, production_kt: 1050 },
      { country: 'EU', countryName: 'EU-27',         region: 'europe',       share_pct: 18.0, production_kt: 1890 },
      { country: 'AR', countryName: 'Argentina',     region: 'americas',     share_pct: 5.0,  production_kt: 525 },
      { country: 'NZ', countryName: 'New Zealand',   region: 'asia_pacific', share_pct: 3.0,  production_kt: 315 },
    ],
  },

  // ═══ ADVANCED BIOFUEL FEEDSTOCKS ══════════════════════════════════════════
  {
    code: 'UCO',
    name: 'Used Cooking Oil (UCO)',
    category: 'advanced',
    description: 'Annex IX Part B — double-counting eligible under RED II/III. China dominates global UCO collection and export. Fraud/traceability concerns in China-EU trade are a major regulatory flashpoint.',
    totalProduction_kt: 6500,
    unit: 'kt',
    year: 2024,
    source: 'Transport & Environment / Greenea / EWABA',
    countries: [
      { country: 'CN', countryName: 'China',          region: 'asia_pacific', share_pct: 45.0, production_kt: 2925 },
      { country: 'EU', countryName: 'EU-27',          region: 'europe',       share_pct: 18.0, production_kt: 1170 },
      { country: 'US', countryName: 'United States',   region: 'americas',     share_pct: 12.0, production_kt: 780 },
      { country: 'MY', countryName: 'Malaysia',        region: 'asia_pacific', share_pct: 5.0,  production_kt: 325 },
      { country: 'ID', countryName: 'Indonesia',       region: 'asia_pacific', share_pct: 4.0,  production_kt: 260 },
      { country: 'UK', countryName: 'United Kingdom',  region: 'europe',       share_pct: 3.5,  production_kt: 228 },
      { country: 'JP', countryName: 'Japan',           region: 'asia_pacific', share_pct: 3.0,  production_kt: 195 },
      { country: 'IN', countryName: 'India',           region: 'asia_pacific', share_pct: 2.5,  production_kt: 163 },
    ],
  },
  {
    code: 'TALL_OIL',
    name: 'Crude Tall Oil (CTO)',
    category: 'advanced',
    description: 'Annex IX Part A — by-product of kraft pulp mills. Supply constrained by pulp production. Key feedstock for Nordic HVO (Neste, UPM, Preem).',
    totalProduction_kt: 2200,
    unit: 'kt',
    year: 2024,
    source: 'UPM / industry estimates',
    countries: [
      { country: 'US', countryName: 'United States', region: 'americas',     share_pct: 30.0, production_kt: 660 },
      { country: 'SE', countryName: 'Sweden',        region: 'europe',       share_pct: 16.0, production_kt: 352 },
      { country: 'FI', countryName: 'Finland',       region: 'europe',       share_pct: 14.0, production_kt: 308 },
      { country: 'CA', countryName: 'Canada',        region: 'americas',     share_pct: 12.0, production_kt: 264 },
      { country: 'BR', countryName: 'Brazil',        region: 'americas',     share_pct: 8.0,  production_kt: 176 },
      { country: 'RU', countryName: 'Russia',        region: 'europe',       share_pct: 7.0,  production_kt: 154 },
    ],
  },
  {
    code: 'PFAD',
    name: 'Palm Fatty Acid Distillate (PFAD)',
    category: 'advanced',
    description: 'By-product of palm oil refining. Annex IX Part B eligible. Supply concentrated where palm is refined (mostly SE Asia).',
    totalProduction_kt: 4800,
    unit: 'kt',
    year: 2024,
    source: 'MPOB / industry estimates',
    countries: [
      { country: 'ID', countryName: 'Indonesia',  region: 'asia_pacific', share_pct: 52.0, production_kt: 2500 },
      { country: 'MY', countryName: 'Malaysia',    region: 'asia_pacific', share_pct: 35.0, production_kt: 1680 },
      { country: 'TH', countryName: 'Thailand',    region: 'asia_pacific', share_pct: 5.0,  production_kt: 240 },
      { country: 'IN', countryName: 'India',       region: 'asia_pacific', share_pct: 4.0,  production_kt: 192 },
    ],
  },
  {
    code: 'CORN_OIL',
    name: 'Distillers Corn Oil (DCO)',
    category: 'advanced',
    description: 'Extracted from ethanol distillers grains. Supply grows with US ethanol production. Used for biodiesel and renewable diesel.',
    totalProduction_kt: 3200,
    unit: 'kt',
    year: 2024,
    source: 'EIA / US Grains Council',
    countries: [
      { country: 'US', countryName: 'United States', region: 'americas',     share_pct: 88.0, production_kt: 2816 },
      { country: 'CA', countryName: 'Canada',        region: 'americas',     share_pct: 5.0,  production_kt: 160 },
      { country: 'EU', countryName: 'EU-27',         region: 'europe',       share_pct: 3.0,  production_kt: 96 },
    ],
  },

  // ═══ SAF-SPECIFIC ═════════════════════════════════════════════════════════
  {
    code: 'ETHANOL',
    name: 'Fuel Ethanol',
    category: 'saf',
    description: 'Feedstock for Alcohol-to-Jet (AtJ) SAF pathway. US corn ethanol and Brazilian sugarcane ethanol are the two dominant sources.',
    totalProduction_kt: 83000,
    unit: 'kt',
    year: 2024,
    source: 'EIA / UNICA / ePURE',
    countries: [
      { country: 'US', countryName: 'United States', region: 'americas',     share_pct: 54.0, production_kt: 44820 },
      { country: 'BR', countryName: 'Brazil',        region: 'americas',     share_pct: 28.0, production_kt: 23240 },
      { country: 'EU', countryName: 'EU-27',         region: 'europe',       share_pct: 6.0,  production_kt: 4980 },
      { country: 'CN', countryName: 'China',         region: 'asia_pacific', share_pct: 4.0,  production_kt: 3320 },
      { country: 'IN', countryName: 'India',         region: 'asia_pacific', share_pct: 3.0,  production_kt: 2490 },
      { country: 'TH', countryName: 'Thailand',      region: 'asia_pacific', share_pct: 1.5,  production_kt: 1245 },
    ],
  },
  {
    code: 'GREEN_H2',
    name: 'Green Hydrogen (for PtL SAF)',
    category: 'saf',
    description: 'Feedstock for Power-to-Liquid synthetic SAF. Early stage — current production is negligible. Planned capacity is heavily concentrated in a few countries.',
    totalProduction_kt: 50,
    unit: 'kt',
    year: 2024,
    source: 'IEA / Hydrogen Council',
    countries: [
      { country: 'CL', countryName: 'Chile',         region: 'americas',     share_pct: 15.0, production_kt: 7.5 },
      { country: 'AU', countryName: 'Australia',      region: 'asia_pacific', share_pct: 12.0, production_kt: 6 },
      { country: 'MA', countryName: 'Morocco',        region: 'africa',       share_pct: 8.0,  production_kt: 4 },
      { country: 'SA', countryName: 'Saudi Arabia',   region: 'middle_east',  share_pct: 10.0, production_kt: 5 },
      { country: 'DE', countryName: 'Germany',        region: 'europe',       share_pct: 8.0,  production_kt: 4 },
      { country: 'NL', countryName: 'Netherlands',    region: 'europe',       share_pct: 6.0,  production_kt: 3 },
    ],
  },

  // ═══ FINISHED PRODUCTS (trade only, not feedstock) ════════════════════════
  {
    code: 'FAME_BIODIESEL',
    name: 'FAME Biodiesel',
    category: 'finished',
    description: 'Transesterification of vegetable oils / fats into fatty acid methyl esters. The traditional biodiesel product.',
    totalProduction_kt: 42000,
    unit: 'kt',
    year: 2024,
    source: 'IEA / USDA',
    countries: [
      { country: 'EU', countryName: 'EU-27',         region: 'europe',       share_pct: 28.0, production_kt: 11760 },
      { country: 'ID', countryName: 'Indonesia',     region: 'asia_pacific', share_pct: 22.0, production_kt: 9240 },
      { country: 'US', countryName: 'United States',  region: 'americas',     share_pct: 14.0, production_kt: 5880 },
      { country: 'BR', countryName: 'Brazil',        region: 'americas',     share_pct: 12.0, production_kt: 5040 },
      { country: 'AR', countryName: 'Argentina',     region: 'americas',     share_pct: 6.0,  production_kt: 2520 },
      { country: 'TH', countryName: 'Thailand',      region: 'asia_pacific', share_pct: 4.0,  production_kt: 1680 },
      { country: 'MY', countryName: 'Malaysia',      region: 'asia_pacific', share_pct: 3.0,  production_kt: 1260 },
    ],
  },
  {
    code: 'HVO',
    name: 'HVO / Renewable Diesel',
    category: 'finished',
    description: 'Hydrotreatment of vegetable oils/fats into drop-in diesel. Fastest-growing biofuel segment globally. US and Singapore dominate production.',
    totalProduction_kt: 14500,
    unit: 'kt',
    year: 2024,
    source: 'IEA / Company reports',
    countries: [
      { country: 'US', countryName: 'United States',  region: 'americas',     share_pct: 42.0, production_kt: 6090 },
      { country: 'SG', countryName: 'Singapore',      region: 'asia_pacific', share_pct: 14.0, production_kt: 2030 },
      { country: 'NL', countryName: 'Netherlands',    region: 'europe',       share_pct: 10.0, production_kt: 1450 },
      { country: 'FI', countryName: 'Finland',        region: 'europe',       share_pct: 9.0,  production_kt: 1305 },
      { country: 'IT', countryName: 'Italy',          region: 'europe',       share_pct: 6.0,  production_kt: 870 },
      { country: 'SE', countryName: 'Sweden',         region: 'europe',       share_pct: 4.0,  production_kt: 580 },
      { country: 'ES', countryName: 'Spain',          region: 'europe',       share_pct: 3.0,  production_kt: 435 },
    ],
  },
  {
    code: 'SAF',
    name: 'Sustainable Aviation Fuel',
    category: 'finished',
    description: 'Drop-in jet fuel from biomass/waste. ReFuelEU mandates 2% from 2025, rising to 70% by 2050. Most current production is HEFA pathway (same feedstocks as HVO).',
    totalProduction_kt: 600,
    unit: 'kt',
    year: 2024,
    source: 'IEA / IATA / Company reports',
    countries: [
      { country: 'US', countryName: 'United States',  region: 'americas',     share_pct: 50.0, production_kt: 300 },
      { country: 'SG', countryName: 'Singapore',      region: 'asia_pacific', share_pct: 15.0, production_kt: 90 },
      { country: 'FI', countryName: 'Finland',        region: 'europe',       share_pct: 12.0, production_kt: 72 },
      { country: 'NL', countryName: 'Netherlands',    region: 'europe',       share_pct: 8.0,  production_kt: 48 },
      { country: 'FR', countryName: 'France',         region: 'europe',       share_pct: 5.0,  production_kt: 30 },
    ],
  },
];

// ─── Trade flows ────────────────────────────────────────────────────────────

export const TRADE_FLOWS: TradeFlow[] = [
  // ── Palm oil ─────────────────────────────────────────────────────────────
  { feedstock: 'PALM_OIL', category: 'conventional', exporter: 'ID', exporterName: 'Indonesia', importer: 'IN', importerName: 'India',           volume_kt: 7200, pct_of_global_trade: 14.5, year: 2024 },
  { feedstock: 'PALM_OIL', category: 'conventional', exporter: 'ID', exporterName: 'Indonesia', importer: 'CN', importerName: 'China',           volume_kt: 5800, pct_of_global_trade: 11.7, year: 2024 },
  { feedstock: 'PALM_OIL', category: 'conventional', exporter: 'ID', exporterName: 'Indonesia', importer: 'PK', importerName: 'Pakistan',        volume_kt: 3200, pct_of_global_trade: 6.5,  year: 2024 },
  { feedstock: 'PALM_OIL', category: 'conventional', exporter: 'ID', exporterName: 'Indonesia', importer: 'EU', importerName: 'EU-27',           volume_kt: 2100, pct_of_global_trade: 4.2,  year: 2024, notes: 'Declining — RED III deforestation phase-out' },
  { feedstock: 'PALM_OIL', category: 'conventional', exporter: 'MY', exporterName: 'Malaysia',  importer: 'IN', importerName: 'India',           volume_kt: 4500, pct_of_global_trade: 9.1,  year: 2024 },
  { feedstock: 'PALM_OIL', category: 'conventional', exporter: 'MY', exporterName: 'Malaysia',  importer: 'CN', importerName: 'China',           volume_kt: 3100, pct_of_global_trade: 6.3,  year: 2024 },
  { feedstock: 'PALM_OIL', category: 'conventional', exporter: 'MY', exporterName: 'Malaysia',  importer: 'EU', importerName: 'EU-27',           volume_kt: 1800, pct_of_global_trade: 3.6,  year: 2024, notes: 'Declining — RED III deforestation phase-out' },
  { feedstock: 'PALM_OIL', category: 'conventional', exporter: 'MY', exporterName: 'Malaysia',  importer: 'JP', importerName: 'Japan',           volume_kt: 900,  pct_of_global_trade: 1.8,  year: 2024 },

  // ── Soybean oil ──────────────────────────────────────────────────────────
  { feedstock: 'SOYBEAN_OIL', category: 'conventional', exporter: 'AR', exporterName: 'Argentina', importer: 'IN', importerName: 'India',       volume_kt: 2500, pct_of_global_trade: 18.5, year: 2024 },
  { feedstock: 'SOYBEAN_OIL', category: 'conventional', exporter: 'AR', exporterName: 'Argentina', importer: 'CN', importerName: 'China',       volume_kt: 900,  pct_of_global_trade: 6.7,  year: 2024 },
  { feedstock: 'SOYBEAN_OIL', category: 'conventional', exporter: 'AR', exporterName: 'Argentina', importer: 'EU', importerName: 'EU-27',       volume_kt: 700,  pct_of_global_trade: 5.2,  year: 2024 },
  { feedstock: 'SOYBEAN_OIL', category: 'conventional', exporter: 'BR', exporterName: 'Brazil',    importer: 'IN', importerName: 'India',       volume_kt: 1400, pct_of_global_trade: 10.4, year: 2024 },
  { feedstock: 'SOYBEAN_OIL', category: 'conventional', exporter: 'BR', exporterName: 'Brazil',    importer: 'CN', importerName: 'China',       volume_kt: 1200, pct_of_global_trade: 8.9,  year: 2024 },
  { feedstock: 'SOYBEAN_OIL', category: 'conventional', exporter: 'US', exporterName: 'US',        importer: 'MX', importerName: 'Mexico',      volume_kt: 600,  pct_of_global_trade: 4.4,  year: 2024 },
  { feedstock: 'SOYBEAN_OIL', category: 'conventional', exporter: 'US', exporterName: 'US',        importer: 'CA', importerName: 'Canada',      volume_kt: 400,  pct_of_global_trade: 3.0,  year: 2024 },

  // ── Rapeseed / Canola ────────────────────────────────────────────────────
  { feedstock: 'RAPESEED_OIL', category: 'conventional', exporter: 'CA', exporterName: 'Canada',    importer: 'CN', importerName: 'China',      volume_kt: 2800, pct_of_global_trade: 22.0, year: 2024, notes: 'Canola seed exports — crushed in China' },
  { feedstock: 'RAPESEED_OIL', category: 'conventional', exporter: 'CA', exporterName: 'Canada',    importer: 'JP', importerName: 'Japan',      volume_kt: 1500, pct_of_global_trade: 11.8, year: 2024 },
  { feedstock: 'RAPESEED_OIL', category: 'conventional', exporter: 'CA', exporterName: 'Canada',    importer: 'EU', importerName: 'EU-27',      volume_kt: 800,  pct_of_global_trade: 6.3,  year: 2024 },
  { feedstock: 'RAPESEED_OIL', category: 'conventional', exporter: 'AU', exporterName: 'Australia',  importer: 'EU', importerName: 'EU-27',      volume_kt: 1200, pct_of_global_trade: 9.4,  year: 2024 },
  { feedstock: 'RAPESEED_OIL', category: 'conventional', exporter: 'UA', exporterName: 'Ukraine',    importer: 'EU', importerName: 'EU-27',      volume_kt: 1800, pct_of_global_trade: 14.2, year: 2024, notes: 'Disrupted since 2022 invasion — logistics via road/rail, not Black Sea' },

  // ── Sunflower oil ────────────────────────────────────────────────────────
  { feedstock: 'SUNFLOWER_OIL', category: 'conventional', exporter: 'UA', exporterName: 'Ukraine', importer: 'EU', importerName: 'EU-27',       volume_kt: 2800, pct_of_global_trade: 22.0, year: 2024, notes: 'Rerouted via rail/truck since Black Sea disruption' },
  { feedstock: 'SUNFLOWER_OIL', category: 'conventional', exporter: 'UA', exporterName: 'Ukraine', importer: 'IN', importerName: 'India',       volume_kt: 2200, pct_of_global_trade: 17.3, year: 2024 },
  { feedstock: 'SUNFLOWER_OIL', category: 'conventional', exporter: 'RU', exporterName: 'Russia',  importer: 'TR', importerName: 'Turkey',      volume_kt: 1200, pct_of_global_trade: 9.4,  year: 2024 },
  { feedstock: 'SUNFLOWER_OIL', category: 'conventional', exporter: 'RU', exporterName: 'Russia',  importer: 'IN', importerName: 'India',       volume_kt: 1000, pct_of_global_trade: 7.9,  year: 2024 },

  // ── UCO ──────────────────────────────────────────────────────────────────
  { feedstock: 'UCO', category: 'advanced', exporter: 'CN', exporterName: 'China',   importer: 'EU', importerName: 'EU-27',           volume_kt: 1800, pct_of_global_trade: 45.0, year: 2024, notes: 'Controversial — fraud/traceability concerns; EU considering caps' },
  { feedstock: 'UCO', category: 'advanced', exporter: 'CN', exporterName: 'China',   importer: 'UK', importerName: 'United Kingdom',  volume_kt: 350,  pct_of_global_trade: 8.8,  year: 2024 },
  { feedstock: 'UCO', category: 'advanced', exporter: 'CN', exporterName: 'China',   importer: 'SG', importerName: 'Singapore',       volume_kt: 300,  pct_of_global_trade: 7.5,  year: 2024, notes: 'Feeds Neste Singapore refinery' },
  { feedstock: 'UCO', category: 'advanced', exporter: 'US', exporterName: 'US',      importer: 'EU', importerName: 'EU-27',           volume_kt: 250,  pct_of_global_trade: 6.3,  year: 2024 },
  { feedstock: 'UCO', category: 'advanced', exporter: 'MY', exporterName: 'Malaysia',importer: 'EU', importerName: 'EU-27',           volume_kt: 200,  pct_of_global_trade: 5.0,  year: 2024 },
  { feedstock: 'UCO', category: 'advanced', exporter: 'ID', exporterName: 'Indonesia',importer: 'EU', importerName: 'EU-27',          volume_kt: 150,  pct_of_global_trade: 3.8,  year: 2024 },

  // ── Tallow ───────────────────────────────────────────────────────────────
  { feedstock: 'TALLOW', category: 'conventional', exporter: 'US', exporterName: 'US',         importer: 'EU', importerName: 'EU-27',     volume_kt: 450, pct_of_global_trade: 12.0, year: 2024 },
  { feedstock: 'TALLOW', category: 'conventional', exporter: 'AU', exporterName: 'Australia',  importer: 'SG', importerName: 'Singapore', volume_kt: 380, pct_of_global_trade: 10.1, year: 2024, notes: 'Neste Singapore' },
  { feedstock: 'TALLOW', category: 'conventional', exporter: 'AU', exporterName: 'Australia',  importer: 'EU', importerName: 'EU-27',     volume_kt: 250, pct_of_global_trade: 6.7,  year: 2024 },
  { feedstock: 'TALLOW', category: 'conventional', exporter: 'BR', exporterName: 'Brazil',     importer: 'EU', importerName: 'EU-27',     volume_kt: 220, pct_of_global_trade: 5.9,  year: 2024 },
  { feedstock: 'TALLOW', category: 'conventional', exporter: 'NZ', exporterName: 'New Zealand',importer: 'SG', importerName: 'Singapore', volume_kt: 180, pct_of_global_trade: 4.8,  year: 2024 },

  // ── Ethanol ──────────────────────────────────────────────────────────────
  { feedstock: 'ETHANOL', category: 'saf', exporter: 'US', exporterName: 'US',     importer: 'CA', importerName: 'Canada',   volume_kt: 2500, pct_of_global_trade: 22.0, year: 2024 },
  { feedstock: 'ETHANOL', category: 'saf', exporter: 'US', exporterName: 'US',     importer: 'EU', importerName: 'EU-27',    volume_kt: 1200, pct_of_global_trade: 10.6, year: 2024 },
  { feedstock: 'ETHANOL', category: 'saf', exporter: 'US', exporterName: 'US',     importer: 'BR', importerName: 'Brazil',   volume_kt: 800,  pct_of_global_trade: 7.1,  year: 2024 },
  { feedstock: 'ETHANOL', category: 'saf', exporter: 'BR', exporterName: 'Brazil', importer: 'EU', importerName: 'EU-27',    volume_kt: 600,  pct_of_global_trade: 5.3,  year: 2024, notes: 'Sugarcane-based — better GHG profile than corn ethanol' },
  { feedstock: 'ETHANOL', category: 'saf', exporter: 'BR', exporterName: 'Brazil', importer: 'KR', importerName: 'South Korea',volume_kt: 400,  pct_of_global_trade: 3.5,  year: 2024 },

  // ── HVO / Renewable diesel finished-product trade ────────────────────────
  { feedstock: 'HVO', category: 'finished', exporter: 'SG', exporterName: 'Singapore',    importer: 'EU', importerName: 'EU-27',      volume_kt: 1200, pct_of_global_trade: 28.0, year: 2024, notes: 'Neste Singapore mega-refinery' },
  { feedstock: 'HVO', category: 'finished', exporter: 'US', exporterName: 'US',           importer: 'EU', importerName: 'EU-27',      volume_kt: 600,  pct_of_global_trade: 14.0, year: 2024, notes: 'Growing — US HVO capacity doubling 2024-2026' },
  { feedstock: 'HVO', category: 'finished', exporter: 'FI', exporterName: 'Finland',      importer: 'EU', importerName: 'EU-27',      volume_kt: 500,  pct_of_global_trade: 11.6, year: 2024, notes: 'Neste Porvoo' },
  { feedstock: 'HVO', category: 'finished', exporter: 'NL', exporterName: 'Netherlands',  importer: 'EU', importerName: 'EU-27',      volume_kt: 450,  pct_of_global_trade: 10.5, year: 2024, notes: 'Neste Rotterdam' },

  // ── SAF finished-product trade ───────────────────────────────────────────
  { feedstock: 'SAF', category: 'finished', exporter: 'US', exporterName: 'US',           importer: 'EU', importerName: 'EU-27',      volume_kt: 80,   pct_of_global_trade: 30.0, year: 2024, notes: 'ReFuelEU demand pulling supply from US' },
  { feedstock: 'SAF', category: 'finished', exporter: 'SG', exporterName: 'Singapore',    importer: 'EU', importerName: 'EU-27',      volume_kt: 45,   pct_of_global_trade: 16.9, year: 2024, notes: 'Neste SAF output from Singapore' },
  { feedstock: 'SAF', category: 'finished', exporter: 'FI', exporterName: 'Finland',      importer: 'EU', importerName: 'EU-27',      volume_kt: 35,   pct_of_global_trade: 13.1, year: 2024 },
];

// ─── Computed helpers ───────────────────────────────────────────────────────

/** Top-3 country concentration % for a feedstock */
export function top3Concentration(f: Feedstock): number {
  const sorted = [...f.countries].sort((a, b) => b.share_pct - a.share_pct);
  return sorted.slice(0, 3).reduce((sum, c) => sum + c.share_pct, 0);
}

/** Herfindahl-Hirschman Index (0-10000 scale). >2500 = highly concentrated. */
export function hhi(f: Feedstock): number {
  return f.countries.reduce((sum, c) => sum + c.share_pct ** 2, 0);
}

/** Risk tier based on HHI */
export function riskTier(f: Feedstock): 'low' | 'moderate' | 'high' {
  const h = hhi(f);
  if (h >= 2500) return 'high';
  if (h >= 1500) return 'moderate';
  return 'low';
}

/** All unique feedstock codes in trade flows */
export function tradedFeedstocks(): string[] {
  const set = new Set(TRADE_FLOWS.map(t => t.feedstock));
  return Array.from(set);
}

/** All unique countries across production and trade */
export function allCountries(): Array<{ code: string; name: string }> {
  const map = new Map<string, string>();
  for (const f of FEEDSTOCKS) {
    for (const c of f.countries) {
      map.set(c.country, c.countryName);
    }
  }
  for (const t of TRADE_FLOWS) {
    map.set(t.exporter, t.exporterName);
    map.set(t.importer, t.importerName);
  }
  return Array.from(map.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
}
