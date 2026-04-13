import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import Spinner from '../../components/Spinner';
import { API_BASE_URL, API_KEY } from '../../config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricePoint  { date: string; value: number }
interface TickerInfo  { name: string; relevance: string; data: PricePoint[] }
interface EthanolPoint { date: string; production: number }
interface BiasPoint    { date: string; bias: 'bullish' | 'bearish' | 'neutral' }
interface EurUsdPoint  { date: string; rate: number }
interface PetroleumData {
  inventories: { date: string; value: number }[];
  distillate_stocks: { date: string; value: number }[];
  gasoline_stocks: { date: string; value: number }[];
  jet_fuel_stocks: { date: string; value: number }[];
  refinery_runs: { date: string; value: number }[];
  imports: { date: string; value: number }[];
  source: string;
}
interface CotEntry {
  report_date: string; open_interest: number;
  noncomm_long: number; noncomm_short: number;
  comm_long: number; comm_short: number; net_spec: number;
}
interface CotData {
  corn: CotEntry[]; soybeans: CotEntry[];
  soybean_oil: CotEntry[]; heating_oil: CotEntry[];
  source: string;
}
interface WeatherPoint { date: string; temp_max: number; temp_min: number | null; precipitation: number }
interface WeatherRegion { label: string; data: WeatherPoint[] }
interface WeatherData {
  us_midwest: WeatherRegion; eu_france: WeatherRegion; malaysia: WeatherRegion;
  brazil: WeatherRegion; argentina: WeatherRegion;
  indonesia: WeatherRegion; canada: WeatherRegion;
  source: string;
}
interface FredSeries { date: string; value: number }
interface FredData {
  fed_funds_rate: FredSeries[]; dollar_index: FredSeries[]; yield_curve: FredSeries[];
  ecb_deposit_rate: FredSeries[];
  source: string;
}
// ─── Colour palette (visible on dark bg) ─────────────────────────────────────

const COLOURS: Record<string, string> = {
  'ZL=F':     '#e879f9',   // Soybean Oil   — fuchsia
  'ZS=F':     '#34d399',   // Soybeans      — emerald
  'ZC=F':     '#f87171',   // Corn          — red
  'BZ=F':     '#60a5fa',   // Brent         — blue
  'CL=F':     '#38bdf8',   // WTI Crude     — light blue
  'HO=F':     '#fbbf24',   // Heating Oil   — yellow (gasoil proxy)
  'NG=F':     '#f87171',   // Natural Gas   — red
  'EURUSD=X': '#a78bfa',   // EUR/USD       — violet
  'USDCNY=X': '#f472b6',   // USD/CNY       — pink
  'GNF=F':    '#22d3ee',   // Rapeseed      — cyan
};

// ─── Chart groups ─────────────────────────────────────────────────────────────

const ENERGY_TICKERS    = ['BZ=F', 'CL=F', 'HO=F', 'NG=F'];
const FEEDSTOCK_INDEX_TICKERS = ['ZL=F', 'GNF=F'];
const FX_TICKERS        = ['EURUSD=X', 'USDCNY=X'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Index a price series to base-100 starting from the first data point. */
function indexSeries(data: PricePoint[]): PricePoint[] {
  if (data.length === 0) return [];
  const base = data[0].value;
  if (base === 0) return data;
  return data.map(p => ({ date: p.date, value: parseFloat(((p.value / base) * 100).toFixed(2)) }));
}

/**
 * Merge multiple ticker series into a flat array keyed by date for Recharts.
 * Applies base-100 normalisation so series with different units are comparable.
 */
function buildChartData(
  tickers: string[],
  tickerMap: Record<string, TickerInfo>,
  normalise = true,
): Record<string, number | string>[] {
  const available = tickers.filter(t => tickerMap[t]?.data?.length > 0);
  if (available.length === 0) return [];

  const indexed: Record<string, PricePoint[]> = {};
  for (const t of available) {
    indexed[t] = normalise ? indexSeries(tickerMap[t].data) : tickerMap[t].data;
  }

  const allDates = Array.from(new Set(
    available.flatMap(t => indexed[t].map(p => p.date))
  )).sort();

  return allDates.map(date => {
    const row: Record<string, number | string> = { date };
    for (const t of available) {
      const pt = indexed[t].find(p => p.date === date);
      if (pt) row[t] = pt.value;
    }
    return row;
  });
}

function fmtAxisDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function fmtFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** How many axis ticks to show without crowding. */
function tickInterval(dataLen: number): number {
  if (dataLen <= 20) return 2;
  if (dataLen <= 40) return 4;
  if (dataLen <= 65) return 8;
  return 12;
}

/** Compute % progress through a date range (clamped 0–100). */
function mandateProgress(start: Date, end: Date): number {
  const now  = Date.now();
  const s    = start.getTime();
  const e    = end.getTime();
  return Math.round(Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100)));
}

