# Stage B Corrective Development Summary (DEV Split Only)

**Date**: 2026-09-19  
**Status**: Corrective DEV Analysis Complete | TEST Split Fully Frozen  
**Corpus Version**: `sha256:cdcc7258098ffa61` (717 docs, 1,162 chunks)  
**Evaluation Set**: `eval_data/eval_set.json` (DEV: 64 queries: 56 in-corpus, 8 Class-8)  
**Expanded OOD Benchmark**: `eval_data/ood_eval_set.json` (DEV: 50 queries, TEST: 20 queries)  

---

## 1. What Was Already Completed Prior to This Phase

1. **Stage S1 Benchmark**: Established 80-query evaluation set (10 per class across 8 taxonomy classes), bound to the raw corpus hash.
2. **Parser ADP Fallback**: Fixed CVE parser to ingest metrics from `containers.adp`, elevating CVSS coverage from 40% to 100% and resolving Class 5 metadata evaluation.
3. **Qdrant Store Dual Indexing**: Maintained both baseline `cyber_corpus_v1` (256-d LSA) and parallel `cyber_corpus_bge_v1` (384-d BGE-small) collections.
4. **Historical Experiments**: Executed and preserved E2 (fusion design), E3 (reranker & floor), E4 (query understanding), B1 (transformer bi-encoder), B2 (cross-encoder), and B3 (generation & security probes).
5. **Forensic Research Audit**: Identified methodology issues in prior reporting (pooled DEV+TEST evaluation, uncalibrated abstention claims, lack of statistical inferential testing, and mock LLM generation).

---

## 2. What Was Corrected in This Phase

1. **Strict DEV/TEST Isolation**:
   - Modified `experiments/run_e4_query_understanding.py`, `experiments/run_b1_transformer.py`, and `experiments/run_b2_cross_encoder.py` to add `--split` argument (default: `'dev'`).
   - Outputs routed to `experiments/*_results_dev.json`.
   - **The TEST split (16 queries in `eval_set.json` and 20 queries in `ood_eval_set.json`) remained completely untouched and un-evaluated.**
2. **Protection of Historical Artifacts**:
   - Ensured `experiments/e2_results.json`, `experiments/e3_results.json`, `experiments/e4_results.json`, `experiments/b1_results.json`, `experiments/b2_results.json`, and `experiments/b3_results.json` were NOT overwritten.
3. **Reproducibility Metadata**:
   - Created `src/eval/reproducibility.py` capturing git commit SHA, corpus hash, eval dataset hash, random seeds, Python version, platform, hardware device, and timestamp UTC across all runs.
4. **Statistical Inferential Rigor**:
   - Attached paired per-query differences, 10,000-sample bootstrap 95% confidence intervals, Wilcoxon signed-rank tests ($p$-values), and Cohen's $d$ effect sizes on all DEV evaluations.
5. **Expanded Out-of-Distribution (OOD) Benchmark**:
   - Created `eval_data/ood_eval_set.json` (70 queries: 50 DEV, 20 TEST) spanning nonexistent CVEs, nonexistent ATT&CK IDs, realistic cybersecurity phrasing with fake IDs, real vulnerability terms with fake CVEs, unrelated technical topics, unrelated general knowledge, and out-of-corpus security questions. Validated 100% against JSONSchema.

---

## 3. DEV Empirical Results

### A. Experiment E4 (Query Understanding on DEV, n=56 In-Corpus)
*Artifact: `experiments/e4_results_dev.json`*

| Strategy / Arm | Recall@5 | MRR | nDCG@5 | Latency (ms) | Paired Recall@5 Δ (95% CI) | Paired MRR Δ (95% CI) |
|---|---|---|---|---|---|---|
| **hybrid_raw_no_expansion (Baseline)** | 0.6628 | 0.6705 | 0.5956 | 60.0 ms | - | - |
| **hybrid_acronym_expansion_only** | 0.6673 | 0.6725 | 0.6000 | 56.0 ms | +0.0045 `[+0.0000, +0.0134]` (p=0.3173) | +0.0020 `[-0.0004, +0.0064]` (p=0.6547) |
| **hybrid_identifier_autofilter_only** | 0.6182 | 0.6616 | 0.5623 | 67.5 ms | **-0.0446 `[-0.0804, -0.0089]` (p=0.0253)** | -0.0089 `[-0.0268, +0.0000]` (p=0.3173) |
| **hybrid_identifier_router_only** | 0.6628 | **0.6884** | **0.6015** | 63.3 ms | +0.0000 `[+0.0000, +0.0000]` (p=1.0000) | +0.0179 `[+0.0000, +0.0446]` (p=0.1573) |
| **sparse_no_expansion** | 0.5765 | 0.6262 | 0.5367 | 37.1 ms | - | - |
| **dense_no_expansion (LSA)** | 0.6152 | 0.6157 | 0.5139 | 17.9 ms | - | - |

