#!/usr/bin/env python3
"""
Experiment E4: Query Understanding Ablation (ARCHITECTURE.md section 24).

Ablates:
1. Acronym expansion (glossary-based additive expansion)
2. Identifier detection & auto-filtering (CVE -> cve_nvd, Technique -> mitre_attack)
3. Identifier router (ID detected -> sparse only, else hybrid)

Supports explicit split selection (--split dev | test | all). Default is 'dev'.
Outputs to experiments/e4_results_{split}.json to preserve historical pooled files.
"""
import argparse
import json
import statistics
import sys
from pathlib import Path
from typing import Any

import numpy as np
from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import Config
from src.eval.metrics import compute_retrieval_metrics
from src.eval.reproducibility import make_reproducibility_metadata
from src.ingestion.pipeline import load_store
from src.rag_pipeline import RagPipeline


def _bootstrap_ci(deltas: np.ndarray, n_boot: int = 10000, ci: float = 0.95, seed: int = 42):
    np.random.seed(seed)
    n = len(deltas)
    sample_indices = np.random.randint(0, n, size=(n_boot, n))
    boot_means = np.mean(deltas[sample_indices], axis=1)
    alpha = (1.0 - ci) / 2.0
    low = np.percentile(boot_means, alpha * 100)
    high = np.percentile(boot_means, (1.0 - alpha) * 100)
    return float(np.mean(deltas)), float(low), float(high)


def _unique_order_preserved(items: list[str]) -> list[str]:
    seen = set()
    return [x for x in items if not (x in seen or seen.add(x))]


