import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL, API_KEY } from '../config';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecapRow {
  product: string;
  delivery: string;
  total_lots: number;
  num_trades: number;
  high_diff: number | null;
  low_diff: number | null;
  total_oi: number | null;
  oi_change: number | null;
  flat_price_high: number | null;
  flat_price_low: number | null;
}

interface TimeSpread {
  spread_id: string;
  product: string;
  leg1: string;
  leg1_price: number;
  leg2: string;
  leg2_price: number;
  spread_value: number;
  lots: number;
  time: string;
}

interface FlatTimeSpread {
  spread_id: string;
  product: string;
  leg1: string;
  leg1_price: number;
  leg1_lots?: number;
  leg2: string;
  leg2_price: number;
  leg2_lots?: number;
  spread_value: number;
  lots: number;
  time: string;
}

interface ProductSpreadLeg {
  product: string;
  delivery: string;
  price: number;
  lots: number;
}

interface ProductSpread {
  spread_id: string;
  delivery: string;
  legs: ProductSpreadLeg[];
  lots: number;
  time: string;
}

interface BiodieselTradeReport {
  id: string;
  report_date: string;
  recap_by_delivery: RecapRow[];
  spreads_analysis: {
    time_spreads: TimeSpread[];
    product_spreads: ProductSpread[];
    flat_time_spreads?: FlatTimeSpread[];
  };
  total_volume: number;
  total_trades: number;
  diff_trade_count?: number;
  flat_trade_count?: number;
  diff_spread_trade_count?: number;
  flat_spread_trade_count?: number;
  spread_trade_count?: number;
  outright_volume: number;
  spread_volume: number;
  time_spread_volume: number;
  product_spread_volume: number;
  flat_spread_volume?: number;
  flat_volume: number;
  go_settlement: number | null;
  uploaded_at: string | null;
}

// ─── Product Colors ──────────────────────────────────────────────────────────

const PRODUCT_COLORS: Record<string, string> = {
  FAME0: '#10b981',
  RME: '#f59e0b',
  UCOME: '#ef4444',
  HVO: '#8b5cf6',
  SAF: '#06b6d4',
};

// ─── Compact-view aggregation ────────────────────────────────────────────────

interface CompactTimeSpread {
  product: string;
  leg1: string;
  leg2: string;
  leg1High: number; leg1Low: number; leg1VWAP: number;
  leg2High: number; leg2Low: number; leg2VWAP: number;
  spreadHigh: number; spreadLow: number; spreadVWAP: number;
  lots: number;
  count: number;
}

/** Group rows sharing (product, leg1, leg2) and aggregate per-leg H/L/VWAP
 *  prices, spread H/L/VWAP, and summed lots. Keys built from row fields, so
 *  different leg-delivery combinations stay as separate rows even if they
 *  share a product. */
function aggregateTimeSpreads<
  T extends { product: string; leg1: string; leg1_price: number; leg2: string; leg2_price: number; spread_value: number; lots: number }
