import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { API_BASE_URL, API_KEY } from '../config';
import Spinner from './Spinner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecapRow {
  product: string;
  delivery: string;
  total_lots: number;
  num_trades: number;
  high_diff: number | null;
  low_diff: number | null;
  flat_price_high: number | null;
  flat_price_low: number | null;
}

interface PerProductTotals {
  product: string;
  total_lots: number;
  num_trades: number;
  deliveries: string[];
  high_diff: number | null;
  low_diff: number | null;
  flat_price_high: number | null;
  flat_price_low: number | null;
}

interface TimeSpread {
  spread_id: string;
  product: string;
  leg1: string; leg1_price: number;
  leg2: string; leg2_price: number;
  spread_value: number;
  lots: number;
  time: string;
}

interface ProductSpreadLeg { product: string; delivery: string; price: number; lots: number; }

interface ProductSpread {
  spread_id: string;
  delivery: string;
  legs: ProductSpreadLeg[];
  lots: number;
  time: string;
}

interface SettlementSeriesPoint {
  date: string;
  front_month_settle: number | null;
  total_volume: number;
  total_oi: number;
}

interface SettlementProductAgg {
  product_code: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  change: number | null;
  total_volume: number;
  oi_start: number | null;
  oi_end: number | null;
  oi_delta: number | null;
  series: SettlementSeriesPoint[];
}

interface PeriodReportPayload {
  start: string;
  end: string;
  generated_at: string;
  trades: {
    start: string; end: string;
    trading_days_with_data: string[];
    trading_days_count: number;
    by_product: PerProductTotals[];
    by_product_delivery: RecapRow[];
    spreads_analysis: {
      time_spreads: TimeSpread[];
      product_spreads: ProductSpread[];
      flat_time_spreads?: TimeSpread[];
    };
    total_volume: number;
    total_trades: number;
    diff_trade_count: number;
    flat_trade_count: number;
    diff_spread_trade_count: number;
    flat_spread_trade_count: number;
    outright_volume: number;
    spread_volume: number;
    time_spread_volume: number;
    product_spread_volume: number;
    flat_spread_volume: number;
    flat_volume: number;
  };
  settlements: {
    by_product: SettlementProductAgg[];
    gasoil: SettlementProductAgg | null;
  };
}

// ─── Product mapping ────────────────────────────────────────────────────────

const PRODUCT_COLORS: Record<string, string> = {
  FAME0: '#10b981', RME: '#f59e0b', UCOME: '#ef4444', HVO: '#8b5cf6', SAF: '#06b6d4',
  GASOIL: '#6366f1',
};

// ICE PDF code → display name
const PDF_CODE_TO_NAME: Record<string, string> = {
  BFZ: 'FAME0', UCR: 'UCOME', BRI: 'RME', HVO: 'HVO', ZAF: 'SAF', GASOIL: 'LS Gasoil',
};

const PDF_CODE_TO_COLOR: Record<string, string> = {
  BFZ: '#10b981', UCR: '#ef4444', BRI: '#f59e0b', HVO: '#8b5cf6', ZAF: '#06b6d4',
  GASOIL: '#6366f1',
};

// ─── Date helpers ───────────────────────────────────────────────────────────

