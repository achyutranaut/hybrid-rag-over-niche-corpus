"""
FastAPI backend. Endpoints match ARCHITECTURE.md section 18 and frontend requirements.

Run: uvicorn src.api.main:app --reload --port 8000
(requires ingestion to have been run first: python scripts/ingest.py)
"""
from __future__ import annotations

import json
import os
import re
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from qdrant_client import models

from ..config import Config
from ..ingestion.pipeline import load_store
from ..rag_pipeline import RagPipeline, RetrievalStrategy, build_filter
from ..retrieval.query_understanding import analyze_query

app = FastAPI(
    title="Hybrid RAG — Cybersecurity Corpus",
    description="Production-grade API and research console for cybersecurity RAG",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_cfg = Config.from_env()
_pipeline: RagPipeline | None = None
_base_dir = Path(__file__).resolve().parent.parent.parent
_experiments_dir = _base_dir / "experiments"
_eval_data_dir = _base_dir / "eval_data"


class QueryRequest(BaseModel):
    query: str
    strategy: RetrievalStrategy = "hybrid_rerank"
    document_type: str | None = None
    source: str | None = None
    router: bool = False
    enable_acronym_expansion: bool = True
    auto_filter_identifiers: bool = False
    floor_mode: str | None = None
    floor_threshold: float | None = None
    top_k_rerank: int | None = None


class InspectRequest(BaseModel):
    query: str
    top_k: int = 10
    top_k_rerank: int = 5
    document_type: str | None = None
    source: str | None = None
    enable_acronym_expansion: bool = True


class CompareRequest(BaseModel):
    query: str
    strategies: list[RetrievalStrategy] = ["dense", "sparse", "hybrid", "hybrid_rerank"]
    document_type: str | None = None
    source: str | None = None
    enable_acronym_expansion: bool = True


class QueryUnderstandingRequest(BaseModel):
    query: str
    enable_acronym_expansion: bool = True
    router: bool = True


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


@app.get("/api/v1/overview")
def overview():
    pipeline = _require_pipeline()
    points = pipeline.store.count()
    return {
        "title": "Hybrid RAG Over a Niche Cybersecurity Corpus",
        "research_question": "For which classes of cybersecurity query does dense, sparse, or hybrid retrieval perform best — and how much do reranking, query understanding, and metadata filtering change that answer?",
        "corpus": {
            "total_chunks": points,
            "total_documents": 717,
            "mitre_attack_techniques": 697,
            "cve_records": 20,
            "sha256": "cdcc7258098ffa61",
            "collection_name": pipeline.cfg.collection_name,
            "storage_mode": "embedded_qdrant",
        },
        "tiers": {
            "tier_a": {
                "name": "Local Stand-in Stack",
                "dense_embedder": "TF-IDF + TruncatedSVD (LSA 128-d, fit on corpus)",
                "sparse_engine": "BM25 (rank-bm25, alphanumeric word regex)",
                "fusion": "Server-side Qdrant RRF (k=60, w=[2.0, 1.0])",
                "reranker": "Lexical Overlap + Identifier Boost",
                "generator": "ExtractiveLocalProvider (extractive sentence assembly)",
                "active": True,
            },
            "tier_b": {
                "name": "Target Neural Stack",
                "dense_embedder": "BAAI/bge-small-en-v1.5 (384-d, instruction prefix)",
                "sparse_engine": "BM25 (rank-bm25)",
                "fusion": "Server-side Qdrant RRF (k=60, w=[2.0, 1.0])",
                "reranker": "ms-marco-MiniLM-L-6-v2 (Cross-Encoder)",
                "generator": "Anthropic Claude / Local LLM",
                "active": False,
            },
        },
        "status": {
            "backend": "online",
            "collection_ready": points > 0,
            "experiments_completed": True,
            "latest_evaluation": "Held-Out TEST Split (n=14 in-corpus, n=2 Class-8, n=20 expanded OOD)",
        },
    }


@app.post("/api/v1/query")
def query(req: QueryRequest):
    pipeline = _require_pipeline()
    resp = pipeline.query(
        req.query,
        strategy=req.strategy,
        document_type=req.document_type,
        source=req.source,
        router=req.router,
        enable_acronym_expansion=req.enable_acronym_expansion,
        auto_filter_identifiers=req.auto_filter_identifiers,
        floor_mode=req.floor_mode,
        floor_threshold=req.floor_threshold,
        top_k_rerank=req.top_k_rerank,
    )
    data = asdict(resp)
    # Ensure each citation dict exposes doc_id and score cleanly
    score_map = {}
    if hasattr(resp, "retrieval") and isinstance(resp.retrieval, dict):
        cand_ids = resp.retrieval.get("reranked_candidate_ids") or resp.retrieval.get("retrieved_candidate_ids") or []
        cand_scores = resp.retrieval.get("reranked_scores") or resp.retrieval.get("retrieved_scores") or []
        score_map = dict(zip(cand_ids, cand_scores))
    for c in data.get("citations", []):
        cid = c.get("chunk_id", "")
        if not c.get("doc_id"):
            c["doc_id"] = cid.split("::chunk")[0].split("#")[0] if cid else ""
        if c.get("score") is None:
            c["score"] = score_map.get(cid, 0.0)
    return data



@app.post("/api/v1/inspect")
def inspect_query(req: InspectRequest):
    pipeline = _require_pipeline()
    t_start = time.time()

    qa = analyze_query(req.query, enable_acronym_expansion=req.enable_acronym_expansion)
    query_filter = build_filter(req.document_type, req.source)

    # 1. Dense Candidates
    t0 = time.time()
    dense_pts = pipeline.store.search_dense(qa.expanded_query, req.top_k, query_filter)
    dense_latency = round((time.time() - t0) * 1000, 1)

    # 2. Sparse Candidates
    t0 = time.time()
    sparse_pts = pipeline.store.search_sparse(qa.expanded_query, req.top_k, query_filter)
    sparse_latency = round((time.time() - t0) * 1000, 1)

    # 3. Hybrid RRF Candidates
    t0 = time.time()
    hybrid_pts = pipeline.store.search_hybrid_rrf(
        qa.expanded_query,
        top_k_dense=req.top_k,
        top_k_sparse=req.top_k,
        top_k_fused=req.top_k,
        query_filter=query_filter,
    )
    hybrid_latency = round((time.time() - t0) * 1000, 1)

    # 4. Reranked Candidates (from top hybrid candidates)
    t0 = time.time()
    reranked_pts = pipeline.reranker.rerank(req.query, hybrid_pts, req.top_k_rerank)
    rerank_latency = round((time.time() - t0) * 1000, 1)

    total_latency = round((time.time() - t_start) * 1000, 1)

    def serialize_chunk(c, rank: int, stage: str, reranker_score: float | None = None):
        return {
            "chunk_id": c.chunk_id,
            "parent_doc_id": c.parent_doc_id,
            "source": c.source,
            "document_type": c.document_type,
            "title": c.title,
            "section": c.section,
            "text": c.text,
            "score": round(float(c.score), 6),
            "rank": rank,
            "retrieval_method": stage,
            "reranker_score": reranker_score,
            "url": c.url,
            "metadata": c.metadata,
        }

    dense_candidates = [serialize_chunk(c, i + 1, "dense") for i, c in enumerate(dense_pts)]
    sparse_candidates = [serialize_chunk(c, i + 1, "sparse") for i, c in enumerate(sparse_pts)]
    hybrid_candidates = [serialize_chunk(c, i + 1, "hybrid") for i, c in enumerate(hybrid_pts)]
    reranked_candidates = [
        serialize_chunk(c, i + 1, "hybrid_rerank", reranker_score=round(float(c.score), 6))
        for i, c in enumerate(reranked_pts)
    ]

    # Build cross-stage rank tracking to make rank shifts visually understandable
    all_chunk_ids = set()
    for pool in (dense_pts, sparse_pts, hybrid_pts, reranked_pts):
        for c in pool:
            all_chunk_ids.add(c.chunk_id)

    rank_tracker = []
    dense_map = {c.chunk_id: i + 1 for i, c in enumerate(dense_pts)}
    sparse_map = {c.chunk_id: i + 1 for i, c in enumerate(sparse_pts)}
    hybrid_map = {c.chunk_id: i + 1 for i, c in enumerate(hybrid_pts)}
    reranked_map = {c.chunk_id: i + 1 for i, c in enumerate(reranked_pts)}
    meta_map = {
        c.chunk_id: (c.parent_doc_id, c.title, c.source, c.document_type)
        for pool in (dense_pts, sparse_pts, hybrid_pts, reranked_pts)
        for c in pool
    }

    for cid in all_chunk_ids:
        doc_id, title, source, doc_type = meta_map[cid]
        rank_tracker.append({
            "chunk_id": cid,
            "parent_doc_id": doc_id,
            "title": title,
            "source": source,
            "document_type": doc_type,
            "dense_rank": dense_map.get(cid),
            "sparse_rank": sparse_map.get(cid),
            "hybrid_rank": hybrid_map.get(cid),
            "reranked_rank": reranked_map.get(cid),
        })

    # Sort tracker primarily by reranked rank, then hybrid, sparse, dense
    rank_tracker.sort(
        key=lambda x: (
            x["reranked_rank"] if x["reranked_rank"] is not None else 999,
            x["hybrid_rank"] if x["hybrid_rank"] is not None else 999,
            x["sparse_rank"] if x["sparse_rank"] is not None else 999,
            x["dense_rank"] if x["dense_rank"] is not None else 999,
        )
    )

    router_decision = "sparse" if (qa.detected_cves or qa.detected_technique_ids or qa.detected_cwes) else "hybrid"

    return {
        "query": req.query,
        "query_understanding": {
            "raw_query": qa.raw_query,
            "expanded_query": qa.expanded_query,
            "detected_cves": qa.detected_cves,
            "detected_technique_ids": qa.detected_technique_ids,
            "detected_cwes": qa.detected_cwes,
            "expansion_terms": qa.expansion_terms,
            "router_decision": router_decision,
            "filters_applied": {
                "document_type": req.document_type,
                "source": req.source,
            },
        },
        "dense_candidates": dense_candidates,
        "sparse_candidates": sparse_candidates,
        "hybrid_candidates": hybrid_candidates,
        "reranked_candidates": reranked_candidates,
        "rank_tracker": rank_tracker,
        "latencies_ms": {
            "dense": dense_latency,
            "sparse": sparse_latency,
            "hybrid": hybrid_latency,
            "rerank": rerank_latency,
            "total": total_latency,
        },
    }


@app.post("/api/v1/compare")
def compare_strategies(req: CompareRequest):
    pipeline = _require_pipeline()
    results = {}
    for st in req.strategies:
        t0 = time.time()
        resp = pipeline.query(
            req.query,
            strategy=st,
            document_type=req.document_type,
            source=req.source,
            enable_acronym_expansion=req.enable_acronym_expansion,
        )
        elapsed = round((time.time() - t0) * 1000, 1)
        results[st] = {
            **asdict(resp),
            "execution_ms": elapsed,
        }

    qa = analyze_query(req.query, enable_acronym_expansion=req.enable_acronym_expansion)
    return {
        "query": req.query,
        "query_understanding": {
            "detected_cves": qa.detected_cves,
            "detected_technique_ids": qa.detected_technique_ids,
            "detected_cwes": qa.detected_cwes,
            "expansion_terms": qa.expansion_terms,
        },
        "comparisons": results,
    }


@app.post("/api/v1/query-understanding")
def query_understanding(req: QueryUnderstandingRequest):
    qa = analyze_query(req.query, enable_acronym_expansion=req.enable_acronym_expansion)
    has_id = bool(qa.detected_cves or qa.detected_technique_ids or qa.detected_cwes)
    routed_strategy = "sparse" if (req.router and has_id) else "hybrid"

    # Check if identifier auto-filtering would apply
    suggested_source = None
    if qa.detected_cves:
        suggested_source = "cve_nvd"
    elif qa.detected_technique_ids:
        suggested_source = "mitre_attack"

    return {
        "raw_query": qa.raw_query,
        "expanded_query": qa.expanded_query,
        "detected_cves": qa.detected_cves,
        "detected_technique_ids": qa.detected_technique_ids,
        "detected_cwes": qa.detected_cwes,
        "expansion_terms": qa.expansion_terms,
        "has_exact_identifier": has_id,
        "router_decision": {
            "router_enabled": req.router,
            "selected_strategy": routed_strategy,
            "rationale": "Exact identifier detected -> routes to sparse to avoid subword tokenization splits" if has_id else "No identifier -> routes to hybrid RRF for broad semantic & lexical coverage",
        },
        "metadata_filters": {
            "auto_filter_active": False,  # Disabled by research finding (negative result)
            "suggested_source": suggested_source,
            "research_note": "ARCHITECTURE.md §22 confirms auto-filtering is harmful (DEV Recall@5 -0.0446, p=0.0253) due to false-positive regex collisions.",
        },
    }


@app.get("/api/v1/evaluations/summary")
def evaluations_summary():
    """Returns headline benchmark metrics across DEV vs TEST for all major experiment runs."""
    summary_data: dict[str, Any] = {
        "metadata": {
            "corpus_sha256": "cdcc7258098ffa61",
            "dev_queries": 64,
            "test_queries": 16,
            "dev_in_corpus": 56,
            "test_in_corpus": 14,
            "ood_dev_queries": 50,
            "ood_test_queries": 20,
            "platform": "macOS Darwin 24.6.0, Python 3.13.5, PyTorch CPU, Qdrant Local",
        },
        "runs": {},
    }

    # 1. B1 Run
    b1_dev_path = _experiments_dir / "b1_results_dev.json"
    b1_test_path = _experiments_dir / "b1_results_test.json"
    if b1_dev_path.exists() and b1_test_path.exists():
        with open(b1_dev_path) as f:
            b1_dev = json.load(f)
        with open(b1_test_path) as f:
            b1_test = json.load(f)
        summary_data["runs"]["b1_embedders"] = {
            "title": "B1: Dense Embedder & Hybrid Baseline",
            "description": "Comparison of Dense LSA, Dense BGE (384-d), Sparse BM25, Hybrid LSA, and Hybrid BGE across DEV and TEST splits.",
            "dev": b1_dev.get("overall_summary", {}),
            "test": b1_test.get("overall_summary", {}),
            "dev_per_class": b1_dev.get("per_class_summary", {}),
            "test_per_class": b1_test.get("per_class_summary", {}),
            "paired_stats_dev": b1_dev.get("paired_statistics", {}),
            "paired_stats_test": b1_test.get("paired_statistics", {}),
        }

    # 2. B2 Run
    b2_dev_path = _experiments_dir / "b2_results_dev.json"
    b2_test_path = _experiments_dir / "b2_results_test.json"
    if b2_dev_path.exists() and b2_test_path.exists():
        with open(b2_dev_path) as f:
            b2_dev = json.load(f)
        with open(b2_test_path) as f:
            b2_test = json.load(f)
        summary_data["runs"]["b2_cross_encoder"] = {
            "title": "B2: Cross-Encoder & Relevance Floor Ablations",
            "description": "Evaluation of ms-marco-MiniLM-L-6-v2 Cross-Encoder reranker, absolute logit floors, and relative floors against first-stage hybrid.",
            "dev": b2_dev.get("configurations_summary", {}),
            "test": b2_test.get("configurations_summary", {}),
            "dev_per_class": b2_dev.get("per_class_summary", {}),
            "test_per_class": b2_test.get("per_class_summary", {}),
            "paired_stats_dev": b2_dev.get("paired_statistics_vs_first_stage", {}),
            "paired_stats_test": b2_test.get("paired_statistics_vs_first_stage", {}),
            "expanded_ood_dev": b2_dev.get("expanded_ood_calibration", {}),
            "expanded_ood_test": b2_test.get("expanded_ood_calibration", {}),
        }

    # 3. E2 Run
    e2_path = _experiments_dir / "e2_results.json"
    if e2_path.exists():
        with open(e2_path) as f:
            e2 = json.load(f)
        summary_data["runs"]["e2_fusion"] = {
            "title": "E2: RRF Fusion Parameter Sweeps",
            "description": "Ablation of RRF k-values and dense/sparse weights on hybrid retrieval performance.",
            "summary": e2.get("summary", {}),
            "per_class": e2.get("per_class_summary", {}),
        }

    # 4. E3 Run
    e3_path = _experiments_dir / "e3_results.json"
    if e3_path.exists():
        with open(e3_path) as f:
            e3 = json.load(f)
        summary_data["runs"]["e3_floor"] = {
            "title": "E3: Relevance Floor Threshold Calibration",
            "description": "Analysis of relative vs absolute floors and precision/abstention tradeoffs.",
            "summary": e3.get("summary", {}),
        }

    # 5. E4 Run
    e4_dev_path = _experiments_dir / "e4_results_dev.json"
    e4_test_path = _experiments_dir / "e4_results_test.json"
    if e4_dev_path.exists() and e4_test_path.exists():
        with open(e4_dev_path) as f:
            e4_dev = json.load(f)
        with open(e4_test_path) as f:
            e4_test = json.load(f)
        summary_data["runs"]["e4_query_understanding"] = {
            "title": "E4: Query Understanding & Routing Interventions",
            "description": "Empirical impact of acronym expansion, identifier routing, and hard metadata auto-filtering.",
            "dev": e4_dev.get("summary", {}),
            "test": e4_test.get("summary", {}),
            "dev_per_class": e4_dev.get("per_class_summary", {}),
            "test_per_class": e4_test.get("per_class_summary", {}),
            "paired_stats_dev": e4_dev.get("paired_statistics_vs_baseline", {}),
            "paired_stats_test": e4_test.get("paired_statistics_vs_baseline", {}),
        }

    # 6. Statistical Audit
    stat_path = _experiments_dir / "statistical_test_results.json"
    if stat_path.exists():
        with open(stat_path) as f:
            stat = json.load(f)
        summary_data["statistical_audit"] = stat

    return summary_data


@app.get("/api/v1/evaluations/{run_id}")
def evaluation_detail(run_id: str):
    allowed_files = {
        "b1_dev": "b1_results_dev.json",
        "b1_test": "b1_results_test.json",
        "b2_dev": "b2_results_dev.json",
        "b2_test": "b2_results_test.json",
        "b3": "b3_results.json",
        "e2": "e2_results.json",
        "e3": "e3_results.json",
        "e4_dev": "e4_results_dev.json",
        "e4_test": "e4_results_test.json",
        "statistical_tests": "statistical_test_results.json",
        "statistical_audit": "statistical_audit_results.json",
    }
    if run_id not in allowed_files:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown evaluation run_id '{run_id}'. Available: {list(allowed_files.keys())}",
        )
    file_path = _experiments_dir / allowed_files[run_id]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Artifact {allowed_files[run_id]} not found on disk")
    with open(file_path) as f:
        return json.load(f)


