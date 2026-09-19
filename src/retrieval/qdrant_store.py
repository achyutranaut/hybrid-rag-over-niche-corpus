"""
Qdrant collection schema and all read/write access to it.

SCHEMA DECISIONS (see ARCHITECTURE.md section 6 for full rationale)
---------------------------------------------------------------------
* ONE collection for both corpora (ATT&CK techniques + CVEs), not two.
  Queries routinely need to cross document types (e.g. "which techniques
  are associated with CVE-2021-44228-style deserialization bugs?"), and a
  single collection lets one query touch both with a payload filter rather
  than fanning out to N collections and merging client-side. `document_type`
  and `source` are indexed payload fields so type-scoped queries stay fast.
* Two NAMED VECTORS per point ("dense", "sparse") rather than two
  collections, so a single upsert keeps both representations of a chunk in
  sync by construction -- there's no way for the dense and sparse indexes to
  drift apart for a given chunk.
* Deterministic point IDs (UUID5 of chunk_id) make ingestion idempotent:
  re-running ingestion on an unchanged document upserts the same point,
  it doesn't duplicate it.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Literal

import numpy as np
from qdrant_client import QdrantClient, models

from ..ingestion.chunker import Chunk
from .embeddings import EmbeddingProvider
from .sparse import Bm25SparseEncoder

DENSE = "dense"
SPARSE = "sparse"


def chunk_point_id(chunk_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))


@dataclass
class RetrievedChunk:
    chunk_id: str
    score: float
    text: str
    title: str
    section: str
    source: str
    document_type: str
    url: str
    parent_doc_id: str
    metadata: dict[str, Any]
    rank_dense: int | None = None
    rank_sparse: int | None = None


class QdrantStore:
    def __init__(
        self,
        qdrant_path: str,
        collection_name: str,
        embedding_provider: EmbeddingProvider,
        sparse_encoder: Bm25SparseEncoder,
        client: QdrantClient | None = None,
    ):
        self.client = client if client is not None else QdrantClient(path=qdrant_path)
        self.collection_name = collection_name
        self.embedder = embedding_provider
        self.sparse = sparse_encoder

    def create_collection(self, recreate: bool = False) -> None:
        exists = self.client.collection_exists(self.collection_name)
        if exists and recreate:
            self.client.delete_collection(self.collection_name)
            exists = False
        if not exists:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config={
                    DENSE: models.VectorParams(size=self.embedder.dim, distance=models.Distance.COSINE)
                },
                sparse_vectors_config={SPARSE: models.SparseVectorParams()},
            )
            for field_name, schema in [
                ("source", models.PayloadSchemaType.KEYWORD),
                ("document_type", models.PayloadSchemaType.KEYWORD),
                ("technique_id", models.PayloadSchemaType.KEYWORD),
                ("cve_id", models.PayloadSchemaType.KEYWORD),
                ("cwe_ids", models.PayloadSchemaType.KEYWORD),
                ("tactics", models.PayloadSchemaType.KEYWORD),
                ("platforms", models.PayloadSchemaType.KEYWORD),
                ("parent_doc_id", models.PayloadSchemaType.KEYWORD),
            ]:
                self.client.create_payload_index(self.collection_name, field_name=field_name, field_schema=schema)

    def upsert_chunks(self, chunks: list[Chunk], batch_size: int = 64) -> None:
        texts = [c.text for c in chunks]
        dense_vecs = self.embedder.embed(texts)

        for start in range(0, len(chunks), batch_size):
            batch = chunks[start : start + batch_size]
            batch_dense = dense_vecs[start : start + batch_size]
            points = []
            for chunk, dvec in zip(batch, batch_dense):
                s_idx, s_val = self.sparse.encode_document(chunk.text)
                payload = {
                    "chunk_id": chunk.chunk_id,
                    "parent_doc_id": chunk.parent_doc_id,
                    "source": chunk.source,
                    "document_type": chunk.document_type,
                    "title": chunk.title,
                    "section": chunk.section,
                    "text": chunk.text,
                    "url": chunk.url,
                    "chunk_index": chunk.chunk_index,
                    **{k: v for k, v in chunk.metadata.items() if v not in (None, [], "")},
                }
                points.append(
                    models.PointStruct(
                        id=chunk_point_id(chunk.chunk_id),
                        vector={
                            DENSE: dvec.tolist(),
                            SPARSE: models.SparseVector(indices=s_idx, values=s_val),
                        },
                        payload=payload,
                    )
                )
            self.client.upsert(self.collection_name, points=points)

    def _to_retrieved(self, point, rank: int | None = None, rank_field: str | None = None) -> RetrievedChunk:
        p = point.payload
        rc = RetrievedChunk(
            chunk_id=p["chunk_id"],
            score=point.score,
            text=p["text"],
            title=p["title"],
            section=p["section"],
            source=p["source"],
            document_type=p["document_type"],
            url=p.get("url", ""),
            parent_doc_id=p["parent_doc_id"],
            metadata={k: v for k, v in p.items() if k not in {"text", "title", "section", "source", "document_type", "url", "parent_doc_id", "chunk_id"}},
        )
        if rank_field == "dense":
            rc.rank_dense = rank
        elif rank_field == "sparse":
            rc.rank_sparse = rank
        return rc

    def search_dense(self, query: str, top_k: int, query_filter: models.Filter | None = None) -> list[RetrievedChunk]:
        qvec = self.embedder.embed_query(query) if hasattr(self.embedder, "embed_query") else self.embedder.embed([query])[0]
        res = self.client.query_points(
            self.collection_name,
            query=qvec.tolist(),
            using=DENSE,
            limit=top_k,
            query_filter=query_filter,
        )
        return [self._to_retrieved(pt, rank=i, rank_field="dense") for i, pt in enumerate(res.points)]

    def search_sparse(self, query: str, top_k: int, query_filter: models.Filter | None = None) -> list[RetrievedChunk]:
        idx, val = self.sparse.encode_query(query)
        res = self.client.query_points(
            self.collection_name,
            query=models.SparseVector(indices=idx, values=val),
            using=SPARSE,
            limit=top_k,
            query_filter=query_filter,
        )
        return [self._to_retrieved(pt, rank=i, rank_field="sparse") for i, pt in enumerate(res.points)]

    def search_hybrid_rrf(
        self,
        query: str,
        top_k_dense: int,
        top_k_sparse: int,
        top_k_fused: int,
        rrf_k: int = 60,
        weights: list[float] | None = None,
        fusion_type: str = "rrf",
        query_filter: models.Filter | None = None,
    ) -> list[RetrievedChunk]:
        """Server-side hybrid retrieval: dense + sparse candidate sets fused
        with Reciprocal Rank Fusion (or DBSF) inside Qdrant itself (Prefetch + FusionQuery).

        Supports explicit rrf_k constant, prefetch weights [dense_weight, sparse_weight],
        and alternative fusion strategies (e.g. DBSF) for architecture experiments.
        """
        qvec = self.embedder.embed_query(query) if hasattr(self.embedder, "embed_query") else self.embedder.embed([query])[0]
        s_idx, s_val = self.sparse.encode_query(query)

        if fusion_type == "dbsf":
            fusion_query = models.FusionQuery(fusion=models.Fusion.DBSF)
        elif fusion_type == "rrf":
            fusion_query = models.RrfQuery(rrf=models.Rrf(k=rrf_k, weights=weights))
        else:
            raise ValueError(f"Unknown fusion_type: {fusion_type}")

        res = self.client.query_points(
            self.collection_name,
            prefetch=[
                models.Prefetch(query=qvec.tolist(), using=DENSE, limit=top_k_dense, filter=query_filter),
                models.Prefetch(
                    query=models.SparseVector(indices=s_idx, values=s_val),
                    using=SPARSE,
                    limit=top_k_sparse,
                    filter=query_filter,
                ),
            ],
            query=fusion_query,
            limit=top_k_fused,
            query_filter=query_filter,
        )
        return [self._to_retrieved(pt, rank=i) for i, pt in enumerate(res.points)]

    def count(self) -> int:
        return self.client.count(self.collection_name).count
