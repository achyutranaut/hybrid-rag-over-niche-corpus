import React from 'react';
import { CodeBlock } from './CodeBlock';

export const MethodologyView: React.FC = () => {
  const rrfSnippet = `# Reciprocal Rank Fusion (Qdrant Server-Side)
from qdrant_client import models

# Multi-vector prefetch with reciprocal rank fusion
prefetch = [
    models.Prefetch(query=dense_vector, using="dense", limit=top_k_dense),
    models.Prefetch(query=sparse_indices_weights, using="sparse", limit=top_k_sparse),
]

# RRF formula: Score(d) = sum( w_i / (k + rank_i(d)) )
query_obj = models.FusionQuery(
    fusion=models.Fusion.RRF,
    rrf=models.Rrf(k=60, weights=[2.0, 1.0])
)`;

  const floorSnippet = `# Relevance Floor Implementation (src/rag_pipeline.py)
def apply_relevance_floor(
    candidates: list[RetrievedChunk],
    mode: str = "relative",
    threshold: float = 0.20
) -> list[RetrievedChunk]:
    if not candidates or mode == "off":
        return candidates
        
    if mode == "relative":
        # Keep candidates scoring at least 20% of top reranked score
        top_score = max(c.score for c in candidates)
        cutoff = top_score * threshold
        return [c for c in candidates if c.score >= cutoff]
        
    elif mode == "absolute":
        # Raw logit threshold (ms-marco-MiniLM-L-6-v2)
        return [c for c in candidates if c.score >= threshold]`;

  const schemaSnippet = `# Qdrant Atomic Dual-Vector Point Schema
point = models.PointStruct(
    id=str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk.chunk_id)),
    vector={
        "dense": dense_embedding,            # 384-d Cosine (BGE) / 128-d (LSA)
        "sparse": models.SparseVector(       # BM25 token indices & IDF weights
            indices=sparse_indices,
            values=sparse_values
        )
    },
    payload={
        "chunk_id": chunk.chunk_id,
        "parent_doc_id": chunk.parent_doc_id,
        "source": chunk.source,              # "mitre_attack" | "cve_nvd"
        "document_type": chunk.doc_type,     # "technique" | "vulnerability"
        "title": chunk.title,
        "text": chunk.text,
        "cvss_score": chunk.cvss_score,
    }
)`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-border bg-surface-1 p-5 space-y-2">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            Pipeline Stage 06
          </span>
          <span className="text-border text-xs">/</span>
          <h2 className="text-base font-serif font-semibold text-ink-primary">
            Research Methodology &amp; Experimental Record
          </h2>
        </div>
        <p className="text-xs text-ink-muted">
          Forensic documentation of corpus formulation, frozen benchmark splits, experiment sequences, statistical test procedures, and known architectural limitations.
        </p>
      </div>

      {/* Experimental Record Ledger */}
      <div className="border border-border bg-surface-1 p-5 space-y-4">
        <div className="border-b border-border pb-2 flex items-center justify-between">
          <h3 className="font-serif font-semibold text-sm text-ink-primary">
            Experimental Record
          </h3>
          <span className="font-mono text-[11px] text-ink-muted">
            reproducibility ledger
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1 p-3 bg-surface-2 border border-border">
            <div className="font-mono text-[11px] text-ink-muted uppercase">Corpus Formulation</div>
            <div className="font-sans font-semibold text-ink-primary">MITRE ATT&amp;CK v14.1 + CVE</div>
            <div className="font-mono text-[11px] text-ink-muted pt-1">
              697 Enterprise Techniques<br />
              20 Curated Critical CVEs<br />
              1,162 Total Chunks
            </div>
          </div>

          <div className="space-y-1 p-3 bg-surface-2 border border-border">
            <div className="font-mono text-[11px] text-ink-muted uppercase">Benchmark Integrity</div>
            <div className="font-mono text-ink-primary font-bold">sha256:cdcc7258098ffa61</div>
            <div className="font-mono text-[11px] text-ink-muted pt-1">
              DEV split: <strong className="text-ink-primary font-normal">n=64</strong> queries<br />
              TEST split: <strong className="text-ink-primary font-normal">n=16</strong> queries<br />
              OOD probes: <strong className="text-ink-primary font-normal">n=70</strong> queries
            </div>
          </div>

          <div className="space-y-1 p-3 bg-surface-2 border border-border">
            <div className="font-mono text-[11px] text-ink-muted uppercase">Active Engine (Tier A)</div>
            <div className="font-sans font-semibold text-ink-primary">Local Stand-in Stack</div>
            <div className="font-mono text-[11px] text-ink-muted pt-1">
              Dense: <code className="text-ink-primary">LSA (SVD 128d)</code><br />
              Sparse: <code className="text-ink-primary">BM25 (alphanumeric)</code><br />
              Fusion: <code className="text-ink-primary">Qdrant RRF (k=60)</code>
            </div>
          </div>

          <div className="space-y-1 p-3 bg-surface-2 border border-border">
            <div className="font-mono text-[11px] text-ink-muted uppercase">Target Spec (Tier B)</div>
            <div className="font-sans font-semibold text-ink-primary">Target Neural Spec</div>
            <div className="font-mono text-[11px] text-ink-muted pt-1">
              Dense: <code className="text-ink-primary">bge-small-en-v1.5</code><br />
              Reranker: <code className="text-ink-primary">ms-marco-MiniLM-L-6-v2</code><br />
              Generator: <code className="text-ink-primary">Extractive Grounded</code>
            </div>
          </div>
        </div>
      </div>

      {/* Core Research Question & Technical Rationale */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border bg-surface-1 p-5 space-y-3">
          <h3 className="font-serif font-semibold text-sm text-ink-primary">
            Research Question (RQ)
          </h3>
          <blockquote className="p-3 bg-surface-2 border-l-2 border-ink-primary text-xs italic text-ink-primary leading-relaxed font-serif">
            &ldquo;For which classes of cybersecurity query does dense, sparse, or hybrid retrieval perform best — and how much do reranking, query understanding, and metadata filtering change that answer?&rdquo;
          </blockquote>
          <p className="text-xs text-ink-muted leading-relaxed font-sans">
            Specialized cybersecurity corpora present unique information retrieval failure modes: exact alphanumeric identifiers (like <code className="font-mono text-cve-warn">CVE-2021-44228</code> or <code className="font-mono text-attack">T1059.001</code>) are fractured by subword tokenizers, while behavioral attack tactics require semantic generalization.
          </p>
        </div>

        <div className="border border-border bg-surface-1 p-5 space-y-3">
          <h3 className="font-serif font-semibold text-sm text-ink-primary">
            Key Empirical Findings &amp; Negative Results
          </h3>
          <ul className="text-xs space-y-2 text-ink-muted list-disc pl-4 leading-relaxed font-sans">
            <li>
              <strong className="text-ink-primary">Sparse BM25 strictly dominates exact identifiers:</strong> BM25 achieved MRR 1.000 on Class 1 vs 0.365 for Dense embeddings.
            </li>
            <li>
              <strong className="text-ink-primary">Cross-Encoder significance:</strong> Adding a cross-encoder reranker yielded $+0.1382$ nDCG@5 (<span className="font-mono text-valid">p=0.0158</span>) over first-stage retrieval.
            </li>
            <li>
              <strong className="text-cve-warn">Harmful negative result:</strong> Hard metadata auto-filtering on detected tokens degraded DEV Recall@5 by $-0.0446$ (<span className="font-mono text-cve-warn">p=0.0253</span>) due to cross-corpus false-positive collisions.
            </li>
          </ul>
        </div>
      </div>

      {/* Code & Formula Implementation Snippets */}
      <div className="space-y-4">
        <div className="border-b border-border pb-2">
          <h3 className="font-serif font-semibold text-sm text-ink-primary">
            Implementation Specifications &amp; Formulas
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Key mathematical formulations and concrete Python implementation patterns.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-ink-primary font-sans">
              1. Reciprocal Rank Fusion Query Formulation
            </div>
            <p className="text-xs text-ink-muted">
              Eliminates score calibration discrepancies between cosine similarity and BM25 scores without requiring normal distribution assumptions.
            </p>
            <CodeBlock code={rrfSnippet} filename="src/retrieval/qdrant_store.py" />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-ink-primary font-sans">
              2. Relevance Floor &amp; Out-of-Domain Abstention
            </div>
            <p className="text-xs text-ink-muted">
              Prevents hallucination by dropping candidates whose cross-encoder or hybrid scores fall below a calibrated relative fraction of the top result.
            </p>
            <CodeBlock code={floorSnippet} filename="src/rag_pipeline.py" />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="text-xs font-semibold text-ink-primary font-sans">
            3. Qdrant Atomic Dual-Vector Storage Schema
          </div>
          <p className="text-xs text-ink-muted">
            Atomic point structure preserving named dense and sparse vectors per document chunk with deterministic UUID5 identifiers.
          </p>
          <CodeBlock code={schemaSnippet} filename="src/ingestion/pipeline.py" />
        </div>
      </div>
    </div>
  );
};
