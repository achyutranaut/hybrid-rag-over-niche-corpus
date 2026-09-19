"""
Structure-aware chunking.

Naive "every N tokens" chunking cuts a technique's Detection section in half
or splits a CVE description from its CVSS line. Since ingestion already
normalizes documents into a light markdown structure (see attack_parser /
cve_parser), we chunk on those boundaries (## sections, paragraphs) and only
fall back to a token-window split when a single section still exceeds the
target size.

Each chunk keeps a `parent_doc_id` and the document's full title/metadata, so
the context-construction stage can pull in sibling chunks or the parent
document when the generator needs more surrounding context than one chunk
provides (see src/retrieval/context.py).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .attack_parser import RawDocument

_WORD_RE = re.compile(r"\S+")


def _approx_tokens(text: str) -> int:
    # Cheap, dependency-free approximation (~0.75 tokens/word for English
    # technical text). Good enough for chunk-sizing decisions; swap for a
    # real tokenizer (tiktoken) if exact budgets matter later.
    return int(len(_WORD_RE.findall(text)) * 1.3)


@dataclass
class Chunk:
    chunk_id: str
    parent_doc_id: str
    source: str
    document_type: str
    title: str
    section: str
    text: str
    url: str
    chunk_index: int
    metadata: dict[str, Any] = field(default_factory=dict)


def _split_sections(text: str) -> list[tuple[str, str]]:
    """Split on markdown '## Heading' boundaries. Returns [(section_name, body)]."""
    sections: list[tuple[str, str]] = []
    current_name = "body"
    current_lines: list[str] = []
    for line in text.split("\n"):
        m = re.match(r"^##\s+(.*)", line)
        if m:
            if current_lines:
                sections.append((current_name, "\n".join(current_lines).strip()))
            current_name = m.group(1).strip()
            current_lines = []
        else:
            current_lines.append(line)
    if current_lines:
        sections.append((current_name, "\n".join(current_lines).strip()))
    return [(n, b) for n, b in sections if b.strip()]


def _window_split(text: str, target_tokens: int, overlap_tokens: int) -> list[str]:
    paragraphs = [p for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    buf: list[str] = []
    buf_tokens = 0
    for para in paragraphs:
        para_tokens = _approx_tokens(para)
        if buf and buf_tokens + para_tokens > target_tokens:
            chunks.append("\n\n".join(buf))
            # carry the tail of the previous chunk forward for overlap
            overlap_text = chunks[-1].split()[-overlap_tokens:]
            buf = [" ".join(overlap_text)] if overlap_text else []
            buf_tokens = _approx_tokens(" ".join(buf))
        buf.append(para)
        buf_tokens += para_tokens
    if buf:
        chunks.append("\n\n".join(buf))
    return chunks


def chunk_document(
    doc: RawDocument,
    target_tokens: int = 220,
    overlap_tokens: int = 40,
    min_tokens: int = 40,
) -> list[Chunk]:
    sections = _split_sections(doc.text)
    if not sections:
        sections = [("body", doc.text)]

    chunks: list[Chunk] = []
    idx = 0
    for section_name, body in sections:
        if _approx_tokens(body) <= target_tokens:
            pieces = [body]
        else:
            pieces = _window_split(body, target_tokens, overlap_tokens)

        for piece in pieces:
            if _approx_tokens(piece) < min_tokens and len(pieces) > 1:
                # merge tiny tail piece into the previous one instead of
                # indexing a near-empty, low-signal chunk
                if chunks and chunks[-1].parent_doc_id == doc.doc_id:
                    chunks[-1].text = chunks[-1].text + "\n\n" + piece
                    continue
            chunk_id = f"{doc.doc_id}::chunk{idx}"
            chunks.append(
                Chunk(
                    chunk_id=chunk_id,
                    parent_doc_id=doc.doc_id,
                    source=doc.source,
                    document_type=doc.document_type,
                    title=doc.title,
                    section=section_name,
                    text=f"{doc.title}\n\n{piece}" if section_name == "body" else f"{doc.title} — {section_name}\n\n{piece}",
                    url=doc.url,
                    chunk_index=idx,
                    metadata=dict(doc.metadata),
                )
            )
            idx += 1
    return chunks