function fmtDateLong(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function fmtDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

// ─── Compact aggregation (re-used pattern from BiodieselTradesPanel) ────────

interface CompactTimeSpread {
  product: string;
  leg1: string; leg2: string;
  leg1High: number; leg1Low: number; leg1VWAP: number;
  leg2High: number; leg2Low: number; leg2VWAP: number;
  spreadHigh: number; spreadLow: number; spreadVWAP: number;
  lots: number;
  count: number;
}

function aggregateTimeSpreads(rows: TimeSpread[]): CompactTimeSpread[] {
  const groups = new Map<string, TimeSpread[]>();
  for (const r of rows) {
    const k = `${r.product}|${r.leg1}|${r.leg2}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const out: CompactTimeSpread[] = [];
  for (const rs of groups.values()) {
    const totalLots = rs.reduce((s, r) => s + r.lots, 0);
    const wsum = (f: (r: TimeSpread) => number) =>
      totalLots > 0 ? rs.reduce((s, r) => s + f(r) * r.lots, 0) / totalLots : 0;
    out.push({
      product: rs[0].product, leg1: rs[0].leg1, leg2: rs[0].leg2,
      leg1High: Math.max(...rs.map(r => r.leg1_price)),
      leg1Low: Math.min(...rs.map(r => r.leg1_price)),
      leg1VWAP: wsum(r => r.leg1_price),
      leg2High: Math.max(...rs.map(r => r.leg2_price)),
      leg2Low: Math.min(...rs.map(r => r.leg2_price)),
      leg2VWAP: wsum(r => r.leg2_price),
      spreadHigh: Math.max(...rs.map(r => r.spread_value)),
      spreadLow: Math.min(...rs.map(r => r.spread_value)),
      spreadVWAP: wsum(r => r.spread_value),
      lots: totalLots,
      count: rs.length,
    });
  }
  return out.sort((a, b) => b.lots - a.lots);
}

// ─── Small UI atoms ─────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded p-4 flex flex-col gap-1">
      <span className="text-text-dim text-xs uppercase tracking-widest">{label}</span>
      <span className="text-text-primary text-xl font-bold font-mono">{value}</span>
      {sub && <span className="text-text-dim text-xs">{sub}</span>}
    </div>
  );
}

function ViewToggle({ mode, setMode }: { mode: 'compact' | 'detailed'; setMode: (m: 'compact' | 'detailed') => void }) {
  const btn = (v: 'compact' | 'detailed', label: string) => (
    <button
      onClick={() => setMode(v)}
      className={`px-2 py-0.5 text-[10px] uppercase tracking-widest rounded transition-colors ${
        mode === v ? 'bg-accent text-surface font-bold' : 'text-text-dim hover:text-text-primary'
      }`}
    >{label}</button>
  );
  return (
    <div data-print-hide className="flex items-center gap-1 bg-surface border border-border rounded p-0.5">
      {btn('compact', 'Compact')}
      {btn('detailed', 'Detailed')}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

interface Props {
  /** Window length in days (5 / 10) or 'month' for previous-calendar-month. */
  windowKind: 'weekly' | 'biweekly' | 'monthly';
  /** Page heading (e.g. "Weekly Report"). */
  pageTitle: string;
  /** Subtitle under the heading. */
  subtitle?: string;
}

function defaultWindow(kind: 'weekly' | 'biweekly' | 'monthly'): { start: string; end: string } {
  const today = new Date();
  // Walk back to most recent Friday strictly before today (UTC).
  const dayOfWeek = today.getUTCDay(); // Sun=0...Sat=6
  // Map to Mon=0...Sun=6 like Python weekday
  const wd = (dayOfWeek + 6) % 7;
  let daysBack = (wd - 4 + 7) % 7;
  if (daysBack === 0) daysBack = 7; // Friday → previous Friday
  const friday = new Date(today);
  friday.setUTCDate(today.getUTCDate() - daysBack);
  const monday = new Date(friday);
  monday.setUTCDate(friday.getUTCDate() - 4);

  const iso = (d: Date) => d.toISOString().slice(0, 10);

  if (kind === 'weekly') return { start: iso(monday), end: iso(friday) };
  if (kind === 'biweekly') {
    const monPrev = new Date(friday);
    monPrev.setUTCDate(friday.getUTCDate() - 11);
    return { start: iso(monPrev), end: iso(friday) };
  }
  // monthly: previous full calendar month
  const firstOfThis = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastOfPrev = new Date(firstOfThis);
  lastOfPrev.setUTCDate(0);
  const firstOfPrev = new Date(Date.UTC(lastOfPrev.getUTCFullYear(), lastOfPrev.getUTCMonth(), 1));
  return { start: iso(firstOfPrev), end: iso(lastOfPrev) };
}

export default function PeriodReport({ windowKind, pageTitle, subtitle }: Props) {
  const initial = useMemo(() => defaultWindow(windowKind), [windowKind]);
  const [start, setStart] = useState<string>(initial.start);
  const [end, setEnd] = useState<string>(initial.end);
  const [data, setData] = useState<PeriodReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [recapMode, setRecapMode] = useState<'compact' | 'detailed'>('detailed');
  const [diffTimeMode, setDiffTimeMode] = useState<'compact' | 'detailed'>('detailed');
  const [flatTimeMode, setFlatTimeMode] = useState<'compact' | 'detailed'>('detailed');

  const fetchData = useCallback(async (s: string, e: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/period-report?start=${s}&end=${e}`, {
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`HTTP ${res.status}: ${detail}`);
      }
      const json = await res.json() as PeriodReportPayload;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(start, end); }, [fetchData, start, end]);

  const shiftWindow = (direction: -1 | 1) => {
    if (!data) return;
    const s = new Date(start + 'T12:00:00Z');
    const e = new Date(end + 'T12:00:00Z');
    const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    const newStart = new Date(s);
    const newEnd = new Date(e);
    newStart.setUTCDate(s.getUTCDate() + direction * days);
    newEnd.setUTCDate(e.getUTCDate() + direction * days);
    setStart(newStart.toISOString().slice(0, 10));
    setEnd(newEnd.toISOString().slice(0, 10));
  };

  const resetToLatest = () => {
    const w = defaultWindow(windowKind);
    setStart(w.start);
    setEnd(w.end);
  };

  const t = data?.trades;
  const timeSpreads = t?.spreads_analysis?.time_spreads ?? [];
  const flatTimeSpreads = t?.spreads_analysis?.flat_time_spreads ?? [];
  const productSpreads = t?.spreads_analysis?.product_spreads ?? [];

  const timeSpreadsCompact = useMemo(() => aggregateTimeSpreads(timeSpreads), [timeSpreads]);
  const flatTimeSpreadsCompact = useMemo(() => aggregateTimeSpreads(flatTimeSpreads), [flatTimeSpreads]);
  const recapHasCompact = (t?.by_product?.length ?? 0) > 1;
  const diffTimeHasCompact = timeSpreadsCompact.length > 1;
  const flatTimeHasCompact = flatTimeSpreadsCompact.length > 1;
  const effectiveRecapMode = recapHasCompact ? recapMode : 'detailed';
  const effectiveDiffTimeMode = diffTimeHasCompact ? diffTimeMode : 'detailed';
  const effectiveFlatTimeMode = flatTimeHasCompact ? flatTimeMode : 'detailed';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b border-border">
        <div>
          <p className="text-text-dim text-xs tracking-widest uppercase mb-1">{pageTitle}</p>
          <h1 className="text-text-primary font-bold text-3xl mb-1">
            {data ? `${fmtDateLong(data.start)} — ${fmtDateLong(data.end)}` : 'Loading…'}
          </h1>
          {subtitle && <p className="text-text-dim text-xs">{subtitle}</p>}
          {data && (
            <p className="text-text-dim text-xs mt-1">
              {t?.trading_days_count ?? 0} day{t?.trading_days_count === 1 ? '' : 's'} with trade data
              {t?.trading_days_with_data?.length ? ` · ${t.trading_days_with_data.map(fmtDateShort).join(' · ')}` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2" data-print-hide>
          <button onClick={() => shiftWindow(-1)} className="bg-card border border-border text-text-secondary px-3 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 uppercase tracking-widest">← Previous</button>
          <button onClick={resetToLatest} className="bg-card border border-border text-text-secondary px-3 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 uppercase tracking-widest">Latest</button>
          <button onClick={() => shiftWindow(1)} className="bg-card border border-border text-text-secondary px-3 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 uppercase tracking-widest">Next →</button>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary" />
          <span className="text-text-dim self-center text-xs">→</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary" />
          <button onClick={() => window.print()} className="bg-card border border-border text-text-secondary px-3 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 uppercase tracking-widest">Download PDF</button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      )}

      {error && !loading && (
        <div className="bg-negative/10 border border-negative/30 rounded px-4 py-3 text-sm text-negative">
          Failed to load report: {error}
        </div>
      )}

      {data && !loading && t && (
        <>
          {/* ── Period totals ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Total Trades"
              value={t.total_trades.toLocaleString()}
              sub={`${t.diff_trade_count} Diffs · ${t.flat_trade_count} Flats · ${t.diff_spread_trade_count} Diff Spreads · ${t.flat_spread_trade_count} Flat Spreads`}
            />
            <MetricCard label="Diff Outright Volume" value={t.outright_volume.toLocaleString()} sub="lots (no spread)" />
            <MetricCard label="Time Spread Volume" value={(t.time_spread_volume ?? 0).toLocaleString()} sub="lots" />
            <MetricCard label="Product Spread Volume" value={(t.product_spread_volume ?? 0).toLocaleString()} sub="lots" />
            <MetricCard label="Flat Spread Volume" value={(t.flat_spread_volume ?? 0).toLocaleString()} sub="lots" />
            <MetricCard
              label="Total Volume"
              value={(t.outright_volume + (t.spread_volume ?? 0) + (t.flat_spread_volume ?? 0) + (t.flat_volume ?? 0)).toLocaleString()}
              sub="lots (outright + spreads + flat)"
            />
          </div>

          {/* ── Period Recap ──────────────────────────────────────────────── */}
          {t.by_product_delivery.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest">
                  Diff Swaps Recap — {recapHasCompact && effectiveRecapMode === 'compact' ? 'By Product' : 'By Product & Delivery'}
                </h3>
                {recapHasCompact && <ViewToggle mode={recapMode} setMode={setRecapMode} />}
              </div>
              {effectiveRecapMode === 'detailed' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                        <th className="text-left py-2 pr-3">Product</th>
                        <th className="text-left py-2 px-2">Delivery</th>
                        <th className="text-right py-2 px-2">Lots</th>
                        <th className="text-right py-2 px-2">Trades</th>
                        <th className="text-right py-2 px-2">High Diff</th>
                        <th className="text-right py-2 px-2">Low Diff</th>
                        <th className="text-right py-2 px-2">Flat High</th>
                        <th className="text-right py-2 pl-2">Flat Low</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.by_product_delivery.map((row) => {
                        const color = PRODUCT_COLORS[row.product] ?? '#888';
                        return (
                          <tr key={`${row.product}-${row.delivery}`} className="border-b border-border/50 hover:bg-surface/30">
                            <td className="py-2 pr-3 font-semibold" style={{ color }}>{row.product}</td>
                            <td className="py-2 px-2 text-text-primary">{row.delivery}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary font-semibold">{row.total_lots.toLocaleString()}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">{row.num_trades}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">{row.high_diff != null ? row.high_diff.toFixed(2) : '\u2014'}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">{row.low_diff != null ? row.low_diff.toFixed(2) : '\u2014'}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">{row.flat_price_high != null ? row.flat_price_high.toFixed(2) : '\u2014'}</td>
                            <td className="text-right py-2 pl-2 font-mono text-text-primary">{row.flat_price_low != null ? row.flat_price_low.toFixed(2) : '\u2014'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                        <th className="text-left py-2 pr-3">Product</th>
                        <th className="text-left py-2 px-2">Deliveries</th>
                        <th className="text-right py-2 px-2">Lots</th>
                        <th className="text-right py-2 px-2">Trades</th>
                        <th className="text-right py-2 px-2">High Diff</th>
                        <th className="text-right py-2 px-2">Low Diff</th>
                        <th className="text-right py-2 px-2">Flat High</th>
                        <th className="text-right py-2 pl-2">Flat Low</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.by_product.map((row) => {
                        const color = PRODUCT_COLORS[row.product] ?? '#888';
                        return (
                          <tr key={row.product} className="border-b border-border/50 hover:bg-surface/30">
                            <td className="py-2 pr-3 font-semibold" style={{ color }}>{row.product}</td>
                            <td className="py-2 px-2 text-text-primary text-xs">{row.deliveries.join(', ')}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary font-semibold">{row.total_lots.toLocaleString()}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">{row.num_trades}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">{row.high_diff != null ? row.high_diff.toFixed(2) : '\u2014'}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">{row.low_diff != null ? row.low_diff.toFixed(2) : '\u2014'}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">{row.flat_price_high != null ? row.flat_price_high.toFixed(2) : '\u2014'}</td>
                            <td className="text-right py-2 pl-2 font-mono text-text-primary">{row.flat_price_low != null ? row.flat_price_low.toFixed(2) : '\u2014'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Diff Time Spreads ────────────────────────────────────────── */}
          {timeSpreads.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest">Diff Time Spreads</h3>
                {diffTimeHasCompact && <ViewToggle mode={diffTimeMode} setMode={setDiffTimeMode} />}
              </div>
              {effectiveDiffTimeMode === 'detailed' ? (
                <SpreadsDetailedTable rows={timeSpreads} />
              ) : (
                <SpreadsCompactTable rows={timeSpreadsCompact} />
              )}
            </div>
          )}

          {/* ── Diff Product Spreads ─────────────────────────────────────── */}
          {productSpreads.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">Diff Product Spreads</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                      <th className="text-left py-2 pr-3">Delivery</th>
                      <th className="text-left py-2 px-2">Legs</th>
                      <th className="text-right py-2 px-2">Lots</th>
                      <th className="text-right py-2 pl-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSpreads.map((s, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface/30">
                        <td className="py-2 pr-3 text-text-primary">{s.delivery}</td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-2">
                            {s.legs.map((leg, j) => (
                              <span key={j} className="text-xs">
                                <span className="font-semibold" style={{ color: PRODUCT_COLORS[leg.product] ?? '#888' }}>{leg.product}</span>
                                {' '}{leg.delivery}{' '}
                                <span className="font-mono">{leg.lots}@{leg.price.toFixed(1)}</span>
                                {j < s.legs.length - 1 && <span className="text-text-dim mx-1">vs</span>}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="text-right py-2 px-2 font-mono text-text-primary">{s.lots}</td>
                        <td className="text-right py-2 pl-2 text-text-dim text-xs">{s.time.includes('|') ? s.time.split('|')[0] : s.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Flat Time Spreads ────────────────────────────────────────── */}
          {flatTimeSpreads.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest">Flat Time Spreads</h3>
                {flatTimeHasCompact && <ViewToggle mode={flatTimeMode} setMode={setFlatTimeMode} />}
              </div>
              {effectiveFlatTimeMode === 'detailed' ? (
                <SpreadsDetailedTable rows={flatTimeSpreads} />
              ) : (
                <SpreadsCompactTable rows={flatTimeSpreadsCompact} />
              )}
            </div>
          )}

          {/* ── ICE Settlement Summary (per-product OHLC + line chart) ──── */}
          {data.settlements.by_product.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                ICE Diff Settlements — Period Summary
              </h3>
              <SettlementsTable items={data.settlements.by_product} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                {data.settlements.by_product.map(p => (
                  <SettlementChart key={p.product_code} agg={p} />
                ))}
              </div>
            </div>
          )}

          {/* ── Gasoil Outright ──────────────────────────────────────────── */}
          {data.settlements.gasoil && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                LS Gasoil Outright — Period Summary
              </h3>
              <SettlementsTable items={[data.settlements.gasoil]} />
              <div className="mt-5">
                <SettlementChart agg={data.settlements.gasoil} />
              </div>
            </div>
          )}

          {/* Empty state if no trade data */}
          {t.trading_days_count === 0 && data.settlements.by_product.length === 0 && !data.settlements.gasoil && (
            <div className="bg-card border border-border rounded p-8 text-center text-text-dim text-sm">
              No data found for this period. Either no trade Excels or ICE PDFs were uploaded between {fmtDateLong(data.start)} and {fmtDateLong(data.end)}.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SpreadsDetailedTable({ rows }: { rows: TimeSpread[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
            <th className="text-left py-2 pr-3">Product</th>
            <th className="text-left py-2 px-2">Leg 1</th>
            <th className="text-right py-2 px-2">Price</th>
            <th className="text-left py-2 px-2">Leg 2</th>
            <th className="text-right py-2 px-2">Price</th>
            <th className="text-right py-2 px-2">Spread</th>
            <th className="text-right py-2 px-2">Lots</th>
            <th className="text-right py-2 pl-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const color = PRODUCT_COLORS[s.product] ?? '#888';
            const day = s.time.includes('|') ? s.time.split('|')[0] : '';
            return (
              <tr key={i} className="border-b border-border/50 hover:bg-surface/30">
                <td className="py-2 pr-3 font-semibold" style={{ color }}>{s.product}</td>
                <td className="py-2 px-2 text-text-primary">{s.leg1}</td>
                <td className="text-right py-2 px-2 font-mono text-text-primary">{s.leg1_price.toFixed(2)}</td>
                <td className="py-2 px-2 text-text-primary">{s.leg2}</td>
                <td className="text-right py-2 px-2 font-mono text-text-primary">{s.leg2_price.toFixed(2)}</td>
                <td className={`text-right py-2 px-2 font-mono font-semibold ${s.spread_value >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {s.spread_value >= 0 ? `+${s.spread_value.toFixed(2)}` : s.spread_value.toFixed(2)}
                </td>
                <td className="text-right py-2 px-2 font-mono text-text-primary">{s.lots}</td>
                <td className="text-right py-2 pl-2 text-text-dim text-xs">{day || '\u2014'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpreadsCompactTable({ rows }: { rows: CompactTimeSpread[] }) {
  const fmtSpread = (v: number) => v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
            <th className="text-left py-2 pr-3">Product</th>
            <th className="text-left py-2 px-2">Leg 1</th>
            <th className="text-right py-2 px-2">Leg 1 Price (H / L / VWAP)</th>
            <th className="text-left py-2 px-2">Leg 2</th>
            <th className="text-right py-2 px-2">Leg 2 Price (H / L / VWAP)</th>
            <th className="text-right py-2 px-2">Spread (H / L / VWAP)</th>
            <th className="text-right py-2 pl-2">Lots</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const color = PRODUCT_COLORS[s.product] ?? '#888';
            const fmt = fmtSpread;
            return (
              <tr key={i} className="border-b border-border/50 hover:bg-surface/30">
                <td className="py-2 pr-3 font-semibold" style={{ color }}>{s.product}</td>
                <td className="py-2 px-2 text-text-primary">{s.leg1}</td>
                <td className="text-right py-2 px-2 font-mono text-text-primary">
                  {s.leg1High.toFixed(2)} / {s.leg1Low.toFixed(2)} / {s.leg1VWAP.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-text-primary">{s.leg2}</td>
                <td className="text-right py-2 px-2 font-mono text-text-primary">
                  {s.leg2High.toFixed(2)} / {s.leg2Low.toFixed(2)} / {s.leg2VWAP.toFixed(2)}
                </td>
                <td className="text-right py-2 px-2 font-mono font-semibold">
                  <span className={s.spreadHigh >= 0 ? 'text-positive' : 'text-negative'}>{fmt(s.spreadHigh)}</span>
                  <span className="text-text-dim"> / </span>
                  <span className={s.spreadLow >= 0 ? 'text-positive' : 'text-negative'}>{fmt(s.spreadLow)}</span>
                  <span className="text-text-dim"> / </span>
                  <span className={s.spreadVWAP >= 0 ? 'text-positive' : 'text-negative'}>{fmt(s.spreadVWAP)}</span>
                </td>
                <td className="text-right py-2 pl-2 font-mono text-text-primary">{s.lots}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SettlementsTable({ items }: { items: SettlementProductAgg[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
            <th className="text-left py-2 pr-3">Product</th>
            <th className="text-right py-2 px-2">Open</th>
            <th className="text-right py-2 px-2">High</th>
            <th className="text-right py-2 px-2">Low</th>
            <th className="text-right py-2 px-2">Close</th>
            <th className="text-right py-2 px-2">Δ</th>
            <th className="text-right py-2 px-2">Volume</th>
            <th className="text-right py-2 px-2">OI Start</th>
            <th className="text-right py-2 px-2">OI End</th>
            <th className="text-right py-2 pl-2">ΔOI</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const name = PDF_CODE_TO_NAME[it.product_code] ?? it.product_code;
            const color = PDF_CODE_TO_COLOR[it.product_code] ?? '#888';
            const fmt = (v: number | null) => v != null ? v.toFixed(2) : '\u2014';
            const fmtInt = (v: number | null) => v != null ? v.toLocaleString() : '\u2014';
            const changeClass = it.change == null ? 'text-text-dim' : it.change >= 0 ? 'text-positive' : 'text-negative';
            const oiClass = it.oi_delta == null ? 'text-text-dim' : it.oi_delta >= 0 ? 'text-positive' : 'text-negative';
            return (
              <tr key={it.product_code} className="border-b border-border/50 hover:bg-surface/30">
                <td className="py-2 pr-3 font-semibold" style={{ color }}>{name}</td>
                <td className="text-right py-2 px-2 font-mono text-text-primary">{fmt(it.open)}</td>
                <td className="text-right py-2 px-2 font-mono text-text-primary">{fmt(it.high)}</td>
                <td className="text-right py-2 px-2 font-mono text-text-primary">{fmt(it.low)}</td>
                <td className="text-right py-2 px-2 font-mono text-text-primary">{fmt(it.close)}</td>
                <td className={`text-right py-2 px-2 font-mono font-semibold ${changeClass}`}>
                  {it.change == null ? '\u2014' : (it.change >= 0 ? `+${it.change.toFixed(2)}` : it.change.toFixed(2))}
                </td>
                <td className="text-right py-2 px-2 font-mono text-text-primary">{fmtInt(it.total_volume)}</td>
                <td className="text-right py-2 px-2 font-mono text-text-dim">{fmtInt(it.oi_start)}</td>
                <td className="text-right py-2 px-2 font-mono text-text-dim">{fmtInt(it.oi_end)}</td>
                <td className={`text-right py-2 pl-2 font-mono font-semibold ${oiClass}`}>
                  {it.oi_delta == null ? '\u2014' : (it.oi_delta >= 0 ? `+${it.oi_delta.toLocaleString()}` : it.oi_delta.toLocaleString())}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SettlementChart({ agg }: { agg: SettlementProductAgg }) {
  const name = PDF_CODE_TO_NAME[agg.product_code] ?? agg.product_code;
  const color = PDF_CODE_TO_COLOR[agg.product_code] ?? '#888';
  const data = agg.series.filter(p => p.front_month_settle != null).map(p => ({
    date: p.date.slice(5), // MM-DD
    settle: p.front_month_settle,
  }));
  return (
    <div className="bg-surface border border-border rounded p-3">
      <h4 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-2" style={{ color }}>
        {name} — Front-Month Settle
      </h4>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #2a2a3a)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={55} />
          <Tooltip />
          <Line type="monotone" dataKey="settle" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
