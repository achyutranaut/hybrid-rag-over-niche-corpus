"""
Reranking stage: takes the fused candidate set (dense+sparse+RRF, typically
20-50 chunks) and re-scores it with a more expensive, query-aware model
before truncating to the small set that actually goes into the LLM context.

Why a separate stage at all: RRF fusion only looks at each retriever's own
rank, never at the actual query-chunk text pair. A cross-encoder (or, here,
a stronger lexical-overlap scorer) reads query and chunk together and can
catch cases where a chunk ranked in the top 30 of both retrievers is still
a poor match, or where a chunk ranked ~15th is actually the best answer.

Candidate count tradeoff (why not always rerank everything, or top-3):
  - top_k_fused too small: reranker can't rescue a relevant chunk the fusion
    stage buried, since it was never candidate in the first place (recall
    ceiling is set upstream of the reranker).
  - top_k_fused too large: reranking cost/latency scales ~linearly with
    candidate count; a cross-encoder is 10-100x slower per item than the
    dense/sparse retrieval that produced the candidates.
  - top_k_rerank too small: generation gets too little grounding evidence,
    hurting faithfulness on multi-fact queries.
  - top_k_rerank too large: dilutes the LLM's attention and burns context
    budget on marginally relevant chunks.
  Defaults here (fused=30, rerank=8) are configurable, not hard-coded --
  see experiments/run_experiments.py for a sweep across these values.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from .qdrant_store import RetrievedChunk
from .sparse import tokenize


class Reranker(ABC):
    @abstractmethod
    def rerank(self, query: str, candidates: list[RetrievedChunk], top_k: int) -> list[RetrievedChunk]: ...


class LexicalOverlapReranker(Reranker):
    """Local, zero-network reranker: query-chunk token overlap (Jaccard-ish,
    with an identifier-match bonus), used as a query-aware second-pass score.

    This is intentionally NOT presented as equivalent to a cross-encoder --
    it re-uses lexical signal the sparse retriever already has, so its main
    value here is honestly limited to breaking ties and mildly promoting
    chunks with dense identifier overlap (CVE ids, technique ids). The
    architecture's real reranking stage is CrossEncoderReranker below;
    this class exists so the pipeline runs end-to-end without model
    downloads and so the experiment framework has a meaningful "reranked"
    condition to compare against "no reranking" even in this sandbox.
    """

    def __init__(self, identifier_bonus: float = 0.5):
        self.identifier_bonus = identifier_bonus

    def rerank(self, query: str, candidates: list[RetrievedChunk], top_k: int) -> list[RetrievedChunk]:
        q_tokens = set(tokenize(query))
        scored = []
        for c in candidates:
            c_tokens = set(tokenize(c.text))
            if not q_tokens or not c_tokens:
                overlap = 0.0
            else:
                overlap = len(q_tokens & c_tokens) / len(q_tokens | c_tokens)
            id_bonus = 0.0
            for tok in q_tokens:
                looks_like_id = any(ch.isdigit() for ch in tok) and any(ch.isalpha() for ch in tok)
                if looks_like_id and tok in c_tokens:
                    id_bonus += self.identifier_bonus
            new_score = overlap + id_bonus
            scored.append((new_score, c))
        scored.sort(key=lambda x: x[0], reverse=True)
        out = []
        for score, c in scored[:top_k]:
            c.score = float(score)
            out.append(c)
        return out


import math

class CrossEncoderReranker(Reranker):
    """Documented swap-in for a real cross-encoder reranker.

    Wire up by setting `reranker = "cross_encoder"` and
    installing `sentence-transformers`. Recommended: cross-encoder/ms-marco-
    MiniLM-L-6-v2 for speed, or BAAI/bge-reranker-base for quality.
    """

    def __init__(
        self,
        model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
        apply_sigmoid: bool = False,
        device: str = "cpu",
    ):
        self.model_name = model_name
        self.apply_sigmoid = apply_sigmoid
        self.device = device
        self._model = None

    def _load(self):
        if self._model is None:
            from sentence_transformers import CrossEncoder  # local import: optional dependency
            self._model = CrossEncoder(self.model_name, device=self.device)
        return self._model

    def rerank(self, query: str, candidates: list[RetrievedChunk], top_k: int) -> list[RetrievedChunk]:
        if not candidates:
            return []
        model = self._load()
        pairs = [(query, c.text) for c in candidates]
        scores = model.predict(pairs, batch_size=32, show_progress_bar=False)
        ranked = sorted(zip(scores, candidates), key=lambda x: x[0], reverse=True)
        out = []
        for score, c in ranked[:top_k]:
            val = float(score)
            if self.apply_sigmoid:
                val = 1.0 / (1.0 + math.exp(-max(-50.0, min(50.0, val))))
            c.score = val
            out.append(c)
        return out


class IdentityReranker(Reranker):
    """Pass-through reranker: preserves first-stage ranking and scores without modification."""

    def rerank(self, query: str, candidates: list[RetrievedChunk], top_k: int) -> list[RetrievedChunk]:
        return candidates[:top_k]


def get_reranker(name: str) -> Reranker:
    if name in ("none", "identity", "noop"):
        return IdentityReranker()
    if name in ("lexical_overlap_local", "lexical"):
        return LexicalOverlapReranker()
    if name in ("cross_encoder", "cross_encoder_logits"):
        return CrossEncoderReranker(apply_sigmoid=False)
    if name in ("cross_encoder_sigmoid", "cross_encoder_prob"):
        return CrossEncoderReranker(apply_sigmoid=True)
    raise ValueError(f"Unknown reranker: {name}")
