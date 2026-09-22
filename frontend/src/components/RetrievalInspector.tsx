import React, { useState, useEffect } from 'react';
import { InspectResponse, RetrievedCandidate, SampleQuery } from '../types/api';
import { inspectQuery, fetchSampleQueries } from '../api/client';
import { formatScore, formatMs } from '../utils/format';
import { RankShiftInspector } from './RankShiftInspector';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Panel } from './ui/Panel';

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
        className="p-3 bg-surface-1 border border-border rounded-sm space-y-2 hover:border-border-strong transition-colors text-xs"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-sm bg-surface-2 text-ink-primary border border-border font-tabular">
              #{c.rank}
            </span>
            <button
              type="button"
              onClick={() => onOpenDoc(c.parent_doc_id)}
              className={`font-mono text-xs hover:underline truncate max-w-[130px] font-semibold cursor-pointer ${
                isAttack ? 'text-attack' : isCve ? 'text-cve-warn' : 'text-ink-primary'
              }`}
              title={c.parent_doc_id}
            >
              {c.parent_doc_id}
            </button>
          </div>
          <span className="font-mono text-[11px] text-ink-muted font-tabular">
            {formatScore(c.score, 4)}
          </span>
        </div>

        <div>
          <div className="font-semibold text-ink-primary line-clamp-1 text-xs" title={c.title}>
            {c.title}
          </div>
          {c.section && (
            <div className="text-[10px] text-ink-faint truncate mt-0.5 font-mono">
              sec: <span className="text-ink-muted">{c.section}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-ink-muted border-t border-border/40">
          <span className="text-[10px] text-ink-faint">{c.source}</span>
          {c.reranker_score !== undefined && c.reranker_score !== null && (
            <span className="text-valid font-tabular text-[10px]">
              rerank: {formatScore(c.reranker_score, 3)}
            </span>
          )}
        </div>

        <div className="pt-0.5">
          <button
            type="button"
            onClick={() =>
              setExpandedChunk(isExpanded ? null : `${c.retrieval_method}-${c.chunk_id}`)
            }
            className="text-[10px] text-ink-muted hover:text-ink-primary font-mono underline cursor-pointer"
          >
            {isExpanded ? '[-] collapse passage' : '[+] inspect passage'}
          </button>
          {isExpanded && (
            <div className="mt-2 p-2.5 rounded-sm bg-[#08080A] border border-border text-[11px] text-ink-primary font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {c.text}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Control Console */}
      <Panel
        header={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <Badge variant="attack" size="sm">
                Stage 04
              </Badge>
              <span className="text-border text-xs">/</span>
              <h2 className="text-sm font-serif font-semibold text-ink-primary">
                Candidate Funnel &amp; Retrieval Inspector
              </h2>
            </div>
            <span className="font-mono text-[11px] text-ink-faint hidden sm:inline">
              Multi-Stage Candidate Pool Auditing
            </span>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-muted">
            Inspect candidate pools at each stage: Dense (LSA), Sparse (BM25), Hybrid RRF (k=60), and Cross-Encoder/Lexical Reranked candidates.
          </p>

          {/* Benchmark Query Chips */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">
              Quick Inspect Benchmark Queries:
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
                  className={`px-2.5 py-1 text-xs font-mono transition-colors border rounded-sm cursor-pointer ${
                    query === sq.query
                      ? 'bg-surface-3 text-ink-primary border-ink-primary font-semibold shadow-glow-sm'
                      : 'bg-surface-2 text-ink-muted border-border hover:border-border-strong hover:text-ink-primary'
                  }`}
                >
                  {sq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input & Parameters Form */}
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
                className="flex-1 px-3.5 py-2.5 bg-surface-2 border border-border text-ink-primary text-xs font-mono rounded-sm focus:outline-none focus:border-ink-primary transition-colors"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={loading || !query.trim()}
                loading={loading}
              >
                Inspect Pipeline
              </Button>
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
                  className="w-14 px-2 py-1 bg-surface-2 border border-border text-center font-mono text-ink-primary text-xs rounded-sm"
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
                  className="w-14 px-2 py-1 bg-surface-2 border border-border text-center font-mono text-ink-primary text-xs rounded-sm"
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
      </Panel>

      {error && (
        <div className="p-3.5 border border-red-800/60 bg-red-950/20 text-red-300 text-xs font-mono rounded-sm flex items-center space-x-2">
          <span className="text-red-400 font-bold">✕ Error:</span>
          <span>{error}</span>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Latencies Strip */}
          <div className="p-3.5 border border-border bg-surface-1 rounded-sm flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <span className="text-ink-faint uppercase text-[10px]">Latencies:</span>
              <span className="px-2 py-0.5 bg-surface-2 border border-border text-ink-primary rounded-sm font-tabular">
                dense: <strong>{formatMs(data.latencies_ms.dense)}</strong>
              </span>
              <span className="px-2 py-0.5 bg-surface-2 border border-border text-ink-primary rounded-sm font-tabular">
                sparse: <strong>{formatMs(data.latencies_ms.sparse)}</strong>
              </span>
              <span className="px-2 py-0.5 bg-surface-2 border border-border text-ink-primary rounded-sm font-tabular">
                hybrid RRF: <strong>{formatMs(data.latencies_ms.hybrid)}</strong>
              </span>
              <span className="px-2 py-0.5 bg-surface-2 border border-border text-ink-primary rounded-sm font-tabular">
                rerank: <strong>{formatMs(data.latencies_ms.rerank)}</strong>
              </span>
            </div>

            <div className="text-ink-muted font-tabular text-[11px]">
              total: <strong className="text-ink-primary font-normal">{formatMs(data.latencies_ms.total)}</strong>
            </div>
          </div>

          {/* Interactive Rank Shift Trajectory Funnel */}
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
              <div className="border border-border bg-surface-2 p-2.5 rounded-sm flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-ink-primary">1. Dense (LSA 128d)</span>
                <span className="text-ink-faint text-[11px] font-tabular">n={data.dense_candidates.length}</span>
              </div>
              <div className="space-y-2">
                {data.dense_candidates.map(renderCandidateCard)}
              </div>
            </div>

            {/* Sparse */}
            <div className="space-y-3">
              <div className="border border-border bg-surface-2 p-2.5 rounded-sm flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-ink-primary">2. Sparse (BM25)</span>
                <span className="text-ink-faint text-[11px] font-tabular">n={data.sparse_candidates.length}</span>
              </div>
              <div className="space-y-2">
                {data.sparse_candidates.map(renderCandidateCard)}
              </div>
            </div>

            {/* Hybrid */}
            <div className="space-y-3">
              <div className="border border-border bg-surface-2 p-2.5 rounded-sm flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-attack">3. Hybrid RRF (k=60)</span>
                <span className="text-ink-faint text-[11px] font-tabular">n={data.hybrid_candidates.length}</span>
              </div>
              <div className="space-y-2">
                {data.hybrid_candidates.map(renderCandidateCard)}
              </div>
            </div>

            {/* Reranked */}
            <div className="space-y-3">
              <div className="border border-border bg-surface-2 p-2.5 rounded-sm flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-valid">4. Reranked Pool</span>
                <span className="text-ink-faint text-[11px] font-tabular">n={data.reranked_candidates.length}</span>
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
