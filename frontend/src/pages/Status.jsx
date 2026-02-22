import { useEffect, useState } from 'react'
import { Clock, Mail, AlertCircle, Loader2 } from 'lucide-react'
import { api } from '../api/client'

const statusConfig = {
  pending: {
    label: 'Pending',
    color: 'text-status-pending',
    bg: 'bg-[rgba(140,137,127,0.1)]',
    border: 'border-[rgba(140,137,127,0.25)]',
  },
  email_sent: {
    label: 'Email Sent',
    color: 'text-status-response',
    bg: 'bg-[rgba(107,143,196,0.1)]',
    border: 'border-[rgba(107,143,196,0.25)]',
  },
  waiting_response: {
    label: 'Awaiting Response',
    color: 'text-status-response',
    bg: 'bg-[rgba(107,143,196,0.1)]',
    border: 'border-[rgba(107,143,196,0.25)]',
  },
}

// Statuses that count as "active / pending"
const ACTIVE_STATUSES = new Set(['pending', 'email_sent', 'waiting_response'])

export default function Status() {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getHistory()
      .then((data) => {
        // Only show active disputes
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
          <p className="mt-4 font-display text-lg text-text-secondary">
            No pending disputes
          </p>
          <p className="mt-1 font-mono text-xs text-text-muted">
            Start a new dispute from the Home page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => {
            const config = statusConfig[dispute.status] || statusConfig.pending
            const createdDate = dispute.created_at ? new Date(dispute.created_at) : null
            const daysWaiting = createdDate
              ? Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000))
              : 0

            return (
              <div
                key={dispute.id}
                className="rounded-lg border border-border-subtle bg-bg-surface p-5 transition-colors hover:border-amber-border"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-base font-semibold text-text-primary">
                      {dispute.hospital_name || 'Unknown Hospital'}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-text-muted">
                      Submitted: {createdDate ? createdDate.toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${config.color} ${config.bg} ${config.border}`}
                  >
                    {config.label}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-text-muted" />
                    <span className="font-mono text-xs text-text-secondary">
                      {daysWaiting} days waiting
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
