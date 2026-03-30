import { useState, useEffect, useCallback } from 'react';
import type { Trade, PnLResult } from '../../types';
import { MOCK_TRADES } from '../../mockData';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import { useToast, ToastContainer } from '../../components/Toast';

const COMMODITIES = ['FAME0', 'RME', 'SME', 'HVO', 'EthanolT2', 'UCO', 'Tallow', 'SAF'];

interface TradeFormState {
  trade_date: string;
  broker_name: string;
  commodity: string;
  direction: 'Buy' | 'Sell';
  volume_mt: string;
  price_eur_mt: string;
  counterparty: string;
  delivery_month: string;
  delivery_location: string;
  brokerage_fee_usd_mt: string;
  notes: string;
}

const emptyForm = (): TradeFormState => ({
  trade_date: new Date().toISOString().slice(0, 10),
  broker_name: 'Sunco Brokers',
  commodity: 'FAME0',
  direction: 'Buy',
  volume_mt: '',
  price_eur_mt: '',
  counterparty: '',
  delivery_month: '',
  delivery_location: '',
  brokerage_fee_usd_mt: '',
  notes: '',
});

function DirectionChip({ direction }: { direction: 'Buy' | 'Sell' }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold tracking-widest uppercase ${
        direction === 'Buy'
          ? 'bg-positive/10 text-positive border border-positive/20'
          : 'bg-negative/10 text-negative border border-negative/20'
      }`}
    >
      {direction}
    </span>
  );
}

export default function TradeBlotter() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<TradeFormState>(emptyForm());
  const [formErrors, setFormErrors] = useState<Partial<TradeFormState>>({});
  const [filterCommodity, setFilterCommodity] = useState('');
  const [filterDirection, setFilterDirection] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [pnlInputs, setPnlInputs] = useState<Record<string, string>>({});
  const [pnlResult, setPnlResult] = useState<PnLResult | null>(null);
  const [calculatingPnl, setCalculatingPnl] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/trades`, {
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = Array.isArray(json) ? json : (json.trades ?? []) as Trade[];
      setTrades(data);
    } catch {
      setTrades(MOCK_TRADES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTrades();
  }, [fetchTrades]);

  const validateForm = (): boolean => {
    const errors: Partial<TradeFormState> = {};
    if (!form.trade_date) errors.trade_date = 'Required';
    if (!form.counterparty.trim()) errors.counterparty = 'Required';
    if (!form.volume_mt || isNaN(Number(form.volume_mt)) || Number(form.volume_mt) <= 0)
      errors.volume_mt = 'Must be a positive number';
    if (!form.price_eur_mt || isNaN(Number(form.price_eur_mt)) || Number(form.price_eur_mt) <= 0)
      errors.price_eur_mt = 'Must be a positive number';
    if (!form.delivery_month) errors.delivery_month = 'Required';
    if (!form.delivery_location.trim()) errors.delivery_location = 'Required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const payload = {
        trade_date: form.trade_date,
        broker_name: form.broker_name,
        commodity: form.commodity,
        direction: form.direction,
        volume_mt: Number(form.volume_mt),
        price_eur_mt: Number(form.price_eur_mt),
        counterparty: form.counterparty,
        delivery_month: form.delivery_month,
        delivery_location: form.delivery_location,
        brokerage_fee_usd_mt: form.brokerage_fee_usd_mt ? Number(form.brokerage_fee_usd_mt) : 0,
        notes: form.notes,
      };
      const res = await fetch(`${API_BASE_URL}/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('success', 'Trade submitted.');
      setForm(emptyForm());
      setFormErrors({});
      await fetchTrades();
    } catch {
      showToast('error', 'Failed to submit trade.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this trade?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/trades/${id}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('success', 'Trade deleted.');
      await fetchTrades();
    } catch {
      showToast('error', 'Failed to delete trade.');
    }
  };

  const handleCalculatePnl = async () => {
    setCalculatingPnl(true);
    try {
      const params = new URLSearchParams();
      Object.entries(pnlInputs).forEach(([k, v]) => {
        if (v && !isNaN(Number(v))) params.append(k, v);
      });
      const res = await fetch(`${API_BASE_URL}/pnl?${params.toString()}`, {
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PnLResult;
      setPnlResult(data);
    } catch {
      showToast('error', 'Failed to calculate PnL.');
    } finally {
      setCalculatingPnl(false);
    }
  };

  const filteredTrades = trades.filter((t) => {
    if (filterCommodity && t.commodity !== filterCommodity) return false;
    if (filterDirection && t.direction !== filterDirection) return false;
    if (filterMonth && t.delivery_month !== filterMonth) return false;
    return true;
  });

  const uniqueCommodities = Array.from(new Set(trades.map((t) => t.commodity)));

  const inputClass = (error?: string) =>
    `w-full bg-surface border ${error ? 'border-negative' : 'border-border'} rounded px-3 py-2 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent`;

  const selectClass =
    'w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent';

  return (
    <div className="space-y-6 max-w-5xl">
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />

      {/* New Trade Form */}
      <div className="bg-card border border-border rounded p-6">
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-5">New Trade</h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Trade Date */}
          <div>
            <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">Trade Date *</label>
            <input
              type="date"
              value={form.trade_date}
              onChange={(e) => setForm({ ...form, trade_date: e.target.value })}
              className={inputClass(formErrors.trade_date)}
            />
            {formErrors.trade_date && <p className="text-negative text-xs mt-1">{formErrors.trade_date}</p>}
          </div>

          {/* Commodity */}
          <div>
            <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">Commodity *</label>
            <select
              value={form.commodity}
              onChange={(e) => setForm({ ...form, commodity: e.target.value })}
              className={selectClass}
            >
              {COMMODITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">Direction *</label>
            <div className="flex rounded overflow-hidden border border-border">
              <button
                type="button"
                onClick={() => setForm({ ...form, direction: 'Buy' })}
                className={`flex-1 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${
                  form.direction === 'Buy'
                    ? 'bg-positive text-surface'
                    : 'bg-surface text-text-secondary hover:bg-positive/10 hover:text-positive'
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, direction: 'Sell' })}
                className={`flex-1 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${
                  form.direction === 'Sell'
                    ? 'bg-negative text-surface'
                    : 'bg-surface text-text-secondary hover:bg-negative/10 hover:text-negative'
                }`}
              >
                Sell
              </button>
            </div>
          </div>

          {/* Volume */}
          <div>
            <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">Volume (MT) *</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.volume_mt}
              onChange={(e) => setForm({ ...form, volume_mt: e.target.value })}
              placeholder="e.g. 5000"
              className={inputClass(formErrors.volume_mt)}
            />
            {formErrors.volume_mt && <p className="text-negative text-xs mt-1">{formErrors.volume_mt}</p>}
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">Price (EUR/MT) *</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.price_eur_mt}
              onChange={(e) => setForm({ ...form, price_eur_mt: e.target.value })}
              placeholder="e.g. 1250"
              className={inputClass(formErrors.price_eur_mt)}
            />
            {formErrors.price_eur_mt && <p className="text-negative text-xs mt-1">{formErrors.price_eur_mt}</p>}
          </div>

          {/* Counterparty */}
          <div>
            <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">Counterparty *</label>
            <input
              type="text"
              value={form.counterparty}
              onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
              placeholder="e.g. EuroEnergy GmbH"
              className={inputClass(formErrors.counterparty)}
            />
            {formErrors.counterparty && <p className="text-negative text-xs mt-1">{formErrors.counterparty}</p>}
          </div>

          {/* Delivery Month */}
          <div>
            <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">Delivery Month *</label>
            <input
              type="month"
              value={form.delivery_month}
              onChange={(e) => setForm({ ...form, delivery_month: e.target.value })}
              className={inputClass(formErrors.delivery_month)}
            />
            {formErrors.delivery_month && <p className="text-negative text-xs mt-1">{formErrors.delivery_month}</p>}
          </div>

          {/* Delivery Location */}
          <div>
            <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">Delivery Location *</label>
            <input
              type="text"
              value={form.delivery_location}
              onChange={(e) => setForm({ ...form, delivery_location: e.target.value })}
              placeholder="e.g. ARA, Rotterdam"
              className={inputClass(formErrors.delivery_location)}
            />
            {formErrors.delivery_location && <p className="text-negative text-xs mt-1">{formErrors.delivery_location}</p>}
          </div>

          {/* Brokerage Fee */}
          <div>
            <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">Brokerage Fee (USD/MT)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.brokerage_fee_usd_mt}
              onChange={(e) => setForm({ ...form, brokerage_fee_usd_mt: e.target.value })}
              placeholder="e.g. 2.50"
              className={inputClass()}
            />
          </div>

          {/* Broker Name */}
          <div>
            <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">Broker Name</label>
            <input
              type="text"
              value={form.broker_name}
              onChange={(e) => setForm({ ...form, broker_name: e.target.value })}
              className={inputClass()}
            />
          </div>

          {/* Notes */}
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes..."
              className={inputClass()}
            />
          </div>

          {/* Submit */}
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-accent text-surface px-6 py-2.5 rounded text-xs font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
            >
              {submitting ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                '+ Submit Trade'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Trade Blotter Table */}
      <div className="bg-card border border-border rounded p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest flex-1">
            Trade Blotter
            <span className="ml-2 inline-block bg-accent/10 text-accent text-xs px-2 py-0.5 rounded border border-accent/20">{filteredTrades.length}</span>
          </h2>
          <select
            value={filterCommodity}
            onChange={(e) => setFilterCommodity(e.target.value)}
            className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All Commodities</option>
            {COMMODITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
            className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All Directions</option>
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
          </select>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {loading ? (
          <Spinner />
        ) : filteredTrades.length === 0 ? (
          <div className="text-center py-10 text-text-dim text-sm">No trades match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Date</th>
                  <th className="text-left px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Commodity</th>
                  <th className="text-left px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Dir.</th>
                  <th className="text-right px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Vol (MT)</th>
                  <th className="text-right px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Price</th>
                  <th className="text-left px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Counterparty</th>
                  <th className="text-left px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Del. Month</th>
                  <th className="text-center px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade, idx) => (
                  <tr key={trade.id} className={`border-b border-border/50 ${idx % 2 === 0 ? 'bg-card' : 'bg-surface/50'} hover:bg-surface transition-colors`}>
                    <td className="px-3 py-2.5 text-text-secondary font-mono text-xs">{trade.trade_date}</td>
                    <td className="px-3 py-2.5 font-semibold text-text-primary text-xs tracking-wide">{trade.commodity}</td>
                    <td className="px-3 py-2.5">
                      <DirectionChip direction={trade.direction} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-secondary text-xs">{trade.volume_mt.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-primary text-xs">€{trade.price_eur_mt.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-text-secondary text-xs">{trade.counterparty}</td>
                    <td className="px-3 py-2.5 text-text-secondary font-mono text-xs">{trade.delivery_month}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => void handleDelete(trade.id)}
                        className="text-negative/60 hover:text-negative text-xs font-semibold px-2 py-1 rounded hover:bg-negative/10 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PnL Calculator */}
      <div className="bg-card border border-border rounded p-6">
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-4">PnL Calculator</h2>
        {uniqueCommodities.length === 0 ? (
          <p className="text-text-secondary text-sm">No trades to calculate PnL for.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
              {uniqueCommodities.map((commodity) => (
                <div key={commodity}>
                  <label className="block text-xs font-semibold text-text-dim mb-1 uppercase tracking-wider">
                    {commodity} (EUR/MT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={pnlInputs[commodity] ?? ''}
                    onChange={(e) => setPnlInputs({ ...pnlInputs, [commodity]: e.target.value })}
                    placeholder="Current price"
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => void handleCalculatePnl()}
              disabled={calculatingPnl}
              className="bg-card border border-border text-text-secondary px-5 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
            >
              {calculatingPnl ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
                  Calculating...
                </>
              ) : (
                'Calculate PnL'
              )}
            </button>

            {pnlResult && (
              <div className="mt-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px] mb-4">
                    <thead>
                      <tr className="bg-surface border-b border-border">
                        <th className="text-left px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Commodity</th>
                        <th className="text-left px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Del. Month</th>
                        <th className="text-right px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Net Vol (MT)</th>
                        <th className="text-right px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Avg Price</th>
                        <th className="text-right px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Curr. Price</th>
                        <th className="text-right px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Unreal. PnL (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pnlResult.pnl_breakdown.map((item, idx) => (
                        <tr key={idx} className={`border-b border-border/50 ${idx % 2 === 0 ? 'bg-card' : 'bg-surface/50'}`}>
                          <td className="px-3 py-2.5 font-semibold text-text-primary text-xs">{item.commodity}</td>
                          <td className="px-3 py-2.5 text-text-secondary font-mono text-xs">{item.delivery_month}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-text-secondary text-xs">{item.net_volume_mt.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-text-secondary text-xs">€{item.avg_price_eur_mt.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-text-secondary text-xs">
                            {item.current_price_eur_mt !== null ? `€${item.current_price_eur_mt.toLocaleString()}` : '—'}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-semibold text-xs ${
                            item.unrealised_pnl_eur === null
                              ? 'text-text-dim'
                              : item.unrealised_pnl_eur >= 0
                              ? 'text-positive'
                              : 'text-negative'
                          }`}>
                            {item.unrealised_pnl_eur !== null
                              ? `${item.unrealised_pnl_eur >= 0 ? '+' : ''}€${item.unrealised_pnl_eur.toLocaleString()}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-surface border-t border-border">
                        <td colSpan={5} className="px-3 py-2.5 text-text-dim font-semibold text-xs uppercase tracking-widest">Total</td>
                        <td className={`px-3 py-2.5 text-right font-mono font-bold text-sm ${
                          pnlResult.total_unrealised_pnl_eur >= 0 ? 'text-positive' : 'text-negative'
                        }`}>
                          {pnlResult.total_unrealised_pnl_eur >= 0 ? '+' : ''}€{pnlResult.total_unrealised_pnl_eur.toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-surface/50">
                        <td colSpan={5} className="px-3 py-2 text-text-dim text-xs">Total Brokerage (USD)</td>
                        <td className="px-3 py-2 text-right font-mono text-text-secondary text-xs">${pnlResult.total_brokerage_usd.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {pnlResult.positions_with_no_price.length > 0 && (
                  <p className="text-accent text-xs bg-accent/5 border border-accent/20 rounded px-3 py-2">
                    No price provided for: {pnlResult.positions_with_no_price.join(', ')}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
