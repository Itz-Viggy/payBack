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


def run_relationship_check(line_items: list[dict]) -> list[dict]:
    """Run Gemini relationship check and normalize findings to unified flag shape."""
    if not line_items:
        return []

    try:
        model = _configure_model()
        base_prompt = _load_prompt("relationship_check")
        line_items_json = json.dumps(line_items, indent=2)
        prompt = base_prompt.replace("{{line_items_json}}", line_items_json)
        response = model.generate_content(prompt)
        response_text = (getattr(response, "text", None) or "").strip()
        if not response_text:
            return []
        parsed = _parse_model_json(response_text)
    except Exception as exc:
        _debug_log("run_relationship_check_error", {"error": str(exc)}, "H1")
        return []

    raw_flags = parsed.get("flags")
    if not isinstance(raw_flags, list):
        return []

    normalized_flags: list[dict] = []
    for raw_flag in raw_flags:
        if not isinstance(raw_flag, dict):
            continue

        try:
            line_item_id = int(raw_flag.get("line_item_id"))
        except (TypeError, ValueError):
            continue

        normalized_flags.append(
            {
                "rule_name": _normalize_rule_name(raw_flag.get("issue_type")),
                "line_item_ids": [line_item_id],
                "severity": _normalize_severity(raw_flag.get("severity")),
                "message": str(raw_flag.get("explanation") or "Potential relationship billing issue."),
                "citation": None,
                "billed_amount": None,
                "benchmark_amount": None,
            }
        )

    return normalized_flags
