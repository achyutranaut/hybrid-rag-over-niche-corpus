"""
Ingest the corpus into a dedicated Qdrant collection using BAAI/bge-small-en-v1.5 embeddings.
Preserves existing Tier A collection cyber_corpus_v1 intact.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import Config
from src.ingestion.pipeline import run_ingestion

def main():
    cfg = Config(
        collection_name="cyber_corpus_bge_v1",
        embedding_provider="sentence_transformers",
        embedding_dim=384,
        processed_dir="./data/processed_bge",
    )
    
    Path(cfg.processed_dir).mkdir(parents=True, exist_ok=True)
    
    attack_path = "./data/raw/enterprise-attack.json"
    cve_dir = "./data/raw/cves"
    
    print("Starting BGE ingestion into collection:", cfg.collection_name)
    store = run_ingestion(cfg, attack_path, cve_dir, recreate=True)
    print(f"BGE Ingestion complete. Total points in {cfg.collection_name}: {store.count()}")

if __name__ == "__main__":
    main()
