"""Extract Agent — calls Gemini to extract structured bill data from OCR output."""

from __future__ import annotations

from services.agents.state import PayBackState
from services.gemini_service import extract_bill


def extract_node(state: PayBackState) -> dict:
    extracted = extract_bill(state.get("raw_text"), state.get("images"))
    print("[extract_node] Gemini extraction complete")
    return {
        "extracted_data": extracted,
        "line_items": extracted.get("line_items", []),
        "facility": extracted.get("facility", ""),
        "insurance": extracted.get("insurance", ""),
        "diagnosis_codes": extracted.get("diagnosis_codes", []),
        "bill_state": extracted.get("state", ""),
    }
