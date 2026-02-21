import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import ProgressTracker from '../components/ProgressTracker'
import { api } from '../api/client'

const severityBadge = {
  high: 'border-flag-high-border bg-flag-high-dim text-flag-high',
  medium: 'border-flag-medium-border bg-flag-medium-dim text-flag-medium',
  low: 'border-flag-low-border bg-flag-low-dim text-flag-low',
}

function ScoreBadge({ score }) {
  const pct = Math.round(score * 100)
  return (
    <span className="rounded-sharp border border-amber-border bg-amber-dim px-2 py-0.5 font-mono text-[10px] font-semibold text-amber">
      {pct}% MATCH
    </span>
  )
}

function PrecedentCard({ precedent, onAddToLetter }) {
  const { score, payload } = precedent
  const severity = payload.severity ?? 'low'
  const badge = severityBadge[severity] ?? severityBadge.low

  return (
    <article className="rounded-sharp border border-border-subtle bg-bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ScoreBadge score={score} />
          <span className={`rounded-sharp border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.10em] ${badge}`}>
            {severity}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-text-muted">
            {payload.issue_type?.replace(/_/g, ' ')}
          </span>
        </div>
        <span className="font-mono text-[10px] text-text-muted">{payload.setting}</span>
      </div>

      {payload.codes?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {payload.codes.map((code) => (
            <span key={code} className="rounded-sharp border border-border-default px-1.5 py-0.5 font-mono text-[10px] text-amber">
              {code}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3 text-[13px] leading-6 text-text-secondary font-display">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">Recommended actions</p>
          <p>{payload.recommended_actions}</p>
        </div>

        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">Evidence to request</p>
          <p>{payload.evidence_requests}</p>
        </div>

        {payload.evidence_checklist?.length > 0 && (
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">Evidence checklist</p>
            <ul className="list-inside list-disc space-y-0.5 text-text-secondary">
              {payload.evidence_checklist.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-sharp border border-border-subtle bg-bg-base p-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">Dispute language</p>
          <p className="italic text-text-primary">{payload.letter_snippet}</p>
        </div>

        {payload.typical_outcome && (
          <p className="font-mono text-[10px] text-text-muted">
            Typical outcome: {payload.typical_outcome}
          </p>
        )}
      </div>

      {payload.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {payload.tags.map((tag) => (
            <span key={tag} className="rounded-sharp bg-bg-base px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onAddToLetter(payload.letter_snippet)}
        className="mt-4 rounded-sharp border border-amber-border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.10em] text-amber transition hover:bg-amber-dim"
      >
        + Add to letter
      </button>
    </article>
  )
}

function LineItemSection({ lineItem, onAddToLetter }) {
  const [expanded, setExpanded] = useState(true)
  const precedents = lineItem.precedents ?? []

  return (
    <div className="rounded-sharp border border-border-subtle bg-bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <span className="font-mono text-xs font-semibold tracking-[0.12em] text-amber">
            {lineItem.cpt_code ?? 'N/A'}
          </span>
          <span className="ml-3 font-display text-sm text-text-primary">
            {lineItem.description ?? 'Line item'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-text-muted">
            {precedents.length} match{precedents.length !== 1 ? 'es' : ''}
          </span>
          <span className="text-text-muted">{expanded ? '−' : '+'}</span>
        </div>
      </button>

      {expanded && precedents.length > 0 && (
        <div className="space-y-3 border-t border-border-subtle px-5 py-4">
          {precedents.map((p) => (
            <PrecedentCard key={p.id} precedent={p} onAddToLetter={onAddToLetter} />
          ))}
        </div>
      )}

      {expanded && precedents.length === 0 && (
        <div className="border-t border-border-subtle px-5 py-4">
          <p className="font-mono text-xs text-text-muted">No similar precedents found.</p>
        </div>
      )}
    </div>
  )
}

export default function SimilarCases() {
  const { billId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [letterSnippets, setLetterSnippets] = useState([])

  useEffect(() => {
    if (!billId) return
    setLoading(true)
    setError(null)
    api
      .getPrecedents(billId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [billId])

  const handleAddToLetter = useCallback((snippet) => {
    setLetterSnippets((prev) => (prev.includes(snippet) ? prev : [...prev, snippet]))
  }, [])

  const lineItems = data?.line_items ?? []

  return (
    <AppShell contentClassName="pb-24">
      <ProgressTracker activeStep={3} subLabel="Similar historical cases for your bill." />

      <section className="surface-panel mt-4 border-border-subtle px-5 py-6 sm:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">PRECEDENT SEARCH</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-text-primary sm:text-[26px]">
              Similar Cases
            </h1>
            {billId && (
              <p className="mt-1 font-mono text-xs text-text-secondary">Bill {billId}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-sharp border border-border-default px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.10em] text-text-secondary transition hover:text-text-primary"
          >
            Back to results
          </button>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber border-t-transparent" />
            <span className="ml-3 font-mono text-sm text-text-muted">Searching precedents...</span>
          </div>
        )}

        {error && (
          <div className="rounded-sharp border border-flag-high-border bg-flag-high-dim px-5 py-4">
            <p className="font-mono text-sm text-flag-high">{error}</p>
          </div>
        )}

        {!loading && !error && lineItems.length === 0 && (
          <div className="rounded-sharp border border-border-subtle bg-bg-surface px-5 py-8 text-center">
            <p className="font-mono text-sm text-text-muted">No line items found for this bill.</p>
          </div>
        )}

        {!loading && !error && lineItems.map((li) => (
          <LineItemSection
            key={li.line_item_id ?? li.cpt_code}
            lineItem={li}
            onAddToLetter={handleAddToLetter}
          />
        ))}
      </section>

      {letterSnippets.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-amber-border bg-bg-surface/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
            <p className="font-mono text-sm text-text-primary">
              {letterSnippets.length} snippet{letterSnippets.length !== 1 ? 's' : ''} added to letter
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                navigate(location.state?.disputePath ?? '/dispute', {
                  state: { ...location.state, letterSnippets },
                })
              }
            >
              BUILD DISPUTE LETTER
            </button>
          </div>
        </div>
      )}
    </AppShell>
  )
}
