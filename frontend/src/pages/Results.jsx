import { useEffect, useMemo, useState } from 'react'

import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ProgressTracker from '../components/ProgressTracker'
import DecodedBillTable from '../components/DecodedBillTable'
import { api } from '../api/client'
import { formatCurrency, formatDateShort } from '../utils/format'


/* ── helpers to transform backend shapes into component shapes ──────── */

function classifySeverityByMarkup(markup) {
  if (markup > 3) return 'high'
  if (markup > 1.5) return 'medium'
  if (markup > 1) return 'low'
  return 'clear'
}

/** Bump severity when there's a lot of money to save; otherwise returns 'clear' */
function classifySeverityByOvercharge(overcharge) {
  if (overcharge < 0.01) return 'clear'
  if (overcharge >= 200) return 'high'
  if (overcharge >= 50) return 'medium'
  return 'low'
}

const SEVERITY_ORDER = { low: 1, medium: 2, high: 3 }

function pickWorstSeverity(a, b) {
  if (!a || a === 'clear') return b
  if (!b || b === 'clear') return a
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b
}

const SMALL_AMOUNT_THRESHOLD = 25  // below this, unbundling/duplicates → low risk

function buildLineItems(benchmarks, flags) {
  // First pass: compute bestBench per entry
  const rawItems = benchmarks.map((entry, idx) => {
    const item = entry.billed_item || {}
    const benches = entry.market_benchmarks || []
    const bestBench = benches.length
      ? Math.min(...benches.map((b) => parseFloat(b.standard_charge || 0)).filter(Boolean))
      : 0
    return { idx, item, bestBench }
  })

  // Normalize benchmarks for duplicate CPT codes: use min across same-CPT items (avoids different benchmarks for same code)
  const cptToMinBench = {}
  for (const { item, bestBench } of rawItems) {
    if (bestBench <= 0) continue
    const code = item.cpt_code || 'N/A'
    if (!(code in cptToMinBench) || bestBench < cptToMinBench[code]) {
      cptToMinBench[code] = bestBench
    }
  }

  return rawItems.map(({ idx, item, bestBench: rawBench }) => {
    const code = item.cpt_code || 'N/A'
    const bestBench = code in cptToMinBench ? cptToMinBench[code] : rawBench

    const billed = parseFloat(item.patient_owed || item.unit_price || item.total_charge || 0)
    const markup = bestBench > 0 ? +(billed / bestBench).toFixed(2) : 0
    const overcharge = Math.max(0, billed - bestBench)

    const sameValue = bestBench > 0 && Math.abs(billed - bestBench) < 0.01
    const markupSeverity = sameValue ? 'clear' : classifySeverityByMarkup(markup)

    const lineId = item.line_item_id ?? idx + 1
    const matchingFlags = (flags || []).filter((f) =>
      (f.line_item_ids || []).some((fid) => fid == lineId)
    )
    const flagReasons = matchingFlags.map((f) => ({
      rule: f.rule_name || 'suspicious',
      message: f.message || 'Billing rule triggered',
      severity: f.severity || 'medium',
    }))

    const flagSeverity = matchingFlags.length
      ? matchingFlags.reduce((worst, f) => pickWorstSeverity(worst, f.severity || 'medium'), null)
      : null

    const overchargeSeverity = classifySeverityByOvercharge(overcharge)

    // Combine: flags/markup still matter; high overcharge bumps severity to high/medium
    let finalSeverity = pickWorstSeverity(
      pickWorstSeverity(markupSeverity, flagSeverity),
      overchargeSeverity
    ) || markupSeverity

    // Cap at LOW when amount at stake is small (unbundling/duplicates with $25 or less)
    const amountAtStake = Math.max(billed, overcharge)
    if (amountAtStake <= SMALL_AMOUNT_THRESHOLD && finalSeverity !== 'clear') {
      finalSeverity = 'low'
    }

    const primaryReason = flagReasons[0]?.message || (finalSeverity === 'clear' ? 'Within expected benchmark range.' : 'Charge exceeds benchmark.')
    const primaryCitation = matchingFlags[0]?.citation || (finalSeverity === 'clear' ? '' : '')

    return {
      id: `li-${lineId ?? idx + 1}`,
      cptCode: item.cpt_code || 'N/A',
      description: item.description || '',
      qty: item.quantity ?? 1,
      billed,
      benchmark: bestBench,
      markup,
      overcharge,
      severity: finalSeverity,
      flagReasons: flagReasons.length ? flagReasons : null,
      reason: primaryReason,
      citation: primaryCitation,
      negotiated: bestBench,
      medicare: bestBench,
    }
  })
}

function buildReportData(bill, lineItems) {
  const flagged = lineItems.filter((i) => i.severity !== 'clear')
  const overcharge = lineItems.reduce((sum, i) => {
    if (i.benchmark > 0 && i.billed > i.benchmark) return sum + (i.billed - i.benchmark)
    return sum
  }, 0)

  const lineItemsSum = lineItems.reduce((s, i) => s + i.billed, 0)
  const totalBilled = bill.total_patient_billed ?? bill.total_billed ?? lineItemsSum

  return {
    hospitalName: bill.facility || 'Unknown Facility',
    accountNumber: bill.account_number || '\u2014',
    dateOfService: bill.bill_date || '',
    totalBilled,
    totalFromLineItems: !bill.total_patient_billed && !bill.total_billed,
    flagsFound: flagged.length,
    estimatedOvercharge: Math.round(overcharge * 100) / 100,
  }
}


