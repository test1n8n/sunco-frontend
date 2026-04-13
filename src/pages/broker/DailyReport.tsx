import { useState, useEffect } from 'react';
import type { Report, NewsItem, MacroSignal, Outlook, SupplyDemandOutlook, KeyDate, PricePanel } from '../../types';
import { MOCK_REPORT } from '../../mockData';
import { API_BASE_URL, API_KEY } from '../../config';
import BiasBadge from '../../components/BiasBadge';
import Spinner from '../../components/Spinner';
import ErrorBanner from '../../components/ErrorBanner';
import { useToast, ToastContainer } from '../../components/Toast';
import GasoilReportPanel from '../../components/GasoilReportPanel';
import ProductReportPanel from '../../components/ProductReportPanel';
import BiodieselTradesPanel from '../../components/BiodieselTradesPanel';
import { BIODIESEL_PRODUCTS } from '../../productConfig';

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function DirectionIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up') return <span className="text-positive font-bold">▲</span>;
  if (direction === 'down') return <span className="text-negative font-bold">▼</span>;
  return <span className="text-text-dim font-bold">—</span>;
}

function RelevanceBadge({ relevance }: { relevance: 'high' | 'medium' | 'low' }) {
  const styles: Record<string, string> = {
    high: 'bg-positive/10 text-positive border border-positive/20',
    medium: 'bg-accent/10 text-accent border border-accent/20',
    low: 'bg-border/50 text-text-dim border border-border',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${styles[relevance]}`}>
      {relevance}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: 'high' | 'moderate' | 'low' }) {
  if (!confidence) return null;
  const styles: Record<string, string> = {
    high:     'bg-positive/10 text-positive border border-positive/20',
    moderate: 'bg-accent/10 text-accent border border-accent/20',
    low:      'bg-negative/10 text-negative border border-negative/20',
  };
  const label: Record<string, string> = {
    high: '● HIGH DATA',
    moderate: '● MODERATE DATA',
    low: '● THIN DATA',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${styles[confidence]}`}>
      {label[confidence]}
    </span>
  );
}

