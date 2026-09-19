#!/usr/bin/env python3
"""
Query the indexed corpus from the command line.

Usage:
  python scripts/query.py "How does credential dumping work?"
  python scripts/query.py "T1059.001" --strategy sparse
  python scripts/query.py "CVE-2021-44228 severity" --strategy hybrid_rerank
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import Config
from src.ingestion.pipeline import load_store
from src.rag_pipeline import RagPipeline


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("query")
    parser.add_argument("--strategy", default="hybrid_rerank", choices=["dense", "sparse", "hybrid", "hybrid_rerank"])
    parser.add_argument("--document-type", default=None)
    parser.add_argument("--source", default=None)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    cfg = Config.from_env()
    store = load_store(cfg)
    pipeline = RagPipeline(cfg, store)

    resp = pipeline.query(args.query, strategy=args.strategy, document_type=args.document_type, source=args.source)

    if args.json:
        print(json.dumps(
            {"answer": resp.answer, "citations": resp.citations, "retrieval": resp.retrieval,
             "latency_ms": resp.latency_ms, "grounded": resp.grounded},
            indent=2,
        ))
    else:
        print(f"\nQuery: {args.query}  [strategy={args.strategy}]\n")
        print(resp.answer)
        print(f"\nGrounded: {resp.grounded}")
        print(f"Retrieval: {resp.retrieval}")
        print(f"Latency: {resp.latency_ms}")
        print("\nSources:")
        for c in resp.citations:
            print(f"  [{c['marker']}] {c['title']} — {c['section']} ({c['url']})")


if __name__ == "__main__":
    main()
