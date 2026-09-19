#!/usr/bin/env python3
"""
Stage B1 / Experiment E5: Transformer Dense vs LSA Dense vs Sparse vs Hybrid.
Evaluates BAAI/bge-small-en-v1.5 against Tier A baseline.
Supports explicit split selection (--split dev | test | all). Default is 'dev'.
Outputs to experiments/b1_results_{split}.json to preserve historical pooled files.
"""
import argparse
import json
import os
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import Config
from src.eval.metrics import (
    recall_at_k,
    reciprocal_rank,
    ndcg_at_k,
    hit_rate_at_k,
)
from src.eval.reproducibility import make_reproducibility_metadata
from src.ingestion.pipeline import load_store
from src.retrieval.embeddings import SentenceTransformerEmbeddingProvider
from src.retrieval.qdrant_store import QdrantStore
from src.retrieval.query_understanding import analyze_query


def _bootstrap_ci(deltas: np.ndarray, n_boot: int = 10000, ci: float = 0.95, seed: int = 42):
    np.random.seed(seed)
    n = len(deltas)
    sample_indices = np.random.randint(0, n, size=(n_boot, n))
    boot_means = np.mean(deltas[sample_indices], axis=1)
    alpha = (1.0 - ci) / 2.0
    low = np.percentile(boot_means, alpha * 100)
    high = np.percentile(boot_means, (1.0 - alpha) * 100)
    return float(np.mean(deltas)), float(low), float(high)