// ─── USD/MT conversion factors ──────────────────────────────────────────────
const USD_MT_FACTORS: Record<string, number> = {
  'ZL=F': 22.0462,   // USc/lb → USD/MT  (1 MT = 2204.62 lbs ÷ 100)
  'ZS=F': 0.36744,   // USc/bu → USD/MT  (1 MT = 36.744 bu ÷ 100)
  'ZC=F': 0.39368,   // USc/bu → USD/MT  (1 MT = 39.368 bu ÷ 100)
};

/** Compute the Gasoil–Brent crack spread in USD/MT.
 *  yfinance returns HO in USD/gal (NOT cents/gal).
 *  1 MT of heating oil ≈ 305 US gallons → HO (USD/gal) × 305 = USD/MT.
 *  1 MT of crude oil ≈ 7.45 barrels     → Brent (USD/bbl) × 7.45 = USD/MT.
 *  Crack = HO_USD/MT − Brent_USD/MT. */
function computeCrackSpread(
  heatingOil: PricePoint[],
  brent: PricePoint[],
): PricePoint[] {
  if (!heatingOil.length || !brent.length) return [];
  const brentMap = new Map(brent.map((p) => [p.date, p.value]));
  const out: PricePoint[] = [];
  for (const ho of heatingOil) {
    const b = brentMap.get(ho.date);
    if (b == null) continue;
    // HO: USD/gal × 305 gal/MT = USD/MT
    // Brent: USD/bbl × 7.45 bbl/MT = USD/MT
    const hoUsdMt = ho.value * 305;
    const brentUsdMt = b * 7.45;
    out.push({ date: ho.date, value: parseFloat((hoUsdMt - brentUsdMt).toFixed(2)) });
  }
  return out;
}

/** Convert a price series to USD/MT using the conversion factor. */
function toUsdPerMt(data: PricePoint[], factor: number): PricePoint[] {
  return data.map(p => ({ date: p.date, value: parseFloat((p.value * factor).toFixed(2)) }));
}

// ─── Shared chart config ──────────────────────────────────────────────────────

const GRID_COLOR   = '#1e293b';
const AXIS_COLOR   = '#64748b';
const CHART_FONT   = 11;

// ─── Custom dark tooltip ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTooltip({ active, payload, label, normalised = false }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-panel border border-border rounded p-3 text-xs shadow-xl min-w-[160px]">
      <p className="text-text-dim mb-2 font-semibold">{fmtFullDate(label as string)}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-text-secondary truncate max-w-[100px]">{entry.name}</span>
          </div>
          <span className="text-text-primary font-mono tabular-nums">
            {(entry.value as number)?.toFixed(2)}{normalised ? '' : ''}
          </span>
        </div>
      ))}
      {normalised && <p className="text-text-dim mt-1.5 text-[10px]">Base-100 indexed</p>}
    </div>
  );
}

// ─── Chart modal (click to expand) ────────────────────────────────────────────

function ChartModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded shadow-2xl flex flex-col"
        style={{ width: '92vw', height: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <h3 className="text-text-primary font-semibold text-base">{title}</h3>
            {subtitle && <p className="text-text-dim text-xs mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text-primary text-2xl leading-none px-2 -mt-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5 flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
  height = 260,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="bg-card border border-border rounded cursor-pointer hover:border-text-dim transition-colors"
        onClick={() => setOpen(true)}
      >
        <div className="px-4 py-3 border-b border-border flex items-start justify-between">
          <div>
            <h3 className="text-text-primary font-semibold text-sm">{title}</h3>
            {subtitle && <p className="text-text-dim text-xs mt-0.5">{subtitle}</p>}
          </div>
          <span className="text-text-dim text-xs opacity-60" aria-hidden>⤢</span>
        </div>
        <div className="p-4" style={{ height }}>
          {children}
        </div>
      </div>
      {open && (
        <ChartModal title={title} subtitle={subtitle} onClose={() => setOpen(false)}>
          <div style={{ width: '100%', height: '100%' }}>{children}</div>
        </ChartModal>
      )}
    </>
  );
}

// ─── Normalised multi-line chart ──────────────────────────────────────────────

function MultiLineChart({
  tickers,
  tickerMap,
}: {
  tickers: string[];
  tickerMap: Record<string, TickerInfo>;
}) {
  const data = buildChartData(tickers, tickerMap, true);
  const available = tickers.filter(t => tickerMap[t]?.data?.length > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-sm">
        No data available for this group
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtAxisDate}
          interval={tickInterval(data.length)}
          tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }}
          axisLine={false}
          tickLine={false}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => v.toFixed(0)}
          width={36}
        />
        <Tooltip content={<DarkTooltip normalised={true} />} />
        <Legend
          formatter={(value) => tickerMap[value]?.name ?? value}
          wrapperStyle={{ fontSize: 11, color: AXIS_COLOR, paddingTop: 8 }}
        />
        {available.map(t => (
          <Line
            key={t}
            type="monotone"
            dataKey={t}
            name={tickerMap[t]?.name ?? t}
            stroke={COLOURS[t] ?? '#94a3b8'}
            strokeWidth={1.8}
            dot={false}
            connectNulls={true}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Ethanol bar chart ────────────────────────────────────────────────────────

function EthanolChart({ data }: { data: EthanolPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-sm">
        EIA data unavailable — check EIA_API_KEY
      </div>
    );
  }
  const avg = data.reduce((s, d) => s + d.production, 0) / data.length;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtAxisDate}
          interval={Math.floor(data.length / 5)}
          tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={['auto', 'auto']}
          tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v.toFixed(0)}
          width={40}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-panel border border-border rounded p-3 text-xs shadow-xl">
                <p className="text-text-dim mb-1">{fmtFullDate(label as string)}</p>
                <p className="text-text-primary font-mono">
                  {(payload[0].value as number)?.toFixed(2)} Mbbld
                </p>
                <p className="text-text-dim text-[10px] mt-1">
                  Avg: {avg.toFixed(2)} Mbbld
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="production" fill="#60a5fa" radius={[2, 2, 0, 0]} name="Production (Mbbld)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Market bias history ──────────────────────────────────────────────────────

function BiasHistory({ history }: { history: BiasPoint[] }) {
  if (history.length === 0) {
    return <p className="text-text-dim text-sm text-center py-4">No report history yet.</p>;
  }

  const styles: Record<string, string> = {
    bullish: 'bg-positive/15 text-positive border border-positive/30',
    bearish: 'bg-negative/15 text-negative border border-negative/30',
    neutral: 'bg-border/60 text-text-dim border border-border',
  };

  return (
    <div className="flex flex-wrap gap-2">
      {history.map((h, idx) => (
        <div key={idx} className="flex flex-col items-center gap-1">
          <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide ${styles[h.bias]}`}>
            {h.bias}
          </span>
          <span className="text-text-dim text-[10px]">{fmtAxisDate(h.date)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── EUR/USD line chart ──────────────────────────────────────────────────────

function EurUsdChart({ data }: { data: EurUsdPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-sm">
        ECB data unavailable
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtAxisDate}
          interval={tickInterval(data.length)}
          tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }}
          axisLine={false}
          tickLine={false}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => v.toFixed(4)}
          width={52}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-panel border border-border rounded p-3 text-xs shadow-xl">
                <p className="text-text-dim mb-1">{fmtFullDate(label as string)}</p>
                <p className="text-text-primary font-mono font-bold">
                  {(payload[0].value as number)?.toFixed(4)}
                </p>
              </div>
            );
          }}
        />
        <Line type="monotone" dataKey="rate" stroke="#a78bfa" strokeWidth={2} dot={false} name="EUR/USD" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Petroleum line chart ────────────────────────────────────────────────────

function PetroleumChart({ data, unit, color }: { data: { date: string; value: number }[]; unit: string; color: string }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-sm">
        EIA data unavailable — check EIA_API_KEY
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtAxisDate}
          interval={tickInterval(data.length)}
          tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }}
          axisLine={false}
          tickLine={false}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
          width={44}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-panel border border-border rounded p-3 text-xs shadow-xl">
                <p className="text-text-dim mb-1">{fmtFullDate(label as string)}</p>
                <p className="text-text-primary font-mono font-bold">
                  {(payload[0].value as number)?.toLocaleString()} {unit}
                </p>
              </div>
            );
          }}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Mandate progress bars ────────────────────────────────────────────────────

interface MandateItem {
  label: string;
  detail: string;
  start: Date;
  end: Date;
  note: string;
}

const MANDATES: MandateItem[] = [
  {
    label: 'Germany THG-Quote 2026',
    detail: 'Annual blending obligation — Jan 1 → Dec 31',
    start: new Date('2026-01-01'),
    end:   new Date('2026-12-31'),
    note:  'Q2 compliance buying accelerates from April. Late-year rush historically peaks Sep–Nov.',
  },
  {
    label: 'UK RTFO Year 17',
    detail: 'Obligation year Apr 1 2026 → Mar 31 2027',
    start: new Date('2026-04-01'),
    end:   new Date('2027-03-31'),
    note:  'Year 16 ended Mar 31 2026. Year 17 now active. HVO and UCOME both eligible.',
  },
  {
    label: 'EU RED III Transport 2026',
    detail: '14.5% GHG / 5.5% advanced biofuels — Jan 1 → Dec 31',
    start: new Date('2026-01-01'),
    end:   new Date('2026-12-31'),
    note:  'Advanced biofuels sub-target drives premium for UCO, tallow, POME-based fuels.',
  },
  {
    label: 'ReFuelEU Aviation 2026',
    detail: '2% SAF blending mandate — Jan 1 → Dec 31',
    start: new Date('2026-01-01'),
    end:   new Date('2026-12-31'),
    note:  'HEFA pathway dominant. Synthetic fuels sub-mandate starts at 0.7% from 2030.',
  },
];

function MandateProgressBar({ item }: { item: MandateItem }) {
  const pct = mandateProgress(item.start, item.end);
  const isLate = pct >= 75;
  const barColor = pct >= 90 ? 'bg-negative' : pct >= 60 ? 'bg-accent' : 'bg-positive';

  return (
    <div className="pb-4 border-b border-border/40 last:border-0 last:pb-0">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-text-primary text-sm font-semibold">{item.label}</span>
        <span className={`text-xs font-bold tabular-nums ${pct >= 90 ? 'text-negative' : pct >= 60 ? 'text-accent' : 'text-positive'}`}>
          {pct}%
        </span>
      </div>
      <p className="text-text-dim text-xs mb-2">{item.detail}</p>
      <div className="w-full bg-surface rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-text-dim text-xs italic">
        {isLate && <span className="text-accent font-semibold not-italic">⚑ </span>}
        {item.note}
      </p>
    </div>
  );
}

// ─── Time range selector ──────────────────────────────────────────────────────

function RangeBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${
        active
          ? 'bg-accent text-surface'
          : 'bg-card border border-border text-text-secondary hover:text-text-primary hover:border-accent/50'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Feedstock USD/MT chart ──────────────────────────────────────────────────

function FeedstockUsdChart({ data, color }: { data: PricePoint[]; color: string }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-text-dim text-sm">No data available</div>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtAxisDate} interval={tickInterval(data.length)} tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }} axisLine={false} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)} width={48} />
        <Tooltip content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <div className="bg-panel border border-border rounded p-3 text-xs shadow-xl">
              <p className="text-text-dim mb-1">{fmtFullDate(label as string)}</p>
              <p className="text-text-primary font-mono font-bold">${(payload[0].value as number)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /MT</p>
            </div>
          );
        }} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── COT Net Spec bar chart ─────────────────────────────────────────────────

function CotNetSpecChart({ data, commodities }: { data: CotData | null; commodities: { key: keyof Omit<CotData, 'source'>; label: string; color: string }[] }) {
  if (!data) return <div className="flex items-center justify-center h-full text-text-dim text-sm">No data available</div>;

  // Build merged data by report_date
  const dateSet = new Set<string>();
  for (const c of commodities) {
    for (const entry of (data[c.key] as CotEntry[])) {
      dateSet.add(entry.report_date);
    }
  }
  const dates = Array.from(dateSet).sort();

  const chartData = dates.map(d => {
    const row: Record<string, string | number> = { date: d };
    for (const c of commodities) {
      const entry = (data[c.key] as CotEntry[]).find(e => e.report_date === d);
      if (entry) row[c.key] = entry.net_spec;
    }
    return row;
  });

  if (chartData.length === 0) return <div className="flex items-center justify-center h-full text-text-dim text-sm">No data available</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtAxisDate} interval={Math.max(1, Math.floor(chartData.length / 6))} tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v < -1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={44} />
        <Tooltip content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <div className="bg-panel border border-border rounded p-3 text-xs shadow-xl min-w-[180px]">
              <p className="text-text-dim mb-2 font-semibold">{fmtFullDate(label as string)}</p>
              {payload.map((entry: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-4 mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
                    <span className="text-text-secondary">{entry.name}</span>
                  </div>
                  <span className={`font-mono ${(entry.value as number) >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {(entry.value as number)?.toLocaleString()} contracts
                  </span>
                </div>
              ))}
            </div>
          );
        }} />
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS_COLOR, paddingTop: 8 }} />
        {commodities.map(c => (
          <Bar key={c.key} dataKey={c.key} name={c.label} fill={c.color} radius={[2, 2, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Weather chart (ComposedChart with temp lines + precip bars) ─────────────

function WeatherChart({ region }: { region: WeatherRegion | undefined }) {
  if (!region?.data?.length) return <div className="flex items-center justify-center h-full text-text-dim text-sm">No data available</div>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={region.data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtAxisDate} interval={tickInterval(region.data.length)} tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="temp" tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }} axisLine={false} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v: number) => `${v}\u00B0`} width={36} />
        <YAxis yAxisId="precip" orientation="right" tick={{ fill: AXIS_COLOR, fontSize: CHART_FONT }} axisLine={false} tickLine={false} domain={[0, 'auto']} tickFormatter={(v: number) => `${v}`} width={32} />
        <Tooltip content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <div className="bg-panel border border-border rounded p-3 text-xs shadow-xl">
              <p className="text-text-dim mb-1">{fmtFullDate(label as string)}</p>
              {payload.map((e: any, i: number) => (
                <p key={i} className="text-text-primary"><span style={{ color: e.color }}>{e.name}</span>: {(e.value as number)?.toFixed(1)}{e.dataKey === 'precipitation' ? ' mm' : '\u00B0C'}</p>
              ))}
            </div>
          );
        }} />
        <Bar yAxisId="precip" dataKey="precipitation" fill="#38bdf8" opacity={0.3} name="Precip (mm)" />
        <Line yAxisId="temp" type="monotone" dataKey="temp_max" stroke="#f87171" strokeWidth={1.5} dot={false} name="Max \u00B0C" />
        <Line yAxisId="temp" type="monotone" dataKey="temp_min" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="Min \u00B0C" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Main Charts component ────────────────────────────────────────────────────

