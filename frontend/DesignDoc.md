# ClearCost — Frontend Design Document
**v1.1 | Hackathon Edition | React + Tailwind**

---

## 0. Design Philosophy

**Aesthetic Direction:** Legal Archive meets Clinical Precision

ClearCost is doing something serious — exposing hospital billing fraud. The design should feel like a **forensic legal tool**: the kind of interface a billing attorney would use. We're pulling from the visual language of government audit documents, law firm letterheads, and financial terminal dashboards.

The tone is: *"We found the errors. Here's the evidence. Send the letter."*

Think: dark, authoritative, expensive-feeling. The UI that makes users feel like they have a lawyer in their pocket. This isn't a wellness app — it's a weapon against predatory billing.

---

## 1. Accent Color Rationale

**Dominant Accent: Warm Amber — `#E8B84B`**

Why amber works here:
- Reads as **money, legal, authority** — the color of a rubber stamp, a wax seal, a redline annotation
- On dark backgrounds it has warmth and gravitas, not aggression
- "Amber alert" connotation is useful — it signals *something was found*
- Pairs naturally with warm off-white text and near-black backgrounds
- Feels like a premium financial tool, not a hackathon demo

---

## 2. Typography

**Font Stack (load from Google Fonts):**

```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=JetBrains+Mono:wght@300;400;600&display=swap" rel="stylesheet">
```

| Role | Font | Weight | Size | Usage |
|------|------|--------|------|-------|
| Display / Hero | **Syne** | 800 | 56–80px | Page titles, hero headers |
| Section Headers | **Syne** | 700 | 24–36px | Section labels, card headers |
| Body / UI Labels | **Syne** | 400 | 14–16px | Body text, form labels, descriptions |
| Code / Data | **JetBrains Mono** | 400 | 12–14px | CPT codes, dollar amounts, account numbers, all data fields |
| Data Headers | **JetBrains Mono** | 600 | 11px | Table column headers (uppercase, letter-spacing: 0.15em) |
| Dispute Letter | **JetBrains Mono** | 300 | 13px | Letter preview — feels like a typed legal document |

**Typography Rules:**
- CPT codes, billing amounts, dates, account numbers → ALWAYS JetBrains Mono
- Flag types and status labels → Syne 700, uppercase, letter-spacing: 0.08em
- Never mix more than these two fonts anywhere in the app
- Line height: 1.2 for display, 1.6 for body, 1.9 for letter preview
- Use extreme weight contrast: 800 hero text next to 300 mono data creates intentional tension

---

## 3. Color System

```css
:root {
  /* === BACKGROUNDS === */
  --bg-primary: #0C0B09;           /* Near-black, warm undertone — pairs with amber */
  --bg-surface: #131210;           /* Card backgrounds, elevated surfaces */
  --bg-elevated: #1C1A17;          /* Hover states, active areas */

  /* === TEXT === */
  --text-primary: #F0EDE6;         /* Warm off-white — cohesive with amber palette */
  --text-secondary: #8C897F;       /* De-emphasized labels, metadata */
  --text-muted: #4C4940;           /* Placeholder text, disabled states */
  --text-code: #C8C2B8;            /* Mono font data — warm tint */

  /* === DOMINANT ACCENT — AMBER === */
  --amber: #E8B84B;
  --amber-dim: rgba(232,184,75,0.10);
  --amber-border: rgba(232,184,75,0.25);
  --amber-glow: rgba(232,184,75,0.06);

  /* === SEVERITY COLORS (muted — serious, not alarming) === */
  --flag-high: #D94F4F;
  --flag-high-dim: rgba(217,79,79,0.10);
  --flag-high-border: rgba(217,79,79,0.28);

  --flag-medium: #D4833A;
  --flag-medium-dim: rgba(212,131,58,0.10);
  --flag-medium-border: rgba(212,131,58,0.28);

  --flag-low: #C4A832;
  --flag-low-dim: rgba(196,168,50,0.08);
  --flag-low-border: rgba(196,168,50,0.25);

  /* === UI CHROME === */
  --border-subtle: rgba(255,255,255,0.05);
  --border-default: rgba(255,255,255,0.10);
  --border-strong: rgba(255,255,255,0.20);

  /* === DASHBOARD STATUS === */
  --status-pending: #8C897F;
  --status-response: #6B8FC4;
  --status-resolved: #5A9E6F;
  --status-denied: #D94F4F;
}
```

