import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import { useToast, ToastContainer } from '../../components/Toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ResearchCountry {
  code: string;
  name_en: string;
}

interface ResearchStatus {
  research_id: string;
  status: string;
  progress_pct: number;
}

interface ResearchListItem {
  research_id: string;
  brief: string;
  status: string;
  country_code: string;
  report_title: string;
  created_at: string;
}

interface Footnote {
  id: number;
  text: string;
  source_url: string;
  source_tier: number;
}

interface BibSource {
  url: string;
  title: string;
  tier: number;
  tier_label: string;
}

interface VerificationSummary {
  total_claims: number;
  verified: number;
  removed: number;
  by_tier: Record<string, number>;
}

interface FullResearchReport {
  research_id: string;
  brief: string;
  country_code: string;
  status: string;
  report_title: string;
  report_body: string;
  footnotes: Footnote[];
  bibliography: BibSource[];
  verification_summary: VerificationSummary;
  source_breakdown: Record<string, number>;
  confidence_scores: Record<string, string>;
  created_at: string;
  completed_at: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STAGES = [
  { key: 'planning', label: 'Planning', desc: 'Breaking down research questions...' },
  { key: 'searching', label: 'Searching', desc: 'Searching the web for sources...' },
  { key: 'synthesizing', label: 'Synthesizing', desc: 'Cross-referencing findings...' },
  { key: 'verifying', label: 'Verifying', desc: 'Fact-checking all claims...' },
  { key: 'writing', label: 'Writing', desc: 'Composing final report...' },
  { key: 'done', label: 'Done', desc: 'Research complete' },
];

const TIER_LABELS: Record<number, string> = {
  1: 'Primary Authority',
  2: 'Institutional Data',
  3: 'Industry Bodies',
  4: 'Trade Press',
  5: 'Analyst Commentary',
};

const TIER_COLORS: Record<number, string> = {
  1: 'text-positive',
  2: 'text-accent',
  3: 'text-text-primary',
  4: 'text-text-secondary',
  5: 'text-text-dim',
};

const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    done: 'bg-positive/10 text-positive border border-positive/20',
    failed: 'bg-negative/10 text-negative border border-negative/20',
    running: 'bg-accent/10 text-accent border border-accent/20',
  };
  const style = styles[status] ?? 'bg-border/50 text-text-dim border border-border';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${style}`}>
      {status}
    </span>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const color = TIER_COLORS[tier] ?? 'text-text-dim';
  const label = TIER_LABELS[tier] ?? `Tier ${tier}`;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border border-border bg-surface ${color}`}>
      T{tier} {label}
    </span>
  );
}

