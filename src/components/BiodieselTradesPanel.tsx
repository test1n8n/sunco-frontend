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
  };
  total_volume: number;
  total_trades: number;
  outright_volume: number;
  spread_volume: number;
  time_spread_volume: number;
  product_spread_volume: number;
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
  const timeSpreads = report?.spreads_analysis?.time_spreads ?? [];
  const productSpreads = report?.spreads_analysis?.product_spreads ?? [];

  // Group recap by product for visual grouping
  const recapProducts = [...new Set(recap.map((r) => r.product))];

  return (
    <div className="space-y-4" data-section={prominentTitle ? 'biodiesel-trades' : undefined}>
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

      {/* Drop Zone + GO Settlement */}
      {!readOnly && (
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <FileDropZone onFile={handleFile} uploading={uploading} filename={uploadedFilename} />
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <label className="text-text-dim text-xs uppercase tracking-widest">LS GO M1 Settlement</label>
            <input
              type="number" step="0.01" placeholder="e.g. 682.50"
              value={goSettlement} onChange={(e) => setGoSettlement(e.target.value)}
              className="bg-surface border border-border rounded px-3 py-2 text-text-primary text-sm font-mono w-36 focus:outline-none focus:border-accent"
            />
            <span className="text-text-dim text-xs">$/MT (auto-filled if available)</span>
          </div>
        </div>
      )}

      {/* Error */}
      {!readOnly && error && (
        <div className="bg-negative/10 border border-negative/30 rounded px-4 py-2 text-sm text-negative">{error}</div>
      )}

      {report && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Total Trades" value={report.total_trades.toLocaleString()} />
            <MetricCard label="Diff Outright Volume" value={`${report.outright_volume.toLocaleString()}`} sub="lots (no spread)" />
            <MetricCard label="Time Spread Volume" value={`${(report.time_spread_volume ?? 0).toLocaleString()}`} sub="lots" />
            <MetricCard label="Product Spread Volume" value={`${(report.product_spread_volume ?? 0).toLocaleString()}`} sub="lots" />
            <MetricCard label="Total Spread Volume" value={`${report.spread_volume.toLocaleString()}`} sub="lots (time + product)" />
            <MetricCard label="GO Settlement" value={report.go_settlement != null ? `${report.go_settlement.toLocaleString()}` : '\u2014'} sub="$/MT" />
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              TABLE 1: SWAPS RECAP — per product+delivery
              ═══════════════════════════════════════════════════════════════ */}
          {recap.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Diff Swaps Recap — By Product &amp; Delivery
              </h3>
              <div className="overflow-x-auto">
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
                      return rows.map((row, i) => (
                        <tr
                          key={`${product}-${row.delivery}`}
                          className={`border-b border-border/50 hover:bg-surface/30 ${i === 0 ? 'border-l-2' : 'border-l-2'}`}
                          style={{ borderLeftColor: color }}
                        >
                          <td className="py-2 pr-3 font-semibold" style={{ color }}>
                            {i === 0 ? product : ''}
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
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TABLE 2: SPREADS — Time Spreads + Product Spreads
              ═══════════════════════════════════════════════════════════════ */}

          {/* Time Spreads */}
          {timeSpreads.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Time Spreads
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                      <th className="text-left py-2 pr-3">ID</th>
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
                          <td className="py-2 pr-3 text-text-dim text-xs">{s.spread_id}</td>
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
            </div>
          )}

          {/* Product Spreads */}
          {productSpreads.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Product Spreads
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                      <th className="text-left py-2 pr-3">ID</th>
                      <th className="text-left py-2 px-2">Delivery</th>
                      <th className="text-left py-2 px-2">Legs</th>
                      <th className="text-right py-2 px-2">Lots</th>
                      <th className="text-right py-2 pl-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSpreads.map((s, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface/30">
                        <td className="py-2 pr-3 text-text-dim text-xs">{s.spread_id}</td>
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
