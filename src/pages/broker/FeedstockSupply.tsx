import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  FEEDSTOCKS, TRADE_FLOWS, CATEGORY_LABELS, REGION_COLORS, REGION_LABELS,
  top3Concentration, hhi, riskTier, allCountries,
  type FeedstockCategory,
} from '../../data/feedstockSupply';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TABS = ['Production', 'Trade Flows', 'By Country', 'Risk Summary', 'Trade Matrix'] as const;
type Tab = (typeof TABS)[number];
const CATEGORIES: FeedstockCategory[] = ['conventional', 'advanced', 'saf', 'finished'];

function fmt(n: number, d = 0): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function riskColor(tier: 'low' | 'moderate' | 'high'): string {
  return tier === 'high' ? 'text-negative' : tier === 'moderate' ? 'text-accent' : 'text-positive';
}

function riskBg(tier: 'low' | 'moderate' | 'high'): string {
  return tier === 'high'
    ? 'bg-negative/10 border-negative/20 text-negative'
    : tier === 'moderate'
    ? 'bg-accent/10 border-accent/20 text-accent'
    : 'bg-positive/10 border-positive/20 text-positive';
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

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTION SUB-VIEW
// ═══════════════════════════════════════════════════════════════════════════

function ProductionView() {
  const [selectedCode, setSelectedCode] = useState(FEEDSTOCKS[0].code);
  const [catFilter, setCatFilter] = useState<FeedstockCategory | ''>('');

  const filteredFeedstocks = catFilter ? FEEDSTOCKS.filter(f => f.category === catFilter) : FEEDSTOCKS;
  const selected = FEEDSTOCKS.find(f => f.code === selectedCode) ?? FEEDSTOCKS[0];
  const sorted = [...selected.countries].sort((a, b) => b.share_pct - a.share_pct);
  const tier = riskTier(selected);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setCatFilter('')} className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors ${!catFilter ? 'bg-accent/10 border-accent text-accent' : 'bg-card border-border text-text-secondary hover:border-accent/40'}`}>All</button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors ${catFilter === c ? 'bg-accent/10 border-accent text-accent' : 'bg-card border-border text-text-secondary hover:border-accent/40'}`}>{CATEGORY_LABELS[c]}</button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {filteredFeedstocks.map(f => (
          <button key={f.code} onClick={() => setSelectedCode(f.code)} className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${selectedCode === f.code ? 'bg-accent/10 border-accent text-accent' : 'bg-card border-border text-text-secondary hover:border-accent/40'}`}>{f.name}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Global Production" value={`${fmt(selected.totalProduction_kt)} kt`} sub={`${selected.year} · ${selected.source}`} />
        <StatCard label="Top Producer" value={sorted[0]?.countryName ?? '—'} sub={`${fmt(sorted[0]?.share_pct ?? 0, 1)}%`} />
        <StatCard label="Top-3 Share" value={`${fmt(top3Concentration(selected), 1)}%`} color={top3Concentration(selected) > 75 ? 'text-negative' : top3Concentration(selected) > 50 ? 'text-accent' : 'text-positive'} />
        <StatCard label="HHI Index" value={fmt(hhi(selected), 0)} sub={hhi(selected) >= 2500 ? 'Highly concentrated' : hhi(selected) >= 1500 ? 'Moderately concentrated' : 'Competitive'} />
        <StatCard label="Risk Tier" value={tier.toUpperCase()} color={riskColor(tier)} />
      </div>

      <div className="bg-card border border-border rounded p-4">
        <h3 className="text-text-primary font-semibold text-sm mb-1">{selected.name} — Global Production Share</h3>
        <p className="text-text-dim text-xs mb-3">{selected.description}</p>
        <div style={{ width: '100%', height: Math.max(180, sorted.length * 40) }}>
          <ResponsiveContainer>
            <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} domain={[0, 'auto']} />
              <YAxis type="category" dataKey="countryName" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} width={85} />
              <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }} formatter={(v) => [`${typeof v === 'number' ? v.toFixed(1) : v}%`, 'Share']} />
              <Bar dataKey="share_pct" radius={[0, 4, 4, 0]}>
                {sorted.map((entry, i) => (
                  <Cell key={i} fill={REGION_COLORS[entry.region]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-3 justify-end">
          {Object.entries(REGION_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5 text-[10px] text-text-dim">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: REGION_COLORS[key as keyof typeof REGION_COLORS] }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-text-primary font-semibold text-sm">Detailed Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Country</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Region</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Share</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Production</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Bar</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-surface/40">
                  <td className="px-3 py-2 text-text-primary font-semibold">{c.countryName}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-[10px] font-semibold border" style={{ borderColor: REGION_COLORS[c.region] + '40', color: REGION_COLORS[c.region], background: REGION_COLORS[c.region] + '15' }}>{REGION_LABELS[c.region]}</span></td>
                  <td className="px-3 py-2 text-right font-mono text-text-primary font-bold">{c.share_pct.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono text-text-secondary">{fmt(c.production_kt)} kt</td>
                  <td className="px-3 py-2 w-40"><div className="bg-border/30 rounded-full h-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, c.share_pct / (sorted[0]?.share_pct || 1) * 100)}%`, background: REGION_COLORS[c.region] }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TRADE FLOWS SUB-VIEW
// ═══════════════════════════════════════════════════════════════════════════

function TradeFlowsView() {
  const [catFilter, setCatFilter] = useState<FeedstockCategory | ''>('');
  const [countryFilter, setCountryFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<'any' | 'exporter' | 'importer'>('any');

  const countries = useMemo(() => allCountries(), []);

  const filtered = useMemo(() => {
    let flows = [...TRADE_FLOWS];
    if (catFilter) flows = flows.filter(f => f.category === catFilter);
    if (countryFilter) {
      if (roleFilter === 'exporter') flows = flows.filter(f => f.exporter === countryFilter);
      else if (roleFilter === 'importer') flows = flows.filter(f => f.importer === countryFilter);
      else flows = flows.filter(f => f.exporter === countryFilter || f.importer === countryFilter);
    }
    return flows.sort((a, b) => b.volume_kt - a.volume_kt);
  }, [catFilter, countryFilter, roleFilter]);

  const maxVol = filtered[0]?.volume_kt ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setCatFilter('')} className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors ${!catFilter ? 'bg-accent/10 border-accent text-accent' : 'bg-card border-border text-text-secondary hover:border-accent/40'}`}>All</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors ${catFilter === c ? 'bg-accent/10 border-accent text-accent' : 'bg-card border-border text-text-secondary hover:border-accent/40'}`}>{CATEGORY_LABELS[c]}</button>
          ))}
        </div>
        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent/50">
          <option value="">All countries</option>
          {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        {countryFilter && (
          <div className="flex gap-1">
            {(['any', 'exporter', 'importer'] as const).map(r => (
              <button key={r} onClick={() => setRoleFilter(r)} className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${roleFilter === r ? 'bg-accent/10 border-accent text-accent' : 'bg-card border-border text-text-dim hover:border-accent/40'}`}>{r === 'any' ? 'Either' : r.charAt(0).toUpperCase() + r.slice(1)}</button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-text-primary font-semibold text-sm">Major Bilateral Trade Routes ({filtered.length})</h3>
          <p className="text-text-dim text-xs mt-0.5">Ranked by annual volume. Bar width proportional to largest flow in view.</p>
        </div>
        <div className="overflow-x-auto max-h-[35rem]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Exporter</th>
                <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest w-8">→</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Importer</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Feedstock</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Volume</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">% Trade</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest w-44">Flow</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const feedstock = FEEDSTOCKS.find(f => f.code === t.feedstock);
                return (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface/40">
                    <td className="px-3 py-2 text-text-primary font-semibold">{t.exporterName}</td>
                    <td className="px-3 py-2 text-center text-accent font-bold">→</td>
                    <td className="px-3 py-2 text-text-primary font-semibold">{t.importerName}</td>
                    <td className="px-3 py-2 text-text-secondary">{feedstock?.name ?? t.feedstock}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-primary">{fmt(t.volume_kt)} kt</td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary">{t.pct_of_global_trade.toFixed(1)}%</td>
                    <td className="px-3 py-2 w-44">
                      <div className="bg-border/30 rounded-full h-2.5 overflow-hidden">
                        <div className="h-full rounded-full bg-accent/70" style={{ width: `${(t.volume_kt / maxVol) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-text-dim text-[10px] hidden lg:table-cell max-w-xs truncate" title={t.notes}>{t.notes ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BY COUNTRY SUB-VIEW
// ═══════════════════════════════════════════════════════════════════════════

function ByCountryView() {
  const countries = useMemo(() => allCountries(), []);
  const [selectedCountry, setSelectedCountry] = useState('CN');

  const countryName = countries.find(c => c.code === selectedCountry)?.name ?? selectedCountry;

  const produces = useMemo(() => {
    return FEEDSTOCKS
      .flatMap(f => f.countries.filter(c => c.country === selectedCountry).map(c => ({ feedstock: f.name, category: f.category, share_pct: c.share_pct, production_kt: c.production_kt })))
      .sort((a, b) => b.share_pct - a.share_pct);
  }, [selectedCountry]);

  const exports = useMemo(() => TRADE_FLOWS.filter(t => t.exporter === selectedCountry).sort((a, b) => b.volume_kt - a.volume_kt), [selectedCountry]);
  const imports = useMemo(() => TRADE_FLOWS.filter(t => t.importer === selectedCountry).sort((a, b) => b.volume_kt - a.volume_kt), [selectedCountry]);

  return (
    <div className="space-y-5">
      <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} className="bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50">
        {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Produces" value={`${produces.length} feedstocks`} />
        <StatCard label="Exports to" value={`${exports.length} routes`} />
        <StatCard label="Imports from" value={`${imports.length} routes`} />
      </div>

      {produces.length > 0 && (
        <div className="bg-card border border-border rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-text-primary font-semibold text-sm">{countryName} — Production</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-surface border-b border-border">
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Feedstock</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Category</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Global Share</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Volume</th>
              </tr></thead>
              <tbody>
                {produces.map((p, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-3 py-2 text-text-primary font-semibold">{p.feedstock}</td>
                    <td className="px-3 py-2 text-text-secondary">{CATEGORY_LABELS[p.category]}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-primary font-bold">{p.share_pct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary">{fmt(p.production_kt)} kt</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {exports.length > 0 && (
        <div className="bg-card border border-border rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><h3 className="text-text-primary font-semibold text-sm">{countryName} — Exports</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-surface border-b border-border">
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Destination</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Feedstock</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Volume</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">% Trade</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">Notes</th>
              </tr></thead>
              <tbody>
                {exports.map((t, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-3 py-2 text-text-primary font-semibold">{t.importerName}</td>
                    <td className="px-3 py-2 text-text-secondary">{FEEDSTOCKS.find(f => f.code === t.feedstock)?.name ?? t.feedstock}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-primary">{fmt(t.volume_kt)} kt</td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary">{t.pct_of_global_trade.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-text-dim text-[10px] hidden lg:table-cell">{t.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {imports.length > 0 && (
        <div className="bg-card border border-border rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><h3 className="text-text-primary font-semibold text-sm">{countryName} — Imports</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-surface border-b border-border">
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Source</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Feedstock</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Volume</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">% Trade</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">Notes</th>
              </tr></thead>
              <tbody>
                {imports.map((t, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-3 py-2 text-text-primary font-semibold">{t.exporterName}</td>
                    <td className="px-3 py-2 text-text-secondary">{FEEDSTOCKS.find(f => f.code === t.feedstock)?.name ?? t.feedstock}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-primary">{fmt(t.volume_kt)} kt</td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary">{t.pct_of_global_trade.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-text-dim text-[10px] hidden lg:table-cell">{t.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {produces.length === 0 && exports.length === 0 && imports.length === 0 && (
        <div className="bg-card border border-border rounded p-8 text-center text-text-dim text-sm">
          No feedstock data for {countryName} in the current dataset.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RISK SUMMARY SUB-VIEW
// ═══════════════════════════════════════════════════════════════════════════

function RiskSummaryView() {
  const sorted = [...FEEDSTOCKS].sort((a, b) => hhi(b) - hhi(a));

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded p-4">
        <h3 className="text-text-primary font-semibold text-sm mb-1">Geopolitical Supply Risk Dashboard</h3>
        <p className="text-text-dim text-xs">
          Every feedstock ranked by supply concentration. HHI &gt;2500 = highly concentrated (red). Single-source dependency = one country controls &gt;50%.
        </p>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Feedstock</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Category</th>
                <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Top Producer</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">#1 Share</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Top-3</th>
                <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">HHI</th>
                <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest">Risk</th>
                <th className="px-3 py-2 text-center text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Single Source</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(f => {
                const top = [...f.countries].sort((a, b) => b.share_pct - a.share_pct);
                const tier = riskTier(f);
                const singleSource = top[0] && top[0].share_pct >= 50;
                return (
                  <tr key={f.code} className="border-b border-border/50 hover:bg-surface/40">
                    <td className="px-3 py-2 text-text-primary font-semibold">{f.name}</td>
                    <td className="px-3 py-2 text-text-secondary">{CATEGORY_LABELS[f.category]}</td>
                    <td className="px-3 py-2 text-text-primary">{top[0]?.countryName ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-primary font-bold">{top[0]?.share_pct.toFixed(1) ?? '—'}%</td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary">{top3Concentration(f).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary">{fmt(hhi(f))}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${riskBg(tier)}`}>{tier.toUpperCase()}</span>
                    </td>
                    <td className="px-3 py-2 text-center hidden md:table-cell">
                      {singleSource ? <span className="text-negative font-bold">⚠ YES</span> : <span className="text-text-dim">no</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TRADE MATRIX SUB-VIEW (heatmap)
// ═══════════════════════════════════════════════════════════════════════════

function TradeMatrixView() {
  const [catFilter, setCatFilter] = useState<FeedstockCategory | ''>('');

  const filtered = catFilter ? TRADE_FLOWS.filter(f => f.category === catFilter) : TRADE_FLOWS;

  const { importers, matrix, maxVol } = useMemo(() => {
    const expSet = new Set<string>();
    const impSet = new Set<string>();
    const volMap = new Map<string, number>();

    for (const t of filtered) {
      expSet.add(t.exporter);
      impSet.add(t.importer);
      const key = `${t.exporter}|${t.importer}`;
      volMap.set(key, (volMap.get(key) ?? 0) + t.volume_kt);
    }

    const exporters = Array.from(expSet).sort();
    const importers = Array.from(impSet).sort();

    const nameMap = new Map<string, string>();
    for (const t of filtered) { nameMap.set(t.exporter, t.exporterName); nameMap.set(t.importer, t.importerName); }

    let maxV = 0;
    const matrix: Array<{ exporter: string; exporterName: string; cells: Array<{ importer: string; importerName: string; volume: number }> }> = [];
    for (const exp of exporters) {
      const cells = importers.map(imp => {
        const v = volMap.get(`${exp}|${imp}`) ?? 0;
        if (v > maxV) maxV = v;
        return { importer: imp, importerName: nameMap.get(imp) ?? imp, volume: v };
      });
      matrix.push({ exporter: exp, exporterName: nameMap.get(exp) ?? exp, cells });
    }
    return { exporters, importers, matrix, maxVol: maxV };
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setCatFilter('')} className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors ${!catFilter ? 'bg-accent/10 border-accent text-accent' : 'bg-card border-border text-text-secondary hover:border-accent/40'}`}>All</button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors ${catFilter === c ? 'bg-accent/10 border-accent text-accent' : 'bg-card border-border text-text-secondary hover:border-accent/40'}`}>{CATEGORY_LABELS[c]}</button>
        ))}
      </div>

      <div className="bg-card border border-border rounded p-4">
        <h3 className="text-text-primary font-semibold text-sm mb-1">Bilateral Trade Heatmap</h3>
        <p className="text-text-dim text-xs mb-3">Rows = exporters, columns = importers. Color intensity = total volume across all feedstocks{catFilter ? ` in ${CATEGORY_LABELS[catFilter]}` : ''}.</p>
        <div className="overflow-x-auto">
          <table className="text-xs font-mono">
            <thead>
              <tr>
                <th className="px-2 py-1 text-text-dim text-[10px]"></th>
                {importers.map(imp => {
                  const name = matrix[0]?.cells.find(c => c.importer === imp)?.importerName ?? imp;
                  return <th key={imp} className="px-2 py-1 text-text-dim text-[10px] max-w-[60px] truncate" title={name}>{name}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {matrix.map(row => (
                <tr key={row.exporter}>
                  <td className="px-2 py-1 text-text-dim text-[10px] font-semibold whitespace-nowrap">{row.exporterName}</td>
                  {row.cells.map(cell => {
                    const alpha = cell.volume > 0 ? Math.max(0.1, Math.min(0.8, cell.volume / maxVol)) : 0;
                    return (
                      <td key={cell.importer} className="px-2 py-1 text-center" style={{ background: `rgba(245, 158, 11, ${alpha})` }} title={`${row.exporterName} → ${cell.importerName}: ${fmt(cell.volume)} kt`}>
                        {cell.volume > 0 ? <span className={alpha > 0.4 ? 'text-text-primary font-bold' : 'text-text-secondary'}>{fmt(cell.volume)}</span> : <span className="text-text-dim/30">-</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedstockSupply() {
  const [tab, setTab] = useState<Tab>('Production');

  return (
    <div className="max-w-6xl space-y-5">
      <div className="pb-3 border-b border-border">
        <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Intelligence</p>
        <h1 className="text-text-primary font-semibold text-base">Feedstock Supply & Trade Flows</h1>
        <p className="text-text-dim text-xs mt-1">
          Global production shares, bilateral trade routes, and geopolitical concentration risk for biofuel feedstocks
        </p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-semibold tracking-wide uppercase transition-colors border-b-2 -mb-px whitespace-nowrap ${tab === t ? 'text-accent border-accent' : 'text-text-secondary border-transparent hover:text-text-primary'}`}>{t}</button>
        ))}
      </div>

      <div>
        {tab === 'Production' && <ProductionView />}
        {tab === 'Trade Flows' && <TradeFlowsView />}
        {tab === 'By Country' && <ByCountryView />}
        {tab === 'Risk Summary' && <RiskSummaryView />}
        {tab === 'Trade Matrix' && <TradeMatrixView />}
      </div>
    </div>
  );
}
