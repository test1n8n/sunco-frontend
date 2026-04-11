import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { Report, NewsItem, KeyDate } from '../../types';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import {
  MANDATES, COUNTRY_ORDER, RED_III_BASELINE,
  computeMandateProgress, getTrajectoryForYear,
  type CountryCode, type Mandate,
} from '../../data/mandates';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResearchListItem {
  research_id: string;
  brief: string;
  status: string;
  country_code: string;
  report_title: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  });
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (24 * 3600 * 1000));
}

// Keywords that tag news/dates as regulatory vs geopolitical
const REGULATORY_KEYWORDS = [
  'RED III', 'RED II', 'RED IV', 'Fit for 55', 'ETS2', 'TIRUERT', 'THG-Quote',
  'RTFO', 'RTFC', 'HBE', 'ERE', 'PPE', 'BImSchG', 'CIC', 'mandate', 'blending',
  'obligation', 'compliance', 'deadline', 'directive', 'regulation', 'transposition',
  'ReFuelEU', 'SAF mandate', 'buy-out', 'penalty', 'double-counting',
];

function isRegulatoryNews(item: NewsItem): boolean {
  if (item.product_category === 'general') return true;
  const txt = item.headline.toLowerCase();
  return REGULATORY_KEYWORDS.some((k) => txt.includes(k.toLowerCase()));
}

function newsCountryMatch(item: NewsItem, country: CountryCode): boolean {
  const name = MANDATES[country].country_name.toLowerCase();
  const alt: Record<CountryCode, string[]> = {
    UK: ['uk', 'britain', 'british', 'england'],
    DE: ['germany', 'german'],
    FR: ['france', 'french'],
    NL: ['netherlands', 'dutch', 'holland'],
    ES: ['spain', 'spanish'],
    IT: ['italy', 'italian'],
  };
  const needles = [name, ...alt[country]];
  const txt = item.headline.toLowerCase();
  return needles.some((n) => txt.includes(n));
}

// ─── Compliance Progress Bar ──────────────────────────────────────────────────

function MandateProgressBar({ mandate }: { mandate: Mandate }) {
  const { pct, daysElapsed, daysRemaining, periodEnd } = computeMandateProgress(mandate);
  const barColor = pct >= 90 ? 'bg-negative' : pct >= 60 ? 'bg-accent' : 'bg-positive';
  const textColor = pct >= 90 ? 'text-negative' : pct >= 60 ? 'text-accent' : 'text-positive';

  const currentYear = new Date().getFullYear();
  const trajectory = getTrajectoryForYear(mandate, currentYear);

  return (
    <div className="border border-border/50 rounded p-3 bg-surface/30">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{mandate.flag}</span>
            <span className="text-text-primary text-sm font-semibold truncate">
              {mandate.country_name} — {mandate.scheme_name}
            </span>
          </div>
          <p className="text-text-dim text-[10px] mt-0.5">
            Target: <span className="text-text-secondary font-mono">{trajectory?.overall.toFixed(2)}%</span>
            {trajectory && trajectory.advanced > 0 && (
              <> · Advanced: <span className="text-text-secondary font-mono">{trajectory.advanced.toFixed(2)}%</span></>
            )}
          </p>
        </div>
        <span className={`text-xs font-bold font-mono ${textColor}`}>{pct}%</span>
      </div>
      <div className="w-full bg-border/40 rounded-full h-2 mb-2">
        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-text-dim">
        <span>{daysElapsed}d elapsed</span>
        <span>{daysRemaining}d remaining</span>
        <span>ends {fmtShortDate(periodEnd.toISOString())}</span>
      </div>
    </div>
  );
}

// ─── Country Chip ─────────────────────────────────────────────────────────────

