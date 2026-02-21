# main.py — FastAPI app entry point.
# Currently: CORS for frontend (localhost:5173), GET /health for setup verification.
# TODO: Add routes and wire up services (upload, analyze, results, dispute case, send email).

import uuid

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from services.pdf_converter import (
    ConversionError,
    UnsupportedFileTypeError,
    convert_to_bill_input,
)

app = FastAPI(title="PayBack API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Health check for hackathon setup verification."""
    return {"status": "ok", "service": "PayBack API"}


@app.post("/bills/upload")
async def upload_bill(file: UploadFile = File(...)):
    """Upload a bill file and convert it into Gemini-ready input."""
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
        snippet = converted.text[:500] + ("..." if len(converted.text) > 500 else "")
        print(f"[upload] Extracted text ({len(converted.text)} chars):\n{snippet}")
    else:
        n = len(converted.images or [])
        total_bytes = sum(len(img) for img in (converted.images or []))
        print(f"[upload] Extracted {n} image(s), {total_bytes} bytes total (mime={converted.image_mime})")

    bill_id = f"bill-{uuid.uuid4().hex[:12]}"
    return {"billId": bill_id}


# TODO: Add routes for upload, analyze, get results, build dispute case, send email.
# Wire up: gemini_service, oria_db, hospital_matcher, rules_engine, case_builder,
#          mongo_service, pdf_converter, gmail_mcp, email_formatter.
