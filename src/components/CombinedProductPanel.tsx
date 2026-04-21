import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ComposedChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { GasoilReport, CombinedCurveRow, CombinedBarRow } from '../types';
import type { CombinedProductGroup } from '../productConfig';
import { API_BASE_URL, API_KEY } from '../config';
import { findFrontMonthRow } from '../utils/frontMonth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function contractSortKey(contract: string): number {
  const mon = contract.slice(0, 3);
  const yr = parseInt(contract.slice(3), 10);
  return (yr + 2000) * 12 + (MONTHS[mon] ?? 0);
}

/** Max sort key = 12 months from today. Contracts beyond this are excluded from charts. */
function maxContractKey(): number {
  const now = new Date();
  return (now.getFullYear() + 1) * 12 + (now.getMonth() + 1); // +1 year from current month
}

function mergeCurveData(
  diffCurve: { contract: string; settlement: number; change: number }[],
  flatCurve: { contract: string; settlement: number; change: number }[],
): CombinedCurveRow[] {
  const map = new Map<string, CombinedCurveRow>();
  for (const r of diffCurve) {
    map.set(r.contract, { contract: r.contract, diffSettlement: r.settlement });
  }
  for (const r of flatCurve) {
    const existing = map.get(r.contract) ?? { contract: r.contract };
    existing.flatSettlement = r.settlement;
    map.set(r.contract, existing);
  }
  return Array.from(map.values()).sort((a, b) => contractSortKey(a.contract) - contractSortKey(b.contract));
}

function mergeBarData(
  diffData: { contract: string; value: number }[],
  flatData: { contract: string; value: number }[],
): CombinedBarRow[] {
  const map = new Map<string, CombinedBarRow>();
  for (const r of diffData) {
    map.set(r.contract, { contract: r.contract, diffValue: r.value, flatValue: 0, total: r.value });
  }
  for (const r of flatData) {
    const existing = map.get(r.contract) ?? { contract: r.contract, diffValue: 0, flatValue: 0, total: 0 };
    existing.flatValue = r.value;
    existing.total = existing.diffValue + r.value;
    map.set(r.contract, existing);
  }
  return Array.from(map.values())
    .filter((r) => r.total > 0)
    .sort((a, b) => contractSortKey(a.contract) - contractSortKey(b.contract));
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function CombinedTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded px-3 py-2 text-xs shadow-lg">
      <p className="text-text-dim font-semibold mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-bold">
          {entry.name}: {entry.value?.toLocaleString()} $/MT
        </p>
      ))}
    </div>
  );
}

function BarTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded px-3 py-2 text-xs shadow-lg">
      <p className="text-text-dim font-semibold mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-bold">
          {entry.name}: {entry.value?.toLocaleString()} lots
        </p>
      ))}
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded p-4 flex flex-col gap-1">
      <span className="text-text-dim text-xs uppercase tracking-widest">{label}</span>
      <span className="text-text-primary text-xl font-bold font-mono">{value}</span>
      {sub && <span className="text-text-dim text-xs">{sub}</span>}
    </div>
  );
}

// ─── Drop Zone ───────────────────────────────────────────────────────────────

