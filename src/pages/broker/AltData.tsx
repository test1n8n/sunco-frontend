import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';

// ─── Types ────────────────────────────────────────────────────────────────

interface SeriesMeta {
  id: number;
  series_code: string;
  name: string;
  category: string;
  source: string;
  unit: string;
  description: string;
  first_date: string | null;
  last_date: string | null;
  n_observations: number;
  updated_at: string | null;
}

interface SeriesListResponse {
  count: number;
  series: SeriesMeta[];
}

interface SeriesData {
  series_code: string;
  name: string;
  category: string;
  source: string;
  unit: string;
  description: string;
  n: number;
  values: Array<{ date: string; value: number }>;
}

interface UploadResult {
  filename: string;
  series_detected: number;
  results: Array<{
    series_code: string;
    label: string;
    inserted: number;
    updated: number;
    total_observations: number;
    first_date?: string | null;
    last_date?: string | null;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function apiGet<T>(path: string): Promise<T> {
  return fetch(`${API_BASE_URL}${path}`, { headers: { 'X-API-Key': API_KEY } }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  });
}

function categoryBadge(cat: string): string {
  const map: Record<string, string> = {
    freight:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    carbon:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rins:      'bg-violet-500/10 text-violet-400 border-violet-500/20',
    grains:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
    crush:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
    physical:  'bg-rose-500/10 text-rose-400 border-rose-500/20',
    weather:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    ice:       'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    other:     'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };
  return map[cat] ?? map.other;
}

// ─── Upload Zone ──────────────────────────────────────────────────────────

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source', 'cmdtyview');
      const res = await fetch(`${API_BASE_URL}/alt-data/upload`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as UploadResult;
      setLastResult(json);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void upload(file);
  }, [upload]);

  return (
    <div className="bg-card border border-border rounded p-4 space-y-3">
      <div>
        <h3 className="text-text-primary font-semibold text-sm">Import CmdtyView Export</h3>
        <p className="text-text-dim text-xs mt-0.5">
          Drag and drop an .xlsx file (Baltic freight, RINs, carbon, crush margins, physical prices — any CmdtyView series)
        </p>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-accent/40 hover:bg-surface/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xlsm"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          className="hidden"
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <Spinner />
            <span className="text-text-secondary text-xs">Parsing…</span>
          </div>
        ) : (
          <>
            <div className="text-text-secondary text-sm mb-1">↓ Drop .xlsx here or click to browse</div>
            <div className="text-text-dim text-[11px]">Parser auto-detects date + value columns</div>
          </>
        )}
      </div>

      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded p-3 text-negative text-xs">
          {error}
        </div>
      )}

      {lastResult && (
        <div className="bg-positive/5 border border-positive/20 rounded p-3">
          <div className="text-positive text-xs font-semibold mb-2">
            ✓ Imported {lastResult.series_detected} series from {lastResult.filename}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {lastResult.results.map((r) => (
              <div key={r.series_code} className="text-[11px] text-text-secondary font-mono flex items-center justify-between gap-2">
                <span className="truncate">{r.label}</span>
                <span className="text-text-dim shrink-0">
                  +{r.inserted} new · {r.updated} upd · total {r.total_observations}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Series Chart Viewer ──────────────────────────────────────────────────

function SeriesChart({ seriesCode }: { seriesCode: string }) {
  const [data, setData] = useState<SeriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(365);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await apiGet<SeriesData>(`/alt-data/series/${seriesCode}?days=${days}`);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load series');
      } finally {
        setLoading(false);
      }
    })();
  }, [seriesCode, days]);

  return (
    <div className="bg-card border border-border rounded p-4">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <h3 className="text-text-primary font-semibold text-sm truncate">
            {data?.name ?? seriesCode}
          </h3>
          <p className="text-text-dim text-xs mt-0.5">
            {data?.category} · {data?.unit} · {data?.n ?? 0} observations · source: {data?.source ?? '—'}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {[90, 180, 365, 730, 1825].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                days === d
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-card border-border text-text-secondary hover:border-accent/40'
              }`}
            >
              {d >= 365 ? `${Math.round(d/365)}y` : `${d}d`}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : error ? (
        <div className="bg-negative/10 border border-negative/30 rounded p-3 text-negative text-xs">{error}</div>
      ) : !data || data.values.length === 0 ? (
        <div className="text-text-dim text-xs text-center py-12">No data points in this window.</div>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={data.values} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtDateShort} interval="preserveStartEnd" minTickGap={40} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }} labelFormatter={(d) => fmtDateShort(d as string)} />
              <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function AltData() {
  const [list, setList] = useState<SeriesMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await apiGet<SeriesListResponse>('/alt-data/series');
      setList(json.series);
      if (!selectedCode && json.series.length > 0) {
        setSelectedCode(json.series[0].series_code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load series list');
    } finally {
      setLoading(false);
    }
  }, [selectedCode]);

  useEffect(() => { void load(); }, [load]);

  const refreshFree = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_BASE_URL}/alt-data/refresh-free?days=365`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
      });
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set(list.map((s) => s.category));
    return Array.from(set).sort();
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return list.filter((s) => {
      if (categoryFilter && s.category !== categoryFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.series_code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, categoryFilter, search]);

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Market Data</p>
        <h1 className="text-text-primary font-semibold text-base">Alternative Data</h1>
        <p className="text-text-dim text-xs mt-1">
          Time-series archive for freight, carbon, RINs, crush margins, weather, and physical prices
        </p>
      </div>

      {/* Upload zone */}
      <UploadZone onUploaded={load} />

      {/* Series list + filters */}
      <div className="bg-card border border-border rounded p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search series…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/50"
          />
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors ${
                !categoryFilter
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-card border-border text-text-secondary hover:border-accent/40'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c === categoryFilter ? '' : c)}
                className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors ${
                  categoryFilter === c
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'bg-card border-border text-text-secondary hover:border-accent/40'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            onClick={refreshFree}
            disabled={refreshing}
            className="ml-auto px-3 py-1.5 rounded text-xs font-semibold border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 transition-colors"
          >
            {refreshing ? 'Pulling…' : '↻ Refresh free sources'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8"><Spinner /></div>
        ) : error ? (
          <div className="bg-negative/10 border border-negative/30 rounded p-3 text-negative text-xs">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-text-dim text-xs text-center py-8">
            {list.length === 0
              ? 'No series stored yet. Upload a CmdtyView export above, or pull free weather data.'
              : 'No series match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Series</th>
                  <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Code</th>
                  <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Category</th>
                  <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Obs</th>
                  <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">First</th>
                  <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Last</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.series_code}
                    onClick={() => setSelectedCode(s.series_code)}
                    className={`border-b border-border/50 cursor-pointer hover:bg-surface/40 ${
                      selectedCode === s.series_code ? 'bg-accent/5' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-text-primary font-semibold">{s.name}</td>
                    <td className="px-3 py-2 text-text-dim font-mono text-[10px] hidden md:table-cell">{s.series_code}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${categoryBadge(s.category)}`}>
                        {s.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary">{s.n_observations}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-dim hidden lg:table-cell">{fmtDate(s.first_date)}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary">{fmtDate(s.last_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chart of selected series */}
      {selectedCode && <SeriesChart seriesCode={selectedCode} />}
    </div>
  );
}
