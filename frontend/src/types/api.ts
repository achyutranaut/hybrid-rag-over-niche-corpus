export type RetrievalStrategy = 'dense' | 'sparse' | 'hybrid' | 'hybrid_rerank';

export interface OverviewResponse {
  title: string;
  research_question: string;
  corpus: {
    total_chunks: number;
    total_documents: number;
    mitre_attack_techniques: number;
    cve_records: number;
    sha256: string;
    collection_name: string;
    storage_mode: string;
  };
  tiers: {
    tier_a: {
      name: string;
      dense_embedder: string;
      sparse_engine: string;
      fusion: string;
      reranker: string;
      generator: string;
      active: boolean;
    };
    tier_b: {
      name: string;
      dense_embedder: string;
      sparse_engine: string;
      fusion: string;
      reranker: string;
      generator: string;
      active: boolean;
    };
  };
  status: {
    backend: string;
    collection_ready: boolean;
    experiments_completed: boolean;
    latest_evaluation: string;
  };
}

export interface Citation {
  marker: number;
  doc_id: string;
  chunk_id: string;
  title: string;
  source: string;
  section: string;
  score: number;
  url?: string;
  excerpt?: string;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  retrieval: {
    strategy: string;
    router_routed_to?: string;
    detected_cves: string[];
    detected_technique_ids: string[];
    detected_cwes: string[];
    expansion_terms: string[];
    expanded_query?: string;
    floor_mode?: string;
    floor_threshold?: number;
    above_relevance_floor?: number;
    retrieved_candidate_ids?: string[];
    reranked_candidate_ids?: string[];
  };
  latency_ms: {
    retrieval_ms?: number;
    reranking_ms?: number;
    generation_ms?: number;
    total_ms: number;
  };
  grounded: boolean;
}

export interface RetrievedCandidate {
  chunk_id: string;
  parent_doc_id: string;
  source: string;
  document_type: string;
  title: string;
  section: string;
  text: string;
  score: number;
  rank: number;
  retrieval_method: string;
  reranker_score?: number | null;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface RankTrackerItem {
  chunk_id: string;
  parent_doc_id: string;
  title: string;
  source: string;
  document_type: string;
  dense_rank?: number;
  sparse_rank?: number;
  hybrid_rank?: number;
  reranked_rank?: number;
}

export interface InspectResponse {
  query: string;
  query_understanding: {
    raw_query: string;
    expanded_query: string;
    detected_cves: string[];
    detected_technique_ids: string[];
    detected_cwes: string[];
    expansion_terms: string[];
    router_decision: string;
    filters_applied: {
      document_type?: string | null;
      source?: string | null;
    };
  };
  dense_candidates: RetrievedCandidate[];
  sparse_candidates: RetrievedCandidate[];
  hybrid_candidates: RetrievedCandidate[];
  reranked_candidates: RetrievedCandidate[];
  rank_tracker: RankTrackerItem[];
  latencies_ms: {
    dense: number;
    sparse: number;
    hybrid: number;
    rerank: number;
    total: number;
  };
}

export interface CompareResponse {
  query: string;
  query_understanding: {
    detected_cves: string[];
    detected_technique_ids: string[];
    detected_cwes: string[];
    expansion_terms: string[];
  };
  comparisons: Record<string, QueryResponse & { execution_ms: number }>;
}

export interface QueryUnderstandingResponse {
  raw_query: string;
  expanded_query: string;
  detected_cves: string[];
  detected_technique_ids: string[];
  detected_cwes: string[];
  expansion_terms: string[];
  has_exact_identifier: boolean;
  router_decision: {
    router_enabled: boolean;
    selected_strategy: string;
    rationale: string;
  };
  metadata_filters: {
    auto_filter_active: boolean;
    suggested_source?: string | null;
    research_note: string;
  };
}

export interface SampleQuery {
  class_id: number;
  category: string;
  label: string;
  query: string;
  expected_doc_ids: string[];
  split: string;
  notes: string;
}

export interface DocumentChunk {
  chunk_id: string;
  chunk_index: number;
  section: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentResponse {
  doc_id: string;
  title: string;
  source: string;
  document_type: string;
  url?: string;
  total_chunks: number;
  chunks: DocumentChunk[];
}

export interface MetricSet {
  recall_5?: number;
  'recall@5'?: number;
  'recall@10'?: number;
  'recall@30'?: number;
  mrr?: number;
  ndcg_5?: number;
  'ndcg@5'?: number;
  'ndcg@10'?: number;
  hit_rate_5?: number;
  'hit_rate@5'?: number;
  latency_ms?: number;
  abstention_accuracy?: number;
  in_corpus_recall_5?: number;
  'in_corpus_recall@5'?: number;
  'in_corpus_recall@10'?: number;
  'in_corpus_recall@30'?: number;
  in_corpus_mrr?: number;
  in_corpus_ndcg_5?: number;
  'in_corpus_ndcg@5'?: number;
  'in_corpus_ndcg@10'?: number;
  in_corpus_hit_rate_5?: number;
  'in_corpus_hit_rate@5'?: number;
  num_queries?: number;
  [key: string]: any;
}

export interface EvaluationsSummary {
  metadata: {
    corpus_sha256: string;
    dev_queries: number;
    test_queries: number;
    dev_in_corpus: number;
    test_in_corpus: number;
    ood_dev_queries: number;
    ood_test_queries: number;
    platform: string;
  };
  runs: {
    b1_embedders?: {
      title: string;
      description: string;
      dev: Record<string, MetricSet>;
      test: Record<string, MetricSet>;
      dev_per_class: Record<string, Record<string, MetricSet>>;
      test_per_class: Record<string, Record<string, MetricSet>>;
      paired_stats_dev: Record<string, unknown>;
      paired_stats_test: Record<string, unknown>;
    };
    b2_cross_encoder?: {
      title: string;
      description: string;
      dev: Record<string, MetricSet>;
      test: Record<string, MetricSet>;
      dev_per_class: Record<string, Record<string, MetricSet>>;
      test_per_class: Record<string, Record<string, MetricSet>>;
      paired_stats_dev: Record<string, unknown>;
      paired_stats_test: Record<string, unknown>;
      expanded_ood_dev?: Record<string, unknown>;
      expanded_ood_test?: Record<string, unknown>;
    };
    e2_fusion?: {
      title: string;
      description: string;
      summary: Record<string, unknown>;
      per_class: Record<string, unknown>;
    };
    e3_floor?: {
      title: string;
      description: string;
      summary: Record<string, unknown>;
    };
    e4_query_understanding?: {
      title: string;
      description: string;
      dev: Record<string, unknown>;
      test: Record<string, unknown>;
      dev_per_class: Record<string, unknown>;
      test_per_class: Record<string, unknown>;
    };
  };
  statistical_audit?: {
    paired_statistics_dev?: Record<string, unknown>;
    paired_statistics_test?: Record<string, unknown>;
    dev_vs_test_splits?: Record<string, unknown>;
    class_8_abstention?: Record<string, unknown>;
  };
}
