"""
history.py — MongoDB Atlas persistence layer for PayBack.

Provides:
  • Async Motor client + GridFS for file storage
  • Pydantic models for request/response validation
  • store_bill_analysis() — callable from main.py after pipeline completes
  • Three FastAPI endpoint handlers:
      POST   /api/history/store              → manual store (file + JSON)
      GET    /api/history/all                → list all analyses joined with dispute status
      PATCH  /api/history/status/{id}        → update dispute lifecycle status
"""

from __future__ import annotations

import json as _json
import os
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

MONGODB_URI = os.getenv("MONGODB_URI")
if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is not set — check backend/.env")

DB_NAME = "payback"

# ---------------------------------------------------------------------------
# Async Motor client + GridFS (initialized once at module import)
# ---------------------------------------------------------------------------
_motor_client: AsyncIOMotorClient = AsyncIOMotorClient(MONGODB_URI)
db = _motor_client[DB_NAME]

bill_analyses_col   = db["bill_analyses"]
dispute_statuses_col = db["dispute_statuses"]

fs_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="bill_files")


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class DisputeStatus(str, Enum):
    pending          = "pending"
    email_sent       = "email_sent"
    waiting_response = "waiting_response"
    denied           = "denied"
    success          = "success"
    closed           = "closed"


class PipelinePayload(BaseModel):
    """JSON body sent alongside the uploaded file."""
    raw_ocr_text: str = Field(..., min_length=1, description="Raw OCR text extracted from the bill")
    extracted_codes: list[str] = Field(..., min_items=1, description="Array of CPT / HCPCS codes")
    standard_charges: list[Any] = Field(..., min_items=1, description="Charges array aligned 1:1 with extracted_codes")
    billed_charges: list[float] = Field(default=[], description="Itemized bill charges from the PDF, aligned 1:1 with extracted_codes")
    hospital_name: str | None = Field(None, description="Hospital name (optional, for dashboard display)")
    total_billed: float | None = Field(None, description="Total amount billed (optional)")
    estimated_overcharge: float | None = Field(None, description="Estimated overcharge (optional)")


class StatusUpdateBody(BaseModel):
    """Body for PATCH status endpoint."""
    status: DisputeStatus


class StoreResponse(BaseModel):
    bill_analysis_id: str
    dispute_status_id: str
    file_id: str


class AnalysisSummary(BaseModel):
    """Shape returned by GET /api/history/all for each record."""
    id: str
    file_id: str
    hospital_name: str | None = None
    total_billed: float | None = None
    estimated_overcharge: float | None = None
    extracted_codes: list[str] = []
    standard_charges: list[Any] = []
    billed_charges: list[float] = []
    status: str = "pending"
    created_at: str
    updated_at: str | None = None


# ---------------------------------------------------------------------------
# Standalone helper — called from main.py after the pipeline finishes
# ---------------------------------------------------------------------------
async def store_bill_analysis(
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str | None,
    raw_ocr_text: str,
    extracted_codes: list[str],
    standard_charges: list[Any],
    billed_charges: list[float],
    hospital_name: str | None = None,
    total_billed: float | None = None,
    estimated_overcharge: float | None = None,
) -> dict:
    """
    Persist a completed pipeline result to MongoDB.

    Returns dict with bill_analysis_id, dispute_status_id, file_id (all strings).
    """
    # 1. Store original file in GridFS
    grid_file_id = await fs_bucket.upload_from_stream(
        filename,
        file_bytes,
        metadata={"content_type": content_type},
    )

    # 2. Insert bill_analyses document
    now = datetime.now(timezone.utc)
    analysis_doc = {
        "file_id": grid_file_id,
        "raw_ocr_text": raw_ocr_text,
        "extracted_codes": extracted_codes,
        "standard_charges": standard_charges,
        "billed_charges": billed_charges,
        "hospital_name": hospital_name,
        "total_billed": total_billed,
        "estimated_overcharge": estimated_overcharge,
        "created_at": now,
    }
    analysis_result = await bill_analyses_col.insert_one(analysis_doc)
    analysis_id = analysis_result.inserted_id

    # 3. Insert linked dispute_statuses document
    status_doc = {
        "bill_analysis_id": analysis_id,
        "status": DisputeStatus.pending.value,
        "updated_at": now,
    }
    status_result = await dispute_statuses_col.insert_one(status_doc)

    return {
        "bill_analysis_id": str(analysis_id),
        "dispute_status_id": str(status_result.inserted_id),
        "file_id": str(grid_file_id),
    }


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------
router = APIRouter(prefix="/api/history", tags=["history"])


