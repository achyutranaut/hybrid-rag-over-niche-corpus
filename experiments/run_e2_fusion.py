#!/usr/bin/env python3
"""
Experiment E2: Fusion Design Sweep (ARCHITECTURE.md section 24).

Core questions:
1. How sensitive is hybrid retrieval to the RRF constant k in {2, 10, 30, 60}?
2. Do non-uniform sparse:dense prefetch weights (1:1, 2:1, 3:1) improve retrieval over unweighted RRF?
3. Does Distribution-Based Score Fusion (DBSF) outperform rank-based RRF?
4. Does an identifier router (ID detected -> sparse only, else hybrid) protect exact-ID queries from dense noise?
5. How does per-list prefetch depth (10, 25, 50) impact recall and precision?

Usage:
  python experiments/run_e2_fusion.py
  python experiments/run_e2_fusion.py --eval-path eval_data/eval_set.json --out experiments/e2_results.json
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import Config
from src.eval.metrics import compute_retrieval_metrics
from src.ingestion.pipeline import load_store
from src.rag_pipeline import RagPipeline


def _unique_order_preserved(items: list[str]) -> list[str]:
    seen = set()
    return [x for x in items if not (x in seen or seen.add(x))]


def run_e2(eval_path: str = "eval_data/eval_set.json", out_path: str = "experiments/e2_results.json"):
    cfg = Config.from_env()
    store = load_store(cfg)
    pipeline = RagPipeline(cfg, store)

    eval_set = json.load(open(eval_path))

    # Define the experimental arms
    arms: dict[str, dict[str, Any]] = {
        # 1. Baseline single-modal references
        "dense_baseline": {"strategy": "dense"},
        "sparse_baseline": {"strategy": "sparse"},
        # 2. RRF constant k sweep (unweighted, depth=25)
        "rrf_k2": {"strategy": "hybrid", "rrf_k": 2},
        "rrf_k10": {"strategy": "hybrid", "rrf_k": 10},
        "rrf_k30": {"strategy": "hybrid", "rrf_k": 30},
        "rrf_k60_default": {"strategy": "hybrid", "rrf_k": 60},
        # 3. Sparse:Dense weights sweep (sparse:dense 2:1 and 3:1, [dense_weight, sparse_weight])
        "rrf_weights_sparse2_dense1_k60": {"strategy": "hybrid", "rrf_k": 60, "fusion_weights": [1.0, 2.0]},
        "rrf_weights_sparse3_dense1_k60": {"strategy": "hybrid", "rrf_k": 60, "fusion_weights": [1.0, 3.0]},
        "rrf_weights_dense2_sparse1_k60": {"strategy": "hybrid", "rrf_k": 60, "fusion_weights": [2.0, 1.0]},
        "rrf_weights_sparse2_dense1_k2": {"strategy": "hybrid", "rrf_k": 2, "fusion_weights": [1.0, 2.0]},
        # 4. Distribution-Based Score Fusion (DBSF)
        "dbsf_fusion": {"strategy": "hybrid", "fusion_type": "dbsf"},
        # 5. Identifier Router (exact ID -> sparse only, else hybrid RRF k=60)
        "router_rrf_k60": {"strategy": "hybrid", "router": True, "rrf_k": 60},
        "router_rrf_k2": {"strategy": "hybrid", "router": True, "rrf_k": 2},
        # 6. Prefetch depth sweep (top_k_dense and top_k_sparse in {10, 25, 50}, with top_k_fused=25)
        "depth_10_rrf_k60": {"strategy": "hybrid", "rrf_k": 60, "top_k_dense": 10, "top_k_sparse": 10, "top_k_fused": 25},
        "depth_25_rrf_k60": {"strategy": "hybrid", "rrf_k": 60, "top_k_dense": 25, "top_k_sparse": 25, "top_k_fused": 25},
        "depth_50_rrf_k60": {"strategy": "hybrid", "rrf_k": 60, "top_k_dense": 50, "top_k_sparse": 50, "top_k_fused": 25},
        "depth_50_rrf_k2": {"strategy": "hybrid", "rrf_k": 2, "top_k_dense": 50, "top_k_sparse": 50, "top_k_fused": 25},
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
                strategy=params.get("strategy", "hybrid"),
                floor_mode="off",  # pure first-stage retrieval without floor cutoff
                rrf_k=params.get("rrf_k"),
                fusion_weights=params.get("fusion_weights"),
                fusion_type=params.get("fusion_type", "rrf"),
                top_k_dense=params.get("top_k_dense"),
                top_k_sparse=params.get("top_k_sparse"),
                top_k_fused=params.get("top_k_fused"),
                router=params.get("router", False),
            )

            retrieved_doc_ids = _unique_order_preserved(resp.retrieval.get("retrieved_doc_ids", []))
            m5 = compute_retrieval_metrics(retrieved_doc_ids, expected, k=5)
            m10 = compute_retrieval_metrics(retrieved_doc_ids, expected, k=10)

            results[arm_name].append(
                {
                    "query_id": query_id,
                    "category": category,
                    "retrieved_doc_ids": retrieved_doc_ids,
                    "expected_doc_ids": expected,
                    "m5": m5,
                    "m10": m10,
                    "latency_ms": resp.latency_ms["retrieval_ms"],
                }
            )

    # Compute overall summaries
    summary = {}
    per_class_summary = {}

    all_categories = sorted({item.get("category", "uncategorized") for item in eval_set})

    for arm_name, records in results.items():
        n = len(records)
        summary[arm_name] = {
            "recall@5": round(sum(r["m5"].recall_at_k for r in records) / n, 3),
            "recall@10": round(sum(r["m10"].recall_at_k for r in records) / n, 3),
            "precision@5": round(sum(r["m5"].precision_at_k for r in records) / n, 3),
            "mrr": round(sum(r["m5"].mrr for r in records) / n, 3),
            "ndcg@5": round(sum(r["m5"].ndcg_at_k for r in records) / n, 3),
            "ndcg@10": round(sum(r["m10"].ndcg_at_k for r in records) / n, 3),
            "hit_rate@5": round(sum(r["m5"].hit_rate for r in records) / n, 3),
            "avg_latency_ms": round(sum(r["latency_ms"] for r in records) / n, 1),
        }

        # Per-class summary
        per_class_summary[arm_name] = {}
        for cat in all_categories:
            cat_recs = [r for r in records if r["category"] == cat]
            if cat_recs:
                cn = len(cat_recs)
                per_class_summary[arm_name][cat] = {
                    "count": cn,
                    "recall@5": round(sum(r["m5"].recall_at_k for r in cat_recs) / cn, 3),
                    "mrr": round(sum(r["m5"].mrr for r in cat_recs) / cn, 3),
                    "ndcg@5": round(sum(r["m5"].ndcg_at_k for r in cat_recs) / cn, 3),
                }

    # Print overall comparison table
    print("\n" + "=" * 88)
    print("EXPERIMENT E2: FUSION DESIGN SWEEP OVERALL RESULTS (k=5 and k=10)")
    print("=" * 88)
    header = f"{'Arm Name':<32}{'Rec@5':<8}{'Rec@10':<8}{'Prec@5':<8}{'MRR':<7}{'nDCG@5':<9}{'nDCG@10':<9}{'Lat(ms)':<8}"
    print(header)
    print("-" * len(header))
    for arm_name, s in summary.items():
        print(
            f"{arm_name:<32}{s['recall@5']:<8.3f}{s['recall@10']:<8.3f}{s['precision@5']:<8.3f}"
            f"{s['mrr']:<7.3f}{s['ndcg@5']:<9.3f}{s['ndcg@10']:<9.3f}{s['avg_latency_ms']:<8.1f}"
        )

    # Print per-class comparison table for key arms
    key_arms = [
        "dense_baseline",
        "sparse_baseline",
        "rrf_k60_default",
        "rrf_k2",
        "rrf_weights_sparse2_dense1_k2",
        "dbsf_fusion",
        "router_rrf_k2",
    ]
    print("\n" + "=" * 88)
    print("EXPERIMENT E2: PER-CLASS BREAKDOWN (MRR / Recall@5)")
    print("=" * 88)
    cat_header = f"{'Arm Name':<30}" + "".join([f"{cat[:14]:<16}" for cat in all_categories])
    print(cat_header)
    print("-" * len(cat_header))
    for arm_name in key_arms:
        row = f"{arm_name:<30}"
        for cat in all_categories:
            cdata = per_class_summary[arm_name].get(cat, {})
            mrr_val = cdata.get("mrr", 0.0)
            rec_val = cdata.get("recall@5", 0.0)
            row += f"M:{mrr_val:.2f}/R:{rec_val:.2f}  "
        print(row)

    if out_path:
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        serializable_results = {
            "summary": summary,
            "per_class_summary": per_class_summary,
            "arms": {arm: [
                {
                    "query_id": r["query_id"],
                    "category": r["category"],
                    "retrieved_doc_ids": r["retrieved_doc_ids"],
                    "expected_doc_ids": r["expected_doc_ids"],
                    "recall@5": r["m5"].recall_at_k,
                    "recall@10": r["m10"].recall_at_k,
                    "precision@5": r["m5"].precision_at_k,
                    "mrr": r["m5"].mrr,
                    "ndcg@5": r["m5"].ndcg_at_k,
                    "ndcg@10": r["m10"].ndcg_at_k,
                    "latency_ms": r["latency_ms"],
                }
                for r in recs
            ] for arm, recs in results.items()},
        }
        with open(out_path, "w") as f:
            json.dump(serializable_results, f, indent=2)
        print(f"\nSaved E2 results to {out_path}")

    return summary, per_class_summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-path", default="eval_data/eval_set.json")
    parser.add_argument("--out", default="experiments/e2_results.json")
    args = parser.parse_args()
    run_e2(args.eval_path, args.out)
