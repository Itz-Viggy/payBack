# PayBack Project Structure

```
PayBack/
├── frontend/
│   ├── index.html                       # Vite entry point; loads fonts (Syne, JetBrains Mono) per DesignDoc
│   ├── src/
│   │   ├── App.jsx                      # Root layout and routes: /, /results/:billId, /dispute/:caseId
│   │   ├── main.jsx                     # React entry; mounts App and loads index.css
│   │   ├── index.css                    # Tailwind directives (base, components, utilities)
│   │   ├── components/
│   │   │   ├── BillUploader.jsx         # Drag-and-drop or file-picker for medical bills (PDF/image)
│   │   │   ├── ProgressTracker.jsx     # Step indicator: upload → extraction → flagging → ready
│   │   │   ├── DecodedBillTable.jsx     # Table of parsed line items (codes, descriptions, amounts)
│   │   │   ├── FlagCard.jsx             # Single flagged charge with reason and severity
│   │   │   ├── DisputePanel.jsx         # Review/select flagged items; proceed to build letter
│   │   │   ├── EmailSender.jsx          # Letter preview, recipient fields, send/cancel
│   │   │   └── ConfirmationScreen.jsx   # Success screen after dispute submitted
│   │   ├── pages/
│   │   │   ├── Upload.jsx               # Upload page; BillUploader + analysis trigger → navigate to Results
│   │   │   ├── Results.jsx              # Decoded bill, flags, entry to Dispute flow
│   │   │   └── Dispute.jsx              # Build/review/send dispute letter (DisputePanel, EmailSender)
│   │   └── api/
│   │       └── client.js                # API client; baseURL from VITE_API_BASE_URL; uploadBill, getAnalysisResult, etc.
│   ├── public/                          # Static assets (favicon, images)
│   ├── package.json                     # Dependencies: react, react-router-dom, axios, react-dropzone, react-hot-toast, lucide-react, tailwind, vite
│   ├── vite.config.js                   # Vite + React plugin; dev server port 5173
│   ├── tailwind.config.js               # Tailwind content paths (index.html, src/**)
│   ├── postcss.config.js                # tailwindcss + autoprefixer
│   ├── .env.example                     # VITE_API_BASE_URL template
│   └── .env                             # Local env (gitignored); copy from .env.example
│
├── backend/
│   ├── main.py                          # FastAPI app; CORS, /health; TODO: upload, analyze, dispute, send-email routes
│   ├── services/
│   │   ├── gemini_service.py            # Gemini API: extraction, relationship/unbundling checks, dispute letter
│   │   ├── oria_db.py                   # ORIA dataset queries for fair pricing by procedure/region
│   │   ├── hospital_matcher.py          # Match bill provider to hospital (e.g. oria_hospital_index)
│   │   ├── rules_engine.py              # Billing rules: upcoding, duplicates, unbundling
│   │   ├── case_builder.py              # Build dispute case from selected flags and evidence
│   │   ├── mongo_service.py             # MongoDB: bills, cases, dispute history
│   │   ├── pdf_converter.py             # PDF/image → text or images for Gemini input
│   │   └── email_formatter.py           # Format dispute letter body from case + prompt output
│   ├── prompts/
│   │   ├── extraction.txt               # Extract structured line items from bill text
│   │   ├── relationship_check.txt       # Detect improper provider-relationship billing
│   │   ├── unbundling_check.txt         # Identify unbundled charges that should be billed together
│   │   └── dispute_letter.txt           # Generate professional patient dispute letter
│   ├── data/
│   │   ├── oria_hospital_index.csv      # Hospital → ORIA pricing record mapping
│   │   └── oria_cache/                  # Cached ORIA API responses
│   └── requirements.txt                 # Python deps (FastAPI, uvicorn, Gemini, pymongo, pdf2image, etc.)
│
├── .env.example                         # Root env template (MONGODB_URI, GEMINI_API_KEY, etc.)
├── README.md                            # Overview, prerequisites, setup, architecture, current state
└── HACKATHON.md                         # Checklist for setup, backend/frontend tasks, handoff
``` 
