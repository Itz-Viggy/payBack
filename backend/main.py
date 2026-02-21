# main.py — FastAPI app entry point.
# Currently: CORS for frontend (localhost:5173), GET /health for setup verification.
# TODO: Add routes and wire up services (upload, analyze, results, dispute case, send email).

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


# TODO: Add routes for upload, analyze, get results, build dispute case, send email.
# Wire up: gemini_service, oria_db, hospital_matcher, rules_engine, case_builder,
#          mongo_service, pdf_converter, gmail_mcp, email_formatter.
