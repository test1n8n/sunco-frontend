import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_BASE_URL, API_KEY } from '../../config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | { error?: string };
}

interface ChatResponse {
  answer: string;
  tool_calls: ToolCall[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

const STORAGE_KEY = 'sunco.ask.history.v1';
const MAX_TURNS_KEPT = 20;

const SAMPLE_QUESTIONS = [
  'How many trades were there yesterday?',
  'Show me the spreads in the last 7 days',
  'What dates do we have biodiesel trade data for?',
  'How did UCOME settle this week?',
  'Give me the recap by product for the last 14 days',
  'What was the market commentary on the most recent report?',
];

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  try {
    const trimmed = messages.slice(-MAX_TURNS_KEPT * 2);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full / unavailable — ignore
  }
}

function ToolCallChip({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const isError = typeof (call.output as { error?: string }).error === 'string';
  return (
    <div className={`text-[11px] mt-1 ${isError ? 'text-negative' : 'text-text-dim'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="font-mono inline-flex items-center gap-1 hover:text-text-primary"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>{isError ? '⚠' : '🛠'}</span>
        <span>{call.name}</span>
        <span className="text-text-dim">({Object.entries(call.input).map(([k, v]) => `${k}=${v}`).join(', ') || '—'})</span>
      </button>
      {open && (
        <pre className="mt-1 p-2 bg-surface/40 border border-border rounded text-[10px] font-mono text-text-secondary max-h-48 overflow-auto">
          {JSON.stringify(call.output, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function Ask() {
  const [history, setHistory] = useState<Message[]>(() => loadHistory());
  // Track tool calls per assistant turn (parallel array, indexed by message index in history)
  const [toolCallsByMsg, setToolCallsByMsg] = useState<Record<number, ToolCall[]>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { saveHistory(history); }, [history]);

  useEffect(() => {
    // Auto-scroll to latest message
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  const send = async (questionOverride?: string) => {
    const q = (questionOverride ?? input).trim();
    if (!q || loading) return;
    setError(null);
    setLoading(true);

    const userMsg: Message = { role: 'user', content: q };
    const next = [...history, userMsg];
    setHistory(next);
    setInput('');

    try {
      const res = await fetch(`${API_BASE_URL}/db-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data: ChatResponse = await res.json();
      const assistantMsg: Message = { role: 'assistant', content: data.answer || '(empty response)' };
      setHistory(prev => {
        const updated = [...prev, assistantMsg];
        if (data.tool_calls?.length) {
          setToolCallsByMsg(t => ({ ...t, [updated.length - 1]: data.tool_calls }));
        }
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
      setHistory(prev => prev.slice(0, -1)); // roll back the user message
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    setHistory([]);
    setToolCallsByMsg({});
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="space-y-5 max-w-4xl flex flex-col" style={{ minHeight: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b border-border">
        <div>
          <p className="text-text-dim text-xs tracking-widest uppercase mb-1">System</p>
          <h1 className="text-text-primary font-bold text-3xl mb-1">Ask the DB</h1>
          <p className="text-text-dim text-xs">
            Ask natural-language questions about your trades, settlements, and reports.
            All answers come from read-only queries against the platform's data.
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearChat}
            className="bg-card border border-border text-text-secondary px-3 py-2 rounded text-xs font-semibold hover:text-text-primary hover:border-accent/50 transition-colors uppercase tracking-widest"
          >
            Clear
          </button>
        )}
      </div>

      {/* Empty state with sample questions */}
      {history.length === 0 && !loading && (
        <div className="bg-card border border-border rounded p-5 space-y-3">
          <p className="text-text-secondary text-sm">Try one of these to get started:</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => void send(q)}
                disabled={loading}
                className="text-left text-xs bg-surface border border-border rounded px-3 py-2 hover:border-accent/50 hover:text-text-primary text-text-secondary transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4">
        {history.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                m.role === 'user'
                  ? 'bg-accent/10 border border-accent/30 text-text-primary'
                  : 'bg-card border border-border text-text-primary'
              }`}
            >
              <div className="text-[10px] uppercase tracking-widest text-text-dim mb-1">
                {m.role === 'user' ? 'You' : 'Assistant'}
              </div>
              {m.role === 'user' ? (
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              ) : (
                <div className="markdown-body leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h2 className="text-base font-bold uppercase tracking-widest mt-3 mb-2 text-text-primary">{children}</h2>,
                      h2: ({ children }) => <h3 className="text-sm font-bold uppercase tracking-widest mt-3 mb-2 text-text-primary">{children}</h3>,
                      h3: ({ children }) => <h4 className="text-xs font-bold uppercase tracking-widest mt-3 mb-1.5 text-text-secondary">{children}</h4>,
                      p: ({ children }) => <p className="my-2">{children}</p>,
                      strong: ({ children }) => <strong className="font-bold text-text-primary">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      hr: () => <hr className="my-3 border-border" />,
                      ul: ({ children }) => <ul className="my-2 ml-5 list-disc space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-sm">{children}</li>,
                      code: ({ children }) => <code className="px-1 py-0.5 rounded bg-surface/60 border border-border text-[12px] font-mono">{children}</code>,
                      pre: ({ children }) => <pre className="my-2 p-2 rounded bg-surface/60 border border-border text-[11px] font-mono overflow-x-auto">{children}</pre>,
                      blockquote: ({ children }) => <blockquote className="my-2 pl-3 border-l-2 border-accent/40 text-text-secondary italic">{children}</blockquote>,
                      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-hover">{children}</a>,
                      table: ({ children }) => (
                        <div className="my-3 overflow-x-auto">
                          <table className="w-full text-xs border-collapse">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
                      tbody: ({ children }) => <tbody>{children}</tbody>,
                      tr: ({ children }) => <tr className="border-b border-border/40">{children}</tr>,
                      th: ({ children }) => <th className="text-left py-1.5 px-2 font-semibold uppercase tracking-widest text-[10px] text-text-dim">{children}</th>,
                      td: ({ children }) => <td className="py-1.5 px-2 text-text-primary font-mono">{children}</td>,
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              )}
              {m.role === 'assistant' && toolCallsByMsg[i]?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                  <div className="text-[10px] uppercase tracking-widest text-text-dim">
                    Data sources used ({toolCallsByMsg[i].length})
                  </div>
                  {toolCallsByMsg[i].map((c, j) => <ToolCallChip key={j} call={c} />)}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-lg px-4 py-3 text-sm text-text-dim flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              Thinking…
            </div>
          </div>
        )}
        {error && (
          <div className="bg-negative/10 border border-negative/30 rounded px-4 py-3 text-sm text-negative">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-card border border-border rounded p-3 sticky bottom-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
            placeholder="Ask about trades, spreads, settlements, reports… (Enter to send, Shift+Enter for new line)"
            rows={2}
            disabled={loading}
            className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:border-accent resize-none disabled:opacity-50"
          />
          <button
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="bg-accent text-surface px-5 py-2 rounded text-xs font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 uppercase tracking-widest h-fit"
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
