import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompanyRow {
  id: number;
  name: string;
  country: string;
  company_type: string;
  products: string[];
  feedstocks: string[];
  capacity_kt: number | null;
  website: string;
  description: string;
  iscc_cert_id: string;
  iscc_valid_to: string | null;
  iscc_suspended: boolean;
  news_mention_count: number;
  last_news_mention: string | null;
  in_crm: boolean;
  score: number;
  score_tier: 'hot' | 'warm' | 'cold';
  notes: string;
}

interface ProspectRow {
  id: number;
  company_id: number;
  company_name: string;
  company_country: string;
  company_type: string;
  products: string[];
  score: number;
  score_tier: string;
  status: string;
  priority: string;
  notes: string;
  last_contact: string | null;
  next_action: string;
  next_action_date: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TABS = ['Companies', 'Lead Scoring', 'Outreach', 'Opportunity Radar', 'Market Map'] as const;
type Tab = (typeof TABS)[number];

const STATUSES = ['identified', 'contacted', 'meeting', 'proposal', 'won', 'lost'] as const;

function apiGet<T>(path: string): Promise<T> {
  return fetch(`${API_BASE_URL}${path}`, { headers: { 'X-API-Key': API_KEY } }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
  });
}

function apiPost(path: string): Promise<unknown> {
  return fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: { 'X-API-Key': API_KEY } }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

