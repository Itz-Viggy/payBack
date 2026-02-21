import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ProgressTracker from '../components/ProgressTracker'
import DisputePanel from '../components/DisputePanel'
import { formatCurrency, formatDateShort } from '../utils/format'

const fallbackReport = {
  hospitalName: 'Massachusetts General Hospital',
  accountNumber: '8842-JK',
  dateOfService: '2026-01-14',
}

const fallbackItems = [
  {
    id: 'li-1',
    cptCode: '99285',
    description: 'Emergency department visit, level 5',
    billed: 1200,
    citation: 'No Surprises Act, 42 CFR 149.420',
  },
  {
    id: 'li-4',
    cptCode: '96374',
    description: 'Therapeutic intravenous push',
    billed: 2010,
    citation: 'NCCI Policy Manual, Chapter XI',
  },
  {
    id: 'li-9',
    cptCode: '71260',
    description: 'CT thorax with contrast',
    billed: 3560,
    citation: '42 CFR 482.13(b)',
  },
]

export default function Dispute() {
  const navigate = useNavigate()
  const location = useLocation()
  const report = location.state?.report ?? fallbackReport
  const items = location.state?.selectedItems?.length ? location.state.selectedItems : fallbackItems

  const [patientDetails, setPatientDetails] = useState({
    fullName: '',
    mailingAddress: '',
    state: '',
    billingEmail: location.state?.recipient ?? 'billing@massgeneralhospital.org',
  })
  const [selectedItemIds, setSelectedItemIds] = useState(
    location.state?.selectedItemIds?.length ? location.state.selectedItemIds : items.map((item) => item.id)
  )
  const [isGenerating, setIsGenerating] = useState(false)

  const selectedItems = useMemo(
    () => items.filter((item) => selectedItemIds.includes(item.id)),
    [items, selectedItemIds]
  )

  const citedLaws = useMemo(() => {
    const citations = selectedItems.map((item) => item.citation).filter(Boolean)
    return Array.from(new Set(citations))
  }, [selectedItems])

  const handleToggleItem = (itemId) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    )
  }

  const handleGenerate = () => {
    setIsGenerating(true)

    const draft = {
      recipient: patientDetails.billingEmail || 'billing@massgeneralhospital.org',
      subject: `Formal Billing Dispute - Acct #${report.accountNumber}`,
      selectedItems,
      patientDetails,
      report,
      lawsCited: citedLaws,
    }

    window.setTimeout(() => {
      navigate('/send/case-8842-jk', { state: { draft } })
    }, 500)
  }

  const patientName = patientDetails.fullName || '[PATIENT NAME]'
  const patientAddress = patientDetails.mailingAddress || '[MAILING ADDRESS]'
  const patientState = patientDetails.state || '[STATE]'

  const placeholderClass = (value) =>
    value.startsWith('[') ? 'text-amber italic' : 'text-text-primary'

  return (
    <section className="pb-16">
      <ProgressTracker activeStep={3} subLabel="Build your dispute packet and verify letter language." />

      <section className="mt-6 grid gap-10 lg:grid-cols-[52%_48%]">
        <div>
          <DisputePanel
            patientDetails={patientDetails}
            onPatientChange={(patch) => setPatientDetails((prev) => ({ ...prev, ...patch }))}
            items={items}
            selectedItemIds={selectedItemIds}
            onToggleItem={handleToggleItem}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        </div>

        <aside className="surface-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle bg-bg-elevated px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">DISPUTE LETTER DRAFT</p>
            <button type="button" className="btn-ghost text-[11px]">
              EDIT
            </button>
          </div>

          <div className="space-y-6 px-7 py-9 font-mono text-[13px] font-light leading-[1.9] text-text-primary">
            <p>
              <span className={placeholderClass(patientName)}>{patientName}</span>
              <br />
              <span className={placeholderClass(patientAddress)}>{patientAddress}</span>
              <br />
              <span className={placeholderClass(patientState)}>{patientState}</span>
            </p>

            <p>{formatDateShort(new Date().toISOString())}</p>

            <p>To: {patientDetails.billingEmail || '[HOSPITAL BILLING EMAIL]'}</p>

            <p>
              Re: Formal Billing Dispute - Account #{report.accountNumber}
              <br />
              Date of Service: {formatDateShort(report.dateOfService)}
            </p>

            <p>
              I am submitting a formal dispute for the following billed services. The identified charges appear
              materially above benchmark and require itemized justification or adjustment.
            </p>

            <div className="space-y-2">
              {selectedItems.map((item) => (
                <p key={item.id}>
                  <span className="rounded-sharp bg-amber-dim px-1 text-amber">{item.cptCode}</span> {item.description}{' '}
                  <span className="text-flag-high">{formatCurrency(item.billed)}</span>
                </p>
              ))}
            </div>

            <p>
              Please investigate these charges and issue a corrected statement within a reasonable timeframe.
              Written response is requested.
            </p>

            <p>
              Sincerely,
              <br />
              <span className={placeholderClass(patientName)}>{patientName}</span>
            </p>
          </div>

          <div className="border-t border-border-subtle px-5 py-3">
            <p className="font-mono text-[10px] text-text-muted">
              LAWS CITED: {citedLaws.length ? citedLaws.join(' . ') : 'No Surprises Act . 42 CFR 482.13(b)'}
            </p>
          </div>
        </aside>
      </section>
    </section>
  )
}
