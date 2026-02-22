# main.py — FastAPI app entry point.
# Currently: CORS for frontend (localhost:5173), GET /health for setup verification.
# TODO: Add routes and wire up services (upload, analyze, results, dispute case, send email).

import json
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend dir so GEMINI_API_KEY etc. are in os.environ (works regardless of cwd)
load_dotenv(Path(__file__).resolve().parent / ".env")

# #region agent log
def _debug_log(msg: str, data: dict, hypothesis_id: str = "H1"):
    try:
        log_path = Path(__file__).resolve().parents[1] / "debug-f61d1b.log"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "f61d1b", "location": "main.py", "message": msg, "data": data, "hypothesisId": hypothesis_id, "timestamp": __import__("time").time() * 1000}) + "\n")
    except Exception:
        pass
# #endregion

# Log env state at startup (before any service that reads GEMINI_API_KEY)
_env_key_set = bool(os.getenv("GEMINI_API_KEY"))
_backend_dir = Path(__file__).resolve().parent
_env_exists = (_backend_dir / ".env").exists()
# #region agent log
_debug_log("startup env check", {"cwd": os.getcwd(), "backend_dir": str(_backend_dir), "dotenv_exists": _env_exists, "GEMINI_API_KEY_set": _env_key_set}, "H1")
# #endregion

from pydantic import BaseModel

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from services.gemini_service import ExtractionError, extract_bill
from services.pdf_converter import (
    ConversionError,
    UnsupportedFileTypeError,
    convert_to_bill_input,
)
from services.precedent_service import PrecedentServiceError, search_precedents
from services.medical_db import process_entire_bill
from services.history import router as history_router, store_bill_analysis
from services.rules_engine import run_holistic_review

app = FastAPI(title="PayBack API", version="0.1.0")
BILLS_STORE: dict[str, dict] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── History / MongoDB persistence routes ─────────────────────
app.include_router(history_router)


@app.get("/health")
def health():
    """Health check for hackathon setup verification."""
    return {"status": "ok", "service": "PayBack API"}


@app.post("/bills/upload")
async def upload_bill(file: UploadFile = File(...)):
    """Upload a bill file, run the full pipeline, and persist results to MongoDB."""
    content = await file.read()

    try:
        converted = convert_to_bill_input(
            content=content,
            filename=file.filename or "upload",
            content_type=file.content_type,
        )
    except UnsupportedFileTypeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Use PDF, JPG, or PNG only.",
        ) from exc
    except ConversionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not converted.text and not converted.images:
        raise HTTPException(status_code=400, detail="File is empty or could not be read.")

    # Debug: print what was extracted (backend console)
    print("--- [upload] extraction result ---")
    if converted.text:
        print(f"[upload] Extracted text ({len(converted.text)} chars):\n{converted.text}")
    else:
        n = len(converted.images or [])
        total_bytes = sum(len(img) for img in (converted.images or []))
        print(f"[upload] Extracted {n} image(s), {total_bytes} bytes total (mime={converted.image_mime})")

    bill_id = f"bill-{uuid.uuid4().hex[:12]}"
    try:
        extracted_data = extract_bill(converted.text, converted.images)
    except ExtractionError as exc:
        raise HTTPException(status_code=500, detail=f"Gemini extraction failed: {exc}") from exc

    print("[gemini] Extraction:\n" + json.dumps(extracted_data, indent=2))

    # Process the entire bill using the medical DB service (for benchmarking, etc.)
    benchmarks = process_entire_bill(extracted_data)
    print(f"[medical_db] Benchmarks for bill {bill_id}:\n" + json.dumps(benchmarks, indent=2))

    # ── Persist to MongoDB ────────────────────────────────────────────────
    raw_ocr_text = converted.text or ""
    hospital_name = extracted_data.get("facility")
    total_billed = extracted_data.get("total_billed")

    # Calculate estimated overcharge from benchmarks
    estimated_overcharge = 0.0
    for i, billed in enumerate(benchmarks.get("billed_charges", [])):
        sc_list = benchmarks.get("standard_charges", [])[i] if i < len(benchmarks.get("standard_charges", [])) else []
        if sc_list:
            best_benchmark = min(
                (float(s.get("standard_charge", 0)) for s in sc_list if s.get("standard_charge")),
                default=0,
            )
            if best_benchmark > 0 and billed > best_benchmark:
                estimated_overcharge += billed - best_benchmark

    try:
        db_result = await store_bill_analysis(
            file_bytes=content,
            filename=file.filename or "upload",
            content_type=file.content_type,
            raw_ocr_text=raw_ocr_text,
            extracted_codes=benchmarks.get("extracted_codes", []),
            standard_charges=benchmarks.get("standard_charges", []),
            billed_charges=benchmarks.get("billed_charges", []),
            hospital_name=hospital_name,
            total_billed=total_billed,
            estimated_overcharge=round(estimated_overcharge, 2) if estimated_overcharge else None,
        )
        print(f"[history] Stored analysis: {db_result['bill_analysis_id']}")
    except Exception as exc:
        # Don't fail the upload if DB persistence fails — log and continue
        print(f"[history] WARNING — failed to persist: {exc}")
        db_result = None

    return {
        "billId": bill_id,
        "analysisId": db_result["bill_analysis_id"] if db_result else None,
    }
    layer2_payload = process_entire_bill(extracted_data)
    layer2_payload["diagnosis_codes"] = extracted_data.get("diagnosis_codes") or []
    layer2_payload["state"] = extracted_data.get("state") or ""
    print(f"[medical_db] Benchmarks for bill {bill_id}:\n" + json.dumps(layer2_payload, indent=2))

    # Layer 3: holistic findings from deterministic rules + Gemini relationship checks.
    review_result = run_holistic_review(layer2_payload)
    print(f"[rules_engine] Summary for bill {bill_id}:\n" + json.dumps(review_result["summary"], indent=2))

    BILLS_STORE[bill_id] = {
        **extracted_data,
        "flags": review_result["flags"],
        "summary": review_result["summary"],
        "benchmarks": layer2_payload.get("audited_items", []),
    }
    
    return {"billId": bill_id}


