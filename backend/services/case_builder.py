# case_builder.py
# Assembles flagged charges and evidence into a structured dispute case.
# Produces the payload used by email_formatter and the send-email flow.
# Connects with gemini_service for optional AI-generated letter text.

from __future__ import annotations

import json


def _line_item_amount(item: dict) -> float:
    """Preferred amount for comparison: patient_owed (P. Owed), then total_charge, then unit_price * quantity."""
    p = item.get("patient_owed")
    if p is not None:
        return float(p)
    total = item.get("total_charge")
    if total is not None:
        return float(total)
    qty = item.get("quantity", 1)
    up = item.get("unit_price", 0)
    return float(up) * float(qty) if up is not None else 0.0


def _normalize_line_item(item: dict, index: int) -> dict:
    """Map extracted line item to draft selectedItem shape (id, cptCode, description, billed, citation)."""
    lid = item.get("line_item_id") or index + 1
    total = _line_item_amount(item)
    return {
        "id": f"li-{lid}",
        "line_item_id": lid,
        "cptCode": (item.get("cpt_code") or "").strip() or None,
        "description": (item.get("description") or "").strip() or "Unspecified",
        "billed": round(float(total), 2),
        "citation": item.get("citation"),
    }


def _bill_report(bill_data: dict, date_of_service: str | None) -> dict:
    """Build report dict for draft from extracted bill. Uses total_patient_billed (patient balance due) when present."""
    return {
        "accountNumber": bill_data.get("account_number") or "",
        "dateOfService": date_of_service or bill_data.get("bill_date") or "",
        "facility": bill_data.get("facility") or "",
        "hospitalName": bill_data.get("facility") or "",
        "totalBilled": bill_data.get("total_patient_billed") or bill_data.get("total_billed"),
    }


def build_draft(
    bill_data: dict,
    selected_item_ids: list[int | str],
    patient_details: dict | None = None,
    recipient: str | None = None,
    benchmarks: list | dict | None = None,
) -> dict:
    """
    Build a dispute draft from extracted bill and selected line items.
    The draft is ready for email_formatter.format_draft_to_letter and the send-email flow.

    Args:
        bill_data: Extracted bill from gemini_service.extract_bill (patient_name, account_number,
                   facility, bill_date, total_patient_billed, line_items with line_item_id, cpt_code, patient_owed, etc.).
        selected_item_ids: List of line_item_id (int) or id strings (e.g. "li-1") to include in the dispute.
        patient_details: Optional { fullName, mailingAddress, state, billingEmail }.
        recipient: Optional billing email; falls back to patient_details.billingEmail.
        benchmarks: Optional list/dict of pricing benchmarks for display or Gemini.

    Returns:
        Draft dict with recipient, subject, selectedItems, patientDetails, report, lawsCited.
    """
    patient_details = patient_details or {}
    line_items = bill_data.get("line_items") or []
    # Resolve selected_item_ids to line_item_id set (support int or "li-1" style)
    selected_ids = set()
    for sid in selected_item_ids:
        if isinstance(sid, int):
            selected_ids.add(sid)
        elif isinstance(sid, str) and sid.startswith("li-"):
            try:
                selected_ids.add(int(sid.replace("li-", "")))
            except ValueError:
                pass
        else:
            try:
                selected_ids.add(int(sid))
            except (TypeError, ValueError):
                pass

    selected = []
    date_of_service = None
    for i, li in enumerate(line_items):
        lid = li.get("line_item_id") or (i + 1)
        if lid not in selected_ids:
            continue
        normalized = _normalize_line_item(li, i)
        selected.append(normalized)
        if date_of_service is None and li.get("date_of_service"):
            date_of_service = li.get("date_of_service")
    if date_of_service is None and line_items:
        date_of_service = line_items[0].get("date_of_service") or bill_data.get("bill_date")

    report = _bill_report(bill_data, date_of_service)
    account = report.get("accountNumber") or ""

    laws_cited = []
    for it in selected:
        if it.get("citation") and it["citation"] not in laws_cited:
            laws_cited.append(it["citation"])

    recipient = recipient or patient_details.get("billingEmail") or ""
    subject = f"Formal Billing Dispute - Acct #{account}" if account else "Formal Billing Dispute"

    return {
        "recipient": recipient,
        "subject": subject,
        "selectedItems": selected,
        "patientDetails": {
            "fullName": patient_details.get("fullName") or bill_data.get("patient_name") or "",
            "mailingAddress": patient_details.get("mailingAddress") or "",
            "state": patient_details.get("state") or "",
            "billingEmail": recipient or patient_details.get("billingEmail") or "",
        },
        "report": report,
        "lawsCited": laws_cited,
        "benchmarks": benchmarks,
    }


