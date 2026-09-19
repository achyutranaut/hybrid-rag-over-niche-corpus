import React, { useState, useEffect } from 'react';
import { InspectResponse, RetrievedCandidate, SampleQuery } from '../types/api';
import { inspectQuery, fetchSampleQueries } from '../api/client';
import { formatScore } from '../utils/format';
import { RankShiftInspector } from './RankShiftInspector';

interface RetrievalInspectorProps {
  onOpenDoc: (docId: string) => void;
}

export const RetrievalInspector: React.FC<RetrievalInspectorProps> = ({ onOpenDoc }) => {
  const [query, setQuery] = useState('What is CVE-2021-44228 and what makes it dangerous?');
  const [topK, setTopK] = useState(8);
  const [topKRerank, setTopKRerank] = useState(5);
  const [enableAcronymExpansion, setEnableAcronymExpansion] = useState(true);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InspectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sampleQueries, setSampleQueries] = useState<SampleQuery[]>([]);
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);

  const handleInspect = async (queryToRun: string) => {
    if (!queryToRun.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await inspectQuery({
        query: queryToRun.trim(),
        top_k: topK,
        top_k_rerank: topKRerank,
        enable_acronym_expansion: enableAcronymExpansion,
      });
      setData(resp);
    } catch (err: unknown) {
      setError((err as Error).message || 'Inspection failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSampleQueries()
      .then(setSampleQueries)
      .catch(() => {});
    handleInspect(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderCandidateCard = (c: RetrievedCandidate) => {
    const isExpanded = expandedChunk === `${c.retrieval_method}-${c.chunk_id}`;
    const isAttack = c.parent_doc_id?.startsWith('attack:') || c.parent_doc_id?.startsWith('T');
    const isCve = c.parent_doc_id?.startsWith('cve:') || c.parent_doc_id?.startsWith('CVE');

    return (
      <div
        key={`${c.retrieval_method}-${c.chunk_id}-${c.rank}`}
        className="p-3 border border-border bg-surface-1 space-y-2 hover:border-border-strong transition-colors text-xs"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-primary border border-border">
              #{c.rank}
            </span>
            <button
              type="button"
              onClick={() => onOpenDoc(c.parent_doc_id)}
              className={`font-mono text-xs hover:underline truncate max-w-[130px] ${
                isAttack ? 'text-attack' : isCve ? 'text-cve-warn' : 'text-ink-primary'
              }`}
              title={c.parent_doc_id}
            >
              {c.parent_doc_id}
            </button>
          </div>
          <span className="font-mono text-[11px] text-ink-muted">
            {formatScore(c.score)}
          </span>
        </div>

        <div>
          <div className="font-semibold text-ink-primary line-clamp-1" title={c.title}>
            {c.title}
          </div>
          {c.section && (
            <div className="text-[11px] text-ink-muted truncate mt-0.5">
              sec: <span className="text-ink-primary">{c.section}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-ink-muted border-t border-border/40">
          <span>{c.source}</span>
          {c.reranker_score !== undefined && c.reranker_score !== null && (
            <span className="text-valid">rerank: {formatScore(c.reranker_score)}</span>
          )}
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() =>
              setExpandedChunk(isExpanded ? null : `${c.retrieval_method}-${c.chunk_id}`)
            }
            className="text-[11px] text-ink-muted hover:text-ink-primary font-mono underline"
          >
            {isExpanded ? 'collapse text' : 'inspect passage'}
          </button>
          {isExpanded && (
            <div className="mt-2 p-2.5 rounded bg-[#0A0A0B] border border-border text-[11px] text-ink-primary font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {c.text}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Control Pane */}
      <div className="border border-border bg-surface-1 p-5 space-y-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              Pipeline Stage 04
            </span>
            <span className="text-border text-xs">/</span>
            <h2 className="text-base font-serif font-semibold text-ink-primary">
              Retrieval Inspector &amp; Candidate Funnel
            </h2>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Compare candidate pools at each stage: Dense candidates (LSA), Sparse candidates (BM25), Hybrid RRF candidates, and Reranked candidates.
          </p>
        </div>

        {/* Sample queries */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
            Benchmark Queries:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sampleQueries.slice(0, 5).map((sq, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(sq.query);
                  handleInspect(sq.query);
                }}
                className={`px-2 py-1 text-xs font-mono transition-colors border ${
                  query === sq.query
                    ? 'bg-surface-3 text-ink-primary border-ink-primary font-medium'
                    : 'bg-surface-2 text-ink-muted border-border hover:border-border-strong hover:text-ink-primary'
                }`}
              >
                {sq.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input & Parameters */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleInspect(query);
          }}
          className="space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Query to inspect across candidate pools..."
              className="flex-1 px-3.5 py-2.5 bg-surface-2 border border-border text-ink-primary text-xs font-mono focus:outline-none focus:border-ink-primary"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-5 py-2.5 bg-surface-3 hover:bg-border text-ink-primary border border-border disabled:opacity-50 text-xs font-mono transition-colors flex-shrink-0"
            >
              {loading ? 'Inspecting…' : 'Inspect Pipeline'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-mono text-ink-muted border-t border-border">
            <div className="flex items-center space-x-2">
              <span>First-stage top-k:</span>
              <input
                type="number"
                min={3}
                max={25}
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value) || 8)}
                className="w-14 px-2 py-1 bg-surface-2 border border-border text-center font-mono text-ink-primary text-xs"
              />
            </div>

            <div className="flex items-center space-x-2">
              <span>Rerank depth:</span>
              <input
                type="number"
                min={1}
                max={15}
                value={topKRerank}
                onChange={(e) => setTopKRerank(parseInt(e.target.value) || 5)}
                className="w-14 px-2 py-1 bg-surface-2 border border-border text-center font-mono text-ink-primary text-xs"
              />
            </div>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableAcronymExpansion}
                onChange={(e) => setEnableAcronymExpansion(e.target.checked)}
                className="rounded-none bg-surface-2 border-border text-ink-primary focus:ring-0"
              />
              <span className="text-ink-primary">Acronym expansion</span>
            </label>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-3 border border-cve-crit/40 bg-surface-1 text-cve-crit text-xs font-mono">
          Inspection error: {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Latencies Strip */}
          <div className="p-3 border border-border bg-surface-1 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <span className="text-ink-muted">Latencies:</span>
              <span className="px-2 py-0.5 bg-surface-2 border border-border text-ink-primary">
                dense: <strong>{data.latencies_ms.dense} ms</strong>
              </span>
              <span className="px-2 py-0.5 bg-surface-2 border border-border text-ink-primary">
                sparse: <strong>{data.latencies_ms.sparse} ms</strong>
              </span>
              <span className="px-2 py-0.5 bg-surface-2 border border-border text-ink-primary">
                hybrid RRF: <strong>{data.latencies_ms.hybrid} ms</strong>
              </span>
              <span className="px-2 py-0.5 bg-surface-2 border border-border text-ink-primary">
                rerank: <strong>{data.latencies_ms.rerank} ms</strong>
              </span>
            </div>

            <div className="text-ink-muted">
              total: <strong className="text-ink-primary">{data.latencies_ms.total} ms</strong>
            </div>
          </div>

          {/* Interactive SVG Rank Shift Funnel */}
          <RankShiftInspector
            rankTracker={data.rank_tracker}
            denseCandidates={data.dense_candidates}
            sparseCandidates={data.sparse_candidates}
            hybridCandidates={data.hybrid_candidates}
            rerankedCandidates={data.reranked_candidates}
            onOpenDoc={onOpenDoc}
          />

          {/* 4 Candidate Sets Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Dense */}
            <div className="space-y-3">
              <div className="border border-border bg-surface-2 p-2.5 flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-ink-primary">1. Dense (LSA 128d)</span>
                <span className="text-ink-muted">n={data.dense_candidates.length}</span>
              </div>
              <div className="space-y-2">
                {data.dense_candidates.map(renderCandidateCard)}
              </div>
            </div>

            {/* Sparse */}
            <div className="space-y-3">
              <div className="border border-border bg-surface-2 p-2.5 flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-ink-primary">2. Sparse (BM25)</span>
                <span className="text-ink-muted">n={data.sparse_candidates.length}</span>
              </div>
              <div className="space-y-2">
                {data.sparse_candidates.map(renderCandidateCard)}
              </div>
            </div>

            {/* Hybrid */}
            <div className="space-y-3">
              <div className="border border-border bg-surface-2 p-2.5 flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-ink-primary">3. Hybrid RRF (k=60)</span>
                <span className="text-ink-muted">n={data.hybrid_candidates.length}</span>
              </div>
              <div className="space-y-2">
                {data.hybrid_candidates.map(renderCandidateCard)}
              </div>
            </div>

            {/* Reranked */}
            <div className="space-y-3">
              <div className="border border-border bg-surface-2 p-2.5 flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-ink-primary">4. Reranked Pool</span>
                <span className="text-ink-muted">n={data.reranked_candidates.length}</span>
              </div>
              <div className="space-y-2">
                {data.reranked_candidates.map(renderCandidateCard)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
