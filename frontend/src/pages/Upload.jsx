import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import BillUploader from '../components/BillUploader'

export default function Upload() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(location.state?.uploadError ?? '')

  const handleFileAccepted = async (file) => {
    setUploadError('')
    setIsUploading(true)

    try {
      navigate('/processing/pending', {
        state: {
          file,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        },
      })
    } catch (error) {
      setUploadError(error.message || 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <AppShell contentClassName="relative">
      <section className="mx-auto flex min-h-[calc(100vh-180px)] max-w-[920px] flex-col items-center justify-center py-16 text-center">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted"
          style={{ animation: 'fadeUp 0.4s ease-out 0.10s both' }}
        >
          MEDICAL BILL AUDITOR
        </p>

        <h1
          className="mt-3 font-display text-5xl font-extrabold leading-[1.02] text-text-primary sm:text-[68px]"
          style={{ animation: 'fadeUp 0.5s ease-out 0.20s both' }}
        >
          Your bill,
          <br />
          decoded.
        </h1>

        <p
          className="mt-4 max-w-[640px] font-display text-[17px] leading-8 text-text-secondary"
          style={{ animation: 'fadeUp 0.4s ease-out 0.35s both' }}
        >
          Upload your itemized bill. We find the errors. You send the letter.
        </p>

        <div className="mt-12" style={{ animation: 'fadeUp 0.4s ease-out 0.45s both' }}>
          <BillUploader onFileAccepted={handleFileAccepted} disabled={isUploading} />
          {uploadError ? (
            <p className="mt-3 text-center font-mono text-xs text-flag-high">{uploadError}</p>
          ) : null}
        </div>

        <div className="mt-16 grid w-full max-w-[760px] grid-cols-1 gap-8 sm:grid-cols-3">
          <div style={{ animation: 'fadeUp 0.4s ease-out 0.55s both' }}>
            <p className="font-mono text-4xl font-semibold text-amber">73%</p>
            <p className="mt-2 font-display text-xs text-text-muted">of bills contain errors</p>
          </div>
          <div
            className="border-y border-border-subtle py-6 sm:border-x sm:border-y-0 sm:py-0"
            style={{ animation: 'fadeUp 0.4s ease-out 0.63s both' }}
          >
            <p className="font-mono text-4xl font-semibold text-amber">$1,300</p>
            <p className="mt-2 font-display text-xs text-text-muted">average overcharge</p>
          </div>
          <div style={{ animation: 'fadeUp 0.4s ease-out 0.71s both' }}>
            <p className="font-mono text-4xl font-semibold text-amber">80%</p>
            <p className="mt-2 font-display text-xs text-text-muted">dispute success rate</p>
          </div>
        </div>
      </section>

      <footer className="pb-4 text-center font-mono text-[11px] text-text-muted">
        Files processed in memory. Nothing is stored.
      </footer>
    </AppShell>
  )
}