>(rows: T[]): CompactTimeSpread[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const k = `${r.product}|${r.leg1}|${r.leg2}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const out: CompactTimeSpread[] = [];
  for (const rs of groups.values()) {
    const totalLots = rs.reduce((s, r) => s + r.lots, 0);
    const wsum = (f: (r: T) => number) =>
      totalLots > 0 ? rs.reduce((s, r) => s + f(r) * r.lots, 0) / totalLots : 0;
    out.push({
      product: rs[0].product,
      leg1: rs[0].leg1,
      leg2: rs[0].leg2,
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
  return out;
}

interface CompactProductSpreadLeg {
  product: string;
  priceHigh: number; priceLow: number; priceVWAP: number;
}

interface CompactProductSpread {
  delivery: string;
  legs: CompactProductSpreadLeg[];
  lots: number;
  count: number;
}

/** Group product spreads sharing (delivery, sorted-set-of-leg-products) and
 *  aggregate per-product price H/L/VWAP and summed lots. */
function aggregateProductSpreads(rows: ProductSpread[]): CompactProductSpread[] {
  const groups = new Map<string, { delivery: string; productsKey: string; rows: ProductSpread[] }>();
  for (const r of rows) {
    const productsKey = [...new Set(r.legs.map(l => l.product))].sort().join(',');
    const k = `${r.delivery}|${productsKey}`;
    if (!groups.has(k)) groups.set(k, { delivery: r.delivery, productsKey, rows: [] });
    groups.get(k)!.rows.push(r);
  }
  const out: CompactProductSpread[] = [];
  for (const g of groups.values()) {
    const totalLots = g.rows.reduce((s, r) => s + r.lots, 0);
    // Per-product: collect (price, lots) pairs across all executions in the group
    const perProduct = new Map<string, { prices: number[]; weights: number[] }>();
    for (const row of g.rows) {
      for (const leg of row.legs) {
        if (!perProduct.has(leg.product)) perProduct.set(leg.product, { prices: [], weights: [] });
        const entry = perProduct.get(leg.product)!;
        entry.prices.push(leg.price);
        entry.weights.push(leg.lots);
      }
    }
    const legsSummary: CompactProductSpreadLeg[] = [];
    for (const [product, { prices, weights }] of perProduct) {
      const w = weights.reduce((s, x) => s + x, 0);
      const vwap = w > 0 ? prices.reduce((s, p, i) => s + p * weights[i], 0) / w : 0;
      legsSummary.push({
        product,
        priceHigh: Math.max(...prices),
        priceLow: Math.min(...prices),
        priceVWAP: vwap,
      });
    }
    out.push({ delivery: g.delivery, legs: legsSummary, lots: totalLots, count: g.rows.length });
  }
  return out;
}

interface CompactRecapRow {
  product: string;
  deliveries: string;
  total_lots: number;
  total_oi: number | null;
  oi_change: number | null;
  num_trades: number;
  high_diff: number | null;
  low_diff: number | null;
  flat_price_high: number | null;
  flat_price_low: number | null;
}

/** Group recap rows by product — collapse deliveries into a comma-joined list,
 *  sum lots/OI/trades, max/min for H/L columns. Null-safe throughout. */
function aggregateRecap(rows: RecapRow[]): CompactRecapRow[] {
  const groups = new Map<string, RecapRow[]>();
  for (const r of rows) {
    (groups.get(r.product) ?? groups.set(r.product, []).get(r.product)!).push(r);
  }
  const maxOrNull = (vals: (number | null)[]): number | null => {
    const nums = vals.filter((v): v is number => v != null);
    return nums.length ? Math.max(...nums) : null;
  };
  const minOrNull = (vals: (number | null)[]): number | null => {
    const nums = vals.filter((v): v is number => v != null);
    return nums.length ? Math.min(...nums) : null;
  };
  const sumOrNull = (vals: (number | null)[]): number | null => {
    const nums = vals.filter((v): v is number => v != null);
    return nums.length ? nums.reduce((s, n) => s + n, 0) : null;
  };
  return [...groups.values()].map((rs) => ({
    product: rs[0].product,
    deliveries: rs.map((r) => r.delivery).join(', '),
    total_lots: rs.reduce((s, r) => s + r.total_lots, 0),
    total_oi: sumOrNull(rs.map((r) => r.total_oi)),
    oi_change: sumOrNull(rs.map((r) => r.oi_change)),
    num_trades: rs.reduce((s, r) => s + r.num_trades, 0),
    high_diff: maxOrNull(rs.map((r) => r.high_diff)),
    low_diff: minOrNull(rs.map((r) => r.low_diff)),
    flat_price_high: maxOrNull(rs.map((r) => r.flat_price_high)),
    flat_price_low: minOrNull(rs.map((r) => r.flat_price_low)),
  }));
}

/** Small pill toggle used at the top-right of each spread table. */
function ViewToggle({
  mode, setMode,
}: {
  mode: 'compact' | 'detailed';
  setMode: (m: 'compact' | 'detailed') => void;
}) {
  const btn = (v: 'compact' | 'detailed', label: string) => (
    <button
      onClick={() => setMode(v)}
      className={`px-2 py-0.5 text-[10px] uppercase tracking-widest rounded transition-colors ${
        mode === v
          ? 'bg-accent text-surface font-bold'
          : 'text-text-dim hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div data-print-hide className="flex items-center gap-1 bg-surface border border-border rounded p-0.5">
      {btn('compact', 'Compact')}
      {btn('detailed', 'Detailed')}
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded p-4 flex flex-col gap-1">
      <span className="text-text-dim text-xs uppercase tracking-widest">{label}</span>
      <span className="text-text-primary text-xl font-bold font-mono">{value}</span>
      {sub && <span className="text-text-dim text-xs">{sub}</span>}
    </div>
  );
}

