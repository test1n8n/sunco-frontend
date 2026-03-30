import { useState, useEffect } from 'react';
import type { Report, NewsItem, MacroSignal, Outlook } from '../../types';
import { MOCK_REPORT } from '../../mockData';
import { API_BASE_URL, API_KEY } from '../../config';
import BiasBadge from '../../components/BiasBadge';
import Spinner from '../../components/Spinner';
import ErrorBanner from '../../components/ErrorBanner';
import { useToast, ToastContainer } from '../../components/Toast';

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

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="bg-card border border-border rounded p-4 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-semibold text-text-primary text-sm leading-snug flex-1">{item.headline}</h4>
        <RelevanceBadge relevance={item.relevance} />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text-dim bg-surface px-2 py-0.5 rounded border border-border">{item.source}</span>
      </div>
      <p className="text-text-secondary text-sm italic mb-3">{item.price_impact}</p>
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
              <td className="px-4 py-3 text-text-secondary text-sm hidden sm:table-cell">{signal.biofuels_implication}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OutlookCard({ outlook }: { outlook: Outlook }) {
  const bulletItems = outlook.key_risks ?? outlook.key_themes ?? [];

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
      <BiasBadge bias={outlook.bias} />
    </div>
  );
}

export default function DailyReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [usedMock, setUsedMock] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [brokerNotes, setBrokerNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [sendingToClients, setSendingToClients] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/report/latest`, {
          headers: { 'X-API-Key': API_KEY },
        });
        if (res.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Report;
        setReport(data);
        setBrokerNotes(data.broker_notes ?? '');
      } catch {
        setReport(MOCK_REPORT);
        setBrokerNotes(MOCK_REPORT.broker_notes ?? '');
        setUsedMock(true);
      } finally {
        setLoading(false);
      }
    };
    void fetchReport();
  }, []);

  const handleSaveNotes = async () => {
    if (!report) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`${API_BASE_URL}/report/${report.report_date}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
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
        <p className="text-lg font-semibold text-text-primary mb-2 tracking-wide">Report Pending</p>
        <p className="text-sm">Today's report is being generated. Check back shortly.</p>
      </div>
    );
  }

  if (!report) return null;

  const filteredNews = report.key_news.filter((n) => n.relevance === 'high' || n.relevance === 'medium');

  return (
    <div className="space-y-5 max-w-4xl">
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />

      {usedMock && <ErrorBanner />}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b border-border">
        <div>
          <p className="text-text-dim text-xs tracking-widest uppercase mb-1">{formatDate(report.report_date)}</p>
          <div className="flex items-center gap-3">
            <BiasBadge bias={report.short_term_outlook.bias} />
            <span className="text-xs text-text-dim uppercase tracking-widest">Short-term bias</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSendToClients}
            disabled={sendingToClients}
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
          <button
            onClick={() => window.print()}
            className="bg-card border border-border text-text-secondary px-4 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 transition-colors uppercase tracking-widest"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* Market Summary */}
      <div className="bg-card border border-border border-l-2 border-l-accent rounded p-5">
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Market Summary</h2>
        <p className="text-text-primary text-sm leading-relaxed">{report.market_summary}</p>
      </div>

      {/* Key News */}
      <div>
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Key News</h2>
        {filteredNews.length === 0 ? (
          <div className="bg-card border border-border rounded p-6 text-center text-text-dim text-sm">
            No high or medium relevance news items today.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredNews.map((item, idx) => (
              <NewsCard key={idx} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Macro Signals */}
      <div>
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Macro Signals</h2>
        <MacroSignalsTable signals={report.macro_signals} />
      </div>

      {/* Outlooks */}
      <div>
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Market Outlook</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <OutlookCard outlook={report.short_term_outlook} />
          <OutlookCard outlook={report.long_term_outlook} />
        </div>
      </div>

      {/* SAF Note */}
      <div className="bg-card border border-border rounded p-4">
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-2">SAF Note</h2>
        <p className="text-text-secondary text-sm italic">{report.saf_note}</p>
      </div>

      {/* Broker Notes */}
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
    </div>
  );
}
