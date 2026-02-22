import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import ProgressTracker from '../components/ProgressTracker'
import EmailSender from '../components/EmailSender'

const fallbackDraft = {
  recipient: 'billing@massgeneralhospital.org',
  subject: 'Formal Billing Dispute - Acct #8842-JK',
  selectedItems: [
    { id: 'li-1', billed: 1200 },
    { id: 'li-4', billed: 2010 },
    { id: 'li-9', billed: 3560 },
  ],
  patientDetails: {
    fullName: 'Patient Name',
  },
  letterText: '',
}

const MAILTO_BODY_LIMIT = 2000

export default function Send() {
  const location = useLocation()
  const draft = location.state?.draft ?? fallbackDraft

  const body = draft.letterText || `Subject: ${draft.subject}\nTo: ${draft.recipient}\n\n[Paste your letter here]`
  const bodyTooLong = body.length > MAILTO_BODY_LIMIT

  const [localTo, setLocalTo] = useState(draft.recipient || '')
  const [localSubject, setLocalSubject] = useState(draft.subject || 'Dispute of Medical Bill – Request for Itemized Statement')
  const [modalOpen, setModalOpen] = useState(false)

  const copyToClipboard = async (text, label) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast.success(`${label} copied to clipboard`)
        return true
      }
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        toast.success(`${label} copied to clipboard`)
        return true
      } finally {
        document.body.removeChild(ta)
      }
    } catch (err) {
      toast.error(`Could not copy ${label}. Try selecting and copying manually.`)
      return false
    }
  }

  const handleCopyRecipient = () => copyToClipboard(localTo, 'Recipient email')
  const handleCopySubject = () => copyToClipboard(localSubject, 'Subject')
  const handleCopyBody = () => copyToClipboard(body, 'Body')

  const handleOpenDraft = () => {
    if (bodyTooLong) {
      setModalOpen(true)
      return
    }
    const encodedSubject = encodeURIComponent(localSubject)
    const encodedBody = encodeURIComponent(body)
    const mailto = `mailto:${encodeURIComponent(localTo)}?subject=${encodedSubject}&body=${encodedBody}`
    window.location.href = mailto
    toast.success('Opened email draft in your mail client')
  }

  const handleOpenDraftFromModal = () => {
    const shortBody = 'Please paste your dispute letter below (copied to clipboard).\n\n'
    const encodedSubject = encodeURIComponent(localSubject)
    const encodedBody = encodeURIComponent(shortBody)
    const mailto = `mailto:${encodeURIComponent(localTo)}?subject=${encodedSubject}&body=${encodedBody}`
    window.location.href = mailto
    copyToClipboard(body, 'Letter body')
    setModalOpen(false)
    toast.success('Opened draft. Paste the letter body from your clipboard.')
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <ProgressTracker activeStep={4} subLabel="Ready to open draft or copy." />

      <EmailSender
        draft={{
          ...draft,
          recipient: localTo,
          subject: localSubject,
          letterText: body,
        }}
        onToChange={setLocalTo}
        onSubjectChange={setLocalSubject}
        onOpenDraft={handleOpenDraft}
        onCopyRecipient={handleCopyRecipient}
        onCopySubject={handleCopySubject}
        onCopyBody={handleCopyBody}
        bodyTooLong={bodyTooLong}
      />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="surface-panel max-h-[85vh] w-full max-w-[600px] overflow-hidden rounded-sharp border border-border-subtle p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">LETTER TOO LONG FOR MAILTO LINK</p>
            <p className="mt-2 font-mono text-sm text-text-secondary">
              Your letter exceeds URL length limits. Copy the body below, then we&apos;ll open your mail client with subject and a short instruction to paste.
            </p>
            <div className="mt-4 max-h-[320px] overflow-y-auto rounded-sharp border border-border-subtle bg-bg-elevated px-4 py-4">
              <pre className="whitespace-pre-wrap font-mono text-[13px] text-text-primary">{body}</pre>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => { handleOpenDraftFromModal(); }}>
                COPY BODY & OPEN DRAFT
              </button>
              <button type="button" className="btn-ghost" onClick={() => copyToClipboard(body, 'Letter body')}>
                COPY BODY ONLY
              </button>
              <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
