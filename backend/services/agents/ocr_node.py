"""OCR Agent — passes converted OCR data into the graph state.

The actual PDF/image conversion (convert_to_bill_input) runs in upload_bill
before the graph starts, so this node is a passthrough that anchors the OCR
stage in the agentic architecture and drives stage tracking.
"""

from __future__ import annotations

from services.agents.state import PayBackState


def ocr_node(state: PayBackState) -> dict:
    return {
        "raw_text": state.get("raw_text"),
        "images": state.get("images"),
        "image_mime": state.get("image_mime"),
    }