@app.get("/bills/{bill_id}")
def get_bill(bill_id: str):
    if bill_id not in BILLS_STORE:
        raise HTTPException(status_code=404, detail="Bill not found")
    return BILLS_STORE[bill_id]


def _line_item_query_text(item: dict) -> str:
    """Build a short query string from a line item for precedent similarity search."""
    parts = [
        item.get("description") or "",
        f"CPT {item.get('cpt_code') or 'N/A'}",
        f"quantity {item.get('quantity', '')}",
        f"patient owed {item.get('patient_owed', '')}",
        f"unit price {item.get('unit_price', '')}",
        f"total {item.get('total_charge', '')}",
    ]
    return " ".join(str(p).strip() for p in parts if p).strip() or "medical bill line item"


@app.get("/bills/{bill_id}/precedents")
def get_bill_precedents(bill_id: str, top_k: int = 5):
    """
    For each line item in the bill, run precedent similarity search and return
    similar historical cases (id, score, payload). Payload schema: issue_type,
    setting, codes, severity, recommended_actions, evidence_requests,
    evidence_checklist, letter_snippet, typical_outcome (optional), tags (optional).
    Only the precedent's summary is embedded; payload is returned as stored.
    Requires VectorAI DB running at localhost:50051 and precedents collection seeded.
    """
    if bill_id not in BILLS_STORE:
        raise HTTPException(status_code=404, detail="Bill not found")
    bill = BILLS_STORE[bill_id]
    line_items = bill.get("line_items") or []
    if not line_items:
        return {"line_items": []}

    try:
        enriched = []
        for item in line_items:
            query_text = _line_item_query_text(item)
            precedents = search_precedents(query_text, top_k=max(1, min(top_k, 20)))
            enriched.append({
                "line_item_id": item.get("line_item_id"),
                "cpt_code": item.get("cpt_code"),
                "description": item.get("description"),
                "precedents": precedents,
            })
        return {"line_items": enriched}
    except PrecedentServiceError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Precedent search unavailable. Ensure VectorAI DB is running at localhost:50051 and precedents are seeded. {exc!s}",
        ) from exc


class PrecedentSearchRequest(BaseModel):
    query: str
    top_k: int = 5


@app.post("/precedents/search")
def search_precedents_endpoint(req: PrecedentSearchRequest):
    """
    Search precedents by free-form query text. Returns top_k similar cases.
    No dependency on BILLS_STORE; works with any query string.
    """
    try:
        precedents = search_precedents(
            req.query.strip() or "medical bill line item",
            top_k=max(1, min(req.top_k, 20)),
        )
        return {"precedents": precedents}
    except PrecedentServiceError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Precedent search unavailable. Ensure VectorAI DB is running at localhost:50051 and precedents are seeded. {exc!s}",
        ) from exc


# TODO: Add routes for upload, analyze, get results, build dispute case, send email.
# Wire up: gemini_service, oria_db, hospital_matcher, rules_engine, case_builder,
#          mongo_service, pdf_converter, gmail_mcp, email_formatter.
