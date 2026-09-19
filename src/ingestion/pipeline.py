"""
End-to-end ingestion: raw sources -> normalized documents -> chunks ->
fitted embedding/sparse models -> Qdrant collection.

Idempotency note: TF-IDF/SVD and BM25 vocabularies are fit on the full
chunk set each run. Re-running ingestion after the corpus changes refits
both and re-embeds every chunk (documented as a known v1 limitation in
ARCHITECTURE.md -- a transformer embedding provider wouldn't need this,
since it doesn't require corpus-level fitting; see embeddings.py).
Point IDs are still deterministic (uuid5 of chunk_id), so re-running
ingestion on an unchanged corpus upserts identical points rather than
duplicating them.
"""
from __future__ import annotations

import sys
import time

from ..config import Config
from ..retrieval.embeddings import get_embedding_provider
from ..retrieval.qdrant_store import QdrantStore
from ..retrieval.sparse import Bm25SparseEncoder
from .attack_parser import parse_attack_bundle
from .cve_parser import parse_cve_directory
from .chunker import chunk_document


def run_ingestion(cfg: Config, attack_json_path: str, cve_dir: str, recreate: bool = True) -> QdrantStore:
    t0 = time.time()
    print("[1/6] Parsing MITRE ATT&CK bundle...", file=sys.stderr)
    attack_docs = parse_attack_bundle(attack_json_path)
    print(f"      {len(attack_docs)} techniques parsed", file=sys.stderr)

    print("[2/6] Parsing CVE records...", file=sys.stderr)
    cve_docs = parse_cve_directory(cve_dir)
    print(f"      {len(cve_docs)} CVEs parsed", file=sys.stderr)

    all_docs = attack_docs + cve_docs

    print("[3/6] Chunking (structure-aware, parent-linked)...", file=sys.stderr)
    chunks = []
    for doc in all_docs:
        chunks.extend(
            chunk_document(
                doc,
                target_tokens=cfg.chunk_target_tokens,
                overlap_tokens=cfg.chunk_overlap_tokens,
                min_tokens=cfg.chunk_min_tokens,
            )
        )
    print(f"      {len(chunks)} chunks from {len(all_docs)} documents", file=sys.stderr)

    texts = [c.text for c in chunks]

    print(f"[4/6] Fitting dense embedding provider ({cfg.embedding_provider})...", file=sys.stderr)
    embedder = get_embedding_provider(cfg.embedding_provider, dim=cfg.embedding_dim)
    embedder.fit(texts)

    print("[5/6] Fitting BM25 sparse encoder...", file=sys.stderr)
    sparse = Bm25SparseEncoder()
    sparse.fit(texts)

    print("[6/6] Writing to Qdrant (embedded local mode)...", file=sys.stderr)
    store = QdrantStore(cfg.qdrant_path, cfg.collection_name, embedder, sparse)
    store.create_collection(recreate=recreate)
    store.upsert_chunks(chunks)

    embedder.save(f"{cfg.processed_dir}/embedder.pkl")
    sparse.save(f"{cfg.processed_dir}/sparse.pkl")

    print(f"Done in {time.time() - t0:.1f}s. Indexed {store.count()} points.", file=sys.stderr)
    print(f"Fitted models saved to {cfg.processed_dir}/", file=sys.stderr)
    return store


def load_store(cfg: Config, client: Any | None = None) -> QdrantStore:
    """Load a previously-ingested store using the fitted models saved by run_ingestion."""
    embedder = get_embedding_provider(cfg.embedding_provider, dim=cfg.embedding_dim)
    embedder.load(f"{cfg.processed_dir}/embedder.pkl")
    sparse = Bm25SparseEncoder()
    sparse.load(f"{cfg.processed_dir}/sparse.pkl")
    return QdrantStore(cfg.qdrant_path, cfg.collection_name, embedder, sparse, client=client)
