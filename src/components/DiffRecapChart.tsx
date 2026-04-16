import { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { API_BASE_URL, API_KEY } from '../config';

// ─── Colors ──────────────────────────────────────────────────────────────────

const DIFF_COLORS = {
  bri: '#f59e0b',  // RME — amber
  bfz: '#10b981',  // FAME — emerald
  hvo: '#8b5cf6',  // HVO — purple
  ucr: '#ef4444',  // UCOME — red
  sar: '#0891b2',  // SAF — cyan
  oi:  '#1e3a5f',  // OI line — dark navy
};

const FLAT_COLORS = {
  abi: '#f59e0b',  // RME — amber
  fam: '#10b981',  // FAME — emerald
  bda: '#8b5cf6',  // HVO — purple
  bdb: '#ef4444',  // UCOME — red
  zaf: '#0891b2',  // SAF — cyan
  oi:  '#1e3a5f',  // OI line — dark navy
};

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function RecapTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  let dateLabel = label ?? '';
  try {
    const d = new Date(dateLabel + 'T12:00:00Z');
    dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch { /* keep raw */ }

  return (
    <div className="bg-card border border-border rounded px-3 py-2 text-xs shadow-lg min-w-[160px]">
      <p className="text-text-dim font-semibold mb-1.5">{dateLabel}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="text-text-primary font-bold font-mono">{entry.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTick(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return dateStr.slice(5);
  }
}

function formatLots(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
}

// ─── Generic History Chart ───────────────────────────────────────────────────

interface BarDef {
  dataKey: string;
  name: string;
  fill: string;
}

function HistoryChart({
  title, subtitle, data, bars, oiColor,
}: {
  title: string;
  subtitle: string;
  data: Record<string, unknown>[];
  bars: BarDef[];
  oiColor: string;
}) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded p-8 text-center">
        <p className="text-text-dim text-xs">No historical data yet — upload daily PDFs to build the chart.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest">{title}</h2>
        <p className="text-text-dim text-xs mt-0.5">{subtitle}</p>
      </div>
      <div className="bg-card border border-border rounded p-5">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #2a2a3a)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateTick}
              tick={{ fontSize: 9, fill: 'var(--color-text-dim, #888)' }}
              tickLine={false}
              interval={Math.max(0, Math.floor(data.length / 15))}
            />
            <YAxis
              yAxisId="vol" orientation="left"
              tick={{ fontSize: 9, fill: 'var(--color-text-dim, #888)' }}
              tickLine={false} axisLine={false} width={50}
              tickFormatter={formatLots}
              label={{ value: 'Volume (lots)', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'var(--color-text-dim, #888)' }, offset: -5 }}
            />
            <YAxis
              yAxisId="oi" orientation="right"
              tick={{ fontSize: 9, fill: oiColor }}
              tickLine={false} axisLine={false} width={55}
              tickFormatter={formatLots}
              label={{ value: 'OI (lots)', angle: 90, position: 'insideRight', style: { fontSize: 9, fill: oiColor }, offset: -5 }}
            />
            <Tooltip content={<RecapTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
              formatter={(value: string) => <span className="text-text-dim text-xs">{value}</span>}
            />

            {bars.map((bar, i) => (
              <Bar
                key={bar.dataKey}
                yAxisId="vol"
                dataKey={bar.dataKey}
                name={bar.name}
                stackId="vol"
                fill={bar.fill}
                radius={i === bars.length - 1 ? [2, 2, 0, 0] : undefined}
              />
            ))}

            <Line
              yAxisId="oi" type="monotone" dataKey="total_oi" name="OI Aggregated"
              stroke={oiColor} strokeWidth={2} strokeDasharray="6 3"
              dot={{ r: 3, fill: '#fff', stroke: oiColor, strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface DiffRecapChartProps {
  days?: number;
}

export default function DiffRecapChart({ days = 90 }: DiffRecapChartProps) {
  const [diffData, setDiffData] = useState<Record<string, unknown>[]>([]);
  const [flatData, setFlatData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let done = 0;
    const check = () => { done++; if (done >= 2) setLoading(false); };

    fetch(`${API_BASE_URL}/products/diff-history?days=${days}`, { headers: { 'X-API-Key': API_KEY } })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res?.history) setDiffData(res.history); })
      .catch((err) => console.warn('Diff history fetch failed:', err))
      .finally(check);

    fetch(`${API_BASE_URL}/products/flat-history?days=${days}`, { headers: { 'X-API-Key': API_KEY } })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res?.history) setFlatData(res.history); })
      .catch((err) => console.warn('Flat history fetch failed:', err))
      .finally(check);
  }, [days]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded p-8 text-center">
        <span className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-text-dim text-xs mt-2">Loading volume history...</p>
      </div>
    );
  }

  const diffBars: BarDef[] = [
    { dataKey: 'bri_vol', name: 'ICE RME Diff',   fill: DIFF_COLORS.bri },
    { dataKey: 'bfz_vol', name: 'ICE FAME Diff',  fill: DIFF_COLORS.bfz },
    { dataKey: 'hvo_vol', name: 'ICE HVO Diff',   fill: DIFF_COLORS.hvo },
    { dataKey: 'ucr_vol', name: 'ICE UCOME Diff', fill: DIFF_COLORS.ucr },
    { dataKey: 'sar_vol', name: 'ICE SAF Diff',   fill: DIFF_COLORS.sar },
  ];

  const flatBars: BarDef[] = [
    { dataKey: 'abi_vol', name: 'ICE RME Flat',   fill: FLAT_COLORS.abi },
    { dataKey: 'fam_vol', name: 'ICE FAME Flat',  fill: FLAT_COLORS.fam },
    { dataKey: 'bda_vol', name: 'ICE HVO Flat',   fill: FLAT_COLORS.bda },
    { dataKey: 'bdb_vol', name: 'ICE UCOME Flat', fill: FLAT_COLORS.bdb },
    { dataKey: 'zaf_vol', name: 'ICE SAF Flat',   fill: FLAT_COLORS.zaf },
  ];

  return (
    <div className="space-y-6">
      <HistoryChart
        title="ICE Biodiesel Diff Volumes vs OI Aggregated"
        subtitle={`Daily stacked volume by product · OI line overlay · Last ${days} days`}
        data={diffData}
        bars={diffBars}
        oiColor={DIFF_COLORS.oi}
      />

      <HistoryChart
        title="ICE Biodiesel Outright Volumes vs OI Aggregated"
        subtitle={`Daily stacked volume by product · OI line overlay · Last ${days} days`}
        data={flatData}
        bars={flatBars}
        oiColor={FLAT_COLORS.oi}
      />
    </div>
  );
}
