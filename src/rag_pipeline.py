"""
Ties every stage together into the API response contract described in
ARCHITECTURE.md section 18, and exposes `retrieval_strategy` as a first-
class parameter so dense/sparse/hybrid/hybrid+rerank can all be requested
through the same code path (used by both the API and the experiment runner
in experiments/run_experiments.py -- one implementation, not two).
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass
from typing import Literal

from qdrant_client import models

from .config import Config
from .generation.provider import get_llm_provider
from .retrieval.context import assemble_context
from .retrieval.qdrant_store import QdrantStore, RetrievedChunk
from .retrieval.query_understanding import analyze_query
from .retrieval.reranker import get_reranker

RetrievalStrategy = Literal["dense", "sparse", "hybrid", "hybrid_rerank"]


@dataclass
class QueryResponse:
    answer: str
    citations: list[dict]
    retrieval: dict
    latency_ms: dict
    grounded: bool


def build_filter(document_type: str | None, source: str | None) -> models.Filter | None:
    conditions = []
    if document_type:
        conditions.append(models.FieldCondition(key="document_type", match=models.MatchValue(value=document_type)))
    if source:
        conditions.append(models.FieldCondition(key="source", match=models.MatchValue(value=source)))
    return models.Filter(must=conditions) if conditions else None


class RagPipeline:
    def __init__(self, cfg: Config, store: QdrantStore):
        self.cfg = cfg
        self.store = store
        self.reranker = get_reranker(cfg.reranker)
        self.llm = get_llm_provider(cfg.llm_provider)

    def _retrieve(
        self,
        query: str,
        strategy: RetrievalStrategy,
        query_filter: models.Filter | None,
        top_k_dense: int | None = None,
        top_k_sparse: int | None = None,
        top_k_fused: int | None = None,
        rrf_k: int | None = None,
        fusion_weights: list[float] | None = None,
        fusion_type: str = "rrf",
    ) -> tuple[list[RetrievedChunk], dict]:
        cfg = self.cfg
        k_dense = top_k_dense if top_k_dense is not None else cfg.top_k_dense
        k_sparse = top_k_sparse if top_k_sparse is not None else cfg.top_k_sparse
        k_fused = top_k_fused if top_k_fused is not None else cfg.top_k_fused
        k_rrf = rrf_k if rrf_k is not None else cfg.rrf_k

        if strategy == "dense":
            candidates = self.store.search_dense(query, k_dense, query_filter)
        elif strategy == "sparse":
            candidates = self.store.search_sparse(query, k_sparse, query_filter)
        elif strategy in ("hybrid", "hybrid_rerank"):
            candidates = self.store.search_hybrid_rrf(
                query,
                top_k_dense=k_dense,
                top_k_sparse=k_sparse,
                top_k_fused=k_fused,
                rrf_k=k_rrf,
                weights=fusion_weights,
                fusion_type=fusion_type,
                query_filter=query_filter,
            )
        else:
            raise ValueError(f"Unknown retrieval_strategy: {strategy}")
        return candidates, {"strategy": strategy, "candidates": len(candidates)}

    def query(
        self,
        raw_query: str,
        strategy: RetrievalStrategy = "hybrid_rerank",
        document_type: str | None = None,
        source: str | None = None,
        floor_mode: str | None = None,
        floor_threshold: float | None = None,
        reranker: str | None = None,
        top_k_rerank: int | None = None,
        top_k_dense: int | None = None,
        top_k_sparse: int | None = None,
        top_k_fused: int | None = None,
        rrf_k: int | None = None,
        fusion_weights: list[float] | None = None,
        fusion_type: str = "rrf",
        router: bool = False,
        enable_acronym_expansion: bool | None = None,
        auto_filter_identifiers: bool = False,
    ) -> QueryResponse:
        t_start = time.time()
        latency = {}

        effective_expansion = (
            enable_acronym_expansion
            if enable_acronym_expansion is not None
            else getattr(self.cfg, "enable_acronym_expansion", True)
        )
        qa = analyze_query(raw_query, enable_acronym_expansion=effective_expansion)

        effective_source = source
        effective_doc_type = document_type
        if auto_filter_identifiers:
            if qa.detected_cves and not effective_source:
                effective_source = "cve_nvd"
            elif qa.detected_technique_ids and not effective_source:
                effective_source = "mitre_attack"

        query_filter = build_filter(effective_doc_type, effective_source)

        effective_strategy = strategy
        routed_to = None
        if router and strategy in ("hybrid", "hybrid_rerank"):
            has_id = bool(qa.detected_cves or qa.detected_technique_ids or qa.detected_cwes)
            if has_id:
                effective_strategy = "sparse"
                routed_to = "sparse"
            else:
                routed_to = "hybrid"

        t0 = time.time()
        candidates, retrieval_meta = self._retrieve(
            qa.expanded_query,
            effective_strategy,
            query_filter,
            top_k_dense=top_k_dense,
            top_k_sparse=top_k_sparse,
            top_k_fused=top_k_fused,
            rrf_k=rrf_k,
            fusion_weights=fusion_weights,
            fusion_type=fusion_type,
        )
        latency["retrieval_ms"] = round((time.time() - t0) * 1000, 1)
        if routed_to:
            retrieval_meta["router_routed_to"] = routed_to
        retrieval_meta["detected_cves"] = qa.detected_cves
        retrieval_meta["detected_technique_ids"] = qa.detected_technique_ids
        retrieval_meta["detected_cwes"] = qa.detected_cwes
        retrieval_meta["expansion_terms"] = qa.expansion_terms
        retrieval_meta["expanded_query"] = qa.expanded_query
        retrieval_meta["acronym_expansion_enabled"] = effective_expansion
        retrieval_meta["auto_filter_identifiers"] = auto_filter_identifiers

        # Expose first-stage candidate documents and chunks for clean IR evaluation
        retrieval_meta["retrieved_candidate_ids"] = [c.chunk_id for c in candidates]
        retrieval_meta["retrieved_doc_ids"] = [c.parent_doc_id for c in candidates]
        retrieval_meta["retrieved_scores"] = [c.score for c in candidates]

        active_reranker = get_reranker(reranker) if reranker is not None else self.reranker
        k_rerank = top_k_rerank if top_k_rerank is not None else self.cfg.top_k_rerank

        t0 = time.time()
        if strategy == "hybrid_rerank" and candidates:
            reranked = active_reranker.rerank(raw_query, candidates, k_rerank)
        else:
            reranked = candidates[: k_rerank]
        latency["reranking_ms"] = round((time.time() - t0) * 1000, 1)

        # Expose reranked candidate documents and chunks
        retrieval_meta["reranked_candidate_ids"] = [c.chunk_id for c in reranked]
        retrieval_meta["reranked_doc_ids"] = [c.parent_doc_id for c in reranked]
        retrieval_meta["reranked_scores"] = [c.score for c in reranked]
        retrieval_meta["reranked"] = len(reranked)

        # Decouple relevance floor from baseline retrieval strategies.
        # Baselines (dense, sparse, hybrid) have floor OFF unless explicitly overridden.
        # hybrid_rerank uses configured floor_mode (default: "relative").
        if strategy in ("dense", "sparse", "hybrid"):
            effective_floor_mode = floor_mode or "off"
        else:
            effective_floor_mode = floor_mode if floor_mode is not None else getattr(self.cfg, "floor_mode", "relative")

        effective_threshold = (
            floor_threshold
            if floor_threshold is not None
            else getattr(self.cfg, "floor_threshold", self.cfg.rerank_relative_score_floor)
        )

        if effective_floor_mode == "off" or not reranked:
            filtered = list(reranked)
        elif effective_floor_mode == "relative":
            top_score = reranked[0].score
            floor_cutoff = top_score * effective_threshold
            filtered = [c for c in reranked if c.score >= floor_cutoff]
        elif effective_floor_mode == "absolute":
            floor_cutoff = effective_threshold
            filtered = [c for c in reranked if c.score >= floor_cutoff]
        else:
            raise ValueError(f"Unknown floor_mode: {effective_floor_mode}")

        retrieval_meta["floor_mode"] = effective_floor_mode
        retrieval_meta["floor_threshold"] = effective_threshold
        retrieval_meta["above_relevance_floor"] = len(filtered)
        retrieval_meta["filtered_doc_ids"] = [c.parent_doc_id for c in filtered]

        context = assemble_context(filtered, self.cfg.max_context_tokens)

        t0 = time.time()
        gen = self.llm.generate(raw_query, context)
        latency["generation_ms"] = round((time.time() - t0) * 1000, 1)

        latency["total_ms"] = round((time.time() - t_start) * 1000, 1)

        citations = [
            asdict(c) for c in context.citations if c.marker in gen.citations_used or not gen.citations_used
        ]

        retrieval_meta.update(
            {
                "detected_cves": qa.detected_cves,
                "detected_technique_ids": qa.detected_technique_ids,
                "detected_cwes": qa.detected_cwes,
                "expansion_terms": qa.expansion_terms,
            }
        )

        return QueryResponse(
            answer=gen.answer,
            citations=citations,
            retrieval=retrieval_meta,
            latency_ms=latency,
            grounded=gen.grounded,
        )