**Color Usage Rules:**
- `--amber` is the ONLY bright accent. Use for: primary CTAs, active step markers, selected row states, pipeline checkmarks, section header accents.
- Severity flags use muted red/orange/gold — serious, not alarming. A patient facing a $12,000 bill should feel informed, not panicked.
- Background always has a faint CSS grid. Adds depth without noise.

---

## 4. Background & Atmosphere

```css
.app-background {
  background-color: var(--bg-primary);
  background-image:
    linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* Ambient amber glow — top of page only */
.app-background::before {
  content: '';
  position: fixed;
  top: -240px;
  left: 50%;
  transform: translateX(-50%);
  width: 900px;
  height: 480px;
  background: radial-gradient(ellipse, rgba(232,184,75,0.07) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}
```

**Nav separator:** 1px solid `rgba(232,184,75,0.18)` — warm amber hairline under navbar.

---

## 5. Component System

### 5.1 Buttons

```
PRIMARY (Send Letter, Decode, Generate)
  background: var(--amber)
  color: #0C0B09  (dark on warm — high contrast)
  font: Syne 700, 13px, uppercase, letter-spacing: 0.10em
  border-radius: 2px
  padding: 12px 28px
  hover: brightness(0.88), scale(0.99)
  Flat — no shadow, no gradient

SECONDARY (Back, Cancel)
  background: transparent
  border: 1px solid var(--border-default)
  color: var(--text-secondary)
  hover: border var(--border-strong), color var(--text-primary)

GHOST (minor actions)
  No background, no border
  color: var(--text-secondary)
  Underline on hover only
```

### 5.2 Form Inputs

```
  background: var(--bg-surface)
  border: 1px solid var(--border-subtle)
  border-radius: 2px
  font: JetBrains Mono 400, 14px
  label: Syne 700, 11px, uppercase, letter-spacing: 0.12em, var(--text-secondary)
  focus: border var(--amber), box-shadow 0 0 0 3px var(--amber-dim)
  placeholder: JBMono 400, var(--text-muted)

FILE UPLOAD ZONE:
  border: 2px dashed var(--border-subtle)
  border-radius: 2px
  drag-over: border var(--amber), background var(--amber-dim)
  transition: all 0.2s ease
```

### 5.3 Data Table (Decoded Bill)

```
HEADER ROW:
  JetBrains Mono 600, 11px, uppercase, letter-spacing: 0.15em
  color: var(--text-muted)
  border-bottom: 1px solid var(--border-default)
  padding: 0 20px, height: 40px

COLUMNS:
  1. CPT CODE      — JBMono 600, var(--amber)
  2. DESCRIPTION   — Syne 400, var(--text-primary)
  3. QTY           — JBMono 400, centered
  4. BILLED        — JBMono 400, right-aligned
  5. BENCHMARK     — JBMono 400, right-aligned, var(--text-secondary)
  6. MARKUP        — JBMono 600, color by multiple:
       >10x: var(--flag-high)
       5-10x: var(--flag-medium)
       2-5x: var(--flag-low)
       <2x: var(--text-secondary)
  7. STATUS        — Flag badge (see 5.4)

FLAGGED ROW:
  left-border: 3px solid [severity color]
  background: [severity]-dim
  Static — no animation. The numbers do the work.

SELECTED FOR DISPUTE:
  left-border: 3px solid var(--amber)
  background: var(--amber-dim)

CLEAN ROW HOVER:
  background: var(--bg-elevated)

Row height: 54px | Cell padding: 0 20px
Row divider: 1px solid var(--border-subtle)
```

### 5.4 Flag Badges