def evaluate_run(
    queries: list[dict[str, Any]],
    retrieve_fn,
    mode_name: str,
) -> tuple[dict[str, float], dict[str, dict[str, float]], list[dict[str, Any]]]:
    recalls_5 = []
    recalls_10 = []
    recalls_30 = []
    mrrs = []
    ndcgs_5 = []
    ndcgs_10 = []
    hit_rates_5 = []
    latencies = []

    per_class_metrics = defaultdict(lambda: {
        "recall@5": [], "recall@10": [], "recall@30": [],
        "mrr": [], "ndcg@5": [], "ndcg@10": [], "hit_rate@5": [], "latency_ms": []
    })

    records = []

    for q_item in queries:
        qid = q_item["query_id"]
        qtext = q_item["query"]
        qclass = q_item.get("category", q_item.get("class", "unclassified"))
        expected_doc_ids = q_item.get("expected_doc_ids", [])
        expected_ratings = q_item.get("relevance", q_item.get("expected_ratings", {d: 1.0 for d in expected_doc_ids}))

        t0 = time.perf_counter()
        retrieved_chunks = retrieve_fn(qtext, q_item)
        lat_ms = (time.perf_counter() - t0) * 1000.0

        retrieved_parent_ids = [c.parent_doc_id for c in retrieved_chunks]

        # Metric computation
        if not expected_doc_ids:
            r5 = 1.0 if len(retrieved_chunks) == 0 else 0.0
            r10 = 1.0 if len(retrieved_chunks) == 0 else 0.0
            r30 = 1.0 if len(retrieved_chunks) == 0 else 0.0
            rr = 1.0 if len(retrieved_chunks) == 0 else 0.0
            n5 = 1.0 if len(retrieved_chunks) == 0 else 0.0
            n10 = 1.0 if len(retrieved_chunks) == 0 else 0.0
            h5 = 1.0 if len(retrieved_chunks) == 0 else 0.0
        else:
            r5 = recall_at_k(retrieved_parent_ids, expected_doc_ids, k=5)
            r10 = recall_at_k(retrieved_parent_ids, expected_doc_ids, k=10)
            r30 = recall_at_k(retrieved_parent_ids, expected_doc_ids, k=30)
            rr = reciprocal_rank(retrieved_parent_ids, expected_doc_ids)
            n5 = ndcg_at_k(retrieved_parent_ids, expected_ratings, k=5)
            n10 = ndcg_at_k(retrieved_parent_ids, expected_ratings, k=10)
            h5 = hit_rate_at_k(retrieved_parent_ids, expected_doc_ids, k=5)

        recalls_5.append(r5)
        recalls_10.append(r10)
        recalls_30.append(r30)
        mrrs.append(rr)
        ndcgs_5.append(n5)
        ndcgs_10.append(n10)
        hit_rates_5.append(h5)
        latencies.append(lat_ms)

        per_class_metrics[qclass]["recall@5"].append(r5)
        per_class_metrics[qclass]["recall@10"].append(r10)
        per_class_metrics[qclass]["recall@30"].append(r30)
        per_class_metrics[qclass]["mrr"].append(rr)
        per_class_metrics[qclass]["ndcg@5"].append(n5)
        per_class_metrics[qclass]["ndcg@10"].append(n10)
        per_class_metrics[qclass]["hit_rate@5"].append(h5)
        per_class_metrics[qclass]["latency_ms"].append(lat_ms)

        records.append({
            "query_id": qid,
            "query": qtext,
            "class": qclass,
            "recall@5": r5,
            "recall@10": r10,
            "recall@30": r30,
            "mrr": rr,
            "ndcg@5": n5,
            "ndcg@10": n10,
            "hit_rate@5": h5,
            "latency_ms": lat_ms,
            "top_retrieved": retrieved_parent_ids[:5],
        })

    def avg(lst):
        return sum(lst) / len(lst) if lst else 0.0

    in_corpus_indices = [i for i, q in enumerate(queries) if len(q.get("expected_doc_ids", [])) > 0]

    overall = {
        "recall@5": avg(recalls_5),
        "recall@10": avg(recalls_10),
        "recall@30": avg(recalls_30),
        "mrr": avg(mrrs),
        "ndcg@5": avg(ndcgs_5),
        "ndcg@10": avg(ndcgs_10),
        "hit_rate@5": avg(hit_rates_5),
        "latency_ms": avg(latencies),
        "num_queries": len(queries),
        "in_corpus_recall@5": avg([recalls_5[i] for i in in_corpus_indices]) if in_corpus_indices else 0.0,
        "in_corpus_recall@10": avg([recalls_10[i] for i in in_corpus_indices]) if in_corpus_indices else 0.0,
        "in_corpus_recall@30": avg([recalls_30[i] for i in in_corpus_indices]) if in_corpus_indices else 0.0,
        "in_corpus_mrr": avg([mrrs[i] for i in in_corpus_indices]) if in_corpus_indices else 0.0,
        "in_corpus_ndcg@5": avg([ndcgs_5[i] for i in in_corpus_indices]) if in_corpus_indices else 0.0,
        "in_corpus_ndcg@10": avg([ndcgs_10[i] for i in in_corpus_indices]) if in_corpus_indices else 0.0,
        "in_corpus_hit_rate@5": avg([hit_rates_5[i] for i in in_corpus_indices]) if in_corpus_indices else 0.0,
    }

    class_summary = {}
    for cls_name, metrics in sorted(per_class_metrics.items()):
        class_summary[cls_name] = {k: avg(v) for k, v in metrics.items()}
        class_summary[cls_name]["num_queries"] = len(metrics["recall@5"])

    return overall, class_summary, records


