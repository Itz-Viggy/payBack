"""Gemini API helpers for bill extraction."""

from __future__ import annotations

import json
import os
import re
import time
from io import BytesIO
from pathlib import Path

import google.generativeai as genai
from PIL import Image

# #region agent log
def _debug_log(msg: str, data: dict, hypothesis_id: str = "H1"):
    try:
        log_path = Path(__file__).resolve().parents[2] / "debug-f61d1b.log"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "f61d1b", "location": "gemini_service.py", "message": msg, "data": data, "hypothesisId": hypothesis_id, "timestamp": time.time() * 1000}) + "\n")
    except Exception:
        pass
# #endregion


MODEL_NAME = "gemini-2.5-flash"


class ExtractionError(Exception):
    """Raised when Gemini extraction fails or response cannot be parsed."""


def _load_prompt(name: str) -> str:
    prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
    prompt_path = prompts_dir / f"{name}.txt"
    return prompt_path.read_text(encoding="utf-8")


def _strip_json_fences(text: str) -> str:
    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _parse_model_json(response_text: str) -> dict:
    cleaned = _strip_json_fences(response_text)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ExtractionError("Failed to parse Gemini response as JSON") from exc
    if not isinstance(parsed, dict):
        raise ExtractionError("Gemini response JSON must be an object")
    return parsed


def _configure_model() -> genai.GenerativeModel:
    api_key = os.getenv("GEMINI_API_KEY")
    # #region agent log
    _debug_log("_configure_model", {"api_key_is_set": bool(api_key), "api_key_len": len(api_key) if api_key else 0}, "H1")
    # #endregion
    if not api_key:
        raise ExtractionError("GEMINI_API_KEY is not set")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(MODEL_NAME)


def extract_bill(text: str | None, images: list[bytes] | None) -> dict:
    """Extract structured bill JSON from text or image bytes."""
    if not text and not images:
        raise ExtractionError("No text or images provided for extraction")

    model = _configure_model()
    base_prompt = _load_prompt("extraction")

    try:
        if text:
            prompt = base_prompt.replace("{{bill_text}}", text)
            response = model.generate_content(prompt)
        else:
            pil_images = [Image.open(BytesIO(img_bytes)) for img_bytes in (images or [])]
            image_prompt = base_prompt.replace(
                "Bill text:\n{{bill_text}}",
                "Bill images are attached below. Extract using the same JSON schema.",
            )
            response = model.generate_content([image_prompt, *pil_images])
    except Exception as exc:
        raise ExtractionError(f"Gemini extraction failed: {exc}") from exc

    response_text = (getattr(response, "text", None) or "").strip()
    if not response_text:
        raise ExtractionError("Gemini returned an empty response")

    return _parse_model_json(response_text)


def _normalize_rule_name(issue_type: str | None) -> str:
    raw = (issue_type or "").strip().lower()
    if not raw:
        return "relationship_issue"
    # Keep only identifier-safe characters for stable downstream keys.
    normalized = re.sub(r"[^a-z0-9_]+", "_", raw).strip("_")
    return normalized or "relationship_issue"


def _normalize_severity(value: str | None) -> str:
    lowered = (value or "").strip().lower()
    if lowered in {"low", "medium", "high"}:
        return lowered
    return "medium"


def _normalize_single_id_flags(raw_flags: list, default_message: str = "Potential billing issue.") -> list[dict]:
    """Normalize flags that use a single line_item_id field."""
    normalized: list[dict] = []
    for raw_flag in raw_flags:
        if not isinstance(raw_flag, dict):
            continue
        try:
            line_item_id = int(raw_flag.get("line_item_id"))
        except (TypeError, ValueError):
            continue
        normalized.append(
            {
                "rule_name": _normalize_rule_name(raw_flag.get("issue_type")),
                "line_item_ids": [line_item_id],
                "severity": _normalize_severity(raw_flag.get("severity")),
                "message": str(raw_flag.get("explanation") or default_message),
                "citation": None,
                "billed_amount": None,
                "benchmark_amount": None,
            }
        )
    return normalized


