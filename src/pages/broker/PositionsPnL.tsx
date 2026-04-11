import { useState, useEffect } from 'react';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';

interface PnLRow {
  commodity: string;
  delivery_month: string;
  net_volume_mt: number;
  avg_price_eur_mt: number;
  current_price_eur_mt: number | null;
  direction: 'long' | 'short' | 'flat';
  unrealised_pnl_eur: number | null;
  price_source: string;
  trade_count: number;
}

interface PnLResponse {
  pnl_breakdown: PnLRow[];
  total_unrealised_pnl_eur: number;
  total_brokerage_usd: number;
  current_prices_used: Record<string, number>;
  gasoil_m1_base: number | null;
  positions_with_no_price: string[];
  generated_at: string;
}

function formatNumber(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function PositionsPnL() {
  const [data, setData] = useState<PnLResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/pnl/auto`, {
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PnLResponse;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load P&L');
    }
  };

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl">
        <div className="bg-negative/10 border border-negative/30 rounded p-4 text-negative text-sm">
          Failed to load P&L: {error ?? 'Unknown error'}
        </div>
      </div>
    );
  }

  const { pnl_breakdown, total_unrealised_pnl_eur, total_brokerage_usd, gasoil_m1_base, positions_with_no_price } = data;

  // Sort by P&L impact (winners first, losers last)
  const sorted = [...pnl_breakdown].sort((a, b) => {
    const pnlA = a.unrealised_pnl_eur ?? 0;
    const pnlB = b.unrealised_pnl_eur ?? 0;
    return pnlB - pnlA;
  });

  const winners = sorted.filter((p) => (p.unrealised_pnl_eur ?? 0) > 0);
  const losers = sorted.filter((p) => (p.unrealised_pnl_eur ?? 0) < 0);
  const openPositions = pnl_breakdown.filter((p) => p.net_volume_mt !== 0);

  const totalLongVolume = pnl_breakdown
    .filter((p) => p.direction === 'long')
    .reduce((sum, p) => sum + p.net_volume_mt, 0);
  const totalShortVolume = pnl_breakdown
    .filter((p) => p.direction === 'short')
    .reduce((sum, p) => sum + Math.abs(p.net_volume_mt), 0);

  const pnlColor = total_unrealised_pnl_eur > 0 ? 'text-positive' : total_unrealised_pnl_eur < 0 ? 'text-negative' : 'text-text-dim';

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="pb-3 border-b border-border flex items-start justify-between">
        <div>
          <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Risk & P&L</p>
          <h1 className="text-text-primary font-semibold text-base">Live Positions &amp; Mark-to-Market P&amp;L</h1>
          <p className="text-text-dim text-xs mt-1">
            Auto-computed from Trade Blotter + latest ICE settlements · Updated {formatDate(data.generated_at)}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-3 py-2 text-xs font-semibold border border-border rounded hover:border-accent/50 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
        >
          {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          label="Total Unrealised P&L"
          value={`${total_unrealised_pnl_eur >= 0 ? '+' : ''}${formatNumber(total_unrealised_pnl_eur)} €`}
          color={pnlColor}
        />
        <MetricCard
          label="Brokerage Earned"
          value={`${formatNumber(total_brokerage_usd)} $`}
          sub="YTD from blotter"
        />
        <MetricCard
          label="Open Positions"
          value={`${openPositions.length}`}
          sub={`${pnl_breakdown.length} total trades`}
        />
        <MetricCard
          label="Long Volume"
          value={`${formatNumber(totalLongVolume, 0)} MT`}
          color="text-positive"
        />
        <MetricCard
          label="Short Volume"
          value={`${formatNumber(totalShortVolume, 0)} MT`}
          color="text-negative"
        />
      </div>

      {/* Gasoil base info */}
      {gasoil_m1_base && (
        <div className="bg-accent/5 border border-accent/20 rounded px-4 py-2">
          <p className="text-text-secondary text-xs">
            ℹ️ Biodiesel diff products (FAME0, RME, UCOME, HVO) are marked against{' '}
            <span className="font-mono font-bold text-accent">Gasoil M1 = {formatNumber(gasoil_m1_base)} $/MT</span>{' '}
            + product diff.
          </p>
        </div>
      )}

      {/* Winners & Losers */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="bg-card border border-border rounded p-4">
          <h2 className="text-positive font-semibold text-sm mb-3">🏆 Top Winners</h2>
          {winners.length === 0 ? (
            <p className="text-text-dim text-xs italic">No positions in profit.</p>
          ) : (
            <div className="space-y-2">
              {winners.slice(0, 5).map((p, i) => (
                <PnLMiniRow key={i} row={p} />
              ))}
            </div>
          )}
        </div>
        <div className="bg-card border border-border rounded p-4">
          <h2 className="text-negative font-semibold text-sm mb-3">📉 Biggest Losers</h2>
          {losers.length === 0 ? (
            <p className="text-text-dim text-xs italic">No positions at a loss.</p>
          ) : (
            <div className="space-y-2">
              {losers.slice(0, 5).map((p, i) => (
                <PnLMiniRow key={i} row={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full P&L Breakdown Table */}
      <div className="bg-card border border-border rounded">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-text-primary font-semibold text-sm">Full Position Breakdown</h2>
          <p className="text-text-dim text-xs mt-0.5">All positions sorted by commodity and delivery month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Product</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Delivery</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Direction</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Net MT</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Avg Price</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Current</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">P&L (€)</th>
              </tr>
            </thead>
            <tbody>
              {pnl_breakdown
                .slice()
                .sort((a, b) => `${a.commodity}-${a.delivery_month}`.localeCompare(`${b.commodity}-${b.delivery_month}`))
                .map((p, i) => {
                  const pnl = p.unrealised_pnl_eur;
                  const pnlColorRow = pnl == null
                    ? 'text-text-dim'
                    : pnl > 0 ? 'text-positive' : pnl < 0 ? 'text-negative' : 'text-text-dim';
                  const dirColor = p.direction === 'long' ? 'text-positive' : p.direction === 'short' ? 'text-negative' : 'text-text-dim';
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface/40">
                      <td className="px-3 py-2.5 text-text-primary font-semibold">{p.commodity}</td>
                      <td className="px-3 py-2.5 text-text-secondary font-mono">{p.delivery_month}</td>
                      <td className={`px-3 py-2.5 font-semibold uppercase ${dirColor}`}>{p.direction}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-primary">
                        {p.net_volume_mt !== 0 ? formatNumber(p.net_volume_mt, 0) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-secondary hidden md:table-cell">
                        {formatNumber(p.avg_price_eur_mt)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-secondary hidden md:table-cell">
                        {p.current_price_eur_mt != null ? formatNumber(p.current_price_eur_mt) : '—'}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono font-bold ${pnlColorRow}`}>
                        {pnl != null
                          ? `${pnl >= 0 ? '+' : ''}${formatNumber(pnl)}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Positions without current prices */}
      {positions_with_no_price.length > 0 && (
        <div className="bg-accent/5 border border-accent/20 rounded p-4">
          <p className="text-accent text-xs font-semibold mb-1">⚠️ Positions Without Current Prices</p>
          <p className="text-text-secondary text-xs">
            The following commodities have open positions but no settlement data from Products Data:{' '}
            <span className="font-mono">{positions_with_no_price.join(', ')}</span>
          </p>
          <p className="text-text-dim text-xs mt-1 italic">
            Upload the latest ICE PDFs on the Products Data page to enable P&L calculation for these products.
          </p>
        </div>
      )}

      {/* Currency note */}
      <div className="bg-surface/30 border border-border/50 rounded p-3">
        <p className="text-text-dim text-[11px] italic">
          💡 <strong>Currency note:</strong> Trade prices are stored in €/MT (from the blotter) but current
          settlements come from ICE in $/MT. This view does NOT apply FX conversion — the P&L numbers
          compare nominal values directly. For a true €-denominated P&L, apply the current EUR/USD rate
          to the settlement prices.
        </p>
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

function PnLMiniRow({ row }: { row: PnLRow }) {
  const pnl = row.unrealised_pnl_eur ?? 0;
  const color = pnl > 0 ? 'text-positive' : pnl < 0 ? 'text-negative' : 'text-text-dim';
  return (
    <div className="flex items-center justify-between text-xs border-b border-border/30 pb-1.5 last:border-0">
      <div>
        <span className="text-text-primary font-semibold">{row.commodity}</span>
        <span className="text-text-dim font-mono ml-2">{row.delivery_month}</span>
        <span className={`ml-2 uppercase text-[10px] font-bold ${row.direction === 'long' ? 'text-positive' : 'text-negative'}`}>
          {row.direction} {formatNumber(Math.abs(row.net_volume_mt), 0)} MT
        </span>
      </div>
      <span className={`font-mono font-bold ${color}`}>
        {pnl >= 0 ? '+' : ''}{formatNumber(pnl)} €
      </span>
    </div>
  );
}