```
All badges:
  border-radius: 2px
  font: JetBrains Mono 600, 10px, uppercase, letter-spacing: 0.10em
  padding: 3px 8px
  prefix: "● "

HIGH:   bg flag-high-dim,   border flag-high-border,   text flag-high
MEDIUM: bg flag-medium-dim, border flag-medium-border, text flag-medium
LOW:    bg flag-low-dim,    border flag-low-border,    text flag-low
CLEAR:  no bg, no border,   text var(--text-muted),    "✓ CLEAR"
```

### 5.5 Inline Expand Panel

```
Renders below flagged row on click.
  background: var(--bg-surface)
  border-left: 3px solid [severity color]  (continues row's left border)
  border-bottom/right: 1px solid var(--border-subtle)
  padding: 24px 28px

TWO COLUMNS:
  LEFT:
    JBMono 10px / uppercase / muted: "WHAT THIS MEANS"
    Syne 400 / 14px: plain English explanation
    Syne 400 / 13px / text-secondary: regulatory citation

  RIGHT:
    JBMono 10px / uppercase / muted: "BENCHMARK"
    Billed:     JBMono 600 / 16px / flag-high: "$1,200.00"
    Negotiated: JBMono 400 / 14px / text-secondary: "$420.00 (Blue Cross)"
    Medicare:   JBMono 400 / 13px / text-muted: "$180.42 (CMS)"

BOTTOM:
  Checkbox (amber accent) + Syne 14px: "Include in dispute letter"
```

### 5.6 Progress Tracker

```
Steps: UPLOAD → EXTRACT → DECODE → REVIEW → SEND
Connecting line: 1px solid var(--border-subtle)

ACTIVE dot:   8px, filled var(--amber), pulse animation
DONE dot:     8px, filled var(--text-muted), checkmark label
PENDING dot:  8px, border-only circle, var(--border-default)

Labels:
  Active:       Syne 700, 11px, uppercase, var(--amber)
  Done/Pending: Syne 400, 11px, var(--text-muted)

Sub-label (under active step only):
  JBMono 11px / var(--text-secondary)
  e.g. "Reading your bill..." / "Matching hospital rates..."

@keyframes pulseDot {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50%       { opacity: 1;   transform: scale(1.15); }
}
```

### 5.7 Dispute Letter Preview

```
CONTAINER:
  background: var(--bg-surface)
  border: 1px solid var(--border-default)
  border-radius: 2px

HEADER BAR:
  background: var(--bg-elevated)
  border-bottom: 1px solid var(--border-subtle)
  padding: 10px 20px
  Left: JBMono 600 / 10px / uppercase / muted: "DISPUTE LETTER DRAFT"
  Right: [GHOST BTN] "EDIT"

LETTER BODY:
  font: JetBrains Mono 300, 13px, line-height: 1.9
  color: var(--text-primary)
  padding: 36px 44px

INLINE HIGHLIGHTS:
  CPT codes:             background rgba(232,184,75,0.12), padding 1px 4px, border-radius 2px
  Dollar amounts:        var(--flag-high)
  Legal citations:       var(--amber), no background
  Unfilled placeholders: var(--amber), italic — [PATIENT NAME]

FOOTER STRIP:
  border-top: 1px solid var(--border-subtle)
  padding: 12px 20px
  JBMono 10px / muted: "LAWS CITED: No Surprises Act  ·  42 CFR 482.13(b)  ·  [State Law]"
```

---

## 6. Page-by-Page Design Specs

---

### PAGE 1: Upload (`/upload`)

