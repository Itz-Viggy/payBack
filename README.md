# PayBack

Project overview, setup instructions, and architecture summary for the PayBack medical bill analysis and dispute flow.

## Structure

- **frontend/** — React/Vite app: upload bills, view decoded results and flags, build and send dispute emails.
- **backend/** — FastAPI app: bill upload, Gemini extraction & analysis, ORIA benchmarks, rules engine, case building, MongoDB persistence.

## Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.11+ (for backend)
- **MongoDB** (local or Atlas URI)
- **Gemini API key** (for bill extraction/analysis)
- **Optional (backend):** Poppler installed on the system for `pdf2image` (PDF → images). On Windows you may need to install it (e.g. via conda or [poppler-windows](https://github.com/oschwartz10612/poppler-windows)); on macOS: `brew install poppler`. If `python-magic` fails on Windows, try `pip install python-magic-bin` instead.

## Setup (quick start for hackathon)

1. **Clone and env**
   - Copy `.env.example` → `.env` in project root.
   - Copy `frontend/.env.example` → `frontend/.env`.
   - Fill in `MONGODB_URI`, `GEMINI_API_KEY`; set `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env`.

2. **Backend**
   ```bash
   cd backend && pip install -r requirements.txt && uvicorn main:app --reload
   ```
   - API runs at http://localhost:8000. Check http://localhost:8000/health.

3. **Frontend**
   ```bash
   cd frontend && npm install && npm run dev
   ```
   - App runs at http://localhost:5173.

4. **Docs for teammates**
   - `DesignDoc.md` (frontend) — UI/UX and design system.
   - `Project Structure.md` — file layout and responsibilities.

## Architecture

Upload → PDF/image conversion → Gemini extraction → ORIA/hospital matching & rules engine → flagged charges → case builder → dispute letter prompt → email formatter. Bills and cases stored in MongoDB. Users open an email draft or copy to clipboard.

## Current state (hackathon skeleton)

- **Backend:** FastAPI app runs with CORS and `/health`; service modules and routes are stubs — implement in `backend/main.py` and `backend/services/`.
- **Frontend:** React app mounts with routes (`/`, `/results/:billId`, `/dispute/:caseId`); pages and components are stubs — implement per `frontend/DesignDoc.md`.
- **API client:** `frontend/src/api/client.js` — `uploadBill`, `getAnalysisResult`, `getPrecedents`, `searchPrecedents`, etc. using `VITE_API_BASE_URL`.
