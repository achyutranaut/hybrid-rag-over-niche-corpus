#!/usr/bin/env python3
"""Run ingestion: python scripts/ingest.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import Config
from src.ingestion.pipeline import run_ingestion

if __name__ == "__main__":
    cfg = Config.from_env()
    run_ingestion(cfg, f"{cfg.raw_dir}/enterprise-attack.json", f"{cfg.raw_dir}/cves", recreate=True)
