/**
 * Biofuel mandate database for the Mandates tab.
 *
 * Curated from official government sources and the Sunco deep-research
 * report on EU biofuel certificate markets (April 2026).
 *
 * Update cadence: manually, when new targets are announced
 * (typically 1-2 times per year per country).
 */

export type CountryCode = 'UK' | 'DE' | 'FR' | 'NL' | 'ES' | 'IT';

export type SchemeType = 'certificate' | 'tax' | 'ghg' | 'hybrid';

export interface MandateTrajectoryPoint {
  year: number;
  overall: number;        // main blending / GHG reduction target %
  advanced: number;       // advanced biofuel sub-target %
  crop_cap: number | null; // food/feed crop cap % (null if N/A)
}

export interface MandatePenalty {
  amount: number;
  unit: string;          // e.g. "£/RTFC", "€/hl", "€/tCO2e"
  note: string;
}

export interface Multiplier {
  vector: string;         // "Renewable electricity (EV)", "Green hydrogen", etc.
  multiplier: string;     // "4×" or "2× RTFCs" or "4.58 RTFCs/kg"
  cap: string;            // "None", "20% of fishing fuel", "Target - 7%"
  note?: string;
}

export interface FeedstockRule {
  feedstock: string;
  cap: string;            // "0% (total ban)", "1.1% (essences)", "3.17% → 2.00% (2032)"
  status: 'banned' | 'capped' | 'allowed' | 'declining';
  note?: string;
}

export interface GhgThresholds {
  existing_plants: string;  // "65%" or "70% (tighter)"
  new_plants: string;       // "80%"
  grandfather_clause?: string; // "Pre-RED III until 31 Dec 2030"
  note?: string;
}

export interface AnnexIx {
  part_a_examples: string[];   // "Lignocellulosic", "Manure", "POME"
  part_b_examples: string[];   // "UCO", "Animal fats Cat 1/2/3"
  exclusions: string[];        // Country-specific exclusions
  notes: string;
}

export interface SafMandate {
  covered: boolean;            // Is SAF inside the main mandate or separate?
  track: string;               // "ReFuelEU Aviation (separate)" or "Included in THG-Quote from 2026"
  target_2025?: string;
  target_2030?: string;
  target_2035?: string;
  note?: string;
}

export interface Mandate {
  country_code: CountryCode;
  country_name: string;
  flag: string;                // emoji
  scheme_name: string;         // e.g. "THG-Quote", "RTFO"
  scheme_full_name: string;    // full official name
  scheme_type: SchemeType;
  regulator: string;
  official_url: string;
  obligation_period_start: string; // ISO month-day, e.g. "01-01"
  obligation_period_end: string;   // ISO month-day, e.g. "12-31"
  registry: string;
  compliance_deadline: string;     // "Apr 10 of following year"
  trajectory: MandateTrajectoryPoint[];
  penalty: MandatePenalty;
  double_counting: 'yes' | 'no' | 'abolishing' | 'transitioning';
  cross_border_accepted: boolean;
  key_notes: string[];
  last_updated: string;           // ISO date
  // Tier 1 — compliance rules
  multipliers: Multiplier[];
  feedstock_caps: FeedstockRule[];
  ghg_thresholds: GhgThresholds;
  // Tier 2 — extended context
  annex_ix: AnnexIx;
  saf_mandate: SafMandate;
}

// EU RED III baseline (reference line for trajectory charts)
export const RED_III_BASELINE: MandateTrajectoryPoint[] = [
  { year: 2023, overall: 14.0, advanced: 1.0, crop_cap: 7.0 },
  { year: 2024, overall: 15.5, advanced: 1.75, crop_cap: 7.0 },
  { year: 2025, overall: 17.0, advanced: 2.5, crop_cap: 7.0 },
  { year: 2026, overall: 19.5, advanced: 3.0, crop_cap: 7.0 },
  { year: 2027, overall: 22.0, advanced: 3.5, crop_cap: 7.0 },
  { year: 2028, overall: 24.5, advanced: 4.0, crop_cap: 7.0 },
  { year: 2029, overall: 27.0, advanced: 4.75, crop_cap: 7.0 },
  { year: 2030, overall: 29.0, advanced: 5.5, crop_cap: 7.0 },
  { year: 2031, overall: 29.0, advanced: 5.5, crop_cap: 7.0 },
  { year: 2032, overall: 29.0, advanced: 5.5, crop_cap: 7.0 },
  { year: 2033, overall: 29.0, advanced: 5.5, crop_cap: 7.0 },
  { year: 2034, overall: 29.0, advanced: 5.5, crop_cap: 7.0 },
  { year: 2035, overall: 29.0, advanced: 5.5, crop_cap: 7.0 },
];

