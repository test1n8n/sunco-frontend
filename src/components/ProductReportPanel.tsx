import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { GasoilReport } from '../types';
import { API_BASE_URL, API_KEY } from '../config';
import { findFrontMonthRow } from '../utils/frontMonth';

// ─── Contract month helpers ──────────────────────────────────────────────────

const MONTHS_MAP: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function contractSortKey(contract: string): number {
  const mon = contract.slice(0, 3);
  const yr = parseInt(contract.slice(3), 10);
  return (yr + 2000) * 12 + (MONTHS_MAP[mon] ?? 0);
}

function maxContractKey(): number {
  const now = new Date();
  return (now.getFullYear() + 1) * 12 + (now.getMonth() + 1);
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded px-3 py-2 text-xs shadow-lg">
      <p className="text-text-dim font-semibold mb-1">{label}</p>
      <p className="text-text-primary font-bold">
        {payload[0].value.toLocaleString()} {unit}
      </p>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded p-4 flex flex-col gap-1">
      <span className="text-text-dim text-xs uppercase tracking-widest">{label}</span>
      <span className="text-text-primary text-xl font-bold font-mono">{value}</span>
      {sub && <span className="text-text-dim text-xs">{sub}</span>}
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({
  onFile,
  uploading,
  filename,
  dropZoneLabel,
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative cursor-pointer border-2 border-dashed rounded-lg px-6 py-5
        flex items-center gap-4 transition-colors
        ${dragging
          ? 'border-accent bg-accent/5'
          : 'border-border hover:border-accent/50 hover:bg-surface/50'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleChange}
      />

      {uploading ? (
        <>
          <span className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-text-primary text-sm font-semibold">Parsing PDF with AI...</p>
            <p className="text-text-dim text-xs">Extracting contract data via Anthropic Claude</p>
          </div>
        </>
      ) : (
        <>
          <span className="text-2xl shrink-0">📄</span>
          <div>
            <p className="text-text-primary text-sm font-semibold">
              {filename
                ? `Uploaded: ${filename} — drop new PDF to replace`
                : dropZoneLabel}
            </p>
            <p className="text-text-dim text-xs mt-0.5">
              Available after ~18:00 London from ice.com Report Center
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface ProductReportPanelProps {
  productCode: string;
  productName: string;
  accentColor: string;
  dropZoneLabel: string;
  isDiff?: boolean;   // true = values are diffs vs LS Gasoil, false = outright prices
  readOnly?: boolean;
  prominentTitle?: boolean;
}

export default function ProductReportPanel({
  productCode,
  productName,
  accentColor,
  dropZoneLabel,
  isDiff = false,
  readOnly = false,
  prominentTitle = false,
}: ProductReportPanelProps) {
  const [report, setReport] = useState<GasoilReport | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load latest on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/products/${productCode}/report/latest`, {
      headers: { 'X-API-Key': API_KEY },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GasoilReport | null) => { if (data) setReport(data); })
      .catch(() => {});
  }, [productCode]);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE_URL}/products/${productCode}/report`, {
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

  // Limit forward curve to 12 months ahead from today
  const maxKey = maxContractKey();
  const curveData = (report?.forward_curve ?? []).filter((r) => contractSortKey(r.contract) <= maxKey);
  const volumeData = report?.volume_by_delivery ?? [];
  const oiData = (report?.oi_curve ?? []).filter((r) => contractSortKey(r.contract) <= maxKey);

  const uploadedAt = report?.uploaded_at
    ? new Date(report.uploaded_at).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      }) + ' UTC'
    : null;

  // Short, bold title stripped of "ICE " prefix for the prominent heading style
  const shortName = productName.replace(/^ICE\s+/i, '').trim();

  return (
    <div className="space-y-4" data-section={prominentTitle ? `product-${productCode.toLowerCase()}` : undefined}>
      {/* Header */}
      {prominentTitle ? (
        <div
          className="pb-2 mb-2 border-b-[3px] flex items-end justify-between"
          style={{ borderColor: accentColor }}
        >
          <div>
            <h2 className="font-bold text-2xl uppercase tracking-widest" style={{ color: accentColor }}>
              {shortName}
            </h2>
            <p className="text-text-dim text-xs mt-1 uppercase tracking-widest">Forward Curve &amp; Market Data</p>
          </div>
          {uploadedAt && report && (
            <span className="text-text-dim text-xs pb-1">
              {report.source_filename} · uploaded {uploadedAt}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest">
            {productName} — Forward Curve &amp; Market Data
          </h2>
          {uploadedAt && report && (
            <span className="text-text-dim text-xs">
              {report.source_filename} · uploaded {uploadedAt}
            </span>
          )}
        </div>
      )}

      {/* Drop Zone — only in full mode (Products Data tab) */}
      {!readOnly && (
        <DropZone
          onFile={handleFile}
          uploading={uploading}
          filename={report?.source_filename ?? null}
          dropZoneLabel={dropZoneLabel}
        />
      )}

      {/* Error */}
      {!readOnly && error && (
        <div className="bg-negative/10 border border-negative/30 rounded px-4 py-2 text-sm text-negative">
          {error}
        </div>
      )}

      {/* Data panels — only shown after upload */}
      {report && (
        <>
          {/* Metric Cards */}
          <div className={`grid grid-cols-2 ${isDiff ? 'md:grid-cols-4' : 'md:grid-cols-5'} gap-3`}>
            {!isDiff && (
              <MetricCard
                label="VWAP"
                value={report.vwap != null ? `${report.vwap.toLocaleString()} $/MT` : '—'}
                sub="Vol-weighted avg settlement"
              />
            )}
            {(() => {
              const m1 = findFrontMonthRow(curveData, report?.front_month_contract);
              return (
                <MetricCard
                  label={isDiff ? 'M1 Diff vs GO' : 'M1 Settlement'}
                  value={m1 ? `${m1.settlement.toLocaleString()} $/MT` : '—'}
                  sub={m1 ? `${m1.contract} · chg ${m1.change >= 0 ? '+' : ''}${m1.change}` : ''}
                />
              );
            })()}
            <MetricCard
              label="Total Volume"
              value={report.total_volume.toLocaleString()}
              sub="lots traded today"
            />
            <MetricCard
              label="Total Open Interest"
              value={report.total_oi.toLocaleString()}
              sub="lots outstanding"
            />
            <MetricCard
              label="Spread Volume"
              value={report.total_spread_volume.toLocaleString()}
              sub="spread lots traded"
            />
          </div>

          {/* Forward Curve */}
          <div className="bg-card border border-border rounded p-5">
            <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
              {isDiff ? 'Forward Curve — Diff vs LS Gasoil ($/MT)' : 'Forward Curve — Settlement Price ($/MT)'}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={curveData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #2a2a3a)" />
                <XAxis
                  dataKey="contract"
                  tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  width={55}
                  tickFormatter={(v: number) => v.toLocaleString()}
                />
                <Tooltip content={<ChartTooltip unit="$/MT" />} />
                <Line
                  type="monotone"
                  dataKey="settlement"
                  stroke={accentColor}
                  strokeWidth={2}
                  dot={{ r: 3, fill: accentColor }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Volume by Delivery */}
          {volumeData.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Volume by Delivery (Active Contracts Only — lots)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volumeData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #2a2a3a)" />
                  <XAxis
                    dataKey="contract"
                    tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }}
                    tickLine={false}
                    axisLine={false}
                    width={55}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  />
                  <Tooltip content={<ChartTooltip unit="lots" />} />
                  <Bar dataKey="volume" fill={accentColor} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Open Interest Curve */}
          {oiData.length > 0 && (
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
                Open Interest by Contract (lots)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={oiData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #2a2a3a)" />
                  <XAxis
                    dataKey="contract"
                    tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-text-dim, #888)' }}
                    tickLine={false}
                    axisLine={false}
                    width={55}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  />
                  <Tooltip content={<ChartTooltip unit="lots" />} />
                  <Bar dataKey="oi" fill={accentColor} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!report && !uploading && (
        <p className="text-text-dim text-xs text-center py-4">
          {readOnly
            ? `No ${productName} data yet — upload the ICE daily PDF in the Products Data tab.`
            : 'Upload the ICE daily PDF to see the forward curve, volume, open interest and VWAP.'}
        </p>
      )}
    </div>
  );
}