@app.get("/api/v1/sample-queries")
def sample_queries():
    """Returns curated representative queries from eval_set.json for each of the 8 query classes."""
    samples = [
        {
            "class_id": 1,
            "category": "exact_identifier",
            "label": "Exact CVE Identifier",
            "query": "What is CVE-2021-44228 and what makes it dangerous?",
            "expected_doc_ids": ["cve:CVE-2021-44228"],
            "split": "dev",
            "notes": "Tests exact alphanumeric vulnerability lookup. Sparse BM25 strictly dominates; dense embeddings split the token.",
        },
        {
            "class_id": 1,
            "category": "exact_identifier",
            "label": "Exact ATT&CK Technique",
            "query": "Explain T1059.001 in detail",
            "expected_doc_ids": ["attack:T1059.001"],
            "split": "dev",
            "notes": "Tests subtechnique dotted identifier (PowerShell command execution).",
        },
        {
            "class_id": 2,
            "category": "semantic_paraphrase",
            "label": "Semantic Paraphrase",
            "query": "How do attackers execute scripts inside Office documents?",
            "expected_doc_ids": ["attack:T1204.002", "attack:T1059.005"],
            "split": "dev",
            "notes": "Pure conceptual phrasing without technique numbers. Tests semantic retrieval capability.",
        },
        {
            "class_id": 3,
            "category": "acronym_abbreviation",
            "label": "Acronym / Abbreviation",
            "query": "credential dumping via LSASS",
            "expected_doc_ids": ["attack:T1003.001"],
            "split": "dev",
            "notes": "Tests domain acronym expansion (LSASS -> OS Credential Dumping).",
        },
        {
            "class_id": 4,
            "category": "cross_corpus",
            "label": "Cross-Corpus Synthesis",
            "query": "Which ATT&CK technique corresponds to Log4Shell (CVE-2021-44228)?",
            "expected_doc_ids": ["cve:CVE-2021-44228", "attack:T1190"],
            "split": "dev",
            "notes": "Bridges CVE vulnerability record with MITRE ATT&CK technique (Exploit Public-Facing Application).",
        },
        {
            "class_id": 5,
            "category": "metadata_filtered",
            "label": "Metadata-Filtered",
            "query": "Persistence techniques on Linux systems",
            "expected_doc_ids": ["attack:T1543.002", "attack:T1053.003"],
            "split": "dev",
            "notes": "Queries scoped by platform/tactic metadata.",
        },
        {
            "class_id": 6,
            "category": "ambiguous",
            "label": "Ambiguous Security Phrase",
            "query": "Pass the hash",
            "expected_doc_ids": ["attack:T1550.002"],
            "split": "dev",
            "notes": "Short phrase with potential synonym conflicts. Hybrid RRF achieves optimal multi-sense coverage.",
        },
        {
            "class_id": 7,
            "category": "multi_hop",
            "label": "Multi-Hop / Hierarchical",
            "query": "Sub-techniques of OS Credential Dumping",
            "expected_doc_ids": ["attack:T1003", "attack:T1003.001", "attack:T1003.002"],
            "split": "dev",
            "notes": "Tests parent-child technique linkage in chunk structure.",
        },
        {
            "class_id": 8,
            "category": "out_of_corpus",
            "label": "Out-of-Corpus (Abstention Probe)",
            "query": "How does quantum cryptography resist Shor's algorithm?",
            "expected_doc_ids": [],
            "split": "dev",
            "notes": "Completely out-of-domain query. System should drop below evidence floor and abstain.",
        },
    ]
    return samples