// ─── File Drop Zone ──────────────────────────────────────────────────────────

function FileDropZone({
  onFile, uploading, filename,
}: {
  onFile: (file: File) => void;
  uploading: boolean;
  filename: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative cursor-pointer border-2 border-dashed rounded-lg px-6 py-5
        flex items-center gap-4 transition-colors
        ${dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-surface/50'}
      `}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {uploading ? (
        <>
          <span className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-text-primary text-sm font-semibold">Processing trade data...</p>
            <p className="text-text-dim text-xs">Parsing Excel and computing analytics</p>
          </div>
        </>
      ) : (
        <>
          <span className="text-2xl shrink-0">📊</span>
          <div>
            <p className="text-text-primary text-sm font-semibold">
              {filename ? `Uploaded: ${filename} — drop new file to replace` : 'Drop ICE biodiesel trades Excel here, or click to select'}
            </p>
            <p className="text-text-dim text-xs mt-0.5">
              .xlsx with columns: #, Type, Product, Delivery, Lots, Price, Time, Spread ID
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

interface Props {
  readOnly?: boolean;
  prominentTitle?: boolean;
}

export default function BiodieselTradesPanel({ readOnly = false, prominentTitle = false }: Props) {
  const [report, setReport] = useState<BiodieselTradeReport | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goSettlement, setGoSettlement] = useState('');
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [recapMode, setRecapMode] = useState<'compact' | 'detailed'>('detailed');
  const [diffTimeMode, setDiffTimeMode] = useState<'compact' | 'detailed'>('detailed');
  const [diffProductMode, setDiffProductMode] = useState<'compact' | 'detailed'>('detailed');
  const [flatTimeMode, setFlatTimeMode] = useState<'compact' | 'detailed'>('detailed');

  useEffect(() => {
    fetch(`${API_BASE_URL}/products/biodiesel-trades/latest`, {
      headers: { 'X-API-Key': API_KEY },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BiodieselTradeReport | null) => {
        if (data) {
          setReport(data);
          if (data.go_settlement != null) setGoSettlement(String(data.go_settlement));
        }
      })
      .catch(() => {});
  }, []);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const today = new Date().toISOString().slice(0, 10);
      const params = new URLSearchParams({ report_date: today });
      if (goSettlement.trim()) params.set('go_settlement', goSettlement.trim());

      const res = await fetch(`${API_BASE_URL}/products/biodiesel-trades?${params.toString()}`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(detail.detail ?? `HTTP ${res.status}`);
      }
      const data: BiodieselTradeReport = await res.json();
      setReport(data);
      setUploadedFilename(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const uploadedAt = report?.uploaded_at
    ? new Date(report.uploaded_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
    : null;

  const recap = report?.recap_by_delivery ?? [];
  const productSpreads = report?.spreads_analysis?.product_spreads ?? [];

  // Sort time-spread tables: group by product (highest total lots first),
  // then within each product group sort by lots descending.
  const sortTimeSpreads = <T extends { product: string; lots: number }>(rows: T[]): T[] => {
    const productTotals = new Map<string, number>();
    for (const r of rows) {
      productTotals.set(r.product, (productTotals.get(r.product) ?? 0) + r.lots);
    }
    return [...rows].sort((a, b) => {
      const diff = (productTotals.get(b.product) ?? 0) - (productTotals.get(a.product) ?? 0);
      if (diff !== 0) return diff;
      return b.lots - a.lots;
    });
  };
  const timeSpreads = sortTimeSpreads(report?.spreads_analysis?.time_spreads ?? []);
  const flatTimeSpreads = sortTimeSpreads(report?.spreads_analysis?.flat_time_spreads ?? []);
  // Compact (aggregated) versions — same grouping/sorting as detailed.
  const recapCompact = aggregateRecap(recap);
  const timeSpreadsCompact = sortTimeSpreads(aggregateTimeSpreads(timeSpreads));
  const flatTimeSpreadsCompact = sortTimeSpreads(aggregateTimeSpreads(flatTimeSpreads));
  const productSpreadsCompact = aggregateProductSpreads(productSpreads);

  // Degenerate-case rule: if a table's Compact view only produces ≤1 group,
  // there is nothing worth collapsing — hide the toggle and force Detailed
  // everywhere (including short PDF).
  const recapHasCompact = recapCompact.length > 1;
  const diffTimeHasCompact = timeSpreadsCompact.length > 1;
  const diffProductHasCompact = productSpreadsCompact.length > 1;
  const flatTimeHasCompact = flatTimeSpreadsCompact.length > 1;
  const effectiveRecapMode = recapHasCompact ? recapMode : 'detailed';
  const effectiveDiffTimeMode = diffTimeHasCompact ? diffTimeMode : 'detailed';
  const effectiveDiffProductMode = diffProductHasCompact ? diffProductMode : 'detailed';
  const effectiveFlatTimeMode = flatTimeHasCompact ? flatTimeMode : 'detailed';

  // Group recap by product for visual grouping
  const recapProducts = [...new Set(recap.map((r) => r.product))];

  return (
    <div className="space-y-4">
      {/* Header */}
      {prominentTitle ? (
        <div className="pb-2 mb-2 border-b-2 border-accent/60 flex items-end justify-between">
          <div>
            <h2 className="text-text-primary font-bold text-base uppercase tracking-widest">
              ICE Biodiesel Diff Swaps
            </h2>
            <p className="text-text-dim text-xs mt-0.5">Trades, Recap &amp; Spreads</p>
          </div>
          {uploadedAt && <span data-print-hide className="text-text-dim text-xs pb-1">uploaded {uploadedAt}</span>}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest">
            ICE Biodiesel Diff Swaps — Trades, Recap &amp; Spreads
          </h2>
          {uploadedAt && <span data-print-hide className="text-text-dim text-xs">uploaded {uploadedAt}</span>}
        </div>
      )}

      {/* Drop Zone */}
      {!readOnly && (
        <FileDropZone onFile={handleFile} uploading={uploading} filename={uploadedFilename} />
      )}

      {/* Error */}
      {!readOnly && error && (
        <div className="bg-negative/10 border border-negative/30 rounded px-4 py-2 text-sm text-negative">{error}</div>
      )}

      {report && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Total Trades"
              value={report.total_trades.toLocaleString()}
              sub={
                report.diff_trade_count != null &&
                report.flat_trade_count != null &&
                report.diff_spread_trade_count != null &&
                report.flat_spread_trade_count != null
                  ? `${report.diff_trade_count} Diffs · ${report.flat_trade_count} Flats · ${report.diff_spread_trade_count} Diff Spreads · ${report.flat_spread_trade_count} Flat Spreads`
                  : undefined
              }
            />
            <MetricCard label="Diff Outright Volume" value={`${report.outright_volume.toLocaleString()}`} sub="lots (no spread)" />
            <MetricCard label="Time Spread Volume" value={`${(report.time_spread_volume ?? 0).toLocaleString()}`} sub="lots" />
            <MetricCard label="Product Spread Volume" value={`${(report.product_spread_volume ?? 0).toLocaleString()}`} sub="lots" />
            <MetricCard label="Flat Spread Volume" value={`${(report.flat_spread_volume ?? 0).toLocaleString()}`} sub="lots" />
            <MetricCard
              label="Total Volume"
              value={(
                report.outright_volume
                + (report.spread_volume ?? 0)
                + (report.flat_spread_volume ?? 0)
                + (report.flat_volume ?? 0)
              ).toLocaleString()}
              sub="lots (outright + spreads + flat)"
            />
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              TABLE 1: SWAPS RECAP — per product+delivery
              ═══════════════════════════════════════════════════════════════ */}
          {recap.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest">
                  Diff Swaps Recap — By Product &amp; Delivery
                </h3>
                {recapHasCompact && <ViewToggle mode={recapMode} setMode={setRecapMode} />}
              </div>
              {/* Detailed view */}
              <div className={`${recapHasCompact ? 'bio-spread-detailed' : ''} overflow-x-auto ${effectiveRecapMode === 'detailed' ? '' : 'hidden'}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                      <th className="text-left py-2 pr-3">Product</th>
                      <th className="text-left py-2 px-2">Delivery</th>
                      <th className="text-right py-2 px-2">Lots</th>
                      <th className="text-right py-2 px-2">OI</th>
                      <th className="text-right py-2 px-2">OI Chg</th>
                      <th className="text-right py-2 px-2">Trades</th>
                      <th className="text-right py-2 px-2">High Diff</th>
                      <th className="text-right py-2 px-2">Low Diff</th>
                      <th className="text-right py-2 px-2">Flat High</th>
                      <th className="text-right py-2 pl-2">Flat Low</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recapProducts.map((product) => {
                      const rows = recap.filter((r) => r.product === product);
                      const color = PRODUCT_COLORS[product] ?? '#888';
                      return rows.map((row) => (
                        <tr
                          key={`${product}-${row.delivery}`}
                          className="border-b border-border/50 hover:bg-surface/30"
                        >
                          <td className="py-2 pr-3 font-semibold" style={{ color }}>
                            {product}
                          </td>
                          <td className="py-2 px-2 text-text-primary">{row.delivery}</td>
                          <td className="text-right py-2 px-2 font-mono text-text-primary font-semibold">
                            {row.total_lots.toLocaleString()}
                          </td>
                          <td className="text-right py-2 px-2 font-mono text-text-dim">
                            {row.total_oi != null ? row.total_oi.toLocaleString() : '\u2014'}
                          </td>
                          <td className={`text-right py-2 px-2 font-mono ${
                            row.oi_change != null && row.oi_change > 0 ? 'text-positive' :
                            row.oi_change != null && row.oi_change < 0 ? 'text-negative' : 'text-text-dim'
                          }`}>
                            {row.oi_change != null ? (row.oi_change >= 0 ? `+${row.oi_change}` : row.oi_change) : '\u2014'}
                          </td>
                          <td className="text-right py-2 px-2 font-mono text-text-primary">{row.num_trades}</td>
                          <td className="text-right py-2 px-2 font-mono text-text-primary">
                            {row.high_diff != null ? row.high_diff.toFixed(2) : '\u2014'}
                          </td>
                          <td className="text-right py-2 px-2 font-mono text-text-primary">
                            {row.low_diff != null ? row.low_diff.toFixed(2) : '\u2014'}
                          </td>
                          <td className="text-right py-2 px-2 font-mono text-text-dim">{'\u2014'}</td>
                          <td className="text-right py-2 pl-2 font-mono text-text-dim">{'\u2014'}</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
              {/* Compact view */}
              {recapHasCompact && (
                <div className={`bio-spread-compact overflow-x-auto ${effectiveRecapMode === 'compact' ? '' : 'hidden'}`}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                        <th className="text-left py-2 pr-3">Product</th>
                        <th className="text-left py-2 px-2">Deliveries</th>
                        <th className="text-right py-2 px-2">Lots</th>
                        <th className="text-right py-2 px-2">OI</th>
                        <th className="text-right py-2 px-2">OI Chg</th>
                        <th className="text-right py-2 px-2">Trades</th>
                        <th className="text-right py-2 px-2">High Diff</th>
                        <th className="text-right py-2 px-2">Low Diff</th>
                        <th className="text-right py-2 px-2">Flat High</th>
                        <th className="text-right py-2 pl-2">Flat Low</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recapCompact.map((row) => {
                        const color = PRODUCT_COLORS[row.product] ?? '#888';
                        return (
                          <tr key={row.product} className="border-b border-border/50 hover:bg-surface/30">
                            <td className="py-2 pr-3 font-semibold" style={{ color }}>{row.product}</td>
                            <td className="py-2 px-2 text-text-primary">{row.deliveries}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary font-semibold">
                              {row.total_lots.toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-2 font-mono text-text-dim">
                              {row.total_oi != null ? row.total_oi.toLocaleString() : '\u2014'}
                            </td>
                            <td className={`text-right py-2 px-2 font-mono ${
                              row.oi_change != null && row.oi_change > 0 ? 'text-positive' :
                              row.oi_change != null && row.oi_change < 0 ? 'text-negative' : 'text-text-dim'
                            }`}>
                              {row.oi_change != null ? (row.oi_change >= 0 ? `+${row.oi_change}` : row.oi_change) : '\u2014'}
                            </td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">{row.num_trades}</td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">
                              {row.high_diff != null ? row.high_diff.toFixed(2) : '\u2014'}
                            </td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">
                              {row.low_diff != null ? row.low_diff.toFixed(2) : '\u2014'}
                            </td>
                            <td className="text-right py-2 px-2 font-mono text-text-primary">
                              {row.flat_price_high != null ? row.flat_price_high.toFixed(2) : '\u2014'}
                            </td>
                            <td className="text-right py-2 pl-2 font-mono text-text-primary">
                              {row.flat_price_low != null ? row.flat_price_low.toFixed(2) : '\u2014'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TABLE 2: SPREADS — Time Spreads + Product Spreads
              ═══════════════════════════════════════════════════════════════ */}

          {/* Diff Time Spreads */}
          {timeSpreads.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest">
                  Diff Time Spreads
                </h3>
                {diffTimeHasCompact && <ViewToggle mode={diffTimeMode} setMode={setDiffTimeMode} />}
              </div>
              {/* Detailed view */}
              <div className={`${diffTimeHasCompact ? 'bio-spread-detailed' : ''} overflow-x-auto ${effectiveDiffTimeMode === 'detailed' ? '' : 'hidden'}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                      <th className="text-left py-2 pr-3" data-print-hide>ID</th>
                      <th className="text-left py-2 px-2">Product</th>
                      <th className="text-left py-2 px-2">Leg 1</th>
                      <th className="text-right py-2 px-2">Price</th>
                      <th className="text-left py-2 px-2">Leg 2</th>
                      <th className="text-right py-2 px-2">Price</th>
                      <th className="text-right py-2 px-2">Spread</th>
                      <th className="text-right py-2 px-2">Lots</th>
                      <th className="text-right py-2 pl-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeSpreads.map((s, i) => {
                      const color = PRODUCT_COLORS[s.product] ?? '#888';
                      return (
                        <tr key={i} className="border-b border-border/50 hover:bg-surface/30">
                          <td className="py-2 pr-3 text-text-dim text-xs" data-print-hide>{s.spread_id}</td>
                          <td className="py-2 px-2 font-semibold" style={{ color }}>{s.product}</td>
                          <td className="py-2 px-2 text-text-primary">{s.leg1}</td>
                          <td className="text-right py-2 px-2 font-mono text-text-primary">{s.leg1_price.toFixed(2)}</td>
                          <td className="py-2 px-2 text-text-primary">{s.leg2}</td>
                          <td className="text-right py-2 px-2 font-mono text-text-primary">{s.leg2_price.toFixed(2)}</td>
                          <td className={`text-right py-2 px-2 font-mono font-semibold ${s.spread_value >= 0 ? 'text-positive' : 'text-negative'}`}>
                            {s.spread_value >= 0 ? `+${s.spread_value.toFixed(2)}` : s.spread_value.toFixed(2)}
                          </td>
                          <td className="text-right py-2 px-2 font-mono text-text-primary">{s.lots}</td>
                          <td className="text-right py-2 pl-2 text-text-dim text-xs">{s.time}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Compact view */}
              {diffTimeHasCompact && (
                <div className={`bio-spread-compact overflow-x-auto ${effectiveDiffTimeMode === 'compact' ? '' : 'hidden'}`}>
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
                      {timeSpreadsCompact.map((s, i) => {
                        const color = PRODUCT_COLORS[s.product] ?? '#888';
                        const fmtSpread = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
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
                              <span className={s.spreadHigh >= 0 ? 'text-positive' : 'text-negative'}>{fmtSpread(s.spreadHigh)}</span>
                              <span className="text-text-dim"> / </span>
                              <span className={s.spreadLow >= 0 ? 'text-positive' : 'text-negative'}>{fmtSpread(s.spreadLow)}</span>
                              <span className="text-text-dim"> / </span>
                              <span className={s.spreadVWAP >= 0 ? 'text-positive' : 'text-negative'}>{fmtSpread(s.spreadVWAP)}</span>
                            </td>
                            <td className="text-right py-2 pl-2 font-mono text-text-primary">{s.lots}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Diff Product Spreads */}
          {productSpreads.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest">
                  Diff Product Spreads
                </h3>
                {diffProductHasCompact && <ViewToggle mode={diffProductMode} setMode={setDiffProductMode} />}
              </div>
              {/* Detailed view */}
              <div className={`${diffProductHasCompact ? 'bio-spread-detailed' : ''} overflow-x-auto ${effectiveDiffProductMode === 'detailed' ? '' : 'hidden'}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                      <th className="text-left py-2 pr-3" data-print-hide>ID</th>
                      <th className="text-left py-2 px-2">Delivery</th>
                      <th className="text-left py-2 px-2">Legs</th>
                      <th className="text-right py-2 px-2">Lots</th>
                      <th className="text-right py-2 pl-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSpreads.map((s, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface/30">
                        <td className="py-2 pr-3 text-text-dim text-xs" data-print-hide>{s.spread_id}</td>
                        <td className="py-2 px-2 text-text-primary">{s.delivery}</td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-2">
                            {s.legs.map((leg, j) => (
                              <span key={j} className="text-xs">
                                <span className="font-semibold" style={{ color: PRODUCT_COLORS[leg.product] ?? '#888' }}>
                                  {leg.product}
                                </span>
                                {' '}{leg.delivery}{' '}
                                <span className="font-mono">{leg.lots}@{leg.price.toFixed(1)}</span>
                                {j < s.legs.length - 1 && <span className="text-text-dim mx-1">vs</span>}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="text-right py-2 px-2 font-mono text-text-primary">{s.lots}</td>
                        <td className="text-right py-2 pl-2 text-text-dim text-xs">{s.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Compact view */}
              {diffProductHasCompact && (
                <div className={`bio-spread-compact overflow-x-auto ${effectiveDiffProductMode === 'compact' ? '' : 'hidden'}`}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                        <th className="text-left py-2 pr-3">Delivery</th>
                        <th className="text-left py-2 px-2">Legs (H / L / VWAP per product)</th>
                        <th className="text-right py-2 pl-2">Lots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productSpreadsCompact.map((s, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-surface/30">
                          <td className="py-2 pr-3 text-text-primary">{s.delivery}</td>
                          <td className="py-2 px-2">
                            <div className="flex flex-wrap gap-3">
                              {s.legs.map((leg, j) => (
                                <span key={j} className="text-xs">
                                  <span className="font-semibold" style={{ color: PRODUCT_COLORS[leg.product] ?? '#888' }}>
                                    {leg.product}
                                  </span>
                                  {' '}
                                  <span className="font-mono">
                                    {leg.priceHigh.toFixed(2)} / {leg.priceLow.toFixed(2)} / {leg.priceVWAP.toFixed(2)}
                                  </span>
                                  {j < s.legs.length - 1 && <span className="text-text-dim mx-1">vs</span>}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-right py-2 pl-2 font-mono text-text-primary">{s.lots}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Flat Time Spreads (time spreads on flat biodiesel prices) */}
          {flatTimeSpreads.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest">
                  Flat Time Spreads
                </h3>
                {flatTimeHasCompact && <ViewToggle mode={flatTimeMode} setMode={setFlatTimeMode} />}
              </div>
              {/* Detailed view */}
              <div className={`${flatTimeHasCompact ? 'bio-spread-detailed' : ''} overflow-x-auto ${effectiveFlatTimeMode === 'detailed' ? '' : 'hidden'}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                      <th className="text-left py-2 pr-3" data-print-hide>ID</th>
                      <th className="text-left py-2 px-2">Product</th>
                      <th className="text-left py-2 px-2">Leg 1</th>
                      <th className="text-right py-2 px-2">Price</th>
                      <th className="text-left py-2 px-2">Leg 2</th>
                      <th className="text-right py-2 px-2">Price</th>
                      <th className="text-right py-2 px-2">Spread</th>
                      <th className="text-right py-2 px-2">Lots</th>
                      <th className="text-right py-2 pl-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatTimeSpreads.map((s, i) => {
                      const color = PRODUCT_COLORS[s.product] ?? '#888';
                      const legsDiffer =
                        s.leg1_lots != null && s.leg2_lots != null && s.leg1_lots !== s.leg2_lots;
                      return (
                        <tr key={i} className="border-b border-border/50 hover:bg-surface/30">
                          <td className="py-2 pr-3 text-text-dim text-xs" data-print-hide>{s.spread_id}</td>
                          <td className="py-2 px-2 font-semibold" style={{ color }}>{s.product}</td>
                          <td className="py-2 px-2 text-text-primary">{s.leg1}</td>
                          <td className="text-right py-2 px-2 font-mono text-text-primary">{s.leg1_price.toFixed(2)}</td>
                          <td className="py-2 px-2 text-text-primary">{s.leg2}</td>
                          <td className="text-right py-2 px-2 font-mono text-text-primary">{s.leg2_price.toFixed(2)}</td>
                          <td className={`text-right py-2 px-2 font-mono font-semibold ${s.spread_value >= 0 ? 'text-positive' : 'text-negative'}`}>
                            {s.spread_value >= 0 ? `+${s.spread_value.toFixed(2)}` : s.spread_value.toFixed(2)}
                          </td>
                          <td className="text-right py-2 px-2 font-mono text-text-primary">
                            {legsDiffer ? `${s.leg1_lots} / ${s.leg2_lots}` : s.lots}
                          </td>
                          <td className="text-right py-2 pl-2 text-text-dim text-xs">{s.time}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Compact view */}
              {flatTimeHasCompact && (
                <div className={`bio-spread-compact overflow-x-auto ${effectiveFlatTimeMode === 'compact' ? '' : 'hidden'}`}>
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
                      {flatTimeSpreadsCompact.map((s, i) => {
                        const color = PRODUCT_COLORS[s.product] ?? '#888';
                        const fmtSpread = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
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
                              <span className={s.spreadHigh >= 0 ? 'text-positive' : 'text-negative'}>{fmtSpread(s.spreadHigh)}</span>
                              <span className="text-text-dim"> / </span>
                              <span className={s.spreadLow >= 0 ? 'text-positive' : 'text-negative'}>{fmtSpread(s.spreadLow)}</span>
                              <span className="text-text-dim"> / </span>
                              <span className={s.spreadVWAP >= 0 ? 'text-positive' : 'text-negative'}>{fmtSpread(s.spreadVWAP)}</span>
                            </td>
                            <td className="text-right py-2 pl-2 font-mono text-text-primary">{s.lots}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!report && !uploading && (
        <p className="text-text-dim text-xs text-center py-4">
          {readOnly
            ? 'No biodiesel trade data yet — upload the trades Excel in the Products Data tab.'
            : 'Upload the ICE biodiesel trades Excel to see the swaps recap and spread analysis.'}
        </p>
      )}
    </div>
  );
}
