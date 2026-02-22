import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BillUploader from '../components/BillUploader'

export default function Home() {
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
    <section className="flex flex-col items-center justify-center py-12 text-center">
      <p
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber"
        style={{ animation: 'fadeUp 0.4s ease-out 0.10s both' }}
      >
        START A NEW DISPUTE
      </p>

      <h1
        className="mt-3 font-hero text-4xl font-extrabold tracking-tight leading-[1.05] text-text-primary sm:text-5xl"
        style={{ animation: 'fadeUp 0.5s ease-out 0.20s both' }}
      >
        Your bill,
        <br />
        decoded.
      </h1>

      <p
        className="mt-4 max-w-[540px] font-display text-[15px] leading-7 text-text-secondary"
        style={{ animation: 'fadeUp 0.4s ease-out 0.35s both' }}
      >
        Upload your itemized bill. We find the errors. You send the letter.
      </p>

      <div className="mt-10" style={{ animation: 'fadeUp 0.4s ease-out 0.45s both' }}>
        <BillUploader onFileAccepted={handleFileAccepted} disabled={isUploading} />
        {uploadError && (
          <p className="mt-3 text-center font-mono text-xs text-flag-high">{uploadError}</p>
        )}
      </div>

      {/* Stats Row */}
      <div className="mt-14 grid w-full max-w-[680px] grid-cols-1 gap-6 sm:grid-cols-3">
        <div
          className="rounded-lg border border-border-subtle bg-bg-surface p-5"
          style={{ animation: 'fadeUp 0.4s ease-out 0.55s both' }}
        >
          <p className="font-mono text-3xl font-semibold text-amber">80%</p>
          <p className="mt-2 font-display text-xs text-text-muted">of bills contain errors</p>
        </div>
        <div
          className="rounded-lg border border-border-subtle bg-bg-surface p-5"
          style={{ animation: 'fadeUp 0.4s ease-out 0.63s both' }}
        >
          <p className="font-mono text-3xl font-semibold text-amber">$1,300</p>
          <p className="mt-2 font-display text-xs text-text-muted">average overcharge</p>
        </div>
        <div
          className="rounded-lg border border-border-subtle bg-bg-surface p-5"
          style={{ animation: 'fadeUp 0.4s ease-out 0.71s both' }}
        >
          <p className="font-mono text-3xl font-semibold text-amber">80%</p>
          <p className="mt-2 font-display text-xs text-text-muted">dispute success rate</p>
        </div>
      </div>

      <p className="mt-12 font-mono text-[11px] text-text-muted">
        Files processed in memory. Nothing is stored.
      </p>
    </section>
  )
}
