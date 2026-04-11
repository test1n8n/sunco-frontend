import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import { PRODUCTS } from '../../productConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryPoint {
  report_date: string;
  m1_contract: string;
  m1_settlement: number;
  m1_change: number;
  vwap: number | null;
  total_volume: number;
  total_oi: number;
  total_spread_volume: number;
}

interface HistoryResponse {
  product_code: string;
  days: number;
  history: HistoryPoint[];
  count: number;
  generated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: '2-digit',
  });
}

function fmtNumber(n: number | null, decimals = 2): string {
  if (n == null) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function exportCsv(productCode: string, history: HistoryPoint[]): void {
  const headers = ['Report Date', 'M1 Contract', 'M1 Settlement', 'M1 Change', 'VWAP', 'Total Volume', 'Total OI', 'Spread Volume'];
  const rows = history.map((h) => [
    h.report_date,
    h.m1_contract,
    h.m1_settlement,
    h.m1_change,
    h.vwap ?? '',
    h.total_volume,
    h.total_oi,
    h.total_spread_volume,
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${productCode}_history_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function History() {
  const [productCode, setProductCode] = useState<string>('G');
  const [days, setDays] = useState<number>(180);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/products/${productCode}/report/history?days=${days}`,
          { headers: { 'X-API-Key': API_KEY } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as HistoryResponse;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [productCode, days]);

  const product = PRODUCTS.find((p) => p.code === productCode);
  const productLabel = product ? `${product.name} (${product.code})` : productCode;

  // Stats
  const stats = useMemo(() => {
    if (!data || data.history.length === 0) return null;
    const settlements = data.history.map((h) => h.m1_settlement);
    const volumes = data.history.map((h) => h.total_volume);
    return {
      min: Math.min(...settlements),
      max: Math.max(...settlements),
      avg: settlements.reduce((s, v) => s + v, 0) / settlements.length,
      latest: settlements[settlements.length - 1],
      first: settlements[0],
      totalVolume: volumes.reduce((s, v) => s + v, 0),
      avgVolume: volumes.reduce((s, v) => s + v, 0) / volumes.length,
    };
  }, [data]);

  const pctChange = stats ? ((stats.latest - stats.first) / stats.first) * 100 : 0;
  const pctColor = pctChange > 0 ? 'text-positive' : pctChange < 0 ? 'text-negative' : 'text-text-dim';

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Products</p>
        <h1 className="text-text-primary font-semibold text-base">Historical Settlements Archive</h1>
        <p className="text-text-dim text-xs mt-1">
          Complete time-series of daily ICE settlements · Exportable to CSV
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {PRODUCTS.map((p) => (
            <button
              key={p.code}
              onClick={() => setProductCode(p.code)}
              className={`px-3 py-2 rounded text-xs font-semibold border transition-colors ${
                productCode === p.code
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-card border-border text-text-secondary hover:border-accent/40'
              }`}
            >
              {p.name} ({p.code})
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {[30, 90, 180, 365, 730].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-2 rounded text-xs font-semibold border transition-colors ${
                days === d
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-card border-border text-text-secondary hover:border-accent/40'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <button
          onClick={() => data && exportCsv(productCode, data.history)}
          disabled={!data || data.history.length === 0}
          className="px-3 py-2 rounded text-xs font-semibold border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↓ Export CSV
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : error ? (
        <div className="bg-negative/10 border border-negative/30 rounded p-4 text-negative text-sm">
          {error}
        </div>
      ) : !data || data.history.length === 0 ? (
        <div className="bg-card border border-border rounded p-8 text-center">
          <p className="text-text-dim text-sm mb-2">No historical data for {productLabel}</p>
          <p className="text-text-dim text-xs">
            Upload ICE PDFs on the Products Data page to build a historical archive.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Latest" value={fmtNumber(stats.latest)} sub="$/MT" />
              <StatCard
                label={`${days}d Change`}
                value={`${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`}
                color={pctColor}
              />
              <StatCard label="Min" value={fmtNumber(stats.min)} sub="$/MT" />
              <StatCard label="Max" value={fmtNumber(stats.max)} sub="$/MT" />
              <StatCard label="Avg Daily Vol" value={fmtNumber(stats.avgVolume, 0)} sub="lots" />
            </div>
          )}

          {/* Settlement price chart */}
          <div className="bg-card border border-border rounded p-4">
            <h3 className="text-text-primary font-semibold text-sm mb-3">
              M1 Settlement — {productLabel}
            </h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={data.history} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="report_date"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(d: string) => fmtDate(d)}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    tickFormatter={(v: number) => fmtNumber(v, 0)}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }}
                    labelStyle={{ color: '#8b949e' }}
                    labelFormatter={(d) => fmtDate(d as string)}
                    formatter={(value) => {
                      const v = typeof value === 'number' ? fmtNumber(value) : String(value ?? '—');
                      return [`${v} $/MT`, 'M1 Settlement'];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="m1_settlement"
                    stroke={product?.color ?? '#6366f1'}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Volume + OI chart */}
          <div className="bg-card border border-border rounded p-4">
            <h3 className="text-text-primary font-semibold text-sm mb-3">Daily Volume &amp; Open Interest</h3>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={data.history} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="report_date"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(d: string) => fmtDate(d)}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }}
                    labelStyle={{ color: '#8b949e' }}
                    labelFormatter={(d) => fmtDate(d as string)}
                    formatter={(value) => {
                      const v = typeof value === 'number' ? value.toLocaleString() : String(value ?? '—');
                      return [`${v} lots`, ''];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                  <Bar dataKey="total_volume" name="Volume" fill="#60a5fa" />
                  <Bar dataKey="total_oi" name="Open Interest" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data table */}
          <div className="bg-card border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-text-primary font-semibold text-sm">Raw Data ({data.count} days)</h3>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface z-10">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Date</th>
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">M1</th>
                    <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Settlement</th>
                    <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Chg</th>
                    <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">VWAP</th>
                    <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Volume</th>
                    <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">OI</th>
                    <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">Spread Vol</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.history].reverse().map((h, i) => {
                    const chgColor = h.m1_change > 0 ? 'text-positive' : h.m1_change < 0 ? 'text-negative' : 'text-text-dim';
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface/40">
                        <td className="px-3 py-2 text-text-primary font-mono">{fmtDate(h.report_date)}</td>
                        <td className="px-3 py-2 text-text-secondary">{h.m1_contract}</td>
                        <td className="px-3 py-2 text-right font-mono text-text-primary font-bold">{fmtNumber(h.m1_settlement)}</td>
                        <td className={`px-3 py-2 text-right font-mono ${chgColor}`}>
                          {h.m1_change >= 0 ? '+' : ''}{h.m1_change.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-text-secondary hidden md:table-cell">{fmtNumber(h.vwap)}</td>
                        <td className="px-3 py-2 text-right font-mono text-text-secondary">{h.total_volume.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono text-text-secondary hidden md:table-cell">{h.total_oi.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono text-text-secondary hidden lg:table-cell">{h.total_spread_volume.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label, value, sub, color = 'text-text-primary',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded p-3">
      <div className="text-text-dim text-[10px] uppercase tracking-widest mb-1">{label}</div>
      <div className={`font-mono font-bold text-lg ${color}`}>{value}</div>
      {sub && <div className="text-text-dim text-[10px]">{sub}</div>}
    </div>
  );
}