```
NAV:
  Left:  "ClearCost" — Syne 800, 18px, var(--text-primary)
  Right: "Decode. Dispute. Done." — JBMono 12px / text-secondary
  Separator: 1px solid rgba(232,184,75,0.18)

HERO (centered, padding-top: 15vh):
  JBMono 11px / uppercase / text-muted: "MEDICAL BILL AUDITOR"
  Syne 800 / 68px (mt: 12px): "Your bill,
                                decoded."
  Syne 400 / 17px / text-secondary (mt: 16px):
    "Upload your itemized bill. We find the errors. You send the letter."

UPLOAD ZONE (centered, max-width: 480px, mt: 48px):
  border: 2px dashed var(--border-default), border-radius: 2px
  padding: 48px 32px
  [upload icon, 32px, var(--text-muted)]
  Syne 700 / 17px: "Drop your bill here"
  JBMono 300 / 12px / text-muted (mt: 8px):
    "PDF · JPG · PNG  ·  Max 20MB  ·  Itemized bills only"
  [PRIMARY BTN mt: 24px] "SELECT FILE"

STATS ROW (centered, mt: 64px, vertical hairline dividers):
  JBMono 600 / 38px / amber:    "73%"     "$1,300"           "80%"
  Syne 400 / 12px / text-muted: "of bills  "average overcharge" "dispute success
                                  contain errors"               rate"

FOOTER (fixed bottom, centered):
  JBMono 300 / 11px / text-muted:
  "Files processed in memory. Nothing is stored."
```

**Page load animation (staggered, pure CSS):**
```css
.nav         { animation: fadeUp 0.4s ease-out both; }
.eyebrow     { animation: fadeUp 0.4s ease-out 0.10s both; }
.hero-title  { animation: fadeUp 0.5s ease-out 0.20s both; }
.hero-sub    { animation: fadeUp 0.4s ease-out 0.35s both; }
.upload-zone { animation: fadeUp 0.4s ease-out 0.45s both; }
.stat-1      { animation: fadeUp 0.4s ease-out 0.55s both; }
.stat-2      { animation: fadeUp 0.4s ease-out 0.63s both; }
.stat-3      { animation: fadeUp 0.4s ease-out 0.71s both; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

### PAGE 2: Processing (`/processing`)

```
STEP INDICATOR (full width, below nav, py: 24px):
  [UPLOAD ✓] ── [EXTRACT ●] ── [DECODE] ── [REVIEW] ── [SEND]
                 "Reading your bill..."  ← JBMono 11px / text-secondary

TWO-COLUMN LAYOUT (55/45, mt: 48px, gap: 48px):

LEFT — BILL PREVIEW:
  JBMono 10px / muted / uppercase: "DOCUMENT"
  1px hairline separator, mb: 16px
  Bill thumbnail — position: relative, overflow: hidden
  AMBER SCANLINE OVERLAY (position: absolute, full width):
    background: linear-gradient(to bottom, transparent, rgba(232,184,75,0.12) 50%, transparent)
    height: 60px
    animation: scanline 3s linear infinite

RIGHT — PIPELINE LOG:
  JBMono 10px / muted / uppercase: "PIPELINE"
  1px hairline separator, mb: 16px
  Log lines appear sequentially (JBMono 300 / 13px, gap: 10px):
    [amber] ✓  File validated
    [amber] ✓  PDF converted
    [amber pulsing ●]  Extracting line items...
    [muted]    Code classification
    [muted]    Hospital rate lookup
    [muted]    Error detection
    [muted]    Assembling report
```

---

### PAGE 3: Results (`/results`)

```
REPORT HEADER (full-width, bg-surface, py: 24px, border-bottom: border-subtle):
  LEFT:
    JBMono 10px / muted / uppercase: "BILL ANALYSIS REPORT"
    Syne 700 / 26px: "Massachusetts General Hospital"
    JBMono 12px / text-secondary: "Acct #8842-JK  ·  DOS: Jan 14, 2026"

  RIGHT (3 stat blocks, vertical hairlines between):
    TOTAL BILLED         FLAGS FOUND           EST. OVERCHARGE
    JBMono 600 / 32px    JBMono 600 / 32px     JBMono 600 / 32px
    $12,840              7 [amber]              $4,200 [flag-high]
    JBMono 10px / muted  JBMono 10px / muted    JBMono 10px / muted

FILTER BAR (mt: 24px, mb: 16px):
  [ALL ITEMS] [FLAGGED ONLY] [CLEAN] — JBMono 600 / 11px / uppercase pill toggles
  Active:   bg amber-dim, border amber-border, text amber
  Inactive: border border-subtle, text text-muted

