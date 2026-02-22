"""Rules Engine Agent — deterministic rules + Gemini-assisted checks + overcharge calc."""

from __future__ import annotations

from services.agents.state import PayBackState
from services.rules_engine import run_holistic_review


def rules_node(state: PayBackState) -> dict:
    layer2_payload = {
        "audited_items": state.get("audited_items", []),
        "diagnosis_codes": state.get("diagnosis_codes", []),
        "state": state.get("bill_state", ""),
    }

    review = run_holistic_review(layer2_payload)

    estimated_overcharge = 0.0
    for audited in state.get("audited_items", []):
        billed_item = audited.get("billed_item", {})
        billed_amount = float(billed_item.get("patient_owed", 0) or 0)
        for bench in audited.get("market_benchmarks", []):
            bench_charge = float(bench.get("standard_charge", 0) or 0)
            if bench_charge > 0 and billed_amount > bench_charge:
                estimated_overcharge += billed_amount - bench_charge
                break

    print(f"[rules_node] {review['summary']['total_flags']} flags, overcharge=${estimated_overcharge:.2f}")
    return {
        "flags": review["flags"],
        "summary": review["summary"],
        "estimated_overcharge": round(estimated_overcharge, 2) if estimated_overcharge else None,
    }
