import { useEffect, useState } from 'react';
import { API_BASE_URL, API_KEY } from '../config';

/**
 * FlowSnapshot — a short narrative summary of today's biodiesel trades.
 *
 * One line per product that had activity today, generated from the same
 * /products/biodiesel-trades/latest endpoint the panel uses. Narrative
 * style: "UCOME — 164 lots. Most active. Jun26 dominant (74 lots). ..."
 *
 * Pure presentation. No backend changes.
 */

interface RecapRow {
  product: string;
  delivery: string;
  total_lots: number;
  num_trades: number;
  high_diff: number | null;
  low_diff: number | null;
  flat_price_high: number | null;
  flat_price_low: number | null;
}

interface TimeSpread {
  spread_id: string;
  product: string;
  leg1: string;
  leg1_price: number;
  leg2: string;
  leg2_price: number;
  spread_value: number;
  lots: number;
  time: string;
}

interface ProductSpread {
  spread_id: string;
  delivery: string;
  legs: { product: string; delivery: string; price: number; lots: number }[];
  lots: number;
  time: string;
}

interface BiodieselTradeReport {
  recap_by_delivery: RecapRow[];
  spreads_analysis: {
    time_spreads: TimeSpread[];
    product_spreads: ProductSpread[];
    flat_time_spreads?: TimeSpread[];
  };
  total_trades: number;
}

const PRODUCT_COLORS: Record<string, string> = {
  FAME0: '#10b981',
  RME: '#f59e0b',
  UCOME: '#ef4444',
  HVO: '#8b5cf6',
  SAF: '#06b6d4',
};

interface ProductLine {
  product: string;
  totalLots: number;
  sentences: string[];
}

function fmtSpread(v: number): string {
  return v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
}

/** Build one narrative line per product that traded today. */
function buildSnapshot(report: BiodieselTradeReport): ProductLine[] {
  const recap = report.recap_by_delivery ?? [];
  const timeSpreads = report.spreads_analysis?.time_spreads ?? [];
  const productSpreads = report.spreads_analysis?.product_spreads ?? [];
  const flatTimeSpreads = report.spreads_analysis?.flat_time_spreads ?? [];

  // Collect every product that appears anywhere
  const allProducts = new Set<string>();
  for (const r of recap) allProducts.add(r.product);
  for (const s of timeSpreads) allProducts.add(s.product);
  for (const s of flatTimeSpreads) allProducts.add(s.product);
  for (const ps of productSpreads) for (const l of ps.legs) allProducts.add(l.product);

  const lines: ProductLine[] = [];

  for (const product of allProducts) {
    // Product's diff outright activity
    const pRecap = recap.filter(r => r.product === product);
    const diffLots = pRecap.reduce((s, r) => s + r.total_lots, 0);

    // Time spreads for this product
    const pTimeSpreads = timeSpreads.filter(s => s.product === product);
    const timeLots = pTimeSpreads.reduce((s, x) => s + x.lots, 0);

    // Flat time spreads
    const pFlatSpreads = flatTimeSpreads.filter(s => s.product === product);
    const flatSpreadLots = pFlatSpreads.reduce((s, x) => s + x.lots, 0);

    // Product spreads involving this product (sum contribution = lots on that leg)
    const pProductSpreadLots = productSpreads.reduce((s, ps) => {
      const hit = ps.legs.some(l => l.product === product);
      return s + (hit ? ps.lots : 0);
    }, 0);

    const totalLots = diffLots + timeLots + flatSpreadLots + pProductSpreadLots;
    if (totalLots === 0) continue;

    const sentences: string[] = [];

    // Dominant delivery from recap + any other diff activity context
    if (pRecap.length > 0) {
      const sorted = [...pRecap].sort((a, b) => b.total_lots - a.total_lots);
      const top = sorted[0];
      sentences.push(`${top.delivery} dominant (${top.total_lots} lots)`);
      if (sorted.length > 1) {
        const others = sorted.slice(1).map(r => `${r.delivery} ${r.total_lots}`).join(', ');
        sentences.push(`also ${others}`);
      }
    }

    // Biggest time spread for this product
    if (pTimeSpreads.length > 0) {
      const biggest = [...pTimeSpreads].sort((a, b) => b.lots - a.lots)[0];
      const uniquePairs = new Set(pTimeSpreads.map(s => `${s.leg1}/${s.leg2}`)).size;
      if (pTimeSpreads.length === 1) {
        sentences.push(`${biggest.lots}-lot ${biggest.leg1}/${biggest.leg2} spread @ ${fmtSpread(biggest.spread_value)}`);
      } else if (uniquePairs === 1) {
        // Same spread traded multiple times — give range
        const vals = pTimeSpreads.map(s => s.spread_value);
        const hi = Math.max(...vals);
        const lo = Math.min(...vals);
        const totalSpread = pTimeSpreads.reduce((s, x) => s + x.lots, 0);
        sentences.push(
          `${pTimeSpreads.length}× ${biggest.leg1}/${biggest.leg2} spread (${totalSpread} lots, ${fmtSpread(lo)} to ${fmtSpread(hi)})`
        );
      } else {
        sentences.push(
          `${pTimeSpreads.length} time spreads (${timeLots} lots, biggest ${biggest.leg1}/${biggest.leg2} @ ${fmtSpread(biggest.spread_value)})`
        );
      }
    }

    // Flat time spreads
    if (pFlatSpreads.length > 0) {
      const biggest = [...pFlatSpreads].sort((a, b) => b.lots - a.lots)[0];
      sentences.push(
        `flat spread ${biggest.leg1}/${biggest.leg2} @ ${fmtSpread(biggest.spread_value)} (${biggest.lots} lots)`
      );
    }

    // Product spreads
    const involvingPS = productSpreads.filter(ps => ps.legs.some(l => l.product === product));
    if (involvingPS.length > 0) {
      const ps = involvingPS[0];
      const others = ps.legs.filter(l => l.product !== product).map(l => l.product).join('/');
      if (others) {
        sentences.push(`product spread vs ${others} ${ps.delivery} (${ps.lots} lots)`);
      }
    }

    lines.push({ product, totalLots, sentences });
  }

  // Sort product order by total lots descending
  lines.sort((a, b) => b.totalLots - a.totalLots);
  return lines;
}

