"""
Context construction: turns a ranked list of reranked chunks into the
actual text block handed to the generator, plus a citation map.

Naively concatenating the top-K chunks in score order has three problems
this module addresses:
  1. Near-duplicate chunks (two overlapping windows of the same section)
     waste context budget without adding information -> deduplicated by
     parent_doc_id + section, keeping the highest-scored instance.
  2. Reading a set of chunks in pure relevance-score order is incoherent if
     two chunks come from the same document -> chunks are grouped by
     source document and ordered by chunk_index within that group, while
     groups themselves stay ordered by each group's best score.
  3. No token budget -> a query that legitimately retrieves 8 long chunks
     can blow past the model's usable context -> chunks are added in score
     order until max_context_tokens is hit, never mid-chunk truncated
     (a half-sentence chunk is worse than one fewer whole chunk).
"""
from __future__ import annotations

from dataclasses import dataclass

from .qdrant_store import RetrievedChunk
from .sparse import tokenize


@dataclass
class Citation:
    marker: int
    chunk_id: str
    title: str
    section: str
    url: str
    source: str
    doc_id: str = ""


@dataclass
class AssembledContext:
    context_text: str
    citations: list[Citation]
    used_chunks: list[RetrievedChunk]
    dropped_for_budget: int


def _approx_tokens(text: str) -> int:
    return int(len(tokenize(text)) * 1.3)


def assemble_context(chunks: list[RetrievedChunk], max_context_tokens: int = 1800) -> AssembledContext:
    # 1. Deduplicate: keep the highest-scored chunk per (parent_doc_id, section)
    best_per_key: dict[tuple[str, str], RetrievedChunk] = {}
    for c in chunks:
        key = (c.parent_doc_id, c.section)
        if key not in best_per_key or c.score > best_per_key[key].score:
            best_per_key[key] = c
    deduped = sorted(best_per_key.values(), key=lambda c: c.score, reverse=True)

    # 2. Group by parent document, ordered by each group's best score,
    #    chunks within a group ordered by chunk_index for readability.
    doc_order: list[str] = []
    groups: dict[str, list[RetrievedChunk]] = {}
    for c in deduped:
        if c.parent_doc_id not in groups:
            groups[c.parent_doc_id] = []
            doc_order.append(c.parent_doc_id)
        groups[c.parent_doc_id].append(c)
    for doc_id in groups:
        groups[doc_id].sort(key=lambda c: c.metadata.get("chunk_index", 0))

    # 3. Add whole chunks, grouped, until the token budget is hit.
    used: list[RetrievedChunk] = []
    citations: list[Citation] = []
    text_parts: list[str] = []
    budget = max_context_tokens
    dropped = 0
    marker = 1

    for doc_id in doc_order:
        for c in groups[doc_id]:
            t = _approx_tokens(c.text)
            if t > budget:
                dropped += 1
                continue
            citations.append(
                Citation(
                    marker=marker,
                    chunk_id=c.chunk_id,
                    doc_id=c.parent_doc_id,
                    title=c.title,
                    section=c.section,
                    url=c.url,
                    source=c.source,
                )
            )
            text_parts.append(f"[{marker}] {c.text}")
            used.append(c)
            budget -= t
            marker += 1

    return AssembledContext(
        context_text="\n\n".join(text_parts),
        citations=citations,
        used_chunks=used,
        dropped_for_budget=dropped,
    )
