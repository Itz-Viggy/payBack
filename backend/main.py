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

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from services.gemini_service import ExtractionError, extract_bill
from services.pdf_converter import (
    ConversionError,
    UnsupportedFileTypeError,
    convert_to_bill_input,
)
from services.medical_db import process_entire_bill
from services.history import router as history_router, store_bill_analysis

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
    BILLS_STORE[bill_id] = extracted_data

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


@app.get("/bills/{bill_id}")
def get_bill(bill_id: str):
    if bill_id not in BILLS_STORE:
        raise HTTPException(status_code=404, detail="Bill not found")
    return BILLS_STORE[bill_id]


# TODO: Add routes for upload, analyze, get results, build dispute case, send email.
# Wire up: gemini_service, oria_db, hospital_matcher, rules_engine, case_builder,
#          mongo_service, pdf_converter, gmail_mcp, email_formatter.
