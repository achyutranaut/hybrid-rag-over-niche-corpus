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

def test_api_get_document(client):
    res = client.get("/api/v1/documents/cve:CVE-2021-44228")
    assert res.status_code == 200
    data = res.json()
    assert data["doc_id"] == "cve:CVE-2021-44228"
    assert len(data["chunks"]) > 0

def test_api_get_nonexistent_document(client):
    res = client.get("/api/v1/documents/cve:CVE-9999-99999")
    assert res.status_code == 404
