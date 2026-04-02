import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { GasoilReport } from '../types';
import { API_BASE_URL, API_KEY } from '../config';

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
}: {
  onFile: (file: File) => void;
  uploading: boolean;
  filename: string | null;
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
            <p className="text-text-primary text-sm font-semibold">Parsing PDF with AI…</p>
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
                : 'Drop ICE LS Gasoil PDF here, or click to select'}
            </p>
            <p className="text-text-dim text-xs mt-0.5">
              Available after ~18:00 London from ice.com → Report Center → ICE Futures Europe Futures
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  reportDate?: string; // today's report date for context (reserved for future use)
  readOnly?: boolean;  // true = hide upload area, show charts only (for Daily Report)
}

export default function GasoilReportPanel({ readOnly = false }: Props) {
  const [gasoilReport, setGasoilReport] = useState<GasoilReport | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load latest on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/products/gasoil-report/latest`, {
      headers: { 'X-API-Key': API_KEY },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GasoilReport | null) => { if (data) setGasoilReport(data); })
      .catch(() => {});
  }, []);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE_URL}/products/gasoil-report`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(detail.detail ?? `HTTP ${res.status}`);
      }

      const data: GasoilReport = await res.json();
      setGasoilReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Limit forward curve to first 18 contracts (liquid range) for readability
  const curveData = gasoilReport?.forward_curve.slice(0, 18) ?? [];
  const volumeData = gasoilReport?.volume_by_delivery ?? [];
  const oiData = gasoilReport?.oi_curve.slice(0, 18) ?? [];

  const uploadedAt = gasoilReport?.uploaded_at
    ? new Date(gasoilReport.uploaded_at).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      }) + ' UTC'
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest">
          ICE LS Gasoil — Forward Curve &amp; Market Data
        </h2>
        {uploadedAt && gasoilReport && (
          <span className="text-text-dim text-xs">
            {gasoilReport.source_filename} · uploaded {uploadedAt}
          </span>
        )}
      </div>

      {/* Drop Zone — only in full mode (Products Data tab) */}
      {!readOnly && (
        <DropZone
          onFile={handleFile}
          uploading={uploading}
          filename={gasoilReport?.source_filename ?? null}
        />
      )}

      {/* Error */}
      {!readOnly && error && (
        <div className="bg-negative/10 border border-negative/30 rounded px-4 py-2 text-sm text-negative">
          ⚠ {error}
        </div>
      )}

      {/* Data panels — only shown after upload */}
      {gasoilReport && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard
              label="VWAP"
              value={gasoilReport.vwap != null ? `${gasoilReport.vwap.toLocaleString()} $/MT` : '—'}
              sub="Vol-weighted avg settlement"
            />
            <MetricCard
              label="M1 Settlement"
              value={
                curveData[0]
                  ? `${curveData[0].settlement.toLocaleString()} $/MT`
                  : '—'
              }
              sub={curveData[0] ? `${curveData[0].contract} · chg ${curveData[0].change >= 0 ? '+' : ''}${curveData[0].change}` : ''}
            />
            <MetricCard
              label="Total Volume"
              value={gasoilReport.total_volume.toLocaleString()}
              sub="lots traded today"
            />
            <MetricCard
              label="Total Open Interest"
              value={gasoilReport.total_oi.toLocaleString()}
              sub="lots outstanding"
            />
            <MetricCard
              label="Spread Volume"
              value={gasoilReport.total_spread_volume.toLocaleString()}
              sub="spread lots traded"
            />
          </div>

          {/* Forward Curve */}
          <div className="bg-card border border-border rounded p-5">
            <h3 className="text-text-dim text-xs font-semibold uppercase tracking-widest mb-4">
              Forward Curve — Settlement Price (USD/MT)
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
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#6366f1' }}
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
                  <Bar dataKey="volume" fill="#6366f1" radius={[2, 2, 0, 0]} />
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
                  <Bar dataKey="oi" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!gasoilReport && !uploading && (
        <p className="text-text-dim text-xs text-center py-4">
          {readOnly
            ? 'No gasoil data yet — upload the ICE daily PDF in the Products Data tab.'
            : 'Upload the ICE daily PDF to see the forward curve, volume, open interest and VWAP.'}
        </p>
      )}
    </div>
  );
}