interface Props {
  /** If true, render normally in print. If false, hide in all PDFs. */
  printable?: boolean;
}

export default function FlowSnapshot({ printable = true }: Props) {
  const [report, setReport] = useState<BiodieselTradeReport | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/products/biodiesel-trades/latest`, {
      headers: { 'X-API-Key': API_KEY },
    })
      .then(r => (r.ok ? r.json() : null))
      .then((data: BiodieselTradeReport | null) => { if (data) setReport(data); })
      .catch(() => {});
  }, []);

  if (!report) return null;
  const lines = buildSnapshot(report);
  if (lines.length === 0) return null;

  const wrapperProps = printable ? {} : { 'data-print-hide': true };

  return (
    <div
      {...wrapperProps}
      className="bg-card border border-border border-l-4 border-l-accent rounded p-5"
    >
      <div className="pb-2 mb-2 border-b-2 border-accent/60">
        <h3 className="text-text-primary font-bold text-base uppercase tracking-widest">
          Flow Snapshot
        </h3>
        <p className="text-text-dim text-xs mt-0.5">Today's biodiesel flow at a glance</p>
      </div>
      <ul className="space-y-2 mt-3">
        {lines.map(line => {
          const color = PRODUCT_COLORS[line.product] ?? '#888';
          return (
            <li key={line.product} className="flex items-start gap-2 text-sm">
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0 mt-1.5"
                style={{ backgroundColor: color }}
              />
              <span className="text-text-primary">
                <span className="font-bold" style={{ color }}>{line.product}</span>
                {' — '}
                <span>{line.totalLots} lots.</span>
                {line.sentences.length > 0 && (
                  <>
                    {' '}
                    <span className="text-text-secondary">
                      {line.sentences.join('. ')}.
                    </span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
