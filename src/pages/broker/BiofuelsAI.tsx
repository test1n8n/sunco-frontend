import { useState, useRef, useEffect } from 'react';
import { API_BASE_URL, API_KEY } from '../../config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

interface Source {
  title: string;
  source: string;
  source_type: string;
  similarity: number;
}

const SUGGESTED_QUESTIONS = [
  'What is the current regulatory status of UCO as a biofuel feedstock under RED III?',
  'How does the German THG-Quote mandate work and what are the current quotas?',
  'What are the GHG savings thresholds for advanced biofuels under RED III?',
  'What is the difference between FAME, HVO, and SAF from a market perspective?',
  'How does the ReFuelEU SAF mandate affect the aviation fuel market?',
  'What are the main price drivers for UCOME in the ARA market?',
];

function SourceBadge({ source }: { source: Source }) {
  const typeColour: Record<string, string> = {
    regulatory: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    knowledge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    article: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    historical_event: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  const colour = typeColour[source.source_type] ?? 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  const label = source.source_type === 'historical_event' ? 'history' : source.source_type;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${colour}`}>
      <span className="opacity-60 text-[10px] uppercase tracking-wider">{label}</span>
      <span className="truncate max-w-[180px]">{source.source}</span>
    </span>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] bg-accent/15 border border-accent/20 rounded-2xl rounded-tr-sm px-4 py-3">
        <p className="text-text-primary text-sm leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

function AssistantBubble({ content, sources }: { content: string; sources?: Source[] }) {
  // Very simple markdown-like rendering: bold **text**, newlines
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={j} className="font-semibold text-text-primary">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{part}</span>
            )
          )}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
            <span className="text-accent text-[10px] font-bold">AI</span>
          </div>
          <span className="text-text-dim text-xs uppercase tracking-widest font-semibold">Biofuels AI</span>
        </div>
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
          <p className="text-text-secondary text-sm leading-relaxed">{renderContent(content)}</p>
        </div>
        {sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {sources.map((s, i) => (
              <SourceBadge key={i} source={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
          <span className="text-accent text-[10px] font-bold">AI</span>
        </div>
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="flex gap-1 items-center h-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BiofuelsAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError('');
    const userMsg: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          message: trimmed,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { answer: string; sources: Source[] };
      setMessages([
        ...newMessages,
        { role: 'assistant', content: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response. Please try again.');
      setMessages(newMessages); // keep user message
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] max-w-4xl mx-auto">

      {/* Empty state / welcome */}
      {isEmpty && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center mx-auto mb-4">
              <span className="text-accent font-bold text-lg">AI</span>
            </div>
            <h2 className="text-text-primary font-semibold text-lg mb-1">Biofuels AI</h2>
            <p className="text-text-secondary text-sm max-w-sm">
              Ask anything about biofuel markets, regulations, feedstocks, or pricing.
              Powered by Claude with your live knowledge base.
            </p>
          </div>

          <div className="grid gap-2 w-full max-w-2xl sm:grid-cols-2">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => void sendMessage(q)}
                className="text-left px-4 py-3 bg-card border border-border hover:border-accent/40 hover:bg-card/80 rounded-lg text-text-secondary hover:text-text-primary text-xs leading-relaxed transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message thread */}
      {!isEmpty && (
        <div className="flex-1 overflow-y-auto py-6 px-2 space-y-5">
          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              <UserBubble key={i} content={msg.content} />
            ) : (
              <AssistantBubble key={i} content={msg.content} sources={msg.sources} />
            )
          )}
          {loading && <ThinkingBubble />}
          {error && (
            <div className="flex justify-center">
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded">
                {error}
              </p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-border bg-panel px-4 py-3">
        <div className="flex items-end gap-3 bg-card border border-border rounded-xl px-4 py-2 focus-within:border-accent/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about biofuels markets, regulations, or pricing..."
            rows={1}
            className="flex-1 bg-transparent text-text-primary text-sm placeholder:text-text-dim resize-none outline-none py-1.5 max-h-32"
            style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
            disabled={loading}
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent hover:bg-accent/80 disabled:bg-accent/20 disabled:cursor-not-allowed flex items-center justify-center transition-colors mb-0.5"
            aria-label="Send"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-text-dim text-[10px] text-center mt-2 tracking-wide">
          ENTER to send · SHIFT+ENTER for new line · Answers grounded in your live knowledge base
        </p>
      </div>
    </div>
  );
}