**Key DEV Findings**:
- **Acronym Expansion**: Improved only 1 query out of 56 (`q-0011` in semantic_paraphrase). Difference is not statistically significant.
- **Identifier Auto-Filtering (Confirmed Negative Result)**: Degraded 5 queries across cross-corpus and multi-hop classes, causing statistically significant harm ($\Delta\text{Recall@5} = -0.0446, p = 0.0253$).
- **Identifier Router**: Preserved 100% of baseline recall (0 degradations) while improving MRR on exact identifiers (+0.0179).

---

### B. Stage B1 (Transformer Bi-Encoder on DEV, n=56 In-Corpus)
*Artifact: `experiments/b1_results_dev.json`*

| Retrieval Mode | In-Corpus Recall@5 | In-Corpus MRR | In-Corpus nDCG@5 | Latency (ms) | Paired Δ vs Baseline (95% CI) | Wilcoxon p-value |
|---|---|---|---|---|---|---|
| **dense_lsa (Baseline)** | 0.5705 | 0.5272 | 0.5656 | 17.0 ms | - | - |
| **dense_bge** | 0.5318 | 0.5613 | 0.6419 | 211.2 ms | $\Delta\text{R@5} = -0.0387\text{ }[-0.1429, +0.0655]$ | p = 0.5528 (Not Sig) |
| **dense_bge_noprefix** | 0.5289 | 0.5483 | 0.5918 | 93.8 ms | - | - |
| **sparse_bm25** | 0.5676 | 0.5468 | 0.5991 | 36.8 ms | - | - |
| **hybrid_lsa** | 0.6271 | 0.5938 | 0.6756 | 52.2 ms | - | - |
| **hybrid_bge** | 0.6390 | 0.5803 | 0.6900 | 50.5 ms | $\Delta\text{R@5} = +0.0119\text{ }[-0.0655, +0.0893]$ | p = 0.8871 (Not Sig) |
| **hybrid_bge_router** | **0.6390** | **0.6011** | **0.7034** | 53.3 ms | - | - |

**Key DEV Findings**:
- **No Universal Superiority**: Dense BGE is NOT statistically superior to Dense LSA on DEV ($p = 0.5528$ on Recall@5, $p = 0.5792$ on MRR).
- **Subword Tokenization Gap**: Sparse BM25 strictly dominates exact identifiers (MRR = 1.0000), while Dense BGE degrades exact identifiers down to MRR = 0.3648 due to WordPiece subword splitting.
- **Instruction Prefixing**: Prepending `"Represent this sentence for searching relevant passages: "` increased Dense BGE nDCG@5 from 0.5918 to 0.6419 and MRR from 0.5483 to 0.5613.

---

### C. Stage B2 (Cross-Encoder & Relevance Floor on DEV, n=56 In-Corpus)
*Artifact: `experiments/b2_results_dev.json`*

| Configuration | In-Corpus Recall@5 | In-Corpus MRR | In-Corpus nDCG@5 | Latency (ms) | Paired MRR Δ vs First-Stage (95% CI) | Wilcoxon p-value |
|---|---|---|---|---|---|---|
| **first_stage_hybrid (Candidate Pool)** | 0.6390 | 0.6601 | 0.7886 | 242.2 ms | - | - |
| **lexical_rerank_nofloor** | 0.6420 | 0.5778 | 0.6351 | 244.5 ms | -0.0823 `[-0.1766, +0.0121]` | p = 0.0752 (Degraded) |
| **ce_logits_nofloor** | **0.7125** | **0.7991** | **0.9268** | 1316.3 ms | **+0.1390 `[+0.0461, +0.2399]`** | **p = 0.0055 (Sig)** |
| **ce_logits_floor_abs0 (Selected Frozen)** | 0.6232 | **0.7440** | **0.8229** | 1316.3 ms | +0.0839 `[-0.0071, +0.1824]` | p = 0.0651 |
| **ce_logits_floor_abs1** | 0.5750 | 0.6964 | 0.7586 | 1316.3 ms | +0.0363 `[-0.0526, +0.1250]` | p = 0.3421 |
| **ce_sigmoid_floor_rel0.2 (Relative)** | 0.6768 | 0.7902 | 0.9011 | 1316.3 ms | +0.1301 `[+0.0384, +0.2289]` | p = 0.0084 |

---

### D. Expanded DEV OOD Calibration (n=50 Expanded Queries)
*Evaluated across 50 DEV queries from `eval_data/ood_eval_set.json`*