function apiPatch(path: string): Promise<unknown> {
  return fetch(`${API_BASE_URL}${path}`, { method: 'PATCH', headers: { 'X-API-Key': API_KEY } }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

function tierBadge(tier: string): string {
  return tier === 'hot'
    ? 'bg-negative/10 text-negative border-negative/20'
    : tier === 'warm'
    ? 'bg-accent/10 text-accent border-accent/20'
    : 'bg-surface/50 text-text-dim border-border';
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    identified: 'bg-surface/50 text-text-dim border-border',
    contacted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    meeting: 'bg-accent/10 text-accent border-accent/20',
    proposal: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    won: 'bg-positive/10 text-positive border-positive/20',
    lost: 'bg-negative/10 text-negative border-negative/20',
  };
  return map[s] ?? map.identified;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPANIES SUB-VIEW
// ═══════════════════════════════════════════════════════════════════════════

const COMPANY_TYPES = ['producer', 'trader', 'blender', 'obligated_party', 'feedstock_supplier', 'collector'];

function AddCompanyForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', country: '', company_type: 'producer', products: '' as string, feedstocks: '', website: '', description: '' });

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/prospection/companies`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          country: form.country.trim().toUpperCase(),
          company_type: form.company_type,
          products: form.products.split(',').map(s => s.trim()).filter(Boolean),
          feedstocks: form.feedstocks.split(',').map(s => s.trim()).filter(Boolean),
          website: form.website.trim(),
          description: form.description.trim(),
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      setForm({ name: '', country: '', company_type: 'producer', products: '', feedstocks: '', website: '', description: '' });
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="px-3 py-1 rounded text-[11px] font-semibold border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20">
        + Add Company
      </button>
    );
  }

  return (
    <div className="bg-card border border-accent/30 rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-text-primary text-xs font-semibold uppercase tracking-widest">Add Company</h4>
        <button onClick={() => setOpen(false)} className="text-text-dim hover:text-text-primary text-xs">Cancel</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <input placeholder="Company name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50" />
        <input placeholder="Country (ISO, e.g. NL)" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50" />
        <select value={form.company_type} onChange={e => setForm({ ...form, company_type: e.target.value })} className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent/50">
          {COMPANY_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <input placeholder="Products (comma-sep: HVO, SAF)" value={form.products} onChange={e => setForm({ ...form, products: e.target.value })} className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50" />
        <input placeholder="Feedstocks (comma-sep: UCO, tallow)" value={form.feedstocks} onChange={e => setForm({ ...form, feedstocks: e.target.value })} className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50" />
        <input placeholder="Website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50" />
      </div>
      <input placeholder="Short description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50" />
      {error && <div className="text-negative text-xs">{error}</div>}
      <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded text-xs font-semibold bg-accent/10 border border-accent text-accent hover:bg-accent/20 disabled:opacity-40">
        {saving ? 'Saving…' : 'Save Company'}
      </button>
    </div>
  );
}

function CompaniesView() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ companies: CompanyRow[] }>('/prospection/companies');
      setCompanies(data.companies);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const seed = async () => {
    setSeeding(true);
    try {
      await apiPost('/prospection/seed');
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return companies.filter(c => {
      if (typeFilter && c.company_type !== typeFilter) return false;
      if (tierFilter && c.score_tier !== tierFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.country.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [companies, search, typeFilter, tierFilter]);

  const types = useMemo(() => Array.from(new Set(companies.map(c => c.company_type))).filter(Boolean).sort(), [companies]);

  return (
    <div className="space-y-5">
      {companies.length === 0 && !loading && (
        <div className="bg-card border border-border rounded p-6 text-center">
          <p className="text-text-primary text-sm mb-3">No companies in the database yet.</p>
          <button onClick={seed} disabled={seeding} className="px-4 py-2 rounded text-sm font-semibold bg-accent/10 border border-accent text-accent hover:bg-accent/20 disabled:opacity-40">
            {seeding ? 'Seeding ~100 companies…' : 'Seed Company Database'}
          </button>
          <p className="text-text-dim text-xs mt-2">Populates ~100 curated biofuel companies from public sources.</p>
        </div>
      )}

      {companies.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input type="text" placeholder="Search name, country, description…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[200px] bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent/50">
              <option value="">All types</option>
              {types.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            <div className="flex gap-1">
              {['', 'hot', 'warm', 'cold'].map(t => (
                <button key={t} onClick={() => setTierFilter(t)} className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors ${tierFilter === t ? 'bg-accent/10 border-accent text-accent' : 'bg-card border-border text-text-secondary hover:border-accent/40'}`}>
                  {t || 'All'}
                </button>
              ))}
            </div>
          </div>

          <AddCompanyForm onAdded={load} />

          <div className="bg-card border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-text-primary font-semibold text-sm">Companies ({filtered.length})</h3>
            </div>
            <div className="overflow-x-auto max-h-[35rem]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface z-10">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Company</th>
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Country</th>
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Type</th>
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">Products</th>
                    <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Score</th>
                    <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Tier</th>
                    <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">CRM</th>
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden xl:table-cell">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-surface/40">
                      <td className="px-3 py-2 text-text-primary font-semibold">{c.name}</td>
                      <td className="px-3 py-2 text-text-secondary">{c.country}</td>
                      <td className="px-3 py-2 text-text-secondary hidden md:table-cell">{c.company_type.replace('_', ' ')}</td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {c.products.slice(0, 4).map(p => (
                            <span key={p} className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-surface/50 text-text-dim border border-border">{p}</span>
                          ))}
                          {c.products.length > 4 && <span className="text-text-dim text-[9px]">+{c.products.length - 4}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-primary font-bold">{c.score}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${tierBadge(c.score_tier)}`}>{c.score_tier.toUpperCase()}</span>
                      </td>
                      <td className="px-3 py-2 text-center hidden md:table-cell">
                        {c.in_crm ? <span className="text-positive">✓</span> : <span className="text-text-dim">—</span>}
                      </td>
                      <td className="px-3 py-2 text-text-dim text-[10px] hidden xl:table-cell max-w-xs truncate" title={c.description}>{c.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {loading && <div className="flex items-center justify-center py-20"><Spinner /></div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEAD SCORING SUB-VIEW
// ═══════════════════════════════════════════════════════════════════════════

function LeadScoringView() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescoring, setRescoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ companies: CompanyRow[] }>('/prospection/companies');
      setCompanies(data.companies.sort((a, b) => b.score - a.score));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rescore = async () => {
    setRescoring(true);
    try {
      await apiPost('/prospection/rescore');
      await load();
    } finally {
      setRescoring(false);
    }
  };

  const tiers = useMemo(() => {
    const hot = companies.filter(c => c.score_tier === 'hot');
    const warm = companies.filter(c => c.score_tier === 'warm');
    const cold = companies.filter(c => c.score_tier === 'cold');
    return { hot, warm, cold };
  }, [companies]);

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1 max-w-lg">
          <div className="bg-negative/5 border border-negative/20 rounded p-3 text-center">
            <div className="text-negative font-bold text-xl">{tiers.hot.length}</div>
            <div className="text-text-dim text-[10px] uppercase">Hot leads</div>
          </div>
          <div className="bg-accent/5 border border-accent/20 rounded p-3 text-center">
            <div className="text-accent font-bold text-xl">{tiers.warm.length}</div>
            <div className="text-text-dim text-[10px] uppercase">Warm leads</div>
          </div>
          <div className="bg-surface/50 border border-border rounded p-3 text-center">
            <div className="text-text-dim font-bold text-xl">{tiers.cold.length}</div>
            <div className="text-text-dim text-[10px] uppercase">Cold leads</div>
          </div>
        </div>
        <button onClick={rescore} disabled={rescoring} className="px-3 py-1.5 rounded text-xs font-semibold border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40">
          {rescoring ? 'Rescoring…' : '↻ Rescore all'}
        </button>
      </div>

      {['hot', 'warm', 'cold'].map(tier => {
        const list = tier === 'hot' ? tiers.hot : tier === 'warm' ? tiers.warm : tiers.cold;
        if (list.length === 0) return null;
        return (
          <div key={tier} className="bg-card border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-text-primary font-semibold text-sm">{tier.toUpperCase()} — {list.length} companies (score {tier === 'hot' ? '75-100' : tier === 'warm' ? '40-74' : '0-39'})</h3>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface z-10">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Company</th>
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Country</th>
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Type</th>
                    <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Score</th>
                    <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">Products</th>
                    <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(c => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-surface/40">
                      <td className="px-3 py-2 text-text-primary font-semibold">{c.name}</td>
                      <td className="px-3 py-2 text-text-secondary">{c.country}</td>
                      <td className="px-3 py-2 text-text-secondary hidden md:table-cell">{c.company_type.replace('_', ' ')}</td>
                      <td className="px-3 py-2 text-right font-mono text-text-primary font-bold">{c.score}</td>
                      <td className="px-3 py-2 hidden lg:table-cell text-text-dim">{c.products.join(', ')}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => void apiPost(`/prospection/prospects?company_id=${c.id}`)} className="px-2 py-0.5 rounded text-[10px] font-semibold border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20">+ Prospect</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTREACH TRACKER SUB-VIEW
// ═══════════════════════════════════════════════════════════════════════════

function OutreachView() {
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ prospects: ProspectRow[] }>(`/prospection/prospects${statusFilter ? `?status=${statusFilter}` : ''}`);
      setProspects(data.prospects);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (id: number, newStatus: string) => {
    await apiPatch(`/prospection/prospects/${id}?status=${newStatus}`);
    await load();
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STATUSES) c[s] = prospects.filter(p => p.status === s).length;
    return c;
  }, [prospects]);

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)} className={`rounded p-2 text-center border transition-colors ${statusFilter === s ? 'bg-accent/10 border-accent' : 'bg-card border-border hover:border-accent/40'}`}>
            <div className="font-bold text-lg text-text-primary">{counts[s] ?? 0}</div>
            <div className="text-[10px] uppercase text-text-dim">{s}</div>
          </button>
        ))}
      </div>

      {prospects.length === 0 ? (
        <div className="bg-card border border-border rounded p-8 text-center text-text-dim text-sm">
          No prospects yet. Go to Lead Scoring and click "+ Prospect" on companies you want to pursue.
        </div>
      ) : (
        <div className="bg-card border border-border rounded overflow-hidden">
          <div className="overflow-x-auto max-h-[35rem]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Company</th>
                  <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Country</th>
                  <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Status</th>
                  <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Priority</th>
                  <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Next Action</th>
                  <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Due</th>
                  <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">Last Contact</th>
                  <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Advance</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map(p => {
                  const nextStatusIdx = STATUSES.indexOf(p.status as typeof STATUSES[number]);
                  const nextStatus = nextStatusIdx >= 0 && nextStatusIdx < STATUSES.length - 2 ? STATUSES[nextStatusIdx + 1] : null;
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-surface/40">
                      <td className="px-3 py-2 text-text-primary font-semibold">{p.company_name}</td>
                      <td className="px-3 py-2 text-text-secondary">{p.company_country}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusColor(p.status)}`}>{p.status.toUpperCase()}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${p.priority === 'high' ? 'text-negative' : p.priority === 'medium' ? 'text-accent' : 'text-text-dim'}`}>{p.priority}</span>
                      </td>
                      <td className="px-3 py-2 text-text-secondary hidden md:table-cell">{p.next_action || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-text-dim hidden md:table-cell">{fmtDate(p.next_action_date)}</td>
                      <td className="px-3 py-2 text-right font-mono text-text-dim hidden lg:table-cell">{fmtDate(p.last_contact)}</td>
                      <td className="px-3 py-2 text-center">
                        {nextStatus ? (
                          <button onClick={() => void updateStatus(p.id, nextStatus)} className="px-2 py-0.5 rounded text-[10px] font-semibold border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20">→ {nextStatus}</button>
                        ) : (
                          <span className="text-text-dim text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OPPORTUNITY RADAR (placeholder — Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

function OpportunityRadarView() {
  return (
    <div className="bg-card border border-border rounded p-8 text-center">
      <h3 className="text-text-primary font-semibold text-sm mb-2">Opportunity Radar</h3>
      <p className="text-text-dim text-xs max-w-md mx-auto">
        Coming in Phase 2. Will automatically match news articles to companies in your database and surface
        sales opportunities — new plant announcements, mandate changes creating demand, ISCC certificate
        expirations, and M&A activity.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET MAP (structured grid, not geographic)
// ═══════════════════════════════════════════════════════════════════════════

function MarketMapView() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ companies: CompanyRow[] }>('/prospection/companies');
        setCompanies(data.companies);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const byTypeAndCountry = useMemo(() => {
    const map: Record<string, Record<string, CompanyRow[]>> = {};
    for (const c of companies) {
      const t = c.company_type || 'other';
      const co = c.country || 'Unknown';
      if (!map[t]) map[t] = {};
      if (!map[t][co]) map[t][co] = [];
      map[t][co].push(c);
    }
    return map;
  }, [companies]);

  const typeOrder = ['producer', 'trader', 'blender', 'obligated_party', 'feedstock_supplier', 'collector'];
  const typeLabels: Record<string, string> = {
    producer: 'Producers', trader: 'Traders', blender: 'Blenders',
    obligated_party: 'Obligated Parties', feedstock_supplier: 'Feedstock Suppliers', collector: 'Collectors',
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded p-4">
        <h3 className="text-text-primary font-semibold text-sm mb-1">Biofuel Value Chain Map</h3>
        <p className="text-text-dim text-xs">Companies organized by role and country. Click to explore.</p>
      </div>

      {typeOrder.map(t => {
        const countriesMap = byTypeAndCountry[t];
        if (!countriesMap) return null;
        const sortedCountries = Object.entries(countriesMap).sort((a, b) => b[1].length - a[1].length);
        return (
          <div key={t} className="bg-card border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-text-primary font-semibold text-sm">{typeLabels[t] ?? t} ({Object.values(countriesMap).flat().length})</h3>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {sortedCountries.map(([country, list]) => (
                <div key={country} className="bg-surface/50 border border-border rounded p-3 min-w-[120px]" title={list.map(c => c.name).join('\n')}>
                  <div className="text-text-primary font-bold text-sm">{country}</div>
                  <div className="text-accent font-mono text-lg font-bold">{list.length}</div>
                  <div className="text-text-dim text-[9px] mt-1 space-y-0.5">
                    {list.slice(0, 3).map(c => <div key={c.id} className="truncate">{c.name}</div>)}
                    {list.length > 3 && <div className="text-text-dim">+{list.length - 3} more</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function Prospection() {
  const [tab, setTab] = useState<Tab>('Companies');

  return (
    <div className="max-w-6xl space-y-5">
      <div className="pb-3 border-b border-border">
        <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Business Development</p>
        <h1 className="text-text-primary font-semibold text-base">Prospection</h1>
        <p className="text-text-dim text-xs mt-1">
          Company database, lead scoring, and outreach pipeline for biofuel derivatives brokering
        </p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-semibold tracking-wide uppercase transition-colors border-b-2 -mb-px whitespace-nowrap ${tab === t ? 'text-accent border-accent' : 'text-text-secondary border-transparent hover:text-text-primary'}`}>{t}</button>
        ))}
      </div>

      <div>
        {tab === 'Companies' && <CompaniesView />}
        {tab === 'Lead Scoring' && <LeadScoringView />}
        {tab === 'Outreach' && <OutreachView />}
        {tab === 'Opportunity Radar' && <OpportunityRadarView />}
        {tab === 'Market Map' && <MarketMapView />}
      </div>
    </div>
  );
}
