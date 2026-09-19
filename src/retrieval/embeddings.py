"""
Dense embedding providers, behind a common interface.

WHY THIS FILE LOOKS THE WAY IT DOES
------------------------------------
The architecture (see ARCHITECTURE.md, section 6) specifies a swappable
embedding provider so the system isn't hard-coded to one vendor. This
implementation runs in a network-sandboxed environment with no access to
huggingface.co or an embeddings API, so the "local, no API keys" default
that ships and actually runs today is TfidfSvdEmbeddingProvider: TF-IDF
followed by truncated SVD (i.e. classic LSA/LSI). It is a real, textbook
dense-retrieval technique -- not a mock -- and it is honest about being a
weaker baseline than a transformer bi-encoder (bge-small, e5-base, etc.).

SentenceTransformerEmbeddingProvider below is the documented, drop-in swap:
change EMBEDDING_PROVIDER=sentence_transformers in config once the target
environment can download model weights, and nothing else in the pipeline
(chunker, Qdrant schema, retrieval, fusion) needs to change, because every
consumer only depends on the EmbeddingProvider interface.
"""
from __future__ import annotations

import pickle
from abc import ABC, abstractmethod
from pathlib import Path

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize


class EmbeddingProvider(ABC):
    dim: int

    @abstractmethod
    def fit(self, texts: list[str]) -> None:
        """Fit provider state (vocabulary, projection) on the corpus. No-op for API-backed providers."""

    @abstractmethod
    def embed(self, texts: list[str], is_query: bool = False) -> np.ndarray:
        """Return an (N, dim) float32 array of L2-normalized dense vectors."""

    def embed_query(self, query: str) -> np.ndarray:
        """Embed a single query text (applying query-specific prefix/instruction if applicable)."""
        return self.embed([query], is_query=True)[0]

    @abstractmethod
    def save(self, path: str) -> None: ...

    @abstractmethod
    def load(self, path: str) -> None: ...


class TfidfSvdEmbeddingProvider(EmbeddingProvider):
    """Local, zero-network dense embedding provider: TF-IDF -> truncated SVD (LSA).

    This captures co-occurrence-based semantic similarity (synonymy at the
    corpus level) but, unlike a transformer bi-encoder, it has no general
    language understanding beyond this corpus's vocabulary. It is fit once
    on the full corpus at ingestion time and reused for query-time embedding.
    """

    def __init__(self, dim: int = 256):
        self.dim = dim
        self.vectorizer = TfidfVectorizer(
            max_features=50_000,
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1,
        )
        self.svd = TruncatedSVD(n_components=dim, random_state=42)
        self._fitted = False

    def fit(self, texts: list[str]) -> None:
        tfidf = self.vectorizer.fit_transform(texts)
        eff_dim = min(self.dim, tfidf.shape[1] - 1, tfidf.shape[0] - 1)
        if eff_dim < self.dim:
            self.svd = TruncatedSVD(n_components=max(eff_dim, 2), random_state=42)
            self.dim = self.svd.n_components
        self.svd.fit(tfidf)
        self._fitted = True

    def embed(self, texts: list[str], is_query: bool = False) -> np.ndarray:
        if not self._fitted:
            raise RuntimeError("TfidfSvdEmbeddingProvider.fit() must be called before embed()")
        tfidf = self.vectorizer.transform(texts)
        vecs = self.svd.transform(tfidf)
        return normalize(vecs, axis=1).astype("float32")

    def save(self, path: str) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"vectorizer": self.vectorizer, "svd": self.svd, "dim": self.dim}, f)

    def load(self, path: str) -> None:
        with open(path, "rb") as f:
            state = pickle.load(f)
        self.vectorizer = state["vectorizer"]
        self.svd = state["svd"]
        self.dim = state["dim"]
        self._fitted = True


class SentenceTransformerEmbeddingProvider(EmbeddingProvider):
    """Documented swap-in for a real transformer bi-encoder.

    Wire up by setting `embedding_provider = "sentence_transformers"` in Config and
    installing `sentence-transformers`. Recommended models for this domain:
    BAAI/bge-small-en-v1.5 (fast, 384-dim) or intfloat/e5-base-v2.

    BGE models require an instruction prefix on queries ("Represent this sentence for searching relevant passages: ")
    while documents remain un-prefixed.
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-small-en-v1.5",
        query_instruction: str = "Represent this sentence for searching relevant passages: ",
        device: str = "cpu",
    ):
        self.model_name = model_name
        self.query_instruction = query_instruction
        self.device = device
        self.dim = 384
        self._model = None

    def fit(self, texts: list[str]) -> None:
        pass  # pretrained model, nothing to fit

    def _load_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer  # local import: optional dependency
            self._model = SentenceTransformer(self.model_name, device=self.device)
        return self._model

    def embed(self, texts: list[str], is_query: bool = False) -> np.ndarray:
        model = self._load_model()
        if is_query and self.query_instruction:
            processed = [f"{self.query_instruction}{t}" for t in texts]
        else:
            processed = texts
        vecs = model.encode(processed, normalize_embeddings=True, show_progress_bar=False)
        return np.asarray(vecs, dtype="float32")

    def save(self, path: str) -> None:
        pass  # nothing to persist beyond the model name, already in config

    def load(self, path: str) -> None:
        pass


def get_embedding_provider(name: str, dim: int = 256) -> EmbeddingProvider:
    if name == "tfidf_svd_local":
        return TfidfSvdEmbeddingProvider(dim=dim)
    if name == "sentence_transformers":
        return SentenceTransformerEmbeddingProvider()
    raise ValueError(f"Unknown embedding provider: {name}")