# ---------------------------------------------------------------------------
# POST /api/history/store  (manual upload — kept as fallback)
# ---------------------------------------------------------------------------
@router.post("/store", response_model=StoreResponse)
async def store_analysis(
    file: UploadFile = File(...),
    pipeline_json: str = Form(...),
):
    """
    Accept the uploaded bill file AND the JSON pipeline output.
    """
    try:
        raw = _json.loads(pipeline_json)
        payload = PipelinePayload(**raw)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid pipeline_json: {exc}") from exc

    file_content = await file.read()
    result = await store_bill_analysis(
        file_bytes=file_content,
        filename=file.filename or "bill_upload",
        content_type=file.content_type,
        raw_ocr_text=payload.raw_ocr_text,
        extracted_codes=payload.extracted_codes,
        standard_charges=payload.standard_charges,
        billed_charges=payload.billed_charges,
        hospital_name=payload.hospital_name,
        total_billed=payload.total_billed,
        estimated_overcharge=payload.estimated_overcharge,
    )

    return StoreResponse(**result)


# ---------------------------------------------------------------------------
# GET /api/history/all
# ---------------------------------------------------------------------------
@router.get("/all", response_model=list[AnalysisSummary])
async def get_all_analyses():
    """
    Return every bill analysis joined with its current dispute status
    via a MongoDB $lookup aggregation.
    """
    pipeline = [
        {
            "$lookup": {
                "from": "dispute_statuses",
                "localField": "_id",
                "foreignField": "bill_analysis_id",
                "as": "dispute",
            }
        },
        {"$unwind": {"path": "$dispute", "preserveNullAndEmptyArrays": True}},
        {"$sort": {"created_at": -1}},
        {
            "$project": {
                "_id": 1,
                "file_id": 1,
                "hospital_name": 1,
                "total_billed": 1,
                "estimated_overcharge": 1,
                "extracted_codes": 1,
                "standard_charges": 1,
                "billed_charges": 1,
                "created_at": 1,
                "status": {"$ifNull": ["$dispute.status", "pending"]},
                "updated_at": "$dispute.updated_at",
            }
        },
    ]

    results: list[AnalysisSummary] = []
    async for doc in bill_analyses_col.aggregate(pipeline):
        results.append(
            AnalysisSummary(
                id=str(doc["_id"]),
                file_id=str(doc.get("file_id", "")),
                hospital_name=doc.get("hospital_name"),
                total_billed=doc.get("total_billed"),
                estimated_overcharge=doc.get("estimated_overcharge"),
                extracted_codes=doc.get("extracted_codes", []),
                standard_charges=doc.get("standard_charges", []),
                billed_charges=doc.get("billed_charges", []),
                status=doc.get("status", "pending"),
                created_at=doc["created_at"].isoformat() if isinstance(doc.get("created_at"), datetime) else str(doc.get("created_at", "")),
                updated_at=doc["updated_at"].isoformat() if isinstance(doc.get("updated_at"), datetime) else None,
            )
        )
    return results


# ---------------------------------------------------------------------------
# PATCH /api/history/status/{analysis_id}
# ---------------------------------------------------------------------------
@router.patch("/status/{analysis_id}")
async def update_dispute_status(analysis_id: str, body: StatusUpdateBody):
    """
    Update the dispute_statuses document linked to the given bill_analysis_id.
    """
    try:
        oid = ObjectId(analysis_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid analysis_id format")

    result = await dispute_statuses_col.update_one(
        {"bill_analysis_id": oid},
        {
            "$set": {
                "status": body.status.value,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No dispute found for this analysis ID")

    return {"updated": True, "analysis_id": analysis_id, "new_status": body.status.value}
