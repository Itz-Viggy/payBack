# main.py — FastAPI app entry point.
# Currently: CORS for frontend (localhost:5173), GET /health for setup verification.
# TODO: Add routes and wire up services (upload, analyze, results, dispute case).

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

import asyncio

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

# Pipeline stage index matches the frontend pipelineSteps array:
# 0 = File validated
# 1 = PDF converted
# 2 = Extracting line items
# 3 = Hospital rate lookup
# 4 = Error detection
# 5 = Assembling report
# "done" = complete — frontend navigates away
# "error" = pipeline failed
PIPELINE_STATUS: dict[str, dict] = {}

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
    """
    Accept a bill file, validate + convert it synchronously, then fire the
    full analysis pipeline as a background task.  Returns {billId} immediately
    so the frontend can start polling /bills/{billId}/status.
    """
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

    # Stage 0 (File validated) and Stage 1 (PDF converted) are done synchronously above.
    bill_id = f"bill-{uuid.uuid4().hex[:12]}"
    PIPELINE_STATUS[bill_id] = {"stage": 1, "error": None}

    # Fire the expensive pipeline in the background so the HTTP response returns now.
    asyncio.create_task(
        _run_pipeline(
            bill_id=bill_id,
            converted=converted,
            content=content,
            filename=file.filename or "upload",
            content_type=file.content_type or "application/octet-stream",
        )
    )

    return {"billId": bill_id}


async def _run_pipeline(bill_id: str, converted, content: bytes, filename: str, content_type: str):
    """Background task: runs all analysis layers and writes results to BILLS_STORE."""
    try:
        # Stage 2: Gemini text / image extraction
        PIPELINE_STATUS[bill_id] = {"stage": 2, "error": None}
        try:
            extracted_data = extract_bill(converted.text, converted.images)
        except ExtractionError as exc:
            PIPELINE_STATUS[bill_id] = {"stage": "error", "error": str(exc)}
            return

        print("[gemini] Extraction:\n" + json.dumps(extracted_data, indent=2))

        # Stage 3: Hospital rate lookup (concurrent async benchmarking)
        PIPELINE_STATUS[bill_id] = {"stage": 3, "error": None}
        layer2_payload = await process_entire_bill(extracted_data)
        layer2_payload["diagnosis_codes"] = extracted_data.get("diagnosis_codes") or []
        layer2_payload["state"] = extracted_data.get("state") or ""
        print(f"[medical_db] Benchmarks for bill {bill_id}:\n" + json.dumps(layer2_payload, indent=2))

        # Stage 4: Error detection (deterministic rules engine)
        PIPELINE_STATUS[bill_id] = {"stage": 4, "error": None}
        review_result = run_holistic_review(layer2_payload)
        print(f"[rules_engine] Summary for bill {bill_id}:\n" + json.dumps(review_result["summary"], indent=2))

        # Stage 5: Assembling final report object
        PIPELINE_STATUS[bill_id] = {"stage": 5, "error": None}
        BILLS_STORE[bill_id] = {
            **extracted_data,
            "flags": review_result["flags"],
            "summary": review_result["summary"],
            "benchmarks": layer2_payload.get("audited_items", []),
        }

        # ── Persist to MongoDB ─────────────────────────────────────────────
        raw_ocr_text = converted.text or ""
        hospital_name = extracted_data.get("facility")
        total_billed = extracted_data.get("total_billed")

        estimated_overcharge = 0.0
        for audited in layer2_payload.get("audited_items", []):
            billed_item = audited.get("billed_item", {})
            billed_amount = float(billed_item.get("patient_owed", 0) or 0)
            for bench in audited.get("market_benchmarks", []):
                bench_charge = float(bench.get("standard_charge", 0) or 0)
                if bench_charge > 0 and billed_amount > bench_charge:
                    estimated_overcharge += billed_amount - bench_charge
                    break

        try:
            db_result = await store_bill_analysis(
                file_bytes=content,
                filename=filename,
                content_type=content_type,
                raw_ocr_text=raw_ocr_text,
                extracted_codes=layer2_payload.get("extracted_codes", []),
                standard_charges=layer2_payload.get("standard_charges", []),
                billed_charges=layer2_payload.get("billed_charges", []),
                hospital_name=hospital_name,
                total_billed=total_billed,
                estimated_overcharge=round(estimated_overcharge, 2) if estimated_overcharge else None,
            )
            analysis_id = db_result["bill_analysis_id"]
            print(f"[history] Stored analysis: {analysis_id}")
        except Exception as exc:
            print(f"[history] WARNING — failed to persist: {exc}")
            analysis_id = None

        # Attach the analysisId to the in-memory record so the frontend can read it
        BILLS_STORE[bill_id]["analysisId"] = analysis_id

        # Mark pipeline complete — polling frontend will navigate to /results/{bill_id}
        PIPELINE_STATUS[bill_id] = {"stage": "done", "error": None}

    except Exception as exc:
        print(f"[pipeline] UNHANDLED ERROR for {bill_id}: {exc}")
        PIPELINE_STATUS[bill_id] = {"stage": "error", "error": str(exc)}


@app.get("/bills/{bill_id}/status")
def get_bill_status(bill_id: str):
    """Poll this endpoint to get the real-time pipeline stage for a bill upload."""
    entry = PIPELINE_STATUS.get(bill_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Status not found")
    return entry


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


class GenerateLetterRequest(BaseModel):
    bill_id: str
    selected_item_ids: list[str | int]
    patient_details: dict | None = None
    recipient: str | None = None


@app.post("/api/dispute/generate-letter")
def generate_letter(req: GenerateLetterRequest):
    """Generate a Gemini-powered dispute letter that incorporates rules engine findings."""
    if req.bill_id not in BILLS_STORE:
        raise HTTPException(status_code=404, detail="Bill not found")

    bill = BILLS_STORE[req.bill_id]
    flags = bill.get("flags") or []
    benchmarks = bill.get("benchmarks") or []

    from services.case_builder import build_case_for_gemini
    from services.gemini_service import ExtractionError as LetterError, generate_dispute_letter

    case_data = build_case_for_gemini(
        bill_data=bill,
        selected_item_ids=req.selected_item_ids,
        benchmarks=benchmarks,
        flags=flags,
    )

    patient = req.patient_details or {}
    if patient.get("fullName"):
        case_data["patient_name"] = patient["fullName"]

    account = bill.get("account_number") or ""
    subject = f"Formal Billing Dispute - Acct #{account}" if account else "Formal Billing Dispute"
    recipient = req.recipient or patient.get("billingEmail") or ""

    try:
        letter_text = generate_dispute_letter(case_data)
    except LetterError as exc:
        raise HTTPException(status_code=500, detail=f"Letter generation failed: {exc}") from exc

    return {
        "letterText": letter_text,
        "subject": subject,
        "recipient": recipient,
    }


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
