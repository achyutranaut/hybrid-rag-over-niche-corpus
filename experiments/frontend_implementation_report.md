# Frontend Implementation Report — Hybrid RAG Cybersecurity Research Console

**Execution Date:** 2026-09-19  
**Platform:** macOS Darwin 24.6.0 (ARM64), Python 3.13.5, Node v24.14.0, Vite 8.3.0, React 19, Tailwind CSS v3  
**Status:** Production-Ready, Fully Validated & Tested  
**Verification:** 29/29 Pytest tests passing, 2/2 Vitest frontend tests passing, Vite production build successful (0 type errors)

---

## 1. Executive Summary

This report documents the architectural design, implementation, and empirical validation of the production-quality frontend and research console for the **Hybrid RAG Over a Niche Cybersecurity Corpus** project.

The interface serves as a comprehensive, interactive visualization and analysis console over the existing embedded Qdrant vector store and frozen empirical evaluation benchmark artifacts. Per research requirements:
- **Zero modification** was made to research benchmarks, experiment weights, model parameters, or frozen TEST results.
- **Zero fabrication** of data: every displayed metric, candidate chunk, score, latency, and citation traces directly to either the live local Qdrant index (`cyber_corpus_v1`) or frozen pre-computed experiment JSON artifacts (`experiments/*.json`).
- The application delivers a unified desktop-first, responsive cybersecurity research console with a dark palette, high visual contrast, restrained information density, and deep technical inspection capabilities.

---

## 2. Frontend Architecture

### Technology Stack
- **Framework:** React 19 + TypeScript (Strict mode)
- **Bundler / Build System:** Vite 8.3.0 (with client-side proxy to FastAPI port 8000 during dev, compiling to static assets in `frontend/dist/` for production)
- **Styling & Design System:** Tailwind CSS v3 with a custom cybersecurity console palette (`#080b11` deep canvas, `#111726` surface cards, `#06b6d4` cyan accents for semantic vectors/playgrounds, `#10b981` emerald accents for grounded citations and cross-encoder gains, `#f59e0b` amber accents for OOD alerts and floor boundaries)
- **Icons:** `lucide-react` (semantic domain iconography: Shield, Terminal, Search, Sliders, Cpu, BarChart2, GitBranch, BookOpen)
- **Backend Serving:** FastAPI (`src/api/main.py`) serves the REST API under `/api/v1/...` and mounts `frontend/dist/` directly at `/` via `StaticFiles(html=True)`. Running `uvicorn src.api.main:app --port 8000` serves the entire full-stack application from a single process.

### Directory Structure
```
frontend/
├── dist/                          # Production compiled static bundle (HTML, JS, CSS)
├── src/
│   ├── api/
│   │   └── client.ts              # Fully typed HTTP client for /api/v1 endpoints
│   ├── components/
│   │   ├── Navbar.tsx             # Global header with status indicators & tab routing
│   │   ├── OverviewDashboard.tsx  # Section 1: Research dashboard & corpus stats
│   │   ├── RagPlayground.tsx      # Section 2: Interactive search & citation inspector
│   │   ├── RetrievalInspector.tsx # Section 3: 4-stage candidate funnel & rank tracker
│   │   ├── QueryUnderstandingView.tsx # Section 4: Regex IDs, acronyms & router logic
│   │   ├── EvaluationDashboard.tsx # Section 5: Frozen DEV vs Held-Out TEST benchmarks
│   │   ├── ArchitectureView.tsx   # Section 6: Interactive 9-stage pipeline flow
│   │   ├── MethodologyView.tsx    # Section 7: Research rationale, splits & limitations
│   │   └── DocumentModal.tsx      # Modal viewer for full raw document chunks
│   ├── types/
│   │   └── api.ts                 # Strict TypeScript schemas for all data models
│   ├── __tests__/
│   │   └── components.test.tsx    # Vitest + React Testing Library component tests
│   ├── App.tsx                    # Top-level state orchestration & document modal
│   ├── index.css                  # Custom cyber-table & scrollbar styles
│   └── main.tsx                   # React root mount
├── package.json                   # Dependencies, scripts (build, test, dev)
├── tsconfig.json & tsconfig.app.json # Strict TypeScript configuration
├── vite.config.ts                 # Vite bundler & vitest test runner configuration
└── tailwind.config.js             # Cybersecurity design tokens
```

---

## 3. Pages & Components Implemented