export default function Charts() {
  const [days, setDays] = useState<30 | 60 | 90>(90);
  const [tickerMap, setTickerMap]     = useState<Record<string, TickerInfo>>({});
  const [ethanol, setEthanol]         = useState<EthanolPoint[]>([]);
  const [sentiment, setSentiment]     = useState<BiasPoint[]>([]);
  const [eurusd, setEurusd]             = useState<EurUsdPoint[]>([]);
  const [petroleum, setPetroleum]       = useState<PetroleumData | null>(null);
  const [cot, setCot]                   = useState<CotData | null>(null);
  const [weather, setWeather]           = useState<WeatherData | null>(null);
  const [fred, setFred]                 = useState<FredData | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [loadingOther, setLoadingOther]   = useState(true);
  const [error, setError]             = useState('');

  const eurUsdRate = eurusd.length > 0 ? eurusd[eurusd.length - 1].rate : 1.08;

  // Fetch price history whenever 'days' changes
  useEffect(() => {
    const load = async () => {
      setLoadingPrices(true);
      setError('');
      try {
        const [priceRes, eurusdRes] = await Promise.all([
          fetch(`${API_BASE_URL}/charts/prices?days=${days}`, { headers: { 'X-API-Key': API_KEY } }),
          fetch(`${API_BASE_URL}/charts/eurusd?days=${days}`, { headers: { 'X-API-Key': API_KEY } }),
        ]);
        if (!priceRes.ok) throw new Error(`HTTP ${priceRes.status}`);
        const json = await priceRes.json() as { tickers: Record<string, TickerInfo> };
        setTickerMap(json.tickers);
        if (eurusdRes.ok) {
          const j = await eurusdRes.json() as { history: EurUsdPoint[] };
          setEurusd(j.history);
        }
      } catch (e) {
        setError('Failed to load price history — please refresh.');
      } finally {
        setLoadingPrices(false);
      }
    };
    void load();
  }, [days]);

  // Fetch ethanol + sentiment once on mount
  useEffect(() => {
    const load = async () => {
      setLoadingOther(true);
      try {
        const [ethRes, sentRes, petRes, cotRes, weatherRes, fredRes] = await Promise.all([
          fetch(`${API_BASE_URL}/charts/ethanol`, { headers: { 'X-API-Key': API_KEY } }),
          fetch(`${API_BASE_URL}/charts/sentiment`, { headers: { 'X-API-Key': API_KEY } }),
          fetch(`${API_BASE_URL}/charts/petroleum`, { headers: { 'X-API-Key': API_KEY } }),
          fetch(`${API_BASE_URL}/charts/cot`, { headers: { 'X-API-Key': API_KEY } }),
          fetch(`${API_BASE_URL}/charts/weather`, { headers: { 'X-API-Key': API_KEY } }),
          fetch(`${API_BASE_URL}/charts/fred`, { headers: { 'X-API-Key': API_KEY } }),
        ]);
        if (ethRes.ok) {
          const j = await ethRes.json() as { history: EthanolPoint[] };
          setEthanol(j.history);
        }
        if (sentRes.ok) {
          const j = await sentRes.json() as { history: BiasPoint[] };
          setSentiment(j.history);
        }
        if (petRes.ok) {
          const j = await petRes.json() as PetroleumData;
          setPetroleum(j);
        }
        if (cotRes.ok) {
          const j = await cotRes.json() as CotData;
          setCot(j);
        }
        if (weatherRes.ok) {
          const j = await weatherRes.json() as WeatherData;
          setWeather(j);
        }
        if (fredRes.ok) {
          const j = await fredRes.json() as FredData;
          setFred(j);
        }
      } finally {
        setLoadingOther(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <p className="text-text-dim text-xs tracking-widest uppercase mb-0.5">Market Intelligence</p>
          <h2 className="text-text-primary font-semibold text-sm uppercase tracking-wide">Commodity Charts</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-dim text-xs mr-1">Range:</span>
          {([30, 60, 90] as const).map(d => (
            <RangeBtn key={d} label={`${d}d`} active={days === d} onClick={() => setDays(d)} />
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded px-4 py-3 text-sm text-negative">
          {error}
        </div>
      )}

      <p className="text-text-dim text-xs">
        All prices sourced via Yahoo Finance (yfinance) — 15-min delayed. Indexed charts use base-100
        so series with different units can be compared. Unavailable tickers are hidden automatically.
      </p>

      {loadingPrices ? (
        <div className="py-16"><Spinner /></div>
      ) : (
        <>
          {/* ================================================================
              🔥 DAILY SNAPSHOT — the absolute essentials, 4 compact cards
              ================================================================ */}
          <div className="pt-3 pb-1 border-b" style={{ borderColor: '#ef444455' }}>
            <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: '#f87171' }}>🔥 Daily Snapshot</h2>
            <p className="text-text-dim text-xs mt-0.5">The essentials — check these first every morning</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Gasoil–Brent Crack Spread" subtitle={`Diesel refinery margin — USD/MT, ${days}-day`} height={260}>
              <FeedstockUsdChart
                data={computeCrackSpread(tickerMap['HO=F']?.data ?? [], tickerMap['BZ=F']?.data ?? [])}
                color="#f87171"
              />
            </ChartCard>
            <ChartCard title="Energy Benchmarks" subtitle={`Brent · WTI · Gasoil · Nat Gas — base-100, ${days}-day`} height={260}>
              <MultiLineChart tickers={ENERGY_TICKERS} tickerMap={tickerMap} />
            </ChartCard>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Feedstock Benchmarks" subtitle={`Soy Oil · Rapeseed — base-100, ${days}-day`} height={260}>
              <MultiLineChart tickers={FEEDSTOCK_INDEX_TICKERS} tickerMap={tickerMap} />
            </ChartCard>
            <ChartCard title="EUR/USD" subtitle={`Daily spot rate — ECB, ${days}-day`} height={260}>
              <EurUsdChart data={eurusd} />
            </ChartCard>
          </div>

          {/* ================================================================
              SECTION 1 — GASOIL & PETROLEUM FUNDAMENTALS
              ================================================================ */}
          <div className="pt-6 pb-1 border-b border-accent/30">
            <h2 className="text-accent font-bold text-sm uppercase tracking-widest">⛽ Gasoil & Petroleum Fundamentals</h2>
            <p className="text-text-dim text-xs mt-0.5">Crude, distillates, refinery dynamics — drives LS Gasoil pricing</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Distillate Fuel Oil Stocks" subtitle="US commercial distillate stocks — thousand bbl (weekly)" height={280}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <PetroleumChart data={petroleum?.distillate_stocks ?? []} unit="k bbl" color="#fbbf24" />}
            </ChartCard>
            <ChartCard title="Crude Oil Inventories" subtitle="US commercial stocks excl. SPR — k bbl (weekly)" height={280}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <PetroleumChart data={petroleum?.inventories ?? []} unit="k bbl" color="#60a5fa" />}
            </ChartCard>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Gasoline Stocks" subtitle="US commercial gasoline stocks — k bbl (weekly)" height={280}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <PetroleumChart data={petroleum?.gasoline_stocks ?? []} unit="k bbl" color="#34d399" />}
            </ChartCard>
            <ChartCard title="Jet Fuel Stocks" subtitle="US commercial jet fuel stocks — k bbl (weekly) — SAF signal" height={280}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <PetroleumChart data={petroleum?.jet_fuel_stocks ?? []} unit="k bbl" color="#06b6d4" />}
            </ChartCard>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Refinery Crude Oil Runs" subtitle="US refiner net input — k bbl/day (weekly)" height={280}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <PetroleumChart data={petroleum?.refinery_runs ?? []} unit="k bbl/d" color="#f59e0b" />}
            </ChartCard>
            <ChartCard title="Crude Oil Imports" subtitle="US weekly imports — k bbl/day" height={280}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <PetroleumChart data={petroleum?.imports ?? []} unit="k bbl/d" color="#f87171" />}
            </ChartCard>
          </div>

          <ChartCard
            title="Heating Oil — Net Speculative Positioning"
            subtitle="CFTC non-commercial long minus short (contracts) — weekly"
            height={280}
          >
            {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : (
              <CotNetSpecChart data={cot} commodities={[{ key: 'heating_oil', label: 'Heating Oil / ULSD', color: '#60a5fa' }]} />
            )}
          </ChartCard>

          {/* ================================================================
              SECTION 2 — BIODIESEL FEEDSTOCKS
              ================================================================ */}
          <div className="pt-6 pb-1 border-b border-positive/30">
            <h2 className="text-positive font-bold text-sm uppercase tracking-widest">🌾 Biodiesel Feedstocks</h2>
            <p className="text-text-dim text-xs mt-0.5">Soy oil, rapeseed, canola — drives FAME0, RME, SME, UCOME pricing</p>
          </div>

          <ChartCard
            title="Biodiesel Feedstock Comparison"
            subtitle={`Soybean Oil · Soybeans · Rapeseed — base-100 indexed, ${days}-day`}
            height={300}
          >
            <MultiLineChart tickers={['ZL=F', 'ZS=F', 'GNF=F']} tickerMap={tickerMap} />
          </ChartCard>

          <ChartCard title="Soybean Oil (CBOT)" subtitle={`USD/MT — ${days}-day — primary FAME0 feedstock`} height={280}>
            <FeedstockUsdChart data={tickerMap['ZL=F']?.data?.length > 0 ? toUsdPerMt(tickerMap['ZL=F'].data, USD_MT_FACTORS['ZL=F']) : []} color="#e879f9" />
          </ChartCard>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Soybeans (CBOT)" subtitle={`USD/MT — ${days}-day — SME/FAME0 feedstock`} height={280}>
              <FeedstockUsdChart data={tickerMap['ZS=F']?.data?.length > 0 ? toUsdPerMt(tickerMap['ZS=F'].data, USD_MT_FACTORS['ZS=F']) : []} color="#34d399" />
            </ChartCard>
            <ChartCard title="Rapeseed (Euronext)" subtitle={`USD/MT — ${days}-day — European RME feedstock`} height={280}>
              <FeedstockUsdChart data={tickerMap['GNF=F']?.data?.length > 0 ? tickerMap['GNF=F'].data.map(p => ({ date: p.date, value: parseFloat((p.value * eurUsdRate).toFixed(2)) })) : []} color="#22d3ee" />
            </ChartCard>
          </div>

          <ChartCard
            title="Biodiesel Feedstocks — Net Speculative Positioning"
            subtitle="CFTC non-commercial long minus short (contracts) — weekly"
            height={300}
          >
            {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : (
              <CotNetSpecChart data={cot} commodities={[
                { key: 'soybeans', label: 'Soybeans', color: '#34d399' },
                { key: 'soybean_oil', label: 'Soybean Oil', color: '#e879f9' },
              ]} />
            )}
          </ChartCard>

          {/* ================================================================
              SECTION 3 — ADVANCED BIOFUELS (HVO, SAF, Ethanol)
              ================================================================ */}
          <div className="pt-6 pb-1 border-b" style={{ borderColor: '#22d3ee33' }}>
            <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: '#22d3ee' }}>🛫 Advanced Biofuels (HVO, SAF, Ethanol)</h2>
            <p className="text-text-dim text-xs mt-0.5">Corn and ethanol — drives HVO, SAF, EthanolT2 pricing</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Corn (CBOT)" subtitle={`USD/MT — ${days}-day — ethanol feedstock`} height={280}>
              <FeedstockUsdChart data={tickerMap['ZC=F']?.data?.length > 0 ? toUsdPerMt(tickerMap['ZC=F'].data, USD_MT_FACTORS['ZC=F']) : []} color="#f87171" />
            </ChartCard>
            <ChartCard title="US Ethanol Production" subtitle="Weekly output (k bbl/day) — EIA" height={280}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <EthanolChart data={ethanol} />}
            </ChartCard>
          </div>

          <ChartCard
            title="Corn — Net Speculative Positioning"
            subtitle="CFTC non-commercial long minus short (contracts) — weekly"
            height={280}
          >
            {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : (
              <CotNetSpecChart data={cot} commodities={[{ key: 'corn', label: 'Corn', color: '#f87171' }]} />
            )}
          </ChartCard>

          {/* ================================================================
              SECTION 4 — GROWING REGION WEATHER (all weather unified)
              ================================================================ */}
          <div className="pt-6 pb-1 border-b" style={{ borderColor: '#10b98155' }}>
            <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: '#10b981' }}>🌾 Growing Region Weather</h2>
            <p className="text-text-dim text-xs mt-0.5">Temperature and precipitation in key feedstock regions — forward supply signal</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Brazil (Mato Grosso) — Soybean #1" subtitle="World's largest soybean producer" height={260}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <WeatherChart region={weather?.brazil} />}
            </ChartCard>
            <ChartCard title="US Midwest (Iowa) — Soybean #2" subtitle="Main US soybean belt" height={260}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <WeatherChart region={weather?.us_midwest} />}
            </ChartCard>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Argentina (Pampas) — Soy / Corn" subtitle="Major soybean and corn producer" height={260}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <WeatherChart region={weather?.argentina} />}
            </ChartCard>
            <ChartCard title="Northern France — Rapeseed" subtitle="Key EU rapeseed region" height={260}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <WeatherChart region={weather?.eu_france} />}
            </ChartCard>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Canada (Saskatchewan) — Canola" subtitle="World's largest canola exporter" height={260}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <WeatherChart region={weather?.canada} />}
            </ChartCard>
            <ChartCard title="Indonesia (Sumatra) — Palm #1" subtitle="World's largest palm oil producer" height={260}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <WeatherChart region={weather?.indonesia} />}
            </ChartCard>
          </div>

          <ChartCard title="Malaysia — Palm Oil #2" subtitle="Second-largest palm oil producer" height={260}>
            {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <WeatherChart region={weather?.malaysia} />}
          </ChartCard>

          {/* ================================================================
              SECTION 5 — FX, RATES & MACRO
              ================================================================ */}
          <div className="pt-6 pb-1 border-b border-[#a78bfa]/30">
            <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: '#a78bfa' }}>💱 FX, Rates & Macro</h2>
            <p className="text-text-dim text-xs mt-0.5">Currency, interest rates, economic indicators — background context</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="FX Impact" subtitle={`EUR/USD · USD/CNY — base-100 indexed, ${days}-day`} height={260}>
              <MultiLineChart tickers={FX_TICKERS} tickerMap={tickerMap} />
            </ChartCard>
            <ChartCard title="US Dollar Index" subtitle="Trade-weighted broad dollar — FRED" height={260}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <PetroleumChart data={fred?.dollar_index ?? []} unit="" color="#a78bfa" />}
            </ChartCard>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Federal Funds Rate" subtitle="US effective rate (%) — commodity financing" height={260}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <PetroleumChart data={fred?.fed_funds_rate ?? []} unit="%" color="#60a5fa" />}
            </ChartCard>
            <ChartCard title="ECB Deposit Facility Rate" subtitle="ECB rate (%) — EUR financing cost" height={260}>
              {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <PetroleumChart data={fred?.ecb_deposit_rate ?? []} unit="%" color="#a78bfa" />}
            </ChartCard>
          </div>

          <ChartCard title="Yield Curve (10Y-2Y)" subtitle="US Treasury spread — recession signal" height={260}>
            {loadingOther ? <div className="flex items-center justify-center h-full"><Spinner /></div> : <PetroleumChart data={fred?.yield_curve ?? []} unit="%" color="#f87171" />}
          </ChartCard>

          {/* ================================================================
              SECTION 6 — MARKET BIAS & MANDATES (strategic context)
              ================================================================ */}
          <div className="pt-6 pb-1 border-b border-border">
            <h2 className="text-text-dim font-bold text-sm uppercase tracking-widest">📅 Market Bias & Mandates</h2>
            <p className="text-text-dim text-xs mt-0.5">Strategic context — checked weekly, not daily</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-4">
                Short-Term Market Bias — Recent Reports
              </h3>
              {loadingOther ? <Spinner /> : <BiasHistory history={sentiment} />}
              {!loadingOther && sentiment.length === 0 && (
                <p className="text-text-dim text-xs italic mt-2">
                  Reports will appear here once the daily pipeline has run.
                </p>
              )}
            </div>
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-4">
                Annual Blending Obligation Progress
              </h3>
              <div className="space-y-4">
                {MANDATES.map((m, i) => (
                  <MandateProgressBar key={i} item={m} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
