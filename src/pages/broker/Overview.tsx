import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import type { Report, NewsItem, Outlook, KeyDate, GasoilReport } from '../../types';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import { BIODIESEL_PRODUCTS } from '../../productConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricePoint { date: string; value: number }
interface TickerInfo { name: string; data: PricePoint[] }
interface PricesResponse { tickers: Record<string, TickerInfo> }

interface ProductReport extends GasoilReport {
  product_code?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatNumber(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatChange(n: number | null | undefined): { text: string; color: string } {
  if (n == null) return { text: '—', color: 'text-text-dim' };
  const sign = n >= 0 ? '+' : '';
  const color = n > 0 ? 'text-positive' : n < 0 ? 'text-negative' : 'text-text-dim';
  return { text: `${sign}${n.toFixed(2)}`, color };
}

// ─── Market Pulse Bar (hero) ──────────────────────────────────────────────────

function MarketPulseBar({
  report,
  gasoil,
  brentSpot,
  brentChange,
  eurusdSpot,
  eurusdChange,
}: {
  report: Report | null;
  gasoil: ProductReport | null;
  brentSpot: number | null;
  brentChange: number | null;
  eurusdSpot: number | null;
  eurusdChange: number | null;
}) {
  const bias = report?.short_term_outlook?.bias ?? 'neutral';
  const biasConfig = {
    bullish: { emoji: '🟢', label: 'BULLISH', color: 'text-positive', bg: 'bg-positive/10', border: 'border-positive/30' },
    bearish: { emoji: '🔴', label: 'BEARISH', color: 'text-negative', bg: 'bg-negative/10', border: 'border-negative/30' },
    neutral: { emoji: '⚪', label: 'NEUTRAL', color: 'text-text-dim', bg: 'bg-border/30', border: 'border-border' },
  }[bias];

  const summary = report?.market_summary ?? report?.short_term_outlook?.summary ?? '';
  const shortSummary = summary.length > 180 ? summary.slice(0, 180) + '…' : summary;

  const gasoilM1 = gasoil?.forward_curve?.[0];

  return (
    <div className={`border ${biasConfig.border} ${biasConfig.bg} rounded p-5`}>
      {/* Top row: date + bias */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-text-dim text-xs uppercase tracking-widest">Market Pulse</p>
          <h1 className="text-text-primary text-lg font-bold mt-0.5">
            {report ? formatDate(report.report_date) : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </h1>
        </div>
        <div className={`px-4 py-2 rounded ${biasConfig.bg} border ${biasConfig.border}`}>
          <span className={`text-lg font-bold tracking-widest ${biasConfig.color}`}>
            {biasConfig.emoji} {biasConfig.label}
          </span>
        </div>
      </div>

      {/* Summary */}
      {shortSummary && (
        <p className="text-text-secondary text-sm leading-relaxed mb-4 max-w-4xl">
          {shortSummary}
        </p>
      )}

      {/* Mini price pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <PricePill
          label="Gasoil M1"
          value={gasoilM1 ? `${formatNumber(gasoilM1.settlement)} $/MT` : '—'}
          change={gasoilM1?.change ?? null}
          sub={gasoilM1?.contract ?? ''}
        />
        <PricePill
          label="Brent Crude"
          value={brentSpot ? `${brentSpot.toFixed(2)} $/bbl` : '—'}
          change={brentChange}
          sub="ICE Brent"
        />
        <PricePill
          label="EUR/USD"
          value={eurusdSpot ? eurusdSpot.toFixed(4) : '—'}
          change={eurusdChange}
          sub="Spot"
          changeIsPct
        />
        <PricePill
          label="Bias"
          value={biasConfig.label}
          change={null}
          sub={report?.short_term_outlook?.horizon ?? 'short-term'}
          valueColor={biasConfig.color}
        />
      </div>
    </div>
  );
}

function PricePill({
  label, value, change, sub, changeIsPct = false, valueColor = 'text-text-primary',
}: {
  label: string;
  value: string;
  change: number | null;
  sub: string;
  changeIsPct?: boolean;
  valueColor?: string;
}) {
  const chg = formatChange(change);
  return (
    <div className="bg-surface border border-border rounded px-3 py-2">
      <div className="text-text-dim text-[10px] uppercase tracking-widest mb-1">{label}</div>
      <div className={`font-mono font-bold text-base ${valueColor}`}>{value}</div>
      <div className="flex items-center gap-2 mt-0.5">
        {change != null && (
          <span className={`text-xs font-mono ${chg.color}`}>
            {chg.text}{changeIsPct ? '%' : ''}
          </span>
        )}
        {sub && <span className="text-text-dim text-[10px]">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Price Grid: all 6 ICE products in one table ──────────────────────────────

function PriceGrid({
  gasoil,
  biodieselProducts,
}: {
  gasoil: ProductReport | null;
  biodieselProducts: Record<string, ProductReport | null>;
}) {
  const rows: {
    code: string;
    name: string;
    isDiff: boolean;
    report: ProductReport | null;
  }[] = [
    { code: 'G', name: 'LS Gasoil', isDiff: false, report: gasoil },
    ...BIODIESEL_PRODUCTS.map((p) => ({
      code: p.code,
      name: p.name,
      isDiff: p.isDiff,
      report: biodieselProducts[p.code] ?? null,
    })),
  ];

  return (
    <div className="bg-card border border-border rounded">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-text-primary font-semibold text-sm">ICE Products — Latest Settlements</h3>
        <Link to="/broker/products" className="text-accent text-xs hover:underline">View all →</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="px-4 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Product</th>
              <th className="px-4 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">M1</th>
              <th className="px-4 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Chg</th>
              <th className="px-4 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden sm:table-cell">VWAP</th>
              <th className="px-4 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Volume</th>
              <th className="px-4 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">OI</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ code, name, isDiff, report }) => {
              const m1 = report?.forward_curve?.[0];
              const chg = formatChange(m1?.change ?? null);
              const m1Label = isDiff ? 'diff vs GO' : '$/MT';
              return (
                <tr key={code} className="border-b border-border/50 hover:bg-surface/40">
                  <td className="px-4 py-2.5 text-text-primary font-semibold">
                    {name} <span className="text-text-dim text-[10px]">({code})</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-primary font-bold">
                    {m1 ? (
                      <>
                        {formatNumber(m1.settlement)}
                        <span className="text-text-dim text-[10px] ml-1">{m1Label}</span>
                      </>
                    ) : '—'}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs ${chg.color}`}>
                    {chg.text}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary hidden sm:table-cell">
                    {isDiff ? <span className="text-text-dim">—</span> : formatNumber(report?.vwap)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary text-xs">
                    {report?.total_volume != null ? report.total_volume.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary text-xs hidden md:table-cell">
                    {report?.total_oi != null ? report.total_oi.toLocaleString() : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── News Column (top 5 by relevance) ─────────────────────────────────────────

function NewsColumn({ news }: { news: NewsItem[] }) {
  const sorted = useMemo(() => {
    const rank = { high: 0, medium: 1, low: 2 };
    return [...news].sort((a, b) => (rank[a.relevance] ?? 3) - (rank[b.relevance] ?? 3));
  }, [news]);

  const topNews = sorted.slice(0, 6);

  const categoryColors: Record<string, string> = {
    SAF: 'bg-accent/10 text-accent border-accent/30',
    advanced_biofuels: 'bg-positive/10 text-positive border-positive/30',
    biodiesel: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    general: 'bg-border/30 text-text-dim border-border',
  };

  const relevanceDot: Record<string, string> = {
    high: 'bg-negative',
    medium: 'bg-accent',
    low: 'bg-border',
  };

  return (
    <div className="bg-card border border-border rounded h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-text-primary font-semibold text-sm">Key News</h3>
        <Link to="/broker/daily" className="text-accent text-xs hover:underline">View all →</Link>
      </div>
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {topNews.length === 0 ? (
          <p className="text-text-dim text-xs italic text-center py-4">No news available</p>
        ) : (
          topNews.map((item, idx) => (
            <a
              key={idx}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-border rounded p-3 hover:border-accent/50 transition-colors bg-surface/30"
            >
              <div className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${relevanceDot[item.relevance] ?? 'bg-border'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-xs font-semibold leading-snug mb-1.5">
                    {item.headline}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-text-dim text-[10px]">{item.source}</span>
                    {item.product_category && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wide ${categoryColors[item.product_category] ?? categoryColors.general}`}>
                        {item.product_category.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Outlook Card ─────────────────────────────────────────────────────────────

function OutlookCard({ shortTerm }: { shortTerm: Outlook | null }) {
  if (!shortTerm) {
    return (
      <div className="bg-card border border-border rounded p-5 h-full">
        <h3 className="text-text-primary font-semibold text-sm mb-3">Market Outlook</h3>
        <p className="text-text-dim text-xs italic">No outlook available.</p>
      </div>
    );
  }

  const themes = shortTerm.key_themes ?? [];
  const risks = shortTerm.key_risks ?? [];

  return (
    <div className="bg-card border border-border rounded p-5 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-primary font-semibold text-sm">Market Outlook</h3>
        <span className="text-text-dim text-[10px] uppercase tracking-widest">{shortTerm.horizon}</span>
      </div>
      <p className="text-text-secondary text-xs leading-relaxed mb-4">{shortTerm.summary}</p>

      {themes.length > 0 && (
        <div className="mb-3">
          <p className="text-positive text-[10px] uppercase tracking-widest font-semibold mb-1.5">✅ Key Themes</p>
          <ul className="space-y-1">
            {themes.slice(0, 3).map((t, i) => (
              <li key={i} className="text-text-secondary text-xs flex gap-2">
                <span className="text-positive shrink-0">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {risks.length > 0 && (
        <div>
          <p className="text-negative text-[10px] uppercase tracking-widest font-semibold mb-1.5">⚠️ Key Risks</p>
          <ul className="space-y-1">
            {risks.slice(0, 3).map((r, i) => (
              <li key={i} className="text-text-secondary text-xs flex gap-2">
                <span className="text-negative shrink-0">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── What to Watch Card ───────────────────────────────────────────────────────

function WhatToWatchCard({
  whatToWatch,
  keyDates,
}: {
  whatToWatch: string[];
  keyDates: KeyDate[];
}) {
  const upcoming = keyDates.slice(0, 4);

  return (
    <div className="bg-card border border-border rounded p-5 h-full">
      <h3 className="text-text-primary font-semibold text-sm mb-3">What to Watch</h3>

      {whatToWatch.length > 0 && (
        <div className="mb-4">
          <ul className="space-y-1.5">
            {whatToWatch.slice(0, 5).map((item, i) => (
              <li key={i} className="text-text-secondary text-xs flex gap-2">
                <span className="text-accent shrink-0">▸</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-text-dim text-[10px] uppercase tracking-widest font-semibold mb-2">Upcoming Key Dates</p>
          <div className="space-y-1.5">
            {upcoming.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-accent font-mono text-[10px] shrink-0 pt-0.5">
                  {new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
                <span className="text-text-secondary leading-snug">{d.event}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {whatToWatch.length === 0 && upcoming.length === 0 && (
        <p className="text-text-dim text-xs italic">No items flagged for today.</p>
      )}
    </div>
  );
}

// ─── Mini Chart (used in fundamentals strip) ──────────────────────────────────

function MiniChart({
  data,
  color,
  unit = '',
}: {
  data: PricePoint[];
  color: string;
  unit?: string;
}) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-xs">
        No data
      </div>
    );
  }
  const first = data[0].value;
  const last = data[data.length - 1].value;
  const pctChange = ((last - first) / first) * 100;
  const color1 = pctChange >= 0 ? '#10b981' : '#ef4444';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-text-primary font-bold text-sm font-mono">
          {last.toFixed(2)}{unit && <span className="text-text-dim text-[10px] ml-1">{unit}</span>}
        </span>
        <span className={`text-[11px] font-mono font-semibold`} style={{ color: color1 }}>
          {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <RechartsTooltip
              contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }}
              labelStyle={{ color: '#8b949e' }}
              formatter={(value) => {
                const v = typeof value === 'number' ? value.toFixed(2) : String(value ?? '');
                return [`${v}${unit}`, ''];
              }}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.8} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Quick Access Bar ─────────────────────────────────────────────────────────

function QuickAccessBar() {
  const links = [
    { to: '/broker/daily', label: '📊 Full Daily Report' },
    { to: '/broker/charts', label: '📈 All Charts' },
    { to: '/broker/products', label: '📁 Products Data' },
    { to: '/broker/research', label: '🔬 Research Engine' },
    { to: '/broker/archive', label: '📚 Archive' },
  ];
  return (
    <div className="bg-card border border-border rounded p-3">
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex-1 min-w-[140px] text-center px-3 py-2 text-xs font-semibold text-text-secondary border border-border rounded hover:border-accent/50 hover:text-accent transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main Overview Page ───────────────────────────────────────────────────────

export default function Overview() {
  const [report, setReport] = useState<Report | null>(null);
  const [gasoil, setGasoil] = useState<ProductReport | null>(null);
  const [biodiesel, setBiodiesel] = useState<Record<string, ProductReport | null>>({});
  const [prices, setPrices] = useState<Record<string, TickerInfo>>({});
  const [eurusd, setEurusd] = useState<{ date: string; rate: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const headers = { 'X-API-Key': API_KEY };

        // Fetch all data in parallel
        const [reportRes, gasoilRes, pricesRes, eurusdRes, ...productRes] = await Promise.all([
          fetch(`${API_BASE_URL}/report/latest`, { headers }),
          fetch(`${API_BASE_URL}/products/G/report/latest`, { headers }),
          fetch(`${API_BASE_URL}/charts/prices?days=60`, { headers }),
          fetch(`${API_BASE_URL}/charts/eurusd?days=60`, { headers }),
          ...BIODIESEL_PRODUCTS.map((p) =>
            fetch(`${API_BASE_URL}/products/${p.code}/report/latest`, { headers })
          ),
        ]);

        if (reportRes.ok) {
          const r = (await reportRes.json()) as Report;
          setReport(r);
        }

        if (gasoilRes.ok) {
          const g = (await gasoilRes.json()) as ProductReport;
          setGasoil(g);
        }

        if (pricesRes.ok) {
          const pj = (await pricesRes.json()) as PricesResponse;
          setPrices(pj.tickers ?? {});
        }

        if (eurusdRes.ok) {
          const ej = (await eurusdRes.json()) as { history: { date: string; rate: number }[] };
          setEurusd(ej.history ?? []);
        }

        const bio: Record<string, ProductReport | null> = {};
        BIODIESEL_PRODUCTS.forEach((p, i) => {
          const res = productRes[i];
          if (res?.ok) {
            void res.json().then((data: ProductReport) => {
              setBiodiesel((prev) => ({ ...prev, [p.code]: data }));
            });
          } else {
            bio[p.code] = null;
          }
        });
        setBiodiesel((prev) => ({ ...bio, ...prev }));
      } finally {
        setLoading(false);
      }
    };
    void loadAll();
  }, []);

  // Compute derived values
  const brentData = prices['BZ=F']?.data ?? [];
  const brentSpot = brentData.length > 0 ? brentData[brentData.length - 1].value : null;
  const brentChange = brentData.length >= 2
    ? ((brentData[brentData.length - 1].value - brentData[brentData.length - 2].value) / brentData[brentData.length - 2].value) * 100
    : null;

  const eurusdSpot = eurusd.length > 0 ? eurusd[eurusd.length - 1].rate : null;
  const eurusdChange = eurusd.length >= 2
    ? ((eurusd[eurusd.length - 1].rate - eurusd[eurusd.length - 2].rate) / eurusd[eurusd.length - 2].rate) * 100
    : null;

  // Feedstock indexed data for the mini charts
  const soyOilData = prices['ZL=F']?.data ?? [];
  const rapeseedData = prices['GNF=F']?.data ?? [];
  const gasoilData = prices['HO=F']?.data ?? [];
  const eurusdChartData: PricePoint[] = eurusd.map((p) => ({ date: p.date, value: p.rate }));

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-5">
      {/* ROW 1 — Market Pulse */}
      <MarketPulseBar
        report={report}
        gasoil={gasoil}
        brentSpot={brentSpot}
        brentChange={brentChange}
        eurusdSpot={eurusdSpot}
        eurusdChange={eurusdChange}
      />

      {/* ROW 2 — Prices + News */}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PriceGrid gasoil={gasoil} biodieselProducts={biodiesel} />
        </div>
        <div className="lg:col-span-2">
          <NewsColumn news={report?.key_news ?? []} />
        </div>
      </div>

      {/* ROW 3 — Outlook + What to Watch */}
      <div className="grid gap-5 md:grid-cols-2">
        <OutlookCard shortTerm={report?.short_term_outlook ?? null} />
        <WhatToWatchCard
          whatToWatch={report?.what_to_watch ?? []}
          keyDates={report?.upcoming_key_dates ?? []}
        />
      </div>

      {/* ROW 4 — Fundamentals Snapshot */}
      <div>
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">
          Market Fundamentals — 60 Day Trend
        </h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <div className="bg-card border border-border rounded p-3 h-32">
            <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Gasoil Proxy (HO)</p>
            <MiniChart data={gasoilData} color="#fbbf24" />
          </div>
          <div className="bg-card border border-border rounded p-3 h-32">
            <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Soybean Oil</p>
            <MiniChart data={soyOilData} color="#e879f9" />
          </div>
          <div className="bg-card border border-border rounded p-3 h-32">
            <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Rapeseed (EUR)</p>
            <MiniChart data={rapeseedData} color="#22d3ee" />
          </div>
          <div className="bg-card border border-border rounded p-3 h-32">
            <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1">EUR/USD</p>
            <MiniChart data={eurusdChartData} color="#a78bfa" />
          </div>
        </div>
      </div>

      {/* ROW 5 — Quick Access */}
      <QuickAccessBar />
    </div>
  );
}