### 1. Overview / Research Dashboard (`OverviewDashboard.tsx`)
- **Project Title & Subtitle:** Displays repository title and research context.
- **Core Research Question (RQ):** Highlighted callout card displaying the frozen research question from ARCHITECTURE.md §1.
- **Corpus Statistics:** 6 restrained stat cards showing total chunks (1,162), ATT&CK techniques (697), CVE records (20), dual named vectors per point (2), benchmark evaluation size (80 dev/test + 70 OOD queries), and corpus hash (`sha256:cdcc7258098ffa61`).
- **Retrieval Tiers Side-by-Side:**
  - **Tier A (Local Stand-in Stack - Active):** TF-IDF + TruncatedSVD (128-d cosine), BM25, Server-side Qdrant RRF ($k=60$), Lexical Overlap Reranker with identifier boost, ExtractiveLocalProvider generator. 100% local, zero API keys.
  - **Tier B (Target Neural Stack):** BGE-small-en-v1.5 (384-d), BM25, Server-side RRF, Cross-Encoder `ms-marco-MiniLM-L-6-v2`, Anthropic Claude 3.5 Sonnet / Local LLM.
- **Status & Evaluation Summary:** Live status indicator, collection readiness, and held-out evaluation summary metrics.

### 2. RAG Playground (`RagPlayground.tsx`)
- **Query Input:** Styled cybersecurity command input with clear and submit triggers.
- **Sample Query Shortcuts:** Clickable benchmark query pills for all 8 query classes (Exact CVE, Exact Technique, Semantic Paraphrase, Acronym/Abbreviation, Cross-Corpus, Linux Metadata, Ambiguous, Multi-Hop, Out-of-Corpus).
- **Strategy Selector:** Instant switching between `hybrid_rerank` (default), `hybrid`, `sparse`, and `dense`.
- **Advanced Options Accordion:**
  - Query Router toggle (E4)
  - Acronym Expansion toggle (curated glossary)
  - Relevance floor mode (`relative`, `absolute`, `off`) and threshold slider
- **Latency Breakdown Strip:** Visual execution timings for Retrieval, Reranking, Generation, and Total Latency.
- **Answer Presentation:** Extractive grounded prose box with groundedness badge (`Grounded in Evidence` vs `Abstained`).
- **Citation & Evidence Cards:** Numbered citation badges (`[1]`, `[2]`), document IDs (clickable to full document view), section names, raw and reranker scores, and excerpt previews.
- **Cross-Strategy Parallel Comparison:** Dedicated "Compare All 4 Strategies" action executing dense, sparse, hybrid, and reranked pipelines simultaneously on the same query to inspect differences in answers, latencies, and candidate rankings side-by-side.

### 3. Retrieval Inspector (`RetrievalInspector.tsx`)
- **4-Column Parallel Funnel:**
  1. *Dense Candidates:* Top-k cosine similarity candidates from TF-IDF/SVD or BGE.
  2. *Sparse Candidates:* Top-k BM25 lexical candidates with identifier matching.
  3. *Hybrid Candidates:* Top-k server-side Reciprocal Rank Fusion ($k=60$) candidates.
  4. *Reranked Candidates:* Top candidates scored by lexical overlap or cross-encoder logits.
- **Candidate Chunks:** Every chunk card displays Document ID (clickable), source, section title, score, rank badge, retrieval method, reranker score (where applicable), and collapsible full chunk text.
- **Cross-Stage Rank Tracking Matrix:** Visual comparative table displaying candidate positions across all four stages, calculating rank shift ($\Delta = \text{Rank}_{\text{RRF}} - \text{Rank}_{\text{Rerank}}$) to clearly show which candidates climbed, fell, or were pruned.

### 4. Query Understanding (`QueryUnderstandingView.tsx`)
- **Deterministic ID Detection:** Real-time regex extraction of:
  - CVE IDs: `\bCVE-\d{4}-\d{4,7}\b`
  - ATT&CK Technique IDs: `\bT\d{4}(?:\.\d{3})?\b`
  - CWE IDs: `\bCWE-\d+\b`
- **Additive Acronym Expansion:** Expands terms from curated `ACRONYM_GLOSSARY` (e.g. credential dumping $\rightarrow$ LSASS, SAM, NTDS; RCE $\rightarrow$ remote code execution; LPE $\rightarrow$ local privilege escalation). Displays expanded query string passed to retrieval engines.
- **Router Decision Engine:** Visualizes branching logic: exact identifier detected $\rightarrow$ routes to Sparse-heavy; conceptual query $\rightarrow$ routes to Hybrid RRF.
- **Metadata Auto-Filter Audit:** Prominently presents the research negative result: why automatic hard filtering is disabled in the production pipeline due to collision-induced recall degradation (DEV Recall@5 $-0.0446, p=0.0253$).

