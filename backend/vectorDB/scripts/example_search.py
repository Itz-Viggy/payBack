#!/usr/bin/env python3
"""
Example: search precedents for a sample query and print top 3 results.

Run from backend/: python vectorDB/scripts/example_search.py

Optional: pass a query as the first argument, e.g.:
  python vectorDB/scripts/example_search.py "ER visit level 5 CPT 99285 high facility fee"
"""

import json
import sys

# Add backend to path so we can import services
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent.parent))

from services.precedent_service import search_precedents, PrecedentServiceError

TOP_K = 3
DEFAULT_QUERY = "Emergency department visit billed at highest level CPT 99285 with high facility fee and minimal documentation."


def main():
    query = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_QUERY
    print(f"Query: {query}\n")
    print(f"Top {TOP_K} similar precedents:\n")

    try:
        results = search_precedents(query, top_k=TOP_K)
    except PrecedentServiceError as e:
        print(f"ERROR: {e}")
        return 1

    for i, hit in enumerate(results, 1):
        print(f"========== Result {i} ==========")
        # Full hit: id, score, and entire payload (all fields)
        print(json.dumps({"id": hit["id"], "score": hit["score"], "payload": hit["payload"]}, indent=2))
        print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
