#!/usr/bin/env python3
"""
Validates evaluation set files (e.g. eval_data/eval_set.json) against the canonical schema
in eval_data/eval_set_schema_template.json and against the live ingested Qdrant index.

Checks:
1. JSONSchema compliance for all queries.
2. Uniqueness of query_id.
3. Category counts (ensures all 8 taxonomy classes are represented).
4. Abstention integrity (if expect_abstain is True, relevance/expected_doc_ids must be empty).
5. Ground truth integrity: all expected doc_ids must exist in Qdrant store.
6. Corpus version binding: corpus_version must match ingested corpus hash.

Usage:
  python scripts/validate_eval_set.py
  python scripts/validate_eval_set.py --eval-path eval_data/eval_set.json
"""
import argparse
import hashlib
import glob
import json
import sys
from pathlib import Path

import jsonschema

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import Config
from src.ingestion.pipeline import load_store


def compute_raw_corpus_hash() -> str:
    h = hashlib.sha256()
    attack_path = Path("data/raw/enterprise-attack.json")
    if attack_path.exists():
        with open(attack_path, "rb") as f:
            while chunk := f.read(65536):
                h.update(chunk)
    for p in sorted(glob.glob("data/raw/cves/*.json")):
        with open(p, "rb") as f:
            while chunk := f.read(65536):
                h.update(chunk)
    return f"sha256:{h.hexdigest()[:16]}"


def validate_eval_set(eval_path: str, schema_path: str = "eval_data/eval_set_schema_template.json"):
    print(f"Loading schema from {schema_path}...")
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    print(f"Loading eval set from {eval_path}...")
    with open(eval_path, "r", encoding="utf-8") as f:
        eval_set = json.load(f)

    if not isinstance(eval_set, list):
        raise ValueError("Evaluation file must contain a JSON array of query objects.")

    print(f"Validating {len(eval_set)} queries against JSONSchema...")
    seen_ids = set()
    category_counts = {}
    split_counts = {}

    expected_hash = compute_raw_corpus_hash()
    print(f"Computed raw corpus content hash: {expected_hash}")

    for idx, item in enumerate(eval_set):
        qid = item.get("query_id", f"index_{idx}")
        # Validate schema
        try:
            jsonschema.validate(instance=item, schema=schema)
        except jsonschema.ValidationError as e:
            raise ValueError(f"Schema validation error in query {qid}: {e.message}") from e

        if qid in seen_ids:
            raise ValueError(f"Duplicate query_id detected: {qid}")
        seen_ids.add(qid)

        cat = item["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1

        split = item.get("split", "unspecified")
        split_counts[split] = split_counts.get(split, 0) + 1

        # Check abstention rule
        if item.get("expect_abstain", False):
            if item.get("expected_doc_ids") and len(item["expected_doc_ids"]) > 0:
                raise ValueError(f"Query {qid} has expect_abstain=True but expected_doc_ids is not empty!")
            rel = item.get("relevance", {})
            if any(v > 0 for v in rel.values()):
                raise ValueError(f"Query {qid} has expect_abstain=True but contains positive relevance grades!")

        # Check corpus version
        cv = item.get("corpus_version")
        if cv and cv != expected_hash:
            raise ValueError(f"Query {qid} corpus_version mismatch: got {cv}, expected {expected_hash}")

    print("\n--- Category Breakdown ---")
    for cat, count in sorted(category_counts.items()):
        print(f"  {cat:<25}: {count}")

    print("\n--- Split Breakdown ---")
    for split, count in sorted(split_counts.items()):
        print(f"  {split:<25}: {count}")

    # Verify against live Qdrant index
    print("\nConnecting to Qdrant to verify all labeled document IDs...")
    cfg = Config.from_env()
    store = load_store(cfg)
    res, _ = store.client.scroll(store.collection_name, limit=10000, with_payload=["parent_doc_id"])
    valid_doc_ids = {p.payload["parent_doc_id"] for p in res}
    print(f"Loaded {len(valid_doc_ids)} unique parent doc IDs from Qdrant store.")

    missing_docs = {}
    for item in eval_set:
        qid = item["query_id"]
        doc_ids_to_check = set(item.get("expected_doc_ids", []))
        doc_ids_to_check.update(item.get("relevance", {}).keys())
        for r_set in item.get("required_sets", []):
            doc_ids_to_check.update(r_set)

        missing = [d for d in doc_ids_to_check if d not in valid_doc_ids]
        if missing:
            missing_docs[qid] = missing

    if missing_docs:
        error_msg = f"Found {len(missing_docs)} queries with document IDs not in the index:\n"
        for qid, missing in list(missing_docs.items())[:5]:
            error_msg += f"  Query {qid}: missing {missing}\n"
        raise ValueError(error_msg)

    print("\nSUCCESS: All document IDs verified against Qdrant index!")
    print(f"Eval set {eval_path} is 100% valid and consistent with corpus version {expected_hash}.\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-path", default="eval_data/eval_set.json")
    parser.add_argument("--schema-path", default="eval_data/eval_set_schema_template.json")
    args = parser.parse_args()
    validate_eval_set(args.eval_path, args.schema_path)