| Threshold Mode / Parameter | DEV Abstention Accuracy | Correct / Total | Failure Pattern |
|---|---|---|---|
| **Relative Floor (rel=0.2)** | **0.4800** | 24 / 50 | Fails on any query where cross-encoder assigns high relative score to top candidate. |
| **Absolute Logit Floor ($\ge 0.0$)** | **0.4800** | 24 / 50 | Correctly rejects general OOD topics; fails on security phrasing with fake IDs. |
| **Absolute Logit Floor ($\ge 0.5$)** | **0.4800** | 24 / 50 | Identical cutoff point on this distribution. |
| **Absolute Logit Floor ($\ge 1.0$)** | **0.5000** | 25 / 50 | Marginal +1 abstention, but harms in-corpus recall (0.6232 $\to$ 0.5750). |
| **Absolute Sigmoid ($\ge 0.5$)** | **0.4800** | 24 / 50 | Identical to logit 0.0 (monotonic sigmoid transformation). |

**Empirical Reality**:
On realistic cybersecurity queries containing security terminology alongside fictitious IDs (e.g. *"How do threat actors execute attack pattern T9999?"*, *"Heap-based buffer overflow in glibc malloc via CVE-2024-99881"*), cross-encoder semantic attention matches the familiar security vocabulary and outputs logits $> 2.0$, failing to abstain. Abstention accuracy is **~48–50% on realistic OOD inputs**.

---

## 4. Selected Frozen Configuration for Later TEST Evaluation

We explicitly freeze the following configuration. **No parameters may be tuned or adjusted on TEST.**

- **First-Stage Retrieval**: Hybrid Server-Side RRF on collection `cyber_corpus_bge_v1`
  - Dense Model: `BAAI/bge-small-en-v1.5` (384 dimensions) with query instruction prefix `"Represent this sentence for searching relevant passages: "`
  - Sparse Model: BM25 (`Bm25SparseEncoder`) with punctuation-preserving tokenization
  - Parameters: $k_{\text{dense}} = 25, k_{\text{sparse}} = 25, k_{\text{fused}} = 30, rrf\_k = 60, \text{weights} = [2.0, 1.0]$
  - Query Understanding: Identifier Router active (if exact CVE/ATT&CK ID detected, route directly to sparse BM25; else hybrid RRF); Hard auto-filtering disabled.
- **Second-Stage Reranking**: Cross-Encoder `cross-encoder/ms-marco-MiniLM-L-6-v2`
  - Input Candidate Depth: $k = 30$
  - Reranker Output Depth: $k = 8$
  - Scoring Scale: Raw logits
  - Execution Device: `cpu`
- **Relevance Floor**: Absolute Logit Threshold
  - `floor_mode`: `"absolute"`
  - `floor_threshold`: `0.0`
  - Filter: Drop all candidate chunks with cross-encoder logit score $< 0.0$.
  - Abstention Condition: If zero chunks remain above $0.0$, abstain completely (`grounded = False`, empty citations).

---

## 5. What Was Deliberately NOT Run (Preserving the Test Split)

1. **TEST Partition of `eval_data/eval_set.json` (16 Queries)**: Deliberately held out and NOT evaluated.
2. **TEST Partition of `eval_data/ood_eval_set.json` (20 Queries)**: Deliberately held out and NOT evaluated.
3. **No Threshold Tuning on TEST**: Zero threshold grid searches were executed on the test partition.
4. **No Model Selection on TEST**: The frozen model configuration was chosen exclusively based on DEV metrics and established IR literature.

---

## 6. Remaining Blockers

1. **Live External LLM Evaluation (Anthropic Claude / Local Llama)**:
   - *Status*: BLOCKED.
   - *Reason*: No `ANTHROPIC_API_KEY` exists in environment; local LLM weights cannot be downloaded due to network sandbox egress limits.
   - *Current Stance*: Honest labeling. Stage B3 is formally documented as using `ExtractiveLocalProvider` and `MockLLMProvider` only.
2. **Prompt-Injection In-the-Wild Testing**:
   - *Status*: BLOCKED pending un-sandboxed access or live LLM credentials.
   - *Current Stance*: The 5 deterministic probes test delimiter sanitization, not full semantic resilience.

---

## 7. Procedure for Later Held-Out TEST Evaluation

When the user gives explicit instruction to execute the final test evaluation, run:
```bash
# 1. Evaluate B1 on TEST
python3 experiments/run_b1_transformer.py --split test --out experiments/b1_results_test.json

# 2. Evaluate B2 on TEST using the frozen configuration
python3 experiments/run_b2_cross_encoder.py --split test --out experiments/b2_results_test.json

# 3. Evaluate E4 on TEST
python3 experiments/run_e4_query_understanding.py --split test --out experiments/e4_results_test.json

# 4. Run statistical validation comparing DEV vs TEST
python3 experiments/run_statistical_validation.py
```
This will produce the final, un-leaked evaluation of hypotheses H1–H8.
