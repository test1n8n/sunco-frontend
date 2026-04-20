import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { API_BASE_URL, API_KEY } from '../../config';

// ─── Types (mirror backend) ──────────────────────────────────────────────────

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

interface QuoteMeta {
  BID?: CellMeta;
  ASK?: CellMeta;
  VALUE?: CellMeta;
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

async function apiSend<T>(path: string, method: string, body?: any): Promise<T | null> {
  try {
    const r = await fetch(`${API_BASE_URL}${path}`, { method, headers: hdr, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

// ─── Hover Tooltip ───────────────────────────────────────────────────────────

function CellTooltip({ col, delivery, side, meta }: { col: WBColumn; delivery: string; side: 'BID' | 'ASK'; meta: CellMeta | undefined }) {
  if (!meta || meta.price == null) return null;
  const ago = meta.updated_at ? timeAgo(meta.updated_at) : '';
  return (
    <div className="absolute z-50 left-full ml-2 top-0 bg-surface border border-border rounded shadow-lg p-3 text-xs whitespace-nowrap pointer-events-none">
      <div className="font-bold text-text-primary mb-1">{col.label}</div>
      <div className="text-accent font-semibold">{side} {delivery} @ {meta.price}</div>
      <div className="text-text-secondary mt-1">{meta.broker_firm}</div>
      <div className="text-text-secondary">{meta.counterparty || 'XXXX'}</div>
      <div className="text-text-dim mt-1">
        {meta.updated_by ? `Updated by ${meta.updated_by}` : `Added by ${meta.created_by || 'unknown'}`} {ago}
      </div>
    </div>
  );
}

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

// ─── Editable cell ───────────────────────────────────────────────────────────

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
  const [draft, setDraft] = useState('');
  const [hovering, setHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onSave(parsed, meta?.qty ?? null);
    setEditing(false);
  };

  const bg = side === 'BID' ? 'bg-blue-900/40' : 'bg-red-900/40';
  const txt = side === 'BID' ? 'text-blue-200' : 'text-red-200';

  return (
    <div
      className={`relative h-full w-full ${bg} flex items-center justify-center cursor-pointer select-none`}
      onClick={() => editable && setEditing(true)}
      onDoubleClick={(e) => { e.stopPropagation(); if (editable && meta?.price != null) onDelete(); }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="number" step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-full h-full bg-surface text-text-primary text-xs text-center outline-none border border-accent"
        />
      ) : (
        <span className={`text-xs font-mono font-semibold ${txt}`}>
          {value != null ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : (editable ? '' : '')}
        </span>
      )}
      {hovering && !editing && meta?.price != null && (
        <CellTooltip col={col} delivery={delivery} side={side} meta={meta} />
      )}
    </div>
  );
}

// ─── Readonly cell (value / value_spread / derived) ──────────────────────────

function DerivedCell({ value, accent }: { value: number | null; accent?: boolean }) {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <span className={`text-xs font-mono ${accent ? 'text-yellow-300' : 'text-text-primary'}`}>
        {value != null ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ''}
      </span>
    </div>
  );
}

// ─── Column header with remove button ────────────────────────────────────────

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

function AddColumnModal({ onClose, onAdd, existingLabels }: {
  onClose: () => void;
  onAdd: (payload: { label: string; column_type: ColumnType; product_a: string; product_b: string; color: string; tab: string }) => void;
  existingLabels: string[];
}) {
  const [colType, setColType] = useState<ColumnType>('outright');
  const [productA, setProductA] = useState('UCOME');
  const [productB, setProductB] = useState('RME');
  const [color, setColor] = useState('#6366f1');
  const [tab, setTab] = useState('WB+FP');

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
          {Object.entries(COLUMN_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
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
          {SUB_TABS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

        <label className="block text-text-dim text-xs uppercase tracking-widest mb-1">Color</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          className="w-full h-10 bg-surface border border-border rounded mb-4" />

        <div className="text-text-dim text-xs mb-4">
          Label: <span className="text-text-primary font-mono">{derivedLabel}</span>
          {duplicate && <span className="text-negative ml-2">(already exists)</span>}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-xs uppercase tracking-widest text-text-dim hover:text-text-primary">
            Cancel
          </button>
          <button
            disabled={duplicate}
            onClick={() => {
              onAdd({ label: derivedLabel, column_type: colType, product_a: productA, product_b: productB, color, tab });
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

// ─── Side panels ─────────────────────────────────────────────────────────────

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

function NotesPanel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="bg-card border border-border rounded p-3">
      <div className="text-text-dim text-xs uppercase tracking-widest mb-2 font-semibold">Notes</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder="Scratch pad..."
        className="w-full bg-surface border border-border rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-accent resize-none"
      />
    </div>
  );
}

function BlotterPanel() {
  return (
    <div className="bg-card border border-border rounded p-3">
      <div className="text-text-dim text-xs uppercase tracking-widest mb-2 font-semibold">Blotter</div>
      <p className="text-text-dim text-xs italic">No trades to show</p>
    </div>
  );
}

function BlasterPanel() {
  return (
    <div className="bg-card border border-border rounded p-3">
      <div className="text-text-dim text-xs uppercase tracking-widest mb-2 font-semibold">Blaster</div>
      <p className="text-text-dim text-xs italic">Select products/tenors to blast to clients</p>
    </div>
  );
}

// ─── Main Whiteboard ─────────────────────────────────────────────────────────

export default function Whiteboard() {
  const [activeTab, setActiveTab] = useState('WB+FP');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [ticker, setTicker] = useState<TickerEvent[]>([]);
  const [notes, setNotes] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [userName, setUserName] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist user name in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sunco:wb:user') || '';
    if (saved) setUserName(saved);
    else {
      const input = prompt('Enter your broker name (e.g. "Mina Attia") for the whiteboard:', 'Broker');
      if (input) {
        localStorage.setItem('sunco:wb:user', input);
        setUserName(input);
      }
    }
  }, []);

  const fetchSnapshot = useCallback(async () => {
    const deliveries = DEFAULT_DELIVERIES.join(',');
    const data = await apiGet<Snapshot>(`/whiteboard/snapshot?deliveries=${encodeURIComponent(deliveries)}`);
    if (data) setSnap(data);
  }, []);

  const fetchTicker = useCallback(async () => {
    const data = await apiGet<TickerEvent[]>('/whiteboard/ticker?limit=50');
    if (data) setTicker(data);
  }, []);

  const fetchNotes = useCallback(async () => {
    if (!userName) return;
    const data = await apiGet<Array<{ content: string }>>(`/whiteboard/notes?user_display=${encodeURIComponent(userName)}`);
    if (data && data.length > 0) setNotes(data[0].content);
  }, [userName]);

  useEffect(() => { void fetchSnapshot(); }, [fetchSnapshot]);
  useEffect(() => { void fetchTicker(); }, [fetchTicker]);
  useEffect(() => { void fetchNotes(); }, [fetchNotes]);

  // WebSocket for live sync
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
  }, [fetchSnapshot, fetchTicker]);

  const saveNotes = async () => {
    if (!userName) return;
    await apiSend('/whiteboard/notes', 'PUT', { user_display: userName, content: notes });
  };

  useEffect(() => {
    const id = setTimeout(() => { void saveNotes(); }, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const visibleColumns = useMemo(() => {
    if (!snap) return [];
    return snap.columns.filter((c) => c.tab === activeTab || activeTab === 'Pricer' || activeTab === 'WB+Pricer');
  }, [snap, activeTab]);

  const handleSaveQuote = async (col: WBColumn, delivery: string, side: 'BID' | 'ASK', price: number) => {
    await apiSend('/whiteboard/quotes', 'PUT', {
      column_id: col.id, delivery, side, price, qty: null,
      init_code: userName.slice(0, 3).toUpperCase(),
      broker_firm: 'Sunco Brokers', counterparty: 'XXXX',
      status: 'working', user_display: userName,
    });
    void fetchSnapshot();
    void fetchTicker();
  };

  const handleDeleteQuote = async (col: WBColumn, delivery: string, side: 'BID' | 'ASK') => {
    await fetch(`${API_BASE_URL}/whiteboard/quotes?column_id=${col.id}&delivery=${encodeURIComponent(delivery)}&side=${side}&user_display=${encodeURIComponent(userName)}`, {
      method: 'DELETE', headers: hdr,
    });
    void fetchSnapshot();
    void fetchTicker();
  };

  const handleAddColumn = async (payload: { label: string; column_type: ColumnType; product_a: string; product_b: string; color: string; tab: string }) => {
    await apiSend('/whiteboard/columns', 'POST', { ...payload, display_order: visibleColumns.length });
    void fetchSnapshot();
  };

  const handleRemoveColumn = async (col: WBColumn) => {
    if (!confirm(`Remove column "${col.label}"?`)) return;
    await fetch(`${API_BASE_URL}/whiteboard/columns/${col.id}`, { method: 'DELETE', headers: hdr });
    void fetchSnapshot();
  };

  if (!snap) {
    return <div className="p-8 text-text-dim text-sm">Loading whiteboard...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Top bar: sub-tabs + add column + user */}
      <div className="flex items-center gap-2 border-b border-border pb-2 mb-2">
        <div className="flex gap-1">
          {SUB_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 text-xs uppercase tracking-widest rounded ${
                activeTab === t.key ? 'bg-accent text-surface font-bold' : 'text-text-dim hover:text-text-primary hover:bg-surface/50'
              }`}
            >
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
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-accent text-surface px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
        >+ Column</button>
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* Grid */}
        <div className="flex-1 overflow-auto border border-border rounded">
          <table className="border-collapse text-xs">
            <thead className="sticky top-0 bg-surface z-10">
              <tr>
                <th className="sticky left-0 bg-surface border-r border-border px-3 py-2 text-text-dim uppercase tracking-widest text-[10px]">
                  Delivery
                </th>
                {visibleColumns.map((col) => {
                  const isEditable = col.column_type === 'outright' || col.column_type === 'gasoil_futures';
                  const spanCount = isEditable ? 3 : 2;
                  return (
                    <th key={col.id} colSpan={spanCount} className="border-r border-border bg-surface">
                      <ColHeader col={col} onRemove={() => void handleRemoveColumn(col)} />
                    </th>
                  );
                })}
              </tr>
              <tr>
                <th className="sticky left-0 bg-surface border-r border-border border-t"></th>
                {visibleColumns.map((col) => {
                  const isEditable = col.column_type === 'outright' || col.column_type === 'gasoil_futures';
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
              {DEFAULT_DELIVERIES.map((delivery) => (
                <tr key={delivery} className="border-t border-border/50">
                  <td className="sticky left-0 bg-card border-r border-border px-3 py-1 text-text-primary font-semibold whitespace-nowrap">
                    {delivery}
                  </td>
                  {visibleColumns.map((col) => {
                    const cell = col.cells[delivery] ?? { bid: null, ask: null, value: null, value_spread: null };
                    const meta = snap.quote_meta[`${col.id}:${delivery}`];
                    const isEditable = col.column_type === 'outright' || col.column_type === 'gasoil_futures';
                    if (isEditable) {
                      return (
                        <>
                          <td key={`${col.id}-${delivery}-bid`} className="border-r border-border p-0 h-7 min-w-[70px]">
                            <QuoteCell col={col} delivery={delivery} side="BID" value={cell.bid} meta={meta?.BID} editable
                              onSave={(price) => void handleSaveQuote(col, delivery, 'BID', price)}
                              onDelete={() => void handleDeleteQuote(col, delivery, 'BID')} />
                          </td>
                          <td key={`${col.id}-${delivery}-ask`} className="border-r border-border p-0 h-7 min-w-[70px]">
                            <QuoteCell col={col} delivery={delivery} side="ASK" value={cell.ask} meta={meta?.ASK} editable
                              onSave={(price) => void handleSaveQuote(col, delivery, 'ASK', price)}
                              onDelete={() => void handleDeleteQuote(col, delivery, 'ASK')} />
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
                          <DerivedCell value={cell.value} />
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
          {visibleColumns.length === 0 && (
            <div className="p-8 text-center text-text-dim text-sm">
              No columns configured for this tab. Click <span className="text-accent font-semibold">+ Column</span> to add products.
            </div>
          )}
        </div>

        {/* Side panels */}
        <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
          <NotesPanel value={notes} onChange={setNotes} />
          <TickerPanel events={ticker} />
          <BlotterPanel />
          <BlasterPanel />
        </div>
      </div>

      {showAddModal && (
        <AddColumnModal
          onClose={() => setShowAddModal(false)}
          onAdd={(p) => void handleAddColumn(p)}
          existingLabels={visibleColumns.map((c) => c.label)}
        />
      )}
    </div>
  );
}
