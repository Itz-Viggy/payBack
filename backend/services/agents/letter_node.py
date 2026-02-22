"""Letter Gen Agent — generates a Gemini-powered dispute letter.

This node is standalone (not part of the upload pipeline graph).
Called from the /api/dispute/generate-letter endpoint.
"""

from __future__ import annotations

from services.case_builder import build_case_for_gemini
from services.gemini_service import generate_dispute_letter


def letter_node(
    bill_data: dict,
    selected_item_ids: list,
    benchmarks=None,
    flags=None,
) -> dict:
    case_data = build_case_for_gemini(
        bill_data=bill_data,
        selected_item_ids=selected_item_ids,
        benchmarks=benchmarks,
        flags=flags,
    )
    letter_text = generate_dispute_letter(case_data)
    return {"letter_text": letter_text}
