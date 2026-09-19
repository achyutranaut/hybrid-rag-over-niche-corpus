"""
Retrieval and generation metrics, computed against eval_data/eval_set.json.

All retrieval metrics are computed at the DOCUMENT level (parent_doc_id),
not chunk level: the eval set labels "which documents should this query
surface", and a query is satisfied whether it retrieves chunk 0 or chunk 2
of the right document. Chunk-level labels would require far more manual
annotation for marginal precision gain at this corpus size.
"""
from __future__ import annotations

import math
from dataclasses import dataclass


def recall_at_k(retrieved_doc_ids: list[str], expected_doc_ids: list[str], k: int) -> float:
    if not expected_doc_ids:
        return 0.0
    top_k = set(retrieved_doc_ids[:k])
    hit = len(top_k & set(expected_doc_ids))
    return hit / len(expected_doc_ids)


def precision_at_k(retrieved_doc_ids: list[str], expected_doc_ids: list[str], k: int) -> float:
    """Fixed-slot Precision@k: fraction of the top-k slots that contain an expected document.

    Exactly k slots are used as the denominator so that shortening the returned
    list (e.g. via a relevance floor) cannot mechanically inflate precision.
    Missing slots (when len(retrieved_doc_ids) < k) count as non-relevant.
    """
    if k <= 0:
        return 0.0
    expected = set(expected_doc_ids)
    top_k = retrieved_doc_ids[:k]
    if not top_k or not expected:
        return 0.0
    hit = len(set(top_k) & expected)
    return hit / k


def precision_at_returned_k(retrieved_doc_ids: list[str], expected_doc_ids: list[str], k: int) -> float:
    """Precision computed over returned slots only: hit / len(top_k).
    Maintained under a distinct name for ablation and diagnostic comparisons.
    """
    if k <= 0:
        return 0.0
    top_k = retrieved_doc_ids[:k]
    if not top_k:
        return 0.0
    hit = len(set(top_k) & set(expected_doc_ids))
    return hit / len(top_k)


def reciprocal_rank(retrieved_doc_ids: list[str], expected_doc_ids: list[str]) -> float:
    expected = set(expected_doc_ids)
    for i, doc_id in enumerate(retrieved_doc_ids, start=1):
        if doc_id in expected:
            return 1.0 / i
    return 0.0


def ndcg_at_k(retrieved_doc_ids: list[str], expected_doc_ids: list[str], k: int) -> float:
    expected = set(expected_doc_ids)
    dcg = 0.0
    for i, doc_id in enumerate(retrieved_doc_ids[:k], start=1):
        rel = 1.0 if doc_id in expected else 0.0
        dcg += rel / math.log2(i + 1)
    ideal_hits = min(len(expected), k)
    idcg = sum(1.0 / math.log2(i + 1) for i in range(1, ideal_hits + 1))
    return dcg / idcg if idcg > 0 else 0.0


def hit_rate(retrieved_doc_ids: list[str], expected_doc_ids: list[str], k: int) -> float:
    top_k = set(retrieved_doc_ids[:k])
    return 1.0 if top_k & set(expected_doc_ids) else 0.0


hit_rate_at_k = hit_rate


@dataclass
class RetrievalMetrics:
    recall_at_k: float
    precision_at_k: float
    mrr: float
    ndcg_at_k: float
    hit_rate: float


def compute_retrieval_metrics(retrieved_doc_ids: list[str], expected_doc_ids: list[str], k: int) -> RetrievalMetrics:
    return RetrievalMetrics(
        recall_at_k=recall_at_k(retrieved_doc_ids, expected_doc_ids, k),
        precision_at_k=precision_at_k(retrieved_doc_ids, expected_doc_ids, k),
        mrr=reciprocal_rank(retrieved_doc_ids, expected_doc_ids),
        ndcg_at_k=ndcg_at_k(retrieved_doc_ids, expected_doc_ids, k),
        hit_rate=hit_rate(retrieved_doc_ids, expected_doc_ids, k),
    )


def citation_correctness(cited_doc_ids: list[str], expected_doc_ids: list[str]) -> float:
    """Fraction of the answer's citations that point to an expected document.
    A cheap, honest proxy for "did the answer cite the right sources" --
    not full claim-level faithfulness checking, which would need an LLM
    judge (documented as a Phase-7 extension in ARCHITECTURE.md)."""
    if not cited_doc_ids:
        return 0.0
    correct = len(set(cited_doc_ids) & set(expected_doc_ids))
    return correct / len(set(cited_doc_ids))