export const MANDATES: Record<CountryCode, Mandate> = {
  UK: {
    country_code: 'UK',
    country_name: 'United Kingdom',
    flag: '🇬🇧',
    scheme_name: 'RTFO',
    scheme_full_name: 'Renewable Transport Fuel Obligation',
    scheme_type: 'certificate',
    regulator: 'Department for Transport (DfT)',
    official_url: 'https://www.gov.uk/government/collections/renewable-transport-fuel-obligation-rtfo',
    obligation_period_start: '04-01',
    obligation_period_end: '03-31',
    registry: 'RTFO Operating System',
    compliance_deadline: 'Oct 31 following obligation year end',
    trajectory: [
      { year: 2023, overall: 13.574, advanced: 1.178, crop_cap: 3.85 },
      { year: 2024, overall: 13.83, advanced: 1.41, crop_cap: 3.54 },
      { year: 2025, overall: 15.673, advanced: 1.619, crop_cap: 3.17 },
      { year: 2026, overall: 16.415, advanced: 1.863, crop_cap: 2.86 },
      { year: 2027, overall: 17.165, advanced: 2.109, crop_cap: 2.54 },
      { year: 2028, overall: 17.927, advanced: 2.357, crop_cap: 2.36 },
      { year: 2029, overall: 18.692, advanced: 2.609, crop_cap: 2.18 },
      { year: 2030, overall: 19.461, advanced: 2.864, crop_cap: 2.0 },
      { year: 2031, overall: 20.233, advanced: 3.12, crop_cap: 2.0 },
      { year: 2032, overall: 21.066, advanced: 3.39, crop_cap: 2.0 },
    ],
    penalty: {
      amount: 0.50,
      unit: '£/RTFC',
      note: '£0.50 main obligation / £0.80 development fuel. Up to £50,000 civil penalties for fraud.',
    },
    double_counting: 'yes',
    cross_border_accepted: false,
    key_notes: [
      'Uniquely maintains two-tier obligation with "development fuel" sub-target (wastes, residues, novel feedstocks)',
      'UCO and tallow excluded from development fuel category despite receiving double RTFCs',
      'UK plans to maintain double-counting for waste biofuels beyond 2025, diverging from EU approach',
      'Hydrogen receives 4.58 RTFCs/kg multiplier (9.16 if double-counted)',
      'Post-Brexit: entirely separate from EU systems, no cross-border certificate recognition',
    ],
    last_updated: '2026-04-01',
    multipliers: [
      { vector: 'Waste biofuels (UCO, tallow, Annex IX-B)', multiplier: '2× RTFCs', cap: 'None', note: 'Double-counting maintained post-2025, diverging from EU approach' },
      { vector: 'Development fuel (cellulosic, novel feedstocks)', multiplier: '2× Development RTFCs', cap: 'Dev sub-target', note: 'Separate sub-target above the main obligation' },
      { vector: 'Green hydrogen (transport)', multiplier: '4.58 RTFCs/kg H₂', cap: 'None', note: '9.16 RTFCs/kg if also double-counted' },
      { vector: 'Renewable electricity (EV)', multiplier: 'Separate RTFC track', cap: 'None', note: 'Not eligible as double-counted waste' },
    ],
    feedstock_caps: [
      { feedstock: 'Crop cap (food/feed)', cap: '3.17% (2025) → 2.00% (2032)', status: 'declining', note: 'Declining trajectory through 2032' },
      { feedstock: 'Used Cooking Oil (UCO)', cap: 'No cap — double-counted', status: 'allowed', note: 'Excluded from development fuel category despite 2× crediting' },
      { feedstock: 'Tallow (animal fats)', cap: 'No cap — double-counted', status: 'allowed' },
      { feedstock: 'Palm oil', cap: 'Allowed (subject to ILUC rules)', status: 'capped', note: 'High-ILUC feedstocks limited but not banned outright' },
    ],
    ghg_thresholds: {
      existing_plants: '65%',
      new_plants: '80%',
      grandfather_clause: 'Plants operating pre-Oct 2015 use older thresholds until decommissioning',
      note: 'Aligned with RED II baseline; RED III transposition pending post-Brexit',
    },
    annex_ix: {
      part_a_examples: ['Lignocellulosic', 'Non-food cellulosic', 'POME', 'Straw', 'Husks', 'Cobs', 'Nut shells', 'Manure', 'Sewage sludge', 'Algae'],
      part_b_examples: ['Used Cooking Oil (UCO)', 'Animal fats Cat 1/2/3 (tallow)'],
      exclusions: ['Palm-based residues (POME) allowed but scrutinised'],
      notes: 'UK accepts both Part A and Part B feedstocks with double-counting. Development fuel sub-target specifically targets Part A (cellulosic) feedstocks, which receive additional credit.',
    },
    saf_mandate: {
      covered: false,
      track: 'Separate UK SAF Mandate (from 2025)',
      target_2025: '2% SAF',
      target_2030: '10% SAF',
      target_2035: '22% SAF',
      note: 'Jet Zero Strategy target: 10% SAF by 2030. Separate buy-out mechanism distinct from RTFO.',
    },
  },

  DE: {
    country_code: 'DE',
    country_name: 'Germany',
    flag: '🇩🇪',
    scheme_name: 'THG-Quote',
    scheme_full_name: 'Treibhausgasminderungsquote (GHG Reduction Quota)',
    scheme_type: 'ghg',
    regulator: 'Hauptzollamt (Customs Authority)',
    official_url: 'https://www.gesetze-im-internet.de/bimschg/__37a.html',
    obligation_period_start: '01-01',
    obligation_period_end: '12-31',
    registry: 'Umweltbundesamt (UBA) certification',
    compliance_deadline: 'Apr 15 following obligation year',
    trajectory: [
      { year: 2023, overall: 9.25, advanced: 0.2, crop_cap: null },
      { year: 2024, overall: 9.35, advanced: 0.2, crop_cap: null },
      { year: 2025, overall: 10.6, advanced: 0.3, crop_cap: null },
      { year: 2026, overall: 12.1, advanced: 0.3, crop_cap: null },
      { year: 2027, overall: 13.6, advanced: 0.5, crop_cap: null },
      { year: 2028, overall: 15.1, advanced: 0.7, crop_cap: null },
      { year: 2029, overall: 16.6, advanced: 0.9, crop_cap: null },
      { year: 2030, overall: 25.0, advanced: 1.2, crop_cap: null },
      { year: 2031, overall: 30.0, advanced: 1.5, crop_cap: null },
      { year: 2032, overall: 35.0, advanced: 1.8, crop_cap: null },
      { year: 2035, overall: 45.0, advanced: 2.5, crop_cap: null },
      { year: 2040, overall: 59.0, advanced: 3.0, crop_cap: null },
    ],
    penalty: {
      amount: 600,
      unit: '€/tCO2e',
      note: '~€600/tCO2e for non-compliance. Separate SAF mandate added from 2026.',
    },
    double_counting: 'abolishing',
    cross_border_accepted: false,
    key_notes: [
      'GHG intensity-based (not volume-based) — unique among major EU systems',
      '2026 cabinet set trajectory to 59% GHG reduction by 2040',
      'Double-counting abolished from 2026 — expected strongly bullish for physical biofuel demand',
      'SAF mandate added from 2026',
      '2026 certificates surged above €500/tCO2e in late 2025 following reform announcement',
      'No explicit crop cap (GHG-based system naturally limits crop fuels via savings thresholds)',
    ],
    last_updated: '2026-02-11',
    multipliers: [
      { vector: 'Advanced biofuels (Annex IX-A)', multiplier: '2× (abolished from 2026)', cap: 'None', note: 'Double-counting being abolished under 2026 reform' },
      { vector: 'Waste biofuels (Annex IX-B)', multiplier: '2× (abolished from 2026)', cap: 'None', note: 'Double-counting being abolished under 2026 reform' },
      { vector: 'Renewable electricity (EV)', multiplier: 'Via UBA certification', cap: 'None', note: 'EV owners generate annual THG credits certified by Umweltbundesamt' },
      { vector: 'Green hydrogen / RFNBO', multiplier: 'New dedicated quota from 2026', cap: '0.2% (2026) → 3.0% (2040)', note: 'Separate RFNBO sub-quota introduced under THG-Quote reform' },
    ],
    feedstock_caps: [
      { feedstock: 'Food/feed crops', cap: 'No explicit cap', status: 'allowed', note: 'GHG-based system naturally limits crop fuels via savings thresholds' },
      { feedstock: 'Palm oil residues', cap: 'Excluded from 2026', status: 'banned', note: '2026 reform bans crediting of palm oil residue-based biofuels' },
      { feedstock: 'Used Cooking Oil (UCO)', cap: 'Exceeds EU 1.7% Part B cap', status: 'capped', note: 'Market reports suggest UCO volumes exceed EU-mandated 1.7% Annex IX Part B cap' },
      { feedstock: 'Tallow (animal fats)', cap: 'Allowed', status: 'allowed' },
    ],
    ghg_thresholds: {
      existing_plants: '50% (pre-2015 plants)',
      new_plants: '65% (2015+) / 70% (2021+)',
      grandfather_clause: 'Tiered by plant commissioning date',
      note: 'Pre-October 2015 plants use lower 50% threshold. Plants commissioned 2021+ must meet 70% savings.',
    },
    annex_ix: {
      part_a_examples: ['Lignocellulosic', 'Straw', 'Husks', 'Cobs', 'Manure', 'Algae', 'POME'],
      part_b_examples: ['Used Cooking Oil (UCO)', 'Animal fats Cat 1/2/3 (tallow)'],
      exclusions: ['Palm oil residues (excluded from 2026)'],
      notes: 'Germany accepts Annex IX-A and IX-B, but 2026 reform removes double-counting benefit. SAF separately credited from 2026.',
    },
    saf_mandate: {
      covered: true,
      track: 'Integrated into THG-Quote from 2026 + ReFuelEU Aviation',
      target_2025: '2% SAF (ReFuelEU)',
      target_2030: '6% SAF (ReFuelEU)',
      target_2035: '20% SAF (ReFuelEU)',
      note: '2026 reform adds SAF to THG-Quote obligation. Parallel compliance via ReFuelEU Aviation 2% baseline.',
    },
  },

  FR: {
    country_code: 'FR',
    country_name: 'France',
    flag: '🇫🇷',
    scheme_name: 'TIRUERT',
    scheme_full_name: "Taxe Incitative Relative à l'Utilisation d'Énergie Renouvelable dans les Transports",
    scheme_type: 'tax',
    regulator: 'Direction Générale des Douanes et Droits Indirects (DGDDI)',
    official_url: 'https://www.douane.gouv.fr/',
    obligation_period_start: '01-01',
    obligation_period_end: '12-31',
    registry: 'CarbuRe (carbure.beta.gouv.fr)',
    compliance_deadline: 'Apr 10 following obligation year',
    trajectory: [
      { year: 2023, overall: 9.2, advanced: 1.0, crop_cap: 7.0 },
      { year: 2024, overall: 9.25, advanced: 1.2, crop_cap: 7.0 },
      { year: 2025, overall: 9.4, advanced: 1.3, crop_cap: 7.0 },
      { year: 2026, overall: 9.0, advanced: 0.7, crop_cap: 6.2 },
      { year: 2027, overall: 9.6, advanced: 1.0, crop_cap: 6.7 },
      { year: 2028, overall: 10.2, advanced: 1.3, crop_cap: 6.85 },
      { year: 2029, overall: 10.8, advanced: 1.6, crop_cap: 7.0 },
      { year: 2030, overall: 11.4, advanced: 1.95, crop_cap: 7.0 },
      { year: 2031, overall: 12.35, advanced: 2.08, crop_cap: 7.0 },
      { year: 2032, overall: 13.27, advanced: 2.21, crop_cap: 7.0 },
      { year: 2033, overall: 14.18, advanced: 2.34, crop_cap: 7.0 },
      { year: 2034, overall: 15.09, advanced: 2.47, crop_cap: 7.0 },
      { year: 2035, overall: 16.0, advanced: 2.6, crop_cap: 7.0 },
    ],
    penalty: {
      amount: 140,
      unit: '€/hl',
      note: '€140/hl × (target − actual). Draft PPE3 proposes restructuring to €40/GJ (fuel target) and €80/GJ (advanced/hydrogen) from 2026.',
    },
    double_counting: 'abolishing',
    cross_border_accepted: false,
    key_notes: [
      'Tax-based (shortfall penalty), not certificate-based — unique among majors',
      'Total ban on palm oil (0%) and soy oil (0%) since 2019 — strictest in EU',
      '4× multiplier for renewable electricity (EV charging) — no cap',
      '2× multiplier for renewable hydrogen — no cap',
      'UCO cap 1.1–1.2% (strictest in EU)',
      'Droits de comptabilisation: tradable accounting rights (not physical certificates)',
      'Joint liability: seller (cédant) is solidaire for failures on transferred rights',
      'Double-counting abolition proposed from 2026 (pending final PPE3 adoption)',
    ],
    last_updated: '2026-02-19',
    multipliers: [
      { vector: 'Renewable electricity (EV charging)', multiplier: '4×', cap: 'None', note: 'Strongest multiplier in EU — creates major arbitrage vs standalone electricity GOs' },
      { vector: 'Renewable hydrogen', multiplier: '2×', cap: 'None', note: 'Direct link between H₂ production and transport compliance' },
      { vector: 'Cat 3 animal fat HVO (gazole only)', multiplier: '2×', cap: '20% of fishing fuel volumes', note: 'Narrow eligible pool' },
      { vector: 'Annex IX Part A advanced biofuels', multiplier: '2×', cap: 'Target − 7%', note: 'Advanced sub-target capped at overall target minus crop cap' },
    ],
    feedstock_caps: [
      { feedstock: 'Palm oil', cap: '0% — total ban', status: 'banned', note: 'Banned since 2019 Finance Law — strictest in EU' },
      { feedstock: 'Soy oil', cap: '0% — total ban', status: 'banned', note: 'Banned since 2019 Finance Law — strictest in EU' },
      { feedstock: 'Food/feed crops (overall)', cap: '7% (essences & gazoles)', status: 'capped' },
      { feedstock: 'Used Cooking Oil (UCO)', cap: '1.1% essences / 1.2% gazoles', status: 'capped', note: 'Strictest UCO cap in EU' },
      { feedstock: 'Tall oil', cap: '0.1%', status: 'capped' },
      { feedstock: 'Cat 3 animal fat HVO', cap: '20% of fishing fuel (gazole only)', status: 'capped' },
    ],
    ghg_thresholds: {
      existing_plants: '70% (tightening under RED III)',
      new_plants: '80%',
      grandfather_clause: 'Pre-RED III certified biofuels maintain compliance until 31 Dec 2030',
      note: 'France tightening thresholds beyond EU minimum as part of RED III transposition',
    },
    annex_ix: {
      part_a_examples: ['Lignocellulosic', 'Straw', 'Husks', 'Cobs', 'Manure', 'POME', 'Algae'],
      part_b_examples: ['Used Cooking Oil (UCO)', 'Animal fats Cat 1/2/3 (tallow)'],
      exclusions: ['Palm oil', 'Soy oil', 'Palm residues implicitly via palm ban'],
      notes: 'France accepts Annex IX feedstocks but uniquely bans all palm and soy derivatives regardless of pathway. UCO cap is the strictest in EU.',
    },
    saf_mandate: {
      covered: false,
      track: 'Removed from TIRUERT in 2025 → ReFuelEU Aviation',
      target_2025: '2% SAF (ReFuelEU)',
      target_2030: '6% SAF (ReFuelEU)',
      target_2035: '20% SAF (ReFuelEU)',
      note: 'Aviation (kerosene/JET A1) removed from TIRUERT scope under 2025 Finance Law, transferred to ReFuelEU Aviation framework.',
    },
  },

  NL: {
    country_code: 'NL',
    country_name: 'Netherlands',
    flag: '🇳🇱',
    scheme_name: 'HBE → ERE',
    scheme_full_name: 'Hernieuwbare Brandstofeenheden (transitioning to Emissie Reductie Eenheden)',
    scheme_type: 'certificate',
    regulator: 'Nederlandse Emissieautoriteit (NEa)',
    official_url: 'https://www.emissieautoriteit.nl/',
    obligation_period_start: '01-01',
    obligation_period_end: '12-31',
    registry: 'REV (Register Energie voor Vervoer)',
    compliance_deadline: 'Apr 30 following obligation year',
    trajectory: [
      { year: 2023, overall: 18.9, advanced: 2.4, crop_cap: 1.4 },
      { year: 2024, overall: 28.4, advanced: 2.9, crop_cap: 1.4 },
      { year: 2025, overall: 29.4, advanced: 3.6, crop_cap: 1.4 },
      { year: 2026, overall: 30.0, advanced: 4.0, crop_cap: 1.4 },
      { year: 2027, overall: 31.0, advanced: 4.5, crop_cap: 1.4 },
      { year: 2028, overall: 32.0, advanced: 5.0, crop_cap: 1.4 },
      { year: 2029, overall: 33.0, advanced: 5.5, crop_cap: 1.4 },
      { year: 2030, overall: 34.0, advanced: 5.5, crop_cap: 1.4 },
    ],
    penalty: {
      amount: 0,
      unit: '—',
      note: 'Compliance via purchase of HBEs. Administrative fines for missing REV registrations.',
    },
    double_counting: 'transitioning',
    cross_border_accepted: false,
    key_notes: [
      'Energy-content based (1 HBE = 1 GJ of renewable energy)',
      'Among the highest overall obligations in the EU (28–30%)',
      '107 million GJ delivered by 202 companies in 2024 (+40% YoY)',
      'Transitioning from HBE (energy-share) to ERE (GHG-based emission reduction units) under RED III',
      'HBE categories: HBE-C (conventional), HBE-G (advanced), HBE-IXB (Annex IX-B), HBE-O (other)',
      'NEa has stated fraudulent HBEs in supply chain will NOT be retroactively cancelled',
    ],
    last_updated: '2026-03-15',
    multipliers: [
      { vector: 'Advanced biofuels (HBE-G)', multiplier: '2× (phasing out)', cap: 'None', note: 'Multipliers being phased out under ERE transition' },
      { vector: 'Renewable electricity (EV)', multiplier: 'HBE-E generation', cap: 'None', note: 'Electricity supplied to EV charging generates HBE-E certificates' },
      { vector: 'Green hydrogen', multiplier: 'HBE-E via electrolysis', cap: 'None', note: 'Hydrogen from verified renewable electricity pathway' },
      { vector: 'All categories (post-2025)', multiplier: 'Phasing to ERE (GHG-based)', cap: 'N/A', note: 'System shifting from energy-share to GHG-reduction accounting' },
    ],
    feedstock_caps: [
      { feedstock: 'Conventional biofuels (HBE-C)', cap: '1.4% maximum', status: 'capped', note: 'Hard ceiling on crop-based feedstocks' },
      { feedstock: 'Food/feed crops', cap: '1.4% (via HBE-C limit)', status: 'capped' },
      { feedstock: 'Used Cooking Oil (UCO)', cap: 'Via HBE-B sub-limit', status: 'capped', note: 'Annex IX-B feedstocks tracked separately' },
      { feedstock: 'Palm oil', cap: 'Allowed with ILUC certification', status: 'capped' },
    ],
    ghg_thresholds: {
      existing_plants: '65%',
      new_plants: '80%',
      grandfather_clause: 'Pre-RED III certified until 31 Dec 2030',
      note: 'Standard RED III thresholds; ERE transition will shift compliance to GHG-reduction basis',
    },
    annex_ix: {
      part_a_examples: ['Lignocellulosic', 'Straw', 'POME', 'Manure', 'Algae', 'Husks'],
      part_b_examples: ['Used Cooking Oil (UCO)', 'Animal fats Cat 1/2/3'],
      exclusions: [],
      notes: 'Netherlands accepts full Annex IX list. HBE-G tracks advanced biofuels; HBE-IXB specifically for Annex IX Part B. HBE-O catches residual categories.',
    },
    saf_mandate: {
      covered: false,
      track: 'ReFuelEU Aviation (separate)',
      target_2025: '2% SAF',
      target_2030: '6% SAF',
      target_2035: '20% SAF',
      note: 'SAF compliance handled separately via ReFuelEU Aviation, not through HBE/ERE.',
    },
  },

  ES: {
    country_code: 'ES',
    country_name: 'Spain',
    flag: '🇪🇸',
    scheme_name: 'Orden Biocarburantes',
    scheme_full_name: 'Real Decreto Sistema de Certificación (Royal Decree Certification System)',
    scheme_type: 'certificate',
    regulator: 'MITECO (Ministry for Ecological Transition)',
    official_url: 'https://www.miteco.gob.es/es/energia/biocarburantes.html',
    obligation_period_start: '01-01',
    obligation_period_end: '12-31',
    registry: 'SICBIOS (Sistema de Certificación Biocombustibles Sostenibles)',
    compliance_deadline: 'Mar 31 following obligation year',
    trajectory: [
      { year: 2023, overall: 11.0, advanced: 0.2, crop_cap: 7.0 },
      { year: 2024, overall: 11.5, advanced: 0.4, crop_cap: 7.0 },
      { year: 2025, overall: 12.0, advanced: 0.6, crop_cap: 7.0 },
      { year: 2026, overall: 13.0, advanced: 0.8, crop_cap: 7.0 },
      { year: 2027, overall: 14.0, advanced: 1.0, crop_cap: 7.0 },
      { year: 2028, overall: 15.5, advanced: 1.3, crop_cap: 7.0 },
      { year: 2029, overall: 17.0, advanced: 1.6, crop_cap: 7.0 },
      { year: 2030, overall: 20.0, advanced: 2.0, crop_cap: 7.0 },
      { year: 2035, overall: 29.0, advanced: 5.5, crop_cap: 7.0 },
    ],
    penalty: {
      amount: 0,
      unit: '—',
      note: 'Administrative fines via MITECO. No fixed €/unit penalty — enforcement by certificate purchase requirement.',
    },
    double_counting: 'yes',
    cross_border_accepted: false,
    key_notes: [
      'Volume-based blending mandate system',
      'Separate biodiesel and ethanol sub-targets',
      'RED III transposition in progress — final targets expected Q4 2026',
      'Strong alignment with EU baseline (29% by 2030)',
      'Double-counting maintained for waste-based feedstocks (UCO, tallow, POME)',
    ],
    last_updated: '2026-01-20',
    multipliers: [
      { vector: 'Annex IX-A advanced biofuels', multiplier: '2×', cap: 'None', note: 'Standard EU double-counting for advanced feedstocks' },
      { vector: 'Annex IX-B waste biofuels', multiplier: '2×', cap: 'EU 1.7% Part B cap', note: 'UCO, tallow, POME count double toward mandate' },
      { vector: 'Renewable electricity (EV)', multiplier: 'Under implementation', cap: 'TBD', note: 'Framework being finalised under RED III transposition' },
      { vector: 'Renewable hydrogen / RFNBO', multiplier: 'RED III baseline', cap: 'EU framework', note: 'Will apply EU RFNBO framework once fully transposed' },
    ],
    feedstock_caps: [
      { feedstock: 'Food/feed crops', cap: '7% (EU standard)', status: 'capped', note: 'Aligned with RED III crop cap' },
      { feedstock: 'Palm oil', cap: 'Allowed (ILUC rules apply)', status: 'capped', note: 'Subject to high-ILUC classification, no outright ban' },
      { feedstock: 'Used Cooking Oil (UCO)', cap: 'Subject to EU 1.7% Part B cap', status: 'capped' },
      { feedstock: 'Tallow', cap: 'Subject to EU 1.7% Part B cap', status: 'capped' },
    ],
    ghg_thresholds: {
      existing_plants: '65%',
      new_plants: '80%',
      grandfather_clause: 'Pre-RED III certified until 31 Dec 2030',
      note: 'Standard RED III thresholds under transposition',
    },
    annex_ix: {
      part_a_examples: ['Lignocellulosic', 'Straw', 'POME', 'Manure', 'Algae', 'Nut shells'],
      part_b_examples: ['Used Cooking Oil (UCO)', 'Animal fats Cat 1/2/3'],
      exclusions: [],
      notes: 'Spain accepts full Annex IX list with standard EU rules. Final transposition details expected Q4 2026.',
    },
    saf_mandate: {
      covered: false,
      track: 'ReFuelEU Aviation (separate)',
      target_2025: '2% SAF',
      target_2030: '6% SAF',
      target_2035: '20% SAF',
      note: 'SAF compliance via ReFuelEU Aviation. Spain well-positioned for HEFA pathway given Mediterranean refining capacity.',
    },
  },

  IT: {
    country_code: 'IT',
    country_name: 'Italy',
    flag: '🇮🇹',
    scheme_name: 'CIC (Certificati di Immissione in Consumo)',
    scheme_full_name: 'Biofuel Release-for-Consumption Certificates',
    scheme_type: 'certificate',
    regulator: 'GSE (Gestore dei Servizi Energetici)',
    official_url: 'https://www.gse.it/servizi-per-te/fonti-rinnovabili/biocarburanti',
    obligation_period_start: '01-01',
    obligation_period_end: '12-31',
    registry: 'GSE Biofuels Registry',
    compliance_deadline: 'Apr 30 following obligation year',
    trajectory: [
      { year: 2023, overall: 10.0, advanced: 0.9, crop_cap: 7.0 },
      { year: 2024, overall: 11.0, advanced: 1.2, crop_cap: 7.0 },
      { year: 2025, overall: 12.5, advanced: 1.6, crop_cap: 7.0 },
      { year: 2026, overall: 14.0, advanced: 2.0, crop_cap: 7.0 },
      { year: 2027, overall: 15.5, advanced: 2.5, crop_cap: 7.0 },
      { year: 2028, overall: 17.0, advanced: 3.0, crop_cap: 7.0 },
      { year: 2029, overall: 19.0, advanced: 3.75, crop_cap: 7.0 },
      { year: 2030, overall: 22.0, advanced: 4.5, crop_cap: 7.0 },
      { year: 2035, overall: 29.0, advanced: 5.5, crop_cap: 7.0 },
    ],
    penalty: {
      amount: 600,
      unit: '€/CIC',
      note: '€600 per missing CIC. One CIC represents 10 Gcal of renewable energy.',
    },
    double_counting: 'yes',
    cross_border_accepted: false,
    key_notes: [
      'CIC-based certificate system administered by GSE',
      '1 CIC = 10 Gcal (≈11.6 MWh) of renewable fuel delivered',
      'Strong preference for advanced biofuels from wastes and residues',
      'Italy is a major UCOME and HVO producer (Eni Venice refinery)',
      'Separate SAF mandate under implementation for ReFuelEU Aviation compliance',
    ],
    last_updated: '2026-02-05',
    multipliers: [
      { vector: 'Annex IX-A advanced biofuels', multiplier: '2×', cap: 'None', note: 'Double-counting maintained for advanced feedstocks' },
      { vector: 'Annex IX-B waste biofuels (UCO, tallow)', multiplier: '2×', cap: 'EU 1.7% Part B cap', note: 'Strong domestic UCOME/HVO industry benefits' },
      { vector: 'Renewable electricity (EV)', multiplier: 'CIC generation for charging', cap: 'None', note: 'EV operators can generate CICs for public charging' },
      { vector: 'Renewable hydrogen', multiplier: 'Per RED III framework', cap: 'EU framework', note: 'RFNBO framework implementation in progress' },
    ],
    feedstock_caps: [
      { feedstock: 'Food/feed crops', cap: '7% (EU standard)', status: 'capped' },
      { feedstock: 'Palm oil', cap: 'Allowed (ILUC rules)', status: 'capped' },
      { feedstock: 'Used Cooking Oil (UCO)', cap: 'Subject to EU 1.7% Part B cap', status: 'capped', note: 'Italy is a major UCO importer and UCOME producer' },
      { feedstock: 'Tallow', cap: 'Subject to EU 1.7% Part B cap', status: 'capped' },
    ],
    ghg_thresholds: {
      existing_plants: '65%',
      new_plants: '80%',
      grandfather_clause: 'Pre-RED III certified until 31 Dec 2030',
      note: 'Standard RED III thresholds',
    },
    annex_ix: {
      part_a_examples: ['Lignocellulosic', 'Straw', 'POME', 'Manure', 'Algae', 'Husks', 'Cobs'],
      part_b_examples: ['Used Cooking Oil (UCO)', 'Animal fats Cat 1/2/3 (tallow)'],
      exclusions: [],
      notes: 'Italy accepts full Annex IX list. Eni Venice refinery is a major HVO producer using Annex IX feedstocks.',
    },
    saf_mandate: {
      covered: false,
      track: 'ReFuelEU Aviation (separate) — implementation under way',
      target_2025: '2% SAF',
      target_2030: '6% SAF',
      target_2035: '20% SAF',
      note: 'SAF mandate under implementation for ReFuelEU compliance. Eni is investing in SAF production capacity.',
    },
  },
};

