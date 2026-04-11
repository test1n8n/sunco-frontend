import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import { useToast, ToastContainer } from '../../components/Toast';

interface Subscription {
  id: number;
  email: string;
  name: string;
  role: 'broker' | 'client';
  enabled: boolean;
  include_full_report: boolean;
  include_prices: boolean;
  include_news: boolean;
  notes: string;
  created_at: string | null;
  updated_at: string | null;
}

export default function Subscriptions() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<'broker' | 'client'>('client');
  const [formNotes, setFormNotes] = useState('');
  const { toasts, showToast, dismissToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/subscriptions`, {
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { subscriptions: Subscription[] };
      setSubs(data.subscriptions);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!formEmail.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({
          email: formEmail.trim(),
          name: formName.trim(),
          role: formRole,
          notes: formNotes.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      showToast('success', `Added ${formEmail}`);
      setShowForm(false);
      setFormEmail('');
      setFormName('');
      setFormNotes('');
      void load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to add');
    }
  };

  const handleToggle = async (sub: Subscription, field: keyof Subscription) => {
    try {
      const res = await fetch(`${API_BASE_URL}/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ [field]: !sub[field] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      void load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDelete = async (sub: Subscription) => {
    if (!confirm(`Remove ${sub.email}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/subscriptions/${sub.id}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('success', `Removed ${sub.email}`);
      void load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (loading && subs.length === 0) {
    return <div className="flex items-center justify-center py-20"><Spinner /></div>;
  }

  const brokers = subs.filter((s) => s.role === 'broker');
  const clients = subs.filter((s) => s.role === 'client');

  return (
    <div className="max-w-4xl space-y-5">
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />

      {/* Header */}
      <div className="pb-3 border-b border-border flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Settings</p>
          <h1 className="text-text-primary font-semibold text-base">Email Subscriptions</h1>
          <p className="text-text-dim text-xs mt-1">
            Manage who receives the daily report emails. Broker subscribers get the internal version; client subscribers get the client version.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-xs font-semibold bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors"
        >
          {showForm ? '× Cancel' : '+ Add Subscriber'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-accent/30 rounded p-5 space-y-3">
          <h3 className="text-text-primary font-semibold text-sm">New Subscriber</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-text-dim text-[10px] uppercase tracking-widest block mb-1">Email *</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="text-text-dim text-[10px] uppercase tracking-widest block mb-1">Display Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="John Doe (optional)"
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>

          <div>
            <label className="text-text-dim text-[10px] uppercase tracking-widest block mb-1">Role</label>
            <div className="flex gap-2">
              {(['broker', 'client'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setFormRole(r)}
                  className={`px-3 py-2 rounded text-xs font-semibold border transition-colors ${
                    formRole === r
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-surface border-border text-text-secondary'
                  }`}
                >
                  {r === 'broker' ? '👔 Broker (internal version)' : '👥 Client (external version)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-text-dim text-[10px] uppercase tracking-widest block mb-1">Notes (optional)</label>
            <input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="e.g. 'Sunco London office'"
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-xs font-semibold text-text-secondary border border-border rounded hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!formEmail.trim()}
              className="px-3 py-2 text-xs font-semibold bg-accent text-surface rounded hover:bg-accent/90 disabled:opacity-40 transition-colors"
            >
              Add Subscriber
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded p-4">
          <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Brokers</p>
          <p className="text-text-primary font-mono font-bold text-2xl">{brokers.length}</p>
          <p className="text-text-dim text-[10px]">{brokers.filter((b) => b.enabled).length} enabled</p>
        </div>
        <div className="bg-card border border-border rounded p-4">
          <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Clients</p>
          <p className="text-text-primary font-mono font-bold text-2xl">{clients.length}</p>
          <p className="text-text-dim text-[10px]">{clients.filter((c) => c.enabled).length} enabled</p>
        </div>
        <div className="bg-card border border-border rounded p-4">
          <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Total Enabled</p>
          <p className="text-positive font-mono font-bold text-2xl">{subs.filter((s) => s.enabled).length}</p>
          <p className="text-text-dim text-[10px]">will receive emails</p>
        </div>
      </div>

      {/* Broker subscribers */}
      {brokers.length > 0 && (
        <SubscriberGroup title="Broker Subscribers" icon="👔" subs={brokers} onToggle={handleToggle} onDelete={handleDelete} />
      )}

      {/* Client subscribers */}
      {clients.length > 0 && (
        <SubscriberGroup title="Client Subscribers" icon="👥" subs={clients} onToggle={handleToggle} onDelete={handleDelete} />
      )}

      {subs.length === 0 && !showForm && (
        <div className="bg-card border border-border rounded p-8 text-center">
          <p className="text-text-primary text-sm mb-2">No subscribers yet</p>
          <p className="text-text-dim text-xs mb-4">
            Emails will fall back to the BROKER_EMAILS and CLIENT_EMAILS environment variables on Railway until you add subscribers here.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-xs font-semibold bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors"
          >
            + Add First Subscriber
          </button>
        </div>
      )}

      <div className="bg-surface/30 border border-border/50 rounded p-3">
        <p className="text-text-dim text-[11px] leading-relaxed">
          💡 <strong>How it works:</strong> When the daily report runs, the email sender checks this table first.
          If it finds enabled subscribers for a given role (broker/client), it uses them. If not, it falls back to
          the <code className="text-accent">BROKER_EMAILS</code> / <code className="text-accent">CLIENT_EMAILS</code> environment variables.
          This lets you migrate to DB-managed subscribers at your own pace without breaking anything.
        </p>
      </div>
    </div>
  );
}

function SubscriberGroup({
  title,
  icon,
  subs,
  onToggle,
  onDelete,
}: {
  title: string;
  icon: string;
  subs: Subscription[];
  onToggle: (sub: Subscription, field: keyof Subscription) => void;
  onDelete: (sub: Subscription) => void;
}) {
  return (
    <div>
      <h2 className="text-text-primary font-semibold text-sm mb-2">
        {icon} {title} <span className="text-text-dim font-normal">({subs.length})</span>
      </h2>
      <div className="bg-card border border-border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Email</th>
              <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Name</th>
              <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Enabled</th>
              <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">Notes</th>
              <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-surface/40">
                <td className="px-3 py-2.5 text-text-primary font-mono">{s.email}</td>
                <td className="px-3 py-2.5 text-text-secondary hidden md:table-cell">{s.name || '—'}</td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    onClick={() => onToggle(s, 'enabled')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      s.enabled
                        ? 'text-positive bg-positive/10 border-positive/30'
                        : 'text-text-dim bg-surface border-border'
                    }`}
                  >
                    {s.enabled ? '✓ ON' : '× OFF'}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-text-dim text-[11px] hidden lg:table-cell max-w-[200px] truncate">
                  {s.notes || '—'}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => onDelete(s)}
                    className="text-[10px] font-semibold text-negative border border-negative/30 rounded px-2 py-0.5 hover:bg-negative/10 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