DECODED BILL TABLE — see section 5.3

STICKY BOTTOM BAR (appears when 1+ items selected):
  background: var(--bg-surface)
  border-top: 1px solid var(--amber-border)
  padding: 16px 24px
  Left: JBMono 13px / text-primary: "3 items selected  ·  $2,800 disputed"
  Right: [PRIMARY BTN] "BUILD DISPUTE LETTER"
```

---

### PAGE 4: Dispute Builder (`/dispute`)

```
TWO-COLUMN LAYOUT (52/48, gap: 48px):

LEFT — FORM:
  Section headers: JBMono 10px / uppercase / var(--amber)
  Under each: 1px solid var(--amber-border) hairline

  "PATIENT DETAILS"
    Full Name          [input]
    Mailing Address    [textarea, 3 rows]
    State              [select]

  "DISPUTED ITEMS"
    Compact table — checkbox + CPT + description + billed amount
    All pre-checked. Checkbox accent: var(--amber)

  "DELIVERY"
    Hospital Billing Email  [input]
    JBMono 11px / muted: "Find on your bill or call the billing department."

  [PRIMARY BTN] "GENERATE LETTER →"

RIGHT — LIVE LETTER PREVIEW:
  See section 5.7
  Updates live as form is filled
  Unfilled fields: amber bracketed placeholders [PATIENT NAME]
```

---

### PAGE 5: Send & Confirm (`/send`)

**PRE-SEND:**
```
Centered content, max-width: 540px:

  JBMono 10px / uppercase / muted: "READY TO SEND"
  Syne 800 / 52px: "Send from your
                    own Gmail."
  Syne 400 / 15px / text-secondary:
    "The letter arrives from your email address, creating a legal paper trail."

  GMAIL CONNECT BLOCK (border: border-default, border-radius: 2px, padding: 24px, mt: 40px):
    Not connected:
      [G icon] [PRIMARY BTN] "CONNECT GMAIL"
      JBMono 11px / muted: "Send-only access. We never read your inbox."
    Connected:
      JBMono 600 / amber: "✓ CONNECTED"
      JBMono 12px / text-secondary: "john.doe@gmail.com"

  SEND SUMMARY (bg-surface, border: border-subtle, border-radius: 2px, padding: 20px 24px, mt: 24px):
    JBMono 12px / text-secondary, line-height: 2:
      TO:       billing@massgeneralhospital.org
      SUBJECT:  Formal Billing Dispute — Acct #8842-JK
      DISPUTED: $2,800 across 3 items

  [PRIMARY BTN full-width, mt: 24px] "SEND"
  [GHOST BTN, mt: 12px] "Copy to clipboard instead"
```

**POST-SEND:**
```
  [SVG checkmark — amber stroke, stroke-dashoffset draw animation, 64px]
  Syne 800 / 52px (mt: 24px): "Letter sent."
  JBMono 400 / 13px / text-secondary (mt: 16px, line-height: 2):
    "Sent from john.doe@gmail.com"
    "Feb 19, 2026 at 11:42 AM"
    "A copy is in your Gmail Sent folder."

  [1px amber-border hairline, my: 32px]

  JBMono 10px / uppercase / muted: "WHAT HAPPENS NEXT"
  Syne 400 / 14px / text-secondary (mt: 12px):
    "Hospitals must respond to written billing disputes.
     Expect a reply within 7–14 business days."

  [GHOST BTN mt: 24px] "Track this dispute →"
  [GHOST BTN mt: 8px] "Decode another bill"

CHECKMARK DRAW ANIMATION:
  .checkmark-path {
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: drawCheck 0.6s ease-out 0.2s forwards;
  }
  @keyframes drawCheck {
    to { stroke-dashoffset: 0; }
  }
```

---

### PAGE 6: [OPTIONAL] Dashboard (`/dashboard`)

```
SUMMARY BAR (full-width, bg-surface, py: 24px, border-bottom: border-subtle):
  4 stat blocks with vertical hairline dividers:
  DISPUTES | TOTAL DISPUTED | AMOUNT SAVED | OPEN