/**
 * Compute the progress through the current obligation period (0-100).
 * For calendar-year mandates (Jan-Dec) this is the % of the year elapsed.
 * For the UK RTFO (Apr-Mar), it's the % since April 1.
 */
export function computeMandateProgress(mandate: Mandate, now: Date = new Date()): {
  pct: number;
  daysElapsed: number;
  daysRemaining: number;
  periodStart: Date;
  periodEnd: Date;
} {
  const [startMonth, startDay] = mandate.obligation_period_start.split('-').map(Number);
  const [endMonth, endDay] = mandate.obligation_period_end.split('-').map(Number);

  const currentYear = now.getFullYear();

  // Build period start: most recent past occurrence of (startMonth, startDay)
  let periodStart = new Date(Date.UTC(currentYear, startMonth - 1, startDay));
  if (periodStart > now) {
    periodStart = new Date(Date.UTC(currentYear - 1, startMonth - 1, startDay));
  }

  // Period end is either same year (if start < end) or next year (if start > end, e.g. Apr-Mar)
  const sameYear = startMonth < endMonth || (startMonth === endMonth && startDay <= endDay);
  const periodEnd = sameYear
    ? new Date(Date.UTC(periodStart.getUTCFullYear(), endMonth - 1, endDay, 23, 59, 59))
    : new Date(Date.UTC(periodStart.getUTCFullYear() + 1, endMonth - 1, endDay, 23, 59, 59));

  const totalMs = periodEnd.getTime() - periodStart.getTime();
  const elapsedMs = Math.max(0, Math.min(totalMs, now.getTime() - periodStart.getTime()));
  const pct = Math.round((elapsedMs / totalMs) * 100);

  const daysElapsed = Math.floor(elapsedMs / (24 * 3600 * 1000));
  const daysRemaining = Math.floor((totalMs - elapsedMs) / (24 * 3600 * 1000));

  return { pct, daysElapsed, daysRemaining, periodStart, periodEnd };
}

/** Get the trajectory point for a specific year (or closest previous year). */
export function getTrajectoryForYear(mandate: Mandate, year: number): MandateTrajectoryPoint | null {
  const sorted = [...mandate.trajectory].sort((a, b) => a.year - b.year);
  // Exact match first
  const exact = sorted.find((p) => p.year === year);
  if (exact) return exact;
  // Fall back to closest earlier year
  const earlier = [...sorted].reverse().find((p) => p.year <= year);
  return earlier ?? sorted[0] ?? null;
}

/** Array of all country codes in display order. */
export const COUNTRY_ORDER: CountryCode[] = ['UK', 'DE', 'FR', 'NL', 'ES', 'IT'];
