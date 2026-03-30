import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar,
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

// ─── Colour palette (visible on dark bg) ─────────────────────────────────────

const COLOURS: Record<string, string> = {
  'ZL=F':     '#f59e0b',   // Soybean Oil   — amber
  'ZS=F':     '#34d399',   // Soybeans      — emerald
  'ZC=F':     '#fb923c',   // Corn          — orange
  'BZ=F':     '#60a5fa',   // Brent         — blue
  'HO=F':     '#fbbf24',   // Heating Oil   — yellow (gasoil proxy)
  'NG=F':     '#f87171',   // Natural Gas   — red
  'EURUSD=X': '#a78bfa',   // EUR/USD       — violet
  'USDCNY=X': '#f472b6',   // USD/CNY       — pink
};

// ─── Chart groups ─────────────────────────────────────────────────────────────

const FEEDSTOCK_TICKERS = ['ZL=F', 'ZS=F', 'ZC=F'];
const ENERGY_TICKERS    = ['BZ=F', 'HO=F', 'NG=F'];
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
  return (
    <div className="bg-card border border-border rounded">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-text-primary font-semibold text-sm">{title}</h3>
        {subtitle && <p className="text-text-dim text-xs mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-4" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

// ─── Normalised multi-line chart ──────────────────────────────────────────────

function MultiLineChart({
  tickers,
  tickerMap,
  height = 240,
}: {
  tickers: string[];
  tickerMap: Record<string, TickerInfo>;
  height?: number;
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
    <ResponsiveContainer width="100%" height={height}>
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

// ─── Main Charts component ────────────────────────────────────────────────────

export default function Charts() {
  const [days, setDays] = useState<30 | 60 | 90>(90);
  const [tickerMap, setTickerMap]     = useState<Record<string, TickerInfo>>({});
  const [ethanol, setEthanol]         = useState<EthanolPoint[]>([]);
  const [sentiment, setSentiment]     = useState<BiasPoint[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [loadingOther, setLoadingOther]   = useState(true);
  const [error, setError]             = useState('');

  // Fetch price history whenever 'days' changes
  useEffect(() => {
    const load = async () => {
      setLoadingPrices(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE_URL}/charts/prices?days=${days}`, {
          headers: { 'X-API-Key': API_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { tickers: Record<string, TickerInfo> };
        setTickerMap(json.tickers);
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
        const [ethRes, sentRes] = await Promise.all([
          fetch(`${API_BASE_URL}/charts/ethanol`, { headers: { 'X-API-Key': API_KEY } }),
          fetch(`${API_BASE_URL}/charts/sentiment`, { headers: { 'X-API-Key': API_KEY } }),
        ]);
        if (ethRes.ok) {
          const j = await ethRes.json() as { history: EthanolPoint[] };
          setEthanol(j.history);
        }
        if (sentRes.ok) {
          const j = await sentRes.json() as { history: BiasPoint[] };
          setSentiment(j.history);
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
        All prices sourced via Yahoo Finance (yfinance) — 15-min delayed. Charts show base-100 indexed values
        so series with different units can be compared on a single axis. Unavailable tickers are hidden automatically.
      </p>

      {loadingPrices ? (
        <div className="py-16"><Spinner /></div>
      ) : (
        <>
          {/* ── 1. Biofuel Feedstock Costs ────────────────────────────────── */}
          <ChartCard
            title="Biofuel Feedstock Costs"
            subtitle={`Soybean Oil · Soybeans · Corn — base-100 indexed, ${days}-day`}
            height={300}
          >
            <MultiLineChart tickers={FEEDSTOCK_TICKERS} tickerMap={tickerMap} height={260} />
          </ChartCard>

          {/* ── 2. Energy & Blending Economics ───────────────────────────── */}
          <ChartCard
            title="Energy & Blending Economics"
            subtitle={`Brent Crude · Heating Oil (gasoil proxy) · Natural Gas — base-100 indexed, ${days}-day`}
            height={300}
          >
            <MultiLineChart tickers={ENERGY_TICKERS} tickerMap={tickerMap} height={260} />
          </ChartCard>

          {/* ── 3. FX + 4. Ethanol  (side by side) ───────────────────────── */}
          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard
              title="FX Impact"
              subtitle={`EUR/USD · USD/CNY — base-100 indexed, ${days}-day`}
              height={280}
            >
              <MultiLineChart tickers={FX_TICKERS} tickerMap={tickerMap} height={230} />
            </ChartCard>

            <ChartCard
              title="US Ethanol Production"
              subtitle="Weekly output (thousand barrels/day) — EIA Open Data"
              height={280}
            >
              {loadingOther ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner />
                </div>
              ) : (
                <EthanolChart data={ethanol} />
              )}
            </ChartCard>
          </div>

          {/* ── 5. Bias History + 6. Mandate Calendar (side by side) ──────── */}
          <div className="grid gap-5 md:grid-cols-2">

            {/* Market Bias History */}
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

            {/* Mandate Calendar */}
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
