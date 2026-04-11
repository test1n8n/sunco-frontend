import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import type { Report, NewsItem, Outlook, KeyDate, GasoilReport } from '../../types';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import { BIODIESEL_PRODUCTS } from '../../productConfig';
import { scoreNews, sentimentDistribution, sentimentBadgeColor, sentimentArrow } from '../../utils/newsSentiment';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricePoint { date: string; value: number }
interface TickerInfo { name: string; data: PricePoint[] }
interface PricesResponse { tickers: Record<string, TickerInfo> }

interface ProductReport extends GasoilReport {
  product_code?: string;
}

interface PetroleumData {
  inventories: { date: string; value: number }[];
  distillate_stocks: { date: string; value: number }[];
  gasoline_stocks: { date: string; value: number }[];
  jet_fuel_stocks: { date: string; value: number }[];
  refinery_runs: { date: string; value: number }[];
  imports: { date: string; value: number }[];
}

interface EthanolPoint { date: string; production: number }

interface CotEntry {
  report_date: string;
  net_spec: number;
}
interface CotData {
  corn: CotEntry[];
  soybeans: CotEntry[];
  soybean_oil: CotEntry[];
  heating_oil: CotEntry[];
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

// USD/MT conversion factors for CBOT contracts
const USD_MT_FACTORS: Record<string, number> = {
  'ZL=F': 22.0462,   // USc/lb → USD/MT  (Soybean Oil)
  'ZS=F': 0.36744,   // USc/bu → USD/MT  (Soybeans)
  'ZC=F': 0.39368,   // USc/bu → USD/MT  (Corn)
};

function toUsdPerMt(data: PricePoint[], factor: number): PricePoint[] {
  return data.map((p) => ({ date: p.date, value: parseFloat((p.value * factor).toFixed(2)) }));
}

/** Gasoil-Brent crack spread in USD/MT. */
function computeCrackSpread(heatingOil: PricePoint[], brent: PricePoint[]): PricePoint[] {
  if (!heatingOil.length || !brent.length) return [];
  const brentMap = new Map(brent.map((p) => [p.date, p.value]));
  const out: PricePoint[] = [];
  for (const ho of heatingOil) {
    const b = brentMap.get(ho.date);
    if (b == null) continue;
    const hoUsdMt = ho.value * 7.45;
    const brentUsdMt = b * 7.45;
    out.push({ date: ho.date, value: parseFloat((hoUsdMt - brentUsdMt).toFixed(2)) });
  }
  return out;
}

/** Week-over-week % change from weekly time series (latest vs previous point). */
function wowChange(series: { date: string; value: number }[]): number | null {
  if (!series || series.length < 2) return null;
  const last = series[series.length - 1].value;
  const prev = series[series.length - 2].value;
  if (prev === 0) return null;
  return ((last - prev) / prev) * 100;
}

/** Compute the overall trend (% change) over the full series. */
function overallChange(series: PricePoint[]): number | null {
  if (!series || series.length < 2) return null;
  const first = series[0].value;
  const last = series[series.length - 1].value;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
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
  const distribution = useMemo(() => sentimentDistribution(news), [news]);

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
      {news.length > 0 && (
        <div className="px-4 py-2 border-b border-border/50 bg-surface/20 flex items-center gap-3 text-[10px]">
          <span className="text-text-dim uppercase tracking-widest">Tone:</span>
          <span className="text-positive font-semibold">⬆ {distribution.bullish} bullish</span>
          <span className="text-negative font-semibold">⬇ {distribution.bearish} bearish</span>
          <span className="text-text-dim font-semibold">↔ {distribution.neutral} neutral</span>
        </div>
      )}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {topNews.length === 0 ? (
          <p className="text-text-dim text-xs italic text-center py-4">No news available</p>
        ) : (
          topNews.map((item, idx) => {
            const sentiment = scoreNews(item);
            const sentimentColor = sentimentBadgeColor(sentiment);
            return (
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
                      {sentiment !== 'neutral' && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wide font-bold ${sentimentColor}`}>
                          {sentimentArrow(sentiment)} {sentiment}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </a>
            );
          })
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

// ─── Trade Ideas Card (AI-generated) ──────────────────────────────────────────

interface TradeIdea {
  title: string;
  direction: 'long' | 'short' | 'spread';
  products: string[];
  tenor: string;
  rationale: string;
  catalyst: string;
  confidence: 'high' | 'medium' | 'low';
  risk: string;
}

interface TradeIdeasResponse {
  ideas: TradeIdea[];
  generated_at: string;
  based_on_report_date?: string;
}

function TradeIdeasCard() {
  const [ideas, setIdeas] = useState<TradeIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const loadIdeas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/trade-ideas`, {
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as TradeIdeasResponse;
      setIdeas(data.ideas ?? []);
      setGeneratedAt(data.generated_at);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate trade ideas');
    } finally {
      setLoading(false);
    }
  };

  const confColor: Record<string, string> = {
    high: 'text-positive bg-positive/10 border-positive/30',
    medium: 'text-accent bg-accent/10 border-accent/30',
    low: 'text-text-dim bg-surface border-border',
  };
  const dirColor: Record<string, string> = {
    long: 'text-positive bg-positive/10 border-positive/30',
    short: 'text-negative bg-negative/10 border-negative/30',
    spread: 'text-accent bg-accent/10 border-accent/30',
  };

  return (
    <div className="bg-card border border-border rounded p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-text-primary font-semibold text-sm">💡 AI Trade Ideas</h3>
          <p className="text-text-dim text-xs mt-0.5">
            AI-generated from the latest daily report, product settlements, and market context
          </p>
        </div>
        <button
          onClick={loadIdeas}
          disabled={loading}
          className="px-3 py-2 text-xs font-semibold bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors disabled:opacity-40"
        >
          {loading ? '⟳ Generating...' : loaded ? '↻ Regenerate' : '✨ Generate Ideas'}
        </button>
      </div>

      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded px-3 py-2 text-negative text-xs mb-3">
          {error}
        </div>
      )}

      {!loaded && !loading && !error && (
        <div className="text-center py-8 border border-dashed border-border rounded">
          <p className="text-text-dim text-xs">
            Click "Generate Ideas" to get AI-powered trade suggestions based on today's market data.
          </p>
          <p className="text-text-dim text-[10px] mt-1 italic">
            Uses Claude Opus · ~$0.50 per generation · cached for 30 minutes
          </p>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-text-dim text-xs">Analysing market context and generating ideas...</p>
          <p className="text-text-dim text-[10px] mt-1">This takes 20-40 seconds</p>
        </div>
      )}

      {loaded && ideas.length > 0 && (
        <div className="space-y-3">
          {ideas.map((idea, i) => (
            <div key={i} className="border border-border rounded p-4 bg-surface/30 hover:bg-surface/50 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h4 className="text-text-primary font-semibold text-sm flex-1">
                  #{i + 1} · {idea.title}
                </h4>
                <div className="flex gap-1 shrink-0">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${dirColor[idea.direction] ?? dirColor.long}`}>
                    {idea.direction}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${confColor[idea.confidence] ?? confColor.medium}`}>
                    {idea.confidence}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-dim mb-2">
                <span>
                  <span className="text-text-dim">Products:</span>{' '}
                  <span className="text-text-secondary font-mono">{idea.products.join(' · ')}</span>
                </span>
                <span>
                  <span className="text-text-dim">Tenor:</span>{' '}
                  <span className="text-text-secondary font-mono">{idea.tenor}</span>
                </span>
              </div>

              <p className="text-text-secondary text-xs leading-relaxed mb-2">{idea.rationale}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] mt-3 pt-2 border-t border-border/50">
                <div>
                  <span className="text-accent font-semibold">⚡ Catalyst:</span>{' '}
                  <span className="text-text-secondary">{idea.catalyst}</span>
                </div>
                <div>
                  <span className="text-negative font-semibold">⚠ Risk:</span>{' '}
                  <span className="text-text-secondary">{idea.risk}</span>
                </div>
              </div>
            </div>
          ))}
          {generatedAt && (
            <p className="text-text-dim text-[10px] text-center mt-2 italic">
              Generated {new Date(generatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' · '}Cached for 30 minutes
            </p>
          )}
        </div>
      )}

      {loaded && ideas.length === 0 && !error && (
        <p className="text-text-dim text-xs italic text-center py-4">
          No ideas generated. Try again or check that daily report data is available.
        </p>
      )}
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

// ─── Collapsible Section wrapper ──────────────────────────────────────────────

function CollapsibleSection({
  title,
  subtitle,
  icon,
  defaultOpen = true,
  caption,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  defaultOpen?: boolean;
  caption?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-card border border-border rounded hover:border-accent/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-lg">{icon}</span>}
          <div>
            <h2 className="text-text-primary font-semibold text-sm">{title}</h2>
            {subtitle && <p className="text-text-dim text-xs mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <span className={`text-text-dim text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="space-y-3">
          {children}
          {caption && (
            <p className="text-text-dim text-xs italic px-1 leading-relaxed">
              💡 {caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fundamentals Mini Card (reusable for the 3 new sections) ────────────────

function FundCard({
  label,
  data,
  color,
  unit = '',
}: {
  label: string;
  data: PricePoint[];
  color: string;
  unit?: string;
}) {
  return (
    <div className="bg-card border border-border rounded p-3 h-36 flex flex-col">
      <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <div className="flex-1 min-h-0">
        <MiniChart data={data} color={color} unit={unit} />
      </div>
    </div>
  );
}

// ─── Supply vs Demand Balance Panel ───────────────────────────────────────────

interface SupplySignal {
  label: string;
  change: number | null;
  // Direction of bullishness for biofuels: "tight" (supply down = tight = bullish)
  //                                        "loose" (supply up = loose = bearish for biofuels)
  interpretation: 'tight' | 'loose' | 'neutral' | 'unknown';
}

interface DemandSignal {
  label: string;
  change: number | null;
  interpretation: 'strong' | 'weak' | 'neutral' | 'unknown';
}

function interpretSupplyStock(wow: number | null): SupplySignal['interpretation'] {
  if (wow == null) return 'unknown';
  if (wow <= -1) return 'tight';   // stocks falling >1% = tightening
  if (wow >= 1) return 'loose';    // stocks rising >1% = loosening
  return 'neutral';
}

function interpretSupplyPrice(pctChange: number | null): SupplySignal['interpretation'] {
  if (pctChange == null) return 'unknown';
  if (pctChange >= 2) return 'tight';   // feedstock rising = supply pressure
  if (pctChange <= -2) return 'loose';
  return 'neutral';
}

function interpretDemand(wow: number | null, risingIsStrong = true): DemandSignal['interpretation'] {
  if (wow == null) return 'unknown';
  const strong = risingIsStrong ? wow >= 1 : wow <= -1;
  const weak = risingIsStrong ? wow <= -1 : wow >= 1;
  if (strong) return 'strong';
  if (weak) return 'weak';
  return 'neutral';
}

function SupplyDemandPanel({
  petroleum,
  ethanol,
  cot,
  soyOilChange,
  rapeseedChange,
}: {
  petroleum: PetroleumData | null;
  ethanol: EthanolPoint[];
  cot: CotData | null;
  soyOilChange: number | null;
  rapeseedChange: number | null;
}) {
  // Compute supply signals
  const distillateWow = wowChange(petroleum?.distillate_stocks ?? []);
  const crudeWow = wowChange(petroleum?.inventories ?? []);

  const supplySignals: SupplySignal[] = [
    {
      label: 'Distillate stocks (WoW)',
      change: distillateWow,
      interpretation: interpretSupplyStock(distillateWow),
    },
    {
      label: 'Crude inventories (WoW)',
      change: crudeWow,
      interpretation: interpretSupplyStock(crudeWow),
    },
    {
      label: 'Soybean oil price (60d)',
      change: soyOilChange,
      interpretation: interpretSupplyPrice(soyOilChange),
    },
    {
      label: 'Rapeseed price (60d)',
      change: rapeseedChange,
      interpretation: interpretSupplyPrice(rapeseedChange),
    },
  ];

  // Compute demand signals
  const refineryWow = wowChange(petroleum?.refinery_runs ?? []);
  const ethanolSeries = ethanol.map((e) => ({ date: e.date, value: e.production }));
  const ethanolWow = wowChange(ethanolSeries);
  const jetFuelWow = wowChange(petroleum?.jet_fuel_stocks ?? []);
  const heatingOilCot = cot?.heating_oil ?? [];
  const cotLatest = heatingOilCot.length > 0 ? heatingOilCot[heatingOilCot.length - 1]?.net_spec : null;
  const cotPrev = heatingOilCot.length > 1 ? heatingOilCot[heatingOilCot.length - 2]?.net_spec : null;
  const cotChange = cotLatest != null && cotPrev != null && cotPrev !== 0
    ? ((cotLatest - cotPrev) / Math.abs(cotPrev)) * 100
    : null;

  const demandSignals: DemandSignal[] = [
    {
      label: 'Refinery runs (WoW)',
      change: refineryWow,
      interpretation: interpretDemand(refineryWow, true),
    },
    {
      label: 'Ethanol production (WoW)',
      change: ethanolWow,
      interpretation: interpretDemand(ethanolWow, true),
    },
    {
      label: 'Jet fuel stocks (WoW)',
      change: jetFuelWow,
      // Jet fuel stocks FALLING = stronger SAF demand
      interpretation: interpretDemand(jetFuelWow, false),
    },
    {
      label: 'Heating Oil COT (WoW)',
      change: cotChange,
      interpretation: interpretDemand(cotChange, true),
    },
  ];

  // Aggregate overall interpretation
  const tightCount = supplySignals.filter((s) => s.interpretation === 'tight').length;
  const looseCount = supplySignals.filter((s) => s.interpretation === 'loose').length;
  const strongCount = demandSignals.filter((d) => d.interpretation === 'strong').length;
  const weakCount = demandSignals.filter((d) => d.interpretation === 'weak').length;

  const supplyVerdict =
    tightCount > looseCount ? 'TIGHT' :
    looseCount > tightCount ? 'AMPLE' :
    'BALANCED';
  const demandVerdict =
    strongCount > weakCount ? 'STRONG' :
    weakCount > strongCount ? 'WEAK' :
    'STEADY';

  let takeaway = '';
  if (supplyVerdict === 'TIGHT' && demandVerdict === 'STRONG') {
    takeaway = '⬆ BULLISH — Supply is tight while demand is strong. Expect diff compression and upward price pressure across biofuels.';
  } else if (supplyVerdict === 'AMPLE' && demandVerdict === 'WEAK') {
    takeaway = '⬇ BEARISH — Supply is ample and demand is weak. Expect wider diffs and downward price pressure.';
  } else if (supplyVerdict === 'TIGHT' && demandVerdict === 'WEAK') {
    takeaway = '↔ MIXED — Supply is tight but demand is weak. Prices may stabilize; watch for supply catalysts.';
  } else if (supplyVerdict === 'AMPLE' && demandVerdict === 'STRONG') {
    takeaway = '↔ MIXED — Supply is ample and demand is strong. Prices absorbing well; watch for demand acceleration.';
  } else {
    takeaway = `↔ NEUTRAL — Supply ${supplyVerdict.toLowerCase()}, demand ${demandVerdict.toLowerCase()}. No clear directional signal.`;
  }

  const takeawayColor =
    takeaway.startsWith('⬆') ? 'text-positive border-positive/30 bg-positive/5' :
    takeaway.startsWith('⬇') ? 'text-negative border-negative/30 bg-negative/5' :
    'text-accent border-accent/30 bg-accent/5';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {/* SUPPLY column */}
        <div className="bg-card border border-border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-text-primary font-semibold text-sm">📦 Supply Signals</h3>
            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
              supplyVerdict === 'TIGHT' ? 'text-negative border-negative/30 bg-negative/10' :
              supplyVerdict === 'AMPLE' ? 'text-positive border-positive/30 bg-positive/10' :
              'text-text-dim border-border bg-surface'
            }`}>
              {supplyVerdict}
            </span>
          </div>
          <div className="space-y-2">
            {supplySignals.map((s, i) => (
              <SignalRow key={i} label={s.label} change={s.change} interpretation={s.interpretation} />
            ))}
          </div>
        </div>

        {/* DEMAND column */}
        <div className="bg-card border border-border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-text-primary font-semibold text-sm">🔥 Demand Signals</h3>
            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
              demandVerdict === 'STRONG' ? 'text-positive border-positive/30 bg-positive/10' :
              demandVerdict === 'WEAK' ? 'text-negative border-negative/30 bg-negative/10' :
              'text-text-dim border-border bg-surface'
            }`}>
              {demandVerdict}
            </span>
          </div>
          <div className="space-y-2">
            {demandSignals.map((d, i) => (
              <SignalRow key={i} label={d.label} change={d.change} interpretation={d.interpretation} />
            ))}
          </div>
        </div>
      </div>

      {/* Overall takeaway */}
      <div className={`border rounded px-4 py-3 ${takeawayColor}`}>
        <p className="text-xs font-semibold leading-relaxed">{takeaway}</p>
      </div>
    </div>
  );
}

function SignalRow({
  label,
  change,
  interpretation,
}: {
  label: string;
  change: number | null;
  interpretation: 'tight' | 'loose' | 'strong' | 'weak' | 'neutral' | 'unknown';
}) {
  const changeText = change == null
    ? '—'
    : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;

  const labelColor: Record<string, string> = {
    tight: 'text-negative',  // tight supply = bullish for biofuels prices
    loose: 'text-positive',
    strong: 'text-positive',
    weak: 'text-negative',
    neutral: 'text-text-dim',
    unknown: 'text-text-dim',
  };

  const badges: Record<string, string> = {
    tight: 'TIGHT',
    loose: 'AMPLE',
    strong: 'STRONG',
    weak: 'WEAK',
    neutral: '—',
    unknown: 'N/A',
  };

  return (
    <div className="flex items-center justify-between text-xs border-b border-border/30 pb-1.5 last:border-0 last:pb-0">
      <span className="text-text-secondary truncate">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-text-primary">{changeText}</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${labelColor[interpretation]}`}>
          {badges[interpretation]}
        </span>
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
  const [petroleum, setPetroleum] = useState<PetroleumData | null>(null);
  const [ethanol, setEthanol] = useState<EthanolPoint[]>([]);
  const [cot, setCot] = useState<CotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const headers = { 'X-API-Key': API_KEY };

        // Fetch all data in parallel
        const [
          reportRes, gasoilRes, pricesRes, eurusdRes,
          petroleumRes, ethanolRes, cotRes,
          ...productRes
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/report/latest`, { headers }),
          fetch(`${API_BASE_URL}/products/G/report/latest`, { headers }),
          fetch(`${API_BASE_URL}/charts/prices?days=60`, { headers }),
          fetch(`${API_BASE_URL}/charts/eurusd?days=60`, { headers }),
          fetch(`${API_BASE_URL}/charts/petroleum`, { headers }),
          fetch(`${API_BASE_URL}/charts/ethanol`, { headers }),
          fetch(`${API_BASE_URL}/charts/cot`, { headers }),
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

        if (petroleumRes.ok) {
          const pj = (await petroleumRes.json()) as PetroleumData;
          setPetroleum(pj);
        }

        if (ethanolRes.ok) {
          const ej = (await ethanolRes.json()) as { history: EthanolPoint[] };
          setEthanol(ej.history ?? []);
        }

        if (cotRes.ok) {
          const cj = (await cotRes.json()) as CotData;
          setCot(cj);
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

  // Raw price series
  const soyOilRaw = prices['ZL=F']?.data ?? [];
  const soybeansRaw = prices['ZS=F']?.data ?? [];
  const cornRaw = prices['ZC=F']?.data ?? [];
  const rapeseedRaw = prices['GNF=F']?.data ?? [];
  const wtiData = prices['CL=F']?.data ?? [];

  // Converted to USD/MT
  const soyOilData = toUsdPerMt(soyOilRaw, USD_MT_FACTORS['ZL=F']);
  const soybeansData = toUsdPerMt(soybeansRaw, USD_MT_FACTORS['ZS=F']);
  const cornData = toUsdPerMt(cornRaw, USD_MT_FACTORS['ZC=F']);
  // Rapeseed is EUR → convert with latest EUR/USD
  const eurUsdRate = eurusd.length > 0 ? eurusd[eurusd.length - 1].rate : 1.08;
  const rapeseedData: PricePoint[] = rapeseedRaw.map((p) => ({
    date: p.date,
    value: parseFloat((p.value * eurUsdRate).toFixed(2)),
  }));

  // Crack spread
  const crackSpreadData = computeCrackSpread(prices['HO=F']?.data ?? [], brentData);

  // Ethanol production as PricePoint for mini chart
  const ethanolData: PricePoint[] = ethanol.map((e) => ({ date: e.date, value: e.production }));

  // Supply/demand signal inputs — overall % change across the window
  const soyOilOverallChange = overallChange(soyOilData);
  const rapeseedOverallChange = overallChange(rapeseedData);

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

      {/* ROW 3b — AI Trade Ideas (on-demand) */}
      <TradeIdeasCard />

      {/* ROW 4 — Crude Oil & Refining Margins */}
      <CollapsibleSection
        icon="🛢"
        title="Crude Oil & Refining Margins"
        subtitle="Base energy complex — drives gasoil and fossil diesel pricing"
        caption="Crack spread widening = strong diesel demand → bullish for gasoil & biodiesel diffs. Distillate stocks falling = tight physical supply."
      >
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <FundCard label="Brent Crude ($/bbl)" data={brentData} color="#60a5fa" />
          <FundCard label="WTI Crude ($/bbl)" data={wtiData} color="#38bdf8" />
          <FundCard label="Gasoil-Brent Crack ($/MT)" data={crackSpreadData} color="#f87171" />
          <FundCard label="Distillate Stocks (k bbl)" data={petroleum?.distillate_stocks ?? []} color="#fbbf24" />
        </div>
      </CollapsibleSection>

      {/* ROW 5 — Biodiesel Feedstock Prices */}
      <CollapsibleSection
        icon="🌾"
        title="Biodiesel Feedstock Prices"
        subtitle="Drives FAME0, RME, SME, UCOME diffs — supply-side signal"
        caption="Rising feedstocks = wider biodiesel diffs (more expensive to produce). If diffs widen but feedstocks are flat, demand is driving it."
      >
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <FundCard label="Soybean Oil ($/MT)" data={soyOilData} color="#e879f9" />
          <FundCard label="Soybeans ($/MT)" data={soybeansData} color="#34d399" />
          <FundCard label="Rapeseed ($/MT)" data={rapeseedData} color="#22d3ee" />
          <FundCard label="EUR/USD" data={eurusd.map((p) => ({ date: p.date, value: p.rate }))} color="#a78bfa" />
        </div>
      </CollapsibleSection>

      {/* ROW 6 — Advanced Biofuels Feedstocks */}
      <CollapsibleSection
        icon="🛫"
        title="Advanced Biofuels Feedstocks"
        subtitle="Drives HVO, SAF, Ethanol — supply + demand signal"
        caption="Falling jet fuel stocks = strong SAF pull. Rising ethanol production = corn demand. Rising gasoline stocks = weaker ethanol blending demand."
      >
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <FundCard label="Corn ($/MT)" data={cornData} color="#fb923c" />
          <FundCard label="US Ethanol Production" data={ethanolData} color="#10b981" unit=" kbd" />
          <FundCard label="Jet Fuel Stocks (k bbl)" data={petroleum?.jet_fuel_stocks ?? []} color="#06b6d4" />
          <FundCard label="Gasoline Stocks (k bbl)" data={petroleum?.gasoline_stocks ?? []} color="#8b5cf6" />
        </div>
      </CollapsibleSection>

      {/* ROW 7 — Supply vs Demand Balance (interpretation panel) */}
      <CollapsibleSection
        icon="⚖️"
        title="Supply vs Demand Balance"
        subtitle="Quick read on whether diff moves are driven by supply or demand"
      >
        <SupplyDemandPanel
          petroleum={petroleum}
          ethanol={ethanol}
          cot={cot}
          soyOilChange={soyOilOverallChange}
          rapeseedChange={rapeseedOverallChange}
        />
      </CollapsibleSection>

      {/* ROW 8 — Quick Access */}
      <QuickAccessBar />
    </div>
  );
}
