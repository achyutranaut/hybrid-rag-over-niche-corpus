"""
FastAPI backend. Endpoints match ARCHITECTURE.md section 18.

Run: uvicorn src.api.main:app --reload --port 8000
(requires ingestion to have been run first: python scripts/ingest.py)
"""
from __future__ import annotations

from dataclasses import asdict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from ..config import Config
from ..ingestion.pipeline import load_store
from ..rag_pipeline import RagPipeline, RetrievalStrategy

app = FastAPI(title="Hybrid RAG — Cybersecurity Corpus", version="0.1.0")

_cfg = Config.from_env()
_pipeline: RagPipeline | None = None


class QueryRequest(BaseModel):
    query: str
    strategy: RetrievalStrategy = "hybrid_rerank"
    document_type: str | None = None
    source: str | None = None


@app.on_event("startup")
def _startup():
    global _pipeline
    try:
        store = load_store(_cfg)
        _pipeline = RagPipeline(_cfg, store)
    except FileNotFoundError:
        # Ingestion hasn't run yet -- /health will report this, other
        # endpoints will 503 with a clear message instead of crashing.
        _pipeline = None


def _require_pipeline() -> RagPipeline:
    if _pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="Corpus not ingested yet. Run `python scripts/ingest.py` first.",
        )
    return _pipeline


@app.get("/api/v1/health")
def health():
    return {
        "status": "ok" if _pipeline is not None else "not_ingested",
        "collection_points": _pipeline.store.count() if _pipeline else 0,
    }


@app.post("/api/v1/query")
def query(req: QueryRequest):
    pipeline = _require_pipeline()
    resp = pipeline.query(req.query, strategy=req.strategy, document_type=req.document_type, source=req.source)
    return asdict(resp)


@app.get("/api/v1/documents/{doc_id:path}")
def get_document(doc_id: str):
    pipeline = _require_pipeline()
    from qdrant_client import models

    res = pipeline.store.client.scroll(
        pipeline.store.collection_name,
        scroll_filter=models.Filter(
            must=[models.FieldCondition(key="parent_doc_id", match=models.MatchValue(value=doc_id))]
        ),
        limit=100,
    )
    points, _ = res
    if not points:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
    chunks = sorted(points, key=lambda p: p.payload.get("chunk_index", 0))
    return {
        "doc_id": doc_id,
        "title": chunks[0].payload.get("title"),
        "chunks": [{"chunk_id": c.payload["chunk_id"], "section": c.payload["section"], "text": c.payload["text"]} for c in chunks],
    }


@app.get("/api/v1/metrics")
def metrics():
    pipeline = _require_pipeline()
    return {"collection_points": pipeline.store.count(), "collection_name": pipeline.cfg.collection_name}


# POST /api/v1/ingest, POST /api/v1/reindex, DELETE /api/v1/documents/{id} are
# specified in ARCHITECTURE.md but intentionally not wired to HTTP here:
# ingestion mutates a shared local Qdrant path and should not be triggerable
# by an unauthenticated HTTP call without the auth/rate-limiting layer
# described in the Security section. Use scripts/ingest.py directly, or add
# those endpoints behind auth in Phase 10 (Hardening).
