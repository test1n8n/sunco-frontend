import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import { exportToCSV } from '../../utils/csvExport';

interface TopProduct {
  product: string;
  volume_mt: number;
}

interface CounterpartyRow {
  counterparty: string;
  total_volume_mt: number;
  buy_volume_mt: number;
  sell_volume_mt: number;
  trade_count: number;
  brokerage_earned_usd: number;
  first_trade_date: string;
  last_trade_date: string;
  days_since_last_trade: number;
  freshness: 'active' | 'cooling' | 'dormant';
  top_products: TopProduct[];
  broker_count: number;
  brokers: string[];
}

interface CounterpartiesResponse {
  counterparties: CounterpartyRow[];
  total_count: number;
  generated_at: string;
}

function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Counterparties() {
  const [data, setData] = useState<CounterpartiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'volume' | 'recency' | 'count' | 'brokerage'>('volume');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/counterparties`, {
          headers: { 'X-API-Key': API_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as CounterpartiesResponse;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load counterparties');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.counterparties;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.counterparty.toLowerCase().includes(q));
    }
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'recency':
          return a.days_since_last_trade - b.days_since_last_trade;
        case 'count':
          return b.trade_count - a.trade_count;
        case 'brokerage':
          return b.brokerage_earned_usd - a.brokerage_earned_usd;
        default:
          return b.total_volume_mt - a.total_volume_mt;
      }
    });
    return sorted;
  }, [data, search, sortBy]);

  if (loading && !data) {
    return <div className="flex items-center justify-center py-20"><Spinner /></div>;
  }
  if (error || !data) {
    return (
      <div className="max-w-4xl">
        <div className="bg-negative/10 border border-negative/30 rounded p-4 text-negative text-sm">
          Failed to load: {error ?? 'Unknown error'}
        </div>
      </div>
    );
  }

  const counterparties = data.counterparties;
  const active = counterparties.filter((c) => c.freshness === 'active').length;
  const cooling = counterparties.filter((c) => c.freshness === 'cooling').length;
  const dormant = counterparties.filter((c) => c.freshness === 'dormant').length;
  const totalVolume = counterparties.reduce((s, c) => s + c.total_volume_mt, 0);
  const totalBrokerage = counterparties.reduce((s, c) => s + c.brokerage_earned_usd, 0);

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Counterparty CRM</p>
        <h1 className="text-text-primary font-semibold text-base">Trading Relationships &amp; Activity Tracker</h1>
        <p className="text-text-dim text-xs mt-1">
          Aggregated from the Trade Blotter · Flags cooling relationships so you can reach out
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Total Counterparties" value={String(data.total_count)} />
        <MetricCard label="Active (<14d)" value={String(active)} color="text-positive" />
        <MetricCard label="Cooling (14-45d)" value={String(cooling)} color="text-accent" />
        <MetricCard label="Dormant (>45d)" value={String(dormant)} color="text-negative" />
        <MetricCard label="YTD Brokerage" value={`$${formatNumber(totalBrokerage)}`} sub={`${formatNumber(totalVolume)} MT`} />
      </div>

      {/* Dormant callout */}
      {dormant > 0 && (
        <div className="bg-negative/5 border border-negative/20 rounded p-4">
          <p className="text-negative text-xs font-semibold mb-1">⚠️ {dormant} dormant {dormant === 1 ? 'relationship' : 'relationships'} to reach out to</p>
          <p className="text-text-secondary text-xs">
            These counterparties haven't traded with Sunco in over 45 days. Consider reaching out to re-engage.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {counterparties
              .filter((c) => c.freshness === 'dormant')
              .slice(0, 10)
              .map((c, i) => (
                <span key={i} className="text-[11px] bg-negative/10 text-negative border border-negative/30 px-2 py-0.5 rounded">
                  {c.counterparty} ({c.days_since_last_trade}d)
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Search + Sort controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search counterparty..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50"
        />
        <div className="flex gap-1">
          {(['volume', 'recency', 'count', 'brokerage'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-2 rounded text-xs font-semibold border transition-colors ${
                sortBy === s
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-card border-border text-text-secondary hover:border-accent/40'
              }`}
            >
              Sort: {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => exportToCSV(
            `counterparties_${new Date().toISOString().slice(0, 10)}`,
            filtered.map((c) => ({
              counterparty: c.counterparty,
              freshness: c.freshness,
              total_volume_mt: c.total_volume_mt,
              buy_volume_mt: c.buy_volume_mt,
              sell_volume_mt: c.sell_volume_mt,
              trade_count: c.trade_count,
              brokerage_earned_usd: c.brokerage_earned_usd,
              first_trade_date: c.first_trade_date,
              last_trade_date: c.last_trade_date,
              days_since_last_trade: c.days_since_last_trade,
              top_products: c.top_products.map((p) => `${p.product}:${p.volume_mt}`).join('; '),
              brokers: c.brokers.join('; '),
            })),
            [
              { key: 'counterparty',          label: 'Counterparty' },
              { key: 'freshness',             label: 'Status' },
              { key: 'total_volume_mt',       label: 'Total Volume (MT)' },
              { key: 'buy_volume_mt',         label: 'Buy Volume (MT)' },
              { key: 'sell_volume_mt',        label: 'Sell Volume (MT)' },
              { key: 'trade_count',           label: 'Trades' },
              { key: 'brokerage_earned_usd',  label: 'Brokerage (USD)' },
              { key: 'first_trade_date',      label: 'First Trade' },
              { key: 'last_trade_date',       label: 'Last Trade' },
              { key: 'days_since_last_trade', label: 'Days Since Last' },
              { key: 'top_products',          label: 'Top Products' },
              { key: 'brokers',               label: 'Brokers' },
            ]
          )}
          disabled={filtered.length === 0}
          className="px-3 py-2 rounded text-xs font-semibold border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↓ CSV
        </button>
      </div>

      {/* Counterparty table */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Counterparty</th>
                <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Status</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Volume (MT)</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden sm:table-cell">Buy/Sell</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Trades</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Brokerage</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">Top Products</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Last Trade</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const freshnessConfig: Record<string, { color: string; label: string }> = {
                  active: { color: 'text-positive bg-positive/10 border-positive/30', label: 'ACTIVE' },
                  cooling: { color: 'text-accent bg-accent/10 border-accent/30', label: 'COOLING' },
                  dormant: { color: 'text-negative bg-negative/10 border-negative/30', label: 'DORMANT' },
                };
                const cfg = freshnessConfig[c.freshness];
                return (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface/40">
                    <td className="px-3 py-3">
                      <div className="text-text-primary font-semibold">{c.counterparty}</div>
                      {c.broker_count > 0 && (
                        <div className="text-text-dim text-[10px]">
                          {c.broker_count} broker{c.broker_count > 1 ? 's' : ''}: {c.brokers.slice(0, 2).join(', ')}
                          {c.brokers.length > 2 && ` +${c.brokers.length - 2}`}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-text-primary font-bold">
                      {formatNumber(c.total_volume_mt)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[10px] hidden sm:table-cell">
                      <span className="text-positive">B: {formatNumber(c.buy_volume_mt)}</span>
                      <br />
                      <span className="text-negative">S: {formatNumber(c.sell_volume_mt)}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-text-secondary">
                      {c.trade_count}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-text-secondary hidden md:table-cell">
                      ${formatNumber(c.brokerage_earned_usd)}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {c.top_products.map((p, j) => (
                          <span key={j} className="text-[10px] bg-surface border border-border px-1.5 py-0.5 rounded text-text-secondary">
                            {p.product}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="text-text-secondary text-[11px]">{formatDate(c.last_trade_date)}</div>
                      <div className={`text-[10px] font-bold ${
                        c.days_since_last_trade <= 14 ? 'text-positive' :
                        c.days_since_last_trade <= 45 ? 'text-accent' : 'text-negative'
                      }`}>
                        {c.days_since_last_trade}d ago
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-text-dim text-xs italic">
            {data.counterparties.length === 0
              ? 'No counterparties yet. Start entering trades in the Trade Blotter to build the CRM view.'
              : `No counterparties match "${search}"`}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
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
    <div className="bg-card border border-border rounded p-4">
      <span className="text-text-dim text-[10px] uppercase tracking-widest block mb-1">{label}</span>
      <span className={`font-mono font-bold text-lg block ${color}`}>{value}</span>
      {sub && <span className="text-text-dim text-[10px]">{sub}</span>}
    </div>
  );
}
