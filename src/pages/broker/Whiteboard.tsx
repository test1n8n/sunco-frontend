import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { API_BASE_URL, API_KEY } from '../../config';

// ─── Types ───────────────────────────────────────────────────────────────────

type ColumnType = 'outright' | 'product_spread' | 'flat_price' | 'gasoil_swap' | 'gasoil_futures';

interface WBColumn {
  id: number;
  label: string;
  column_type: ColumnType;
  product_a: string;
  product_b: string;
  color: string;
  display_order: number;
  tab: string;
  cells: Record<string, { bid: number | null; ask: number | null; value: number | null; value_spread: number | null }>;
}

interface CellMeta {
  price: number | null;
  qty: number | null;
  init_code: string;
  broker_firm: string;
  counterparty: string;
  status: string;
  created_by: string;
  updated_by: string;
  updated_at: string | null;
  created_at: string | null;
}

interface QuoteMeta {
  BID?: CellMeta;
  ASK?: CellMeta;
  VALUE?: CellMeta;
}

interface Snapshot {
  columns: WBColumn[];
  deliveries: string[];
  quote_meta: Record<string, QuoteMeta>;
  front_month: { today: string; front_month: string; current_month_expiry: string };
}

interface TickerEvent {
  id: number;
  event_type: string;
  column_label: string;
  delivery: string;
  side: string;
  price: number | null;
  qty: number | null;
  user_display: string;
  counterparty: string;
  timestamp: string;
}

interface Trade {
  id: number;
  product: string;
  delivery: string;
  side: string;
  price: number;
  qty: number;
  counterparty: string;
  broker: string;
  status: string;
  tenor: string;
  notes: string;
  created_at: string | null;
}

interface FuturesRow {
  contract: string;
  delivery_label: string;
  swap_days: number | null;
  swap_avg: number | null;
  bid: number | null;
  ask: number | null;
  settle: number | null;
  close: number | null;
  change: number | null;
}

interface CloseColumnData {
  id: number;
  label: string;
  column_type: ColumnType;
  product_a: string;
  product_b: string;
  color: string;
  pdf_code: string;
  pdf_date: string;
  close: Record<string, number | null>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_DELIVERIES = [
  'Apr-26','May-26','Jun-26','Jul-26','Aug-26','Sep-26','Oct-26','Nov-26','Dec-26',
  'Q2-26','Q3-26','Q4-26','Q1-27',
  'H2-26','H1-27','2026',
  'Q2/Q3-26','Q3/Q4-26','Q4/Q1-27','Q1/Q2-27','Q2/Q3-27','Q3/Q4-27',
];

const SUB_TABS = [
  { key: 'WB+FP',     label: 'WB + FP' },
  { key: 'WB+Pricer', label: 'WB + Pricer' },
  { key: 'Pricer',    label: 'Pricer' },
  { key: 'Close',     label: 'Close' },
  { key: 'Futures',   label: 'Futures' },
  { key: 'Reports',   label: 'Reports' },
];

const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  outright: 'Outright product',
  product_spread: 'Product spread (A − B)',
  flat_price: 'Flat price (GO swap + diff)',
  gasoil_swap: 'LS Gasoil Swap',
  gasoil_futures: 'LS Gasoil Futures',
};

// ─── API helpers ─────────────────────────────────────────────────────────────

