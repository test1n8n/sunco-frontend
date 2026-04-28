import { useEffect, useState } from 'react';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DateSource {
  row_count: number;
  first_date: string | null;
  last_date: string | null;
  last_uploaded_at: string | null;
  dates: string[];
}

interface OtherTable {
  row_count: number;
  label: string;
  first_archived_at?: string | null;
  last_archived_at?: string | null;
}

interface DbOverviewPayload {
  generated_at: string;
  upload_sources: {
    biodiesel_trades: DateSource;
    gasoil_pdfs: DateSource;
    product_pdfs: Record<string, DateSource>;
  };
  auto_sources: {
    daily_reports: DateSource;
    price_panels: DateSource;
  };
  other_tables: Record<string, OtherTable>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + (iso.length === 10 ? 'T12:00:00Z' : '')).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: '2-digit',
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

/** Generate Mon–Fri trading days between two ISO dates (inclusive). */
function tradingDaysBetween(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const s = new Date(startIso + 'T12:00:00Z');
  const e = new Date(endIso + 'T12:00:00Z');
  for (const d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay(); // 0=Sun ... 6=Sat
    if (wd >= 1 && wd <= 5) {
      out.push(d.toISOString().slice(0, 10));
    }
  }
  return out;
}

/** Find missing weekdays inside a source's date range. */
function findGaps(src: DateSource): string[] {
  if (!src.first_date || !src.last_date || src.dates.length === 0) return [];
  const have = new Set(src.dates);
  return tradingDaysBetween(src.first_date, src.last_date).filter(d => !have.has(d));
}

const PRODUCT_PDF_NAMES: Record<string, string> = {
  BFZ: 'FAME0', UCR: 'UCOME', BRI: 'RME', HVO: 'HVO', ZAF: 'SAF',
};

const PRODUCT_PDF_COLORS: Record<string, string> = {
  BFZ: '#10b981', UCR: '#ef4444', BRI: '#f59e0b', HVO: '#8b5cf6', ZAF: '#06b6d4',
};

// ─── UI atoms ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded p-4 flex flex-col gap-1">
      <span className="text-text-dim text-xs uppercase tracking-widest">{label}</span>
      <span className="text-text-primary text-2xl font-bold font-mono">{value}</span>
      {sub && <span className="text-text-dim text-xs">{sub}</span>}
    </div>
  );
}

function DateChip({ date, color }: { date: string; color?: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-mono text-text-primary border"
      style={{ backgroundColor: color ? `${color}1a` : undefined, borderColor: color ?? 'var(--color-border, #2a2a3a)' }}
    >
      {fmtDate(date)}
    </span>
  );
}

