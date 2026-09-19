#!/usr/bin/env python3
"""
Corrective Forensic Analysis: Statistical Validation & Split Evaluation
Computes paired per-query deltas, 10,000-sample bootstrap 95% confidence intervals,
Wilcoxon signed-rank tests, Cohen's d effect sizes, and dev vs. held-out test splits.
Evaluates both DEV (n=56 in-corpus) and held-out TEST (n=14 in-corpus) rigorously.
"""
import json
from pathlib import Path
import numpy as np
from scipy import stats


def bootstrap_ci(deltas, n_boot=10000, ci=0.95, seed=42):
    np.random.seed(seed)
    n = len(deltas)
    if n == 0:
        return 0.0, 0.0, 0.0
    sample_indices = np.random.randint(0, n, size=(n_boot, n))
    boot_means = np.mean(deltas[sample_indices], axis=1)
    alpha = (1.0 - ci) / 2.0
    low = np.percentile(boot_means, alpha * 100)
    high = np.percentile(boot_means, (1.0 - alpha) * 100)
    return float(np.mean(deltas)), float(low), float(high)


def compute_paired_stats(treat_recs, base_recs, valid_qids):
    treat_map = {r["query_id"]: r for r in treat_recs if r["query_id"] in valid_qids}
    base_map = {r["query_id"]: r for r in base_recs if r["query_id"] in valid_qids}

    metric_data = {}
    for metric in ["recall@5", "mrr", "ndcg@5"]:
        t_vals = np.array([treat_map[qid][metric] for qid in valid_qids if qid in treat_map and qid in base_map])
        b_vals = np.array([base_map[qid][metric] for qid in valid_qids if qid in treat_map and qid in base_map])
        deltas = t_vals - b_vals

        if len(deltas) == 0:
            continue

        mean_d, ci_low, ci_high = bootstrap_ci(deltas)
        nz = deltas[deltas != 0]
        if len(nz) > 0:
            try:
                p_val = float(stats.wilcoxon(deltas, alternative="two-sided").pvalue)
            except Exception:
                p_val = 1.0
        else:
            p_val = 1.0

        s_d = float(np.std(deltas, ddof=1)) if len(deltas) > 1 else 0.0
        cohen_d = mean_d / s_d if s_d > 0 else 0.0

        imp = int(np.sum(deltas > 1e-6))
        deg = int(np.sum(deltas < -1e-6))
        unc = int(len(deltas) - imp - deg)

        metric_data[metric] = {
            "mean_delta": mean_d,
            "ci_95": [ci_low, ci_high],
            "wilcoxon_p": p_val,
            "cohen_d": cohen_d,
            "crosses_zero": bool(ci_low <= 0 <= ci_high),
            "improved": imp,
            "degraded": deg,
            "unchanged": unc,
        }
    return metric_data


