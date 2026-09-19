"""
Typed, centralized configuration.

Everything that should be experimentable (chunking, retrieval depth, fusion,
reranking, model choice) lives here instead of being scattered through the
codebase as ad-hoc os.environ.get() calls. Override any field with an
environment variable of the same name (see Config.from_env()).
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class Config:
    # --- Paths ---
    qdrant_path: str = "./storage/qdrant"          # embedded/local-mode Qdrant (no Docker required)
    processed_dir: str = "./data/processed"
    raw_dir: str = "./data/raw"
    eval_dir: str = "./eval_data"

    # --- Collection / schema ---
    collection_name: str = "cyber_corpus_v1"
    dense_vector_name: str = "dense"
    sparse_vector_name: str = "sparse"

    # --- Embeddings ---
    # "tfidf_svd_local" ships today with zero network dependency (see
    # src/retrieval/embeddings.py). "sentence_transformers" is a drop-in swap
    # once model weights can be downloaded (requires huggingface.co egress).
    embedding_provider: str = "tfidf_svd_local"
    embedding_dim: int = 256

    # --- Sparse ---
    sparse_method: str = "tfidf"  # "tfidf" (via sklearn) -- BM25-equivalent ranking, see embeddings.py docstring

    # --- Chunking ---
    chunk_target_tokens: int = 220
    chunk_overlap_tokens: int = 40
    chunk_min_tokens: int = 40

    # --- Retrieval depth (each independently configurable/experimentable) ---
    top_k_dense: int = 25
    top_k_sparse: int = 25
    top_k_fused: int = 30
    top_k_rerank: int = 8
    rrf_k: int = 60  # RRF smoothing constant

    # --- Reranking ---
    # "lexical_overlap_local" ships today (no network). "cross_encoder" is the
    # documented swap-in once model weights are available (see reranker.py).
    reranker: str = "lexical_overlap_local"
    # Relevance floor mode: "off" | "relative" | "absolute"
    # Applied to hybrid_rerank after reranking to eliminate weak noise candidates.
    floor_mode: str = "relative"
    floor_threshold: float = 0.2
    # Legacy alias kept for backward compatibility:
    rerank_relative_score_floor: float = 0.2

    # --- Generation ---
    # "extractive_local" composes a grounded answer directly from retrieved
    # spans -- no LLM weights or API key required. "llm_api" / "llm_local"
    # are documented swap-ins (see src/generation/provider.py).
    llm_provider: str = "extractive_local"
    max_context_tokens: int = 1800

    # --- Query understanding ---
    enable_acronym_expansion: bool = True
    enable_identifier_boost: bool = True

    @classmethod
    def from_env(cls) -> "Config":
        c = cls()
        for f in c.__dataclass_fields__:
            env_val = os.environ.get(f.upper())
            if env_val is None:
                continue
            cur = getattr(c, f)
            if isinstance(cur, bool):
                setattr(c, f, env_val.lower() in ("1", "true", "yes"))
            elif isinstance(cur, int):
                setattr(c, f, int(env_val))
            elif isinstance(cur, float):
                setattr(c, f, float(env_val))
            else:
                setattr(c, f, env_val)
        return c


CFG = Config.from_env()
