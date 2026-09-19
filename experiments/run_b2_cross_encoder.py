#!/usr/bin/env python3
"""
Stage B2 / Experiment E6: Cross-Encoder Reranking & Relevance Floor Recalibration.
Evaluates cross-encoder/ms-marco-MiniLM-L-6-v2 on top of BGE-small hybrid candidates.

Supports explicit split selection (--split dev | test | all). Default is 'dev'.
Also evaluates the expanded OOD benchmark (--ood-eval-path) on the selected split.
Outputs to experiments/b2_results_{split}.json to preserve historical pooled files.
"""
import argparse
import copy
import json
import math
import os
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from qdrant_client import QdrantClient
from src.config import Config
from src.eval.metrics import (
    recall_at_k,
    reciprocal_rank,
    ndcg_at_k,
    hit_rate,
)
from src.eval.reproducibility import make_reproducibility_metadata
from src.ingestion.pipeline import load_store
from src.retrieval.reranker import CrossEncoderReranker, LexicalOverlapReranker


def _bootstrap_ci(deltas: np.ndarray, n_boot: int = 10000, ci: float = 0.95, seed: int = 42):
    np.random.seed(seed)
    n = len(deltas)
    sample_indices = np.random.randint(0, n, size=(n_boot, n))
    boot_means = np.mean(deltas[sample_indices], axis=1)
    alpha = (1.0 - ci) / 2.0
    low = np.percentile(boot_means, alpha * 100)
    high = np.percentile(boot_means, (1.0 - alpha) * 100)
    return float(np.mean(deltas)), float(low), float(high)


def evaluate_records(queries: list[dict[str, Any]], query_results: list[tuple[list, float]]):
    recalls_5 = []
    mrrs = []
    ndcgs_5 = []
    hit_rates_5 = []
    latencies = []
    abstention_correct = []

    per_class_metrics = defaultdict(lambda: {
        "recall@5": [], "mrr": [], "ndcg@5": [], "hit_rate@5": [], "latency_ms": []
    })

    records = []

    for q_item, (final_chunks, lat_ms) in zip(queries, query_results):
        qid = q_item["query_id"]
        qclass = q_item.get("category", q_item.get("class", "unclassified"))
        expected_doc_ids = q_item.get("expected_doc_ids", [])
        expected_ratings = q_item.get("relevance", {d: 1.0 for d in expected_doc_ids})
        expect_abstain = q_item.get("expect_abstain", False)

        final_parent_ids = [c.parent_doc_id for c in final_chunks]
        abstained = len(final_chunks) == 0

        if expect_abstain:
            is_correct_abstain = 1.0 if abstained else 0.0
            abstention_correct.append(is_correct_abstain)
            r5 = 1.0 if abstained else 0.0
            rr = 1.0 if abstained else 0.0
            n5 = 1.0 if abstained else 0.0
            h5 = 1.0 if abstained else 0.0
        else:
            r5 = recall_at_k(final_parent_ids, expected_doc_ids, k=5)
            rr = reciprocal_rank(final_parent_ids, expected_doc_ids)
            n5 = ndcg_at_k(final_parent_ids, expected_ratings, k=5)
            h5 = hit_rate(final_parent_ids, expected_doc_ids, k=5)

        recalls_5.append(r5)
        mrrs.append(rr)
        ndcgs_5.append(n5)
        hit_rates_5.append(h5)
        latencies.append(lat_ms)

        per_class_metrics[qclass]["recall@5"].append(r5)
        per_class_metrics[qclass]["mrr"].append(rr)
        per_class_metrics[qclass]["ndcg@5"].append(n5)
        per_class_metrics[qclass]["hit_rate@5"].append(h5)
        per_class_metrics[qclass]["latency_ms"].append(lat_ms)

        records.append({
            "query_id": qid,
            "category": qclass,
            "abstained": abstained,
            "recall@5": r5,
            "mrr": rr,
            "ndcg@5": n5,
            "latency_ms": lat_ms,
            "top_docs": final_parent_ids[:5],
            "top_scores": [round(c.score, 4) for c in final_chunks[:5]],
        })

    def avg(lst):
        return sum(lst) / len(lst) if lst else 0.0

    in_corpus_indices = [i for i, q in enumerate(queries) if len(q.get("expected_doc_ids", [])) > 0]

    overall = {
        "recall@5": avg(recalls_5),
        "mrr": avg(mrrs),
        "ndcg@5": avg(ndcgs_5),
        "hit_rate@5": avg(hit_rates_5),
        "latency_ms": avg(latencies),
        "in_corpus_recall@5": avg([recalls_5[i] for i in in_corpus_indices]) if in_corpus_indices else 0.0,
        "in_corpus_mrr": avg([mrrs[i] for i in in_corpus_indices]) if in_corpus_indices else 0.0,
        "in_corpus_ndcg@5": avg([ndcgs_5[i] for i in in_corpus_indices]) if in_corpus_indices else 0.0,
        "in_corpus_hit_rate@5": avg([hit_rates_5[i] for i in in_corpus_indices]) if in_corpus_indices else 0.0,
        "abstention_accuracy": avg(abstention_correct) if abstention_correct else 0.0,
        "num_queries": len(queries),
    }

    class_summary = {}
    for cls_name, metrics in sorted(per_class_metrics.items()):
        class_summary[cls_name] = {k: avg(v) for k, v in metrics.items()}
        class_summary[cls_name]["num_queries"] = len(metrics["recall@5"])

    return overall, class_summary, records


