import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ProgressTracker from '../components/ProgressTracker'
import { api } from '../api/client'

// These labels must stay in the same order as the stage indices emitted by the backend:
// stage 0 → File validated
// stage 1 → PDF converted
// stage 2 → Extracting line items
// stage 3 → Hospital rate lookup
// stage 4 → Error detection
// stage 5 → Assembling report
const pipelineSteps = [
  'File validated',
  'PDF converted',
  'Extracting line items...',
  'Hospital rate lookup',
  'Error detection',
  'Assembling report',
]

const POLL_INTERVAL_MS = 1500

export default function Processing() {
  const navigate = useNavigate()
  const { billId } = useParams()
  const location = useLocation()

  const [activeLine, setActiveLine] = useState(0)
  const [errorMsg, setErrorMsg] = useState(null)

  const uploadStartedRef = useRef(false)
  const pollTimerRef = useRef(null)

  const pendingFile = location.state?.file
  const fileName = location.state?.fileName ?? 'uploaded-bill.pdf'

  // ── Phase 1: "pending" — fire upload, get billId, then redirect to /processing/{billId}
  useEffect(() => {
    if (billId !== 'pending') return

    if (!pendingFile) {
      navigate('/', {
        replace: true,
        state: { uploadError: 'Upload session expired. Please select the file again.' },
      })
      return
    }

    if (uploadStartedRef.current) return
    uploadStartedRef.current = true

    setActiveLine(0) // File validated (we validated it client-side before navigating here)

    ;(async () => {
      try {
        const response = await api.uploadBill(pendingFile)
        // Backend returns {billId} immediately; pipeline runs in background
        navigate(`/processing/${response.billId}`, {
          replace: true,
          state: { fileName },
        })
      } catch (error) {
        navigate('/', {
          replace: true,
          state: { uploadError: error.message || 'Upload failed. Please try again.' },
        })
      }
    })()
  }, [billId, fileName, navigate, pendingFile])

  // ── Phase 2: real billId — poll /bills/{billId}/status and advance the step card
  useEffect(() => {
    if (billId === 'pending' || !billId) return

    let cancelled = false

    const poll = async () => {
      try {
        const { stage, error } = await api.getBillStatus(billId)

        if (cancelled) return

        if (stage === 'error') {
          setErrorMsg(error || 'An error occurred during processing.')
          return
        }

        if (stage === 'done') {
          // Show all steps as complete briefly before navigating
          setActiveLine(pipelineSteps.length)
          window.setTimeout(() => {
            if (!cancelled) navigate(`/results/${billId}`, { replace: true, state: { fileName } })
          }, 500)
          return
        }

        // stage is a number (0–5) — advance the active step
        setActiveLine(typeof stage === 'number' ? stage : 0)

        // Schedule the next poll
        pollTimerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        if (!cancelled) {
          // Backend might not have the entry yet; retry silently
          pollTimerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS)
        }
      }
    }

    poll()

    return () => {
      cancelled = true
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current)
    }
  }, [billId, fileName, navigate])

  const subLabel =
    activeLine < 2
      ? 'Reading your bill...'
      : activeLine < 4
        ? 'Matching hospital rates...'
        : 'Assembling report...'

  if (errorMsg) {
    return (
      <>
        <ProgressTracker activeStep={1} subLabel="Processing failed" />
        <section className="mt-10 flex flex-col items-center gap-4">
          <p className="font-mono text-sm text-flag-high">{errorMsg}</p>
          <button
            className="font-mono text-xs uppercase tracking-widest text-amber underline"
            onClick={() => navigate('/', { replace: true })}
          >
            Try again
          </button>
        </section>
      </>
    )
  }

  return (
    <>
      <ProgressTracker activeStep={1} subLabel={subLabel} />

      <section className="mt-6 grid gap-12 lg:grid-cols-[55%_45%]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">DOCUMENT</p>
          <div className="mb-4 mt-3 h-px bg-border-subtle" />

          <div className="surface-panel relative h-[520px] overflow-hidden p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[60px] animate-scanline bg-[linear-gradient(to_bottom,transparent,rgba(232,184,75,0.12)_50%,transparent)]" />

            <div className="h-full rounded-sharp border border-border-subtle bg-[rgba(255,255,255,0.02)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">FILE</p>
              <p className="mt-2 font-mono text-sm text-amber">{fileName}</p>
              <div className="mt-6 space-y-3 font-mono text-xs text-text-secondary">
                <p>Hospital statement import complete</p>
                <p>Page segmentation active</p>
                <p>Text and code extraction in progress</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">PIPELINE</p>
          <div className="mb-4 mt-3 h-px bg-border-subtle" />

          <div className="space-y-3 rounded-sharp border border-border-subtle bg-bg-surface p-5">
            {pipelineSteps.map((line, index) => {
              const done = index < activeLine
              const active = index === activeLine

              return (
                <div key={line} className="flex items-center gap-3 font-mono text-[13px]">
                  {done ? (
                    <span className="text-amber" aria-hidden="true">{'\u2713'}</span>
                  ) : active ? (
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber border-t-transparent" />
                    </span>
                  ) : (
                    <span className="text-text-muted" aria-hidden="true">{'\u00B7'}</span>
                  )}

                  <span className={done || active ? 'text-text-code' : 'text-text-muted'}>{line}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}

