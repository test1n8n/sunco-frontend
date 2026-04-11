import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import { BIODIESEL_PRODUCTS } from '../../productConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertType = 'price_above' | 'price_below' | 'diff_above' | 'diff_below' | 'mandate_deadline';
type AlertStatus = 'armed' | 'triggered' | 'muted';

interface Alert {
  id: string;
  type: AlertType;
  product_code?: string;
  product_name?: string;
  threshold: number;
  current_value: number | null;
  status: AlertStatus;
  created_at: string;
  triggered_at?: string;
  note?: string;
}

interface ProductReport {
  forward_curve: { contract: string; settlement: number; change: number }[];
  source_filename?: string;
}

const STORAGE_KEY = 'sunco_alerts_v1';

// ─── Local storage helpers ────────────────────────────────────────────────────

function loadAlerts(): Alert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Alert[];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: Alert[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

function newId(): string {
  return `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<AlertType>('price_above');
  const [formProduct, setFormProduct] = useState<string>('G');
  const [formThreshold, setFormThreshold] = useState<string>('');
  const [formNote, setFormNote] = useState<string>('');

  // Load alerts from localStorage + current prices from backend
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const storedAlerts = loadAlerts();
      setAlerts(storedAlerts);

      // Fetch all current product prices
      const allProducts = [{ code: 'G', name: 'LS Gasoil' }, ...BIODIESEL_PRODUCTS.map((p) => ({ code: p.code, name: p.name }))];
      const headers = { 'X-API-Key': API_KEY };
      const pricesMap: Record<string, number> = {};

      await Promise.all(
        allProducts.map(async (p) => {
          try {
            const res = await fetch(`${API_BASE_URL}/products/${p.code}/report/latest`, { headers });
            if (res.ok) {
              const report = (await res.json()) as ProductReport;
              if (report.forward_curve && report.forward_curve.length > 0) {
                pricesMap[p.code] = report.forward_curve[0].settlement;
              }
            }
          } catch {
            // Skip products without data
          }
        })
      );
      setPrices(pricesMap);

      // Check which alerts should be triggered
      const updated = storedAlerts.map((a) => {
        if (a.status !== 'armed' || !a.product_code) return a;
        const currentValue = pricesMap[a.product_code];
        if (currentValue == null) return { ...a, current_value: null };

        let triggered = false;
        if (a.type === 'price_above' || a.type === 'diff_above') {
          triggered = currentValue > a.threshold;
        } else if (a.type === 'price_below' || a.type === 'diff_below') {
          triggered = currentValue < a.threshold;
        }

        return {
          ...a,
          current_value: currentValue,
          status: triggered ? ('triggered' as AlertStatus) : a.status,
          triggered_at: triggered ? new Date().toISOString() : a.triggered_at,
        };
      });
      saveAlerts(updated);
      setAlerts(updated);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const addAlert = () => {
    const threshold = parseFloat(formThreshold);
    if (isNaN(threshold)) return;

    const product = formProduct === 'G'
      ? { code: 'G', name: 'LS Gasoil' }
      : BIODIESEL_PRODUCTS.find((p) => p.code === formProduct) ?? null;
    if (!product) return;

    const alert: Alert = {
      id: newId(),
      type: formType,
      product_code: product.code,
      product_name: product.name,
      threshold,
      current_value: prices[product.code] ?? null,
      status: 'armed',
      created_at: new Date().toISOString(),
      note: formNote || undefined,
    };

    const updated = [alert, ...alerts];
    saveAlerts(updated);
    setAlerts(updated);
    setShowForm(false);
    setFormThreshold('');
    setFormNote('');
  };

  const deleteAlert = (id: string) => {
    const updated = alerts.filter((a) => a.id !== id);
    saveAlerts(updated);
    setAlerts(updated);
  };

  const muteAlert = (id: string) => {
    const updated = alerts.map((a) => (a.id === id ? { ...a, status: 'muted' as AlertStatus } : a));
    saveAlerts(updated);
    setAlerts(updated);
  };

  const rearmAlert = (id: string) => {
    const updated = alerts.map((a) => (a.id === id ? { ...a, status: 'armed' as AlertStatus, triggered_at: undefined } : a));
    saveAlerts(updated);
    setAlerts(updated);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner /></div>;
  }

  const armed = alerts.filter((a) => a.status === 'armed');
  const triggered = alerts.filter((a) => a.status === 'triggered');
  const muted = alerts.filter((a) => a.status === 'muted');

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="pb-3 border-b border-border flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Price Alerts</p>
          <h1 className="text-text-primary font-semibold text-base">Price Triggers &amp; Notifications</h1>
          <p className="text-text-dim text-xs mt-1">
            Set price thresholds and get notified when they're crossed. Alerts are stored in your browser.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-xs font-semibold bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors"
        >
          {showForm ? '× Cancel' : '+ New Alert'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded p-4">
          <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Armed</p>
          <p className="text-positive font-mono font-bold text-2xl">{armed.length}</p>
        </div>
        <div className="bg-card border border-border rounded p-4">
          <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Triggered</p>
          <p className="text-negative font-mono font-bold text-2xl">{triggered.length}</p>
        </div>
        <div className="bg-card border border-border rounded p-4">
          <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Muted</p>
          <p className="text-text-dim font-mono font-bold text-2xl">{muted.length}</p>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-accent/30 rounded p-5 space-y-4">
          <h3 className="text-text-primary font-semibold text-sm">Create New Alert</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-text-dim text-[10px] uppercase tracking-widest block mb-1">Product</label>
              <select
                value={formProduct}
                onChange={(e) => setFormProduct(e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
              >
                <option value="G">LS Gasoil (G) — outright</option>
                {BIODIESEL_PRODUCTS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} ({p.code}) — {p.isDiff ? 'diff vs GO' : 'outright'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-text-dim text-[10px] uppercase tracking-widest block mb-1">Alert Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as AlertType)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
              >
                <option value="price_above">Price goes ABOVE</option>
                <option value="price_below">Price goes BELOW</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-text-dim text-[10px] uppercase tracking-widest block mb-1">
              Threshold ($/MT)
              {prices[formProduct] != null && (
                <span className="ml-2 text-text-secondary">· current: {prices[formProduct].toFixed(2)}</span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              value={formThreshold}
              onChange={(e) => setFormThreshold(e.target.value)}
              placeholder="e.g. 1550.00"
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50 font-mono"
            />
          </div>

          <div>
            <label className="text-text-dim text-[10px] uppercase tracking-widest block mb-1">Note (optional)</label>
            <input
              type="text"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="e.g. 'German THG reform deadline check'"
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-semibold text-text-secondary border border-border rounded hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addAlert}
              disabled={!formThreshold || isNaN(parseFloat(formThreshold))}
              className="px-4 py-2 text-xs font-semibold bg-accent text-surface rounded hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Create Alert
            </button>
          </div>
        </div>
      )}

      {/* Triggered alerts */}
      {triggered.length > 0 && (
        <div>
          <h2 className="text-negative font-semibold text-sm mb-2">🔴 Triggered — Action Required</h2>
          <div className="space-y-2">
            {triggered.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                onDelete={deleteAlert}
                onMute={muteAlert}
                onRearm={rearmAlert}
              />
            ))}
          </div>
        </div>
      )}

      {/* Armed alerts */}
      {armed.length > 0 && (
        <div>
          <h2 className="text-positive font-semibold text-sm mb-2">🟢 Armed — Watching</h2>
          <div className="space-y-2">
            {armed.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                onDelete={deleteAlert}
                onMute={muteAlert}
                onRearm={rearmAlert}
              />
            ))}
          </div>
        </div>
      )}

      {/* Muted alerts */}
      {muted.length > 0 && (
        <div>
          <h2 className="text-text-dim font-semibold text-sm mb-2">⚪ Muted</h2>
          <div className="space-y-2">
            {muted.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                onDelete={deleteAlert}
                onMute={muteAlert}
                onRearm={rearmAlert}
              />
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && !showForm && (
        <div className="bg-card border border-border rounded p-8 text-center">
          <p className="text-text-primary text-sm mb-2">No alerts yet</p>
          <p className="text-text-dim text-xs mb-4">
            Create your first price alert to get notified when thresholds are crossed.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-xs font-semibold bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors"
          >
            + Create First Alert
          </button>
        </div>
      )}

      {/* Note about local storage */}
      <div className="bg-surface/30 border border-border/50 rounded p-3">
        <p className="text-text-dim text-[11px]">
          💡 Alerts are currently stored in your browser (localStorage) and checked every time you
          open this page. For real-time email/SMS notifications, you'd need to wire up a backend
          alert delivery service — let us know if you want this.
        </p>
      </div>
    </div>
  );
}

function AlertCard({
  alert,
  onDelete,
  onMute,
  onRearm,
}: {
  alert: Alert;
  onDelete: (id: string) => void;
  onMute: (id: string) => void;
  onRearm: (id: string) => void;
}) {
  const typeLabel: Record<AlertType, string> = {
    price_above: 'Price ABOVE',
    price_below: 'Price BELOW',
    diff_above: 'Diff ABOVE',
    diff_below: 'Diff BELOW',
    mandate_deadline: 'Mandate Deadline',
  };
  const statusColors: Record<AlertStatus, string> = {
    armed: 'border-positive/30 bg-positive/5',
    triggered: 'border-negative/30 bg-negative/5',
    muted: 'border-border bg-surface/30',
  };
  return (
    <div className={`border rounded p-3 ${statusColors[alert.status]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-text-primary font-semibold text-sm">
              {alert.product_name} ({alert.product_code})
            </span>
            <span className="text-text-dim text-[10px] uppercase tracking-widest">
              {typeLabel[alert.type]}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-text-secondary">
              Threshold: <span className="font-mono font-bold text-text-primary">{alert.threshold.toFixed(2)} $/MT</span>
            </span>
            {alert.current_value != null && (
              <span className="text-text-secondary">
                Current: <span className="font-mono font-bold text-text-primary">{alert.current_value.toFixed(2)} $/MT</span>
              </span>
            )}
          </div>
          {alert.note && (
            <p className="text-text-dim text-xs italic mt-1">{alert.note}</p>
          )}
          {alert.triggered_at && (
            <p className="text-negative text-[10px] mt-1">
              Triggered {new Date(alert.triggered_at).toLocaleString('en-GB')}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {alert.status === 'triggered' && (
            <button
              onClick={() => onRearm(alert.id)}
              className="px-2 py-1 text-[10px] font-semibold text-accent border border-accent/30 rounded hover:bg-accent/10 transition-colors"
            >
              Re-arm
            </button>
          )}
          {alert.status === 'armed' && (
            <button
              onClick={() => onMute(alert.id)}
              className="px-2 py-1 text-[10px] font-semibold text-text-dim border border-border rounded hover:bg-surface transition-colors"
            >
              Mute
            </button>
          )}
          {alert.status === 'muted' && (
            <button
              onClick={() => onRearm(alert.id)}
              className="px-2 py-1 text-[10px] font-semibold text-positive border border-positive/30 rounded hover:bg-positive/10 transition-colors"
            >
              Un-mute
            </button>
          )}
          <button
            onClick={() => onDelete(alert.id)}
            className="px-2 py-1 text-[10px] font-semibold text-negative border border-negative/30 rounded hover:bg-negative/10 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