def run_b1(
    eval_path: str = "./eval_data/eval_set.json",
    out_path: str | None = None,
    split: str = "dev",
):
    with open(eval_path) as f:
        full_queries = json.load(f)

    if split != "all":
        queries = [q for q in full_queries if q.get("split") == split]
    else:
        queries = full_queries

    if not out_path:
        out_path = f"./experiments/b1_results_{split}.json"

    print(f"\n==========================================================================================")
    print(f"RUNNING STAGE B1 TRANSFORMER EVALUATION (Split: {split.upper()}, n={len(queries)})")
    print(f"==========================================================================================")

    from qdrant_client import QdrantClient
    shared_client = QdrantClient(path="./storage/qdrant")

    # 1. Load Tier A store (LSA)
    cfg_lsa = Config(
        collection_name="cyber_corpus_v1",
        embedding_provider="tfidf_svd_local",
        embedding_dim=256,
        processed_dir="./data/processed",
    )
    store_lsa = load_store(cfg_lsa, client=shared_client)

    # 2. Load Tier B store (BGE with instruction prefix)
    cfg_bge = Config(
        collection_name="cyber_corpus_bge_v1",
        embedding_provider="sentence_transformers",
        embedding_dim=384,
        processed_dir="./data/processed_bge",
    )
    store_bge = load_store(cfg_bge, client=shared_client)

    # 3. Create Tier B store without instruction prefix (ablation)
    bge_embedder_noprefix = SentenceTransformerEmbeddingProvider(
        model_name="BAAI/bge-small-en-v1.5",
        query_instruction="",
    )
    store_bge_noprefix = QdrantStore(
        cfg_bge.qdrant_path,
        cfg_bge.collection_name,
        bge_embedder_noprefix,
        store_bge.sparse,
        client=shared_client,
    )

    modes = {
        "dense_lsa": lambda q, item: store_lsa.search_dense(q, top_k=30),
        "dense_bge": lambda q, item: store_bge.search_dense(q, top_k=30),
        "dense_bge_noprefix": lambda q, item: store_bge_noprefix.search_dense(q, top_k=30),
        "sparse_bm25": lambda q, item: store_bge.search_sparse(q, top_k=30),
        "hybrid_lsa": lambda q, item: store_lsa.search_hybrid_rrf(
            q, top_k_dense=25, top_k_sparse=25, top_k_fused=30, rrf_k=60, weights=[2.0, 1.0]
        ),
        "hybrid_bge": lambda q, item: store_bge.search_hybrid_rrf(
            q, top_k_dense=25, top_k_sparse=25, top_k_fused=30, rrf_k=60, weights=[2.0, 1.0]
        ),
        "hybrid_bge_1to1": lambda q, item: store_bge.search_hybrid_rrf(
            q, top_k_dense=25, top_k_sparse=25, top_k_fused=30, rrf_k=60, weights=[1.0, 1.0]
        ),
        "hybrid_bge_router": lambda q, item: (
            store_bge.search_sparse(q, top_k=30)
            if (analyze_query(q).detected_cves or analyze_query(q).detected_technique_ids)
            else store_bge.search_hybrid_rrf(q, top_k_dense=25, top_k_sparse=25, top_k_fused=30, rrf_k=60, weights=[2.0, 1.0])
        ),
    }

    all_results = {}
    print("\n" + "=" * 105)
    print(f"{'Mode':<22} | {'Recall@5':<9} | {'InCorp R@5':<11} | {'MRR':<8} | {'nDCG@5':<8} | {'HitRate@5':<10} | {'Latency (ms)':<12}")
    print("-" * 105)

    for mode_name, fn in modes.items():
        overall, class_summary, records = evaluate_run(queries, fn, mode_name)
        all_results[mode_name] = {
            "overall": overall,
            "class_breakdown": class_summary,
            "records": records,
        }
        print(
            f"{mode_name:<22} | "
            f"{overall['recall@5']:<9.4f} | "
            f"{overall.get('in_corpus_recall@5', 0.0):<11.4f} | "
            f"{overall['mrr']:<8.4f} | "
            f"{overall['ndcg@5']:<8.4f} | "
            f"{overall['hit_rate@5']:<10.4f} | "
            f"{overall['latency_ms']:<12.1f}"
        )
    print("=" * 105)

    # Compute paired statistical comparisons on in-corpus queries of this split
    in_corpus_qids = [q["query_id"] for q in queries if not q.get("expect_abstain")]
    paired_comparisons = [
        ("Dense BGE vs Dense LSA", "dense_bge", "dense_lsa"),
        ("Hybrid BGE vs Hybrid LSA", "hybrid_bge", "hybrid_lsa"),
        ("Hybrid BGE vs Sparse BM25", "hybrid_bge", "sparse_bm25"),
    ]

    paired_stats_out = {}
    print("\n" + "=" * 105)
    print(f"PAIRED PER-QUERY STATISTICAL COMPARISONS ({split.upper()} SPLIT, n={len(in_corpus_qids)})")
    print("=" * 105)
    print(f"{'Comparison':<30} | {'Metric':<9} | {'Improved':<8} {'Degraded':<8} {'Unchanged':<9} | {'Mean Δ':<8} {'95% CI':<20} {'p-value':<8}")
    print("-" * 105)

    for comp_name, treat_mode, base_mode in paired_comparisons:
        t_recs = {r["query_id"]: r for r in all_results[treat_mode]["records"] if r["query_id"] in in_corpus_qids}
        b_recs = {r["query_id"]: r for r in all_results[base_mode]["records"] if r["query_id"] in in_corpus_qids}
        comp_metrics = {}

        for metric in ["recall@5", "mrr", "ndcg@5"]:
            deltas = np.array([t_recs[qid][metric] - b_recs[qid][metric] for qid in in_corpus_qids])
            mean_d, ci_low, ci_high = _bootstrap_ci(deltas)
            nz = deltas[deltas != 0]
            p_val = float(stats.wilcoxon(deltas, alternative="two-sided").pvalue) if len(nz) > 0 else 1.0
            s_d = float(np.std(deltas, ddof=1))
            cohen_d = mean_d / s_d if s_d > 0 else 0.0

            imp = int(np.sum(deltas > 1e-6))
            deg = int(np.sum(deltas < -1e-6))
            unc = int(len(deltas) - imp - deg)

            comp_metrics[metric] = {
                "mean_delta": mean_d,
                "ci_95": [ci_low, ci_high],
                "wilcoxon_p": p_val,
                "cohen_d": cohen_d,
                "improved": imp,
                "degraded": deg,
                "unchanged": unc,
                "crosses_zero": bool(ci_low <= 0 <= ci_high),
            }

            ci_str = f"[{ci_low:+.4f}, {ci_high:+.4f}]"
            print(
                f"{comp_name:<30} | {metric:<9} | {imp:<8} {deg:<8} {unc:<9} | "
                f"{mean_d:<+8.4f} {ci_str:<20} {p_val:<8.4f}"
            )
        paired_stats_out[comp_name] = comp_metrics
    print("=" * 105)

    repro_meta = make_reproducibility_metadata(
        experiment_name="B1_transformer_bi_encoder",
        split=split,
        query_count=len(queries),
        eval_path=eval_path,
        model_identifier="BAAI/bge-small-en-v1.5",
        device="cpu",
        random_seed=42,
        extra_config={"modes_evaluated": list(modes.keys())},
    )

    output_payload = {
        "metadata": repro_meta,
        "overall_summary": {m: all_results[m]["overall"] for m in all_results},
        "per_class_summary": {m: all_results[m]["class_breakdown"] for m in all_results},
        "paired_statistics": paired_stats_out,
        "records": {m: all_results[m]["records"] for m in all_results},
    }

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(output_payload, f, indent=2)
    print(f"\nDetailed DEV-isolated B1 results saved to {out_path}")

    return output_payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Stage B1 transformer evaluation.")
    parser.add_argument("--eval-path", default="./eval_data/eval_set.json")
    parser.add_argument("--split", default="dev", choices=["dev", "test", "all"], help="Split to evaluate.")
    parser.add_argument("--out", default=None, help="Output path (defaults to experiments/b1_results_<split>.json).")
    args = parser.parse_args()
    run_b1(args.eval_path, args.out, args.split)
