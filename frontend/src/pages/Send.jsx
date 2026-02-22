import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ProgressTracker from '../components/ProgressTracker'
import EmailSender from '../components/EmailSender'
import ConfirmationScreen from '../components/ConfirmationScreen'

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
}

export default function Send() {
  const navigate = useNavigate()
  const location = useLocation()
  const draft = location.state?.draft ?? fallbackDraft

  const [gmailConnection, setGmailConnection] = useState({
    connected: false,
    email: '',
  })
  const [isSending, setIsSending] = useState(false)
  const [sendReceipt, setSendReceipt] = useState(null)

  const handleConnect = () => {
    setGmailConnection({ connected: true, email: 'john.doe@gmail.com' })
  }

  const handleSend = () => {
    if (!gmailConnection.connected || isSending) return

    setIsSending(true)
    window.setTimeout(() => {
      setSendReceipt({
        sent: true,
        sentAt: new Date().toISOString(),
        fromEmail: gmailConnection.email,
      })
      setIsSending(false)
    }, 900)
  }

  const handleCopy = async () => {
    const body = `Subject: ${draft.subject}\nTo: ${draft.recipient}`
    try {
      await navigator.clipboard.writeText(body)
    } catch {
      // Clipboard can be blocked in some browsers or localhost contexts.
    }
  }

  return (
    <>
      <ProgressTracker activeStep={4} subLabel={sendReceipt ? 'Dispute delivered.' : 'Ready for final send.'} />

      {!sendReceipt ? (
        <EmailSender
          draft={draft}
          gmailConnection={gmailConnection}
          onConnect={handleConnect}
          onSend={handleSend}
          isSending={isSending}
          onCopy={handleCopy}
        />
      ) : (
        <ConfirmationScreen
          receipt={sendReceipt}
          onTrack={() => navigate('/results/bill-8842-jk')}
          onDecodeAnother={() => navigate('/')}
        />
      )}
    </>
  )
}
