import React, { useState, useEffect } from 'react';
import {
  RetrievalStrategy,
  QueryResponse,
  SampleQuery,
  CompareResponse,
} from '../types/api';
import { submitQuery, compareStrategies, fetchSampleQueries } from '../api/client';
import { formatScore, formatMs } from '../utils/format';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Panel } from './ui/Panel';

interface RagPlaygroundProps {
  onOpenDoc: (docId: string) => void;
}

export const RagPlayground: React.FC<RagPlaygroundProps> = ({ onOpenDoc }) => {
  const [query, setQuery] = useState('What is CVE-2021-44228 and what makes it dangerous?');
  const [strategy, setStrategy] = useState<RetrievalStrategy>('hybrid_rerank');
  const [router, setRouter] = useState(false);
  const [enableAcronymExpansion, setEnableAcronymExpansion] = useState(true);
  const autoFilterIdentifiers = false;
  const [floorMode, setFloorMode] = useState<string>('relative');
  const [floorThreshold, setFloorThreshold] = useState<number>(0.2);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);

  const [sampleQueries, setSampleQueries] = useState<SampleQuery[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetchSampleQueries()
      .then(setSampleQueries)
      .catch(() => {});
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setCompareResult(null);

    try {
      const resp = await submitQuery({
        query: query.trim(),
        strategy,
        router,
        enable_acronym_expansion: enableAcronymExpansion,
        auto_filter_identifiers: autoFilterIdentifiers,
        floor_mode: floorMode === 'off' ? 'off' : floorMode,
        floor_threshold: floorThreshold,
      });
      setResult(resp);
    } catch (err: unknown) {
      setError((err as Error).message || 'Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCompareAll = async () => {
    if (!query.trim()) return;
    setComparing(true);
    setError(null);

    try {
      const resp = await compareStrategies({
        query: query.trim(),
        strategies: ['dense', 'sparse', 'hybrid', 'hybrid_rerank'],
        enable_acronym_expansion: enableAcronymExpansion,
      });
      setCompareResult(resp);
    } catch (err: unknown) {
      setError((err as Error).message || 'Comparison failed');
    } finally {
      setComparing(false);
    }
  };

  const isAttack = (id?: string) => id?.startsWith('attack:') || id?.startsWith('T');
  const isCve = (id?: string) => id?.startsWith('cve:') || id?.startsWith('CVE');

  return (
    <div className="space-y-6">
      {/* Query Terminal Panel */}
      <Panel
        header={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <Badge variant="attack" size="sm">
                Stage 03
              </Badge>
              <span className="text-border text-xs">/</span>
              <h2 className="text-sm font-serif font-semibold text-ink-primary">
                Retrieval &amp; Grounding Playground
              </h2>
            </div>
            <span className="font-mono text-[11px] text-ink-faint hidden sm:inline">
              Extractive Zero-Hallucination Grounding
            </span>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-muted leading-relaxed">
            Execute queries across Dual-Vector Qdrant indexes (Dense LSA, Sparse BM25, Hybrid RRF k=60, and Lexical Overlap reranking) with provenance citation extraction.
          </p>

          {/* Benchmark Query Chips */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">
              Curated Benchmark Queries:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sampleQueries.map((sq, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setQuery(sq.query)}
                  className={`px-2.5 py-1 text-xs font-mono transition-all duration-150 border rounded-sm cursor-pointer ${
                    query === sq.query
                      ? 'bg-surface-3 text-ink-primary border-ink-primary font-semibold shadow-glow-sm'
                      : 'bg-surface-2 text-ink-muted border-border hover:border-border-strong hover:text-ink-primary'
                  }`}
                  title={`Class ${sq.class_id}: ${sq.notes}`}
                >
                  <span className="text-ink-faint mr-1">[{sq.category.replace('_', ' ')}]</span>
                  {sq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Query Form */}
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a cybersecurity question (e.g. CVE identifiers, ATT&CK techniques, tactics)..."
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-border text-ink-primary text-xs font-mono focus:outline-none focus:border-ink-primary rounded-sm transition-colors"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={loading || !query.trim()}
                loading={loading}
              >
                Execute Retrieval
              </Button>
            </div>

            {/* Strategy & Options Rail */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs font-mono text-ink-muted border-t border-border">
              <div className="flex items-center space-x-2">
                <span className="text-ink-faint text-[11px] uppercase">Strategy:</span>
                <div className="flex border border-border bg-surface-2 rounded-sm overflow-hidden p-0.5">
                  {(['hybrid_rerank', 'hybrid', 'sparse', 'dense'] as RetrievalStrategy[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStrategy(st)}
                      className={`px-3 py-1 text-xs font-mono transition-colors rounded-sm cursor-pointer ${
                        strategy === st
                          ? 'bg-surface-3 text-ink-primary font-bold shadow-sm'
                          : 'text-ink-muted hover:text-ink-primary'
                      }`}
                    >
                      {st === 'hybrid_rerank' ? 'Hybrid + Rerank' : st.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCompareAll}
                  disabled={comparing || loading}
                  loading={comparing}
                >
                  Compare 4 Strategies In Parallel
                </Button>

                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-ink-muted hover:text-ink-primary font-mono text-xs underline cursor-pointer"
                >
                  {showAdvanced ? '[-] options' : '[+] options'}
                </button>
              </div>
            </div>

            {/* Advanced Options Drawer */}
            {showAdvanced && (
              <div className="p-4 bg-surface-2 border border-border rounded-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={router}
                    onChange={(e) => setRouter(e.target.checked)}
                    className="rounded-none bg-surface-3 border-border text-ink-primary focus:ring-0"
                  />
                  <span className="text-ink-primary">Identifier Router (E4)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableAcronymExpansion}
                    onChange={(e) => setEnableAcronymExpansion(e.target.checked)}
                    className="rounded-none bg-surface-3 border-border text-ink-primary focus:ring-0"
                  />
                  <span className="text-ink-primary">Acronym Expansion (E4)</span>
                </label>

                <div className="space-y-1">
                  <div className="text-ink-muted text-[11px]">Floor mode:</div>
                  <select
                    value={floorMode}
                    onChange={(e) => setFloorMode(e.target.value)}
                    className="w-full px-2 py-1 bg-surface-3 border border-border text-ink-primary text-xs rounded-sm"
                  >
                    <option value="relative">Relative (20% top score)</option>
                    <option value="absolute">Absolute logit (0.0)</option>
                    <option value="off">Off (pass all)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="text-ink-muted text-[11px]">Cutoff threshold: {floorThreshold}</div>
                  <input
                    type="range"
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    value={floorThreshold}
                    onChange={(e) => setFloorThreshold(parseFloat(e.target.value))}
                    className="w-full accent-attack cursor-pointer"
                  />
                </div>
              </div>
            )}
          </form>
        </div>
      </Panel>

      {error && (
        <div className="p-3.5 border border-red-800/60 bg-red-950/20 text-red-300 text-xs font-mono rounded-sm flex items-center space-x-2">
          <span className="text-red-400 font-bold">✕ Error:</span>
          <span>{error}</span>
        </div>
      )}

      {/* Parallel Comparison Matrix View */}
      {compareResult && (
        <Panel
          header={
            <div className="flex items-center justify-between w-full">
              <h3 className="font-serif font-semibold text-sm text-ink-primary">
                Cross-Strategy Parallel Benchmark: &ldquo;{compareResult.query}&rdquo;
              </h3>
              <Badge variant="valid" size="sm">
                PARALLEL SYNERGY AUDIT
              </Badge>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(compareResult.comparisons).map(([stKey, resp]) => (
              <div
                key={stKey}
                className={`p-4 bg-surface-2 border rounded-sm space-y-3 flex flex-col justify-between ${
                  stKey === strategy ? 'border-attack shadow-glow-sm' : 'border-border'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold uppercase text-ink-primary">{stKey}</span>
                    <span className="text-ink-muted font-tabular">{formatMs(resp.execution_ms)}</span>
                  </div>

                  <div className="text-xs text-ink-muted max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap bg-[#08080B] p-3 border border-border font-serif rounded-sm">
                    {resp.answer || <span className="text-ink-faint italic">No extractive answer returned.</span>}
                  </div>
                </div>

                <div className="space-y-1 pt-2.5 border-t border-border text-[11px] font-mono text-ink-muted">
                  <div className="flex justify-between">
                    <span>Grounded:</span>
                    <span className={resp.grounded ? 'text-valid font-bold' : 'text-cve-warn'}>
                      {resp.grounded ? 'True' : 'False'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Citations:</span>
                    <span className="text-ink-primary font-tabular">{resp.citations.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Top doc:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const topId = resp.citations[0]?.doc_id;
                        if (topId) onOpenDoc(topId);
                      }}
                      className="text-attack hover:underline truncate max-w-[120px] cursor-pointer"
                      title={resp.citations[0]?.title}
                    >
                      {resp.citations[0]?.doc_id || 'None'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Main Single-Strategy Query Result */}
      {result && (
        <div className="space-y-6">
          {/* Latency & Grounding Telemetry Strip */}
          <div className="p-3.5 border border-border bg-surface-1 rounded-sm flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <Badge variant="default" size="sm">
                {result.retrieval.strategy}
              </Badge>
              {result.retrieval.router_routed_to && (
                <span className="text-cve-warn">
                  (routed to {result.retrieval.router_routed_to})
                </span>
              )}
              <Badge variant={result.grounded ? 'valid' : 'warn'} size="sm">
                {result.grounded ? '● Grounded in Evidence' : '○ Abstained / Below Floor'}
              </Badge>
            </div>

            <div className="flex items-center space-x-4 text-ink-muted font-tabular text-[11px]">
              <span>total: <strong className="text-ink-primary font-normal">{formatMs(result.latency_ms.total_ms)}</strong></span>
              <span>retrieval: <strong className="text-ink-primary font-normal">{formatMs(result.latency_ms.retrieval_ms ?? 0)}</strong></span>
              <span>rerank: <strong className="text-ink-primary font-normal">{formatMs(result.latency_ms.reranking_ms ?? 0)}</strong></span>
              <span>gen: <strong className="text-ink-primary font-normal">{formatMs(result.latency_ms.generation_ms ?? 0)}</strong></span>
            </div>
          </div>

          {/* Extractive Grounded Synthesis */}
          <Panel
            header={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-valid shadow-glow-valid" />
                  <h3 className="font-serif font-semibold text-sm text-ink-primary">
                    Extractive Grounded Synthesis
                  </h3>
                </div>
                <span className="font-mono text-xs text-ink-faint">
                  {result.citations.length} cited source{result.citations.length === 1 ? '' : 's'}
                </span>
              </div>
            }
            footer={
              <div className="text-[11px] font-mono text-ink-faint">
                ExtractiveLocalProvider extracts verifiable source-grounded sentences directly from top-ranked chunks with zero hallucination.
              </div>
            }
          >
            <div className="p-4 bg-[#08080A] border border-border text-sm text-ink-primary leading-relaxed font-serif whitespace-pre-wrap rounded-sm selection:bg-surface-3">
              {result.answer}
            </div>
          </Panel>

          {/* Retrieved Evidence Chunks (Archival Paper Dossier Style) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center space-x-2">
                <h3 className="font-serif font-semibold text-sm text-ink-primary">
                  Retrieved Forensic Evidence Chunks
                </h3>
                <Badge variant="neutral" size="sm">
                  {result.citations.length} retained
                </Badge>
              </div>
              <span className="font-mono text-xs text-ink-muted">
                Floor mode: <strong className="text-ink-primary font-normal">{result.retrieval.floor_mode ?? 'relative'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.citations.map((c) => {
                const isAtt = isAttack(c.doc_id || c.chunk_id);
                const isCv = isCve(c.doc_id || c.chunk_id);

                return (
                  <div
                    key={c.chunk_id || c.marker}
                    className="evidence-paper p-4 border rounded-sm flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2.5">
                      <div className="evidence-paper-header pb-2 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-5 h-5 font-bold flex items-center justify-center text-[10px] rounded-sm ${
                              isAtt
                                ? 'bg-attack text-canvas'
                                : isCv
                                ? 'bg-cve-warn text-canvas'
                                : 'bg-paper-ink text-paper-bg'
                            }`}
                          >
                            {c.marker}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenDoc(c.doc_id || c.chunk_id)}
                            className="font-bold underline hover:opacity-80 cursor-pointer font-mono text-xs"
                          >
                            {c.doc_id || c.chunk_id}
                          </button>
                        </div>
                        <span className="text-[11px] font-mono text-paper-muted font-tabular">
                          score: {formatScore(c.score, 4)}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-serif font-semibold text-sm text-paper-ink leading-snug">
                          {c.title}
                        </h4>
                        {c.section && (
                          <div className="text-[11px] font-mono text-paper-muted mt-0.5">
                            section: {c.section}
                          </div>
                        )}
                      </div>

                      {c.excerpt && (
                        <p className="text-xs font-serif leading-relaxed text-paper-ink/90 line-clamp-4 bg-paper-bg p-2.5 border border-paper-border/80 rounded-sm">
                          &ldquo;{c.excerpt}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-paper-border/60 flex items-center justify-between text-[11px] font-mono text-paper-muted">
                      <span>Source: {c.source}</span>
                      <button
                        type="button"
                        onClick={() => onOpenDoc(c.doc_id || c.chunk_id)}
                        className="font-semibold underline text-paper-ink hover:opacity-80 cursor-pointer"
                      >
                        Inspect Document &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