def _resolve_selected_ids(selected_item_ids: list[int | str]) -> set[int]:
    """Normalize a mix of int / 'li-N' / str-int IDs into a set of ints."""
    selected_ids: set[int] = set()
    for sid in selected_item_ids:
        if isinstance(sid, int):
            selected_ids.add(sid)
        elif isinstance(sid, str) and sid.startswith("li-"):
            try:
                selected_ids.add(int(sid.replace("li-", "")))
            except ValueError:
                pass
        else:
            try:
                selected_ids.add(int(sid))
            except (TypeError, ValueError):
                pass
    return selected_ids


def _filter_flags_for_items(flags: list[dict], selected_ids: set[int]) -> list[dict]:
    """Return only flags whose line_item_ids overlap with selected_ids, trimmed to relevant keys."""
    filtered = []
    for flag in flags:
        flag_ids = set(flag.get("line_item_ids") or [])
        if not flag_ids.intersection(selected_ids):
            continue
        filtered.append({
            "rule_name": flag.get("rule_name"),
            "line_item_ids": sorted(flag_ids.intersection(selected_ids)),
            "severity": flag.get("severity"),
            "message": flag.get("message"),
            "citation": flag.get("citation"),
        })
    return filtered


def build_case_for_gemini(
    bill_data: dict,
    selected_item_ids: list[int | str],
    benchmarks: list | dict | None = None,
    flags: list[dict] | None = None,
) -> dict:
    """
    Build case data for the dispute_letter Gemini prompt (patient_name, account_number,
    facility, date_of_service, total_patient_billed, disputed_charges_json,
    pricing_benchmarks_json, rules_findings_json).

    flags: Rules engine flags from run_holistic_review; filtered to selected items automatically.
    """
    draft = build_draft(bill_data, selected_item_ids, benchmarks=benchmarks)
    report = draft["report"]
    line_items = bill_data.get("line_items") or []
    selected_ids = _resolve_selected_ids(selected_item_ids)

    disputed_charges = []
    date_of_service = report.get("dateOfService") or bill_data.get("bill_date")
    for i, li in enumerate(line_items):
        lid = li.get("line_item_id") or (i + 1)
        if lid not in selected_ids:
            continue
        amount = _line_item_amount(li)
        disputed_charges.append({
            "cpt_code": li.get("cpt_code"),
            "description": li.get("description"),
            "amount_billed": round(amount, 2),
            "citation": li.get("citation"),
        })
        if date_of_service is None and li.get("date_of_service"):
            date_of_service = li.get("date_of_service")

    benchmarks_json = "[]"
    if benchmarks is not None:
        benchmarks_json = json.dumps(benchmarks) if not isinstance(benchmarks, str) else benchmarks

    relevant_flags = _filter_flags_for_items(flags or [], selected_ids)

    return {
        "patient_name": bill_data.get("patient_name") or "[PATIENT NAME]",
        "account_number": bill_data.get("account_number") or "[ACCOUNT]",
        "facility": bill_data.get("facility") or "[FACILITY]",
        "date_of_service": date_of_service or "[DATE]",
        "total_billed": bill_data.get("total_patient_billed") or bill_data.get("total_billed"),
        "disputed_charges_json": json.dumps(disputed_charges, indent=2),
        "pricing_benchmarks_json": benchmarks_json,
        "rules_findings_json": json.dumps(relevant_flags, indent=2),
    }


def build_draft_with_gemini_letter(
    bill_data: dict,
    selected_item_ids: list[int | str],
    patient_details: dict | None = None,
    recipient: str | None = None,
    benchmarks: list | dict | None = None,
) -> dict:
    """
    Build draft and optionally generate dispute letter body via Gemini.
    The draft is ready for email_formatter; if Gemini succeeds, draft["letter_body_gemini"]
    contains the AI-generated letter text (can be used as email body instead of format_draft_to_letter).
    """
    draft = build_draft(
        bill_data, selected_item_ids,
        patient_details=patient_details,
        recipient=recipient,
        benchmarks=benchmarks,
    )
    try:
        from services.gemini_service import generate_dispute_letter
        case_data = build_case_for_gemini(bill_data, selected_item_ids, benchmarks=benchmarks)
        draft["letter_body_gemini"] = generate_dispute_letter(case_data)
    except Exception:
        draft["letter_body_gemini"] = None
    return draft
