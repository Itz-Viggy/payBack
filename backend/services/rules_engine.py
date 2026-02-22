"""Deterministic and holistic rules engine for bill findings."""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

# CPT reference sets used by deterministic checks.
EM_CPTS = {str(code) for code in range(99231, 99240)}
DISCHARGE_CPTS = {"99238", "99239"}
SINGLE_OCCURRENCE_CPTS = (
    {str(code) for code in range(99202, 99216)}
    | {str(code) for code in range(99221, 99240)}
    | {
        "10060",  # Incision and drainage of abscess
        "10061",
        "19120",  # Excision of cyst/adenoma, breast
        "29881",  # Knee arthroscopy with meniscectomy
        "44950",  # Appendectomy
        "44970",  # Laparoscopic appendectomy
        "47562",  # Laparoscopic cholecystectomy
        "47600",  # Open cholecystectomy
    }
)


def _to_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _severity(value: str | None, default: str = "medium") -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"low", "medium", "high"}:
        return normalized
    return default


def _line_id(item: dict[str, Any]) -> int | None:
    raw = item.get("line_item_id")
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _new_flag(
    *,
    rule_name: str,
    line_item_ids: list[int],
    severity: str,
    message: str,
    citation: str | None = None,
    billed_amount: float | None = None,
    benchmark_amount: float | None = None,
) -> dict[str, Any]:
    return {
        "rule_name": rule_name,
        "line_item_ids": line_item_ids,
        "severity": _severity(severity),
        "message": message,
        "citation": citation,
        "billed_amount": billed_amount,
        "benchmark_amount": benchmark_amount,
    }


