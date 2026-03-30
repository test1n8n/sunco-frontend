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

function ClientNewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="bg-card border border-border rounded p-4">
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

function DirectionIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up') return <span className="text-positive font-bold">▲</span>;
  if (direction === 'down') return <span className="text-negative font-bold">▼</span>;
  return <span className="text-text-dim font-bold">—</span>;
}

function ClientMacroTable({ signals }: { signals: MacroSignal[] }) {
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

function ClientOutlookCard({ outlook }: { outlook: Outlook }) {
  const bulletItems = outlook.key_risks ?? outlook.key_themes ?? [];

  return (
    <div className="bg-card border border-border border-l-2 border-l-accent rounded p-5">
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
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <header className="bg-panel border-b border-border px-6 py-4">
          <div className="text-text-primary font-bold text-sm tracking-widest uppercase">SUNCO BROKERS</div>
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
    <div className="min-h-screen bg-surface font-sans">
      {/* Header */}
      <header className="bg-panel border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-text-primary font-bold text-sm tracking-widest uppercase">SUNCO BROKERS</div>
          <div className="text-text-dim text-xs mt-0.5 tracking-wide">Biofuels Intelligence Platform</div>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-text-secondary hover:text-text-primary border border-border hover:border-accent/50 px-3 py-1.5 rounded transition-colors tracking-widest uppercase"
        >
          Logout
        </button>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-5">
        {/* Title */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-border">
          <div>
            <h1 className="text-text-primary font-bold text-lg tracking-wide">Sunco Brokers Daily Intelligence Report</h1>
            <p className="text-text-dim text-xs mt-1 uppercase tracking-widest">{formatDate(report.report_date)}</p>
            <div className="flex items-center gap-3 mt-2">
              <BiasBadge bias={report.short_term_outlook.bias} />
              <span className="text-xs text-text-dim uppercase tracking-widest">Short-term bias</span>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="bg-card border border-border text-text-secondary px-4 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 transition-colors uppercase tracking-widest"
          >
            Download PDF
          </button>
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
                <ClientNewsCard key={idx} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Macro Signals */}
        <div>
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Macro Signals</h2>
          <ClientMacroTable signals={report.macro_signals} />
        </div>

        {/* Outlooks */}
        <div>
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">Market Outlook</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <ClientOutlookCard outlook={report.short_term_outlook} />
            <ClientOutlookCard outlook={report.long_term_outlook} />
          </div>
        </div>

        {/* SAF Note */}
        <div className="bg-card border border-border rounded p-4">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-2">SAF Note</h2>
          <p className="text-text-secondary text-sm italic">{report.saf_note}</p>
        </div>

        {/* Broker Commentary */}
        {report.broker_notes && report.broker_notes.trim() !== '' && (
          <div className="bg-card border border-border rounded p-5">
            <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-2">Broker Commentary</h2>
            <p className="text-text-secondary text-sm whitespace-pre-wrap">{report.broker_notes}</p>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-border pt-6 text-center text-text-dim text-xs">
          <p>Sunco Brokers SA — Geneva, Switzerland | <a href="https://www.suncobrokers.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">www.suncobrokers.com</a></p>
          <p className="mt-1">&copy; {new Date().getFullYear()} Sunco Brokers SA. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