### 5. Evaluation Dashboard (`EvaluationDashboard.tsx`)
- **DEV vs Held-Out TEST Switcher:** Seamless toggle between Development Split ($n=64$) and Held-Out Test Split ($n=16$).
- **Prominent Held-Out TEST Badge:** Clearly emphasizes that held-out TEST was evaluated strictly once without post-hoc modifications.
- **Experiment Selector:**
  - *B1:* Dense Embedder Comparison (Dense LSA vs Dense BGE vs Sparse BM25 vs Hybrid LSA vs Hybrid BGE vs Router).
  - *B2:* Cross-Encoder & Relevance Floor Ablations (First-Stage Hybrid vs Lexical Rerank vs Cross-Encoder with/without floor).
  - *E2:* RRF Fusion Parameter Sweeps ($k$-sweeps, dense/sparse weights).
  - *E3:* Relevance Floor Calibration (Relative vs Absolute logit floor).
  - *E4:* Query Understanding & Routing Interventions.
  - *Statistical Validation:* Paired Bootstrap 95% CIs, Wilcoxon signed-rank $p$-values, Cohen's $d$.
- **Class-by-Class Breakdown (Classes 1–8):** Full Recall@5 table highlighting empirical class winners (BM25 strictly dominating exact identifiers; Dense leading on abbreviations; Hybrid dominating ambiguous and multi-hop queries).
- **OOD Abstention Reality Callout:** Accurately visualizes the drop from 87.5% synthetic OOD abstention to 48.0% (DEV) / 50.0% (TEST) on the realistic 70-query OOD benchmark.

### 6. Architecture (`ArchitectureView.tsx`)
- **Interactive 9-Stage Stepper:**
  `Ingestion` $\rightarrow$ `Chunking` $\rightarrow$ `Dual-Vector Indexing` $\rightarrow$ `Parallel Retrieval` $\rightarrow$ `Server-side RRF` $\rightarrow$ `Reranking` $\rightarrow$ `Relevance Floor` $\rightarrow$ `Context Assembly` $\rightarrow$ `Generation`.
- **Stage Detail Drawer:** Code file references, technical implementation rationale, Python code snippets, and Tier A vs Tier B specifications.
- **Qdrant Dual-Vector Architecture Card:** Details on the single collection (`cyber_corpus_v1`), dual named vectors (`dense` and `sparse`), point UUID5 hashing, and payload index keys.
- **Mathematical Formulations:** Explicit formulas for Reciprocal Rank Fusion ($RRF(d) = \sum \frac{w_i}{k + r_i(d)}$) and Relative Score Floor cutoff ($s_{\text{top}} \times \tau$).

### 7. Research / Methodology (`MethodologyView.tsx`)
- **Research Question & Hypothesis:** Complete contextual explanation from ARCHITECTURE.md.
- **Corpus Specification:** 697 ATT&CK techniques + 20 real CVEs, chunking strategy, and SHA256 integrity hash.
- **DEV/TEST Split Discipline:** Detailed breakdown of in-corpus vs out-of-corpus query distribution.
- **Reproducibility Metadata:** Platform details, PyTorch CPU execution, Qdrant client version, and random seeds.
- **Documented Limitations:** Honest presentation of corpus scale limitations, single-threshold OOD calibration challenges, non-incremental LSA limitations, and extractive generation constraints.

### 8. Document Modal (`DocumentModal.tsx`)
- Triggered by clicking any Document ID or citation in the UI.
- Displays parent document title, source, document type, external source URL, and total chunk count.
- Renders full chunk contents, section names, and chunk indices fetched live from Qdrant via `GET /api/v1/documents/{doc_id}`.

---

## 4. API Endpoints Created & Extended

In `src/api/main.py`, the following clean, non-breaking analytical endpoints were implemented and verified:

| Endpoint | Method | Description |
|---|---|---|
| `/` | `GET` | Serves compiled static frontend (`frontend/dist/index.html`) |
| `/api/v1/health` | `GET` | Reports backend health and Qdrant collection point count |
| `/api/v1/overview` | `GET` | Corpus statistics, SHA256, Tier A vs Tier B specs, status |
| `/api/v1/query` | `POST` | Core RAG pipeline with optional router, floor, and expansion controls |
| `/api/v1/inspect` | `POST` | Runs Dense, Sparse, Hybrid, and Reranked retrieval for candidate funnel & rank tracker |
| `/api/v1/compare` | `POST` | Parallel execution of requested retrieval strategies for side-by-side comparison |
| `/api/v1/query-understanding` | `POST` | Regex ID detection, acronym expansion, and simulated router decision |
| `/api/v1/evaluations/summary` | `GET` | Aggregated headline metrics across DEV vs TEST for B1, B2, E2, E3, E4, and statistics |
| `/api/v1/evaluations/{run_id}` | `GET` | Returns full pre-computed JSON artifact for specific benchmark runs |
| `/api/v1/sample-queries` | `GET` | Curated sample queries across all 8 query classes from `eval_set.json` |
| `/api/v1/documents/{doc_id:path}` | `GET` | Retrieves full document metadata and sorted chunk text from Qdrant |
| `/api/v1/metrics` | `GET` | Qdrant collection point count and vector dimension |

---

