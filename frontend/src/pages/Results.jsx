import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import ProgressTracker from '../components/ProgressTracker'
import DecodedBillTable from '../components/DecodedBillTable'
import { api } from '../api/client'
import { formatCurrency, formatDateShort } from '../utils/format'

const severityBadge = {
  high: 'border-flag-high-border bg-flag-high-dim text-flag-high',
  medium: 'border-flag-medium-border bg-flag-medium-dim text-flag-medium',
  low: 'border-flag-low-border bg-flag-low-dim text-flag-low',
}

const reportData = {
  hospitalName: 'Massachusetts General Hospital',
  accountNumber: '8842-JK',
  dateOfService: '2026-01-14',
  totalBilled: 12840,
  flagsFound: 7,
  estimatedOvercharge: 4200,
}

const lineItems = [
  {
    id: 'li-1',
    cptCode: '99285',
    description: 'Emergency department visit, level 5',
    qty: 1,
    billed: 1200,
    benchmark: 95,
    markup: 12.63,
    severity: 'high',
    reason: 'Visit coded at highest acuity without matching documented complexity.',
    citation: 'No Surprises Act, 42 CFR 149.420',
    negotiated: 420,
    medicare: 180.42,
  },
  {
    id: 'li-2',
    cptCode: '93010',
    description: 'Electrocardiogram interpretation',
    qty: 1,
    billed: 875,
    benchmark: 140,
    markup: 6.25,
    severity: 'medium',
    reason: 'Interpretation fee materially exceeds median negotiated rate benchmark.',
    citation: 'CMS Transparency Rule, 45 CFR 180.50',
    negotiated: 260,
    medicare: 68.12,
  },
  {
    id: 'li-3',
    cptCode: '71045',
    description: 'Chest X-ray, single view',
    qty: 1,
    billed: 1420,
    benchmark: 418,
    markup: 3.4,
    severity: 'low',
    reason: 'Facility charge above expected payer spread for same service profile.',
    citation: 'Mass. Gen. Laws ch. 111M, section 11',
    negotiated: 510,
    medicare: 125.17,
  },
  {
    id: 'li-4',
    cptCode: '96374',
    description: 'Therapeutic intravenous push',
    qty: 1,
    billed: 2010,
    benchmark: 198,
    markup: 10.15,
    severity: 'high',
    reason: 'Infusion administration appears unbundled from adjacent treatment charges.',
    citation: 'NCCI Policy Manual, Chapter XI',
    negotiated: 640,
    medicare: 201.78,
  },
  {
    id: 'li-5',
    cptCode: 'J1885',
    description: 'Injection, ketorolac tromethamine',
    qty: 1,
    billed: 640,
    benchmark: 530,
    markup: 1.21,
    severity: 'clear',
    reason: 'Within expected benchmark range.',
    citation: 'No variance',
    negotiated: 530,
    medicare: 72.02,
  },
  {
    id: 'li-6',
    cptCode: '80053',
    description: 'Comprehensive metabolic panel',
    qty: 1,
    billed: 980,
    benchmark: 181,
    markup: 5.41,
    severity: 'medium',
    reason: 'Lab panel charge significantly above negotiated commercial median.',
    citation: 'CMS Price Transparency Data Dictionary',
    negotiated: 315,
    medicare: 34.24,
  },
  {
    id: 'li-7',
    cptCode: '36415',
    description: 'Collection of venous blood by venipuncture',
    qty: 1,
    billed: 725,
    benchmark: 259,
    markup: 2.8,
    severity: 'low',
    reason: 'Collection fee inflated compared to state-adjusted benchmark.',
    citation: 'State AG billing guidance 2024 update',
    negotiated: 310,
    medicare: 6.93,
  },
  {
    id: 'li-8',
    cptCode: '85025',
    description: 'Complete blood count with differential',
    qty: 1,
    billed: 410,
    benchmark: 372,
    markup: 1.1,
    severity: 'clear',
    reason: 'Within expected benchmark range.',
    citation: 'No variance',
    negotiated: 372,
    medicare: 15.41,
  },
  {
    id: 'li-9',
    cptCode: '71260',
    description: 'CT thorax with contrast',
    qty: 1,
    billed: 3560,
    benchmark: 508,
    markup: 7.01,
    severity: 'medium',
    reason: 'Imaging charge exceeds payer-adjusted benchmark for region and modality.',
    citation: '42 CFR 482.13(b)',
    negotiated: 2050,
    medicare: 294.73,
  },
  {
    id: 'li-10',
    cptCode: '96361',
    description: 'Hydration infusion, each additional hour',
    qty: 1,
    billed: 1020,
    benchmark: 600,
    markup: 1.7,
    severity: 'clear',
    reason: 'Within expected benchmark range.',
    citation: 'No variance',
    negotiated: 600,
    medicare: 52.89,
  },
]

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
  const [filter, setFilter] = useState('all')
  const [selectedItemIds, setSelectedItemIds] = useState(
    lineItems.filter((item) => item.severity !== 'clear').map((item) => item.id)
  )

  const flaggedItems = useMemo(
    () => lineItems.filter((item) => item.severity !== 'clear').slice(0, 3),
    []
  )

  const selectedItems = useMemo(
    () => lineItems.filter((item) => selectedItemIds.includes(item.id)),
    [selectedItemIds]
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
    navigate('/dispute/case-8842-jk', {
      state: {
        report: reportData,
        selectedItems,
        selectedItemIds,
        sourceFileName: location.state?.fileName ?? 'uploaded-bill.pdf',
      },
    })
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
            {billId && (
              <button
                type="button"
                onClick={() => navigate(`/results/${billId}/similar-cases`, { state: { report: reportData } })}
                className="ml-auto rounded-sharp border border-amber-border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.10em] text-amber transition hover:bg-amber-dim"
              >
                VIEW SIMILAR CASES
              </button>
            )}
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
