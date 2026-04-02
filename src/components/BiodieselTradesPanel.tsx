import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { API_BASE_URL, API_KEY } from '../config';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BiodieselTrade {
  p: string;
  t: string;
  d: string;
  v: number;
  px: number;
  tm: string;
  st: string;
}

interface DeliveryBreakdown {
  delivery: string;
  volume: number;
  vwap: number;
  trades: number;
  flat_price: number | null;
}

interface ProductMetrics {
  total_volume: number;
  trade_count: number;
  vwap: number;
  high: number;
  low: number;
  last: number;
  flat_price: number | null;
  by_delivery: DeliveryBreakdown[];
}

interface SpreadTrade {
  product: string;
  delivery: string;
  volume: number;
  price: number;
  time: string;
}

interface BiodieselTradeReport {
  id: string;
  report_date: string;
  raw_trades: BiodieselTrade[];
  by_product: Record<string, ProductMetrics>;
  spreads: SpreadTrade[];
  total_volume: number;
  total_trades: number;
  outright_volume: number;
  spread_volume: number;
  go_settlement: number | null;
  uploaded_at: string | null;
  source_screenshots: number;
}

// ─── Product Colors ──────────────────────────────────────────────────────────

const PRODUCT_COLORS: Record<string, string> = {
  FAME0: '#6366f1',
  RME: '#22d3ee',
  UCOME: '#f59e0b',
  HVO: '#10b981',
  SAF: '#f87171',
};