function ConfidenceDots({ level }: { level: string }) {
  const normalized = level.toLowerCase();
  const config: Record<string, { filled: number; color: string }> = {
    high: { filled: 5, color: 'text-positive' },
    good: { filled: 4, color: 'text-accent' },
    moderate: { filled: 3, color: 'text-accent' },
    low: { filled: 2, color: 'text-negative' },
  };
  const { filled, color } = config[normalized] ?? { filled: 3, color: 'text-text-dim' };
  return (
    <span className={`text-xs font-mono ${color}`} title={level.toUpperCase()}>
      {'■'.repeat(filled)}{'□'.repeat(5 - filled)}{' '}
      <span className="uppercase text-xs">{level}</span>
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ResearchEngine() {
  // Form state
  const [brief, setBrief] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [countries, setCountries] = useState<ResearchCountry[]>([]);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Progress state
  const [_researchId, setResearchId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [_polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Report state
  const [report, setReport] = useState<FullResearchReport | null>(null);

  // List state
  const [pastResearch, setPastResearch] = useState<ResearchListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // General state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, showToast, dismissToast } = useToast();

  // View: 'form' | 'progress' | 'report'
  const [view, setView] = useState<'form' | 'progress' | 'report'>('form');

  // ── Fetch countries on mount ──────────────────────────────────────────────

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/research/countries`, {
          headers: { 'X-API-Key': API_KEY },
        });
        if (res.ok) {
          const data = (await res.json()) as ResearchCountry[];
          setCountries(data);
        }
      } catch {
        // Countries are optional; silently fail
      }
    };
    void loadCountries();
  }, []);

  // ── Fetch past research list ──────────────────────────────────────────────

  const fetchPastResearch = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${API_BASE_URL}/research/list`, {
        headers: { 'X-API-Key': API_KEY },
      });
      if (res.ok) {
        const data = (await res.json()) as ResearchListItem[];
        setPastResearch(data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void fetchPastResearch();
  }, [fetchPastResearch]);

  // ── Cleanup polling on unmount ────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── File handling ─────────────────────────────────────────────────────────

  const validateAndAddFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const valid: File[] = [];

    for (const f of incoming) {
      if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
        showToast('error', `"${f.name}" is not a PDF file`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        showToast('error', `"${f.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit`);
        continue;
      }
      valid.push(f);
    }

    setPdfFiles((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_FILES) {
        showToast('error', `Maximum ${MAX_FILES} files allowed`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeFile = (idx: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Submit research ───────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!brief.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('brief', brief.trim());
      if (countryCode) formData.append('country_code', countryCode);
      for (const file of pdfFiles) {
        formData.append('files', file);
      }

      const res = await fetch(`${API_BASE_URL}/research/start`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { research_id: string; status: string };
      setResearchId(data.research_id);
      setCurrentStatus(data.status);
      setView('progress');
      startPolling(data.research_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start research';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Polling ───────────────────────────────────────────────────────────────

  const startPolling = (id: string) => {
    setPolling(true);
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/research/${id}/status`, {
          headers: { 'X-API-Key': API_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ResearchStatus;
        setCurrentStatus(data.status);

        if (data.status === 'done') {
          stopPolling();
          await loadFullReport(id);
        } else if (data.status === 'failed') {
          stopPolling();
          setError('Research failed. Please try again with a different brief.');
        }
      } catch {
        showToast('error', 'Connection lost. Retrying...');
      }
    }, 3000);
  };

  const stopPolling = () => {
    setPolling(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // ── Load full report ──────────────────────────────────────────────────────

  const loadFullReport = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/research/${id}`, {
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FullResearchReport;
      setReport(data);
      setResearchId(data.research_id);
      setView('report');
      void fetchPastResearch();
    } catch {
      showToast('error', 'Failed to load report');
    }
  };

  // ── Back to form ──────────────────────────────────────────────────────────

  const handleBackToForm = () => {
    stopPolling();
    setView('form');
    setResearchId(null);
    setCurrentStatus(null);
    setError(null);
    setReport(null);
  };

  const handleNewResearch = () => {
    handleBackToForm();
    setBrief('');
    setCountryCode('');
    setPdfFiles([]);
  };

  // ── Load past report ──────────────────────────────────────────────────────

  const handleLoadPastReport = (item: ResearchListItem) => {
    if (item.status === 'done') {
      void loadFullReport(item.research_id);
    } else if (item.status === 'failed') {
      showToast('error', 'This research failed. Start a new one.');
    } else {
      // Still running — start polling
      setResearchId(item.research_id);
      setCurrentStatus(item.status);
      setView('progress');
      startPolling(item.research_id);
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  // ── Progress View ─────────────────────────────────────────────────────────

  if (view === 'progress') {
    const activeIdx = STAGES.findIndex((s) => s.key === currentStatus);
    const activeStage = STAGES[activeIdx >= 0 ? activeIdx : 0];

    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <ToastContainer toasts={toasts} dismissToast={dismissToast} />

        <div className="text-center">
          <h1 className="text-xl font-bold text-text-primary mb-1">Research in Progress</h1>
          <p className="text-text-dim text-sm">Your AI research assistant is working...</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-negative/10 border border-negative/30 rounded p-4 text-negative text-sm">
            {error}
          </div>
        )}

        {/* Stage tracker */}
        <div className="bg-card border border-border rounded p-6">
          <div className="flex items-center justify-between gap-1 mb-6">
            {STAGES.map((stage, idx) => {
              const isActive = idx === activeIdx;
              const isCompleted = activeIdx > idx;
              const isFuture = idx > activeIdx;

              let pillClass = 'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ';
              if (isCompleted) {
                pillClass += 'bg-positive/10 text-positive border-positive/20';
              } else if (isActive) {
                pillClass += 'bg-accent/10 text-accent border-accent/20';
              } else {
                pillClass += 'bg-surface text-text-dim border-border';
              }

              return (
                <div key={stage.key} className="flex items-center gap-1">
                  <span className={pillClass}>
                    {isCompleted ? '✓ ' : ''}{stage.label}
                  </span>
                  {idx < STAGES.length - 1 && (
                    <span className={`text-xs ${isFuture ? 'text-border' : 'text-positive'}`}>
                      &mdash;
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Status text */}
          {!error && (
            <div className="flex items-center justify-center gap-3 text-sm text-text-secondary">
              <Spinner />
              <span>{activeStage.desc}</span>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleBackToForm}
            className="px-4 py-2 text-sm font-semibold text-text-secondary border border-border rounded hover:bg-surface transition-colors"
          >
            &larr; Back
          </button>
        </div>
      </div>
    );
  }

  // ── Report View ───────────────────────────────────────────────────────────

  if (view === 'report' && report) {
    const vs = report.verification_summary;
    const unverified = vs.total_claims - vs.verified - vs.removed;
    const bibByTier = [1, 2, 3, 4, 5]
      .map((t) => ({
        tier: t,
        label: TIER_LABELS[t],
        sources: report.bibliography.filter((s) => s.tier === t),
      }))
      .filter((g) => g.sources.length > 0);

    return (
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">
        <ToastContainer toasts={toasts} dismissToast={dismissToast} />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{report.report_title}</h1>
            {report.completed_at && (
              <p className="text-text-dim text-xs mt-1">
                Completed {formatDate(report.completed_at)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <button
              onClick={handleNewResearch}
              className="px-4 py-2 text-sm font-semibold text-text-secondary border border-border rounded hover:bg-surface transition-colors"
            >
              New Research
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-semibold text-accent border border-accent/30 rounded hover:bg-accent/10 transition-colors"
            >
              Download PDF
            </button>
          </div>
        </div>

        {/* Verification Summary */}
        <div className="bg-card border border-border rounded p-5">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">
            Verification Summary
          </h2>
          <div className="flex flex-wrap gap-6">
            <div>
              <span className="text-2xl font-bold text-positive">{vs.verified}</span>
              <span className="text-text-dim text-sm ml-1">claims verified</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-negative">{vs.removed}</span>
              <span className="text-text-dim text-sm ml-1">claims removed</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-text-dim">{unverified}</span>
              <span className="text-text-dim text-sm ml-1">unverified</span>
            </div>
          </div>
        </div>

        {/* Source Quality */}
        <div className="bg-card border border-border rounded p-5">
          <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">
            Source Quality
          </h2>
          <div className="flex flex-wrap gap-4">
            {[1, 2, 3, 4, 5].map((tier) => {
              const count = report.source_breakdown[String(tier)] ?? 0;
              if (count === 0) return null;
              const color = TIER_COLORS[tier];
              return (
                <div key={tier} className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${color}`}>Tier {tier}: {count}</span>
                  <span className="text-text-dim text-xs">{TIER_LABELS[tier]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Report body */}
        <div className="bg-card border border-border rounded p-6">
          <div
            className="prose prose-sm max-w-none text-sm leading-relaxed text-text-primary
              [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-text-primary [&_h1]:mt-6 [&_h1]:mb-3
              [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-text-primary [&_h2]:mt-5 [&_h2]:mb-2
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-text-primary [&_h3]:mt-4 [&_h3]:mb-2
              [&_p]:mb-3 [&_p]:text-text-secondary
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
              [&_li]:text-text-secondary [&_li]:mb-1
              [&_a]:text-accent [&_a]:underline
              [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-dim
              [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs
              [&_th]:bg-surface [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-text-dim [&_th]:uppercase [&_th]:tracking-widest
              [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2
              [&_sup]:text-accent [&_sup]:font-semibold [&_sup]:cursor-pointer"
            dangerouslySetInnerHTML={{ __html: report.report_body }}
          />
        </div>

        {/* Per-section confidence */}
        {report.confidence_scores && Object.keys(report.confidence_scores).length > 0 && (
          <div className="bg-card border border-border rounded p-5">
            <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">
              Section Confidence
            </h2>
            <div className="space-y-2">
              {Object.entries(report.confidence_scores).map(([section, level]) => (
                <div key={section} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-text-secondary">{section}</span>
                  <ConfidenceDots level={level} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footnotes */}
        {report.footnotes.length > 0 && (
          <div className="bg-card border border-border rounded p-5">
            <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">
              Footnotes
            </h2>
            <div className="space-y-3">
              {report.footnotes.map((fn) => (
                <div key={fn.id} className="flex items-start gap-3 text-sm">
                  <span className="text-accent font-bold text-xs mt-0.5 shrink-0">
                    [{fn.id}]
                  </span>
                  <div className="flex-1">
                    <p className="text-text-secondary">{fn.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <a
                        href={fn.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent text-xs hover:underline truncate max-w-md"
                      >
                        {fn.source_url}
                      </a>
                      <TierBadge tier={fn.source_tier} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bibliography */}
        {bibByTier.length > 0 && (
          <div className="bg-card border border-border rounded p-5">
            <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-4">
              Bibliography
            </h2>
            <div className="space-y-5">
              {bibByTier.map((group) => (
                <div key={group.tier}>
                  <h3 className={`text-sm font-semibold mb-2 ${TIER_COLORS[group.tier]}`}>
                    Tier {group.tier}: {group.label}
                  </h3>
                  <ul className="space-y-2 pl-1">
                    {group.sources.map((src, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-text-dim mt-0.5 shrink-0">-</span>
                        <div>
                          <span className="text-text-primary">{src.title}</span>
                          <br />
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent text-xs hover:underline truncate"
                          >
                            {src.url}
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Form View (default) ───────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-1">Research Engine</h1>
        <p className="text-text-dim text-sm">
          Deep AI-powered research on biofuels regulation, markets, and policy
        </p>
      </div>

      {/* Input form */}
      <div className="bg-card border border-border rounded p-6 space-y-5">
        {/* Brief */}
        <div>
          <label className="block text-text-dim font-semibold text-xs uppercase tracking-widest mb-2">
            Research Brief
          </label>
          <textarea
            rows={6}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe your research topic in detail. E.g., 'Analyze the impact of RED III Article 29 amendments on UCO double-counting eligibility in Germany, including the national transposition timeline and impact on THG-Quote certificate pricing...'"
            className="w-full bg-surface border border-border rounded px-4 py-3 text-sm text-text-primary placeholder-text-dim/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 resize-vertical"
          />
        </div>

        {/* Country dropdown */}
        <div>
          <label className="block text-text-dim font-semibold text-xs uppercase tracking-widest mb-2">
            Country (optional)
          </label>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-full bg-surface border border-border rounded px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          >
            <option value="">Auto-detect from brief</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name_en}
              </option>
            ))}
          </select>
        </div>

        {/* PDF Upload */}
        <div>
          <label className="block text-text-dim font-semibold text-xs uppercase tracking-widest mb-2">
            Reference PDFs (optional, max {MAX_FILES})
          </label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded p-6 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/40 hover:bg-surface/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-text-dim text-sm">
              Drop PDF files here or <span className="text-accent font-semibold">click to select</span>
            </p>
            <p className="text-text-dim text-xs mt-1">
              Max {MAX_FILE_SIZE_MB}MB per file
            </p>
          </div>

          {/* File list */}
          {pdfFiles.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {pdfFiles.map((file, idx) => (
                <li
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between bg-surface border border-border rounded px-3 py-2 text-sm"
                >
                  <span className="text-text-primary truncate flex-1">{file.name}</span>
                  <span className="text-text-dim text-xs mx-3">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                    className="text-text-dim hover:text-negative text-sm font-bold px-1"
                    title="Remove"
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Submit button */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!brief.trim() || submitting}
            className="px-6 py-2.5 bg-accent text-white text-sm font-semibold rounded hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {submitting && <Spinner />}
            Start Research
          </button>
        </div>
      </div>

      {/* Past Research */}
      <div>
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-3">
          Past Research
        </h2>

        {loadingList ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : pastResearch.length === 0 ? (
          <p className="text-text-dim text-sm italic py-4">
            No previous research reports yet.
          </p>
        ) : (
          <div className="bg-card border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left px-4 py-3 text-text-dim font-semibold text-xs uppercase tracking-widest">Brief</th>
                  <th className="text-left px-4 py-3 text-text-dim font-semibold text-xs uppercase tracking-widest hidden sm:table-cell">Country</th>
                  <th className="text-center px-4 py-3 text-text-dim font-semibold text-xs uppercase tracking-widest">Status</th>
                  <th className="text-right px-4 py-3 text-text-dim font-semibold text-xs uppercase tracking-widest">Date</th>
                </tr>
              </thead>
              <tbody>
                {pastResearch.map((item, idx) => (
                  <tr
                    key={item.research_id}
                    onClick={() => handleLoadPastReport(item)}
                    className={`border-b border-border/50 cursor-pointer hover:bg-surface/60 transition-colors ${
                      idx % 2 === 0 ? 'bg-card' : 'bg-surface/40'
                    }`}
                  >
                    <td className="px-4 py-3 text-text-primary">
                      {item.brief.length > 80 ? item.brief.slice(0, 80) + '...' : item.brief}
                    </td>
                    <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">
                      {item.country_code || '---'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-text-dim text-xs">
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
