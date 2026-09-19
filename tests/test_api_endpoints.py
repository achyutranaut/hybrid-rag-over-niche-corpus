import pytest
from fastapi.testclient import TestClient
from src.api.main import app, _startup

@pytest.fixture(scope="module")
def client():
    _startup()
    return TestClient(app)

def test_api_health(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["collection_points"] == 1162

def test_api_metrics(client):
    res = client.get("/api/v1/metrics")
    assert res.status_code == 200
    data = res.json()
    assert data["collection_points"] == 1162
    assert data["collection_name"] == "cyber_corpus_v1"

def test_api_query(client):
    res = client.post("/api/v1/query", json={
        "query": "What is CVE-2021-44228?",
        "strategy": "hybrid_rerank"
    })
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert data["grounded"] is True
    assert len(data["citations"]) > 0
    assert data["citations"][0]["title"].startswith("CVE-2021-44228")
    assert data["citations"][0]["doc_id"] == "cve:CVE-2021-44228"
    assert data["citations"][0]["chunk_id"] == "cve:CVE-2021-44228::chunk0"

def test_api_get_document(client):
    res = client.get("/api/v1/documents/cve:CVE-2021-44228")
    assert res.status_code == 200
    data = res.json()
    assert data["doc_id"] == "cve:CVE-2021-44228"
    assert len(data["chunks"]) > 0

def test_api_get_document_by_chunk_id(client):
    # Resolve by CVE chunk ID
    res = client.get("/api/v1/documents/cve:CVE-2021-44228::chunk0")
    assert res.status_code == 200
    data = res.json()
    assert data["doc_id"] == "cve:CVE-2021-44228"
    assert len(data["chunks"]) > 0

    # Resolve by ATT&CK chunk ID
    res = client.get("/api/v1/documents/attack:T1059.001::chunk0")
    assert res.status_code == 200
    data = res.json()
    assert data["doc_id"] == "attack:T1059.001"
    assert len(data["chunks"]) > 0

def test_api_get_document_by_raw_identifier(client):
    # Raw CVE without prefix
    res = client.get("/api/v1/documents/CVE-2021-44228")
    assert res.status_code == 200
    assert res.json()["doc_id"] == "cve:CVE-2021-44228"

    # Raw ATT&CK technique without prefix
    res = client.get("/api/v1/documents/T1059.001")
    assert res.status_code == 200
    assert res.json()["doc_id"] == "attack:T1059.001"

def test_api_get_document_multichunk_ordering(client):
    # Querying chunk 1 of a multi-chunk document retrieves the full parent document with sorted chunks
    res = client.get("/api/v1/documents/attack:T1059.009::chunk1")
    assert res.status_code == 200
    data = res.json()
    assert data["doc_id"] == "attack:T1059.009"
    assert data["total_chunks"] == 2
    assert [c["chunk_index"] for c in data["chunks"]] == [0, 1]

def test_api_get_nonexistent_document(client):
    res = client.get("/api/v1/documents/cve:CVE-9999-99999")
    assert res.status_code == 404

def test_api_get_invalid_document_id(client):
    res = client.get("/api/v1/documents/%20")
    assert res.status_code == 400

def test_api_overview(client):
    res = client.get("/api/v1/overview")
    assert res.status_code == 200
    data = res.json()
    assert "research_question" in data
    assert data["corpus"]["total_chunks"] == 1162
    assert data["corpus"]["mitre_attack_techniques"] == 697
    assert data["corpus"]["cve_records"] == 20
    assert "tier_a" in data["tiers"]
    assert "tier_b" in data["tiers"]

def test_api_sample_queries(client):
    res = client.get("/api/v1/sample-queries")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 8
    categories = {item["category"] for item in data}
    assert "exact_identifier" in categories
    assert "semantic_paraphrase" in categories
    assert "out_of_corpus" in categories

def test_api_query_understanding(client):
    res = client.post("/api/v1/query-understanding", json={
        "query": "What is CVE-2021-44228 and how does it relate to credential dumping?",
        "router": True
    })
    assert res.status_code == 200
    data = res.json()
    assert "CVE-2021-44228" in data["detected_cves"]
    assert len(data["expansion_terms"]) > 0
    assert data["router_decision"]["selected_strategy"] == "sparse"

def test_api_inspect(client):
    res = client.post("/api/v1/inspect", json={
        "query": "What is CVE-2021-44228?",
        "top_k": 5,
        "top_k_rerank": 3
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data["dense_candidates"]) == 5
    assert len(data["sparse_candidates"]) == 5
    assert len(data["hybrid_candidates"]) == 5
    assert len(data["reranked_candidates"]) == 3
    assert len(data["rank_tracker"]) > 0
    assert "latencies_ms" in data

def test_api_compare(client):
    res = client.post("/api/v1/compare", json={
        "query": "What is CVE-2021-44228?",
        "strategies": ["dense", "sparse", "hybrid"]
    })
    assert res.status_code == 200
    data = res.json()
    assert "dense" in data["comparisons"]
    assert "sparse" in data["comparisons"]
    assert "hybrid" in data["comparisons"]

def test_api_evaluations_summary(client):
    res = client.get("/api/v1/evaluations/summary")
    assert res.status_code == 200
    data = res.json()
    assert "b1_embedders" in data["runs"]
    assert "b2_cross_encoder" in data["runs"]
    assert "dev" in data["runs"]["b1_embedders"]
    assert "test" in data["runs"]["b1_embedders"]

def test_api_evaluation_detail(client):
    res = client.get("/api/v1/evaluations/b1_test")
    assert res.status_code == 200
    data = res.json()
    assert "overall_summary" in data
    assert "sparse_bm25" in data["overall_summary"]

def test_api_serves_frontend(client):
    res = client.get("/")
    assert res.status_code == 200
    assert "text/html" in res.headers.get("content-type", "")


