export interface PipelineStageNode {
  id: string;
  name: string;
  shortName: string;
  stepNumber: number;
  position: [number, number, number];
  color: string;
  tierA: string;
  tierB: string;
}

export const PIPELINE_NODES: PipelineStageNode[] = [
  {
    id: 'ingestion',
    name: '1. Ingestion & Normalization',
    shortName: 'Ingestion',
    stepNumber: 1,
    position: [-10, 0, 0],
    color: '#8B7EF8',
    tierA: 'Parses 697 MITRE ATT&CK techniques + 20 CVE JSON records into uniform RawDocument format.',
    tierB: 'Same parser logic; corpus expansion to NIST SP 800 and full NVD CVE feeds.',
  },
  {
    id: 'chunking',
    name: '2. Structure-Aware Chunking',
    shortName: 'Chunking',
    stepNumber: 2,
    position: [-7.5, 0, 0],
    color: '#8B7EF8',
    tierA: 'Fixed-budget structure chunking (max 512 tokens, 64 token overlap), prepends section headers.',
    tierB: 'Same structure-aware chunking pipeline.',
  },
  {
    id: 'indexing',
    name: '3. Dual-Vector Qdrant Index',
    shortName: 'Dual Index',
    stepNumber: 3,
    position: [-5, 0, 0],
    color: '#8B7EF8',
    tierA: 'TruncatedSVD (128-d cosine) + BM25 sparse vectors inside single Qdrant collection.',
    tierB: 'BAAI/bge-small-en-v1.5 (384-d cosine) + BM25 sparse vectors.',
  },
  {
    id: 'retrieval_dense',
    name: '4a. Dense Retrieval (Cosine)',
    shortName: 'Dense Branch',
    stepNumber: 4,
    position: [-2.5, 1.2, 0],
    color: '#8B7EF8',
    tierA: 'Executes dense vector cosine query against Qdrant collection.',
    tierB: 'Dense BGE-small-en query with instruction prefix.',
  },
  {
    id: 'retrieval_sparse',
    name: '4b. Sparse Retrieval (BM25)',
    shortName: 'Sparse Branch',
    stepNumber: 4,
    position: [-2.5, -1.2, 0],
    color: '#F59E0B',
    tierA: 'Executes sparse BM25 query concurrently against Qdrant.',
    tierB: 'BM25 on server deployment.',
  },
  {
    id: 'rrf',
    name: '5. Server-Side RRF Fusion',
    shortName: 'RRF Fusion',
    stepNumber: 5,
    position: [0, 0, 0],
    color: '#8B7EF8',
    tierA: 'Server-side Reciprocal Rank Fusion in Qdrant with weights w=[2.0, 1.0], k=60.',
    tierB: 'Server-side Qdrant RRF fusion query.',
  },
  {
    id: 'reranking',
    name: '6. Second-Stage Reranking',
    shortName: 'Reranker',
    stepNumber: 6,
    position: [2.5, 0, 0],
    color: '#10B981',
    tierA: 'LexicalOverlapReranker: token-overlap ratio with exact alphanumeric identifier bonus.',
    tierB: 'CrossEncoderReranker: ms-marco-MiniLM-L-6-v2 cross-encoder (raw logits).',
  },
  {
    id: 'floor',
    name: '7. Relevance Floor Filter',
    shortName: 'Floor Cutoff',
    stepNumber: 7,
    position: [5, 0, 0],
    color: '#EF4444',
    tierA: 'Relative score floor: drops candidates scoring < 20% of top reranked score.',
    tierB: 'Absolute logit floor (tau >= 0.0) for cross-encoder scores.',
  },
  {
    id: 'context',
    name: '8. Context Assembly',
    shortName: 'Assembly',
    stepNumber: 8,
    position: [7.5, 0, 0],
    color: '#8B7EF8',
    tierA: 'Deduplicates chunks by parent_doc_id, assigns markers [1], [2], 2,000 token limit.',
    tierB: 'Same context assembly module.',
  },
  {
    id: 'generation',
    name: '9. Grounded Generation',
    shortName: 'Synthesis',
    stepNumber: 9,
    position: [10, 0, 0],
    color: '#10B981',
    tierA: 'ExtractiveLocalProvider: extracts highest-overlap sentences from context (100% grounded).',
    tierB: 'AnthropicProvider (Claude 3.5 Sonnet) with citation constraints.',
  },
];
