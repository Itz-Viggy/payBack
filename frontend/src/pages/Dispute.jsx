import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ProgressTracker from '../components/ProgressTracker'
import DisputePanel from '../components/DisputePanel'
import { api } from '../api/client'
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
  const { caseId: billId } = useParams()
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
  const [generateError, setGenerateError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [letterText, setLetterText] = useState('')

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

  const buildLetterText = () => {
    const itemLines = selectedItems
      .map((item) => {
        const line = `${item.cptCode}  ${item.description}  ${formatCurrency(item.billed)}`
        return item.reason && item.reason !== 'Within expected benchmark range.'
          ? `${line}\n    Issue: ${item.reason}`
          : line
      })
      .join('\n')
    return [
      `${patientDetails.fullName || '[PATIENT NAME]'}`,
      `${patientDetails.mailingAddress || '[MAILING ADDRESS]'}`,
      `${patientDetails.state || '[STATE]'}`,
      '',
      formatDateShort(new Date().toISOString()),
      '',
      `To: ${patientDetails.billingEmail || '[HOSPITAL BILLING EMAIL]'}`,
      '',
      `Re: Formal Billing Dispute - Account #${report.accountNumber}`,
      `Date of Service: ${formatDateShort(report.dateOfService)}`,
      '',
      'I am submitting a formal dispute for the following billed services. The identified charges appear materially above benchmark and require itemized justification or adjustment.',
      '',
      itemLines,
      '',
      'Please investigate these charges and issue a corrected statement within a reasonable timeframe. Written response is requested.',
      '',
      'Sincerely,',
      patientDetails.fullName || '[PATIENT NAME]',
    ].join('\n')
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerateError(null)

    if (billId) {
      try {
        const result = await api.generateDisputeLetter({
          billId,
          selectedItemIds,
          patientDetails,
          recipient: patientDetails.billingEmail || 'billing@massgeneralhospital.org',
        })
        const draft = {
          recipient: result.recipient || patientDetails.billingEmail || 'billing@massgeneralhospital.org',
          subject: result.subject || `Formal Billing Dispute - Acct #${report.accountNumber}`,
          selectedItems,
          patientDetails,
          report,
          lawsCited: citedLaws,
          letterText: result.letterText,
        }
        navigate(`/send/${billId}`, { state: { draft } })
        return
      } catch (err) {
        console.warn('[dispute] Gemini letter generation failed, falling back to static template:', err.message)
        setGenerateError(err.message)
      }
    }

    const draft = {
      recipient: patientDetails.billingEmail || 'billing@massgeneralhospital.org',
      subject: `Formal Billing Dispute - Acct #${report.accountNumber}`,
      selectedItems,
      patientDetails,
      report,
      lawsCited: citedLaws,
      letterText,
    }
    navigate(`/send/${billId || 'case'}`, { state: { draft } })
    setIsGenerating(false)
  }

  useEffect(() => {
    if (!isEditing) {
      setLetterText(buildLetterText())
    }
  }, [patientDetails, selectedItems, report, isEditing])

  return (
    <section className="pb-16">
      <ProgressTracker activeStep={3} subLabel="Build your dispute packet and verify letter language." />

      {generateError && (
        <div className="mx-auto mt-4 max-w-[540px] rounded-sharp border border-flag-medium-border bg-flag-medium-dim px-5 py-3">
          <p className="font-mono text-sm text-flag-medium">
            AI letter generation unavailable — using template. ({generateError})
          </p>
        </div>
      )}

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
            <button
              type="button"
              className="btn-ghost text-[11px]"
              onClick={() => {
                if (isEditing) {
                  setIsEditing(false)
                } else {
                  setLetterText(buildLetterText())
                  setIsEditing(true)
                }
              }}
            >
              {isEditing ? 'PREVIEW' : 'EDIT'}
            </button>
          </div>

          {isEditing ? (
            <textarea
              value={letterText}
              onChange={(e) => setLetterText(e.target.value)}
              className="w-full flex-1 resize-none bg-transparent px-7 py-9 font-mono text-[13px] font-light leading-[1.9] text-text-primary outline-none"
              style={{ minHeight: '500px' }}
            />
          ) : (
            <div className="whitespace-pre-wrap px-7 py-9 font-mono text-[13px] font-light leading-[1.9] text-text-primary">
              {letterText}
            </div>
          )}

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
