#!/usr/bin/env python3
"""
Experiment E3: Reranker and Relevance Floor Ablation (ARCHITECTURE.md section 24).

Core questions:
1. Does the lexical reranker (LexicalOverlapReranker) actually help over first-stage fusion, or does it degrade ranking?
2. Is the relevance floor doing genuine work (cutting off irrelevant chunks), or was it mechanically inflating precision?
3. What is the impact of relative threshold values (0.1, 0.2, 0.3, 0.5) vs absolute thresholds vs floor OFF?
4. How does candidate depth (10, 20, 30, 50) fed into the reranker affect final Recall@5, nDCG@5, and returned chunk count?

Usage:
  python experiments/run_e3_reranker_floor.py
  python experiments/run_e3_reranker_floor.py --eval-path eval_data/eval_set.json --out experiments/e3_results.json
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import Config
from src.eval.metrics import (
    compute_retrieval_metrics,
    precision_at_k,
    precision_at_returned_k,
    citation_correctness,
)
from src.ingestion.pipeline import load_store
from src.rag_pipeline import RagPipeline


def _unique_order_preserved(items: list[str]) -> list[str]:
    seen = set()
    return [x for x in items if not (x in seen or seen.add(x))]


def run_e3(eval_path: str = "eval_data/eval_set.json", out_path: str = "experiments/e3_results.json"):
    cfg = Config.from_env()
    store = load_store(cfg)
    pipeline = RagPipeline(cfg, store)

    eval_set = json.load(open(eval_path))

    # Grid of experimental arms for E3:
    # 1. 2x2 Factorial: reranker {none, lexical} x floor {off, relative 0.2}
    # 2. Threshold sweep: relative {0.1, 0.2, 0.3, 0.5} and absolute {0.05, 0.1, 0.2}
    # 3. Candidate depth sweep: candidate_depth in {10, 20, 30, 50}
    arms: dict[str, dict[str, Any]] = {
        # Factorial core
        "reranker_none__floor_off": {
            "reranker": "none",
            "floor_mode": "off",
            "top_k_fused": 25,
            "top_k_rerank": 5,
        },
        "reranker_none__floor_rel_0.2": {
            "reranker": "none",
            "floor_mode": "relative",
            "floor_threshold": 0.2,
            "top_k_fused": 25,
            "top_k_rerank": 5,
        },
        "reranker_lexical__floor_off": {
            "reranker": "lexical",
            "floor_mode": "off",
            "top_k_fused": 25,
            "top_k_rerank": 5,
        },
        "reranker_lexical__floor_rel_0.2_default": {
            "reranker": "lexical",
            "floor_mode": "relative",
            "floor_threshold": 0.2,
            "top_k_fused": 25,
            "top_k_rerank": 5,
        },
        # Floor threshold sweep (with lexical reranker)
        "floor_rel_0.1": {
            "reranker": "lexical",
            "floor_mode": "relative",
            "floor_threshold": 0.1,
            "top_k_fused": 25,
            "top_k_rerank": 5,
        },
        "floor_rel_0.3": {
            "reranker": "lexical",
            "floor_mode": "relative",
            "floor_threshold": 0.3,
            "top_k_fused": 25,
            "top_k_rerank": 5,
        },
        "floor_rel_0.5": {
            "reranker": "lexical",
            "floor_mode": "relative",
            "floor_threshold": 0.5,
            "top_k_fused": 25,
            "top_k_rerank": 5,
        },
        "floor_abs_0.05": {
            "reranker": "lexical",
            "floor_mode": "absolute",
            "floor_threshold": 0.05,
            "top_k_fused": 25,
            "top_k_rerank": 5,
        },
        "floor_abs_0.1": {
            "reranker": "lexical",
            "floor_mode": "absolute",
            "floor_threshold": 0.1,
            "top_k_fused": 25,
            "top_k_rerank": 5,
        },
        "floor_abs_0.2": {
            "reranker": "lexical",
            "floor_mode": "absolute",
            "floor_threshold": 0.2,
            "top_k_fused": 25,
            "top_k_rerank": 5,
        },
        # Candidate pool depth sweep (how many first-stage chunks the reranker inspects)
        "depth_10_candidates": {
            "reranker": "lexical",
            "floor_mode": "off",
            "top_k_fused": 10,
            "top_k_rerank": 5,
        },
        "depth_20_candidates": {
            "reranker": "lexical",
            "floor_mode": "off",
            "top_k_fused": 20,
            "top_k_rerank": 5,
        },
        "depth_30_candidates": {
            "reranker": "lexical",
            "floor_mode": "off",
            "top_k_fused": 30,
            "top_k_rerank": 5,
        },
        "depth_50_candidates": {
            "reranker": "lexical",
            "floor_mode": "off",
            "top_k_fused": 50,
            "top_k_rerank": 5,
        },
    }

    results: dict[str, list[dict]] = {arm: [] for arm in arms}

    for item in eval_set:
        query_id = item.get("query_id", item["query"][:15])
        query = item["query"]
        expected = item["expected_doc_ids"]
        category = item.get("category", "uncategorized")

        for arm_name, params in arms.items():
            resp = pipeline.query(
                query,
                strategy="hybrid_rerank",
                reranker=params.get("reranker", "lexical"),
                floor_mode=params.get("floor_mode"),
                floor_threshold=params.get("floor_threshold"),
                top_k_fused=params.get("top_k_fused", 25),
                top_k_rerank=params.get("top_k_rerank", 5),
            )

            # Reranked candidates (pre-floor)
            reranked_doc_ids = _unique_order_preserved(resp.retrieval.get("reranked_doc_ids", []))
            m_pre_floor = compute_retrieval_metrics(reranked_doc_ids, expected, k=5)

            # Post-floor surviving documents (what actually went into context)
            filtered_doc_ids = _unique_order_preserved(resp.retrieval.get("filtered_doc_ids", []))
            returned_count = len(filtered_doc_ids)

            # Fixed-slot precision uses exactly 5 slots in denominator
            fixed_p5 = precision_at_k(filtered_doc_ids, expected, k=5)
            # Returned-slot precision divides only by returned count
            returned_p = precision_at_returned_k(filtered_doc_ids, expected, k=5)

            # Generation citations
            cited_doc_ids = _unique_order_preserved([c["chunk_id"].split("::chunk")[0] for c in resp.citations])
            cc = citation_correctness(cited_doc_ids, expected)

            results[arm_name].append(
                {
                    "query_id": query_id,
                    "category": category,
                    "reranked_doc_ids": reranked_doc_ids,
                    "filtered_doc_ids": filtered_doc_ids,
                    "returned_count": returned_count,
                    "expected_doc_ids": expected,
                    "m_pre_floor": m_pre_floor,
                    "fixed_precision@5": fixed_p5,
                    "returned_precision": returned_p,
                    "citation_correctness": cc,
                    "grounded": resp.grounded,
                    "rerank_ms": resp.latency_ms["reranking_ms"],
                    "total_ms": resp.latency_ms["total_ms"],
                }
            )

    # Compute summaries
    summary = {}
    for arm_name, records in results.items():
        n = len(records)
        summary[arm_name] = {
            "recall@5": round(sum(r["m_pre_floor"].recall_at_k for r in records) / n, 3),
            "ndcg@5": round(sum(r["m_pre_floor"].ndcg_at_k for r in records) / n, 3),
            "mrr": round(sum(r["m_pre_floor"].mrr for r in records) / n, 3),
            "fixed_prec@5": round(sum(r["fixed_precision@5"] for r in records) / n, 3),
            "returned_prec": round(sum(r["returned_precision"] for r in records) / n, 3),
            "avg_returned_chunks": round(sum(r["returned_count"] for r in records) / n, 2),
            "citation_correctness": round(sum(r["citation_correctness"] for r in records) / n, 3),
            "rerank_ms": round(sum(r["rerank_ms"] for r in records) / n, 2),
        }

    print("\n" + "=" * 96)
    print("EXPERIMENT E3: RERANKER AND RELEVANCE FLOOR ABLATION RESULTS")
    print("=" * 96)
    header = (
        f"{'Arm Name':<38}{'Rec@5':<8}{'nDCG@5':<9}{'MRR':<7}"
        f"{'FixedP@5':<10}{'RetPrec':<9}{'RetChunks':<10}{'CiteOK':<8}{'Rerank(ms)':<10}"
    )
    print(header)
    print("-" * len(header))
    for arm_name, s in summary.items():
        print(
            f"{arm_name:<38}{s['recall@5']:<8.3f}{s['ndcg@5']:<9.3f}{s['mrr']:<7.3f}"
            f"{s['fixed_prec@5']:<10.3f}{s['returned_prec']:<9.3f}{s['avg_returned_chunks']:<10.2f}"
            f"{s['citation_correctness']:<8.3f}{s['rerank_ms']:<10.2f}"
        )

    if out_path:
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        serializable_results = {
            "summary": summary,
            "arms": {arm: [
                {
                    "query_id": r["query_id"],
                    "category": r["category"],
                    "returned_count": r["returned_count"],
                    "fixed_precision@5": r["fixed_precision@5"],
                    "returned_precision": r["returned_precision"],
                    "recall@5": r["m_pre_floor"].recall_at_k,
                    "ndcg@5": r["m_pre_floor"].ndcg_at_k,
                    "mrr": r["m_pre_floor"].mrr,
                    "citation_correctness": r["citation_correctness"],
                    "grounded": r["grounded"],
                }
                for r in recs
            ] for arm, recs in results.items()},
        }
        with open(out_path, "w") as f:
            json.dump(serializable_results, f, indent=2)
        print(f"\nSaved E3 results to {out_path}")

    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-path", default="eval_data/eval_set.json")
    parser.add_argument("--out", default="experiments/e3_results.json")
    args = parser.parse_args()
    run_e3(args.eval_path, args.out)
