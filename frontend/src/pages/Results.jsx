import { useEffect, useMemo, useState } from 'react'

import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ProgressTracker from '../components/ProgressTracker'
import DecodedBillTable from '../components/DecodedBillTable'
import { api } from '../api/client'
import { formatCurrency, formatDateShort } from '../utils/format'


const severityBadge = {
  high: 'border-flag-high-border bg-flag-high-dim text-flag-high',
  medium: 'border-flag-medium-border bg-flag-medium-dim text-flag-medium',
  low: 'border-flag-low-border bg-flag-low-dim text-flag-low',
}

/* ── helpers to transform backend shapes into component shapes ──────── */

function classifySeverity(markup) {
  if (markup >= 10) return 'high'
  if (markup >= 3) return 'medium'
  if (markup >= 1.5) return 'low'
  return 'clear'
}

function buildLineItems(benchmarks, flags) {
  return benchmarks.map((entry, idx) => {
    const item = entry.billed_item || {}
    const benches = entry.market_benchmarks || []

    const billed = parseFloat(item.unit_price || item.total_charge || 0)
    const bestBench = benches.length
      ? Math.min(...benches.map((b) => parseFloat(b.standard_charge || 0)).filter(Boolean))
      : 0
    const markup = bestBench > 0 ? +(billed / bestBench).toFixed(2) : 0
    const severity = classifySeverity(markup)

    // Find the first flag that references this line item
    const lineId = item.line_item_id
    const matchingFlag = flags.find((f) => (f.line_item_ids || []).includes(lineId))

    return {
      id: `li-${lineId ?? idx + 1}`,
      cptCode: item.cpt_code || 'N/A',
      description: item.description || '',
      qty: item.quantity ?? 1,
      billed,
      benchmark: bestBench,
      markup,
      severity: matchingFlag ? matchingFlag.severity || severity : severity,
      reason: matchingFlag?.message || (severity === 'clear' ? 'Within expected benchmark range.' : 'Charge exceeds benchmark.'),
      citation: matchingFlag?.citation || (severity === 'clear' ? 'No variance' : ''),
      negotiated: bestBench,   // best available proxy
      medicare: bestBench,     // best available proxy
    }
  })
}

function buildReportData(bill, lineItems) {
  const flagged = lineItems.filter((i) => i.severity !== 'clear')
  const overcharge = lineItems.reduce((sum, i) => {
    if (i.benchmark > 0 && i.billed > i.benchmark) return sum + (i.billed - i.benchmark)
    return sum
  }, 0)

  return {
    hospitalName: bill.facility || 'Unknown Facility',
    accountNumber: bill.account_number || '—',
    dateOfService: bill.bill_date || '',
    totalBilled: bill.total_billed || lineItems.reduce((s, i) => s + i.billed, 0),
    flagsFound: flagged.length,
    estimatedOvercharge: Math.round(overcharge * 100) / 100,
  }
}


const filterOptions = [
  { id: 'all', label: 'ALL ITEMS' },
  { id: 'flagged', label: 'FLAGGED ONLY' },
  { id: 'clear', label: 'CLEAN' },
]

function buildPrecedentQuery(items) {
  if (!items?.length) return ''
  return items
    .map((item) => [
      item.cptCode,
      item.description,
      item.billed != null ? `$${item.billed}` : '',
      item.benchmark != null ? `benchmark $${item.benchmark}` : '',
    ])
    .flat()
    .filter(Boolean)
    .join(' ')
}

function CompactPrecedentCard({ precedent, onClick }) {
  const { score, payload } = precedent
  const severity = payload?.severity ?? 'low'
  const badge = severityBadge[severity] ?? severityBadge.low
  const summary = payload?.summary ?? ''
  const truncated = summary.length > 80 ? `${summary.slice(0, 80)}…` : summary

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-sharp border border-border-subtle bg-bg-surface p-4 text-left transition hover:border-amber-border hover:bg-amber-dim/30"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sharp border border-amber-border bg-amber-dim px-2 py-0.5 font-mono text-[10px] font-semibold text-amber">
          {Math.round((score ?? 0) * 100)}% MATCH
        </span>
        <span
          className={`rounded-sharp border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.10em] ${badge}`}
        >
          {severity}
        </span>
      </div>
      <p className="mt-2 font-display text-[13px] leading-6 text-text-secondary line-clamp-3">{truncated}</p>
    </button>
  )
}