function getProductColor(product: string): string {
  return PRODUCT_COLORS[product] ?? '#888';
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded px-3 py-2 text-xs shadow-lg">
      <p className="text-text-dim font-semibold mb-1">{label}</p>
      <p className="text-text-primary font-bold">
        {payload[0].value.toLocaleString()} {unit}
      </p>
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

// ─── File Drop Zone (Excel/CSV) ─────────────────────────────────────────────

function FileDropZone({
  onFile,
  uploading,
  filename,
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative cursor-pointer border-2 border-dashed rounded-lg px-6 py-5
        flex items-center gap-4 transition-colors
        ${dragging
          ? 'border-accent bg-accent/5'
          : 'border-border hover:border-accent/50 hover:bg-surface/50'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={handleChange}
      />

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
              {filename
                ? `Uploaded: ${filename} — drop new file to replace`
                : 'Drop ICE biodiesel trades Excel/CSV here, or click to select'}
            </p>
            <p className="text-text-dim text-xs mt-0.5">
              .xlsx or .csv with columns: Type, Product, Delivery, Lots, Price, Time
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
}

export default function BiodieselTradesPanel({ readOnly = false }: Props) {
  const [report, setReport] = useState<BiodieselTradeReport | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goSettlement, setGoSettlement] = useState('');

  // Load latest on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/products/biodiesel-trades/latest`, {
      headers: { 'X-API-Key': API_KEY },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BiodieselTradeReport | null) => {
        if (data) {
          setReport(data);
          if (data.go_settlement != null) {
            setGoSettlement(String(data.go_settlement));
          }
        }
      })
      .catch(() => {});
  }, []);

  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const today = new Date().toISOString().slice(0, 10);
      const params = new URLSearchParams({ report_date: today });
      if (goSettlement.trim()) {
        params.set('go_settlement', goSettlement.trim());
      }

      const res = await fetch(
        `${API_BASE_URL}/products/biodiesel-trades?${params.toString()}`,
        {
          method: 'POST',
          headers: { 'X-API-Key': API_KEY },
          body: formData,
        },
      );

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

  // Derived chart data
  const productKeys = report ? Object.keys(report.by_product) : [];

  const volumeChartData = productKeys.map((p) => ({
    product: p,
    volume: report!.by_product[p].total_volume,
  }));

  const vwapChartData = productKeys.map((p) => ({
    product: p,
    vwap: report!.by_product[p].vwap,
  }));

  const uploadedAt = report?.uploaded_at
    ? new Date(report.uploaded_at).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      }) + ' UTC'
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest">
          ICE Biodiesel Diff Futures — Trades &amp; Analytics
        </h2>
        {uploadedAt && report && (
          <span className="text-text-dim text-xs">
            uploaded {uploadedAt}
          </span>
        )}
      </div>

      {/* Drop Zone + GO Settlement Input — only in full mode */}
      {!readOnly && (
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <FileDropZone
              onFile={handleFile}
              uploading={uploading}
              filename={uploadedFilename}
            />
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <label className="text-text-dim text-xs uppercase tracking-widest">
              LS GO M1 Settlement
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 682.50"
              value={goSettlement}
              onChange={(e) => setGoSettlement(e.target.value)}
              className="bg-surface border border-border rounded px-3 py-2 text-text-primary text-sm font-mono w-36 focus:outline-none focus:border-accent"
            />
            <span className="text-text-dim text-xs">$/MT (auto-filled if available)</span>
          </div>
        </div>
      )}

      {/* Error */}
      {!readOnly && error && (
        <div className="bg-negative/10 border border-negative/30 rounded px-4 py-2 text-sm text-negative">
          {error}
        </div>
      )}

      {/* Data panels — only shown after data loads */}
      {report && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Total Trades"
              value={report.total_trades.toLocaleString()}
            />
            <MetricCard
              label="Outright Volume"
              value={`${report.outright_volume.toLocaleString()} lots`}
            />
            <MetricCard
              label="Spread Volume"
              value={`${report.spread_volume.toLocaleString()} lots`}
            />
            <MetricCard
              label="GO Settlement"
              value={report.go_settlement != null ? `${report.go_settlement.toLocaleString()} $/MT` : '\u2014'}
            />
          </div>

          {/* Product Summary Table */}
          {productKeys.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Product Summary
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                      <th className="text-left py-2 pr-4">Product</th>
                      <th className="text-right py-2 px-3">VWAP (diff)</th>
                      <th className="text-right py-2 px-3">Flat Price</th>
                      <th className="text-right py-2 px-3">High</th>
                      <th className="text-right py-2 px-3">Low</th>
                      <th className="text-right py-2 px-3">Last</th>
                      <th className="text-right py-2 px-3">Volume</th>
                      <th className="text-right py-2 pl-3">Trades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productKeys.map((product) => {
                      const m = report.by_product[product];
                      return (
                        <tr key={product} className="border-b border-border/50 hover:bg-surface/30">
                          <td className="py-2 pr-4 font-semibold" style={{ color: getProductColor(product) }}>
                            {product}
                          </td>
                          <td className="text-right py-2 px-3 font-mono text-text-primary">
                            {m.vwap.toFixed(2)}
                          </td>
                          <td className="text-right py-2 px-3 font-mono text-text-primary">
                            {m.flat_price != null ? m.flat_price.toFixed(2) : '\u2014'}
                          </td>
                          <td className="text-right py-2 px-3 font-mono text-text-primary">
                            {m.high.toFixed(2)}
                          </td>
                          <td className="text-right py-2 px-3 font-mono text-text-primary">
                            {m.low.toFixed(2)}
                          </td>
                          <td className="text-right py-2 px-3 font-mono text-text-primary">
                            {m.last.toFixed(2)}
                          </td>
                          <td className="text-right py-2 px-3 font-mono text-text-primary">
                            {m.total_volume.toLocaleString()}
                          </td>
                          <td className="text-right py-2 pl-3 font-mono text-text-primary">
                            {m.trade_count}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Volume by Product Bar Chart */}
          {volumeChartData.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Outright Volume by Product (lots)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={volumeChartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #2a2a3a)" />
                  <XAxis
                    dataKey="product"
                    tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }}
                    tickLine={false}
                    axisLine={false}
                    width={55}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  />
                  <Tooltip content={<ChartTooltip unit="lots" />} />
                  <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
                    {volumeChartData.map((entry) => (
                      <Cell key={entry.product} fill={getProductColor(entry.product)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* VWAP by Product Bar Chart */}
          {vwapChartData.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Diff VWAP by Product ($/MT)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={vwapChartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #2a2a3a)" />
                  <XAxis
                    dataKey="product"
                    tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }}
                    tickLine={false}
                    axisLine={false}
                    width={55}
                    tickFormatter={(v: number) => v.toFixed(0)}
                  />
                  <Tooltip content={<ChartTooltip unit="$/MT" />} />
                  <Bar dataKey="vwap" radius={[2, 2, 0, 0]}>
                    {vwapChartData.map((entry) => (
                      <Cell key={entry.product} fill={getProductColor(entry.product)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Spread Trades Table */}
          {report.spreads.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Spread Trades
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                      <th className="text-left py-2 pr-4">Product</th>
                      <th className="text-left py-2 px-3">Delivery</th>
                      <th className="text-right py-2 px-3">Volume</th>
                      <th className="text-right py-2 px-3">Price</th>
                      <th className="text-right py-2 pl-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.spreads.map((s, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface/30">
                        <td className="py-2 pr-4 font-semibold" style={{ color: getProductColor(s.product) }}>
                          {s.product}
                        </td>
                        <td className="py-2 px-3 text-text-primary">{s.delivery}</td>
                        <td className="text-right py-2 px-3 font-mono text-text-primary">
                          {s.volume.toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 font-mono text-text-primary">
                          {s.price.toFixed(2)}
                        </td>
                        <td className="text-right py-2 pl-3 text-text-dim text-xs">
                          {s.time}
                        </td>
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
            ? 'No biodiesel trade data yet — upload screenshots in the Products Data tab.'
            : 'Upload ICE biodiesel diff futures screenshots to extract and analyze trade data.'}
        </p>
      )}
    </div>
  );
}