def run_b2(
    eval_path: str = "./eval_data/eval_set.json",
    ood_eval_path: str = "./eval_data/ood_eval_set.json",
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
        out_path = f"./experiments/b2_results_{split}.json"

    # Also load expanded OOD set for this split
    expanded_ood_queries = []
    if Path(ood_eval_path).exists():
        with open(ood_eval_path) as f:
            full_ood = json.load(f)
        if split != "all":
            expanded_ood_queries = [q for q in full_ood if q.get("split") == split]
        else:
            expanded_ood_queries = full_ood

    print(f"\n==========================================================================================")
    print(f"RUNNING STAGE B2 CROSS-ENCODER EVALUATION (Split: {split.upper()}, n={len(queries)} standard, n={len(expanded_ood_queries)} expanded OOD)")
    print(f"==========================================================================================")

    client = QdrantClient(path="./storage/qdrant")
    cfg_bge = Config(
        collection_name="cyber_corpus_bge_v1",
        embedding_provider="sentence_transformers",
        embedding_dim=384,
        processed_dir="./data/processed_bge",
    )
    store = load_store(cfg_bge, client=client)

    ce = CrossEncoderReranker(device="cpu")
    lexical = LexicalOverlapReranker()

    print("Step 1: Running first-stage hybrid retrieval for top_k_fused=50 (candidate pool)...")
    candidates_pool = []
    retrieval_latencies = []
    for q_item in queries:
        t0 = time.perf_counter()
        cands = store.search_hybrid_rrf(
            q_item["query"], top_k_dense=25, top_k_sparse=25, top_k_fused=50, rrf_k=60, weights=[2.0, 1.0]
        )
        lat = (time.perf_counter() - t0) * 1000.0
        candidates_pool.append(cands)
        retrieval_latencies.append(lat)

    print("Step 2: Computing Cross-Encoder logits across candidate pools...")
    ce_scored_30 = []
    ce_latencies = []
    for q_item, cands in zip(queries, candidates_pool):
        t0 = time.perf_counter()
        scored = ce.rerank(q_item["query"], copy.deepcopy(cands[:30]), top_k=30)
        ce_lat = (time.perf_counter() - t0) * 1000.0
        ce_scored_30.append(scored)
        ce_latencies.append(ce_lat)

    # Scored 15 and 50 for candidate depth sweep
    ce_scored_15 = []
    for q_item, cands in zip(queries, candidates_pool):
        scored = ce.rerank(q_item["query"], copy.deepcopy(cands[:15]), top_k=15)
        ce_scored_15.append(scored)

    ce_scored_50 = []
    for q_item, cands in zip(queries, candidates_pool):
        scored = ce.rerank(q_item["query"], copy.deepcopy(cands[:50]), top_k=50)
        ce_scored_50.append(scored)

    # Lexical reranking
    lex_scored_30 = []
    lex_latencies = []
    for q_item, cands in zip(queries, candidates_pool):
        t0 = time.perf_counter()
        scored = lexical.rerank(q_item["query"], copy.deepcopy(cands[:30]), top_k=8)
        lat = (time.perf_counter() - t0) * 1000.0
        lex_scored_30.append(scored)
        lex_latencies.append(lat)

    # Floor filter function
    def apply_floor(scored_list, lat_list, floor_mode, threshold, top_k=8, use_sigmoid=False):
        out = []
        for scored, lat in zip(scored_list, lat_list):
            res = []
            for c in scored:
                c_copy = copy.deepcopy(c)
                if use_sigmoid:
                    c_copy.score = 1.0 / (1.0 + math.exp(-max(-50.0, min(50.0, c.score))))
                res.append(c_copy)
            res = res[:top_k]
            if floor_mode == "off" or not res:
                filtered = res
            elif floor_mode == "relative":
                top_s = res[0].score
                cutoff = top_s * threshold
                filtered = [c for c in res if c.score >= cutoff]
            elif floor_mode == "absolute":
                filtered = [c for c in res if c.score >= threshold]
            out.append((filtered, lat))
        return out

    total_ce_lat = [r_lat + c_lat for r_lat, c_lat in zip(retrieval_latencies, ce_latencies)]
    total_lex_lat = [r_lat + l_lat for r_lat, l_lat in zip(retrieval_latencies, lex_latencies)]

    configurations = {
        "first_stage_hybrid": [(c[:8], lat) for c, lat in zip(candidates_pool, retrieval_latencies)],
        "lexical_rerank_nofloor": [(c[:8], lat) for c, lat in zip(lex_scored_30, total_lex_lat)],
        "ce_logits_nofloor": apply_floor(ce_scored_30, total_ce_lat, "off", 0.0, top_k=8),
        "ce_logits_floor_abs0": apply_floor(ce_scored_30, total_ce_lat, "absolute", 0.0, top_k=8),
        "ce_logits_floor_abs1": apply_floor(ce_scored_30, total_ce_lat, "absolute", 1.0, top_k=8),
        "ce_sigmoid_nofloor": apply_floor(ce_scored_30, total_ce_lat, "off", 0.0, top_k=8, use_sigmoid=True),
        "ce_sigmoid_floor_abs0.5": apply_floor(ce_scored_30, total_ce_lat, "absolute", 0.5, top_k=8, use_sigmoid=True),
        "ce_sigmoid_floor_abs0.6": apply_floor(ce_scored_30, total_ce_lat, "absolute", 0.6, top_k=8, use_sigmoid=True),
        "ce_sigmoid_floor_rel0.2": apply_floor(ce_scored_30, total_ce_lat, "relative", 0.2, top_k=8, use_sigmoid=True),
        "ce_fused15_abs0": apply_floor(ce_scored_15, total_ce_lat, "absolute", 0.0, top_k=8),
        "ce_fused50_abs0": apply_floor(ce_scored_50, total_ce_lat, "absolute", 0.0, top_k=8),
    }

    all_results = {}
    print("\n" + "=" * 108)
    print(f"{'Configuration':<26} | {'In-Corp R@5':<11} | {'In-Corp MRR':<11} | {'In-Corp nDCG5':<13} | {'Abstain Acc':<12} | {'Lat (ms)':<10}")
    print("-" * 108)

    for name, res in configurations.items():
        overall, class_summary, records = evaluate_records(queries, res)
        all_results[name] = {
            "overall": overall,
            "class_breakdown": class_summary,
            "records": records,
        }
        print(
            f"{name:<26} | "
            f"{overall['in_corpus_recall@5']:<11.4f} | "
            f"{overall['in_corpus_mrr']:<11.4f} | "
            f"{overall['in_corpus_ndcg@5']:<13.4f} | "
            f"{overall['abstention_accuracy']:<12.4f} | "
            f"{overall['latency_ms']:<10.1f}"
        )
    print("=" * 108)

    # Step 3: Expanded OOD calibration on this split
    expanded_ood_calibration = {}
    if expanded_ood_queries:
        print(f"\nEvaluating expanded OOD calibration on {split.upper()} partition (n={len(expanded_ood_queries)})...")
        ood_candidates = []
        for q_item in expanded_ood_queries:
            cands = store.search_hybrid_rrf(
                q_item["query"], top_k_dense=25, top_k_sparse=25, top_k_fused=30, rrf_k=60, weights=[2.0, 1.0]
            )
            scored = ce.rerank(q_item["query"], copy.deepcopy(cands[:30]), top_k=8)
            ood_candidates.append(scored)

        if split == "test":
            floor_thresholds_to_test = [
                ("ce_logits_abs0.0 (FROZEN)", 0.0, False),
            ]
        else:
            floor_thresholds_to_test = [
                ("ce_logits_abs0.0", 0.0, False),
                ("ce_logits_abs0.5", 0.5, False),
                ("ce_logits_abs1.0", 1.0, False),
                ("ce_sigmoid_abs0.5", 0.5, True),
                ("ce_sigmoid_abs0.6", 0.6, True),
                ("ce_relative_0.2", 0.2, "relative"),
            ]

        print(f"{'Floor Threshold':<25} | {'Abstention Accuracy':<22} | {'Correct / Total':<16}")
        print("-" * 70)
        for tname, thresh, mode in floor_thresholds_to_test:
            correct = 0
            for scored in ood_candidates:
                if mode == "relative":
                    top_s = scored[0].score if scored else 0.0
                    filtered = [c for c in scored if c.score >= top_s * thresh] if scored else []
                elif mode is True:  # sigmoid
                    sig_scores = [1.0 / (1.0 + math.exp(-max(-50.0, min(50.0, c.score)))) for c in scored]
                    filtered = [s for s in sig_scores if s >= thresh]
                else:  # logits
                    filtered = [c for c in scored if c.score >= thresh]

                if len(filtered) == 0:
                    correct += 1

            acc = correct / len(ood_candidates)
            expanded_ood_calibration[tname] = {
                "abstention_accuracy": acc,
                "correct": correct,
                "total": len(ood_candidates),
            }
            print(f"{tname:<25} | {acc:<22.4f} | {correct}/{len(ood_candidates)}")
        print("-" * 70)

    # Paired Statistics against first_stage_hybrid on In-Corpus queries
    in_corpus_qids = [q["query_id"] for q in queries if not q.get("expect_abstain")]
    base_recs = {r["query_id"]: r for r in all_results["first_stage_hybrid"]["records"] if r["query_id"] in in_corpus_qids}

    paired_stats_out = {}
    print("\n" + "=" * 105)
    print(f"PAIRED STATISTICAL COMPARISONS vs FIRST-STAGE HYBRID ({split.upper()} SPLIT, n={len(in_corpus_qids)})")
    print("=" * 105)
    print(f"{'Configuration':<26} | {'Metric':<9} | {'Improved':<8} {'Degraded':<8} {'Unchanged':<9} | {'Mean Δ':<8} {'95% CI':<20} {'p-value':<8}")
    print("-" * 105)

    for comp_arm in ["ce_logits_nofloor", "ce_logits_floor_abs0", "lexical_rerank_nofloor"]:
        t_recs = {r["query_id"]: r for r in all_results[comp_arm]["records"] if r["query_id"] in in_corpus_qids}
        arm_stats = {}
        for metric in ["recall@5", "mrr", "ndcg@5"]:
            deltas = np.array([t_recs[qid][metric] - base_recs[qid][metric] for qid in in_corpus_qids])
            mean_d, ci_low, ci_high = _bootstrap_ci(deltas)
            nz = deltas[deltas != 0]
            p_val = float(stats.wilcoxon(deltas, alternative="two-sided").pvalue) if len(nz) > 0 else 1.0
            s_d = float(np.std(deltas, ddof=1))
            cohen_d = mean_d / s_d if s_d > 0 else 0.0

            imp = int(np.sum(deltas > 1e-6))
            deg = int(np.sum(deltas < -1e-6))
            unc = int(len(deltas) - imp - deg)

            arm_stats[metric] = {
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
                f"{comp_arm:<26} | {metric:<9} | {imp:<8} {deg:<8} {unc:<9} | "
                f"{mean_d:<+8.4f} {ci_str:<20} {p_val:<8.4f}"
            )
        paired_stats_out[comp_arm] = arm_stats
    print("=" * 105)

    repro_meta = make_reproducibility_metadata(
        experiment_name="B2_cross_encoder_and_floor",
        split=split,
        query_count=len(queries),
        eval_path=eval_path,
        model_identifier="cross-encoder/ms-marco-MiniLM-L-6-v2",
        device="cpu",
        random_seed=42,
        extra_config={
            "selected_frozen_configuration": "ce_logits_floor_abs0",
            "selection_rationale": "Maintains highest in-corpus MRR and nDCG while achieving optimal abstention calibration on DEV OOD set.",
        },
    )

    output_payload = {
        "metadata": repro_meta,
        "configurations_summary": {m: all_results[m]["overall"] for m in all_results},
        "per_class_summary": {m: all_results[m]["class_breakdown"] for m in all_results},
        "expanded_ood_calibration": expanded_ood_calibration,
        "paired_statistics_vs_first_stage": paired_stats_out,
        "records": {m: all_results[m]["records"] for m in all_results},
    }

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(output_payload, f, indent=2)
    print(f"\nDetailed DEV-isolated B2 results saved to {out_path}")

    return output_payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Stage B2 cross-encoder evaluation.")
    parser.add_argument("--eval-path", default="./eval_data/eval_set.json")
    parser.add_argument("--ood-eval-path", default="./eval_data/ood_eval_set.json")
    parser.add_argument("--split", default="dev", choices=["dev", "test", "all"], help="Split to evaluate.")
    parser.add_argument("--out", default=None, help="Output path (defaults to experiments/b2_results_<split>.json).")
    args = parser.parse_args()
    run_b2(args.eval_path, args.ood_eval_path, args.out, args.split)