def run_e4(
    eval_path: str = "eval_data/eval_set.json",
    out_path: str | None = None,
    split: str = "dev",
):
    cfg = Config.from_env()
    store = load_store(cfg)
    pipeline = RagPipeline(cfg, store)

    full_eval_set = json.load(open(eval_path))
    if split != "all":
        eval_set = [q for q in full_eval_set if q.get("split") == split]
    else:
        eval_set = full_eval_set

    if not out_path:
        out_path = f"experiments/e4_results_{split}.json"

    print(f"\n==========================================================================================")
    print(f"RUNNING EXPERIMENT E4: QUERY UNDERSTANDING ABLATION (Split: {split.upper()}, n={len(eval_set)})")
    print(f"==========================================================================================")

    arms: dict[str, dict[str, Any]] = {
        # 1. Core Hybrid ablation of query-understanding components
        "hybrid_raw_no_expansion": {
            "strategy": "hybrid",
            "enable_acronym_expansion": False,
            "auto_filter_identifiers": False,
            "router": False,
        },
        "hybrid_acronym_expansion_only": {
            "strategy": "hybrid",
            "enable_acronym_expansion": True,
            "auto_filter_identifiers": False,
            "router": False,
        },
        "hybrid_identifier_autofilter_only": {
            "strategy": "hybrid",
            "enable_acronym_expansion": False,
            "auto_filter_identifiers": True,
            "router": False,
        },
        "hybrid_identifier_router_only": {
            "strategy": "hybrid",
            "enable_acronym_expansion": False,
            "auto_filter_identifiers": False,
            "router": True,
        },
        "hybrid_full_qu": {
            "strategy": "hybrid",
            "enable_acronym_expansion": True,
            "auto_filter_identifiers": True,
            "router": True,
        },
        # 2. Sparse single-modal controls
        "sparse_no_expansion": {
            "strategy": "sparse",
            "enable_acronym_expansion": False,
            "auto_filter_identifiers": False,
            "router": False,
        },
        "sparse_with_expansion": {
            "strategy": "sparse",
            "enable_acronym_expansion": True,
            "auto_filter_identifiers": False,
            "router": False,
        },
        # 3. Dense single-modal controls
        "dense_no_expansion": {
            "strategy": "dense",
            "enable_acronym_expansion": False,
            "auto_filter_identifiers": False,
            "router": False,
        },
        "dense_with_expansion": {
            "strategy": "dense",
            "enable_acronym_expansion": True,
            "auto_filter_identifiers": False,
            "router": False,
        },
    }

    results: dict[str, list[dict[str, Any]]] = {arm: [] for arm in arms}

    for arm_name, arm_cfg in arms.items():
        print(f"Running arm: {arm_name:<38} (split={split})...")
        for item in eval_set:
            qid = item["query_id"]
            qtext = item["query"]
            category = item.get("category", "unknown")
            subtype = item.get("subtype", "unknown")
            expect_abstain = item.get("expect_abstain", False)
            expected = item.get("expected_doc_ids", [])

            resp = pipeline.query(
                qtext,
                strategy=arm_cfg["strategy"],
                enable_acronym_expansion=arm_cfg["enable_acronym_expansion"],
                auto_filter_identifiers=arm_cfg["auto_filter_identifiers"],
                router=arm_cfg["router"],
                reranker="none",
                floor_mode="off",
            )

            raw_candidate_ids = resp.retrieval.get("retrieved_doc_ids", [])
            retrieved_doc_ids = _unique_order_preserved(raw_candidate_ids)

            m5 = compute_retrieval_metrics(retrieved_doc_ids, expected, k=5)
            m10 = compute_retrieval_metrics(retrieved_doc_ids, expected, k=10)

            results[arm_name].append({
                "query_id": qid,
                "query": qtext,
                "category": category,
                "subtype": subtype,
                "expect_abstain": expect_abstain,
                "recall@5": m5.recall_at_k,
                "recall@10": m10.recall_at_k,
                "precision@5": m5.precision_at_k,
                "mrr": m5.mrr,
                "ndcg@5": m5.ndcg_at_k,
                "hit_rate@5": m5.hit_rate,
                "detected_cves": resp.retrieval.get("detected_cves", []),
                "detected_techniques": resp.retrieval.get("detected_technique_ids", []),
                "expansion_terms": resp.retrieval.get("expansion_terms", []),
                "latency_ms": resp.latency_ms["retrieval_ms"],
                "top_retrieved": retrieved_doc_ids[:5],
            })

    # Summaries for in-corpus answerable queries
    summary = {}
    per_class_summary = {arm: {} for arm in arms}
    glossary_slice_summary = {arm: {} for arm in arms}

    answerable_items = [item for item in eval_set if not item.get("expect_abstain")]
    answerable_ids = {item["query_id"] for item in answerable_items}
    all_categories = sorted({item.get("category") for item in answerable_items})

    for arm_name, records in results.items():
        ans_records = [r for r in records if r["query_id"] in answerable_ids]
        n = len(ans_records)
        summary[arm_name] = {
            "recall@5": round(sum(r["recall@5"] for r in ans_records) / n, 4) if n else 0.0,
            "recall@10": round(sum(r["recall@10"] for r in ans_records) / n, 4) if n else 0.0,
            "precision@5": round(sum(r["precision@5"] for r in ans_records) / n, 4) if n else 0.0,
            "mrr": round(sum(r["mrr"] for r in ans_records) / n, 4) if n else 0.0,
            "ndcg@5": round(sum(r["ndcg@5"] for r in ans_records) / n, 4) if n else 0.0,
            "hit_rate@5": round(sum(r["hit_rate@5"] for r in ans_records) / n, 4) if n else 0.0,
            "avg_latency_ms": round(sum(r["latency_ms"] for r in records) / len(records), 1) if records else 0.0,
        }

        # Per-class summary
        for cat in all_categories:
            cat_recs = [r for r in ans_records if r["category"] == cat]
            cn = len(cat_recs)
            per_class_summary[arm_name][cat] = {
                "count": cn,
                "recall@5": round(sum(r["recall@5"] for r in cat_recs) / cn, 4) if cn else 0.0,
                "mrr": round(sum(r["mrr"] for r in cat_recs) / cn, 4) if cn else 0.0,
                "ndcg@5": round(sum(r["ndcg@5"] for r in cat_recs) / cn, 4) if cn else 0.0,
            }

        # In-glossary vs Out-of-glossary breakdown for Class 3
        c3_recs = [r for r in ans_records if r["category"] == "acronym_abbreviation"]
        for g_type in ("in_glossary_acronym", "out_of_glossary_acronym"):
            g_recs = [r for r in c3_recs if r["subtype"] == g_type]
            gn = len(g_recs) if g_recs else 1
            glossary_slice_summary[arm_name][g_type] = {
                "count": len(g_recs),
                "recall@5": round(sum(r["recall@5"] for r in g_recs) / gn, 4) if g_recs else 0.0,
                "mrr": round(sum(r["mrr"] for r in g_recs) / gn, 4) if g_recs else 0.0,
                "ndcg@5": round(sum(r["ndcg@5"] for r in g_recs) / gn, 4) if g_recs else 0.0,
            }

    # Paired Statistics against hybrid_raw_no_expansion on In-Corpus queries
    base_arm = "hybrid_raw_no_expansion"
    base_recs = {r["query_id"]: r for r in results[base_arm] if r["query_id"] in answerable_ids}

    paired_stats_vs_baseline = {}
    test_arms = [
        "hybrid_acronym_expansion_only",
        "hybrid_identifier_autofilter_only",
        "hybrid_identifier_router_only",
        "hybrid_full_qu",
    ]

    for tarm in test_arms:
        t_recs = {r["query_id"]: r for r in results[tarm] if r["query_id"] in answerable_ids}
        tarm_stats = {}
        for metric in ["recall@5", "mrr", "ndcg@5"]:
            deltas = np.array([t_recs[qid][metric] - base_recs[qid][metric] for qid in answerable_ids])
            mean_d, ci_low, ci_high = _bootstrap_ci(deltas)
            nz = deltas[deltas != 0]
            p_val = float(stats.wilcoxon(deltas, alternative="two-sided").pvalue) if len(nz) > 0 else 1.0
            s_d = float(np.std(deltas, ddof=1))
            cohen_d = mean_d / s_d if s_d > 0 else 0.0

            imp = int(np.sum(deltas > 1e-6))
            deg = int(np.sum(deltas < -1e-6))
            unc = int(len(deltas) - imp - deg)

            # Per-class deltas
            class_deltas = {}
            for cat in all_categories:
                cat_qids = [qid for qid in answerable_ids if base_recs[qid]["category"] == cat]
                c_deltas = [t_recs[qid][metric] - base_recs[qid][metric] for qid in cat_qids]
                class_deltas[cat] = {
                    "mean_delta": float(np.mean(c_deltas)) if c_deltas else 0.0,
                    "median_delta": float(np.median(c_deltas)) if c_deltas else 0.0,
                }

            tarm_stats[metric] = {
                "mean_delta": mean_d,
                "median_delta": float(np.median(deltas)),
                "ci_95": [ci_low, ci_high],
                "wilcoxon_p": p_val,
                "cohen_d": cohen_d,
                "crosses_zero": bool(ci_low <= 0 <= ci_high),
                "improved": imp,
                "degraded": deg,
                "unchanged": unc,
                "per_class": class_deltas,
            }
        paired_stats_vs_baseline[tarm] = tarm_stats

    # Print summaries
    print("\n" + "=" * 95)
    print(f"EXPERIMENT E4: OVERALL SUMMARY ({split.upper()} SPLIT, n={len(answerable_ids)} in-corpus)")
    print("=" * 95)
    header = f"{'Arm Name':<38}{'Rec@5':<9}{'Rec@10':<9}{'Prec@5':<9}{'MRR':<8}{'nDCG@5':<9}{'Lat(ms)':<8}"
    print(header)
    print("-" * len(header))
    for arm_name, s in summary.items():
        print(
            f"{arm_name:<38}{s['recall@5']:<9.4f}{s['recall@10']:<9.4f}{s['precision@5']:<9.4f}"
            f"{s['mrr']:<8.4f}{s['ndcg@5']:<9.4f}{s['avg_latency_ms']:<8.1f}"
        )

    # Print Paired Delta Summary
    print("\n" + "=" * 105)
    print(f"PAIRED PER-QUERY STATISTICAL COMPARISONS vs BASELINE ({split.upper()} SPLIT)")
    print("=" * 105)
    print(f"{'Treatment Arm':<36} | {'Metric':<9} | {'Improved':<8} {'Degraded':<8} {'Unchanged':<9} | {'Mean Δ':<8} {'95% CI':<20} {'p-value':<8}")
    print("-" * 105)
    for tarm in test_arms:
        for metric in ["recall@5", "mrr", "ndcg@5"]:
            pst = paired_stats_vs_baseline[tarm][metric]
            ci_str = f"[{pst['ci_95'][0]:+.4f}, {pst['ci_95'][1]:+.4f}]"
            print(
                f"{tarm:<36} | {metric:<9} | {pst['improved']:<8} {pst['degraded']:<8} {pst['unchanged']:<9} | "
                f"{pst['mean_delta']:<+8.4f} {ci_str:<20} {pst['wilcoxon_p']:<8.4f}"
            )
    print("=" * 105)

    repro_meta = make_reproducibility_metadata(
        experiment_name="E4_query_understanding",
        split=split,
        query_count=len(eval_set),
        eval_path=eval_path,
        model_identifier="tfidf_svd_local",
        device="cpu",
        random_seed=42,
        extra_config={"baseline_arm": base_arm, "test_arms": test_arms},
    )

    output_payload = {
        "metadata": repro_meta,
        "summary": summary,
        "per_class_summary": per_class_summary,
        "glossary_slice_summary": glossary_slice_summary,
        "paired_statistics_vs_baseline": paired_stats_vs_baseline,
        "records": results,
    }

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(output_payload, f, indent=2)
    print(f"\nSaved DEV-isolated E4 results to {out_path}")

    return output_payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Experiment E4 with split isolation.")
    parser.add_argument("--eval-path", default="eval_data/eval_set.json")
    parser.add_argument("--split", default="dev", choices=["dev", "test", "all"], help="Dataset split to evaluate.")
    parser.add_argument("--out", default=None, help="Output JSON path (defaults to experiments/e4_results_<split>.json).")
    args = parser.parse_args()
    run_e4(args.eval_path, args.out, args.split)
