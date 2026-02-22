"""Query Agent — runs pricing benchmarks against DoltHub for every line item.

This is an async node because process_entire_bill uses httpx.AsyncClient
with asyncio.gather under the hood.
"""

from __future__ import annotations

from services.agents.state import PayBackState
from services.medical_db import process_entire_bill


async def query_node(state: PayBackState) -> dict:
    bill_json = state["extracted_data"]
    layer2 = await process_entire_bill(bill_json)
    print("[query_node] Benchmarking complete")
    return {
        "audited_items": layer2.get("audited_items", []),
        "extracted_codes": layer2.get("extracted_codes", []),
        "standard_charges": layer2.get("standard_charges", []),
        "billed_charges": layer2.get("billed_charges", []),
    }
