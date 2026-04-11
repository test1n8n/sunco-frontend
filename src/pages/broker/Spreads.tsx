import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpreadHistoryPoint {
  date: string;
  value: number;
}

interface Spread {
  label: string;
  description: string;
  leg_a: string;
  leg_b: string;
  leg_a_name: string;
  leg_b_name: string;
  current: number;
  leg_a_value: number;
  leg_b_value: number;
  contract: string;
  daily_change: number | null;
  week_change: number | null;
  month_change: number | null;
  history: SpreadHistoryPoint[];
}

interface SpreadsResponse {
  spreads: Spread[];
  products_with_data: string[];
  generated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatChange(n: number | null): { text: string; color: string } {
  if (n == null) return { text: '—', color: 'text-text-dim' };
  const sign = n >= 0 ? '+' : '';
  const color = n > 0 ? 'text-positive' : n < 0 ? 'text-negative' : 'text-text-dim';
  return { text: `${sign}${n.toFixed(2)}`, color };
}

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ─── Spread Card ──────────────────────────────────────────────────────────────

function SpreadCard({ spread }: { spread: Spread }) {
  const daily = formatChange(spread.daily_change);
  const week = formatChange(spread.week_change);
  const month = formatChange(spread.month_change);

  // Min/max for chart y-axis context
  const values = spread.history.map((p) => p.value);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;

  // Signal strength color based on absolute current value
  const currentAbs = Math.abs(spread.current);
  const strengthColor = currentAbs > 100
    ? '#ef4444'
    : currentAbs > 50
    ? '#f59e0b'
    : '#10b981';

  return (
    <div className="bg-card border border-border rounded p-4 hover:border-accent/40 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-text-primary font-bold text-base">{spread.label}</h3>
          <p className="text-text-dim text-[11px] mt-0.5 leading-snug">{spread.description}</p>
          <p className="text-text-dim text-[10px] mt-1 font-mono">
            {spread.leg_a_name} ({formatNumber(spread.leg_a_value)}) − {spread.leg_b_name} ({formatNumber(spread.leg_b_value)}) · {spread.contract}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-text-dim text-[9px] uppercase tracking-widest">Current</div>
          <div className="font-mono font-bold text-xl" style={{ color: strengthColor }}>
            {spread.current >= 0 ? '+' : ''}{formatNumber(spread.current)}
          </div>
          <div className="text-text-dim text-[9px]">$/MT</div>
        </div>
      </div>

      {/* Change metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-[11px]">
        <div className="bg-surface border border-border rounded px-2 py-1.5 text-center">
          <div className="text-text-dim text-[9px] uppercase tracking-widest">1D</div>
          <div className={`font-mono font-bold ${daily.color}`}>{daily.text}</div>
        </div>
        <div className="bg-surface border border-border rounded px-2 py-1.5 text-center">
          <div className="text-text-dim text-[9px] uppercase tracking-widest">1W</div>
          <div className={`font-mono font-bold ${week.color}`}>{week.text}</div>
        </div>
        <div className="bg-surface border border-border rounded px-2 py-1.5 text-center">
          <div className="text-text-dim text-[9px] uppercase tracking-widest">1M</div>
          <div className={`font-mono font-bold ${month.color}`}>{month.text}</div>
        </div>
      </div>

      {/* Sparkline */}
      {spread.history.length >= 2 ? (
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spread.history} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }}
                labelStyle={{ color: '#8b949e' }}
                formatter={(value) => {
                  const v = typeof value === 'number' ? value.toFixed(2) : String(value ?? '—');
                  return [`${v} $/MT`, ''];
                }}
              />
              <Line type="monotone" dataKey="value" stroke={strengthColor} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-20 flex items-center justify-center text-text-dim text-[11px] italic">
          Need at least 2 data points for history
        </div>
      )}
      <div className="flex items-center justify-between text-[10px] text-text-dim mt-1">
        <span>{spread.history.length} data points</span>
        <span>min {formatNumber(min)} · max {formatNumber(max)}</span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Spreads() {
  const [data, setData] = useState<SpreadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/spreads`, {
          headers: { 'X-API-Key': API_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as SpreadsResponse;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load spreads');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading && !data) {
    return <div className="flex items-center justify-center py-20"><Spinner /></div>;
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl">
        <div className="bg-negative/10 border border-negative/30 rounded p-4 text-negative text-sm">
          Failed to load spreads: {error ?? 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Analytics</p>
        <h1 className="text-text-primary font-semibold text-base">Cross-Product Spreads &amp; Arbitrage</h1>
        <p className="text-text-dim text-xs mt-1">
          Computed from the latest ICE settlements · All biodiesel spreads shown as diff vs LS Gasoil · Updated {new Date(data.generated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Summary pill */}
      <div className="bg-accent/5 border border-accent/20 rounded p-3">
        <p className="text-text-secondary text-xs">
          📊 <strong className="text-text-primary">{data.spreads.length} spreads</strong> computed from{' '}
          <span className="font-mono">{data.products_with_data.join(' · ')}</span>.
          Each spread is the difference between two biodiesel diffs (both quoted vs gasoil),
          so it isolates the cross-product premium independent of gasoil moves.
        </p>
      </div>

      {/* Spread cards grid */}
      {data.spreads.length === 0 ? (
        <div className="bg-card border border-border rounded p-8 text-center">
          <p className="text-text-dim text-sm">
            No spreads available. Upload the latest ICE PDFs for at least 2 biodiesel products.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.spreads.map((s, i) => (
            <SpreadCard key={i} spread={s} />
          ))}
        </div>
      )}

      {/* Interpretation note */}
      <div className="bg-surface/30 border border-border/50 rounded p-4">
        <p className="text-text-dim text-[11px] italic leading-relaxed">
          💡 <strong className="text-text-secondary">How to read these:</strong> A positive spread (e.g. HVO − UCOME = +80)
          means the first product is trading at a premium to the second. When the spread widens, the first product is
          outperforming; when it narrows, the second is outperforming. Watch the 1D / 1W / 1M change columns to spot
          breakouts. Large absolute values (red) indicate structural premiums worth monitoring.
        </p>
      </div>
    </div>
  );
}
