import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine,
} from 'recharts';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import { PRODUCTS } from '../../productConfig';

// ─── Types ───────────────────────────────────────────────────────────────

interface BacktestPrediction {
  date: string;
  y_true: number;
  y_pred: number;
  y_proba: number;
}

interface DirectionNotReady {
  ready: false;
  reason: string;
  n_observations: number;
  min_required: number;
  recommended: number;
  trained_at: string;
  product_code: string;
  cached: boolean;
}

interface DirectionReady {
  ready: true;
  cached: boolean;
  product_code: string;
  n_observations: number;
  data_quality: 'thin' | 'adequate' | 'good';
  min_required: number;
  recommended: number;
  trained_at: string;
  backtest: {
    n_folds: number;
    total_predictions: number;
    accuracy: number;
    precision: number;
    recall: number;
    up_days_pct: number;
    predictions: BacktestPrediction[];
  };
  feature_importance: Array<{ feature: string; importance: number }>;
  latest_prediction: {
    date: string;
    probability_up: number;
    direction: 'up' | 'down';
    confidence: number;
    forward_horizon: number;
  };
}

type DirectionResponse = DirectionReady | DirectionNotReady;

interface IForestNotReady {
  ready: false;
  reason: string;
  n_observations: number;
}

interface IForestReady {
  ready: true;
  product_code: string;
  n_observations: number;
  contamination: number;
  n_anomalies: number;
  anomalies: Array<{ date: string; score: number; is_anomaly: boolean }>;
  scores: Array<{ date: string; score: number; is_anomaly: boolean }>;
  features_used: string[];
}

type IForestResponse = IForestReady | IForestNotReady;

// ─── Helpers ─────────────────────────────────────────────────────────────

