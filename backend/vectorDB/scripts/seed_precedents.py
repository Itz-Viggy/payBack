#!/usr/bin/env python3
"""
Seed the VectorAI DB "precedents" collection with mock data.

Reads backend/vectorDB/data/precedents.json, embeds each summary using
sentence-transformers (all-MiniLM-L6-v2, 384d), and batch-upserts into
VectorAI DB at localhost:50051.

Idempotent: safe to re-run (upsert overwrites by id).

Usage:
    python backend/vectorDB/scripts/seed_precedents.py
"""

import json
import os
import sys
from pathlib import Path

CORTEX_ADDR = os.getenv("CORTEX_SERVER", "localhost:50051")
COLLECTION_NAME = "precedents"
VECTOR_DIMENSION = 384
MODEL_NAME = "all-MiniLM-L6-v2"

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "precedents.json"


def main() -> int:
    # ── Load mock data ──────────────────────────────────────
    if not DATA_FILE.exists():
        print(f"ERROR: Data file not found at {DATA_FILE}")
        return 1

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        precedents = json.load(f)

    print(f"Loaded {len(precedents)} precedent(s) from {DATA_FILE.name}")

    # ── Load embedding model ────────────────────────────────
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print("ERROR: sentence-transformers not installed. Run: pip install sentence-transformers")
        return 1

    print(f"Loading embedding model '{MODEL_NAME}' ...")
    model = SentenceTransformer(MODEL_NAME)

    # ── Generate embeddings ─────────────────────────────────
    summaries = [p["summary"] for p in precedents]
    print(f"Embedding {len(summaries)} summaries ...")
    vectors = model.encode(summaries, normalize_embeddings=True)
    vectors_list = vectors.tolist()

    # ── Connect and seed ────────────────────────────────────
    try:
        from cortex import CortexClient, DistanceMetric
    except ImportError:
        print("ERROR: Actian VectorAI DB Python client not found.")
        print("  From the backend/ directory run: pip install vectorDB/actiancortex-0.1.0b1-py3-none-any.whl --no-deps")
        return 1

    print(f"Connecting to VectorAI DB at {CORTEX_ADDR} ...")

    try:
        with CortexClient(CORTEX_ADDR) as client:
            # Create collection if it doesn't exist
            try:
                client.create_collection(
                    name=COLLECTION_NAME,
                    dimension=VECTOR_DIMENSION,
                    distance_metric=DistanceMetric.COSINE,
                )
                print(f"Created collection '{COLLECTION_NAME}' (dim={VECTOR_DIMENSION}, COSINE)")
            except Exception:
                print(f"Collection '{COLLECTION_NAME}' already exists (skipping create)")

            # Build payloads (include summary so UI can show "similar case" summary)
            ids = list(range(len(precedents)))
            payloads = []
            for p in precedents:
                payload = {
                    "summary": p["summary"],
                    "issue_type": p["issue_type"],
                    "setting": p["setting"],
                    "codes": p["codes"],
                    "severity": p["severity"],
                    "recommended_actions": p["recommended_actions"],
                    "evidence_requests": p["evidence_requests"],
                    "evidence_checklist": p["evidence_checklist"],
                    "letter_snippet": p["letter_snippet"],
                }
                if "typical_outcome" in p:
                    payload["typical_outcome"] = p["typical_outcome"]
                if "tags" in p:
                    payload["tags"] = p["tags"]
                payloads.append(payload)

            # Batch upsert
            client.batch_upsert(COLLECTION_NAME, ids, vectors_list, payloads)
            print(f"Upserted {len(ids)} vectors into '{COLLECTION_NAME}'")

            count = client.count(COLLECTION_NAME)
            print(f"Collection '{COLLECTION_NAME}' now has {count} vectors.")

    except Exception as exc:
        print(f"ERROR: Failed to seed VectorAI DB: {exc}")
        return 1

    print("Seeding complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