function SignalPill({ label, value, colorMap }: {
  label: string;
  value: string;
  colorMap: Record<string, string>;
}) {
  const color = colorMap[value] ?? 'bg-border/50 text-text-dim border border-border';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-dim uppercase tracking-widest w-20">{label}</span>
      <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide border ${color}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Flat Prices Card (read-only) ────────────────────────────────────────────

const DIFF_PRODUCTS_RO = ['FAME0', 'UCOME', 'RME', 'HVO'] as const;

function FlatPricesCard({ panel }: { panel: PricePanel | null }) {
  if (!panel) return null;
  const flatPrices = panel.flat_prices ?? {};
  const bio_diffs  = panel.bio_diffs  ?? {};
  const lsGoM1     = panel.ls_go_curve?.[0]?.settlement ?? null;
  const hasFlatPrices = DIFF_PRODUCTS_RO.some(p => flatPrices[p] != null);
  if (!hasFlatPrices && !lsGoM1) return null;

  return (
    <div className="bg-card border border-border rounded overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-surface flex items-center justify-between">
        <div>
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest">Biodiesel Flat Prices</h2>
          <p className="text-text-dim text-xs mt-0.5">
            {lsGoM1 != null ? `LS GO M1: ${lsGoM1.toFixed(2)} USD/MT` : 'LS GO M1 + Diff · USD/MT'}
          </p>
        </div>
        {panel.diffs_updated_at && (
          <span className="text-text-dim text-xs">
            Updated {new Date(panel.diffs_updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
          </span>
        )}
      </div>
      {hasFlatPrices ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-surface/50">
              <th className="text-left px-4 py-2 text-text-dim font-semibold text-xs uppercase tracking-widest">Product</th>
              <th className="text-right px-4 py-2 text-text-dim font-semibold text-xs uppercase tracking-widest">Diff vs GO</th>
              <th className="text-right px-4 py-2 text-text-dim font-semibold text-xs uppercase tracking-widest">Flat Price</th>
            </tr>
          </thead>
          <tbody>
            {DIFF_PRODUCTS_RO.filter(p => flatPrices[p] != null).map((p, idx) => {
              const diff = bio_diffs[p] as number | null;
              const flat = flatPrices[p] as number;
              return (
                <tr key={p} className={`border-b border-border/40 ${idx % 2 === 0 ? 'bg-card' : 'bg-surface/40'}`}>
                  <td className="px-4 py-3 font-bold text-text-primary text-sm">{p}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-sm">
                    <span className={diff != null && diff > 0 ? 'text-positive' : diff != null && diff < 0 ? 'text-negative' : 'text-text-dim'}>
                      {diff != null ? (diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-text-primary">{flat.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="px-4 py-4 text-text-dim text-xs italic">
          Go to <span className="font-semibold text-accent">Products Data</span> to enter settlements and calculate flat prices.
        </p>
      )}
    </div>
  );
}

// (WhatToWatchCard removed — replaced by Upcoming Events section)

// ─── News Card ───────────────────────────────────────────────────────────────

export function NewsCard({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  return (
    <div className={`bg-card border rounded transition-colors hover:border-border/80 ${
      item.relevance === 'high'
        ? 'border-accent/40 border-l-2 border-l-accent'
        : 'border-border'
    } ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className={`font-semibold text-text-primary leading-snug flex-1 ${compact ? 'text-xs' : 'text-sm'}`}>
          {item.relevance === 'high' && (
            <span className="text-accent mr-1.5 text-xs">★</span>
          )}
          {item.headline}
        </h4>
        <RelevanceBadge relevance={item.relevance} />
      </div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs text-text-dim bg-surface px-2 py-0.5 rounded border border-border">{item.source}</span>
        {item.published_date && (
          <span className="text-xs text-text-dim">{item.published_date}</span>
        )}
      </div>
      <p className={`text-text-secondary italic mb-3 ${compact ? 'text-xs' : 'text-sm'}`}>{item.price_impact ?? item.context ?? ''}</p>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent text-xs font-semibold hover:underline tracking-wide uppercase"
      >
        Read more →
      </a>
    </div>
  );
}

// ─── News Section (titled subsection) ────────────────────────────────────────

// (NewsSection + SECTION_META removed — replaced by News by Region rendering)

// ─── Macro Signals Table ──────────────────────────────────────────────────────

export function MacroSignalsTable({ signals }: { signals: MacroSignal[] }) {
  return (
    <div className="bg-card border border-border rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border">
            <th className="text-left px-4 py-3 text-text-dim font-semibold text-xs uppercase tracking-widest">Signal</th>
            <th className="text-center px-4 py-3 text-text-dim font-semibold text-xs uppercase tracking-widest">Dir.</th>
            <th className="text-right px-4 py-3 text-text-dim font-semibold text-xs uppercase tracking-widest">Chg %</th>
            <th className="text-left px-4 py-3 text-text-dim font-semibold text-xs uppercase tracking-widest hidden sm:table-cell">Implication</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal, idx) => (
            <tr key={signal.name} className={`border-b border-border/50 ${idx % 2 === 0 ? 'bg-card' : 'bg-surface/50'}`}>
              <td className="px-4 py-3 font-medium text-text-primary">{signal.name}</td>
              <td className="px-4 py-3 text-center">
                <DirectionIcon direction={signal.direction} />
              </td>
              <td className={`px-4 py-3 text-right font-mono font-semibold text-sm ${signal.change_pct > 0 ? 'text-positive' : signal.change_pct < 0 ? 'text-negative' : 'text-text-dim'}`}>
                {signal.change_pct > 0 ? '+' : ''}{signal.change_pct.toFixed(1)}%
              </td>
              <td className="px-4 py-3 text-text-secondary text-sm hidden sm:table-cell">{signal.biofuels_implication ?? signal.factual_note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Outlook Card ─────────────────────────────────────────────────────────────

export function OutlookCard({ outlook }: { outlook: Outlook }) {
  const bulletItems = outlook.key_risks ?? outlook.key_themes ?? outlook.key_events ?? outlook.key_facts ?? [];
  return (
    <div className="bg-card border border-border rounded border-l-2 border-l-accent p-5">
      <p className="text-xs text-text-dim font-semibold uppercase tracking-widest mb-2">{outlook.horizon}</p>
      <p className="text-text-primary text-sm leading-relaxed mb-3">{outlook.summary}</p>
      {bulletItems.length > 0 && (
        <ul className="space-y-1.5 mb-4">
          {bulletItems.map((item, idx) => (
            <li key={idx} className="text-sm text-text-secondary flex items-start gap-2">
              <span className="text-accent mt-0.5 text-xs">›</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {outlook.bias && <BiasBadge bias={outlook.bias} />}
    </div>
  );
}

// ─── Supply & Demand Outlook ──────────────────────────────────────────────────

const SUPPLY_COLORS: Record<string, string> = {
  tight:   'bg-negative/10 text-negative border-negative/20',
  ample:   'bg-positive/10 text-positive border-positive/20',
  neutral: 'bg-border/50 text-text-dim border-border',
};
const DEMAND_COLORS: Record<string, string> = {
  strong:  'bg-positive/10 text-positive border-positive/20',
  weak:    'bg-negative/10 text-negative border-negative/20',
  neutral: 'bg-border/50 text-text-dim border-border',
};

function SupplyDemandCard({ outlook }: { outlook: SupplyDemandOutlook }) {
  if (!outlook.summary) return null;
  return (
    <div className="bg-card border border-border rounded p-5">
      <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Supply / Demand Outlook</h2>
      <div className="flex flex-wrap gap-3 mb-4">
        <SignalPill label="Supply" value={outlook.supply_signal ?? outlook.supply_data ?? ''} colorMap={SUPPLY_COLORS} />
        <SignalPill label="Demand" value={outlook.demand_signal ?? outlook.demand_data ?? ''} colorMap={DEMAND_COLORS} />
      </div>
      <p className="text-text-primary text-sm leading-relaxed mb-3">{outlook.summary}</p>
      {(outlook.key_drivers ?? outlook.key_data_points ?? []).length > 0 && (
        <ul className="space-y-1.5">
          {(outlook.key_drivers ?? outlook.key_data_points ?? []).map((d: string, idx: number) => (
            <li key={idx} className="text-sm text-text-secondary flex items-start gap-2">
              <span className="text-accent mt-0.5 text-xs shrink-0">›</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Upcoming Key Dates ───────────────────────────────────────────────────────

function KeyDatesCard({ dates }: { dates: KeyDate[] }) {
  if (!dates || dates.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded p-5">
      <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">
        📅 Upcoming Key Dates
      </h2>
      <div className="space-y-3">
        {dates.map((d, idx) => (
          <div key={idx} className="flex items-start gap-3 pb-3 border-b border-border/40 last:border-0 last:pb-0">
            <span className="text-xs font-mono font-semibold text-accent bg-accent/10 border border-accent/20 px-2 py-1 rounded shrink-0 mt-0.5">
              {d.date}
            </span>
            <div>
              <p className="text-text-primary text-sm font-medium">{d.event}</p>
              <p className="text-text-dim text-xs mt-0.5 italic">{d.relevance}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Refresh step labels ──────────────────────────────────────────────────────

const REFRESH_STEPS = [
  { after: 0,  label: 'Fetching news & macro data…' },
  { after: 15, label: 'Classifying articles with AI…' },
  { after: 35, label: 'Generating report…' },
  { after: 70, label: 'Finalising & saving…' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DailyReport({ role = 'broker' }: { role?: 'broker' | 'client' }) {
  const isBroker = role === 'broker';
  const [report, setReport] = useState<Report | null>(null);
  const [panel, setPanel] = useState<PricePanel | null>(null);
  const [loading, setLoading] = useState(true);
  const [usedMock, setUsedMock] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [brokerNotes, setBrokerNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [sendingToClients, setSendingToClients] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStep, setRefreshStep] = useState('');
  const { toasts, showToast, dismissToast } = useToast();

  const fetchLatestReport = async (): Promise<Report | null> => {
    const res = await fetch(`${API_BASE_URL}/report/latest`, {
      headers: { 'X-API-Key': API_KEY },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Report;
  };

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      try {
        const data = await fetchLatestReport();
        if (data === null) {
          setNotFound(true);
        } else {
          setReport(data);
          setBrokerNotes(data.broker_notes ?? '');
          // Fetch price panel in parallel (non-blocking — failures are silent)
          fetch(`${API_BASE_URL}/price-panel/latest`, {
            headers: { 'X-API-Key': API_KEY },
          })
            .then(r => r.ok ? r.json() : null)
            .then((p: PricePanel | null) => { if (p) setPanel(p); })
            .catch(() => {});
        }
      } catch {
        setReport(MOCK_REPORT);
        setBrokerNotes(MOCK_REPORT.broker_notes ?? '');
        setUsedMock(true);
      } finally {
        setLoading(false);
      }
    };
    void loadReport();
  }, []);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshStep(REFRESH_STEPS[0].label);
    const previousGeneratedAt = report?.generated_at ?? null;
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    REFRESH_STEPS.slice(1).forEach(({ after, label }) => {
      stepTimers.push(setTimeout(() => setRefreshStep(label), after * 1000));
    });
    try {
      const res = await fetch(`${API_BASE_URL}/run-now`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const POLL_INTERVAL = 6000;
      const MAX_POLLS = 25;
      let polls = 0;
      await new Promise<void>((resolve, reject) => {
        const poll = setInterval(async () => {
          polls++;
          try {
            const latest = await fetchLatestReport();
            const newGeneratedAt = latest?.generated_at ?? null;
            const updated = newGeneratedAt !== null && newGeneratedAt !== previousGeneratedAt;
            if (updated || polls >= MAX_POLLS) {
              clearInterval(poll);
              if (latest) {
                setReport(latest);
                setBrokerNotes(latest.broker_notes ?? '');
                setNotFound(false);
                setUsedMock(false);
              }
              resolve();
            }
          } catch (err) {
            clearInterval(poll);
            reject(err);
          }
        }, POLL_INTERVAL);
      });
      showToast('success', 'Report refreshed successfully.');
    } catch {
      showToast('error', 'Refresh failed — please try again.');
    } finally {
      stepTimers.forEach(clearTimeout);
      setRefreshing(false);
      setRefreshStep('');
    }
  };

  const handleSaveNotes = async () => {
    if (!report) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`${API_BASE_URL}/report/${report.report_date}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ broker_notes: brokerNotes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('success', 'Notes saved.');
    } catch {
      showToast('error', 'Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSendToClients = async () => {
    setSendingToClients(true);
    try {
      const res = await fetch(`${API_BASE_URL}/run-now`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('success', 'Report sent to clients.');
    } catch {
      showToast('error', 'Failed to send to clients.');
    } finally {
      setSendingToClients(false);
    }
  };

  if (loading) return <Spinner />;

  if (notFound) {
    return (
      <div className="text-center py-24 text-text-secondary">
        <ToastContainer toasts={toasts} dismissToast={dismissToast} />
        <p className="text-lg font-semibold text-text-primary mb-2 tracking-wide">Report Pending</p>
        <p className="text-sm mb-6">Today's report is being generated. Check back shortly.</p>
        {isBroker && (
          <button
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="bg-accent text-surface px-5 py-2.5 rounded text-xs font-bold hover:bg-accent-hover transition-colors disabled:opacity-60 flex items-center gap-2 uppercase tracking-widest mx-auto"
          >
            {refreshing ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                {refreshStep || 'Running…'}
              </>
            ) : (
              '↻ Generate Report Now'
            )}
          </button>
        )}
      </div>
    );
  }

  if (!report) return null;

  // ── News data (new 4-section architecture — no old format fallback) ──────
  const marketMoving = report.market_moving ?? [];
  const newsByRegion = report.news_by_region ?? {};
  const upcomingEvents = report.upcoming_events ?? [];
  const hasAnyRegionalNews = Object.values(newsByRegion).some((items: unknown) => Array.isArray(items) && items.length > 0);

  const hasSDOutlook =
    report.supply_demand_outlook != null &&
    report.supply_demand_outlook.summary != null;

  return (
    <div className="space-y-5 max-w-4xl">
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />

      {usedMock && <ErrorBanner />}

      {/* Thin data warning */}
      {report.data_confidence === 'low' && (
        <div className="bg-negative/10 border border-negative/30 rounded px-4 py-3 text-sm text-negative flex items-start gap-2">
          <span className="shrink-0 font-bold">⚠</span>
          <span>
            <span className="font-semibold">Limited market data today</span> — fewer than 4 relevant news
            items were classified. This report is primarily driven by macro signals.
            Treat directional analysis with extra caution.
          </span>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b border-border">
        <div>
          <p className="text-text-dim text-xs tracking-widest uppercase mb-1">{formatDate(report.report_date)}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {report.short_term_outlook?.bias && <BiasBadge bias={report.short_term_outlook.bias} />}
            <span className="text-xs text-text-dim uppercase tracking-widest">Short-term bias</span>
            {report.data_confidence && (
              <>
                <span className="text-text-dim text-xs">·</span>
                <ConfidenceBadge confidence={report.data_confidence} />
              </>
            )}
          </div>
          {report.generated_at && (
            <p className="text-text-dim text-xs mt-1.5">
              Generated {new Date(report.generated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isBroker && (
            <button
              onClick={() => void handleRefresh()}
              disabled={refreshing || sendingToClients}
              title={refreshing ? refreshStep : 'Re-run the pipeline: fetch latest news, reclassify and regenerate the report'}
              className="bg-card border border-border text-text-secondary px-4 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest min-w-[140px] justify-center"
            >
              {refreshing ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
                  <span className="hidden sm:inline">{refreshStep || 'Running…'}</span>
                  <span className="sm:hidden">Running…</span>
                </>
              ) : (
                '↻ Regenerate'
              )}
            </button>
          )}
          {isBroker && (
            <button
              onClick={handleSendToClients}
              disabled={sendingToClients || refreshing}
              className="bg-accent text-surface px-4 py-2 rounded text-xs font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
            >
              {sendingToClients ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                'Send to Clients'
              )}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="bg-card border border-border text-text-secondary px-4 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 transition-colors uppercase tracking-widest"
          >
            Download PDF
          </button>
          <button
            onClick={() => {
              document.body.classList.add('short-pdf');
              requestAnimationFrame(() => {
                window.print();
                // Remove class after print dialog closes
                const cleanup = () => { document.body.classList.remove('short-pdf'); window.removeEventListener('afterprint', cleanup); };
                window.addEventListener('afterprint', cleanup);
                // Fallback: remove after 5s in case afterprint doesn't fire
                setTimeout(() => document.body.classList.remove('short-pdf'), 5000);
              });
            }}
            className="bg-card border border-border text-text-secondary px-4 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 transition-colors uppercase tracking-widest"
          >
            Download Short PDF
          </button>
        </div>
      </div>

      {/* ── Biodiesel Flat Prices (read-only — enter in Products Data tab) ── */}
      <FlatPricesCard panel={panel} />

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — HEADLINE SUMMARY
          3-4 factual sentences. The 10-second scan.
          ═══════════════════════════════════════════════════════════════════ */}
      {report.headline_summary && (
        <div className="bg-surface/60 border-l-4 border-accent rounded p-5">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-2">Headlines</h2>
          <p className="text-text-primary text-sm leading-relaxed font-medium">{report.headline_summary}</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MARKET SUMMARY (Opus Call 1 output)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border border-l-2 border-l-accent rounded p-5">
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Market Summary</h2>
        <p className="text-text-primary text-sm leading-relaxed">{report.market_summary}</p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — MARKET-MOVING (high-relevance articles)
          Built by code from Haiku classification. Colored event-type cards.
          ═══════════════════════════════════════════════════════════════════ */}
      {marketMoving.length > 0 && (
        <div className="space-y-3" data-section="market-moving">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest">Market-Moving</h2>
          {marketMoving.map((item, idx) => {
            const evtColors: Record<string, string> = {
              MANDATE_CHANGE: 'border-l-orange-500', SUPPLY_SHOCK: 'border-l-red-500',
              CERTIFICATION_EVENT: 'border-l-violet-500', TRADE_MEASURE: 'border-l-blue-500',
              FEEDSTOCK_PRICE: 'border-l-emerald-500', CAPACITY_CHANGE: 'border-l-cyan-500',
            };
            const borderClass = evtColors[item.event_type] ?? 'border-l-accent';
            return (
              <div key={idx} className={`bg-card border border-border ${borderClass} border-l-4 rounded p-4`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-surface/50 text-text-dim border border-border">
                    {(item.event_type || '').replace(/_/g, ' ')}
                  </span>
                  <span className="text-text-dim text-[10px] shrink-0">{item.source}{item.published_date ? ` · ${item.published_date}` : ''}</span>
                </div>
                <h3 className="text-text-primary font-semibold text-sm mb-1">{item.headline}</h3>
                {item.context && <p className="text-text-secondary text-xs leading-relaxed mb-2">{item.context}</p>}
                {item.affected_products?.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {item.affected_products.map((p: string) => (
                      <span key={p} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface/50 text-text-dim border border-border">{p}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — NEWS BY REGION
          Built by code from Haiku classification. Grouped into 5 buckets.
          ═══════════════════════════════════════════════════════════════════ */}
      {hasAnyRegionalNews && (
        <div className="space-y-4" data-section="news">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest">News by Region</h2>
          {([
            { key: 'eu_regulation', label: 'EU Regulation & Mandates' },
            { key: 'feedstock_supply', label: 'Feedstock Supply' },
            { key: 'asia_pacific', label: 'Asia-Pacific' },
            { key: 'americas', label: 'Americas' },
            { key: 'macro_energy', label: 'Macro & Energy' },
          ] as const).map(({ key, label }) => {
            const items = (newsByRegion[key] ?? []) as Array<{ headline: string; source: string; url: string; event_type: string; score: number; context: string }>;
            if (items.length === 0) return null;
            return (
              <div key={key} className="bg-card border border-border rounded overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-surface/30">
                  <h3 className="text-text-dim font-semibold text-[10px] uppercase tracking-widest">{label}</h3>
                </div>
                <div className="divide-y divide-border/50">
                  {items.map((item, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-surface/20">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-text-primary text-sm font-medium">{item.headline}</h4>
                          {item.context && <p className="text-text-secondary text-xs mt-0.5">{item.context}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[9px] text-text-dim px-1.5 py-0.5 rounded border border-border whitespace-nowrap">{(item.event_type || '').replace(/_/g, ' ')}</span>
                          <span className="text-text-dim text-[10px] whitespace-nowrap">{item.source}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SAF note */}
      {report.saf_note && (
        <p className="text-text-dim text-xs italic border-l-2 border-border pl-3">
          <span className="font-semibold text-text-dim uppercase tracking-wide text-xs">SAF pricing note:</span>{' '}
          {report.saf_note}
        </p>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4 — UPCOMING EVENTS
          Date + event calendar. No commentary.
          ═══════════════════════════════════════════════════════════════════ */}
      {upcomingEvents.length > 0 && (
        <div className="bg-card border border-border rounded p-4" data-section="upcoming-events">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Upcoming Events</h2>
          <div className="divide-y divide-border/50">
            {upcomingEvents.map((ev, idx) => (
              <div key={idx} className="py-2 flex items-baseline gap-3">
                <span className="text-accent font-mono font-bold text-xs shrink-0 min-w-[90px]">{ev.date}</span>
                <span className="text-text-primary text-sm">{ev.event}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LS Gasoil Charts (read-only — data from Products Data tab) ───── */}
      <GasoilReportPanel readOnly reportDate={report.report_date} />

      {/* ── Biodiesel Product Charts (read-only — data from Products Data tab) ── */}
      {BIODIESEL_PRODUCTS.map((product) => (
        <ProductReportPanel
          key={product.code}
          productCode={product.code}
          productName={`ICE ${product.name} (${product.code})`}
          accentColor={product.color}
          dropZoneLabel={product.dropZoneLabel}
          isDiff={product.isDiff}
          readOnly
        />
      ))}

      {/* ── Biodiesel Trades (read-only — data from Products Data tab) ────── */}
      <BiodieselTradesPanel readOnly />

      {/* ── Supply & Demand Outlook ───────────────────────────────────────── */}
      {hasSDOutlook && (
        <div data-section="supply-demand">
          <SupplyDemandCard outlook={report.supply_demand_outlook!} />
        </div>
      )}

      {/* ── Macro Signals ─────────────────────────────────────────────────── */}
      <div data-section="macro-signals">
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Macro Signals</h2>
        <MacroSignalsTable signals={report.macro_signals} />
      </div>

      {/* ── Market Outlook ────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Market Outlook</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <OutlookCard outlook={report.short_term_outlook} />
          <OutlookCard outlook={report.long_term_outlook} />
        </div>
      </div>

      {/* ── Upcoming Key Dates ────────────────────────────────────────────── */}
      {report.upcoming_key_dates && report.upcoming_key_dates.length > 0 && (
        <div data-section="key-dates">
          <KeyDatesCard dates={report.upcoming_key_dates} />
        </div>
      )}

      {/* ── Broker Notes (broker only) ─────────────────────────────────── */}
      {isBroker && (
        <div className="bg-card border border-border rounded p-5">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Broker Notes</h2>
          <textarea
            value={brokerNotes}
            onChange={(e) => setBrokerNotes(e.target.value)}
            rows={4}
            placeholder="Add internal broker notes here..."
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-none"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => void handleSaveNotes()}
              disabled={savingNotes}
              className="bg-card border border-border text-text-secondary px-5 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
            >
              {savingNotes ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Notes'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
