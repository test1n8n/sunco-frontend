import { useState, useEffect } from 'react';
import type { Report } from '../../types';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import { useToast, ToastContainer } from '../../components/Toast';
import BiodieselTradesPanel from '../../components/BiodieselTradesPanel';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Reusable section header — identical styling to the morning report. */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pb-2 mb-2 border-b-2 border-accent/60">
      <h2 className="text-text-primary font-bold text-base uppercase tracking-widest">{title}</h2>
      {subtitle && <p className="text-text-dim text-xs mt-0.5">{subtitle}</p>}
    </div>
  );
}

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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EveningReport({ role = 'broker' }: { role?: 'broker' | 'client' }) {
  const isBroker = role === 'broker';
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [eveningMarketCommentary, setEveningMarketCommentary] = useState('');
  const [savingCommentary, setSavingCommentary] = useState(false);
  const [fetchError, setFetchError] = useState('');
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
          setEveningMarketCommentary(data.evening_market_commentary ?? '');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Report fetch failed:', msg);
        setFetchError(msg);
      } finally {
        setLoading(false);
      }
    };
    void loadReport();
  }, []);

  const handleSaveCommentary = async () => {
    if (!report) return;
    setSavingCommentary(true);
    try {
      const res = await fetch(`${API_BASE_URL}/report/${report.report_date}/evening-commentary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ evening_market_commentary: eveningMarketCommentary }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Evening commentary saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast('error', `Failed to save commentary: ${msg}`);
    } finally {
      setSavingCommentary(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="max-w-4xl">
        <ToastContainer toasts={toasts} dismissToast={dismissToast} />
        <div className="bg-card border border-border rounded p-8 text-center">
          <p className="text-text-dim text-sm">
            No report found for today. Generate the morning report first.
          </p>
          {fetchError && <p className="text-xs text-text-dim mt-2 opacity-75">Error: {fetchError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b border-border">
        <div>
          <p className="text-text-dim text-xs tracking-widest uppercase mb-1">{formatDate(report.report_date)}</p>
          <p className="text-text-primary text-sm uppercase tracking-widest font-semibold">Daily Evening Report</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
                const cleanup = () => { document.body.classList.remove('short-pdf'); window.removeEventListener('afterprint', cleanup); };
                window.addEventListener('afterprint', cleanup);
                setTimeout(() => document.body.classList.remove('short-pdf'), 5000);
              });
            }}
            className="bg-card border border-border text-text-secondary px-4 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 transition-colors uppercase tracking-widest"
          >
            Download Short PDF
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          1 — MARKET COMMENTARY (evening, analyst-written — separate from morning)
          ═══════════════════════════════════════════════════════════════════ */}
      {isBroker ? (
        <div className="bg-card border border-border border-l-4 border-l-accent rounded p-5" data-section="market-commentary">
          <SectionHeader title="Market Commentary" subtitle="Written by Sunco analysts" />
          <textarea
            value={eveningMarketCommentary}
            onChange={(e) => setEveningMarketCommentary(e.target.value)}
            rows={6}
            placeholder="Write tonight's market commentary here — end-of-day wrap, post-close flow, and colour from the desk."
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-none mt-3"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => void handleSaveCommentary()}
              disabled={savingCommentary}
              className="bg-accent text-surface px-5 py-2 rounded text-xs font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
            >
              {savingCommentary ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Commentary'
              )}
            </button>
          </div>
        </div>
      ) : (
        eveningMarketCommentary.trim() && (
          <div className="bg-card border border-border border-l-4 border-l-accent rounded p-5" data-section="market-commentary">
            <SectionHeader title="Market Commentary" subtitle="Written by Sunco analysts" />
            <p className="text-text-primary text-sm leading-relaxed mt-3 whitespace-pre-wrap">{eveningMarketCommentary}</p>
          </div>
        )
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          2 — ICE BIODIESEL DIFF SWAPS — same data as morning report
          ═══════════════════════════════════════════════════════════════════ */}
      <BiodieselTradesPanel readOnly prominentTitle />
    </div>
  );
}
