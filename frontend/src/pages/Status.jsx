import { Clock, Mail, AlertCircle } from 'lucide-react'

// Placeholder data for pending disputes
const pendingDisputes = [
  {
    id: 'disp-001',
    hospitalName: 'Massachusetts General Hospital',
    dateSubmitted: '2026-02-18',
    estimatedSavings: 4200,
    status: 'awaiting_response',
    daysWaiting: 3,
  },
  {
    id: 'disp-002',
    hospitalName: 'Boston Medical Center',
    dateSubmitted: '2026-02-10',
    estimatedSavings: 1850,
    status: 'follow_up_sent',
    daysWaiting: 11,
  },
]

const statusConfig = {
  awaiting_response: {
    label: 'Awaiting Response',
    color: 'text-status-pending',
    bg: 'bg-[rgba(140,137,127,0.1)]',
    border: 'border-[rgba(140,137,127,0.25)]',
  },
  follow_up_sent: {
    label: 'Follow-up Sent',
    color: 'text-status-response',
    bg: 'bg-[rgba(107,143,196,0.1)]',
    border: 'border-[rgba(107,143,196,0.25)]',
  },
}

export default function Status() {
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

      {pendingDisputes.length === 0 ? (
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
          {pendingDisputes.map((dispute) => {
            const config = statusConfig[dispute.status]
            return (
              <div
                key={dispute.id}
                className="rounded-lg border border-border-subtle bg-bg-surface p-5 transition-colors hover:border-amber-border"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-base font-semibold text-text-primary">
                      {dispute.hospitalName}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-text-muted">
                      Submitted: {dispute.dateSubmitted}
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
                      {dispute.daysWaiting} days waiting
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber" />
                    <span className="font-mono text-xs text-amber">
                      Est. savings: ${dispute.estimatedSavings.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
