import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Report, NewsItem } from '../../types';
import { MOCK_REPORT } from '../../mockData';
import { API_BASE_URL, API_KEY } from '../../config';
import BiasBadge from '../../components/BiasBadge';
import Spinner from '../../components/Spinner';
import type { Outlook, MacroSignal } from '../../types';

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

function ClientNewsCard({ item }: { item: NewsItem }) {
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
        className="text-[#2E86AB] text-sm font-medium hover:underline"
      >
        Read more →
      </a>
    </div>
  );
}

function DirectionIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up') return <span className="text-green-600 font-bold">▲</span>;
  if (direction === 'down') return <span className="text-red-600 font-bold">▼</span>;
  return <span className="text-gray-400 font-bold">→</span>;
}

function ClientMacroTable({ signals }: { signals: MacroSignal[] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Signal</th>
            <th className="text-center px-4 py-3 text-gray-600 font-semibold">Direction</th>
            <th className="text-right px-4 py-3 text-gray-600 font-semibold">Change %</th>
            <th className="text-left px-4 py-3 text-gray-600 font-semibold hidden sm:table-cell">Implication</th>
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

function ClientOutlookCard({ outlook }: { outlook: Outlook }) {
  const bulletItems = outlook.key_risks ?? outlook.key_themes ?? [];

  return (
    <div className="bg-white rounded-lg shadow-sm border-l-4 border-[#1B2A4A] p-5">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">{outlook.horizon}</p>
      <p className="text-gray-800 text-sm leading-relaxed mb-3">{outlook.summary}</p>
      {bulletItems.length > 0 && (
        <ul className="space-y-1 mb-4">
          {bulletItems.map((item, idx) => (
            <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-[#1B2A4A] mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      <BiasBadge bias={outlook.bias} />
    </div>
  );
}

export default function ClientReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/report/latest`, {
          headers: { 'X-API-Key': API_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Report;
        setReport(data);
      } catch {
        setReport(MOCK_REPORT);
      } finally {
        setLoading(false);
      }
    };
    void fetchReport();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    void navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
        <header className="bg-[#1B2A4A] px-6 py-4">
          <div className="text-white font-bold text-xl">🌿 SUNCO BROKERS</div>
        </header>
        <Spinner />
      </div>
    );
  }

  if (!report) return null;

  const filteredNews = report.key_news.filter(
    (n) => n.relevance === 'high' || n.relevance === 'medium'
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* Header */}
      <header className="bg-[#1B2A4A] px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-xl">🌿 SUNCO BROKERS</div>
          <div className="text-blue-300 text-xs mt-0.5">Biofuels Intelligence Platform</div>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-blue-200 hover:text-white border border-blue-400 hover:border-white px-3 py-1.5 rounded transition-colors"
        >
          Logout
        </button>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1B2A4A]">Sunco Brokers Daily Intelligence Report</h1>
            <p className="text-gray-500 text-sm mt-1">{formatDate(report.report_date)}</p>
            <div className="flex items-center gap-3 mt-2">
              <BiasBadge bias={report.short_term_outlook.bias} />
              <span className="text-xs text-gray-400">Short-term bias</span>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            🖨 Download PDF
          </button>
        </div>

        {/* Market Summary */}
        <div className="bg-white rounded-lg shadow-sm border-l-4 border-[#1B2A4A] p-5">
          <h2 className="text-[#1B2A4A] font-semibold text-sm uppercase tracking-wide mb-3">Market Summary</h2>
          <p className="text-gray-800 text-base leading-relaxed">{report.market_summary}</p>
        </div>

        {/* Key News */}
        <div>
          <h2 className="text-[#1B2A4A] font-semibold text-sm uppercase tracking-wide mb-3">Key News</h2>
          {filteredNews.length === 0 ? (
            <div className="bg-white rounded-lg p-6 text-center text-gray-500 text-sm">
              No high or medium relevance news items today.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredNews.map((item, idx) => (
                <ClientNewsCard key={idx} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Macro Signals */}
        <div>
          <h2 className="text-[#1B2A4A] font-semibold text-sm uppercase tracking-wide mb-3">Macro Signals</h2>
          <ClientMacroTable signals={report.macro_signals} />
        </div>

        {/* Outlooks */}
        <div>
          <h2 className="text-[#1B2A4A] font-semibold text-sm uppercase tracking-wide mb-3">Market Outlook</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <ClientOutlookCard outlook={report.short_term_outlook} />
            <ClientOutlookCard outlook={report.long_term_outlook} />
          </div>
        </div>

        {/* SAF Note */}
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <h2 className="text-[#1B2A4A] font-semibold text-sm uppercase tracking-wide mb-2">SAF Note</h2>
          <p className="text-gray-400 text-sm italic">{report.saf_note}</p>
        </div>

        {/* Broker Commentary */}
        {report.broker_notes && report.broker_notes.trim() !== '' && (
          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-100">
            <h2 className="text-[#1B2A4A] font-semibold text-sm uppercase tracking-wide mb-2">Broker Commentary</h2>
            <p className="text-gray-700 text-sm whitespace-pre-wrap">{report.broker_notes}</p>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-6 text-center text-gray-400 text-sm">
          <p>Sunco Brokers SA — Geneva, Switzerland | <a href="https://www.suncobrokers.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#2E86AB]">www.suncobrokers.com</a></p>
          <p className="mt-1">&copy; {new Date().getFullYear()} Sunco Brokers SA. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