const filterOptions = [
  { id: 'all', label: 'ALL ITEMS' },
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
      </div>
      <p className="mt-2 font-display text-[13px] leading-6 text-text-secondary line-clamp-3">{truncated}</p>
    </button>
  )
}

function PrecedentDetailModal({ precedent, onClose }) {
  if (!precedent) return null
  const { score, payload } = precedent

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
  const { billId, analysisId } = useParams()   // analysisId present on resume flow
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [lineItems, setLineItems] = useState([])
  // Track the MongoDB analysisId so we can advance status on "Build Dispute"
  const [resolvedAnalysisId, setResolvedAnalysisId] = useState(analysisId ?? null)

  const [filter, setFilter] = useState('all')
  const [selectedItemIds, setSelectedItemIds] = useState([])
  const [rerunLoading, setRerunLoading] = useState(false)
  const [rerunError, setRerunError] = useState(null)

  const handleRerunRules = async () => {
    if (!billId) return
    setRerunError(null)
    setRerunLoading(true)
    try {
      const bill = await api.rerunRules(billId)
      const items = buildLineItems(bill.benchmarks || [], bill.flags || [])
      const report = buildReportData(bill, items)
      setLineItems(items)
      setReportData(report)
      setSelectedItemIds(items.filter((i) => i.severity !== 'clear').map((i) => i.id))
    } catch (err) {
      const msg = err.message || 'Re-check failed.'
      setRerunError(msg.includes('not found') || msg.includes('404')
        ? 'Bill session expired. Re-upload the bill to use Re-check rules.'
        : msg)
    } finally {
      setRerunLoading(false)
    }
  }

  /* ── Fetch bill data — supports both new-bill (billId) and resume (analysisId) ── */
  useEffect(() => {
    const id = billId ?? analysisId
    if (!id) {
      setError('No bill ID provided.')
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        let bill

        if (analysisId) {
          // Resume flow: load from MongoDB via analysis_id
          const record = await api.getAnalysis(analysisId)
          // Reshape the flat analysis record into the shape buildLineItems/buildReportData expect.
          // standard_charges is stored as the benchmarks array of arrays; we zip it back into
          // audited_items so the existing helpers can consume it unchanged.
          const auditedItems = (record.extracted_codes || []).map((code, i) => ({
            billed_item: {
              cpt_code: code,
              patient_owed: (record.billed_charges || [])[i] ?? 0,
              description: '',
              line_item_id: i + 1,
            },
            market_benchmarks: (record.standard_charges || [])[i] ?? [],
          }))
          bill = {
            facility: record.hospital_name,
            total_patient_billed: record.total_billed,
            benchmarks: auditedItems,
            flags: [],
          }
          setResolvedAnalysisId(analysisId)
        } else {
          // New-bill flow: load from in-memory BILLS_STORE via bill_id
          bill = await api.getBill(billId)
          // Attach the analysisId that was stored alongside the bill (set by _run_pipeline)
          if (bill.analysisId) setResolvedAnalysisId(bill.analysisId)
        }

        if (cancelled) return

        const items = buildLineItems(bill.benchmarks || [], bill.flags || [])
        const report = buildReportData(bill, items)

        setLineItems(items)
        setReportData(report)
        setSelectedItemIds(items.filter((i) => i.severity !== 'clear').map((i) => i.id))
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load bill data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [billId, analysisId])

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

  const handleBuildDispute = async () => {
    // Advance the state-machine to drafting_dispute so the status dashboard
    // can route the user back to the draft page if they abandon mid-flow.
    if (resolvedAnalysisId) {
      try {
        await api.updateStatus(resolvedAnalysisId, 'drafting_dispute')
      } catch {
        // Non-fatal — proceed regardless
      }
    }
    navigate(`/dispute/${billId ?? resolvedAnalysisId}`, {
      state: {
        report: reportData,
        selectedItems,
        selectedItemIds,
        analysisId: resolvedAnalysisId,
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
    <section className="relative pb-24">
      {rerunLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg-base/95 backdrop-blur-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber border-t-transparent" />
          <p className="font-display text-lg font-semibold text-amber">Re-checking rules…</p>
          <p className="font-mono text-sm text-text-muted">Cross-referencing with AI and precedent data</p>
        </div>
      )}

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
              <p className="mt-0.5 font-mono text-[10px] text-text-muted">
                {reportData.totalFromLineItems ? 'Sum of line items below' : 'From extracted bill'}
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

        {billId && (
          <div className="mt-6 border-t border-border-subtle pt-6">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleRerunRules}
                disabled={rerunLoading}
                className="inline-flex items-center gap-2 rounded-sharp border border-amber px-4 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-amber transition hover:bg-amber-dim active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="text-base">↻</span>
                Re-check rules
              </button>
            </div>
            {rerunError && (
              <p className="mt-3 font-mono text-sm text-flag-high">{rerunError}</p>
            )}
          </div>
        )}
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
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">Top similar cases</p>
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