## 5. Experiment Artifacts Consumed

Every metric and evaluation result displayed in the frontend is backed by an existing, frozen artifact on disk:
- `experiments/b1_results_dev.json` & `b1_results_test.json`: Baseline retrieval comparisons across dense, sparse, hybrid, and router modes.
- `experiments/b2_results_dev.json` & `b2_results_test.json`: Cross-encoder reranking, relevance floor modes, and realistic 70-query OOD calibration.
- `experiments/e2_results.json`: Server-side RRF fusion parameter sweeps ($k=20, 40, 60, 100$, dense/sparse weights).
- `experiments/e3_results.json`: Relevance floor threshold calibration.
- `experiments/e4_results_dev.json` & `e4_results_test.json`: Query understanding, acronym expansion, identifier routing, and hard metadata auto-filter ablation.
- `experiments/statistical_test_results.json` & `statistical_audit_results.json`: Paired bootstrap 95% confidence intervals, Wilcoxon signed-rank $p$-values, and Cohen's $d$.
- `experiments/final_test_summary.md`: Held-out evaluation conclusions and methodology narrative.
- `eval_data/eval_set.json` & `eval_data/ood_eval_set.json`: Query sets and category metadata.

---

## 6. Verification & Test Results

### 1. Backend Automated Tests
Executed:
```bash
python3 -m pytest tests/ -v
```
**Results:** **29 passed, 0 failed in 15.91s**
- `tests/test_api_endpoints.py`:
  - `test_api_health`: PASSED (collection_points == 1162)
  - `test_api_metrics`: PASSED
  - `test_api_query`: PASSED (Grounded == True, citations populated)
  - `test_api_get_document`: PASSED (cve:CVE-2021-44228 chunks retrieved)
  - `test_api_get_nonexistent_document`: PASSED (404 status handled cleanly)
  - `test_api_overview`: PASSED (Corpus counts, tiers, SHA256 verified)
  - `test_api_sample_queries`: PASSED (All 8 classes present)
  - `test_api_query_understanding`: PASSED (CVE detection & sparse routing verified)
  - `test_api_inspect`: PASSED (Dense, sparse, hybrid, reranked candidate pools verified)
  - `test_api_compare`: PASSED (Parallel strategy execution verified)
  - `test_api_evaluations_summary`: PASSED (B1, B2, DEV, TEST data structures verified)
  - `test_api_evaluation_detail`: PASSED (Full artifact JSON payload verified)
  - `test_api_serves_frontend`: PASSED (Root `/` serves production HTML)
- `tests/test_pipeline_components.py`: 16/16 component unit tests PASSED.

### 2. Frontend Automated Tests
Executed:
```bash
cd frontend && npm test
```
**Results:** **2 passed, 0 failed in 1.10s**
- `src/__tests__/components.test.tsx`:
  - `renders Navbar with title and navigation tabs`: PASSED
  - `renders OverviewDashboard with corpus statistics`: PASSED

### 3. Frontend Production Build
Executed:
```bash
cd frontend && npm run build
```
**Results:** **Success in 568ms, 0 errors**
- Generated assets:
  - `dist/index.html`: 0.63 kB (gzip: 0.40 kB)
  - `dist/assets/index-B5OzYGaV.css`: 24.91 kB (gzip: 5.38 kB)
  - `dist/assets/index-UOQ4wQCG.js`: 346.15 kB (gzip: 93.55 kB)

---

## 7. Known Limitations & Research Boundaries

1. **Local Extractive Generator:** Tier A uses sentence-overlap extraction. Answers are strictly grounded in retrieved evidence by construction (zero hallucination risk), but lack conversational synthesis.
2. **PyTorch CPU Latency:** Reranking with `ms-marco-MiniLM-L-6-v2` takes ~1,800 ms per query on CPU. Tier A lexical reranker takes ~48 ms.
3. **Corpus Scope:** The indexed corpus contains 1,162 chunks across 697 ATT&CK techniques and 20 real CVEs. Expanding to the full 250,000+ CVE database requires horizontal sharding and transformer bi-encoder indexing.
4. **Out-of-Domain Threshold Generalization:** Single-threshold evidence floors ($\tau = 0.0$) achieve 48–50% abstention on realistic OOD queries due to out-of-domain security jargon triggering positive cross-encoder logits.

---

## 8. Deployment & Running Instructions

To launch the full research console:

```bash
# 1. Ensure dependencies are installed
pip install -q -r requirements.txt

# 2. Start FastAPI (serves both REST API and compiled frontend at root)
uvicorn src.api.main:app --host 127.0.0.1 --port 8000
```

Then navigate to `http://localhost:8000/` in any modern web browser. For frontend development with hot-module reloading:
```bash
cd frontend
npm run dev
```
(Runs Vite dev server on port 5173 with automatic `/api` proxying to port 8000).