function CountryChip({
  mandate,
  active,
  onClick,
}: {
  mandate: Mandate;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded border transition-colors ${
        active
          ? 'bg-accent/10 border-accent text-accent'
          : 'bg-card border-border text-text-secondary hover:border-accent/40 hover:text-text-primary'
      }`}
    >
      <span className="text-xl">{mandate.flag}</span>
      <div className="text-left">
        <div className="text-sm font-semibold">{mandate.country_name}</div>
        <div className="text-[10px] text-text-dim">{mandate.scheme_name}</div>
      </div>
    </button>
  );
}

// ─── Country Hero Card ────────────────────────────────────────────────────────

function CountryHero({ mandate }: { mandate: Mandate }) {
  const currentYear = new Date().getFullYear();
  const currentTrajectory = getTrajectoryForYear(mandate, currentYear);

  const schemeTypeBadge: Record<string, { label: string; color: string }> = {
    certificate: { label: 'Certificate-Based', color: 'text-positive border-positive/30 bg-positive/10' },
    tax: { label: 'Tax-Based', color: 'text-accent border-accent/30 bg-accent/10' },
    ghg: { label: 'GHG-Reduction', color: 'text-negative border-negative/30 bg-negative/10' },
    hybrid: { label: 'Hybrid', color: 'text-text-dim border-border bg-surface' },
  };
  const typeBadge = schemeTypeBadge[mandate.scheme_type];

  return (
    <div className="bg-card border border-border rounded p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">{mandate.flag}</span>
            <div>
              <h1 className="text-text-primary text-xl font-bold">{mandate.country_name}</h1>
              <p className="text-text-dim text-xs mt-0.5">{mandate.scheme_full_name}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${typeBadge.color}`}>
            {typeBadge.label}
          </span>
          <span className="text-text-dim text-[10px]">
            Updated {fmtDate(mandate.last_updated)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-surface border border-border rounded px-3 py-2">
          <div className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Current Target ({currentYear})</div>
          <div className="font-mono font-bold text-lg text-text-primary">
            {currentTrajectory ? `${currentTrajectory.overall.toFixed(2)}%` : '—'}
          </div>
        </div>
        <div className="bg-surface border border-border rounded px-3 py-2">
          <div className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Advanced Sub-Target</div>
          <div className="font-mono font-bold text-lg text-text-primary">
            {currentTrajectory && currentTrajectory.advanced > 0 ? `${currentTrajectory.advanced.toFixed(2)}%` : '—'}
          </div>
        </div>
        <div className="bg-surface border border-border rounded px-3 py-2">
          <div className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Penalty</div>
          <div className="font-mono font-bold text-lg text-text-primary">
            {mandate.penalty.amount > 0 ? `${mandate.penalty.amount} ${mandate.penalty.unit}` : '—'}
          </div>
        </div>
        <div className="bg-surface border border-border rounded px-3 py-2">
          <div className="text-text-dim text-[10px] uppercase tracking-widest mb-1">Compliance Deadline</div>
          <div className="font-mono font-bold text-sm text-text-primary">
            {mandate.compliance_deadline}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-text-secondary mb-3">
        <div>
          <span className="text-text-dim">Regulator:</span> {mandate.regulator}
        </div>
        <div>
          <span className="text-text-dim">Registry:</span> {mandate.registry}
        </div>
        <div>
          <span className="text-text-dim">Double-counting:</span>{' '}
          <span className="capitalize">{mandate.double_counting}</span>
        </div>
        <div>
          <span className="text-text-dim">Cross-border:</span>{' '}
          {mandate.cross_border_accepted ? 'Accepted' : 'Not accepted'}
        </div>
      </div>

      <a
        href={mandate.official_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent text-xs hover:underline"
      >
        🔗 Official source →
      </a>
    </div>
  );
}

// ─── Mandate Trajectory Chart ─────────────────────────────────────────────────

function TrajectoryChart({ mandate }: { mandate: Mandate }) {
  const data = useMemo(() => {
    // Merge mandate trajectory with RED III baseline by year
    const years = new Set<number>();
    mandate.trajectory.forEach((p) => years.add(p.year));
    RED_III_BASELINE.forEach((p) => years.add(p.year));

    return Array.from(years)
      .sort((a, b) => a - b)
      .map((year) => {
        const m = mandate.trajectory.find((p) => p.year === year);
        const b = RED_III_BASELINE.find((p) => p.year === year);
        return {
          year,
          country_overall: m?.overall ?? null,
          country_advanced: m?.advanced ?? null,
          red3_baseline: b?.overall ?? null,
        };
      });
  }, [mandate]);

  return (
    <div className="bg-card border border-border rounded p-4">
      <h3 className="text-text-primary font-semibold text-sm mb-3">
        Mandate Trajectory — {mandate.country_name}
      </h3>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
              width={40}
            />
            <Tooltip
              contentStyle={{ background: '#0d1117', border: '1px solid #1c2333', borderRadius: 4, fontSize: 11 }}
              labelStyle={{ color: '#8b949e' }}
              formatter={(value) => {
                const v = typeof value === 'number' ? `${value.toFixed(2)}%` : String(value ?? '—');
                return [v, ''];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 6 }} />
            <Line
              type="monotone"
              dataKey="country_overall"
              name={`${mandate.scheme_name} — Overall`}
              stroke="#60a5fa"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="country_advanced"
              name={`${mandate.scheme_name} — Advanced`}
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 2 }}
              strokeDasharray="4 2"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="red3_baseline"
              name="EU RED III Baseline"
              stroke="#a78bfa"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="6 4"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Key Notes Card ───────────────────────────────────────────────────────────

function KeyNotesCard({ mandate }: { mandate: Mandate }) {
  return (
    <div className="bg-card border border-border rounded p-5">
      <h3 className="text-text-primary font-semibold text-sm mb-3">Key Notes — {mandate.country_name}</h3>
      <ul className="space-y-2">
        {mandate.key_notes.map((note, i) => (
          <li key={i} className="text-text-secondary text-xs flex gap-2">
            <span className="text-accent shrink-0">▸</span>
            <span className="leading-relaxed">{note}</span>
          </li>
        ))}
      </ul>
      {mandate.penalty.note && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-text-dim text-[10px] uppercase tracking-widest font-semibold mb-1">Penalty Details</p>
          <p className="text-text-secondary text-xs leading-relaxed">{mandate.penalty.note}</p>
        </div>
      )}
    </div>
  );
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

function ComparisonTable({
  selectedYear,
  onCountryClick,
}: {
  selectedYear: number;
  onCountryClick: (code: CountryCode) => void;
}) {
  return (
    <div className="bg-card border border-border rounded overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-text-primary font-semibold text-sm">All Countries — {selectedYear} Comparison</h3>
        <p className="text-text-dim text-xs mt-0.5">Click a country row to view full details</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Country</th>
              <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest">Scheme</th>
              <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Overall</th>
              <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Advanced</th>
              <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Crop Cap</th>
              <th className="px-3 py-2 text-right text-text-dim text-[10px] font-semibold uppercase tracking-widest">Penalty</th>
              <th className="px-3 py-2 text-left text-text-dim text-[10px] font-semibold uppercase tracking-widest hidden lg:table-cell">Dbl-Count</th>
            </tr>
          </thead>
          <tbody>
            {COUNTRY_ORDER.map((code) => {
              const m = MANDATES[code];
              const t = getTrajectoryForYear(m, selectedYear);
              const dblColor: Record<string, string> = {
                yes: 'text-positive',
                no: 'text-negative',
                abolishing: 'text-accent',
                transitioning: 'text-accent',
              };
              return (
                <tr
                  key={code}
                  onClick={() => onCountryClick(code)}
                  className="border-b border-border/50 hover:bg-surface/50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{m.flag}</span>
                      <span className="text-text-primary font-semibold">{m.country_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary">{m.scheme_name}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-primary font-bold">
                    {t ? `${t.overall.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-primary">
                    {t && t.advanced > 0 ? `${t.advanced.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-secondary hidden md:table-cell">
                    {t?.crop_cap != null ? `${t.crop_cap.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-secondary">
                    {m.penalty.amount > 0 ? `${m.penalty.amount} ${m.penalty.unit}` : '—'}
                  </td>
                  <td className={`px-3 py-2.5 capitalize hidden lg:table-cell ${dblColor[m.double_counting] ?? 'text-text-dim'}`}>
                    {m.double_counting}
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

// ─── Regulatory News Panel ────────────────────────────────────────────────────

function RegulatoryNewsPanel({
  news,
  selectedCountry,
}: {
  news: NewsItem[];
  selectedCountry: CountryCode;
}) {
  const filtered = useMemo(() => {
    const regulatory = news.filter(isRegulatoryNews);
    // Prioritize country matches, then regulatory in general
    const countryMatches = regulatory.filter((n) => newsCountryMatch(n, selectedCountry));
    const others = regulatory.filter((n) => !newsCountryMatch(n, selectedCountry));
    return [...countryMatches, ...others].slice(0, 6);
  }, [news, selectedCountry]);

  return (
    <div className="bg-card border border-border rounded p-4 h-full">
      <h3 className="text-text-primary font-semibold text-sm mb-3">📰 Regulatory News</h3>
      {filtered.length === 0 ? (
        <p className="text-text-dim text-xs italic">No regulatory news in the latest report.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((n, i) => {
            const isCountryMatch = newsCountryMatch(n, selectedCountry);
            return (
              <a
                key={i}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block border rounded p-2.5 hover:border-accent/50 transition-colors text-xs ${
                  isCountryMatch ? 'border-accent/40 bg-accent/5' : 'border-border bg-surface/30'
                }`}
              >
                <p className="text-text-primary font-semibold leading-snug mb-1">{n.headline}</p>
                <div className="flex items-center gap-2">
                  <span className="text-text-dim text-[10px]">{n.source}</span>
                  {isCountryMatch && (
                    <span className="text-accent text-[9px] font-bold uppercase">
                      {MANDATES[selectedCountry].flag} relevant
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Upcoming Deadlines Panel ─────────────────────────────────────────────────

function UpcomingDeadlinesPanel({ keyDates }: { keyDates: KeyDate[] }) {
  const now = new Date();
  const upcoming = useMemo(() => {
    return [...keyDates]
      .filter((d) => new Date(d.date).getTime() >= now.getTime() - 24 * 3600 * 1000)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [keyDates, now]);

  return (
    <div className="bg-card border border-border rounded p-4 h-full">
      <h3 className="text-text-primary font-semibold text-sm mb-3">📅 Upcoming Deadlines</h3>
      {upcoming.length === 0 ? (
        <p className="text-text-dim text-xs italic">No upcoming dates flagged.</p>
      ) : (
        <div className="space-y-2.5">
          {upcoming.map((d, i) => {
            const days = daysBetween(now, new Date(d.date));
            const urgent = days <= 7;
            return (
              <div key={i} className="flex items-start gap-3 text-xs border-b border-border/30 pb-2 last:border-0 last:pb-0">
                <div className="shrink-0 text-center">
                  <div className={`text-[10px] font-mono font-bold ${urgent ? 'text-negative' : 'text-accent'}`}>
                    {days}d
                  </div>
                  <div className="text-text-dim text-[9px]">{fmtShortDate(d.date)}</div>
                </div>
                <p className="text-text-secondary leading-snug flex-1">{d.event}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Geopolitical News Panel ──────────────────────────────────────────────────

function GeopoliticalPanel({ news }: { news: NewsItem[] }) {
  const GEO_KEYWORDS = [
    'tariff', 'trade', 'war', 'sanction', 'embargo', 'export ban', 'import',
    'China', 'Russia', 'Ukraine', 'Middle East', 'OPEC', 'tanker', 'freight',
    'pipeline', 'disruption', 'supply chain', 'weather', 'drought', 'flood',
  ];
  const filtered = useMemo(() => {
    return news.filter((n) => {
      const txt = n.headline.toLowerCase();
      return GEO_KEYWORDS.some((k) => txt.includes(k.toLowerCase())) || n.relevance === 'high';
    }).filter((n) => !isRegulatoryNews(n)).slice(0, 6);
  }, [news]);

  return (
    <div className="bg-card border border-border rounded p-4">
      <h3 className="text-text-primary font-semibold text-sm mb-3">🌍 Geopolitical &amp; Market Impact</h3>
      {filtered.length === 0 ? (
        <p className="text-text-dim text-xs italic">No geopolitical or market-moving news in the latest report.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map((n, i) => (
            <a
              key={i}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-border rounded p-3 hover:border-accent/50 transition-colors text-xs bg-surface/30"
            >
              <p className="text-text-primary font-semibold leading-snug mb-1">{n.headline}</p>
              <div className="flex items-center gap-2">
                <span className="text-text-dim text-[10px]">{n.source}</span>
                {n.price_impact && (
                  <span className="text-text-dim text-[10px] italic truncate">{n.price_impact}</span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Research Engine Integration ──────────────────────────────────────────────

function ResearchPanel({
  researchList,
  selectedCountry,
}: {
  researchList: ResearchListItem[];
  selectedCountry: CountryCode;
}) {
  const mandate = MANDATES[selectedCountry];
  const filtered = researchList.filter((r) => r.country_code === selectedCountry);

  return (
    <div className="bg-card border border-border rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-primary font-semibold text-sm">🔬 Deep Research — {mandate.country_name}</h3>
        <Link
          to="/broker/research"
          className="text-accent text-xs font-semibold hover:underline"
        >
          Generate fresh research →
        </Link>
      </div>
      {filtered.length === 0 ? (
        <p className="text-text-dim text-xs italic">
          No past research reports on {mandate.country_name}. Click "Generate fresh research" above to produce one.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 5).map((r) => (
            <Link
              key={r.research_id}
              to="/broker/research"
              className="block border border-border rounded p-3 hover:border-accent/50 transition-colors bg-surface/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary text-xs font-semibold leading-snug mb-1 truncate">
                    {r.report_title || r.brief.slice(0, 80) + '...'}
                  </p>
                  <p className="text-text-dim text-[10px]">
                    {fmtDate(r.created_at)} · {r.status}
                  </p>
                </div>
                <span className="text-accent text-xs shrink-0">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── All Countries Progress Overview ──────────────────────────────────────────

function AllCountriesProgress() {
  return (
    <div className="bg-card border border-border rounded p-4">
      <h3 className="text-text-primary font-semibold text-sm mb-3">⏱ Obligation Period Progress (All Countries)</h3>
      <p className="text-text-dim text-xs mb-3">
        Shows how much of each country's current obligation year has elapsed. Time pressure on obligated parties
        builds as the bars approach 100% — historically diffs spike in the last quarter.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {COUNTRY_ORDER.map((code) => (
          <MandateProgressBar key={code} mandate={MANDATES[code]} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Mandates Page ───────────────────────────────────────────────────────

export default function Mandates() {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('DE');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [view, setView] = useState<'detail' | 'compare'>('detail');
  const [report, setReport] = useState<Report | null>(null);
  const [researchList, setResearchList] = useState<ResearchListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const headers = { 'X-API-Key': API_KEY };
        const [reportRes, researchRes] = await Promise.all([
          fetch(`${API_BASE_URL}/report/latest`, { headers }),
          fetch(`${API_BASE_URL}/research/list/all`, { headers }),
        ]);
        if (reportRes.ok) {
          const r = (await reportRes.json()) as Report;
          setReport(r);
        }
        if (researchRes.ok) {
          const data = (await researchRes.json()) as ResearchListItem[];
          setResearchList(data);
        }
      } finally {
        setLoading(false);
      }
    };
    void loadAll();
  }, []);

  const mandate = MANDATES[selectedCountry];

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const yearOptions = [2024, 2025, 2026, 2027, 2028, 2030, 2035];

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Biofuel Mandates</p>
        <h1 className="text-text-primary font-semibold text-base">EU Blending Obligations &amp; Demand Drivers</h1>
        <p className="text-text-dim text-xs mt-1">
          Current regulatory targets, trajectory through 2035, and real-time news driving demand
        </p>
      </div>

      {/* Country selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {COUNTRY_ORDER.map((code) => (
            <CountryChip
              key={code}
              mandate={MANDATES[code]}
              active={selectedCountry === code && view === 'detail'}
              onClick={() => {
                setSelectedCountry(code);
                setView('detail');
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === 'detail' ? 'compare' : 'detail')}
            className={`px-3 py-2 rounded text-xs font-semibold border transition-colors ${
              view === 'compare'
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-card border-border text-text-secondary hover:border-accent/40'
            }`}
          >
            {view === 'compare' ? '← Back to detail' : '📊 Compare all'}
          </button>
        </div>
      </div>

      {view === 'detail' ? (
        <>
          {/* Country Hero */}
          <CountryHero mandate={mandate} />

          {/* Trajectory + Key Notes */}
          <div className="grid gap-5 md:grid-cols-5">
            <div className="md:col-span-3">
              <TrajectoryChart mandate={mandate} />
            </div>
            <div className="md:col-span-2">
              <KeyNotesCard mandate={mandate} />
            </div>
          </div>

          {/* News + Deadlines */}
          <div className="grid gap-5 md:grid-cols-2">
            <RegulatoryNewsPanel news={report?.key_news ?? []} selectedCountry={selectedCountry} />
            <UpcomingDeadlinesPanel keyDates={report?.upcoming_key_dates ?? []} />
          </div>

          {/* Geopolitical */}
          <GeopoliticalPanel news={report?.key_news ?? []} />

          {/* Research Engine Integration */}
          <ResearchPanel researchList={researchList} selectedCountry={selectedCountry} />

          {/* Progress Bars */}
          <AllCountriesProgress />
        </>
      ) : (
        <>
          {/* Year selector */}
          <div className="flex items-center gap-3">
            <span className="text-text-dim text-xs uppercase tracking-widest">Compare year:</span>
            <div className="flex gap-2">
              {yearOptions.map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                    selectedYear === y
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-card border-border text-text-secondary hover:border-accent/40'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Comparison Table */}
          <ComparisonTable
            selectedYear={selectedYear}
            onCountryClick={(code) => {
              setSelectedCountry(code);
              setView('detail');
            }}
          />

          {/* Progress Bars */}
          <AllCountriesProgress />

          {/* Geopolitical */}
          <GeopoliticalPanel news={report?.key_news ?? []} />
        </>
      )}
    </div>
  );
}