function DateSourceBlock({
  title, accent, source,
}: {
  title: string;
  accent?: string;
  source: DateSource;
}) {
  const gaps = findGaps(source);
  return (
    <div className="bg-card border border-border rounded p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-text-primary font-semibold text-sm uppercase tracking-widest" style={{ color: accent }}>
          {title}
        </h3>
        <span className="text-text-dim text-xs">
          {source.row_count.toLocaleString()} row{source.row_count === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-text-dim uppercase tracking-widest">First date</div>
          <div className="text-text-primary font-mono">{fmtDate(source.first_date)}</div>
        </div>
        <div>
          <div className="text-text-dim uppercase tracking-widest">Last date</div>
          <div className="text-text-primary font-mono">{fmtDate(source.last_date)}</div>
        </div>
        <div>
          <div className="text-text-dim uppercase tracking-widest">Last upload</div>
          <div className="text-text-primary font-mono">{fmtDateTime(source.last_uploaded_at)}</div>
        </div>
      </div>
      {source.dates.length > 0 && (
        <div className="space-y-2">
          <div className="text-text-dim text-xs uppercase tracking-widest">Dates with data ({source.dates.length})</div>
          <div className="flex flex-wrap gap-1">
            {source.dates.map(d => <DateChip key={d} date={d} color={accent} />)}
          </div>
        </div>
      )}
      {gaps.length > 0 && (
        <div className="space-y-2">
          <div className="text-negative text-xs uppercase tracking-widest font-semibold">
            Weekday gaps in range ({gaps.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {gaps.map(d => (
              <span key={d} className="inline-block px-2 py-0.5 rounded text-[10px] font-mono text-negative bg-negative/10 border border-negative/30">
                {fmtDate(d)}
              </span>
            ))}
          </div>
        </div>
      )}
      {source.row_count === 0 && (
        <div className="text-text-dim text-xs italic">No data yet.</div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function DbOverview() {
  const [data, setData] = useState<DbOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/db-overview`, {
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setData(await res.json() as DbOverviewPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(); }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b border-border">
        <div>
          <p className="text-text-dim text-xs tracking-widest uppercase mb-1">System</p>
          <h1 className="text-text-primary font-bold text-3xl mb-1">Database Overview</h1>
          <p className="text-text-dim text-xs">
            What's stored in the platform's PostgreSQL database — by source, with date coverage and gap detection.
          </p>
          {data && (
            <p className="text-text-dim text-xs mt-1">Snapshot taken {fmtDateTime(data.generated_at)}</p>
          )}
        </div>
        <button
          onClick={() => void fetchData()}
          disabled={loading}
          className="bg-card border border-border text-text-secondary px-4 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 transition-colors uppercase tracking-widest disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      )}

      {error && !loading && (
        <div className="bg-negative/10 border border-negative/30 rounded px-4 py-3 text-sm text-negative">
          Failed to load DB overview: {error}
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="Trade days stored"
              value={data.upload_sources.biodiesel_trades.row_count.toLocaleString()}
              sub="Biodiesel trade Excels uploaded"
            />
            <SummaryCard
              label="Gasoil PDFs"
              value={data.upload_sources.gasoil_pdfs.row_count.toLocaleString()}
              sub="ICE LS Gasoil settlement PDFs"
            />
            <SummaryCard
              label="Product PDFs"
              value={Object.values(data.upload_sources.product_pdfs).reduce((s, p) => s + p.row_count, 0).toLocaleString()}
              sub={`Across ${Object.keys(data.upload_sources.product_pdfs).length} product${Object.keys(data.upload_sources.product_pdfs).length === 1 ? '' : 's'}`}
            />
            <SummaryCard
              label="Daily reports"
              value={data.auto_sources.daily_reports.row_count.toLocaleString()}
              sub="AI-generated reports stored"
            />
          </div>

          {/* Manual upload sources */}
          <section className="space-y-4">
            <h2 className="text-text-primary font-bold text-base uppercase tracking-widest">
              Upload Sources <span className="text-text-dim font-normal text-xs normal-case ml-2">(populated by drag-and-drop)</span>
            </h2>
            <DateSourceBlock title="Biodiesel Trades (Excel)" source={data.upload_sources.biodiesel_trades} accent="#6366f1" />
            <DateSourceBlock title="LS Gasoil PDFs" source={data.upload_sources.gasoil_pdfs} accent="#6366f1" />

            <div className="space-y-3">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest">
                Per-product ICE PDFs ({Object.keys(data.upload_sources.product_pdfs).length})
              </h3>
              {Object.entries(data.upload_sources.product_pdfs).length === 0 ? (
                <div className="bg-card border border-border rounded p-5 text-text-dim text-xs italic">
                  No product PDFs uploaded yet.
                </div>
              ) : (
                Object.entries(data.upload_sources.product_pdfs)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([code, src]) => {
                    const name = PRODUCT_PDF_NAMES[code] ?? code;
                    const color = PRODUCT_PDF_COLORS[code] ?? '#888';
                    return (
                      <DateSourceBlock
                        key={code}
                        title={`${name} PDF (${code})`}
                        accent={color}
                        source={src}
                      />
                    );
                  })
              )}
            </div>
          </section>

          {/* Auto-generated sources */}
          <section className="space-y-4">
            <h2 className="text-text-primary font-bold text-base uppercase tracking-widest">
              Auto-Generated Sources <span className="text-text-dim font-normal text-xs normal-case ml-2">(populated by daily pipeline)</span>
            </h2>
            <DateSourceBlock title="Daily Reports (AI)" source={data.auto_sources.daily_reports} accent="#10b981" />
            <DateSourceBlock title="Price Panels" source={data.auto_sources.price_panels} accent="#10b981" />
          </section>

          {/* Other tables */}
          <section className="space-y-3">
            <h2 className="text-text-primary font-bold text-base uppercase tracking-widest">
              Other Tables <span className="text-text-dim font-normal text-xs normal-case ml-2">(non-date-keyed data)</span>
            </h2>
            <div className="bg-card border border-border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-dim text-xs uppercase tracking-widest border-b border-border">
                    <th className="text-left py-2 px-4">Table</th>
                    <th className="text-left py-2 px-4">Description</th>
                    <th className="text-right py-2 px-4">Rows</th>
                    <th className="text-right py-2 px-4">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.other_tables)
                    .sort(([, a], [, b]) => b.row_count - a.row_count)
                    .map(([key, t]) => (
                      <tr key={key} className="border-b border-border/50 hover:bg-surface/40">
                        <td className="py-2 px-4 text-text-primary font-mono text-xs">{key}</td>
                        <td className="py-2 px-4 text-text-secondary">{t.label}</td>
                        <td className="text-right py-2 px-4 font-mono font-semibold text-text-primary">
                          {t.row_count.toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-4 font-mono text-text-dim text-xs">
                          {t.last_archived_at ? fmtDateTime(t.last_archived_at) : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer note */}
          <div className="bg-card border border-border rounded p-4 text-text-dim text-xs space-y-1">
            <p>
              <span className="text-text-secondary font-semibold">Note —</span> the original Excel and PDF binary files are NOT stored. Only their parsed contents are persisted. Re-uploading for the same date overwrites the previous row (no version history).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
