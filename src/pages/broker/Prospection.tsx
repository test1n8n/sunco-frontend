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
  iscc_scope: string;
  iscc_processing_unit_type: string;
  iscc_raw_materials: string;
  iscc_valid_from: string | null;
  iscc_valid_to: string | null;
  iscc_suspended: boolean;
  iscc_cb: string;
  iscc_cert_pdf_url: string;
  iscc_audit_url: string;
  in_crm: boolean;
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

const TABS = ['Companies', 'Database Stats', 'Outreach', 'Opportunity Radar', 'Market Map'] as const;
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

function ImportIsccButton({ onDone }: { onDone: () => void }) {
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [companyCount, setCompanyCount] = useState(0);
  const [startCount, setStartCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const run = async (onlyValid: boolean) => {
    setImporting(true);
    setStatus('running');
    setElapsed(0);
    setErrorMsg('');

    // Get current count before import
    try {
      const before = await apiGet<{ count: number }>('/prospection/companies');
      setStartCount(before.count);
      setCompanyCount(before.count);
    } catch { /* ignore */ }

    // Trigger the import
    try {
      await apiPost(`/prospection/import-iscc?only_valid=${onlyValid}`);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start import');
      setImporting(false);
      return;
    }

    // Poll for progress every 5 seconds
    const startTime = Date.now();
    let stableCount = 0;
    let lastCount = 0;

    const pollInterval = setInterval(async () => {
      try {
        const data = await apiGet<{ count: number }>('/prospection/companies');
        setCompanyCount(data.count);
        setElapsed(Math.floor((Date.now() - startTime) / 1000));

        // Detect when import is done: count stopped increasing for 3 consecutive polls
        if (data.count === lastCount && data.count > startCount) {
          stableCount++;
          if (stableCount >= 3) {
            clearInterval(pollInterval);
            setStatus('done');
            setImporting(false);
            onDone();
          }
        } else {
          stableCount = 0;
        }
        lastCount = data.count;

        // Safety timeout: 10 minutes max
        if (Date.now() - startTime > 600000) {
          clearInterval(pollInterval);
          setStatus('done');
          setImporting(false);
          onDone();
        }
      } catch { /* ignore poll errors */ }
    }, 5000);
  };

  const added = companyCount - startCount;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={() => run(true)} disabled={importing} className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors ${importing ? 'border-positive/20 bg-positive/5 text-positive/50 cursor-not-allowed' : 'border-positive/30 bg-positive/10 text-positive hover:bg-positive/20'}`} title="Import only currently valid certificates (~20-30k)">
          {status === 'running' ? 'Importing…' : 'Import ISCC (valid only)'}
        </button>
        <button onClick={() => run(false)} disabled={importing} className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors ${importing ? 'border-border bg-surface/30 text-text-dim cursor-not-allowed' : 'border-border bg-surface/50 text-text-secondary hover:border-accent/40'}`} title="Import all ~87k certificates including expired">
          {status === 'running' ? '…' : 'Import all 87k'}
        </button>
      </div>

      {status === 'running' && (
        <div className="bg-accent/5 border border-accent/20 rounded p-3 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="text-xs">
            <div className="text-accent font-semibold">ISCC import running…</div>
            <div className="text-text-secondary mt-0.5">
              {added > 0 ? `${added.toLocaleString()} new companies added` : 'Starting up — fetching first batch'}
              {' · '}{minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`} elapsed
            </div>
            <div className="text-text-dim text-[10px] mt-0.5">This runs in the background — you can navigate away and come back.</div>
          </div>
        </div>
      )}

      {status === 'done' && (
        <div className="bg-positive/5 border border-positive/20 rounded p-3 text-xs">
          <span className="text-positive font-semibold">Import complete.</span>
          <span className="text-text-secondary ml-2">{added.toLocaleString()} new companies added in {minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`}. Total: {companyCount.toLocaleString()}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-negative/5 border border-negative/20 rounded p-3 text-xs text-negative">
          Import failed: {errorMsg}
        </div>
      )}
    </div>
  );
}

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
  const [seeding, setSeeding] = useState(false);

  // Per-column filters
  const [fCountry, setFCountry] = useState('');
  const [fType, setFType] = useState('');
  const [fScope, setFScope] = useState('');
  const [fProcessing, setFProcessing] = useState('');
  const [fFeedstock, setFFeedstock] = useState('');
  const [fProduct, setFProduct] = useState('');
  const [fSuspended, setFSuspended] = useState('');
  const [fValidity, setFValidity] = useState('');

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
    try { await apiPost('/prospection/seed'); await load(); } finally { setSeeding(false); }
  };

  // Unique values for filter dropdowns
  const uniqVals = useMemo(() => {
    const s = (arr: CompanyRow[], fn: (c: CompanyRow) => string) => Array.from(new Set(arr.map(fn))).filter(Boolean).sort();
    return {
      countries: s(companies, c => c.country),
      types: s(companies, c => c.company_type),
      scopes: s(companies, c => c.iscc_scope),
      processing: s(companies, c => c.iscc_processing_unit_type),
      feedstocks: Array.from(new Set(companies.flatMap(c => c.feedstocks))).filter(Boolean).sort(),
      products: Array.from(new Set(companies.flatMap(c => c.products))).filter(Boolean).sort(),
    };
  }, [companies]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const in3mo = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    return companies.filter(c => {
      if (fCountry && c.country !== fCountry) return false;
      if (fType && c.company_type !== fType) return false;
      if (fScope && c.iscc_scope !== fScope) return false;
      if (fProcessing && c.iscc_processing_unit_type !== fProcessing) return false;
      if (fFeedstock && !c.feedstocks.some(f => f.toLowerCase().includes(fFeedstock.toLowerCase()))) return false;
      if (fProduct && !c.products.some(p => p.toLowerCase().includes(fProduct.toLowerCase()))) return false;
      if (fSuspended === 'yes' && !c.iscc_suspended) return false;
      if (fSuspended === 'no' && c.iscc_suspended) return false;
      if (fValidity === 'valid' && (!c.iscc_valid_to || c.iscc_valid_to < today)) return false;
      if (fValidity === 'expiring' && (!c.iscc_valid_to || c.iscc_valid_to < today || c.iscc_valid_to > in3mo)) return false;
      if (fValidity === 'expired' && (!c.iscc_valid_to || c.iscc_valid_to >= today)) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.country.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q) && !c.iscc_raw_materials.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [companies, search, fCountry, fType, fScope, fProcessing, fFeedstock, fProduct, fSuspended, fValidity]);

  const exportCsv = () => {
    const headers = ['Company', 'Country', 'Role', 'Scope', 'Processing', 'Feedstocks', 'Products', 'Valid From', 'Valid Until', 'Suspended', 'Cert Body', 'Cert ID', 'Certificate PDF', 'Audit Report', 'In CRM', 'Notes'];
    const rows = filtered.map(c => [
      c.name, c.country, c.company_type, c.iscc_scope, c.iscc_processing_unit_type,
      c.feedstocks.join('; '), c.products.join('; '),
      c.iscc_valid_from ?? '', c.iscc_valid_to ?? '', c.iscc_suspended ? 'Yes' : 'No',
      c.iscc_cb, c.iscc_cert_id, c.iscc_cert_pdf_url, c.iscc_audit_url,
      c.in_crm ? 'Yes' : 'No', c.notes,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sunco_companies_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const selCls = "bg-surface border border-border rounded px-2 py-1 text-[10px] text-text-secondary focus:outline-none focus:border-accent/50 max-w-[120px]";

  return (
    <div className="space-y-4">
      {companies.length === 0 && !loading && (
        <div className="bg-card border border-border rounded p-6 text-center">
          <p className="text-text-primary text-sm mb-3">No companies in the database yet.</p>
          <button onClick={seed} disabled={seeding} className="px-4 py-2 rounded text-sm font-semibold bg-accent/10 border border-accent text-accent hover:bg-accent/20 disabled:opacity-40">
            {seeding ? 'Seeding…' : 'Seed Company Database'}
          </button>
          <p className="text-text-dim text-xs mt-2">Populates ~100 curated biofuel companies from public sources.</p>
        </div>
      )}

      {companies.length > 0 && (
        <>
          {/* Actions row */}
          <div className="flex flex-wrap items-center gap-3">
            <AddCompanyForm onAdded={load} />
            <ImportIsccButton onDone={load} />
          </div>

          {/* Search + CSV export */}
          <div className="flex items-center gap-3">
            <input type="text" placeholder="Search name, country, feedstock…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[200px] bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50" />
            <button onClick={exportCsv} disabled={filtered.length === 0} className="px-3 py-1.5 rounded text-xs font-semibold border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 shrink-0">
              ↓ Export CSV ({filtered.length})
            </button>
          </div>

          {/* Column filters */}
          <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded p-3">
            <span className="text-text-dim text-[10px] uppercase tracking-widest shrink-0">Filters:</span>
            <select value={fCountry} onChange={e => setFCountry(e.target.value)} className={selCls}>
              <option value="">All countries</option>
              {uniqVals.countries.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={fType} onChange={e => setFType(e.target.value)} className={selCls}>
              <option value="">All roles</option>
              {uniqVals.types.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={fScope} onChange={e => setFScope(e.target.value)} className={selCls}>
              <option value="">All scopes</option>
              {uniqVals.scopes.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={fProcessing} onChange={e => setFProcessing(e.target.value)} className={selCls}>
              <option value="">All processing</option>
              {uniqVals.processing.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={fFeedstock} onChange={e => setFFeedstock(e.target.value)} className={selCls}>
              <option value="">All feedstocks</option>
              {uniqVals.feedstocks.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={fProduct} onChange={e => setFProduct(e.target.value)} className={selCls}>
              <option value="">All products</option>
              {uniqVals.products.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={fSuspended} onChange={e => setFSuspended(e.target.value)} className={selCls}>
              <option value="">Suspended?</option>
              <option value="yes">Suspended</option>
              <option value="no">Not suspended</option>
            </select>
            <select value={fValidity} onChange={e => setFValidity(e.target.value)} className={selCls}>
              <option value="">All validity</option>
              <option value="valid">Valid now</option>
              <option value="expiring">Expiring ≤3mo</option>
              <option value="expired">Expired</option>
            </select>
            {(fCountry || fType || fScope || fProcessing || fFeedstock || fProduct || fSuspended || fValidity) && (
              <button onClick={() => { setFCountry(''); setFType(''); setFScope(''); setFProcessing(''); setFFeedstock(''); setFProduct(''); setFSuspended(''); setFValidity(''); }} className="text-negative text-[10px] hover:underline shrink-0">Clear all</button>
            )}
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-text-primary font-semibold text-sm">Companies ({filtered.length.toLocaleString()} of {companies.length.toLocaleString()})</h3>
            </div>
            <div className="overflow-x-auto max-h-[40rem]">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="sticky top-0 bg-surface z-10">
                  <tr className="border-b border-border">
                    <th className="px-2 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Company</th>
                    <th className="px-2 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Country</th>
                    <th className="px-2 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Role</th>
                    <th className="px-2 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Scope</th>
                    <th className="px-2 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Processing</th>
                    <th className="px-2 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Feedstocks</th>
                    <th className="px-2 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Products</th>
                    <th className="px-2 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Valid From</th>
                    <th className="px-2 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Valid Until</th>
                    <th className="px-2 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Susp.</th>
                    <th className="px-2 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Cert Body</th>
                    <th className="px-2 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Cert</th>
                    <th className="px-2 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Audit</th>
                    <th className="px-2 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">CRM</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map(c => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-surface/40">
                      <td className="px-2 py-1.5 text-text-primary font-semibold max-w-[200px] truncate" title={c.name}>{c.name}</td>
                      <td className="px-2 py-1.5 text-text-secondary">{c.country}</td>
                      <td className="px-2 py-1.5 text-text-secondary">{c.company_type.replace(/_/g, ' ')}</td>
                      <td className="px-2 py-1.5 text-text-dim max-w-[100px] truncate" title={c.iscc_scope}>{c.iscc_scope || '—'}</td>
                      <td className="px-2 py-1.5 text-text-dim max-w-[100px] truncate" title={c.iscc_processing_unit_type}>{c.iscc_processing_unit_type || '—'}</td>
                      <td className="px-2 py-1.5 text-text-dim max-w-[120px] truncate" title={c.feedstocks.join(', ')}>{c.feedstocks.join(', ') || '—'}</td>
                      <td className="px-2 py-1.5 text-text-dim max-w-[120px] truncate" title={c.products.join(', ')}>{c.products.join(', ') || '—'}</td>
                      <td className="px-2 py-1.5 text-text-dim font-mono">{fmtDate(c.iscc_valid_from)}</td>
                      <td className="px-2 py-1.5 text-text-dim font-mono">{fmtDate(c.iscc_valid_to)}</td>
                      <td className="px-2 py-1.5 text-center">{c.iscc_suspended ? <span className="text-negative font-bold">YES</span> : <span className="text-text-dim">—</span>}</td>
                      <td className="px-2 py-1.5 text-text-dim max-w-[80px] truncate" title={c.iscc_cb}>{c.iscc_cb || '—'}</td>
                      <td className="px-2 py-1.5 text-center">{c.iscc_cert_pdf_url ? <a href={c.iscc_cert_pdf_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">PDF</a> : <span className="text-text-dim">—</span>}</td>
                      <td className="px-2 py-1.5 text-center">{c.iscc_audit_url ? <a href={c.iscc_audit_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Audit</a> : <span className="text-text-dim">—</span>}</td>
                      <td className="px-2 py-1.5 text-center">{c.in_crm ? <span className="text-positive">✓</span> : <span className="text-text-dim">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 500 && (
              <div className="px-4 py-2 border-t border-border text-text-dim text-[10px]">
                Showing first 500 of {filtered.length.toLocaleString()} results. Use filters to narrow down.
              </div>
            )}
          </div>
        </>
      )}

      {loading && <div className="flex items-center justify-center py-20"><Spinner /></div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE STATS SUB-VIEW (replaces Lead Scoring)
// ═══════════════════════════════════════════════════════════════════════════

function DatabaseStatsView() {
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

  const stats = useMemo(() => {
    const byCountry: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byFeedstock: Record<string, number> = {};
    const byProduct: Record<string, number> = {};
    let valid = 0, expiring = 0, expired = 0, noDate = 0, suspended = 0;
    const today = new Date().toISOString().slice(0, 10);
    const in3mo = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    for (const c of companies) {
      byCountry[c.country || 'Unknown'] = (byCountry[c.country || 'Unknown'] ?? 0) + 1;
      byType[c.company_type || 'Unknown'] = (byType[c.company_type || 'Unknown'] ?? 0) + 1;
      for (const f of c.feedstocks) byFeedstock[f] = (byFeedstock[f] ?? 0) + 1;
      for (const p of c.products) byProduct[p] = (byProduct[p] ?? 0) + 1;
      if (c.iscc_suspended) suspended++;
      if (!c.iscc_valid_to) noDate++;
      else if (c.iscc_valid_to < today) expired++;
      else if (c.iscc_valid_to <= in3mo) expiring++;
      else valid++;
    }

    const sortDesc = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
    return { byCountry: sortDesc(byCountry), byType: sortDesc(byType), byFeedstock: sortDesc(byFeedstock), byProduct: sortDesc(byProduct), valid, expiring, expired, noDate, suspended, total: companies.length };
  }, [companies]);

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded p-3 text-center"><div className="text-text-primary font-bold text-xl">{stats.total.toLocaleString()}</div><div className="text-text-dim text-[10px] uppercase">Total</div></div>
        <div className="bg-positive/5 border border-positive/20 rounded p-3 text-center"><div className="text-positive font-bold text-xl">{stats.valid.toLocaleString()}</div><div className="text-text-dim text-[10px] uppercase">Valid</div></div>
        <div className="bg-accent/5 border border-accent/20 rounded p-3 text-center"><div className="text-accent font-bold text-xl">{stats.expiring.toLocaleString()}</div><div className="text-text-dim text-[10px] uppercase">Expiring ≤3mo</div></div>
        <div className="bg-negative/5 border border-negative/20 rounded p-3 text-center"><div className="text-negative font-bold text-xl">{stats.expired.toLocaleString()}</div><div className="text-text-dim text-[10px] uppercase">Expired</div></div>
        <div className="bg-negative/5 border border-negative/20 rounded p-3 text-center"><div className="text-negative font-bold text-xl">{stats.suspended}</div><div className="text-text-dim text-[10px] uppercase">Suspended</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          { title: 'By Country (top 20)', data: stats.byCountry.slice(0, 20) },
          { title: 'By Role', data: stats.byType },
          { title: 'By Feedstock (top 20)', data: stats.byFeedstock.slice(0, 20) },
          { title: 'By Product (top 20)', data: stats.byProduct.slice(0, 20) },
        ].map(({ title, data }) => (
          <div key={title} className="bg-card border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border"><h3 className="text-text-primary font-semibold text-sm">{title}</h3></div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {data.map(([k, v]) => (
                    <tr key={k} className="border-b border-border/50">
                      <td className="px-3 py-1.5 text-text-primary">{k.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-text-secondary">{v.toLocaleString()}</td>
                      <td className="px-3 py-1.5 w-24"><div className="bg-border/30 rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full bg-accent/60" style={{ width: `${(v / (data[0]?.[1] ?? 1)) * 100}%` }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
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
        {tab === 'Database Stats' && <DatabaseStatsView />}
        {tab === 'Outreach' && <OutreachView />}
        {tab === 'Opportunity Radar' && <OpportunityRadarView />}
        {tab === 'Market Map' && <MarketMapView />}
      </div>
    </div>
  );
}