def run_audit():
    root = Path(__file__).resolve().parents[1]
    with open(root / "eval_data" / "eval_set.json") as f:
        eval_set = {q["query_id"]: q for q in json.load(f)}

    # Load DEV and TEST files
    with open(root / "experiments" / "b1_results_dev.json") as f:
        b1_dev = json.load(f)
    with open(root / "experiments" / "b1_results_test.json") as f:
        b1_test = json.load(f)

    with open(root / "experiments" / "b2_results_dev.json") as f:
        b2_dev = json.load(f)
    with open(root / "experiments" / "b2_results_test.json") as f:
        b2_test = json.load(f)

    with open(root / "experiments" / "e4_results_dev.json") as f:
        e4_dev = json.load(f)
    with open(root / "experiments" / "e4_results_test.json") as f:
        e4_test = json.load(f)

    dev_in_corpus = [qid for qid, q in eval_set.items() if q.get("split") == "dev" and not q.get("expect_abstain")]
    test_in_corpus = [qid for qid, q in eval_set.items() if q.get("split") == "test" and not q.get("expect_abstain")]

    dev_c8 = [qid for qid, q in eval_set.items() if q.get("split") == "dev" and q.get("expect_abstain")]
    test_c8 = [qid for qid, q in eval_set.items() if q.get("split") == "test" and q.get("expect_abstain")]

    comparisons_b1 = [
        ("Dense BGE vs Dense LSA", "dense_bge", "dense_lsa"),
        ("Hybrid BGE vs Sparse BM25", "hybrid_bge", "sparse_bm25"),
        ("Hybrid BGE vs Hybrid LSA", "hybrid_bge", "hybrid_lsa"),
        ("Hybrid Router vs Hybrid BGE", "hybrid_bge_router", "hybrid_bge"),
    ]

    comparisons_b2 = [
        ("Cross-Encoder vs First-Stage Hybrid", "ce_logits_nofloor", "first_stage_hybrid"),
        ("CE AbsFloor 0.0 vs First-Stage Hybrid", "ce_logits_floor_abs0", "first_stage_hybrid"),
        ("Lexical Reranker vs First-Stage Hybrid", "lexical_rerank_nofloor", "first_stage_hybrid"),
    ]

    comparisons_e4 = [
        ("Acronym Expansion vs Baseline", "hybrid_acronym_expansion_only", "hybrid_raw_no_expansion"),
        ("Identifier Autofilter vs Baseline", "hybrid_identifier_autofilter_only", "hybrid_raw_no_expansion"),
        ("Identifier Router vs Baseline", "hybrid_identifier_router_only", "hybrid_raw_no_expansion"),
    ]

    paired_stats_dev = {}
    paired_stats_test = {}

    # B1 stats
    for name, t_key, b_key in comparisons_b1:
        paired_stats_dev[name] = compute_paired_stats(b1_dev["records"][t_key], b1_dev["records"][b_key], dev_in_corpus)
        paired_stats_test[name] = compute_paired_stats(b1_test["records"][t_key], b1_test["records"][b_key], test_in_corpus)

    # B2 stats
    for name, t_key, b_key in comparisons_b2:
        paired_stats_dev[name] = compute_paired_stats(b2_dev["records"][t_key], b2_dev["records"][b_key], dev_in_corpus)
        paired_stats_test[name] = compute_paired_stats(b2_test["records"][t_key], b2_test["records"][b_key], test_in_corpus)

    # E4 stats
    for name, t_key, b_key in comparisons_e4:
        paired_stats_dev[name] = compute_paired_stats(e4_dev["records"][t_key], e4_dev["records"][b_key], dev_in_corpus)
        paired_stats_test[name] = compute_paired_stats(e4_test["records"][t_key], e4_test["records"][b_key], test_in_corpus)

    # Split stability: compare model metrics DEV vs TEST
    models_b1 = ["dense_lsa", "dense_bge", "sparse_bm25", "hybrid_lsa", "hybrid_bge", "hybrid_bge_router"]
    stability = {}
    for m in models_b1:
        dev_m = b1_dev["overall_summary"][m]
        test_m = b1_test["overall_summary"][m]
        stability[m] = {
            "dev": {"recall@5": dev_m.get("in_corpus_recall@5", dev_m.get("recall@5")), "mrr": dev_m["mrr"], "ndcg@5": dev_m["ndcg@5"]},
            "test": {"recall@5": test_m.get("in_corpus_recall@5", test_m.get("recall@5")), "mrr": test_m["mrr"], "ndcg@5": test_m["ndcg@5"]},
            "delta_test_minus_dev": {
                "recall@5": test_m.get("in_corpus_recall@5", test_m.get("recall@5")) - dev_m.get("in_corpus_recall@5", dev_m.get("recall@5")),
                "mrr": test_m["mrr"] - dev_m["mrr"],
                "ndcg@5": test_m["ndcg@5"] - dev_m["ndcg@5"],
            }
        }

    output = {
        "metadata": {
            "dev_in_corpus_count": len(dev_in_corpus),
            "test_in_corpus_count": len(test_in_corpus),
            "dev_class_8_count": len(dev_c8),
            "test_class_8_count": len(test_c8),
        },
        "paired_statistics_dev": paired_stats_dev,
        "paired_statistics_test": paired_stats_test,
        "split_stability_b1": stability,
        "b2_abstention_evaluation": {
            "class_8_standard": {
                "dev_abstention_acc": b2_dev["configurations_summary"]["ce_logits_floor_abs0"].get("abstention_accuracy", 0.0),
                "test_abstention_acc": b2_test["configurations_summary"]["ce_logits_floor_abs0"].get("abstention_accuracy", 0.0),
            },
            "expanded_ood_calibration": {
                "dev_abstention_acc": b2_dev["expanded_ood_calibration"]["ce_logits_abs0.0"]["abstention_accuracy"],
                "test_abstention_acc": b2_test["expanded_ood_calibration"]["ce_logits_abs0.0 (FROZEN)"]["abstention_accuracy"],
                "dev_counts": b2_dev["expanded_ood_calibration"]["ce_logits_abs0.0"],
                "test_counts": b2_test["expanded_ood_calibration"]["ce_logits_abs0.0 (FROZEN)"],
            }
        }
    }

    out_file = root / "experiments" / "statistical_test_results.json"
    with open(out_file, "w") as f:
        json.dump(output, f, indent=2)
    print(f"Saved split-aware statistical results to {out_file}")


if __name__ == "__main__":
    run_audit()