@app.get("/api/v1/documents/{doc_id:path}")
def get_document(doc_id: str):
    pipeline = _require_pipeline()

    raw_id = (doc_id or "").strip()
    if not raw_id:
        raise HTTPException(status_code=400, detail="Document identifier cannot be empty")

    # 1. Determine base document identifier by stripping any chunk suffixes
    base_id = raw_id
    if "::chunk" in base_id:
        base_id = base_id.split("::chunk")[0]
    elif "#" in base_id:
        base_id = base_id.split("#")[0]

    # 2. Build ordered candidate parent_doc_id identifiers
    candidates: list[str] = [base_id]

    # Normalize prefix for common cybersecurity identifiers
    if base_id.upper().startswith("CVE-"):
        candidates.append(f"cve:{base_id.upper()}")
    elif re.match(r"^T\d+(\.\d+)?$", base_id, re.IGNORECASE):
        candidates.append(f"attack:{base_id.upper()}")

    # Include raw_id if different from base_id
    if raw_id not in candidates:
        candidates.append(raw_id)

    # 3. Query Qdrant for matching parent_doc_id across candidates
    points = []
    resolved_parent_id = None
    for cand in candidates:
        res = pipeline.store.client.scroll(
            pipeline.store.collection_name,
            scroll_filter=models.Filter(
                must=[models.FieldCondition(key="parent_doc_id", match=models.MatchValue(value=cand))]
            ),
            limit=100,
        )
        pts, _ = res
        if pts:
            points = pts
            resolved_parent_id = cand
            break

    # 4. Fallback: query by exact chunk_id if direct parent lookup yielded nothing
    if not points:
        res = pipeline.store.client.scroll(
            pipeline.store.collection_name,
            scroll_filter=models.Filter(
                must=[models.FieldCondition(key="chunk_id", match=models.MatchValue(value=raw_id))]
            ),
            limit=1,
        )
        pts, _ = res
        if pts:
            resolved_parent_id = pts[0].payload.get("parent_doc_id")
            if resolved_parent_id:
                all_res = pipeline.store.client.scroll(
                    pipeline.store.collection_name,
                    scroll_filter=models.Filter(
                        must=[models.FieldCondition(key="parent_doc_id", match=models.MatchValue(value=resolved_parent_id))]
                    ),
                    limit=100,
                )
                points, _ = all_res
            else:
                points = pts

    if not points:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")

    chunks = sorted(points, key=lambda p: p.payload.get("chunk_index", 0))
    first = chunks[0].payload
    canonical_doc_id = first.get("parent_doc_id") or resolved_parent_id or base_id

    return {
        "doc_id": canonical_doc_id,
        "title": first.get("title"),
        "source": first.get("source"),
        "document_type": first.get("document_type"),
        "url": first.get("url"),
        "total_chunks": len(chunks),
        "chunks": [
            {
                "chunk_id": c.payload["chunk_id"],
                "chunk_index": c.payload.get("chunk_index", 0),
                "section": c.payload.get("section", ""),
                "text": c.payload["text"],
                "metadata": {
                    k: v
                    for k, v in c.payload.items()
                    if k not in {"text", "title", "section", "source", "document_type", "url", "parent_doc_id", "chunk_id"}
                },
            }
            for c in chunks
        ],
    }


@app.get("/api/v1/metrics")
def metrics():
    pipeline = _require_pipeline()
    return {
        "collection_points": pipeline.store.count(),
        "collection_name": pipeline.cfg.collection_name,
        "storage_path": pipeline.cfg.qdrant_path,
        "dense_dim": pipeline.store.embedder.dim,
    }


# Mount production frontend static files if built
_frontend_dist = _base_dir / "frontend" / "dist"
if _frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")

