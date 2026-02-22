import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Mail, AlertCircle, Loader2, ArrowRight, CheckCircle2, Circle, Loader } from 'lucide-react'
import { api } from '../api/client'

// ── Ordered pipeline steps ─────────────────────────────────────────────────
// Order matters — index determines progress position in the timeline
const PIPELINE_STEPS = [
  {
    key: 'reviewing_markup',
    label: 'Reviewing Charges',
    description: 'Comparing billed codes against market rates',
    resumeLabel: 'Resume Review',
    resumeRoute: (id) => `/results/analysis/${id}`,
  },
  {
    key: 'drafting_dispute',
    label: 'Drafting Letter',
    description: 'Building your dispute letter',
    resumeLabel: 'Resume Draft',
    resumeRoute: (id) => `/draft/${id}`,
  },
  {
    key: 'pending_response',
    label: 'Awaiting Response',
    description: 'Letter sent — waiting on the hospital',
    resumeLabel: null, // terminal action step — no resume button
    resumeRoute: null,
  },
]

const STEP_INDEX = Object.fromEntries(PIPELINE_STEPS.map((s, i) => [s.key, i]))

// Statuses to show on the dashboard
const ACTIVE_STATUSES = new Set(['reviewing_markup', 'drafting_dispute', 'pending_response'])

// ── Timeline component ─────────────────────────────────────────────────────
function PipelineTimeline({ currentStatus }) {
  const currentIdx = STEP_INDEX[currentStatus] ?? 0

  return (
    <div className="mt-5 flex items-start gap-0">
      {PIPELINE_STEPS.map((step, idx) => {
        const done = idx < currentIdx
        const active = idx === currentIdx
        const upcoming = idx > currentIdx
        const isLast = idx === PIPELINE_STEPS.length - 1

        return (
          <div key={step.key} className="flex flex-1 flex-col items-center">
            {/* Row: connector line + dot */}
            <div className="flex w-full items-center">
              {/* Left connector */}
              <div
                className={`h-px flex-1 transition-colors ${
                  idx === 0 ? 'opacity-0' : done || active ? 'bg-amber' : 'bg-border-subtle'
                }`}
              />

              {/* Step dot */}
              <div className="relative flex shrink-0 items-center justify-center">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-amber" strokeWidth={2} />
                ) : active ? (
                  <span className="relative flex h-5 w-5 items-center justify-center">
                    {/* Pulse ring */}
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-30" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-amber" />
                  </span>
                ) : (
                  <Circle className="h-5 w-5 text-border-subtle" strokeWidth={1.5} />
                )}
              </div>

              {/* Right connector */}
              <div
                className={`h-px flex-1 transition-colors ${
                  isLast ? 'opacity-0' : done ? 'bg-amber' : 'bg-border-subtle'
                }`}
              />
            </div>

            {/* Label below dot */}
            <p
              className={`mt-2 text-center font-mono text-[10px] uppercase tracking-[0.10em] leading-tight ${
                done ? 'text-amber' : active ? 'text-amber font-semibold' : 'text-text-muted'
              }`}
            >
              {step.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default function Status() {
  const navigate = useNavigate()
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getHistory()
      .then((data) => {
        setDisputes(data.filter((d) => ACTIVE_STATUSES.has(d.status)))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="py-6">
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          PENDING DISPUTES
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-text-primary">
          Status Tracker
        </h1>
        <p className="mt-2 font-display text-sm text-text-secondary">
          Monitor your active dispute letters and hospital responses.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-amber" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-flag-high-border bg-flag-high-dim py-8 text-center">
          <p className="font-mono text-sm text-flag-high">{error}</p>
        </div>
      ) : disputes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border-subtle bg-bg-surface py-16 text-center">
          <Clock className="h-12 w-12 text-text-muted" />
          <p className="mt-4 font-display text-lg text-text-secondary">No pending disputes</p>
          <p className="mt-1 font-mono text-xs text-text-muted">
            Start a new dispute from the Home page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => {
            const currentStep = PIPELINE_STEPS[STEP_INDEX[dispute.status] ?? 0]
            const createdDate = dispute.created_at ? new Date(dispute.created_at) : null
            const daysWaiting = createdDate
              ? Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000))
              : 0
            const hasResume = !!currentStep?.resumeRoute

            return (
              <div
                key={dispute.id}
                className="rounded-lg border border-border-subtle bg-bg-surface p-5 transition-colors hover:border-amber-border"
              >
                {/* ── Top row: hospital info + Resume button ── */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-semibold text-text-primary">
                      {dispute.hospital_name || 'Unknown Hospital'}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-text-muted">
                      Submitted: {createdDate ? createdDate.toLocaleDateString() : '—'}
                    </p>
                  </div>

                  {hasResume && (
                    <button
                      type="button"
                      onClick={() => navigate(currentStep.resumeRoute(dispute.id))}
                      className="flex shrink-0 items-center gap-1.5 rounded-sharp border border-amber-border bg-amber-dim px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-amber transition hover:bg-amber hover:text-bg-base"
                    >
                      Resume
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* ── Pipeline timeline ── */}
                <PipelineTimeline currentStatus={dispute.status} />

                {/* ── Bottom meta row ── */}
                <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-border-subtle pt-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-text-muted" />
                    <span className="font-mono text-xs text-text-secondary">
                      {daysWaiting} {daysWaiting === 1 ? 'day' : 'days'} since submission
                    </span>
                  </div>
                  {dispute.estimated_overcharge != null && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber" />
                      <span className="font-mono text-xs text-amber">
                        Est. overcharge: ${dispute.estimated_overcharge.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}


