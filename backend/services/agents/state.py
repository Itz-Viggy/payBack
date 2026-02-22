"""PayBackState — single source of truth for the LangGraph pipeline."""

from __future__ import annotations

from typing import Any, Optional, TypedDict


class PayBackState(TypedDict, total=False):
    # OCR node input (set from convert_to_bill_input result before graph runs)
    raw_text: Optional[str]
    images: Optional[list[bytes]]
    image_mime: Optional[str]

    # Extract node output
    extracted_data: dict
    line_items: list[dict]
    facility: str
    insurance: str
    diagnosis_codes: list[str]
    bill_state: str

    # Query node output
    audited_items: list[dict]
    extracted_codes: list[str]
    standard_charges: list[Any]
    billed_charges: list[float]

    # Rules engine node output
    flags: list[dict]
    summary: dict
    estimated_overcharge: float

    # Letter gen node output (standalone, not in upload graph)
    letter_text: str

    # Non-fatal errors collected during the run
    errors: list[str]
    # Internal: rules pass counter (1 = first pass, 2 = second pass / done)
    _rules_pass: int

