import { useEffect, useState } from 'react'
import { History, CheckCircle, XCircle, DollarSign, Clock, Loader2 } from 'lucide-react'
import { api } from '../api/client'

const statusConfig = {
  success: {
    label: 'Resolved',
    icon: CheckCircle,
    color: 'text-status-resolved',
    bg: 'bg-[rgba(90,158,111,0.1)]',
    border: 'border-[rgba(90,158,111,0.25)]',
  },
  closed: {
    label: 'Closed',
    icon: CheckCircle,
    color: 'text-status-resolved',
    bg: 'bg-[rgba(90,158,111,0.1)]',
    border: 'border-[rgba(90,158,111,0.25)]',
  },
  denied: {
    label: 'Denied',
    icon: XCircle,
    color: 'text-status-denied',
    bg: 'bg-[rgba(217,79,79,0.1)]',
    border: 'border-[rgba(217,79,79,0.25)]',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'text-status-pending',
    bg: 'bg-[rgba(140,137,127,0.1)]',
    border: 'border-[rgba(140,137,127,0.25)]',
  },
  email_sent: {
    label: 'Email Sent',
    icon: Clock,
    color: 'text-status-response',
    bg: 'bg-[rgba(107,143,196,0.1)]',
    border: 'border-[rgba(107,143,196,0.25)]',
  },
  waiting_response: {
    label: 'Awaiting Response',
    icon: Clock,
    color: 'text-status-response',
    bg: 'bg-[rgba(107,143,196,0.1)]',
    border: 'border-[rgba(107,143,196,0.25)]',
  },
}

const fallbackConfig = statusConfig.pending

export default function HistoryPage() {
  const [allAnalyses, setAllAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getHistory()
      .then(setAllAnalyses)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const totalSavings = allAnalyses.reduce(
    (sum, d) => sum + (d.estimated_overcharge || 0),
    0
  )
  const resolvedCount = allAnalyses.filter(
    (d) => d.status === 'success' || d.status === 'closed'
  ).length

  return (
    <section className="py-6">
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          DISPUTE HISTORY
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-text-primary">
          All Cases
        </h1>
        <p className="mt-2 font-display text-sm text-text-secondary">
          View all disputes and track your total savings.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-5">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-amber" />
            <span className="font-mono text-xs uppercase text-text-muted">Est. Overcharges</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-amber">
            ${totalSavings.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-status-resolved" />
            <span className="font-mono text-xs uppercase text-text-muted">Resolved</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-status-resolved">
            {resolvedCount}
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-5">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-text-secondary" />
            <span className="font-mono text-xs uppercase text-text-muted">Total Cases</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-text-primary">
            {allAnalyses.length}
          </p>
        </div>
      </div>

      {/* History List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-amber" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-flag-high-border bg-flag-high-dim py-8 text-center">
          <p className="font-mono text-sm text-flag-high">{error}</p>
        </div>
      ) : allAnalyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border-subtle bg-bg-surface py-16 text-center">
          <History className="h-12 w-12 text-text-muted" />
          <p className="mt-4 font-display text-lg text-text-secondary">
            No cases yet
          </p>
          <p className="mt-1 font-mono text-xs text-text-muted">
            Upload a bill from the Home page to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle">
          <table className="w-full">
            <thead className="bg-bg-elevated">
              <tr>
                <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Hospital
                </th>
                <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Date
                </th>
                <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Total Billed
                </th>
                <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Est. Overcharge
                </th>
                <th className="px-5 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Codes
                </th>
                <th className="px-5 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-bg-surface">
              {allAnalyses.map((item) => {
                const config = statusConfig[item.status] || fallbackConfig
                const StatusIcon = config.icon
                const createdDate = item.created_at ? new Date(item.created_at) : null

                return (
                  <tr key={item.id} className="transition-colors hover:bg-bg-elevated">
                    <td className="px-5 py-4">
                      <span className="font-display text-sm text-text-primary">
                        {item.hospital_name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs text-text-secondary">
                        {createdDate ? createdDate.toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-mono text-sm text-text-secondary">
                        {item.total_billed != null ? `$${item.total_billed.toLocaleString()}` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`font-mono text-sm font-medium ${
                          item.estimated_overcharge > 0 ? 'text-flag-high' : 'text-text-muted'
                        }`}
                      >
                        {item.estimated_overcharge != null
                          ? `$${item.estimated_overcharge.toLocaleString()}`
                          : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="font-mono text-xs text-text-secondary">
                        {item.extracted_codes?.length || 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${config.color} ${config.bg} ${config.border}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