function apiGet<T>(path: string): Promise<T> {
  return fetch(`${API_BASE_URL}${path}`, { headers: { 'X-API-Key': API_KEY } }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtPct(n: number, d = 1): string {
  return `${(n * 100).toFixed(d)}%`;
}

function qualityColor(q: 'thin' | 'adequate' | 'good'): string {
  return q === 'good' ? 'text-positive' : q === 'adequate' ? 'text-accent' : 'text-negative';
}

// ─── Main page ───────────────────────────────────────────────────────────

const TABS = ['Direction Model', 'Anomaly Detector'] as const;
type Tab = (typeof TABS)[number];

export default function Forecasting() {
  const [tab, setTab] = useState<Tab>('Direction Model');

  return (
    <div className="max-w-6xl space-y-5">
      <div className="pb-3 border-b border-border">
        <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Intelligence</p>
        <h1 className="text-text-primary font-semibold text-base">Forecasting & Anomaly Models</h1>
        <p className="text-text-dim text-xs mt-1">
          XGBoost direction classifier · Isolation Forest anomalies · Walk-forward backtest
        </p>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded p-3 text-amber-400 text-xs">
        <span className="font-semibold">Honesty disclaimer:</span> ML quality scales with data size. When a product
        has fewer than ~500 observations the backtest is noisy and the live prediction is unreliable.
        <span className="text-text-secondary"> Backfill historical settlements via the Alt Data upload page to activate real forecasting.</span>
      </div>

      <div className="flex gap-1 border-b border-border">
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

      {tab === 'Direction Model' && <DirectionModelTab />}
      {tab === 'Anomaly Detector' && <AnomalyDetectorTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DIRECTION MODEL TAB
// ═══════════════════════════════════════════════════════════════════════

function DirectionModelTab() {
  const [productCode, setProductCode] = useState('G');
  const [horizon, setHorizon] = useState(5);
  const [data, setData] = useState<DirectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retraining, setRetraining] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const json = await apiGet<DirectionResponse>(
        `/ml/direction/${productCode}?days=730&forward_horizon=${horizon}${force ? '&force=true' : ''}`
      );
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to train model');
    } finally {
      setLoading(false);
      setRetraining(false);
    }
  }, [productCode, horizon]);

  useEffect(() => { void load(); }, [load]);

  const retrain = async () => {
    setRetraining(true);
    await load(true);
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
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
          {[3, 5, 10].map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                horizon === h
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-card border-border text-text-secondary hover:border-accent/40'
              }`}
            >
              {h}d fwd
            </button>
          ))}
        </div>
        <button
          onClick={retrain}
          disabled={loading || retraining}
          className="px-3 py-1.5 rounded text-xs font-semibold border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 transition-colors"
        >
          {retraining ? 'Training…' : '↻ Retrain'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : error ? (
        <div className="bg-negative/10 border border-negative/30 rounded p-4 text-negative text-sm">{error}</div>
      ) : !data ? null : !data.ready ? (
        <NotReadyBanner data={data} />
      ) : (
        <ReadyView data={data} />
      )}
    </div>
  );
}

function NotReadyBanner({ data }: { data: DirectionNotReady }) {
  return (
    <div className="bg-card border border-border rounded p-6 text-center">
      <div className="text-text-primary font-semibold text-sm mb-1">Not enough data to train</div>
      <div className="text-text-dim text-xs mb-4">{data.reason}</div>
      <div className="inline-block bg-surface/50 rounded p-3 text-left">
        <div className="text-text-secondary text-xs space-y-0.5">
          <div>Current observations: <span className="font-mono text-text-primary">{data.n_observations}</span></div>
          <div>Minimum required:   <span className="font-mono text-accent">{data.min_required}</span></div>
          <div>Recommended:        <span className="font-mono text-positive">{data.recommended}</span></div>
        </div>
      </div>
      <div className="text-text-dim text-xs mt-4">
        Upload historical data via <span className="text-accent">Alt Data</span> to activate this model.
      </div>
    </div>
  );
}

function ReadyView({ data }: { data: DirectionReady }) {
  const pred = data.latest_prediction;
  const bt = data.backtest;
  const topFeatures = data.feature_importance.slice(0, 8);

  // Rolling accuracy (30-day window) on backtest predictions
  const rollingAccuracy = bt.predictions.map((p, i) => {
    const start = Math.max(0, i - 29);
    const slice = bt.predictions.slice(start, i + 1);
    const hits = slice.filter((x) => x.y_true === x.y_pred).length;
    return {
      date: p.date,
      accuracy: (hits / slice.length) * 100,
      proba: p.y_proba * 100,
    };
  });

  return (
    <div className="space-y-5">
      {/* Latest prediction card */}
      <div className="bg-card border border-border rounded p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Latest Prediction</div>
            <div className="text-text-secondary text-xs">
              {pred.forward_horizon}-day forward direction · as of {fmtDate(pred.date)}
            </div>
          </div>
          <div className={`px-4 py-2 rounded font-bold text-lg ${
            pred.direction === 'up'
              ? 'bg-positive/10 text-positive border border-positive/20'
              : 'bg-negative/10 text-negative border border-negative/20'
          }`}>
            {pred.direction === 'up' ? '↑ UP' : '↓ DOWN'}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="P(up)" value={fmtPct(pred.probability_up)} color={pred.probability_up > 0.5 ? 'text-positive' : 'text-negative'} />
          <StatCard label="Confidence" value={fmtPct(pred.confidence)} sub="|p - 0.5| × 2" />
          <StatCard label="Observations" value={data.n_observations.toString()} />
          <StatCard
            label="Data Quality"
            value={data.data_quality.toUpperCase()}
            color={qualityColor(data.data_quality)}
            sub={`min ${data.min_required} · rec ${data.recommended}`}
          />
        </div>
      </div>

      {/* Backtest summary */}
      <div className="bg-card border border-border rounded p-5">
        <div className="mb-3">
          <h3 className="text-text-primary font-semibold text-sm">Walk-Forward Backtest</h3>
          <p className="text-text-dim text-xs mt-0.5">
            Expanding window. Trained on past, evaluated only on future predictions — no lookahead bias.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Accuracy" value={fmtPct(bt.accuracy)} color={bt.accuracy > bt.up_days_pct + 0.05 ? 'text-positive' : bt.accuracy < bt.up_days_pct - 0.05 ? 'text-negative' : 'text-text-primary'} />
          <StatCard label="Precision" value={fmtPct(bt.precision)} sub="when pred up, fraction right" />
          <StatCard label="Recall" value={fmtPct(bt.recall)} sub="of actual ups, fraction caught" />
          <StatCard label="Base rate" value={fmtPct(bt.up_days_pct)} sub="% of days that went up" />
        </div>
        <div className="text-text-dim text-[11px] italic mb-2">
          {bt.accuracy - bt.up_days_pct > 0.03
            ? `✓ Model beats the naive "always up" baseline by ${((bt.accuracy - bt.up_days_pct) * 100).toFixed(1)} pp.`
            : bt.accuracy - bt.up_days_pct < -0.03
            ? `⚠ Model underperforms the naive baseline by ${((bt.up_days_pct - bt.accuracy) * 100).toFixed(1)} pp. More data needed.`
            : '≈ Model is roughly tied with the naive baseline. Likely too little data.'}
        </div>
        {rollingAccuracy.length > 0 && (
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={rollingAccuracy} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtDate} interval="preserveStartEnd" minTickGap={40} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }} labelFormatter={(d) => fmtDate(d as string)} />
                <ReferenceLine y={50} stroke="#64748b" strokeDasharray="2 4" label={{ value: '50%', fill: '#64748b', fontSize: 10 }} />
                <Line type="monotone" dataKey="accuracy" stroke="#60a5fa" strokeWidth={2} dot={false} name="Rolling 30d accuracy" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Feature importance */}
      <div className="bg-card border border-border rounded p-5">
        <h3 className="text-text-primary font-semibold text-sm mb-3">Feature Importance</h3>
        <p className="text-text-dim text-xs mb-3">
          Which features the model relied on most. Higher = more influential.
        </p>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={topFeatures} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="feature" tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} width={95} />
              <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }} />
              <Bar dataKey="importance" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = 'text-text-primary' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-surface/50 rounded p-3">
      <div className="text-text-dim text-[10px] uppercase tracking-widest mb-1">{label}</div>
      <div className={`font-mono font-bold text-base ${color}`}>{value}</div>
      {sub && <div className="text-text-dim text-[10px] mt-0.5">{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ANOMALY DETECTOR TAB
// ═══════════════════════════════════════════════════════════════════════

function AnomalyDetectorTab() {
  const [productCode, setProductCode] = useState('G');
  const [contamination, setContamination] = useState(0.05);
  const [data, setData] = useState<IForestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await apiGet<IForestResponse>(
          `/ml/anomalies/${productCode}?days=365&contamination=${contamination}`
        );
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to run detector');
      } finally {
        setLoading(false);
      }
    })();
  }, [productCode, contamination]);

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
          {[0.02, 0.05, 0.10].map((c) => (
            <button
              key={c}
              onClick={() => setContamination(c)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                contamination === c
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-card border-border text-text-secondary hover:border-accent/40'
              }`}
              title={`Expect ${(c*100).toFixed(0)}% of days flagged`}
            >
              {(c * 100).toFixed(0)}%
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : error ? (
        <div className="bg-negative/10 border border-negative/30 rounded p-4 text-negative text-sm">{error}</div>
      ) : !data ? null : !data.ready ? (
        <div className="bg-card border border-border rounded p-6 text-center">
          <div className="text-text-primary font-semibold text-sm mb-1">Not enough data</div>
          <div className="text-text-dim text-xs">{data.reason}</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Observations" value={data.n_observations.toString()} />
            <StatCard label="Contamination" value={`${(data.contamination * 100).toFixed(0)}%`} sub="expected anomaly rate" />
            <StatCard label="Flagged" value={data.n_anomalies.toString()} color={data.n_anomalies > 0 ? 'text-negative' : 'text-text-primary'} />
            <StatCard label="Features" value={data.features_used.length.toString()} sub="engineered inputs" />
          </div>

          <div className="bg-card border border-border rounded p-5">
            <h3 className="text-text-primary font-semibold text-sm mb-1">Anomaly Score Over Time</h3>
            <p className="text-text-dim text-xs mb-3">
              Isolation Forest score per day. Lower = more anomalous. Red dots = flagged anomalies.
            </p>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={data.scores} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtDate} interval="preserveStartEnd" minTickGap={40} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }} labelFormatter={(d) => fmtDate(d as string)} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="2 4" />
                  <Line type="monotone" dataKey="score" stroke="#60a5fa" strokeWidth={1.5} dot={(p) => {
                    if (!p) return <circle r={0} />;
                    const payload = p.payload as { is_anomaly?: boolean } | undefined;
                    if (!payload?.is_anomaly) return <circle r={0} />;
                    return <circle cx={p.cx} cy={p.cy} r={3} fill="#ef4444" />;
                  }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {data.anomalies.length > 0 && (
            <div className="bg-card border border-border rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-text-primary font-semibold text-sm">Flagged Days ({data.n_anomalies})</h3>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface z-10">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Date</th>
                      <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.anomalies.slice().reverse().map((a, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface/40">
                        <td className="px-3 py-2 font-mono text-text-primary">{fmtDate(a.date)}</td>
                        <td className="px-3 py-2 text-right font-mono text-negative font-bold">{a.score.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
