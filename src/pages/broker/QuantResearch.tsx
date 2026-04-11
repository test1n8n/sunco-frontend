import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, ComposedChart, Area,
} from 'recharts';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import { PRODUCTS } from '../../productConfig';

// ─── Types (shape the backend returns) ──────────────────────────────────────

type Result<T> = ({ ok: true } & T) | { ok: false; reason: string };

interface Descriptive {
  n: number;
  first_date: string;
  last_date: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  p25: number;
  p50: number;
  p75: number;
  skew: number | null;
  kurtosis: number | null;
  daily_return_mean_pct: number | null;
  daily_return_std_pct: number | null;
  annualized_vol_pct: number | null;
}

interface ZScoreLatest {
  window: number;
  last_date: string;
  last_value: number;
  rolling_mean: number;
  rolling_std: number;
  z: number;
  interpretation: string;
}

// (ZScorePoint and StatsResponse types will be re-added when the per-product stats sub-tab is wired.)

interface SpreadResult {
  label: string;
  n: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  current: number;
  current_date: string;
  half_life_days: number | null;
  zscore: Result<ZScoreLatest>;
  series: Array<{ date: string; spread: number }>;
}

interface CointResult {
  n: number;
  tstat: number;
  pvalue: number;
  critical_values: { '1%': number; '5%': number; '10%': number };
  verdict: string;
}

interface SpreadResponse {
  leg_a: string;
  leg_b: string;
  spread: Result<SpreadResult>;
  cointegration: Result<CointResult>;
}

interface CorrMatrixResult {
  products: string[];
  matrix: Array<{ product: string; values: (number | null)[] }>;
  n_observations: number;
  window_start: string;
  window_end: string;
}

interface CorrResponse {
  days: number;
  result: Result<CorrMatrixResult>;
}

interface VolRegimeResult {
  window: number;
  median_vol_pct: number;
  current_vol_pct: number;
  current_regime: string;
  pct_time_stressed: number;
  series: Array<{ date: string; realized_vol_pct: number; regime: string }>;
}

interface VolResponse {
  product_code: string;
  result: Result<VolRegimeResult>;
}

interface AnomalyRow {
  date: string;
  return_pct: number;
  z: number;
  direction: 'up' | 'down';
}

interface AnomalyResponse {
  product_code: string;
  anomalies: AnomalyRow[];
  count: number;
}

interface OverviewProduct {
  product_code: string;
  available: boolean;
  n: number;
  descriptive?: Result<Descriptive>;
  zscore_latest?: Result<ZScoreLatest>;
  volatility?: Result<VolRegimeResult>;
}

