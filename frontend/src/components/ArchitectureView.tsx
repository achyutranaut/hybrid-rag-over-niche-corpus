import React, { useState } from 'react';
import { CodeBlock } from './CodeBlock';

interface StageDetail {
  id: string;
  name: string;
  subhead: string;
  sourceFile: string;
  tierA: string;
  tierB: string;
  description: string;
  codeSnippet: string;
}

export const ArchitectureView: React.FC = () => {
  const [activeStageId, setActiveStageId] = useState<string>('rrf');

  const stages: StageDetail[] = [
    {
      id: 'ingestion',
      name: '1. Ingestion & Normalization',
      subhead: 'STIX 2.1 & CVE 5.x Parsers',
      sourceFile: 'src/ingestion/attack_parser.py, cve_parser.py',
      tierA: 'Parses 697 MITRE ATT&CK techniques + 20 real CVE JSON records into uniform RawDocument format.',
      tierB: 'Same parser logic; corpus expansion to NIST SP 800 and full NVD CVE feeds.',
      description: 'Defensively parses STIX enterprise-attack bundle and CVE v5 containers. Extracts IDs, tactics, platforms, CVSS scores, and references.',
      codeSnippet: `class RawDocument:
    doc_id: str             # 'attack:T1059.001' or 'cve:CVE-2021-44228'
    source: str             # 'mitre_attack' or 'cve_nvd'
    document_type: str      # 'technique' or 'vulnerability'
    title: str
    text: str
    metadata: dict[str, Any]`
    },
    {
      id: 'chunking',
      name: '2. Structure-Aware Chunking',
      subhead: 'Parent-Child Technique Linkage',
      sourceFile: 'src/ingestion/chunker.py',
      tierA: 'Fixed-budget structure chunking (max 512 tokens, 64 token overlap), prepends section headers and parent doc IDs.',
      tierB: 'Same structure-aware chunking pipeline.',
      description: 'Preserves technical boundaries between description, mitigation, detection, and references. Retains parent_doc_id on every chunk for citation roll-up.',
      codeSnippet: `def chunk_document(doc: RawDocument, max_tokens: int = 512, overlap: int = 64) -> list[Chunk]:
    # Generates unique chunk_id = "{doc_id}#c{index}"
    # Preserves parent_doc_id linkage to prevent orphan citations`
    },
    {
      id: 'indexing',
      name: '3. Dual-Vector Qdrant Index',
      subhead: 'Dense + Sparse in Single Collection',
      sourceFile: 'src/retrieval/qdrant_store.py',
      tierA: 'TruncatedSVD (128-d cosine) + BM25 sparse vectors inside single Qdrant collection.',
      tierB: 'BAAI/bge-small-en-v1.5 (384-d cosine) + BM25 sparse vectors.',
      description: 'Atomic dual-vector storage: each point holds named dense and sparse vectors. Point IDs are UUID5(chunk_id) for idempotent re-ingestion.',
      codeSnippet: `self.client.create_collection(
    collection_name="cyber_corpus_v1",
    vectors_config={"dense": VectorParams(size=dim, distance=Distance.COSINE)},
    sparse_vectors_config={"sparse": SparseVectorParams()}
)`
    },
    {
      id: 'retrieval',
      name: '4. Parallel Retrieval',
      subhead: 'Simultaneous Semantic & Lexical Search',
      sourceFile: 'src/retrieval/qdrant_store.py',
      tierA: 'Executes dense vector cosine query and sparse BM25 query concurrently against Qdrant.',
      tierB: 'Dense BGE-small-en query with instruction prefix + sparse BM25.',
      description: 'First stage queries both vector indexes independently, fetching top-k candidate pools for reciprocal rank fusion.',
      codeSnippet: `res_dense = store.search_dense(query, top_k=25)
res_sparse = store.search_sparse(query, top_k=25)`
    },
    {
      id: 'rrf',
      name: '5. Server-Side RRF Fusion',
      subhead: 'Prefetch + FusionQuery(rrf_k=60)',
      sourceFile: 'src/retrieval/qdrant_store.py',
      tierA: 'Server-side Reciprocal Rank Fusion inside local Qdrant engine with weights w=[2.0, 1.0].',
      tierB: 'Server-side Qdrant RRF fusion query on server deployment.',
      description: 'Combines candidate lists by reciprocal rank: RRF(d) = sum(w_i / (k + r_i(d))). Prevents score calibration drift between cosine and BM25.',
      codeSnippet: `models.FusionQuery(
    fusion=models.Fusion.RRF,
    rrf=models.Rrf(k=60, weights=[2.0, 1.0])
)`
    },
    {
      id: 'reranking',
      name: '6. Second-Stage Reranking',
      subhead: 'Cross-Encoder / Lexical Overlap',
      sourceFile: 'src/retrieval/reranker.py',
      tierA: 'LexicalOverlapReranker: token-overlap ratio with exact alphanumeric identifier bonus.',
      tierB: 'CrossEncoderReranker: ms-marco-MiniLM-L-6-v2 cross-encoder (produces raw logit scores).',
      description: 'Evaluates full query-chunk interaction. In Tier B, Cross-Encoder yields +0.1382 nDCG@5 (p=0.0158) over first-stage retrieval on DEV.',
      codeSnippet: `class CrossEncoderReranker:
    def rerank(self, query: str, candidates: list[RetrievedChunk], top_k: int) -> list[RetrievedChunk]:
        pairs = [[query, c.text] for c in candidates]
        scores = self.model.predict(pairs)
        # Sort and return top_k reranked candidates`
    },
    {
      id: 'floor',
      name: '7. Relevance Floor Filter',
      subhead: 'Drop Near-Zero Candidates / Abstain',
      sourceFile: 'src/rag_pipeline.py',
      tierA: 'Relative score floor: drops candidates scoring < 20% of top reranked score.',
      tierB: 'Absolute logit floor (tau >= 0.0) for cross-encoder scores; triggers abstention on OOD.',
      description: 'Filters weak candidates out of the generation budget. Crucial for keeping hallucination rates low and abstaining on out-of-domain queries.',
      codeSnippet: `if floor_mode == "relative":
    top_score = reranked[0].score
    floor_cutoff = top_score * floor_threshold
    filtered = [c for c in reranked if c.score >= floor_cutoff]`
    },
    {
      id: 'context',
      name: '8. Context Assembly',
      subhead: 'Deduplication & Token Budgeting',
      sourceFile: 'src/retrieval/context.py',
      tierA: 'Deduplicates chunks by parent_doc_id, assigns sequential citation markers [1], [2], fits into 2,000 token limit.',
      tierB: 'Same context assembly module.',
      description: 'Structures retrieved chunks with document header metadata, numbered citation tags, and truncates to safe token window.',
      codeSnippet: `assembled = assemble_context(filtered_chunks, max_context_tokens=2000)`
    },
    {
      id: 'generation',
      name: '9. Grounded Generation',
      subhead: 'Extractive Local / LLM Provider',
      sourceFile: 'src/generation/provider.py',
      tierA: 'ExtractiveLocalProvider: extracts highest-overlap sentences from cited chunks (100% grounded by construction, no API key).',
      tierB: 'AnthropicProvider (Claude 3.5 Sonnet) / LocalLlamaProvider with strict citation prompt constraints.',
      description: 'Generates answer referencing citations directly. Flags grounded=True if output sentences are strictly supported by context.',
      codeSnippet: `class ExtractiveLocalProvider:
    def generate(self, query: str, context: AssembledContext) -> GenerationResult:
        # Extracts cited sentences directly from context
        # Guaranteed hallucination-free`
    },
  ];

  const activeStage = stages.find((s) => s.id === activeStageId) || stages[4];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-border bg-surface-1 p-5 space-y-2">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            Architecture Specification
          </span>
          <span className="text-border text-xs">/</span>
          <h2 className="text-base font-serif font-semibold text-ink-primary">
            End-to-End System Architecture
          </h2>
        </div>
        <p className="text-xs text-ink-muted">
          Pipeline walkthrough matching ARCHITECTURE.md §6. Click any stage to inspect design rationale, source code location, and Tier A vs Tier B implementations.
        </p>
      </div>

      {/* Stepper Buttons */}
      <div className="border border-border bg-surface-1 p-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center space-x-2 min-w-[700px]">
          {stages.map((stage, idx) => {
            const isActive = activeStageId === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveStageId(stage.id)}
                className={`flex-1 p-2 text-left border transition-colors ${
                  isActive
                    ? 'border-ink-primary bg-surface-2 text-ink-primary'
                    : 'border-border bg-surface-1 text-ink-muted hover:text-ink-primary hover:border-border-strong'
                }`}
              >
                <div className="font-mono text-[10px] text-ink-muted uppercase">
                  Step {idx + 1}
                </div>
                <div className="font-semibold text-xs truncate mt-0.5" title={stage.name}>
                  {stage.name.split('. ')[1] || stage.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Stage Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="border border-border bg-surface-1 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="font-mono text-[11px] text-ink-muted uppercase">
                  {activeStage.subhead}
                </span>
                <h3 className="font-serif font-semibold text-base text-ink-primary mt-0.5">
                  {activeStage.name}
                </h3>
              </div>
              <span className="font-mono text-[11px] text-ink-muted px-2 py-0.5 bg-surface-2 border border-border">
                {activeStage.sourceFile}
              </span>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed font-sans">
              {activeStage.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-surface-2 border border-border space-y-1">
                <div className="text-xs font-mono font-semibold text-ink-primary">
                  Tier A (Active Local)
                </div>
                <p className="text-[11px] text-ink-muted font-mono leading-relaxed">
                  {activeStage.tierA}
                </p>
              </div>

              <div className="p-3 bg-surface-2 border border-border space-y-1">
                <div className="text-xs font-mono font-semibold text-ink-primary">
                  Tier B (Target Spec)
                </div>
                <p className="text-[11px] text-ink-muted font-mono leading-relaxed">
                  {activeStage.tierB}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="border border-border bg-surface-1 p-5 space-y-3 h-full flex flex-col justify-between">
            <div>
              <div className="font-mono text-xs font-semibold text-ink-primary border-b border-border pb-2">
                Implementation Pattern
              </div>
              <CodeBlock code={activeStage.codeSnippet} filename={activeStage.sourceFile.split(',')[0]} />
            </div>
            <div className="text-[11px] font-mono text-ink-faint pt-2 border-t border-border">
              Configured via <code className="text-ink-muted">src/config.py</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
