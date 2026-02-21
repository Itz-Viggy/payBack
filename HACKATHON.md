# PayBack — Hackathon checklist

Use this to split work and track what’s done.

## Setup (everyone)

- [ ] Clone repo, copy `.env.example` → `.env` and `frontend/.env.example` → `frontend/.env`
- [ ] Fill `MONGODB_URI`, `GEMINI_API_KEY`, `VITE_API_BASE_URL=http://localhost:8000`
- [ ] Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
- [ ] Frontend: `cd frontend && npm install && npm run dev`
- [ ] Open http://localhost:5173 and http://localhost:8000/health

## Backend (FastAPI)

- [ ] **Upload route** — accept PDF/image, store in MongoDB, return `billId`
- [ ] **Gemini service** — implement extraction/analysis using `prompts/*.txt`
- [ ] **ORIA / hospital matcher** — use `oria_hospital_index.csv` and oria_db
- [ ] **Rules engine** — flag upcoding, duplicates, unbundling
- [ ] **Case builder** — assemble dispute case from selected flags
- [ ] **Dispute letter** — prompt + email formatter; Gmail send (optional MCP)

## Frontend (React)

- [ ] **API client** — `uploadBill`, `getAnalysisResult`, `buildDisputeCase`, `sendDisputeEmail` in `src/api/client.js`
- [ ] **Upload page** — `BillUploader`, call upload + navigate to Results with `billId`
- [ ] **Results page** — decode table, flags, “Dispute” CTA to Dispute page
- [ ] **Dispute page** — select flags, preview letter, send email; use `DesignDoc.md` for UI

## Data / config

- [ ] **oria_hospital_index.csv** — add real rows or use ORIA API if available
- [ ] **MongoDB** — local instance or Atlas; create DB and collections as needed

## Handoff

- Share repo link; ensure `.env` is **not** committed (use `.env.example` only).
- Design reference: `frontend/DesignDoc.md`. Structure: `Project Structure.md`.