const hdr = { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_BASE_URL}${path}`, { headers: hdr });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T | null> {
  try {
    const r = await fetch(`${API_BASE_URL}${path}`, { method, headers: hdr, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const then = new Date(isoString).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return '';
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

// ─── Hover tooltip ───────────────────────────────────────────────────────────

function CellTooltip({ col, delivery, side, meta }: { col: WBColumn; delivery: string; side: 'BID' | 'ASK'; meta: CellMeta | undefined }) {
  if (!meta || meta.price == null) return null;
  const ago = meta.updated_at ? timeAgo(meta.updated_at) : '';
  return (
    <div className="absolute z-50 left-full ml-2 top-0 bg-surface border border-border rounded shadow-lg p-3 text-xs whitespace-nowrap pointer-events-none">
      <div className="font-bold text-text-primary mb-1">{col.label}</div>
      <div className="text-accent font-semibold">{side} {delivery} @ {meta.price}{meta.qty ? ` × ${meta.qty}` : ''}</div>
      <div className="text-text-secondary mt-1">{meta.broker_firm}</div>
      <div className="text-text-secondary">{meta.counterparty || 'XXXX'}</div>
      <div className="text-text-dim mt-1">
        {meta.updated_by ? `Updated by ${meta.updated_by}` : `Added by ${meta.created_by || 'unknown'}`} {ago}
      </div>
    </div>
  );
}

// ─── Editable quote cell with Qty support ────────────────────────────────────

function QuoteCell({
  col, delivery, side, value, meta, editable, onSave, onDelete,
}: {
  col: WBColumn;
  delivery: string;
  side: 'BID' | 'ASK';
  value: number | null;
  meta: CellMeta | undefined;
  editable: boolean;
  onSave: (price: number, qty: number | null) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [priceDraft, setPriceDraft] = useState('');
  const [qtyDraft, setQtyDraft] = useState('');
  const [hovering, setHovering] = useState(false);
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && priceRef.current) priceRef.current.focus();
  }, [editing]);

  const startEdit = () => {
    setPriceDraft(value != null ? String(value) : '');
    setQtyDraft(meta?.qty != null ? String(meta.qty) : '');
    setEditing(true);
  };

  const commit = () => {
    const parsedPx = parseFloat(priceDraft);
    if (!isNaN(parsedPx)) {
      const parsedQty = qtyDraft.trim() ? parseInt(qtyDraft, 10) : null;
      onSave(parsedPx, isNaN(parsedQty as number) ? null : parsedQty);
    }
    setEditing(false);
  };

  const bg = side === 'BID' ? 'bg-blue-900/40' : 'bg-red-900/40';
  const txt = side === 'BID' ? 'text-blue-200' : 'text-red-200';

  return (
    <div
      className={`relative h-full w-full ${bg} flex items-center justify-center cursor-pointer select-none`}
      onClick={() => editable && !editing && startEdit()}
      onDoubleClick={(e) => { e.stopPropagation(); if (editable && meta?.price != null) onDelete(); }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {editing ? (
        <div className="flex gap-0.5 w-full h-full">
          <input
            ref={priceRef}
            type="number" step="0.01"
            placeholder="Price"
            value={priceDraft}
            onChange={(e) => setPriceDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter') commit(); if (e.key === 'Tab') { e.preventDefault(); (e.currentTarget.nextSibling as HTMLInputElement)?.focus(); } }}
            onBlur={(e) => { if (!(e.relatedTarget as HTMLElement)?.classList.contains('qty-input')) commit(); }}
            className="w-1/2 h-full bg-surface text-text-primary text-[10px] text-center outline-none border border-accent"
          />
          <input
            type="number" step="1"
            placeholder="Qty"
            value={qtyDraft}
            onChange={(e) => setQtyDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter') commit(); }}
            onBlur={commit}
            className="qty-input w-1/2 h-full bg-surface text-text-dim text-[10px] text-center outline-none border border-accent/60"
          />
        </div>
      ) : (
        <span className={`text-xs font-mono font-semibold ${txt}`}>
          {value != null ? fmt(value) : ''}
          {meta?.qty != null && value != null && <span className="text-[9px] text-text-dim ml-1">×{meta.qty}</span>}
        </span>
      )}
      {hovering && !editing && meta?.price != null && (
        <CellTooltip col={col} delivery={delivery} side={side} meta={meta} />
      )}
    </div>
  );
}

function DerivedCell({ value, accent }: { value: number | null; accent?: boolean }) {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <span className={`text-xs font-mono ${accent ? 'text-yellow-300' : 'text-text-primary'}`}>
        {fmt(value)}
      </span>
    </div>
  );
}

function ColHeader({ col, onRemove }: { col: WBColumn; onRemove: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="h-full flex items-center justify-center gap-1 px-2 font-bold text-xs uppercase tracking-wide"
      style={{ color: col.color }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {col.label}
      {hover && (
        <button
          onClick={onRemove}
          className="text-negative hover:text-red-400 text-[10px] ml-1"
          title="Remove column"
        >✕</button>
      )}
    </div>
  );
}

// ─── Add Column Modal ────────────────────────────────────────────────────────

function AddColumnModal({ onClose, onAdd, existingLabels, activeTab }: {
  onClose: () => void;
  onAdd: (payload: { label: string; column_type: ColumnType; product_a: string; product_b: string; color: string; tab: string }) => void;
  existingLabels: string[];
  activeTab: string;
}) {
  const [colType, setColType] = useState<ColumnType>('outright');
  const [productA, setProductA] = useState('UCOME');
  const [productB, setProductB] = useState('RME');
  const [color, setColor] = useState('#6366f1');
  const [tab, setTab] = useState(activeTab);

  const derivedLabel = useMemo(() => {
    if (colType === 'product_spread') return `${productA}/${productB}`;
    if (colType === 'flat_price') return `${productA} FP`;
    if (colType === 'gasoil_swap') return 'LS Gasoil Swap';
    if (colType === 'gasoil_futures') return 'LS Gasoil Futures';
    return productA;
  }, [colType, productA, productB]);

  const duplicate = existingLabels.includes(derivedLabel);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-text-primary font-semibold text-sm uppercase tracking-widest mb-4">Add Column</h3>
        <label className="block text-text-dim text-xs uppercase tracking-widest mb-1">Type</label>
        <select value={colType} onChange={(e) => setColType(e.target.value as ColumnType)}
          className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary mb-3">
          {Object.entries(COLUMN_TYPE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
        {(colType === 'outright' || colType === 'product_spread' || colType === 'flat_price') && (
          <>
            <label className="block text-text-dim text-xs uppercase tracking-widest mb-1">Product A</label>
            <input type="text" value={productA} onChange={(e) => setProductA(e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary mb-3" />
          </>
        )}
        {colType === 'product_spread' && (
          <>
            <label className="block text-text-dim text-xs uppercase tracking-widest mb-1">Product B</label>
            <input type="text" value={productB} onChange={(e) => setProductB(e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary mb-3" />
          </>
        )}
        <label className="block text-text-dim text-xs uppercase tracking-widest mb-1">Tab</label>
        <select value={tab} onChange={(e) => setTab(e.target.value)}
          className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary mb-3">
          {SUB_TABS.filter(t => t.key !== 'Reports').map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <label className="block text-text-dim text-xs uppercase tracking-widest mb-1">Color</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          className="w-full h-10 bg-surface border border-border rounded mb-4" />
        <div className="text-text-dim text-xs mb-4">
          Label: <span className="text-text-primary font-mono">{derivedLabel}</span>
          {duplicate && <span className="text-negative ml-2">(already exists)</span>}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-xs uppercase tracking-widest text-text-dim hover:text-text-primary">Cancel</button>
          <button disabled={duplicate}
            onClick={() => { onAdd({ label: derivedLabel, column_type: colType, product_a: productA, product_b: productB, color, tab }); onClose(); }}
            className="px-4 py-2 bg-accent text-surface rounded text-xs font-bold uppercase tracking-widest disabled:opacity-50">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Grid views per sub-tab ──────────────────────────────────────────────────

type SaveQuoteFn = (col: WBColumn, delivery: string, side: 'BID' | 'ASK', price: number, qty: number | null) => void;
type DeleteQuoteFn = (col: WBColumn, delivery: string, side: 'BID' | 'ASK') => void;

function WBGrid({
  columns, deliveries, quoteMeta, readOnly, onSave, onDelete, onRemoveCol,
}: {
  columns: WBColumn[];
  deliveries: string[];
  quoteMeta: Record<string, QuoteMeta>;
  readOnly?: boolean;
  onSave: SaveQuoteFn;
  onDelete: DeleteQuoteFn;
  onRemoveCol: (col: WBColumn) => void;
}) {
  return (
    <div className="flex-1 overflow-auto border border-border rounded">
      <table className="border-collapse text-xs">
        <thead className="sticky top-0 bg-surface z-10">
          <tr>
            <th className="sticky left-0 bg-surface border-r border-border px-3 py-2 text-text-dim uppercase tracking-widest text-[10px]">Delivery</th>
            {columns.map((col) => {
              const isEditable = !readOnly && (col.column_type === 'outright' || col.column_type === 'gasoil_futures');
              const spanCount = isEditable ? 3 : 2;
              return (
                <th key={col.id} colSpan={spanCount} className="border-r border-border bg-surface">
                  <ColHeader col={col} onRemove={() => onRemoveCol(col)} />
                </th>
              );
            })}
          </tr>
          <tr>
            <th className="sticky left-0 bg-surface border-r border-border border-t"></th>
            {columns.map((col) => {
              const isEditable = !readOnly && (col.column_type === 'outright' || col.column_type === 'gasoil_futures');
              return isEditable ? (
                <>
                  <th key={`${col.id}-bid`} className="border-r border-t border-border bg-surface px-2 py-1 text-text-dim uppercase text-[9px]">Bid</th>
                  <th key={`${col.id}-ask`} className="border-r border-t border-border bg-surface px-2 py-1 text-text-dim uppercase text-[9px]">Ask</th>
                  <th key={`${col.id}-val`} className="border-r border-t border-border bg-surface px-2 py-1 text-text-dim uppercase text-[9px]">Value</th>
                </>
              ) : (
                <>
                  <th key={`${col.id}-val`} className="border-r border-t border-border bg-surface px-2 py-1 text-text-dim uppercase text-[9px]">Value</th>
                  <th key={`${col.id}-spr`} className="border-r border-t border-border bg-surface px-2 py-1 text-text-dim uppercase text-[9px]">Spr</th>
                </>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {deliveries.map((delivery) => (
            <tr key={delivery} className="border-t border-border/50">
              <td className="sticky left-0 bg-card border-r border-border px-3 py-1 text-text-primary font-semibold whitespace-nowrap">{delivery}</td>
              {columns.map((col) => {
                const cell = col.cells[delivery] ?? { bid: null, ask: null, value: null, value_spread: null };
                const meta = quoteMeta[`${col.id}:${delivery}`];
                const isEditable = !readOnly && (col.column_type === 'outright' || col.column_type === 'gasoil_futures');
                if (isEditable) {
                  return (
                    <>
                      <td key={`${col.id}-${delivery}-bid`} className="border-r border-border p-0 h-7 min-w-[90px]">
                        <QuoteCell col={col} delivery={delivery} side="BID" value={cell.bid} meta={meta?.BID} editable
                          onSave={(price, qty) => onSave(col, delivery, 'BID', price, qty)}
                          onDelete={() => onDelete(col, delivery, 'BID')} />
                      </td>
                      <td key={`${col.id}-${delivery}-ask`} className="border-r border-border p-0 h-7 min-w-[90px]">
                        <QuoteCell col={col} delivery={delivery} side="ASK" value={cell.ask} meta={meta?.ASK} editable
                          onSave={(price, qty) => onSave(col, delivery, 'ASK', price, qty)}
                          onDelete={() => onDelete(col, delivery, 'ASK')} />
                      </td>
                      <td key={`${col.id}-${delivery}-val`} className="border-r border-border p-0 h-7 min-w-[70px]">
                        <DerivedCell value={cell.value} accent />
                      </td>
                    </>
                  );
                }
                return (
                  <>
                    <td key={`${col.id}-${delivery}-val`} className="border-r border-border p-0 h-7 min-w-[70px]">
                      <DerivedCell value={cell.value} accent={col.column_type === 'flat_price' || col.column_type === 'gasoil_swap'} />
                    </td>
                    <td key={`${col.id}-${delivery}-spr`} className="border-r border-border p-0 h-7 min-w-[60px]">
                      <DerivedCell value={cell.value_spread} />
                    </td>
                  </>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {columns.length === 0 && (
        <div className="p-8 text-center text-text-dim text-sm">
          No columns configured for this tab. Click <span className="text-accent font-semibold">+ Column</span> to add products.
        </div>
      )}
    </div>
  );
}

function CloseGrid({ snapshot, closeData, deliveries }: {
  snapshot: Snapshot; closeData: CloseColumnData[]; deliveries: string[];
}) {
  const columns = snapshot.columns.filter((c) => closeData.find((cd) => cd.id === c.id));
  if (columns.length === 0) {
    return <div className="p-8 text-center text-text-dim text-sm">No columns available. Add some in WB + FP.</div>;
  }
  return (
    <div className="flex-1 overflow-auto border border-border rounded">
      <table className="border-collapse text-xs">
        <thead className="sticky top-0 bg-surface z-10">
          <tr>
            <th className="sticky left-0 bg-surface border-r border-border px-3 py-2 text-text-dim uppercase tracking-widest text-[10px]">Delivery</th>
            {columns.map((col) => (
              <th key={col.id} colSpan={2} className="border-r border-border bg-surface">
                <div className="h-full flex items-center justify-center px-2 font-bold text-xs uppercase tracking-wide" style={{ color: col.color }}>
                  {col.label}
                </div>
              </th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 bg-surface border-r border-border border-t"></th>
            {columns.map((col) => (
              <>
                <th key={`${col.id}-val`} className="border-r border-t border-border bg-surface px-2 py-1 text-text-dim uppercase text-[9px]">Value</th>
                <th key={`${col.id}-close`} className="border-r border-t border-border bg-surface px-2 py-1 text-text-dim uppercase text-[9px]">Close</th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {deliveries.map((delivery) => (
            <tr key={delivery} className="border-t border-border/50">
              <td className="sticky left-0 bg-card border-r border-border px-3 py-1 text-text-primary font-semibold whitespace-nowrap">{delivery}</td>
              {columns.map((col) => {
                const live = col.cells[delivery]?.value ?? null;
                const close = closeData.find((cd) => cd.id === col.id)?.close[delivery] ?? null;
                const diff = live != null && close != null ? live - close : null;
                const diffColor = diff == null ? '' : diff > 0 ? 'text-positive' : diff < 0 ? 'text-negative' : 'text-text-dim';
                return (
                  <>
                    <td key={`${col.id}-${delivery}-val`} className={`border-r border-border p-0 h-7 min-w-[75px] text-center font-mono text-xs ${diffColor}`}>
                      {fmt(live)}
                    </td>
                    <td key={`${col.id}-${delivery}-cl`} className="border-r border-border p-0 h-7 min-w-[75px] text-center font-mono text-xs text-text-dim">
                      {fmt(close)}
                    </td>
                  </>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FuturesGrid({ rows, reportDate }: { rows: FuturesRow[]; reportDate: string }) {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-text-dim text-sm">
        No gasoil data — upload an LS Gasoil PDF in Products Data first.
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-auto border border-border rounded">
      <div className="px-4 py-2 bg-surface border-b border-border text-text-dim text-xs">
        LS Gasoil Futures — settlement date: <span className="text-text-primary font-semibold">{reportDate || 'n/a'}</span>
      </div>
      <table className="border-collapse text-xs w-full">
        <thead className="sticky top-0 bg-surface z-10">
          <tr className="border-b border-border">
            <th className="border-r border-border bg-surface px-3 py-2 text-text-dim uppercase tracking-widest text-[10px] text-left">Contract</th>
            <th className="border-r border-border bg-surface px-3 py-2 text-text-dim uppercase tracking-widest text-[10px] text-right">Swap Days</th>
            <th className="border-r border-border bg-surface px-3 py-2 text-text-dim uppercase tracking-widest text-[10px] text-right">Bid</th>
            <th className="border-r border-border bg-surface px-3 py-2 text-text-dim uppercase tracking-widest text-[10px] text-right">Ask</th>
            <th className="border-r border-border bg-surface px-3 py-2 text-text-dim uppercase tracking-widest text-[10px] text-right">Settle</th>
            <th className="border-r border-border bg-surface px-3 py-2 text-text-dim uppercase tracking-widest text-[10px] text-right">Close</th>
            <th className="border-r border-border bg-surface px-3 py-2 text-text-dim uppercase tracking-widest text-[10px] text-right">Chg</th>
            <th className="bg-surface px-3 py-2 text-text-dim uppercase tracking-widest text-[10px] text-right">Swap Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const chgColor = r.change == null ? '' : r.change > 0 ? 'text-positive' : r.change < 0 ? 'text-negative' : '';
            return (
              <tr key={r.contract} className="border-b border-border/50 hover:bg-surface/40">
                <td className="border-r border-border px-3 py-1.5 text-text-primary font-semibold">{r.contract}</td>
                <td className="border-r border-border px-3 py-1.5 text-right font-mono text-text-dim">{r.swap_days ?? ''}</td>
                <td className="border-r border-border px-3 py-1.5 text-right font-mono text-blue-200">{fmt(r.bid)}</td>
                <td className="border-r border-border px-3 py-1.5 text-right font-mono text-red-200">{fmt(r.ask)}</td>
                <td className="border-r border-border px-3 py-1.5 text-right font-mono text-text-primary">{fmt(r.settle)}</td>
                <td className="border-r border-border px-3 py-1.5 text-right font-mono text-text-dim">{fmt(r.close)}</td>
                <td className={`border-r border-border px-3 py-1.5 text-right font-mono ${chgColor}`}>{r.change != null ? (r.change >= 0 ? '+' : '') + fmt(r.change) : ''}</td>
                <td className="px-3 py-1.5 text-right font-mono text-yellow-300">{fmt(r.swap_avg)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReportsView({ snapshot, onExportCSV, tickerCount, tradeCount }: {
  snapshot: Snapshot | null;
  onExportCSV: () => void;
  tickerCount: number;
  tradeCount: number;
}) {
  const colCount = snapshot?.columns.length ?? 0;
  return (
    <div className="flex-1 overflow-auto border border-border rounded p-6 space-y-4">
      <h3 className="text-text-primary font-semibold text-sm uppercase tracking-widest">Reports & Export</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface border border-border rounded p-4">
          <div className="text-text-dim text-xs uppercase tracking-widest">Columns</div>
          <div className="text-text-primary text-2xl font-bold font-mono">{colCount}</div>
        </div>
        <div className="bg-surface border border-border rounded p-4">
          <div className="text-text-dim text-xs uppercase tracking-widest">Ticker Events</div>
          <div className="text-text-primary text-2xl font-bold font-mono">{tickerCount}</div>
        </div>
        <div className="bg-surface border border-border rounded p-4">
          <div className="text-text-dim text-xs uppercase tracking-widest">Trades</div>
          <div className="text-text-primary text-2xl font-bold font-mono">{tradeCount}</div>
        </div>
        <div className="bg-surface border border-border rounded p-4">
          <div className="text-text-dim text-xs uppercase tracking-widest">Front Month</div>
          <div className="text-accent text-xl font-bold font-mono">{snapshot?.front_month.front_month ?? '—'}</div>
        </div>
      </div>
      <div className="bg-surface border border-border rounded p-4">
        <h4 className="text-text-primary font-semibold text-sm mb-3">Exports</h4>
        <button onClick={onExportCSV} className="bg-accent text-surface px-4 py-2 rounded text-xs font-bold uppercase tracking-widest">
          Download snapshot CSV
        </button>
        <p className="text-text-dim text-xs mt-2">Exports all columns and deliveries with current values.</p>
      </div>
    </div>
  );
}

// ─── Side panels ─────────────────────────────────────────────────────────────

function NotesPanel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="bg-card border border-border rounded p-3">
      <div className="text-text-dim text-xs uppercase tracking-widest mb-2 font-semibold">Notes</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={5} placeholder="Scratch pad..."
        className="w-full bg-surface border border-border rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-accent resize-none" />
    </div>
  );
}

function TickerPanel({ events }: { events: TickerEvent[] }) {
  return (
    <div className="bg-card border border-border rounded p-3 overflow-y-auto max-h-64">
      <div className="text-text-dim text-xs uppercase tracking-widest mb-2 font-semibold">Ticker</div>
      <div className="space-y-1">
        {events.length === 0 && <p className="text-text-dim text-xs">No recent activity</p>}
        {events.map((e) => (
          <div key={e.id} className="text-[10px] font-mono text-text-secondary">
            <span className="text-text-dim">{new Date(e.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>{' '}
            <span className={e.event_type === 'ADD' ? 'text-positive' : e.event_type === 'REMOVE' ? 'text-negative' : 'text-accent'}>
              {e.event_type}
            </span>{' '}
            <span className="text-text-primary font-bold">{e.column_label}</span>{' '}
            <span>{e.delivery}</span>{' '}
            {e.side && <span className="text-accent">{e.side}</span>}{' '}
            {e.price != null && <span>@{e.price}</span>}
            {e.user_display && <span className="text-text-dim"> · {e.user_display}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function BlotterPanel({ trades, onAdd, onFilter, filter }: {
  trades: Trade[];
  onAdd: () => void;
  onFilter: (f: string) => void;
  filter: string;
}) {
  const filters = ['All', 'draft', 'confirmed', 'cleared', 'approved'];
  return (
    <div className="bg-card border border-border rounded p-3 overflow-y-auto max-h-80">
      <div className="flex items-center justify-between mb-2">
        <div className="text-text-dim text-xs uppercase tracking-widest font-semibold">Blotter</div>
        <button onClick={onAdd} className="text-accent text-[10px] uppercase tracking-widest hover:text-accent-hover">+ Add</button>
      </div>
      <div className="flex gap-1 mb-2 flex-wrap">
        {filters.map((f) => (
          <button key={f} onClick={() => onFilter(f)}
            className={`text-[9px] px-2 py-0.5 rounded border ${filter === f ? 'bg-accent text-surface border-accent' : 'border-border text-text-dim hover:text-text-primary'}`}>
            {f}
          </button>
        ))}
      </div>
      {trades.length === 0 ? (
        <p className="text-text-dim text-xs italic">No trades to show</p>
      ) : (
        <div className="space-y-1">
          {trades.map((t) => (
            <div key={t.id} className="border-b border-border/30 pb-1 text-[10px] font-mono">
              <div className="flex justify-between text-text-primary">
                <span><span className="font-bold">{t.product}</span> {t.delivery}</span>
                <span className={t.side === 'BUY' ? 'text-positive' : 'text-negative'}>{t.side} {t.qty}@{t.price}</span>
              </div>
              <div className="text-text-dim">{t.counterparty || 'XXXX'} · {t.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddTradeModal({ onClose, onAdd, userName }: {
  onClose: () => void;
  onAdd: (t: Omit<Trade, 'id' | 'created_at'>) => void;
  userName: string;
}) {
  const [product, setProduct] = useState('UCOME');
  const [delivery, setDelivery] = useState('May-26');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('10');
  const [counterparty, setCounterparty] = useState('XXXX');
  const [status, setStatus] = useState('draft');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-text-primary font-semibold text-sm uppercase tracking-widest mb-4">Add Trade</h3>
        <div className="grid grid-cols-2 gap-2">
          <input type="text" placeholder="Product" value={product} onChange={(e) => setProduct(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary" />
          <input type="text" placeholder="Delivery" value={delivery} onChange={(e) => setDelivery(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary" />
          <select value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}
            className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary">
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary">
            <option value="draft">draft</option>
            <option value="confirmed">confirmed</option>
            <option value="cleared">cleared</option>
            <option value="approved">approved</option>
          </select>
          <input type="number" step="0.01" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary" />
          <input type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary" />
          <input type="text" placeholder="Counterparty" value={counterparty} onChange={(e) => setCounterparty(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary col-span-2" />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-xs uppercase tracking-widest text-text-dim hover:text-text-primary">Cancel</button>
          <button
            disabled={!price || !qty}
            onClick={() => {
              onAdd({ product, delivery, side, price: parseFloat(price), qty: parseInt(qty, 10), counterparty, broker: userName, status, tenor: '', notes: '' });
              onClose();
            }}
            className="px-4 py-2 bg-accent text-surface rounded text-xs font-bold uppercase tracking-widest disabled:opacity-50">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function BlasterPanel({ columns, onBlast }: {
  columns: WBColumn[];
  onBlast: (columnIds: number[], deliveries: string[], recipients: string[], note: string) => void;
}) {
  const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set());
  const [deliveries, setDeliveries] = useState('May-26, Jun-26, Jul-26, Q3-26, Q4-26');
  const [recipients, setRecipients] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string>('');

  const toggle = (id: number) => {
    const next = new Set(selectedCols);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedCols(next);
  };

  return (
    <div className="bg-card border border-border rounded p-3 max-h-96 overflow-y-auto">
      <div className="text-text-dim text-xs uppercase tracking-widest mb-2 font-semibold">Blaster</div>
      <div className="text-text-dim text-[10px] mb-1">Columns:</div>
      <div className="flex flex-wrap gap-1 mb-2 max-h-20 overflow-y-auto">
        {columns.map((c) => (
          <button key={c.id} onClick={() => toggle(c.id)}
            className={`text-[9px] px-2 py-0.5 rounded border ${selectedCols.has(c.id) ? 'bg-accent text-surface border-accent' : 'border-border text-text-dim hover:text-text-primary'}`}
            style={selectedCols.has(c.id) ? {} : { borderColor: c.color, color: c.color }}>
            {c.label}
          </button>
        ))}
      </div>
      <input type="text" value={deliveries} onChange={(e) => setDeliveries(e.target.value)}
        placeholder="Deliveries (comma-separated)"
        className="w-full bg-surface border border-border rounded px-2 py-1 text-[10px] text-text-primary mb-2" />
      <input type="text" value={recipients} onChange={(e) => setRecipients(e.target.value)}
        placeholder="Recipients (comma-separated emails)"
        className="w-full bg-surface border border-border rounded px-2 py-1 text-[10px] text-text-primary mb-2" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note..."
        className="w-full bg-surface border border-border rounded px-2 py-1 text-[10px] text-text-primary mb-2 resize-none" />
      <button
        disabled={selectedCols.size === 0}
        onClick={async () => {
          setStatus('Sending...');
          onBlast(
            Array.from(selectedCols),
            deliveries.split(',').map((s) => s.trim()).filter(Boolean),
            recipients.split(',').map((s) => s.trim()).filter(Boolean),
            note,
          );
          setTimeout(() => setStatus(''), 4000);
        }}
        className="w-full bg-accent text-surface py-1.5 rounded text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">
        Blast via Email
      </button>
      {status && <p className="text-text-dim text-[10px] mt-2">{status}</p>}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Whiteboard() {
  const [activeTab, setActiveTab] = useState('WB+FP');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [ticker, setTicker] = useState<TickerEvent[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeFilter, setTradeFilter] = useState<string>('All');
  const [closeData, setCloseData] = useState<CloseColumnData[]>([]);
  const [futuresRows, setFuturesRows] = useState<FuturesRow[]>([]);
  const [futuresDate, setFuturesDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [userName, setUserName] = useState('');
  const [blastResult, setBlastResult] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist broker name
  useEffect(() => {
    const saved = localStorage.getItem('sunco:wb:user') || '';
    if (saved) setUserName(saved);
    else {
      const input = prompt('Enter your broker name for the whiteboard:', 'Broker');
      if (input) {
        localStorage.setItem('sunco:wb:user', input);
        setUserName(input);
      }
    }
  }, []);

  const fetchSnapshot = useCallback(async () => {
    const data = await apiGet<Snapshot>(`/whiteboard/snapshot?deliveries=${encodeURIComponent(DEFAULT_DELIVERIES.join(','))}`);
    if (data) setSnap(data);
  }, []);

  const fetchTicker = useCallback(async () => {
    const data = await apiGet<TickerEvent[]>('/whiteboard/ticker?limit=50');
    if (data) setTicker(data);
  }, []);

  const fetchTrades = useCallback(async () => {
    const data = await apiGet<Trade[]>('/whiteboard/trades');
    if (data) setTrades(data);
  }, []);

  const fetchNotes = useCallback(async () => {
    if (!userName) return;
    const data = await apiGet<Array<{ content: string }>>(`/whiteboard/notes?user_display=${encodeURIComponent(userName)}`);
    if (data && data.length > 0) setNotes(data[0].content);
  }, [userName]);

  const fetchCloseData = useCallback(async () => {
    const data = await apiGet<{ columns: CloseColumnData[] }>(`/whiteboard/close-data?deliveries=${encodeURIComponent(DEFAULT_DELIVERIES.join(','))}`);
    if (data) setCloseData(data.columns);
  }, []);

  const fetchFutures = useCallback(async () => {
    const data = await apiGet<{ rows: FuturesRow[]; report_date: string }>('/whiteboard/futures-detail');
    if (data) {
      setFuturesRows(data.rows);
      setFuturesDate(data.report_date);
    }
  }, []);

  useEffect(() => { void fetchSnapshot(); }, [fetchSnapshot]);
  useEffect(() => { void fetchTicker(); }, [fetchTicker]);
  useEffect(() => { void fetchTrades(); }, [fetchTrades]);
  useEffect(() => { void fetchNotes(); }, [fetchNotes]);

  useEffect(() => {
    if (activeTab === 'Close') void fetchCloseData();
    if (activeTab === 'Futures') void fetchFutures();
  }, [activeTab, fetchCloseData, fetchFutures]);

  // WebSocket
  useEffect(() => {
    const connect = () => {
      const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/whiteboard/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'quote_updated' || msg.type === 'quote_deleted' ||
              msg.type === 'column_created' || msg.type === 'column_updated' || msg.type === 'column_deleted') {
            void fetchSnapshot();
            void fetchTicker();
          }
          if (msg.type === 'trade_created') {
            void fetchTrades();
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [fetchSnapshot, fetchTicker, fetchTrades]);

  // Auto-save notes (debounced)
  useEffect(() => {
    if (!userName) return;
    const id = setTimeout(() => {
      void apiSend('/whiteboard/notes', 'PUT', { user_display: userName, content: notes });
    }, 1000);
    return () => clearTimeout(id);
  }, [notes, userName]);

  const columnsForTab = useMemo(() => {
    if (!snap) return [];
    // Pricer tab shows all columns read-only; other tabs filter by tab field
    if (activeTab === 'Pricer') return snap.columns;
    if (activeTab === 'WB+Pricer') return snap.columns.filter((c) => c.tab === 'WB+FP' || c.tab === 'WB+Pricer');
    if (activeTab === 'Close' || activeTab === 'Futures' || activeTab === 'Reports') return snap.columns;
    return snap.columns.filter((c) => c.tab === activeTab);
  }, [snap, activeTab]);

  const isReadOnly = activeTab === 'Pricer' || activeTab === 'Close' || activeTab === 'Futures' || activeTab === 'Reports';

  const handleSaveQuote: SaveQuoteFn = async (col, delivery, side, price, qty) => {
    await apiSend('/whiteboard/quotes', 'PUT', {
      column_id: col.id, delivery, side, price, qty,
      init_code: userName.slice(0, 3).toUpperCase(),
      broker_firm: 'Sunco Brokers', counterparty: 'XXXX',
      status: 'working', user_display: userName,
    });
    void fetchSnapshot();
    void fetchTicker();
  };

  const handleDeleteQuote: DeleteQuoteFn = async (col, delivery, side) => {
    await fetch(`${API_BASE_URL}/whiteboard/quotes?column_id=${col.id}&delivery=${encodeURIComponent(delivery)}&side=${side}&user_display=${encodeURIComponent(userName)}`, {
      method: 'DELETE', headers: hdr,
    });
    void fetchSnapshot();
    void fetchTicker();
  };

  const handleAddColumn = async (payload: { label: string; column_type: ColumnType; product_a: string; product_b: string; color: string; tab: string }) => {
    await apiSend('/whiteboard/columns', 'POST', { ...payload, display_order: columnsForTab.length });
    void fetchSnapshot();
  };

  const handleRemoveColumn = async (col: WBColumn) => {
    if (!confirm(`Remove column "${col.label}"?`)) return;
    await fetch(`${API_BASE_URL}/whiteboard/columns/${col.id}`, { method: 'DELETE', headers: hdr });
    void fetchSnapshot();
  };

  const handleAddTrade = async (t: Omit<Trade, 'id' | 'created_at'>) => {
    await apiSend('/whiteboard/trades', 'POST', t);
    void fetchTrades();
  };

  const handleBlast = async (columnIds: number[], deliveries: string[], recipients: string[], note: string) => {
    const res = await apiSend<{ sent: number; errors: string[] }>('/whiteboard/blast', 'POST', {
      columns: columnIds, deliveries, recipients, note, sender_display: userName,
    });
    if (res) {
      setBlastResult(res.errors.length > 0 ? `Sent ${res.sent}, errors: ${res.errors.join('; ')}` : `Sent to ${res.sent} recipients`);
    } else {
      setBlastResult('Blast failed — check backend logs');
    }
    setTimeout(() => setBlastResult(''), 6000);
  };

  const handleExportCSV = () => {
    if (!snap) return;
    const lines: string[] = [];
    const headerCols = snap.columns.map((c) => c.label);
    lines.push(['Delivery', ...headerCols].join(','));
    for (const delivery of snap.deliveries) {
      const row: string[] = [delivery];
      for (const col of snap.columns) {
        const v = col.cells[delivery]?.value;
        row.push(v != null ? String(v) : '');
      }
      lines.push(row.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard-snapshot-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredTrades = useMemo(() => {
    if (tradeFilter === 'All') return trades;
    return trades.filter((t) => t.status === tradeFilter);
  }, [trades, tradeFilter]);

  if (!snap) return <div className="p-8 text-text-dim text-sm">Loading whiteboard...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-border pb-2 mb-2">
        <div className="flex gap-1">
          {SUB_TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 text-xs uppercase tracking-widest rounded ${
                activeTab === t.key ? 'bg-accent text-surface font-bold' : 'text-text-dim hover:text-text-primary hover:bg-surface/50'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="text-text-dim text-xs">
          Front month: <span className="text-accent font-semibold">{snap.front_month.front_month}</span>
          {' · '}
          {userName && <span>Broker: <span className="text-text-primary font-semibold">{userName}</span></span>}
        </div>
        {!isReadOnly && activeTab !== 'WB+Pricer' && (
          <button onClick={() => setShowAddModal(true)}
            className="bg-accent text-surface px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest">+ Column</button>
        )}
      </div>

      {blastResult && (
        <div className="bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary mb-2">{blastResult}</div>
      )}

      <div className="flex gap-3 flex-1 min-h-0">
        {/* Main content area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {(activeTab === 'WB+FP' || activeTab === 'WB+Pricer' || activeTab === 'Pricer') && (
            <WBGrid
              columns={columnsForTab}
              deliveries={DEFAULT_DELIVERIES}
              quoteMeta={snap.quote_meta}
              readOnly={activeTab === 'Pricer'}
              onSave={handleSaveQuote}
              onDelete={handleDeleteQuote}
              onRemoveCol={handleRemoveColumn}
            />
          )}
          {activeTab === 'Close' && (
            <CloseGrid snapshot={snap} closeData={closeData} deliveries={DEFAULT_DELIVERIES} />
          )}
          {activeTab === 'Futures' && (
            <FuturesGrid rows={futuresRows} reportDate={futuresDate} />
          )}
          {activeTab === 'Reports' && (
            <ReportsView
              snapshot={snap}
              onExportCSV={handleExportCSV}
              tickerCount={ticker.length}
              tradeCount={trades.length}
            />
          )}
        </div>

        {/* Side panels */}
        <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
          <NotesPanel value={notes} onChange={setNotes} />
          <TickerPanel events={ticker} />
          <BlotterPanel trades={filteredTrades} onAdd={() => setShowAddTrade(true)} onFilter={setTradeFilter} filter={tradeFilter} />
          <BlasterPanel columns={snap.columns} onBlast={handleBlast} />
        </div>
      </div>

      {showAddModal && (
        <AddColumnModal
          onClose={() => setShowAddModal(false)}
          onAdd={(p) => void handleAddColumn(p)}
          existingLabels={columnsForTab.map((c) => c.label)}
          activeTab={activeTab}
        />
      )}
      {showAddTrade && (
        <AddTradeModal onClose={() => setShowAddTrade(false)} onAdd={(t) => void handleAddTrade(t)} userName={userName} />
      )}
    </div>
  );
}
