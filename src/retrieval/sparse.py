"""
Sparse (lexical) retrieval.

Cybersecurity text is full of exact identifiers a dense embedding routinely
fails to distinguish: CVE-2021-44228 vs CVE-2021-44832, T1003 vs T1003.001,
CWE-79 vs CWE-89. A bi-encoder tends to place these close together because
they're semantically similar; BM25-style lexical matching treats them as
different tokens and ranks exact matches highest. That's why sparse
retrieval is a first-class, not incidental, part of this architecture.

Implementation: classic BM25 term weighting (Robertson/Sparck-Jones),
encoded as Qdrant native sparse vectors (index=token_id, value=weight) so
BM25-equivalent scoring happens inside Qdrant itself and can be fused
server-side with dense results via RRF (see retrieval/qdrant_store.py).

Tokenization deliberately keeps identifier punctuation intact
("CVE-2021-44228", "T1003.001") instead of sklearn's default word tokenizer,
which would split them into meaningless numeric fragments.
"""
from __future__ import annotations

import math
import pickle
import re
from collections import Counter
from pathlib import Path

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+(?:[-.][A-Za-z0-9]+)*")

_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
    "was", "were", "be", "this", "that", "as", "by", "with", "it", "its",
    "from", "at", "which", "may", "can", "these", "such",
}


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text) if t.lower() not in _STOPWORDS]


class Bm25SparseEncoder:
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.vocab: dict[str, int] = {}
        self.idf: dict[str, float] = {}
        self.avgdl: float = 0.0
        self._fitted = False

    def fit(self, texts: list[str]) -> None:
        doc_tokens = [tokenize(t) for t in texts]
        n_docs = len(doc_tokens)
        df: Counter = Counter()
        for toks in doc_tokens:
            df.update(set(toks))

        self.vocab = {term: i for i, term in enumerate(sorted(df.keys()))}
        # BM25 idf (Robertson-Walker), floored at a small positive value
        self.idf = {
            term: max(math.log((n_docs - freq + 0.5) / (freq + 0.5) + 1), 1e-4)
            for term, freq in df.items()
        }
        self.avgdl = sum(len(t) for t in doc_tokens) / max(n_docs, 1)
        self._fitted = True

    def encode_document(self, text: str) -> tuple[list[int], list[float]]:
        """Document-side sparse vector: BM25 term-saturation weight * idf."""
        tokens = tokenize(text)
        tf = Counter(tokens)
        dl = len(tokens)
        indices, values = [], []
        for term, freq in tf.items():
            if term not in self.vocab:
                continue
            idf = self.idf[term]
            denom = freq + self.k1 * (1 - self.b + self.b * dl / max(self.avgdl, 1e-6))
            weight = idf * (freq * (self.k1 + 1)) / max(denom, 1e-6)
            indices.append(self.vocab[term])
            values.append(float(weight))
        return indices, values

    def encode_query(self, text: str) -> tuple[list[int], list[float]]:
        """Query-side sparse vector: plain idf weight per unique query term.

        Dot product against the document-side BM25 vector reproduces the
        standard BM25 score (sum over shared terms of idf * saturation)."""
        tokens = set(tokenize(text))
        indices, values = [], []
        for term in tokens:
            if term not in self.vocab:
                continue
            indices.append(self.vocab[term])
            values.append(float(self.idf[term]))
        return indices, values

    def save(self, path: str) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(
                {"vocab": self.vocab, "idf": self.idf, "avgdl": self.avgdl, "k1": self.k1, "b": self.b}, f
            )

    def load(self, path: str) -> None:
        with open(path, "rb") as f:
            state = pickle.load(f)
        self.vocab = state["vocab"]
        self.idf = state["idf"]
        self.avgdl = state["avgdl"]
        self.k1 = state["k1"]
        self.b = state["b"]
        self._fitted = True