def run_rules(layer2_payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Apply deterministic checks and return findings in unified shape."""
    audited_items = layer2_payload.get("audited_items", []) or []
    flags: list[dict[str, Any]] = []

    # Flatten to easier structures while preserving benchmark context.
    line_rows: list[dict[str, Any]] = []
    for entry in audited_items:
        billed_item = entry.get("billed_item") or {}
        line_rows.append(
            {
                "item": billed_item,
                "benchmarks": entry.get("market_benchmarks", []) or [],
            }
        )

    # Rule 1: duplicate_charge (same CPT + same service date).
    duplicate_groups: dict[tuple[str, str], list[int]] = defaultdict(list)
    for row in line_rows:
        item = row["item"]
        cpt_code = str(item.get("cpt_code") or "").strip()
        date_of_service = str(item.get("date_of_service") or "").strip()
        line_item_id = _line_id(item)
        if not cpt_code or not date_of_service or line_item_id is None:
            continue
        duplicate_groups[(cpt_code, date_of_service)].append(line_item_id)
    for (cpt_code, date_of_service), ids in duplicate_groups.items():
        if len(ids) > 1:
            flags.append(
                _new_flag(
                    rule_name="duplicate_charge",
                    line_item_ids=sorted(ids),
                    severity="high",
                    message=f"CPT {cpt_code} appears multiple times on {date_of_service}.",
                    citation="Duplicate billing review",
                )
            )

    # Rule 2: quantity_anomaly (single-occurrence code billed with qty > 1).
    for row in line_rows:
        item = row["item"]
        cpt_code = str(item.get("cpt_code") or "").strip()
        quantity = _to_float(item.get("quantity"))
        line_item_id = _line_id(item)
        if line_item_id is None or not cpt_code or quantity is None:
            continue
        if cpt_code in SINGLE_OCCURRENCE_CPTS and quantity > 1:
            flags.append(
                _new_flag(
                    rule_name="quantity_anomaly",
                    line_item_ids=[line_item_id],
                    severity="high",
                    message=f"CPT {cpt_code} billed with quantity {quantity:g} (expected single occurrence).",
                    citation="Coding unit consistency check",
                )
            )

    # Rule 3: extreme_markup (billed amount > 10x reference benchmark).
    for row in line_rows:
        item = row["item"]
        line_item_id = _line_id(item)
        if line_item_id is None:
            continue
        billed_amount = _to_float(item.get("patient_owed"))
        if billed_amount is None:
            billed_amount = _to_float(item.get("total_charge"))
        if billed_amount is None:
            billed_amount = _to_float(item.get("unit_price"))
        if billed_amount is None:
            continue

        benchmark_rows = row["benchmarks"]
        medicare_candidates: list[float] = []
        generic_candidates: list[float] = []
        for benchmark in benchmark_rows:
            charge = _to_float(benchmark.get("standard_charge"))
            if charge is None or charge <= 0:
                continue
            generic_candidates.append(charge)
            payer_name = str(benchmark.get("payer_name") or "").lower()
            if "medicare" in payer_name:
                medicare_candidates.append(charge)

        reference_rate = None
        if medicare_candidates:
            reference_rate = min(medicare_candidates)
        elif generic_candidates:
            reference_rate = min(generic_candidates)

        if reference_rate and billed_amount > (10 * reference_rate):
            ratio = billed_amount / reference_rate
            cpt_code = str(item.get("cpt_code") or "unknown")
            flags.append(
                _new_flag(
                    rule_name="extreme_markup",
                    line_item_ids=[line_item_id],
                    severity="high",
                    message=f"CPT {cpt_code} billed at ${billed_amount:.2f} vs reference ${reference_rate:.2f} ({ratio:.1f}x).",
                    citation="Markup threshold (10x reference)",
                    billed_amount=billed_amount,
                    benchmark_amount=reference_rate,
                )
            )

    # Rule 4: facility_fee (description has facility fee/charge wording).
    facility_terms = ("facility fee", "facility charge")
    for row in line_rows:
        item = row["item"]
        line_item_id = _line_id(item)
        if line_item_id is None:
            continue
        description = str(item.get("description") or "").lower()
        if any(term in description for term in facility_terms):
            flags.append(
                _new_flag(
                    rule_name="facility_fee",
                    line_item_ids=[line_item_id],
                    severity="medium",
                    message="Line item description indicates a facility fee/charge.",
                    citation="Facility fee screening",
                )
            )

    # Rule 5: discharge_day_bill (E&M visit code and discharge code same date).
    per_date_codes: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for row in line_rows:
        item = row["item"]
        line_item_id = _line_id(item)
        date_of_service = str(item.get("date_of_service") or "").strip()
        cpt_code = str(item.get("cpt_code") or "").strip()
        if line_item_id is None or not date_of_service or not cpt_code:
            continue
        per_date_codes[date_of_service].append((cpt_code, line_item_id))

    em_non_discharge = EM_CPTS - DISCHARGE_CPTS
    for date_of_service, code_rows in per_date_codes.items():
        discharge_ids = [line_id for code, line_id in code_rows if code in DISCHARGE_CPTS]
        em_visit_ids = [line_id for code, line_id in code_rows if code in em_non_discharge]
        if discharge_ids and em_visit_ids:
            flags.append(
                _new_flag(
                    rule_name="discharge_day_bill",
                    line_item_ids=sorted(set(discharge_ids + em_visit_ids)),
                    severity="medium",
                    message=f"E&M and discharge billing codes appear on {date_of_service}.",
                    citation="Discharge-day coding overlap check",
                )
            )

    return flags


def _print_findings(flags: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    print("\n=== LAYER 3: FINDINGS ===")
    if not flags:
        print("No findings detected.")
        print("---")
        print("Total: 0 findings")
        return

    for flag in flags:
        flag_id = flag.get("flag_id", "-")
        rule_name = str(flag.get("rule_name") or "unknown")
        line_item_ids = flag.get("line_item_ids") or []
        message = str(flag.get("message") or "")
        print(f"[{flag_id}] {rule_name:<28} {line_item_ids!s:<12} {message}")

    print("---")
    by_rule = summary.get("by_rule", {})
    details = ", ".join(f"{name}: {count}" for name, count in sorted(by_rule.items()))
    print(f"Total: {summary.get('total_flags', 0)} findings" + (f" ({details})" if details else ""))


def _build_precedent_query(line_items: list[dict[str, Any]]) -> str:
    """Build a single query string from all bill line items for vector search."""
    segments: list[str] = []
    for item in line_items:
        parts = [
            item.get("description") or "",
            f"CPT {item.get('cpt_code') or 'N/A'}",
            f"quantity {item.get('quantity', '')}",
            f"unit price {item.get('unit_price', '')}",
            f"total {item.get('total_charge', '')}",
        ]
        segment = " ".join(str(p).strip() for p in parts if p).strip()
        if segment:
            segments.append(segment)
    return "; ".join(segments) or "medical bill line item"


def _format_similar_cases(precedents: list[dict[str, Any]]) -> str:
    """Format top precedent results into a concise context block for Gemini prompts."""
    if not precedents:
        return "None provided."
    lines: list[str] = []
    for i, p in enumerate(precedents, start=1):
        payload = p.get("payload") or {}
        score = p.get("score", 0)
        summary = payload.get("summary") or "No summary."
        issue_type = (payload.get("issue_type") or "unknown").replace("_", " ")
        actions = payload.get("recommended_actions") or "N/A"
        snippet = payload.get("letter_snippet") or ""
        block = (
            f"Case {i} ({score:.0%} match):\n"
            f"  Summary: {summary}\n"
            f"  Issue type: {issue_type}\n"
            f"  Recommended actions: {actions}"
        )
        if snippet:
            block += f"\n  Dispute language: {snippet}"
        lines.append(block)
    return "\n\n".join(lines)


def run_holistic_review(layer2_payload: dict[str, Any]) -> dict[str, Any]:
    """Run deterministic and Gemini-assisted checks and return unified findings."""
    from services.gemini_service import (
        run_relationship_check,
        run_upcoding_check,
        run_unbundling_check,
    )
    from services.precedent_service import PrecedentServiceError, search_precedents

    rules_flags = run_rules(layer2_payload)

    line_items = [
        (entry.get("billed_item") or {})
        for entry in (layer2_payload.get("audited_items", []) or [])
    ]
    diagnosis_codes = layer2_payload.get("diagnosis_codes") or []
    state = layer2_payload.get("state") or ""

    similar_cases_context = "None provided."
    if line_items:
        try:
            query = _build_precedent_query(line_items)
            precedents = search_precedents(query, top_k=3)
            similar_cases_context = _format_similar_cases(precedents)
            print(f"[rules_engine] Fetched {len(precedents)} similar cases for context")
        except PrecedentServiceError as exc:
            print(f"[rules_engine] Precedent search unavailable, proceeding without: {exc}")

    relationship_flags = run_relationship_check(line_items, state, similar_cases_context)
    upcoding_flags = run_upcoding_check(line_items, diagnosis_codes, state, similar_cases_context)
    unbundling_flags = run_unbundling_check(line_items, state, similar_cases_context)

    all_flags = rules_flags + relationship_flags + upcoding_flags + unbundling_flags
    for idx, flag in enumerate(all_flags, start=1):
        flag["flag_id"] = f"fl-{idx}"

    by_rule = Counter(str(flag.get("rule_name") or "unknown") for flag in all_flags)
    summary = {
        "total_flags": len(all_flags),
        "by_rule": dict(by_rule),
    }
    _print_findings(all_flags, summary)
    return {"flags": all_flags, "summary": summary}
