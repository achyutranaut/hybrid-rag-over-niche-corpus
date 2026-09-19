import React, { useState, useEffect } from 'react';
import {
  RetrievalStrategy,
  QueryResponse,
  SampleQuery,
  CompareResponse,
} from '../types/api';
import { submitQuery, compareStrategies, fetchSampleQueries } from '../api/client';
import { formatScore } from '../utils/format';

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
      {/* Header & Query Execution Form */}
      <div className="border border-border bg-surface-1 p-5 space-y-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              Pipeline Stage 03
            </span>
            <span className="text-border text-xs">/</span>
            <h2 className="text-base font-serif font-semibold text-ink-primary">
              Retrieval &amp; Grounding Playground
            </h2>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Execute queries across Dense, Sparse (BM25), Hybrid RRF, and Cross-Encoder reranked pipelines with citation extraction.
          </p>
        </div>

        {/* Sample Queries Shortcuts */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
            Benchmark Queries:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sampleQueries.map((sq, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuery(sq.query)}
                className={`px-2.5 py-1 text-xs font-mono transition-colors border ${
                  query === sq.query
                    ? 'bg-surface-3 text-ink-primary border-ink-primary font-semibold'
                    : 'bg-surface-2 text-ink-muted border-border hover:border-border-strong hover:text-ink-primary'
                }`}
                title={`Class ${sq.class_id}: ${sq.notes}`}
              >
                <span className="text-ink-faint mr-1.5">[{sq.category.replace('_', ' ')}]</span>
                {sq.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Query Form */}
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a cybersecurity question (e.g. CVE identifiers, ATT&CK techniques, tactics)..."
              className="flex-1 px-3.5 py-2.5 bg-surface-2 border border-border text-ink-primary text-xs font-mono focus:outline-none focus:border-ink-primary"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-5 py-2.5 bg-surface-3 hover:bg-border text-ink-primary border border-border disabled:opacity-50 text-xs font-mono transition-colors flex-shrink-0"
            >
              {loading ? 'Retrieving…' : 'Execute Retrieval'}
            </button>
          </div>

          {/* Strategy & Compare Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono text-ink-muted border-t border-border">
            <div className="flex items-center space-x-2">
              <span>Strategy:</span>
              <div className="flex border border-border bg-surface-2">
                {(['hybrid_rerank', 'hybrid', 'sparse', 'dense'] as RetrievalStrategy[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStrategy(st)}
                    className={`px-3 py-1 text-xs font-mono transition-colors ${
                      strategy === st
                        ? 'bg-surface-3 text-ink-primary font-bold border-b border-ink-primary'
                        : 'text-ink-muted hover:text-ink-primary'
                    }`}
                  >
                    {st === 'hybrid_rerank' ? 'Hybrid + Rerank' : st.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleCompareAll}
                disabled={comparing || loading}
                className="px-3 py-1 bg-surface-2 hover:bg-surface-3 text-ink-primary border border-border transition-colors text-xs font-mono"
              >
                {comparing ? 'Comparing…' : 'Compare 4 Strategies In Parallel'}
              </button>

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-ink-muted hover:text-ink-primary font-mono text-xs underline"
              >
                {showAdvanced ? 'hide options' : 'advanced options'}
              </button>
            </div>
          </div>

          {/* Advanced Options Drawer */}
          {showAdvanced && (
            <div className="p-4 bg-surface-2 border border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
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
                <div className="text-ink-muted">Floor mode:</div>
                <select
                  value={floorMode}
                  onChange={(e) => setFloorMode(e.target.value)}
                  className="w-full px-2 py-1 bg-surface-3 border border-border text-ink-primary text-xs"
                >
                  <option value="relative">Relative (20% top score)</option>
                  <option value="absolute">Absolute logit (0.0)</option>
                  <option value="off">Off (pass all)</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="text-ink-muted">Cutoff threshold: {floorThreshold}</div>
                <input
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  value={floorThreshold}
                  onChange={(e) => setFloorThreshold(parseFloat(e.target.value))}
                  className="w-full accent-ink-primary cursor-pointer"
                />
              </div>
            </div>
          )}
        </form>
      </div>

      {error && (
        <div className="p-3 border border-cve-crit/40 bg-surface-1 text-cve-crit text-xs font-mono">
          Query execution error: {error}
        </div>
      )}

      {/* Cross-Strategy Parallel Comparison Result */}
      {compareResult && (
        <div className="border border-border bg-surface-1 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-serif font-semibold text-sm text-ink-primary">
              Cross-Strategy Parallel Execution for: &ldquo;{compareResult.query}&rdquo;
            </h3>
            <span className="font-mono text-[11px] text-ink-muted">Parallel Benchmark</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(compareResult.comparisons).map(([stKey, resp]) => (
              <div
                key={stKey}
                className={`p-4 bg-surface-2 border space-y-3 flex flex-col justify-between ${
                  stKey === strategy ? 'border-ink-primary' : 'border-border'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold uppercase text-ink-primary">{stKey}</span>
                    <span className="text-ink-muted">{resp.execution_ms} ms</span>
                  </div>

                  <div className="text-xs text-ink-muted max-h-36 overflow-y-auto leading-relaxed whitespace-pre-wrap bg-[#0A0A0B] p-2.5 border border-border font-serif">
                    {resp.answer || <span className="text-ink-faint italic">No extractive answer returned.</span>}
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-border text-[11px] font-mono text-ink-muted">
                  <div className="flex justify-between">
                    <span>Grounded:</span>
                    <span className={resp.grounded ? 'text-valid font-bold' : 'text-cve-warn'}>
                      {resp.grounded ? 'True' : 'False'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Citations:</span>
                    <span className="text-ink-primary">{resp.citations.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Top candidate:</span>
                    <span className="text-ink-primary truncate max-w-[110px]" title={resp.citations[0]?.title}>
                      {resp.citations[0]?.doc_id || 'None'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Single-Strategy Query Result */}
      {result && (
        <div className="space-y-6">
          {/* Latency & Grounding Strip */}
          <div className="p-3 border border-border bg-surface-1 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-surface-2 border border-border uppercase font-semibold text-ink-primary">
                {result.retrieval.strategy}
              </span>
              {result.retrieval.router_routed_to && (
                <span className="text-cve-warn">
                  (routed to {result.retrieval.router_routed_to})
                </span>
              )}
              <span
                className={`px-2 py-0.5 border ${
                  result.grounded
                    ? 'border-valid/40 bg-surface-2 text-valid font-medium'
                    : 'border-cve-warn/40 bg-surface-2 text-cve-warn'
                }`}
              >
                {result.grounded ? '● Grounded in Evidence' : '○ Abstained / Below Floor'}
              </span>
            </div>

            <div className="flex items-center space-x-3 text-ink-muted">
              <span>total: <strong className="text-ink-primary">{result.latency_ms.total_ms} ms</strong></span>
              <span>retrieval: <strong className="text-ink-primary">{result.latency_ms.retrieval_ms ?? 0} ms</strong></span>
              <span>rerank: <strong className="text-ink-primary">{result.latency_ms.reranking_ms ?? 0} ms</strong></span>
              <span>gen: <strong className="text-ink-primary">{result.latency_ms.generation_ms ?? 0} ms</strong></span>
            </div>
          </div>

          {/* Generated Answer with Warm Archival Evidence Citation */}
          <div className="border border-border bg-surface-1 p-5 space-y-3">
            <div className="border-b border-border pb-2 flex items-center justify-between">
              <h3 className="font-serif font-semibold text-sm text-ink-primary">
                Extractive Grounded Synthesis
              </h3>
              <span className="font-mono text-xs text-ink-muted">
                {result.citations.length} cited source{result.citations.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="p-4 bg-[#0A0A0B] border border-border text-sm text-ink-primary leading-relaxed font-serif whitespace-pre-wrap">
              {result.answer}
            </div>

            <div className="text-[11px] font-mono text-ink-muted">
              Generated via ExtractiveLocalProvider: Extracts source-grounded sentences directly from top reranked chunks without hallucination.
            </div>
          </div>

          {/* Retrieved Evidence Chunks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <h3 className="font-serif font-semibold text-sm text-ink-primary">
                Retrieved Forensic Evidence Chunks ({result.citations.length})
              </h3>
              <span className="font-mono text-xs text-ink-muted">
                Floor: {result.retrieval.floor_mode ?? 'relative'} ({result.retrieval.above_relevance_floor ?? result.citations.length} retained)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.citations.map((c) => {
                const isAtt = isAttack(c.doc_id || c.chunk_id);
                const isCv = isCve(c.doc_id || c.chunk_id);

                return (
                  <div
                    key={c.chunk_id || c.marker}
                    className="evidence-paper p-4 border border-paper-border flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="evidence-paper-header pb-1.5 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-5 h-5 rounded-none font-bold flex items-center justify-center text-[10px] ${
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
                            className="font-bold underline hover:opacity-80"
                          >
                            {c.doc_id || c.chunk_id}
                          </button>
                          {c.chunk_id && c.chunk_id !== (c.doc_id || c.chunk_id) && (
                            <span className="text-[10px] font-mono text-paper-muted">
                              ({c.chunk_id.includes('::') ? c.chunk_id.split('::')[1] : c.chunk_id})
                            </span>
                          )}
                        </div>
                        <span className="text-[11px]">
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
                        <p className="text-xs font-serif leading-relaxed text-paper-ink/90 line-clamp-4 bg-paper-bg p-2 border border-paper-border/80">
                          &ldquo;{c.excerpt}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-paper-border/60 flex items-center justify-between text-[11px] font-mono text-paper-muted">
                      <span>Source: {c.source}</span>
                      <button
                        type="button"
                        onClick={() => onOpenDoc(c.doc_id || c.chunk_id)}
                        className="font-semibold underline text-paper-ink hover:opacity-80"
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