function PrecedentDetailModal({ precedent, onClose }) {
  if (!precedent) return null
  const { score, payload } = precedent
  const severity = payload?.severity ?? 'low'
  const badge = severityBadge[severity] ?? severityBadge.low

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <article
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sharp border border-border-subtle bg-bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sharp border border-amber-border bg-amber-dim px-2 py-0.5 font-mono text-[10px] font-semibold text-amber">
              {Math.round((score ?? 0) * 100)}% MATCH
            </span>
            <span
              className={`rounded-sharp border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.10em] ${badge}`}
            >
              {severity}
            </span>
            {payload?.issue_type && (
              <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-text-muted">
                {String(payload.issue_type).replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sharp border border-border-default px-3 py-1 font-mono text-[11px] text-text-muted hover:text-text-primary"
          >
            Close
          </button>
        </div>

        {payload?.codes?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {payload.codes.map((code) => (
              <span
                key={code}
                className="rounded-sharp border border-border-default px-1.5 py-0.5 font-mono text-[10px] text-amber"
              >
                {code}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-4 text-[13px] leading-6 text-text-secondary font-display">
          {payload?.summary && (
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">
                Summary
              </p>
              <p>{payload.summary}</p>
            </div>
          )}
          {payload?.recommended_actions && (
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">
                Recommended actions
              </p>
              <p>{payload.recommended_actions}</p>
            </div>
          )}
          {payload?.evidence_requests && (
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">
                Evidence to request
              </p>
              <p>{payload.evidence_requests}</p>
            </div>
          )}
          {payload?.evidence_checklist?.length > 0 && (
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">
                Evidence checklist
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-text-secondary">
                {payload.evidence_checklist.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {payload?.letter_snippet && (
            <div className="rounded-sharp border border-border-subtle bg-bg-base p-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">
                Dispute language
              </p>
              <p className="italic text-text-primary">{payload.letter_snippet}</p>
            </div>
          )}
          {payload?.typical_outcome && (
            <p className="font-mono text-[10px] text-text-muted">Typical outcome: {payload.typical_outcome}</p>
          )}
        </div>

        {payload?.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {payload.tags.map((tag) => (
              <span key={tag} className="rounded-sharp bg-bg-base px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </article>
    </div>
  )
}

export default function Results() {
  const { billId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [lineItems, setLineItems] = useState([])

  const [filter, setFilter] = useState('all')
  const [selectedItemIds, setSelectedItemIds] = useState([])

  /* ── Fetch real bill data from backend ────────────────────────────── */
  useEffect(() => {
    if (!billId) {
      setError('No bill ID provided.')
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const bill = await api.getBill(billId)
        if (cancelled) return

        const items = buildLineItems(bill.benchmarks || [], bill.flags || [])
        const report = buildReportData(bill, items)

        setLineItems(items)
        setReportData(report)
        // Pre-select all flagged items
        setSelectedItemIds(items.filter((i) => i.severity !== 'clear').map((i) => i.id))
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load bill data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [billId])

  const flaggedItems = useMemo(
    () => lineItems.filter((item) => item.severity !== 'clear').slice(0, 3),
    [lineItems]
  )

  const selectedItems = useMemo(
    () => lineItems.filter((item) => selectedItemIds.includes(item.id)),
    [selectedItemIds, lineItems]
  )

  const itemsForPrecedentQuery = useMemo(
    () => (selectedItems.length > 0 ? selectedItems : flaggedItems),
    [selectedItems, flaggedItems]
  )

  const [precedents, setPrecedents] = useState([])
  const [precedentsLoading, setPrecedentsLoading] = useState(false)
  const [precedentsError, setPrecedentsError] = useState(null)
  const [selectedPrecedent, setSelectedPrecedent] = useState(null)

  useEffect(() => {
    const query = buildPrecedentQuery(itemsForPrecedentQuery)
    if (!query.trim()) {
      setPrecedents([])
      setPrecedentsLoading(false)
      setPrecedentsError(null)
      return
    }
    setPrecedentsLoading(true)
    setPrecedentsError(null)
    api
      .searchPrecedents(query, 5)
      .then((res) => setPrecedents(res.precedents ?? []))
      .catch((err) => setPrecedentsError(err.message))
      .finally(() => setPrecedentsLoading(false))
  }, [itemsForPrecedentQuery])

  const selectedDisputeTotal = selectedItems.reduce((sum, item) => sum + item.billed, 0)

  const handleToggleSelection = (itemId) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    )
  }

  const handleBuildDispute = () => {
    navigate(`/dispute/${billId}`, {
      state: {
        report: reportData,
        selectedItems,
        selectedItemIds,
        sourceFileName: location.state?.fileName ?? 'uploaded-bill.pdf',
      },
    })
  }

  /* ── Loading / Error states ──────────────────────────────────────── */
  if (loading) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <p className="animate-pulse font-mono text-sm uppercase tracking-widest text-text-muted">
          Loading analysis…
        </p>
      </section>
    )
  }

  if (error || !reportData) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="font-mono text-sm text-flag-high">{error || 'Bill data not found.'}</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/')}>
          BACK TO HOME
        </button>
      </section>
    )
  }

  return (
    <section className="pb-24">
      <ProgressTracker activeStep={3} subLabel="Flags found. Review evidence and select charges." />

      <section className="surface-panel mt-4 border-border-subtle px-5 py-6 sm:px-8">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">BILL ANALYSIS REPORT</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-text-primary sm:text-[26px]">
              {reportData.hospitalName}
            </h1>
            <p className="mt-2 font-mono text-xs text-text-secondary">
              Acct #{reportData.accountNumber} . DOS: {formatDateShort(reportData.dateOfService)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 text-right sm:grid-cols-3 sm:divide-x sm:divide-border-subtle">
            <div className="sm:px-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Total billed</p>
              <p className="mt-1 font-mono text-3xl font-semibold text-text-primary">
                {formatCurrency(reportData.totalBilled)}
              </p>
            </div>
            <div className="sm:px-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Flags found</p>
              <p className="mt-1 font-mono text-3xl font-semibold text-amber">{reportData.flagsFound}</p>
            </div>
            <div className="sm:px-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Est. overcharge</p>
              <p className="mt-1 font-mono text-3xl font-semibold text-flag-high">
                {formatCurrency(reportData.estimatedOvercharge)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={`rounded-sharp border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.10em] transition ${
                  filter === option.id
                    ? 'border-amber-border bg-amber-dim text-amber'
                    : 'border-border-subtle text-text-muted hover:border-border-default hover:text-text-secondary'
                }`}
              >
                {option.label}
              </button>
            ))}

          </div>

          <DecodedBillTable
            items={lineItems}
            filter={filter}
            selectedItemIds={selectedItemIds}
            onToggleSelect={handleToggleSelection}
          />
        </div>

        <aside className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">Top 5 similar cases</p>
          {itemsForPrecedentQuery.length === 0 && (
            <p className="font-mono text-sm text-text-muted">Select items to find similar cases.</p>
          )}
          {itemsForPrecedentQuery.length > 0 && precedentsLoading && (
            <div className="flex items-center gap-3 py-8">
              <div className="h-6 w-6 flex-shrink-0 animate-spin rounded-full border-2 border-amber border-t-transparent" />
              <span className="font-mono text-sm text-text-muted">Searching precedents...</span>
            </div>
          )}
          {itemsForPrecedentQuery.length > 0 && !precedentsLoading && precedentsError && (
            <div className="rounded-sharp border border-flag-high-border bg-flag-high-dim px-4 py-3">
              <p className="font-mono text-sm text-flag-high">{precedentsError}</p>
            </div>
          )}
          {itemsForPrecedentQuery.length > 0 && !precedentsLoading && !precedentsError && precedents.length === 0 && (
            <p className="font-mono text-sm text-text-muted">No similar cases found.</p>
          )}
          {itemsForPrecedentQuery.length > 0 &&
            !precedentsLoading &&
            !precedentsError &&
            precedents.length > 0 && (
              <div className="space-y-3">
                {precedents.map((p) => (
                  <CompactPrecedentCard
                    key={p.id ?? p.payload?.summary?.slice(0, 30)}
                    precedent={p}
                    onClick={() => setSelectedPrecedent(p)}
                  />
                ))}
              </div>
            )}
        </aside>

        {selectedPrecedent && (
          <PrecedentDetailModal
            precedent={selectedPrecedent}
            onClose={() => setSelectedPrecedent(null)}
          />
        )}
      </section>

      {selectedItemIds.length > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-amber-border bg-bg-surface/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
            <p className="font-mono text-sm text-text-primary">
              {selectedItemIds.length} items selected . {formatCurrency(selectedDisputeTotal)} disputed
            </p>
            <button type="button" className="btn-primary" onClick={handleBuildDispute}>
              BUILD DISPUTE LETTER
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
