import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import ProgressTracker from '../components/ProgressTracker'

const pipelineSteps = [
  'File validated',
  'PDF converted',
  'Extracting line items...',
  'Code classification',
  'Hospital rate lookup',
  'Error detection',
  'Assembling report',
]

export default function Processing() {
  const navigate = useNavigate()
  const { billId } = useParams()
  const location = useLocation()
  const [activeLine, setActiveLine] = useState(0)

  const fileName = location.state?.fileName ?? 'uploaded-bill.pdf'

  useEffect(() => {
    if (!billId) {
      navigate('/', { replace: true })
      return
    }

    let cancelled = false

    const runPipeline = async () => {
      for (let index = 0; index < pipelineSteps.length; index += 1) {
        if (cancelled) return
        setActiveLine(index)
        await new Promise((resolve) => window.setTimeout(resolve, index < 2 ? 500 : 700))
      }

      if (!cancelled) {
        window.setTimeout(() => {
          navigate(`/results/${billId}`, {
            replace: true,
            state: {
              fileName,
            },
          })
        }, 350)
      }
    }

    runPipeline()

    return () => {
      cancelled = true
    }
  }, [billId, fileName, navigate])

  const subLabel = useMemo(() => {
    if (activeLine < 2) return 'Reading your bill...'
    if (activeLine < 5) return 'Matching hospital rates...'
    return 'Assembling report...'
  }, [activeLine])

  return (
    <AppShell>
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
                    <span className="text-amber">?</span>
                  ) : active ? (
                    <span className="animate-pulse-dot text-amber">?</span>
                  ) : (
                    <span className="text-text-muted">•</span>
                  )}

                  <span className={done || active ? 'text-text-code' : 'text-text-muted'}>{line}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </AppShell>
  )
}
