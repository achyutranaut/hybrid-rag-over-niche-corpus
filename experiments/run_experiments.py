#!/usr/bin/env python3
"""
Runs the labeled eval set (eval_data/eval_set.json) against each retrieval
strategy and reports Recall@K / Precision@K / MRR / nDCG@K / Hit Rate,
citation correctness, and per-stage latency -- reproducibly, from one
config, without editing application code (architecture section 16).

Usage:
  python experiments/run_experiments.py
  python experiments/run_experiments.py --k 5
  python experiments/run_experiments.py --strategies dense hybrid_rerank
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import Config
from src.eval.metrics import compute_retrieval_metrics, citation_correctness
from src.ingestion.pipeline import load_store
from src.rag_pipeline import RagPipeline

ALL_STRATEGIES = ["dense", "sparse", "hybrid", "hybrid_rerank"]


def _unique_order_preserved(items: list[str]) -> list[str]:
    seen = set()
    return [x for x in items if not (x in seen or seen.add(x))]


def run(strategies: list[str], k: int, eval_path: str, out_path: str | None, split: str = "all"):
    cfg = Config.from_env()
    store = load_store(cfg)
    pipeline = RagPipeline(cfg, store)

    eval_set = json.load(open(eval_path))
    if split != "all":
        eval_set = [item for item in eval_set if item.get("split") == split]

    results = {s: {"retrieval": [], "citation_correctness": [], "latency_ms": [], "abstention": []} for s in strategies}
    per_class_records = {s: {} for s in strategies}
    per_query_rows = []

    for item in eval_set:
        query = item["query"]
        expected = item.get("expected_doc_ids", [])
        category = item.get("category", "uncategorized")
        expect_abstain = item.get("expect_abstain", False)
        query_id = item.get("query_id", query[:15])

        for strategy in strategies:
            resp = pipeline.query(query, strategy=strategy)

            # 1. First-stage retrieval evaluation (candidate pool from Qdrant)
            first_stage_doc_ids = _unique_order_preserved(resp.retrieval.get("retrieved_doc_ids", []))
            m_first_stage = compute_retrieval_metrics(first_stage_doc_ids, expected, k)

            # 2. Reranked retrieval evaluation (post-rerank, pre-floor)
            reranked_doc_ids = _unique_order_preserved(resp.retrieval.get("reranked_doc_ids", []))
            m_reranked = compute_retrieval_metrics(reranked_doc_ids, expected, k)

            # Active retrieval metric for summary:
            # hybrid_rerank evaluates reranked candidates; baselines evaluate first-stage candidates.
            active_m = m_reranked if strategy == "hybrid_rerank" else m_first_stage

            # 3. Generation & citation evaluation
            cited_doc_ids = _unique_order_preserved([c["chunk_id"].split("::chunk")[0] for c in resp.citations])
            cc = citation_correctness(cited_doc_ids, expected)

            # 4. Abstention evaluation for Class 8
            # Abstained is true if pipeline returned not grounded (or empty filtered docs)
            abstained = (not resp.grounded) or (len(resp.retrieval.get("filtered_doc_ids", [])) == 0)
            correct_abstention = (expect_abstain and abstained)
            false_answer = (expect_abstain and not abstained)

            if expect_abstain:
                results[strategy]["abstention"].append(
                    {"query_id": query_id, "correct_abstention": correct_abstention, "false_answer": false_answer}
                )
            else:
                results[strategy]["retrieval"].append(active_m)
                results[strategy]["citation_correctness"].append(cc)

                if category not in per_class_records[strategy]:
                    per_class_records[strategy][category] = []
                per_class_records[strategy][category].append(active_m)

            results[strategy]["latency_ms"].append(resp.latency_ms["total_ms"])

            per_query_rows.append(
                {
                    "query_id": query_id,
                    "query": query,
                    "category": category,
                    "subtype": item.get("subtype"),
                    "split": item.get("split"),
                    "strategy": strategy,
                    "expect_abstain": expect_abstain,
                    "abstained": abstained,
                    "correct_abstention": correct_abstention if expect_abstain else None,
                    "false_answer": false_answer if expect_abstain else None,
                    "first_stage": {
                        "retrieved_doc_ids": first_stage_doc_ids,
                        "recall_at_k": m_first_stage.recall_at_k,
                        "precision_at_k": m_first_stage.precision_at_k,
                        "mrr": m_first_stage.mrr,
                        "ndcg_at_k": m_first_stage.ndcg_at_k,
                        "hit_rate": m_first_stage.hit_rate,
                    },
                    "reranked": {
                        "retrieved_doc_ids": reranked_doc_ids,
                        "recall_at_k": m_reranked.recall_at_k,
                        "precision_at_k": m_reranked.precision_at_k,
                        "mrr": m_reranked.mrr,
                        "ndcg_at_k": m_reranked.ndcg_at_k,
                        "hit_rate": m_reranked.hit_rate,
                    },
                    "generation": {
                        "cited_doc_ids": cited_doc_ids,
                        "citation_correctness": cc,
                        "grounded": resp.grounded,
                    },
                    "above_relevance_floor": resp.retrieval.get("above_relevance_floor", 0),
                    "floor_mode": resp.retrieval.get("floor_mode", "off"),
                    "latency_ms": resp.latency_ms["total_ms"],
                    "expected_doc_ids": expected,
                }
            )

    summary = {}
    abstention_summary = {}
    per_class_summary = {s: {} for s in strategies}

    for strategy in strategies:
        rs = results[strategy]["retrieval"]
        n = len(rs) if rs else 1
        summary[strategy] = {
            "recall_at_k": round(sum(r.recall_at_k for r in rs) / n, 3) if rs else 0.0,
            "precision_at_k": round(sum(r.precision_at_k for r in rs) / n, 3) if rs else 0.0,
            "mrr": round(sum(r.mrr for r in rs) / n, 3) if rs else 0.0,
            "ndcg_at_k": round(sum(r.ndcg_at_k for r in rs) / n, 3) if rs else 0.0,
            "hit_rate": round(sum(r.hit_rate for r in rs) / n, 3) if rs else 0.0,
            "citation_correctness": round(sum(results[strategy]["citation_correctness"]) / n, 3) if rs else 0.0,
            "avg_latency_ms": round(sum(results[strategy]["latency_ms"]) / len(eval_set), 1),
        }

        # Abstention metrics
        ab_list = results[strategy]["abstention"]
        if ab_list:
            correct = sum(1 for a in ab_list if a["correct_abstention"])
            false_ans = sum(1 for a in ab_list if a["false_answer"])
            abstention_summary[strategy] = {
                "abstention_count": len(ab_list),
                "abstention_accuracy": round(correct / len(ab_list), 3),
                "false_answer_rate": round(false_ans / len(ab_list), 3),
            }

        # Per-class summary
        for cat, cat_rs in per_class_records[strategy].items():
            cn = len(cat_rs)
            per_class_summary[strategy][cat] = {
                "count": cn,
                "recall@k": round(sum(r.recall_at_k for r in cat_rs) / cn, 3),
                "precision@k": round(sum(r.precision_at_k for r in cat_rs) / cn, 3),
                "mrr": round(sum(r.mrr for r in cat_rs) / cn, 3),
                "ndcg@k": round(sum(r.ndcg_at_k for r in cat_rs) / cn, 3),
            }

    print(f"\n=== Experiment results (k={k}, n_queries={len(eval_set)}, split={split}) ===\n")
    print("--- Macro-Averaged Retrieval Results (Answerable Queries) ---")
    header = f"{'strategy':<16}{'recall@k':<10}{'prec@k':<9}{'mrr':<7}{'ndcg@k':<9}{'hit_rate':<10}{'cite_ok':<9}{'lat_ms':<8}"
    print(header)
    print("-" * len(header))
    for strategy in strategies:
        s = summary[strategy]
        print(
            f"{strategy:<16}{s['recall_at_k']:<10}{s['precision_at_k']:<9}{s['mrr']:<7}"
            f"{s['ndcg_at_k']:<9}{s['hit_rate']:<10}{s['citation_correctness']:<9}{s['avg_latency_ms']:<8}"
        )

    if abstention_summary:
        print("\n--- Abstention Performance (Class 8: Out-of-Corpus) ---")
        ab_header = f"{'strategy':<16}{'count':<8}{'abstain_acc':<14}{'false_ans_rate':<16}"
        print(ab_header)
        print("-" * len(ab_header))
        for strategy in strategies:
            ab = abstention_summary.get(strategy, {})
            if ab:
                print(f"{strategy:<16}{ab['abstention_count']:<8}{ab['abstention_accuracy']:<14.3f}{ab['false_answer_rate']:<16.3f}")

    all_cats = sorted({item.get("category") for item in eval_set if not item.get("expect_abstain")})
    if all_cats:
        print("\n--- Per-Class Retrieval Breakdown (MRR / Recall@k) ---")
        cat_hdr = f"{'strategy':<16}" + "".join([f"{c[:13]:<16}" for c in all_cats])
        print(cat_hdr)
        print("-" * len(cat_hdr))
        for strategy in strategies:
            row = f"{strategy:<16}"
            for c in all_cats:
                cdata = per_class_summary[strategy].get(c, {})
                mrr_v = cdata.get("mrr", 0.0)
                rec_v = cdata.get("recall@k", 0.0)
                row += f"M:{mrr_v:.2f}/R:{rec_v:.2f}  "
            print(row)

    if out_path:
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        json.dump(
            {
                "summary": summary,
                "per_class_summary": per_class_summary,
                "abstention_summary": abstention_summary,
                "per_query": per_query_rows,
            },
            open(out_path, "w"),
            indent=2,
        )
        print(f"\nFull results written to {out_path}")

    return summary, per_query_rows


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--strategies", nargs="+", default=ALL_STRATEGIES, choices=ALL_STRATEGIES)
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--eval-path", default="eval_data/eval_set.json")
    parser.add_argument("--out", default="experiments/results.json")
    parser.add_argument("--split", default="all", choices=["all", "dev", "test"])
    args = parser.parse_args()
    run(args.strategies, args.k, args.eval_path, args.out, split=args.split)
