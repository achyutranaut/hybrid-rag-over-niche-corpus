"""
Reproducibility and experiment metadata helpers.
Records model versions, revisions, corpus hashes, eval dataset hashes,
random seeds, runtime platforms, and split configurations.
"""
from __future__ import annotations

import glob
import hashlib
import os
import platform
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def compute_file_hash(filepath: str | Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return f"sha256:{h.hexdigest()[:16]}"


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


def get_git_commit() -> str:
    try:
        res = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        return res.stdout.strip()
    except Exception:
        return "uncommitted_initial"


def make_reproducibility_metadata(
    experiment_name: str,
    split: str,
    query_count: int,
    eval_path: str = "eval_data/eval_set.json",
    model_identifier: str | None = None,
    model_revision: str | None = None,
    device: str = "cpu",
    random_seed: int = 42,
    extra_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "experiment_name": experiment_name,
        "split": split,
        "query_count": query_count,
        "corpus_hash": compute_raw_corpus_hash(),
        "eval_dataset_hash": compute_file_hash(eval_path) if Path(eval_path).exists() else "not_found",
        "git_commit": get_git_commit(),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "device": device,
        "random_seed": random_seed,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }
    if model_identifier:
        meta["model_identifier"] = model_identifier
    if model_revision:
        meta["model_revision"] = model_revision
    if extra_config:
        meta["configuration"] = extra_config
    return meta
