# precedent_service.py
# Searches the Actian VectorAI DB "precedents" collection using local embeddings.
# Used to retrieve semantically similar historical billing cases for dispute context.

from __future__ import annotations

import os
from typing import Any

# Lazy-loaded in search_precedents
_embedding_model = None
COLLECTION_NAME = "precedents"
VECTOR_DIMENSION = 384
DEFAULT_TOP_K = 5
CORTEX_ADDR = os.getenv("CORTEX_SERVER", "localhost:50051")


class PrecedentServiceError(Exception):
    """Raised when the vector DB is unreachable or search fails."""
    pass


def _get_model():
    """Lazy-load sentence-transformers model (all-MiniLM-L6-v2, 384d)."""
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model


def _embed(text: str) -> list[float]:
    """Embed a single string and return normalized vector for COSINE similarity."""
    model = _get_model()
    vec = model.encode([text], normalize_embeddings=True)
    return vec[0].tolist()


def search_precedents(query_text: str, top_k: int = DEFAULT_TOP_K) -> list[dict[str, Any]]:
    """
    Search the precedents collection for cases similar to query_text.
    Returns a list of {"id", "score", "payload"} dicts.
    Raises PrecedentServiceError if the vector DB is unreachable or search fails.
    """
    if not query_text or not query_text.strip():
        return []

    try:
        from cortex import CortexClient, DistanceMetric
    except ImportError as e:
        raise PrecedentServiceError("Vector DB client (cortex) not installed") from e

    query_vector = _embed(query_text.strip())

    try:
        with CortexClient(CORTEX_ADDR) as client:
            results = client.search(COLLECTION_NAME, query_vector, top_k=top_k)
    except Exception as e:
        raise PrecedentServiceError(f"Vector DB unreachable or search failed: {e}") from e

    out = []
    for r in results:
        payload = dict(r.payload) if getattr(r, "payload", None) else {}
        out.append({
            "id": getattr(r, "id", None),
            "score": float(getattr(r, "score", 0.0)),
            "payload": payload,
        })
    return out