function DropZone({
  onFile, uploading, filename, dropZoneLabel,
}: {
  onFile: (file: File) => void;
  uploading: boolean;
  filename: string | null;
  dropZoneLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type === 'application/pdf') onFile(file);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative cursor-pointer border-2 border-dashed rounded-lg px-4 py-4
        flex items-center gap-3 transition-colors
        ${dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-surface/50'}
      `}
    >
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {uploading ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-text-primary text-xs font-semibold">Parsing PDF...</p>
          </div>
        </>
      ) : (
        <>
          <span className="text-lg shrink-0">📄</span>
          <div>
            <p className="text-text-primary text-xs font-semibold">
              {filename ? `${filename}` : dropZoneLabel}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface CombinedProductPanelProps {
  group: CombinedProductGroup;
  readOnly?: boolean;
  prominentTitle?: boolean;
}

export default function CombinedProductPanel({ group, readOnly = false, prominentTitle = false }: CombinedProductPanelProps) {
  const [diffReport, setDiffReport] = useState<GasoilReport | null>(null);
  const [flatReport, setFlatReport] = useState<GasoilReport | null>(null);
  const [diffUploading, setDiffUploading] = useState(false);
  const [flatUploading, setFlatUploading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [flatError, setFlatError] = useState<string | null>(null);

  // Fetch both reports on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/products/${group.diffCode}/report/latest`, { headers: { 'X-API-Key': API_KEY } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GasoilReport | null) => { if (data) setDiffReport(data); })
      .catch(() => {});

    fetch(`${API_BASE_URL}/products/${group.flatCode}/report/latest`, { headers: { 'X-API-Key': API_KEY } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GasoilReport | null) => { if (data) setFlatReport(data); })
      .catch(() => {});
  }, [group.diffCode, group.flatCode]);

  const handleUpload = async (code: string, file: File, setReport: (r: GasoilReport) => void, setUploading: (b: boolean) => void, setError: (e: string | null) => void) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/products/${code}/report`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(detail.detail ?? `HTTP ${res.status}`);
      }
      const data: GasoilReport = await res.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Merge data for charts ──────────────────────────────────────────────────

  const maxKey = maxContractKey();
  const curveData = mergeCurveData(
    diffReport?.forward_curve ?? [],
    flatReport?.forward_curve ?? [],
  ).filter((r) => contractSortKey(r.contract) <= maxKey);

  const oiData = mergeBarData(
    (diffReport?.oi_curve ?? []).map((r) => ({ contract: r.contract, value: r.oi })),
    (flatReport?.oi_curve ?? []).map((r) => ({ contract: r.contract, value: r.oi })),
  );

  const volumeData = mergeBarData(
    (diffReport?.volume_by_delivery ?? []).map((r) => ({ contract: r.contract, value: r.volume })),
    (flatReport?.volume_by_delivery ?? []).map((r) => ({ contract: r.contract, value: r.volume })),
  );

  const hasData = diffReport || flatReport;
  const diffM1 = findFrontMonthRow(diffReport?.forward_curve, diffReport?.front_month_contract);
  const flatM1 = findFrontMonthRow(flatReport?.forward_curve, flatReport?.front_month_contract);
  const totalVol = (diffReport?.total_volume ?? 0) + (flatReport?.total_volume ?? 0);
  const totalOI = (diffReport?.total_oi ?? 0) + (flatReport?.total_oi ?? 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      {prominentTitle ? (
        <div
          className="pb-2 mb-2 border-b-[3px] flex items-end justify-between"
          style={{ borderColor: group.diffColor }}
        >
          <div>
            <h2 className="font-bold text-2xl uppercase tracking-widest" style={{ color: group.diffColor }}>
              {group.name}
            </h2>
            <p className="text-text-dim text-xs mt-1 uppercase tracking-widest">Diff &amp; Flat Analysis</p>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-text-dim text-xs pb-1">
            {diffReport?.source_filename && <span>Diff: {diffReport.source_filename}</span>}
            {flatReport?.source_filename && <span>Flat: {flatReport.source_filename}</span>}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest">
            {group.name} — Diff &amp; Flat Analysis
          </h2>
          <div className="flex gap-3 text-text-dim text-xs">
            {diffReport?.source_filename && <span>Diff: {diffReport.source_filename}</span>}
            {flatReport?.source_filename && <span>Flat: {flatReport.source_filename}</span>}
          </div>
        </div>
      )}

      {/* Drop Zones — side by side */}
      {!readOnly && (
        <div className="grid grid-cols-2 gap-3">
          <DropZone
            onFile={(f) => handleUpload(group.diffCode, f, setDiffReport, setDiffUploading, setDiffError)}
            uploading={diffUploading}
            filename={diffReport?.source_filename ?? null}
            dropZoneLabel={`Diff (${group.diffCode}) PDF`}
          />
          <DropZone
            onFile={(f) => handleUpload(group.flatCode, f, setFlatReport, setFlatUploading, setFlatError)}
            uploading={flatUploading}
            filename={flatReport?.source_filename ?? null}
            dropZoneLabel={`Flat (${group.flatCode}) PDF`}
          />
        </div>
      )}

      {/* Errors */}
      {!readOnly && diffError && (
        <div className="bg-negative/10 border border-negative/30 rounded px-4 py-2 text-sm text-negative">Diff: {diffError}</div>
      )}
      {!readOnly && flatError && (
        <div className="bg-negative/10 border border-negative/30 rounded px-4 py-2 text-sm text-negative">Flat: {flatError}</div>
      )}

      {hasData && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label={`Diff M1 (${group.diffCode})`}
              value={diffM1 ? `${diffM1.settlement.toLocaleString()} $/MT` : '—'}
              sub={diffM1 ? `${diffM1.contract} · chg ${diffM1.change >= 0 ? '+' : ''}${diffM1.change}` : 'No diff data'}
            />
            <MetricCard
              label={`Flat M1 (${group.flatCode})`}
              value={flatM1 ? `${flatM1.settlement.toLocaleString()} $/MT` : '—'}
              sub={flatM1 ? `${flatM1.contract} · chg ${flatM1.change >= 0 ? '+' : ''}${flatM1.change}` : 'No flat data'}
            />
            <MetricCard
              label="Total Volume"
              value={totalVol.toLocaleString()}
              sub="diff + flat lots"
            />
            <MetricCard
              label="Total Open Interest"
              value={totalOI.toLocaleString()}
              sub="diff + flat lots"
            />
          </div>

          {/* Forward Curve — dual Y-axis */}
          {curveData.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Forward Curves — Diff vs Flat ($/MT)
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={curveData} margin={{ top: 4, right: 12, bottom: 4, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #2a2a3a)" />
                  <XAxis
                    dataKey="contract"
                    tick={{ fontSize: 9, fill: 'var(--color-text-dim, #888)' }}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    yAxisId="diff"
                    orientation="left"
                    tick={{ fontSize: 9, fill: group.diffColor }}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                    tickFormatter={(v: number) => v.toLocaleString()}
                    label={{ value: 'Diff $/MT', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: group.diffColor }, offset: -5 }}
                  />
                  <YAxis
                    yAxisId="flat"
                    orientation="right"
                    tick={{ fontSize: 9, fill: group.flatColor }}
                    tickLine={false}
                    axisLine={false}
                    width={65}
                    tickFormatter={(v: number) => v.toLocaleString()}
                    label={{ value: 'Flat $/MT', angle: 90, position: 'insideRight', style: { fontSize: 9, fill: group.flatColor }, offset: -5 }}
                  />
                  <Tooltip content={<CombinedTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 10 }}
                    formatter={(value: string) => <span className="text-text-dim text-xs">{value}</span>}
                  />
                  {diffReport && (
                    <Line
                      yAxisId="diff"
                      type="monotone"
                      dataKey="diffSettlement"
                      name={`Diff (${group.diffCode})`}
                      stroke={group.diffColor}
                      strokeWidth={2}
                      dot={{ r: 2, fill: group.diffColor }}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  )}
                  {flatReport && (
                    <Line
                      yAxisId="flat"
                      type="monotone"
                      dataKey="flatSettlement"
                      name={`Flat (${group.flatCode})`}
                      stroke={group.flatColor}
                      strokeWidth={2}
                      dot={{ r: 2, fill: group.flatColor }}
                      activeDot={{ r: 4 }}
                      connectNulls
                      strokeDasharray="6 3"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Open Interest — grouped bars */}
          {oiData.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Open Interest by Contract (lots)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={oiData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #2a2a3a)" />
                  <XAxis dataKey="contract" tick={{ fontSize: 9, fill: 'var(--color-text-dim, #888)' }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 9, fill: 'var(--color-text-dim, #888)' }}
                    tickLine={false} axisLine={false} width={55}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                  />
                  <Tooltip content={<BarTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} formatter={(value: string) => <span className="text-text-dim text-xs">{value}</span>} />
                  <Bar dataKey="diffValue" name={`Diff OI (${group.diffCode})`} fill={group.diffColor} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="flatValue" name={`Flat OI (${group.flatCode})`} fill={group.flatColor} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Volume by Delivery — grouped bars */}
          {volumeData.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Volume by Delivery (lots)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volumeData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #2a2a3a)" />
                  <XAxis dataKey="contract" tick={{ fontSize: 9, fill: 'var(--color-text-dim, #888)' }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 9, fill: 'var(--color-text-dim, #888)' }}
                    tickLine={false} axisLine={false} width={55}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                  />
                  <Tooltip content={<BarTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} formatter={(value: string) => <span className="text-text-dim text-xs">{value}</span>} />
                  <Bar dataKey="diffValue" name={`Diff Vol (${group.diffCode})`} fill={group.diffColor} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="flatValue" name={`Flat Vol (${group.flatCode})`} fill={group.flatColor} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!hasData && !diffUploading && !flatUploading && (
        <p className="text-text-dim text-xs text-center py-4">
          {readOnly
            ? `No ${group.name} data yet — upload diff and flat PDFs in the Products Data tab.`
            : `Upload the ICE daily diff (${group.diffCode}) and flat (${group.flatCode}) PDFs to see combined analysis.`}
        </p>
      )}
    </div>
  );
}