DISPUTES TABLE:
  Columns: HOSPITAL | ACCOUNT # | DATE SENT | DISPUTED | STATUS
  Base styles from section 5.3

STATUS BADGES (same structure as section 5.4):
  Pending:          text var(--status-pending)  — muted grey
  Response Recv:    text var(--status-response) — muted blue
  Resolved ✓:       text var(--status-resolved) — muted green
  Denied/Escalate:  text var(--status-denied)   — muted red

SLIDE-OUT DETAIL PANEL (right side, 400px width, triggered by row click):
  background: var(--bg-surface)
  border-left: 1px solid var(--border-default)
  padding: 28px

  Syne 700 / 18px: hospital name
  JBMono 12px / text-secondary: account + date sent
  [1px separator]
  Full letter text (scrollable, JBMono 300 / 12px, max-height: 280px)
  [1px separator]
  Status select dropdown (amber focus)
  Notes textarea (JBMono 13px, 6 rows, placeholder: "What did they say?")
  Amount saved input (visible only when status is Resolved)
  [PRIMARY BTN mt: 16px] "SAVE"
```

---

## 7. Tailwind Configuration

```js
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary':     '#0C0B09',
        'bg-surface':     '#131210',
        'bg-elevated':    '#1C1A17',
        'amber':          '#E8B84B',
        'amber-dim':      'rgba(232,184,75,0.10)',
        'flag-high':      '#D94F4F',
        'flag-medium':    '#D4833A',
        'flag-low':       '#C4A832',
        'text-primary':   '#F0EDE6',
        'text-secondary': '#8C897F',
        'text-muted':     '#4C4940',
        'text-code':      '#C8C2B8',
        'border-subtle':  'rgba(255,255,255,0.05)',
        'border-default': 'rgba(255,255,255,0.10)',
        'border-strong':  'rgba(255,255,255,0.20)',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sharp: '2px',
      },
      animation: {
        'fade-up':    'fadeUp 0.5s ease-out forwards',
        'scanline':   'scanline 3s linear infinite',
        'pulse-dot':  'pulseDot 2s ease-in-out infinite',
        'draw-check': 'drawCheck 0.6s ease-out 0.2s both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%':      { opacity: '1',   transform: 'scale(1.15)' },
        },
        drawCheck: {
          from: { strokeDashoffset: '100' },
          to:   { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
}
```

---

## 8. Suggested Additional Libraries

| Library | Purpose |
|---------|---------|
| `react-dropzone` | Drag-and-drop upload zone |
| `@radix-ui/react-select` | Accessible state/status dropdowns |
| `@radix-ui/react-checkbox` | Accessible dispute item checkboxes |
| `clsx` | Conditional Tailwind class merging |
| `date-fns` | Date formatting for JBMono display |
| `axios` | API client per architecture doc |

---

## 9. Global CSS

```css
/* index.css */
body {
  background-color: #0C0B09;
  color: #F0EDE6;
  font-family: 'Syne', sans-serif;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: #0C0B09; }
::-webkit-scrollbar-thumb { background: #2A2820; border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: #4C4940; }

::selection {
  background: rgba(232,184,75,0.18);
  color: #F0EDE6;
}

*:focus { outline: none; }
*:focus-visible {
  outline: 1px solid rgba(232,184,75,0.5);
  outline-offset: 2px;
}
```

---

## 10. Design Anti-Patterns — Never Use

- `rounded-2xl` or higher — max border-radius is `sharp` (2px)
- Gradient buttons — primary is flat amber on dark, always
- White or light-mode backgrounds anywhere
- `shadow-lg` / `shadow-xl` — use borders for depth instead
- `animate-spin` spinner — use the pipeline log instead
- Inter, Roboto, system-ui, or any other font — Syne and JetBrains Mono only
- Purple, teal, neon green, or bright blue as accent colors
- Emoji in UI chrome — this is a legal tool

---

*ClearCost Design System v1.1 | Hackathon Edition*
*"Every number on a medical bill has a story. Make the fraud legible."*