interface OverviewResponse {
  days: number;
  coverage: Record<string, number>;
  products: OverviewProduct[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Spreads', 'Correlations', 'Volatility', 'Anomalies'] as const;
type Tab = (typeof TABS)[number];

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtPct(n: number | null | undefined, d = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(d)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function zColor(z: number | null | undefined): string {
  if (z == null || Number.isNaN(z)) return 'text-text-dim';
  const abs = Math.abs(z);
  if (abs >= 2.5) return 'text-negative';
  if (abs >= 2.0) return 'text-accent';
  if (abs >= 1.0) return 'text-text-primary';
  return 'text-text-secondary';
}

function apiGet<T>(path: string): Promise<T> {
  return fetch(`${API_BASE_URL}${path}`, { headers: { 'X-API-Key': API_KEY } }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  });
}

// ─── Reusable bits ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = 'text-text-primary',
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

function ErrorBox({ reason }: { reason: string }) {
  return (
    <div className="bg-negative/10 border border-negative/30 rounded p-4 text-negative text-sm">
      {reason}
    </div>
  );
}

function InsufficientData({ reason }: { reason: string }) {
  return (
    <div className="bg-card border border-border rounded p-4 text-text-dim text-xs italic">
      Insufficient data: {reason}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await apiGet<OverviewResponse>('/quant/overview?days=180');
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load overview');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;
  if (error) return <ErrorBox reason={error} />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded p-4">
        <h3 className="text-text-primary font-semibold text-sm mb-1">Data Coverage</h3>
        <p className="text-text-dim text-xs mb-3">
          Number of ICE settlement records stored per product. More data = more reliable statistics.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {Object.entries(data.coverage).map(([code, n]) => {
            const label = PRODUCTS.find((p) => p.code === code)?.name ?? code;
            const color = n >= 60 ? 'text-positive' : n >= 20 ? 'text-accent' : 'text-negative';
            return (
              <div key={code} className="bg-surface/50 rounded p-2 text-center">
                <div className="text-text-dim text-[10px] uppercase">{label}</div>
                <div className={`font-mono font-bold ${color}`}>{n}</div>
                <div className="text-text-dim text-[9px]">observations</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-text-primary font-semibold text-sm">Per-Product Snapshot</h3>
          <p className="text-text-dim text-xs mt-0.5">
            Latest reading · {data.days}-day rolling window
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Product</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Last</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Mean</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Z-Score</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Ann. Vol</th>
                <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Regime</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p) => {
                if (!p.available) {
                  return (
                    <tr key={p.product_code} className="border-b border-border/50">
                      <td className="px-3 py-2 text-text-secondary">{p.product_code}</td>
                      <td colSpan={6} className="px-3 py-2 text-text-dim italic">No data</td>
                    </tr>
                  );
                }
                const desc = p.descriptive?.ok ? p.descriptive : null;
                const z = p.zscore_latest?.ok ? p.zscore_latest : null;
                const vol = p.volatility?.ok ? p.volatility : null;
                return (
                  <tr key={p.product_code} className="border-b border-border/50 hover:bg-surface/40">
                    <td className="px-3 py-2 text-text-primary font-semibold">{p.product_code}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-primary">{fmt(z?.last_value)}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary hidden md:table-cell">{fmt(z?.rolling_mean)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${zColor(z?.z)}`}>{fmt(z?.z)}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary hidden md:table-cell">{fmtPct(desc?.annualized_vol_pct)}</td>
                    <td className="px-3 py-2 text-center">
                      {vol && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          vol.current_regime === 'stressed'
                            ? 'bg-negative/10 text-negative border border-negative/20'
                            : 'bg-positive/10 text-positive border border-positive/20'
                        }`}>
                          {vol.current_regime}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-text-secondary text-[10px] hidden lg:table-cell">{z?.interpretation ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border rounded p-4">
        <h3 className="text-text-primary font-semibold text-sm mb-2">How to Read This</h3>
        <ul className="text-text-secondary text-xs space-y-1 list-disc list-inside">
          <li><span className="font-semibold text-text-primary">Z-score ±2σ</span> = extreme vs recent history. Watch for mean reversion.</li>
          <li><span className="font-semibold text-text-primary">Annualized vol</span> = daily log-return std × √252. Higher = riskier.</li>
          <li><span className="font-semibold text-text-primary">Regime</span> = stressed if rolling vol is above its own long-run median.</li>
          <li>These are <span className="italic">descriptive</span> signals, not forecasts. Forecasting models will be added in Phase 3.</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SPREADS TAB
// ═══════════════════════════════════════════════════════════════════════════

const PAIR_PRESETS: Array<{ label: string; a: string; b: string }> = [
  { label: 'FAME0 - Gasoil', a: 'BFZ', b: 'G' },
  { label: 'RME - Gasoil',   a: 'BRI', b: 'G' },
  { label: 'UCOME - FAME0',  a: 'UCR', b: 'BFZ' },
  { label: 'HVO - Gasoil',   a: 'HVO', b: 'G' },
  { label: 'SAF - Gasoil',   a: 'ZAF', b: 'G' },
  { label: 'UCOME - RME',    a: 'UCR', b: 'BRI' },
];

function SpreadsTab() {
  const [legA, setLegA] = useState('BFZ');
  const [legB, setLegB] = useState('G');
  const [data, setData] = useState<SpreadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await apiGet<SpreadResponse>(`/quant/spread?leg_a=${legA}&leg_b=${legB}&days=365&window=60`);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spread');
    } finally {
      setLoading(false);
    }
  }, [legA, legB]);

  useEffect(() => { void load(); }, [load]);

  const spread = data?.spread.ok ? data.spread : null;
  const coint = data?.cointegration.ok ? data.cointegration : null;
  const zLatest = spread?.zscore.ok ? spread.zscore : null;

  return (
    <div className="space-y-5">
      {/* Pair selector */}
      <div className="flex flex-wrap items-center gap-2">
        {PAIR_PRESETS.map((p) => {
          const active = legA === p.a && legB === p.b;
          return (
            <button
              key={p.label}
              onClick={() => { setLegA(p.a); setLegB(p.b); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                active
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-card border-border text-text-secondary hover:border-accent/40'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : error ? (
        <ErrorBox reason={error} />
      ) : !data ? null : (
        <>
          {data.spread.ok === false ? (
            <InsufficientData reason={data.spread.reason} />
          ) : spread ? (
            <>
              {/* Stat grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label="Current" value={fmt(spread.current)} sub={fmtDate(spread.current_date)} />
                <StatCard label="Mean" value={fmt(spread.mean)} sub="Full window" />
                <StatCard label="Std Dev" value={fmt(spread.std)} />
                <StatCard
                  label="Z-Score"
                  value={fmt(zLatest?.z)}
                  color={zColor(zLatest?.z)}
                  sub={zLatest?.interpretation ?? '—'}
                />
                <StatCard
                  label="Half-Life"
                  value={spread.half_life_days != null ? `${spread.half_life_days.toFixed(0)} d` : '—'}
                  sub={spread.half_life_days != null ? 'Mean-reversion speed' : 'Not mean-reverting'}
                />
              </div>

              {/* Spread chart with ±1σ and ±2σ bands */}
              <div className="bg-card border border-border rounded p-4">
                <h3 className="text-text-primary font-semibold text-sm mb-3">
                  {spread.label} — Historical Spread
                </h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={spread.series} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={fmtDate}
                        interval="preserveStartEnd"
                        minTickGap={40}
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                      />
                      <Tooltip
                        contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }}
                        labelFormatter={(d) => fmtDate(d as string)}
                        formatter={(v) => [typeof v === 'number' ? fmt(v) : v, 'Spread']}
                      />
                      <ReferenceLine y={spread.mean} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'μ', fill: '#f59e0b', fontSize: 10 }} />
                      <ReferenceLine y={spread.mean + spread.std} stroke="#64748b" strokeDasharray="2 4" />
                      <ReferenceLine y={spread.mean - spread.std} stroke="#64748b" strokeDasharray="2 4" />
                      <ReferenceLine y={spread.mean + 2 * spread.std} stroke="#ef4444" strokeDasharray="2 4" label={{ value: '+2σ', fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine y={spread.mean - 2 * spread.std} stroke="#ef4444" strokeDasharray="2 4" label={{ value: '-2σ', fill: '#ef4444', fontSize: 10 }} />
                      <Line type="monotone" dataKey="spread" stroke="#60a5fa" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Cointegration card */}
              <div className="bg-card border border-border rounded p-4">
                <h3 className="text-text-primary font-semibold text-sm mb-2">Cointegration (Engle-Granger)</h3>
                <p className="text-text-dim text-xs mb-3">
                  Tests whether the spread is statistically stationary. A cointegrated pair has a theoretical basis for mean reversion.
                </p>
                {data.cointegration.ok === false ? (
                  <InsufficientData reason={data.cointegration.reason} />
                ) : coint ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="T-Statistic" value={fmt(coint.tstat, 3)} />
                    <StatCard label="P-Value" value={fmt(coint.pvalue, 4)} color={coint.pvalue < 0.05 ? 'text-positive' : 'text-text-primary'} />
                    <StatCard label="Critical (5%)" value={fmt(coint.critical_values['5%'], 3)} />
                    <StatCard label="Verdict" value={coint.verdict} color={coint.pvalue < 0.05 ? 'text-positive' : 'text-text-dim'} />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CORRELATIONS TAB
// ═══════════════════════════════════════════════════════════════════════════

function CorrelationsTab() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<CorrResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await apiGet<CorrResponse>(`/quant/correlations?days=${days}&use_returns=true`);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load correlations');
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {[30, 60, 90, 180, 365].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              days === d
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-card border-border text-text-secondary hover:border-accent/40'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : error ? (
        <ErrorBox reason={error} />
      ) : !data ? null : data.result.ok === false ? (
        <InsufficientData reason={data.result.reason} />
      ) : (
        <>
          <div className="bg-card border border-border rounded p-4">
            <h3 className="text-text-primary font-semibold text-sm mb-1">
              Return Correlation Matrix
            </h3>
            <p className="text-text-dim text-xs mb-3">
              Pearson correlation of daily returns · {data.result.n_observations} aligned days · {fmtDate(data.result.window_start)} → {fmtDate(data.result.window_end)}
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs font-mono">
                <thead>
                  <tr>
                    <th className="px-3 py-2"></th>
                    {data.result.products.map((p) => (
                      <th key={p} className="px-3 py-2 text-text-dim">{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.result.matrix.map((row) => (
                    <tr key={row.product}>
                      <td className="px-3 py-2 font-semibold text-text-dim">{row.product}</td>
                      {row.values.map((v, i) => {
                        const val = v ?? 0;
                        const bg = corrColor(val);
                        return (
                          <td key={i} className="px-3 py-2 text-center" style={{ background: bg }}>
                            <span className={Math.abs(val) > 0.5 ? 'text-text-primary font-bold' : 'text-text-secondary'}>
                              {v == null ? '—' : val.toFixed(2)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card border border-border rounded p-4">
            <h3 className="text-text-primary font-semibold text-sm mb-2">Reading the Matrix</h3>
            <ul className="text-text-secondary text-xs space-y-1 list-disc list-inside">
              <li><span className="text-positive font-semibold">Green</span> = positive correlation (move together)</li>
              <li><span className="text-negative font-semibold">Red</span> = negative correlation (move opposite)</li>
              <li>When correlations <span className="italic">break</span> vs history, that&apos;s often a signal of market regime change</li>
              <li>Spread trades are most attractive on pairs with historically high correlation</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function corrColor(v: number): string {
  // Map [-1, 1] → a soft green/red background.
  const alpha = Math.min(0.4, Math.abs(v) * 0.4);
  if (v >= 0) return `rgba(34, 197, 94, ${alpha})`;
  return `rgba(239, 68, 68, ${alpha})`;
}

// ═══════════════════════════════════════════════════════════════════════════
// VOLATILITY TAB
// ═══════════════════════════════════════════════════════════════════════════

function VolatilityTab() {
  const [productCode, setProductCode] = useState('G');
  const [data, setData] = useState<VolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await apiGet<VolResponse>(`/quant/volatility/${productCode}?days=365&window=20`);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load volatility');
      } finally {
        setLoading(false);
      }
    })();
  }, [productCode]);

  const vol = data?.result.ok ? data.result : null;

  // Compute stressed regions for shading
  const stressBands = useMemo(() => {
    if (!vol?.series) return [];
    const bands: Array<{ start: string; end: string }> = [];
    let inStress = false;
    let startIdx = 0;
    vol.series.forEach((pt, i) => {
      if (pt.regime === 'stressed' && !inStress) {
        inStress = true;
        startIdx = i;
      }
      if (pt.regime !== 'stressed' && inStress) {
        inStress = false;
        bands.push({ start: vol.series[startIdx].date, end: vol.series[i - 1]?.date ?? pt.date });
      }
    });
    if (inStress && vol.series.length > 0) {
      bands.push({ start: vol.series[startIdx].date, end: vol.series[vol.series.length - 1].date });
    }
    return bands;
  }, [vol]);

  return (
    <div className="space-y-5">
      <div className="flex gap-1 flex-wrap">
        {PRODUCTS.map((p) => (
          <button
            key={p.code}
            onClick={() => setProductCode(p.code)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              productCode === p.code
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-card border-border text-text-secondary hover:border-accent/40'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : error ? (
        <ErrorBox reason={error} />
      ) : !data ? null : data.result.ok === false ? (
        <InsufficientData reason={data.result.reason} />
      ) : vol ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Current Vol (ann.)" value={fmtPct(vol.current_vol_pct)} />
            <StatCard label="Median Vol" value={fmtPct(vol.median_vol_pct)} />
            <StatCard
              label="Regime"
              value={vol.current_regime.toUpperCase()}
              color={vol.current_regime === 'stressed' ? 'text-negative' : 'text-positive'}
            />
            <StatCard label="% Time Stressed" value={fmtPct(vol.pct_time_stressed)} sub="Full window" />
          </div>

          <div className="bg-card border border-border rounded p-4">
            <h3 className="text-text-primary font-semibold text-sm mb-3">Realized Volatility — {productCode}</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <ComposedChart data={vol.series} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={fmtDate}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }}
                    labelFormatter={(d) => fmtDate(d as string)}
                    formatter={(v) => [typeof v === 'number' ? `${v.toFixed(1)}%` : v, 'Ann. Vol']}
                  />
                  {stressBands.map((b, i) => (
                    <ReferenceArea key={i} x1={b.start} x2={b.end} fill="#ef4444" fillOpacity={0.08} />
                  ))}
                  <ReferenceLine y={vol.median_vol_pct} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'median', fill: '#f59e0b', fontSize: 10 }} />
                  <Area type="monotone" dataKey="realized_vol_pct" stroke="#60a5fa" strokeWidth={2} fill="#60a5fa" fillOpacity={0.15} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANOMALIES TAB
// ═══════════════════════════════════════════════════════════════════════════

function AnomaliesTab() {
  const [productCode, setProductCode] = useState('G');
  const [threshold, setThreshold] = useState(2.5);
  const [data, setData] = useState<AnomalyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await apiGet<AnomalyResponse>(`/quant/anomalies/${productCode}?days=365&window=60&threshold_z=${threshold}`);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load anomalies');
      } finally {
        setLoading(false);
      }
    })();
  }, [productCode, threshold]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {PRODUCTS.map((p) => (
            <button
              key={p.code}
              onClick={() => setProductCode(p.code)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                productCode === p.code
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-card border-border text-text-secondary hover:border-accent/40'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {[2.0, 2.5, 3.0].map((t) => (
            <button
              key={t}
              onClick={() => setThreshold(t)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                threshold === t
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-card border-border text-text-secondary hover:border-accent/40'
              }`}
            >
              ≥ {t}σ
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : error ? (
        <ErrorBox reason={error} />
      ) : !data ? null : (
        <div className="bg-card border border-border rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-text-primary font-semibold text-sm">
              Unusual Return Days — {productCode}
              <span className="ml-2 text-text-dim text-xs font-normal">({data.count} flagged)</span>
            </h3>
            <p className="text-text-dim text-xs mt-0.5">
              Days where the 1-day log return was ≥{threshold}σ relative to its prior 60-day rolling distribution.
            </p>
          </div>
          {data.anomalies.length === 0 ? (
            <div className="p-8 text-center text-text-dim text-sm">
              No anomalies detected at this threshold — market has been well-behaved.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface z-10">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Date</th>
                    <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Return</th>
                    <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Z-Score</th>
                    <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {data.anomalies.slice().reverse().map((a, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface/40">
                      <td className="px-3 py-2 font-mono text-text-primary">{fmtDate(a.date)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-bold ${a.direction === 'up' ? 'text-positive' : 'text-negative'}`}>
                        {a.return_pct >= 0 ? '+' : ''}{a.return_pct.toFixed(2)}%
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${zColor(a.z)}`}>{a.z.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          a.direction === 'up'
                            ? 'bg-positive/10 text-positive border border-positive/20'
                            : 'bg-negative/10 text-negative border border-negative/20'
                        }`}>
                          {a.direction.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function QuantResearch() {
  const [tab, setTab] = useState<Tab>('Overview');

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Research</p>
        <h1 className="text-text-primary font-semibold text-base">Quantitative Research Workbench</h1>
        <p className="text-text-dim text-xs mt-1">
          Descriptive statistics and classical econometrics · Phase 1 · No ML yet
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold tracking-wide uppercase transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'text-accent border-accent'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'Overview' && <OverviewTab />}
        {tab === 'Spreads' && <SpreadsTab />}
        {tab === 'Correlations' && <CorrelationsTab />}
        {tab === 'Volatility' && <VolatilityTab />}
        {tab === 'Anomalies' && <AnomaliesTab />}
      </div>
    </div>
  );
}