def _normalize_multi_id_flags(raw_flags: list, default_message: str = "Potential billing issue.") -> list[dict]:
    """Normalize flags that use a line_item_ids (array) field."""
    normalized: list[dict] = []
    for raw_flag in raw_flags:
        if not isinstance(raw_flag, dict):
            continue
        raw_ids = raw_flag.get("line_item_ids") or raw_flag.get("line_item_id")
        if isinstance(raw_ids, (int, str)):
            raw_ids = [raw_ids]
        if not isinstance(raw_ids, list):
            continue
        line_item_ids: list[int] = []
        for x in raw_ids:
            try:
                line_item_ids.append(int(x))
            except (TypeError, ValueError):
                continue
        if not line_item_ids:
            continue
        normalized.append(
            {
                "rule_name": _normalize_rule_name(raw_flag.get("issue_type")),
                "line_item_ids": line_item_ids,
                "severity": _normalize_severity(raw_flag.get("severity")),
                "message": str(raw_flag.get("explanation") or default_message),
                "citation": None,
                "billed_amount": None,
                "benchmark_amount": None,
            }
        )
    return normalized


def _call_gemini_check(prompt_name: str, substitutions: dict[str, str], log_label: str) -> list | None:
    """Load a prompt, substitute placeholders, call Gemini, and return raw flags list."""
    try:
        model = _configure_model()
        base_prompt = _load_prompt(prompt_name)
        prompt = base_prompt
        for key, value in substitutions.items():
            prompt = prompt.replace(key, value)
        response = model.generate_content(prompt)
        response_text = (getattr(response, "text", None) or "").strip()
        if not response_text:
            return None
        parsed = _parse_model_json(response_text)
        raw_flags = parsed.get("flags")
        return raw_flags if isinstance(raw_flags, list) else None
    except Exception as exc:
        _debug_log(f"{log_label}_error", {"error": str(exc)}, "H1")
        return None


def run_relationship_check(line_items: list[dict], state: str = "") -> list[dict]:
    """Run Gemini relationship check and normalize findings to unified flag shape."""
    if not line_items:
        return []
    raw_flags = _call_gemini_check(
        "relationship_check",
        {
            "{{line_items_json}}": json.dumps(line_items, indent=2),
            "{{state}}": state or "Not specified",
        },
        "run_relationship_check",
    )
    if raw_flags is None:
        return []
    return _normalize_single_id_flags(raw_flags, "Potential relationship billing issue.")


def run_upcoding_check(line_items: list[dict], diagnosis_codes: list[str], state: str = "") -> list[dict]:
    """Run Gemini upcoding check (E&M level vs diagnosis complexity)."""
    if not line_items:
        return []
    raw_flags = _call_gemini_check(
        "upcoding_check",
        {
            "{{line_items_json}}": json.dumps(line_items, indent=2),
            "{{diagnosis_codes_json}}": json.dumps(diagnosis_codes, indent=2),
            "{{state}}": state or "Not specified",
        },
        "run_upcoding_check",
    )
    if raw_flags is None:
        return []
    return _normalize_single_id_flags(raw_flags, "Potential upcoding issue.")


def run_unbundling_check(line_items: list[dict], state: str = "") -> list[dict]:
    """Run Gemini unbundling check (CPT bundling violations)."""
    if not line_items:
        return []
    raw_flags = _call_gemini_check(
        "unbundling_check",
        {
            "{{line_items_json}}": json.dumps(line_items, indent=2),
            "{{state}}": state or "Not specified",
        },
        "run_unbundling_check",
    )
    if raw_flags is None:
        return []
    return _normalize_multi_id_flags(raw_flags, "Potential unbundling issue.")
def generate_dispute_letter(case_data: dict) -> str:
    """
    Generate dispute letter text using the dispute_letter prompt and Gemini.
    case_data must include: patient_name, account_number, facility, date_of_service,
    total_patient_billed or total_billed, disputed_charges_json, pricing_benchmarks_json.
    Returns plain letter text (no JSON).
    """
    prompt_tpl = _load_prompt("dispute_letter")
    prompt = (
        prompt_tpl.replace("{{patient_name}}", str(case_data.get("patient_name") or ""))
        .replace("{{account_number}}", str(case_data.get("account_number") or ""))
        .replace("{{facility}}", str(case_data.get("facility") or ""))
        .replace("{{date_of_service}}", str(case_data.get("date_of_service") or ""))
        .replace("{{total_billed}}", str(case_data.get("total_patient_billed") or case_data.get("total_billed") or ""))
        .replace("{{disputed_charges_json}}", str(case_data.get("disputed_charges_json") or "[]"))
        .replace("{{pricing_benchmarks_json}}", str(case_data.get("pricing_benchmarks_json") or "[]"))
    )
    model = _configure_model()
    try:
        response = model.generate_content(prompt)
    except Exception as exc:
        raise ExtractionError(f"Gemini dispute letter failed: {exc}") from exc
    response_text = (getattr(response, "text", None) or "").strip()
    if not response_text:
        raise ExtractionError("Gemini returned an empty dispute letter")
    return response_text
