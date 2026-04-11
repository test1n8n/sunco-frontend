import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, API_KEY } from '../config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  type: 'page' | 'report' | 'research' | 'trade' | 'news' | 'counterparty';
  title: string;
  subtitle?: string;
  path: string;
  icon: string;
}

export interface GlobalSearchHandle {
  focus: () => void;
}

// ─── Static page index ────────────────────────────────────────────────────────

const PAGES: SearchResult[] = [
  { type: 'page', title: 'Overview',           subtitle: 'Market pulse, prices, news',             path: '/broker',               icon: '📊' },
  { type: 'page', title: 'Daily Report',       subtitle: 'Full AI-generated daily report',         path: '/broker/daily',         icon: '📰' },
  { type: 'page', title: 'Mandates',           subtitle: 'EU mandate database + compliance',       path: '/broker/mandates',      icon: '📋' },
  { type: 'page', title: 'Products Data',      subtitle: 'Upload ICE settlement PDFs',             path: '/broker/products',      icon: '📁' },
  { type: 'page', title: 'Charts',             subtitle: 'Macro, feedstocks, weather, COT',        path: '/broker/charts',        icon: '📈' },
  { type: 'page', title: 'Spreads',            subtitle: 'Cross-product spread dashboard',         path: '/broker/spreads',       icon: '↔️' },
  { type: 'page', title: 'History',            subtitle: 'Historical settlements archive',         path: '/broker/history',       icon: '🗃️' },
  { type: 'page', title: 'Trade Blotter',      subtitle: 'Trade entry and log',                    path: '/broker/blotter',       icon: '📝' },
  { type: 'page', title: 'Positions & P&L',    subtitle: 'Live mark-to-market',                    path: '/broker/pnl',           icon: '💰' },
  { type: 'page', title: 'Counterparties',     subtitle: 'CRM / relationship tracker',             path: '/broker/counterparties',icon: '🤝' },
  { type: 'page', title: 'Alerts',             subtitle: 'Price threshold alerts',                 path: '/broker/alerts',        icon: '🔔' },
  { type: 'page', title: 'Archive',            subtitle: 'Past daily reports',                     path: '/broker/archive',       icon: '📚' },
  { type: 'page', title: 'Biofuels AI',        subtitle: 'Ask the AI anything',                    path: '/broker/ai',            icon: '🤖' },
  { type: 'page', title: 'Research Engine',    subtitle: 'Deep research reports',                  path: '/broker/research',      icon: '🔬' },
  { type: 'page', title: 'Subscriptions',      subtitle: 'Manage email recipients',                path: '/broker/subscriptions', icon: '📧' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const GlobalSearch = forwardRef<GlobalSearchHandle>((_props, ref) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Expose focus method to parent via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    },
  }));

  // Search across static pages + dynamic data
  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    const lowerQ = q.toLowerCase();

    // 1. Search static pages
    const pageResults = PAGES.filter((p) =>
      p.title.toLowerCase().includes(lowerQ) ||
      (p.subtitle?.toLowerCase().includes(lowerQ) ?? false)
    );

    const collected: SearchResult[] = [...pageResults];

    // 2. Search dynamic data in parallel (non-blocking)
    try {
      const headers = { 'X-API-Key': API_KEY };

      const [reportRes, researchRes, counterpartyRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/report/latest`, { headers }),
        fetch(`${API_BASE_URL}/research/list/all`, { headers }),
        fetch(`${API_BASE_URL}/counterparties`, { headers }),
      ]);

      // Daily report news
      if (reportRes.status === 'fulfilled' && reportRes.value.ok) {
        const report = await reportRes.value.json();
        if (report.key_news) {
          const news = report.key_news
            .filter((n: { headline?: string }) =>
              n.headline?.toLowerCase().includes(lowerQ)
            )
            .slice(0, 4);
          for (const n of news) {
            collected.push({
              type: 'news',
              title: n.headline,
              subtitle: `News · ${n.source ?? 'Daily Report'}`,
              path: '/broker/daily',
              icon: '📰',
            });
          }
        }
      }

      // Research reports
      if (researchRes.status === 'fulfilled' && researchRes.value.ok) {
        const list = (await researchRes.value.json()) as Array<{ research_id: string; brief?: string; report_title?: string; country_code?: string }>;
        const matches = list
          .filter((r) =>
            (r.brief?.toLowerCase().includes(lowerQ) ?? false) ||
            (r.report_title?.toLowerCase().includes(lowerQ) ?? false) ||
            (r.country_code?.toLowerCase().includes(lowerQ) ?? false)
          )
          .slice(0, 4);
        for (const r of matches) {
          collected.push({
            type: 'research',
            title: r.report_title ?? r.brief?.slice(0, 80) ?? 'Research Report',
            subtitle: `Research · ${r.country_code ?? 'Multi-country'}`,
            path: '/broker/research',
            icon: '🔬',
          });
        }
      }

      // Counterparties
      if (counterpartyRes.status === 'fulfilled' && counterpartyRes.value.ok) {
        const data = (await counterpartyRes.value.json()) as { counterparties?: Array<{ counterparty: string; total_volume_mt: number; trade_count: number }> };
        const matches = (data.counterparties ?? [])
          .filter((c) => c.counterparty.toLowerCase().includes(lowerQ))
          .slice(0, 4);
        for (const c of matches) {
          collected.push({
            type: 'counterparty',
            title: c.counterparty,
            subtitle: `Counterparty · ${c.trade_count} trades · ${Math.round(c.total_volume_mt).toLocaleString()} MT`,
            path: '/broker/counterparties',
            icon: '🤝',
          });
        }
      }
    } catch {
      // Silent fail — fallback to just page results
    }

    setResults(collected.slice(0, 20));
    setActiveIdx(0);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      void doSearch(query);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open, doSearch]);

  // Global escape + arrow navigation within the modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[activeIdx]) {
        e.preventDefault();
        void navigate(results[activeIdx].path);
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, activeIdx, navigate]);

  // Lock body scroll when modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleClick = (result: SearchResult) => {
    void navigate(result.path);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      {/* Trigger button (visible in header) */}
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-dim border border-border rounded hover:border-accent/50 hover:text-text-secondary transition-colors"
        title="Search (/)"
      >
        <span>🔍</span>
        <span className="hidden md:inline">Search...</span>
        <kbd className="hidden md:inline bg-surface border border-border rounded px-1 text-[10px] font-mono">/</kbd>
      </button>

      {/* Modal */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-[15vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded shadow-2xl w-full max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <span className="text-text-dim">🔍</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, news, research, counterparties..."
                className="flex-1 bg-transparent text-text-primary placeholder-text-dim text-sm focus:outline-none"
              />
              <kbd className="bg-surface border border-border rounded px-1.5 text-[10px] font-mono text-text-dim">ESC</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {query.length < 2 ? (
                <div className="p-6 text-center text-text-dim text-xs italic">
                  Type to search across pages, news, research reports, counterparties...
                </div>
              ) : results.length === 0 ? (
                <div className="p-6 text-center text-text-dim text-xs italic">
                  No results for "{query}"
                </div>
              ) : (
                <div>
                  {results.map((r, i) => (
                    <button
                      key={`${r.type}-${i}`}
                      onClick={() => handleClick(r)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors border-l-2 ${
                        i === activeIdx
                          ? 'bg-surface/60 border-accent'
                          : 'border-transparent hover:bg-surface/30'
                      }`}
                    >
                      <span className="text-lg shrink-0">{r.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-text-primary text-xs font-semibold truncate">{r.title}</div>
                        {r.subtitle && (
                          <div className="text-text-dim text-[11px] truncate">{r.subtitle}</div>
                        )}
                      </div>
                      {i === activeIdx && (
                        <kbd className="text-text-dim text-[10px] shrink-0">↵</kbd>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-border text-[10px] text-text-dim flex items-center justify-between">
              <span>
                <kbd className="bg-surface border border-border rounded px-1">↑↓</kbd> navigate{' '}
                <kbd className="bg-surface border border-border rounded px-1 ml-1">↵</kbd> open
              </span>
              <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

GlobalSearch.displayName = 'GlobalSearch';
export default GlobalSearch;
