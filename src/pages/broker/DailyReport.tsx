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
  if (direction === 'up') return <span className="text-green-600 font-bold">▲</span>;
  if (direction === 'down') return <span className="text-red-600 font-bold">▼</span>;
  return <span className="text-gray-400 font-bold">→</span>;
}

function RelevanceBadge({ relevance }: { relevance: 'high' | 'medium' | 'low' }) {
  const styles: Record<string, string> = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-orange-100 text-orange-700',
    low: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${styles[relevance]}`}>
      {relevance}
    </span>
  );
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-semibold text-gray-900 text-sm leading-snug flex-1">{item.headline}</h4>
        <RelevanceBadge relevance={item.relevance} />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{item.source}</span>
      </div>
      <p className="text-gray-600 text-sm italic mb-2">{item.price_impact}</p>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent text-sm font-medium hover:underline"
      >
        Read more →
      </a>
    </div>
  );
}

export function MacroSignalsTable({ signals }: { signals: MacroSignal[] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Signal</th>
            <th className="text-center px-4 py-3 text-gray-600 font-semibold">Direction</th>
            <th className="text-right px-4 py-3 text-gray-600 font-semibold">Change %</th>
            <th className="text-left px-4 py-3 text-gray-600 font-semibold hidden sm:table-cell">Biofuels Implication</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal, idx) => (
            <tr key={signal.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 font-medium text-gray-900">{signal.name}</td>
              <td className="px-4 py-3 text-center">
                <DirectionIcon direction={signal.direction} />
              </td>
              <td className={`px-4 py-3 text-right font-mono font-semibold ${signal.change_pct > 0 ? 'text-green-600' : signal.change_pct < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {signal.change_pct > 0 ? '+' : ''}{signal.change_pct.toFixed(1)}%
              </td>
              <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{signal.biofuels_implication}</td>
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
    <div className="bg-white rounded-lg shadow-sm border-l-4 border-navy p-5">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">{outlook.horizon}</p>
      <p className="text-gray-800 text-sm leading-relaxed mb-3">{outlook.summary}</p>
      {bulletItems.length > 0 && (
        <ul className="space-y-1 mb-4">
          {bulletItems.map((item, idx) => (
            <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-navy mt-0.5">•</span>
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
      showToast('success', 'Broker notes saved successfully.');
    } catch {
      showToast('error', 'Failed to save notes. Please try again.');
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
      showToast('success', 'Report sent to clients successfully.');
    } catch {
      showToast('error', 'Failed to send to clients. Please try again.');
    } finally {
      setSendingToClients(false);
    }
  };

  if (loading) return <Spinner />;

  if (notFound) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-xl font-semibold mb-2">Report Pending</p>
        <p>Today's report is being generated. Check back shortly.</p>
      </div>
    );
  }

  if (!report) return null;

  const filteredNews = report.key_news.filter((n) => n.relevance === 'high' || n.relevance === 'medium');

  return (
    <div className="space-y-6 max-w-4xl">
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />

      {usedMock && <ErrorBanner />}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm">{formatDate(report.report_date)}</p>
          <div className="flex items-center gap-3 mt-1">
            <BiasBadge bias={report.short_term_outlook.bias} />
            <span className="text-xs text-gray-400">Short-term bias</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSendToClients}
            disabled={sendingToClients}
            className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {sendingToClients ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              '🚀 Send to Clients'
            )}
          </button>
          <button
            onClick={() => window.print()}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            🖨 Download PDF
          </button>
        </div>
      </div>

      {/* Market Summary */}
      <div className="bg-white rounded-lg shadow-sm border-l-4 border-navy p-5">
        <h2 className="text-navy font-semibold text-sm uppercase tracking-wide mb-3">Market Summary</h2>
        <p className="text-gray-800 text-base leading-relaxed">{report.market_summary}</p>
      </div>

      {/* Key News */}
      <div>
        <h2 className="text-navy font-semibold text-sm uppercase tracking-wide mb-3">Key News</h2>
        {filteredNews.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-100 p-6 text-center text-gray-500 text-sm">
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
        <h2 className="text-navy font-semibold text-sm uppercase tracking-wide mb-3">Macro Signals</h2>
        <MacroSignalsTable signals={report.macro_signals} />
      </div>

      {/* Outlooks */}
      <div>
        <h2 className="text-navy font-semibold text-sm uppercase tracking-wide mb-3">Market Outlook</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <OutlookCard outlook={report.short_term_outlook} />
          <OutlookCard outlook={report.long_term_outlook} />
        </div>
      </div>

      {/* SAF Note */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
        <h2 className="text-navy font-semibold text-sm uppercase tracking-wide mb-2">SAF Note</h2>
        <p className="text-gray-400 text-sm italic">{report.saf_note}</p>
      </div>

      {/* Broker Notes */}
      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-100">
        <h2 className="text-navy font-semibold text-sm uppercase tracking-wide mb-3">Broker Notes</h2>
        <textarea
          value={brokerNotes}
          onChange={(e) => setBrokerNotes(e.target.value)}
          rows={4}
          placeholder="Add internal broker notes here..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => void handleSaveNotes()}
            disabled={savingNotes}
            className="bg-navy text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-navy-light transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {savingNotes ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
