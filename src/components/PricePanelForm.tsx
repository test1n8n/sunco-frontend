import { useState, useEffect } from 'react';
import type { PricePanel, LsGoContractRow } from '../types';
import { API_BASE_URL, API_KEY } from '../config';

const DIFF_PRODUCTS = ['FAME0', 'UCOME', 'RME', 'HVO'] as const;
type DiffProduct = typeof DIFF_PRODUCTS[number];

function ChangeCell({ change }: { change: number | null }) {
  if (change == null) return <span className="text-text-dim font-mono">—</span>;
  const color = change > 0 ? 'text-positive' : change < 0 ? 'text-negative' : 'text-text-dim';
  const label = change > 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  return <span className={`font-mono font-semibold ${color}`}>{label}</span>;
}

export default function PricePanelForm({
  panel,
  reportDate,
  onDiffsUpdated,
}: {
  panel: PricePanel | null;
  reportDate: string;
  onDiffsUpdated: (updated: PricePanel) => void;
}) {
  const [lsGoInput, setLsGoInput] = useState('');
  const [diffs, setDiffs] = useState<Record<DiffProduct, string>>({
    FAME0: '', UCOME: '', RME: '', HVO: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (panel) {
      const m1 = panel.ls_go_curve?.[0]?.settlement;
      if (m1 != null) setLsGoInput(String(m1));
      if (panel.bio_diffs) {
        setDiffs({
          FAME0: panel.bio_diffs.FAME0 != null ? String(panel.bio_diffs.FAME0) : '',
          UCOME: panel.bio_diffs.UCOME != null ? String(panel.bio_diffs.UCOME) : '',
          RME:   panel.bio_diffs.RME   != null ? String(panel.bio_diffs.RME)   : '',
          HVO:   panel.bio_diffs.HVO   != null ? String(panel.bio_diffs.HVO)   : '',
        });
      }
    }
  }, [panel]);

  const handleSaveDiffs = async () => {
    setSaving(true);
    setSaveError('');
    const body: Record<string, number> = {};
    const lsGoVal = parseFloat(lsGoInput);
    if (!isNaN(lsGoVal)) body['ls_go_m1'] = lsGoVal;
    for (const p of DIFF_PRODUCTS) {
      const val = parseFloat(diffs[p]);
      if (!isNaN(val)) body[p] = val;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/price-panel/${reportDate}/diffs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json() as PricePanel;
      onDiffsUpdated(updated);
    } catch {
      setSaveError('Failed to save — try again.');
    } finally {
      setSaving(false);
    }
  };

  const curve: LsGoContractRow[] = panel?.ls_go_curve ?? [];
  const flatPrices = panel?.flat_prices ?? {};
  const existingDiffs = panel?.bio_diffs ?? {};
  const lsGoM1 = curve[0]?.settlement ?? null;
  const hasDiffs = DIFF_PRODUCTS.some(p => existingDiffs[p] != null);

  return (
    <div className="space-y-4">

      {/* ── Biodiesel Flat Prices (result) ── */}
      {(hasDiffs || lsGoM1) && (
        <div className="bg-card border border-border rounded overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-surface flex items-center justify-between">
            <div>
              <h3 className="text-text-dim font-semibold text-xs uppercase tracking-widest">
                Biodiesel Flat Prices
              </h3>
              <p className="text-text-dim text-xs mt-0.5">
                LS GO M1 {lsGoM1 != null ? `(${lsGoM1.toFixed(2)})` : ''} + Diff · USD/MT
              </p>
            </div>
            {panel?.diffs_updated_at && (
              <span className="text-text-dim text-xs">
                Updated {new Date(panel.diffs_updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
              </span>
            )}
          </div>
          {hasDiffs ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-surface/50">
                  <th className="text-left px-4 py-2 text-text-dim font-semibold text-xs uppercase tracking-widest">Product</th>
                  <th className="text-right px-4 py-2 text-text-dim font-semibold text-xs uppercase tracking-widest">Diff vs GO</th>
                  <th className="text-right px-4 py-2 text-text-dim font-semibold text-xs uppercase tracking-widest">Flat Price</th>
                </tr>
              </thead>
              <tbody>
                {DIFF_PRODUCTS.filter(p => existingDiffs[p] != null).map((p, idx) => {
                  const diff = existingDiffs[p] as number;
                  const flat = flatPrices[p];
                  return (
                    <tr key={p} className={`border-b border-border/40 ${idx % 2 === 0 ? 'bg-card' : 'bg-surface/40'}`}>
                      <td className="px-4 py-3 font-bold text-text-primary text-sm">{p}</td>
                      <td className="px-4 py-3 text-right"><ChangeCell change={diff} /></td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-text-primary">
                        {flat != null ? flat.toFixed(2) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-3 text-text-dim text-xs italic">Enter diffs below to calculate flat prices.</p>
          )}
        </div>
      )}

      {/* ── Entry Form ── */}
      <div className="bg-card border border-border rounded p-5">
        <p className="text-text-dim text-xs uppercase tracking-widest font-semibold mb-1">
          Enter Today's Settlements (USD/MT) — available after 16:30 London
        </p>
        <p className="text-text-dim text-xs mb-4 italic">
          LS GO M1 from ICE Report Center · Diffs from your trading screen
        </p>

        <div className="mb-4">
          <label className="block text-text-dim text-xs mb-1 uppercase tracking-wide font-semibold">
            LS GO M1 Settlement
          </label>
          <input
            type="number"
            step="0.25"
            placeholder="e.g. 652.50"
            value={lsGoInput}
            onChange={e => setLsGoInput(e.target.value)}
            className="w-48 bg-surface border border-accent/40 rounded px-2 py-1.5 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent font-mono"
          />
        </div>

        <p className="text-text-dim text-xs uppercase tracking-widest font-semibold mb-2">
          Biodiesel Diffs vs LS GO
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {DIFF_PRODUCTS.map(p => (
            <div key={p}>
              <label className="block text-text-dim text-xs mb-1 uppercase tracking-wide">{p}</label>
              <input
                type="number"
                step="0.25"
                placeholder="e.g. -45.0"
                value={diffs[p]}
                onChange={e => setDiffs(prev => ({ ...prev, [p]: e.target.value }))}
                className="w-full bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent font-mono"
              />
            </div>
          ))}
        </div>

        {saveError && <p className="text-negative text-xs mb-2">{saveError}</p>}

        <button
          onClick={() => void handleSaveDiffs()}
          disabled={saving}
          className="bg-card border border-border text-text-secondary px-4 py-1.5 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
        >
          {saving ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            'Save Diffs & Recalculate'
          )}
        </button>
      </div>
    </div>
  );
}
