import { History, CheckCircle, XCircle, DollarSign } from 'lucide-react'

// Placeholder data for closed disputes
const closedDisputes = [
  {
    id: 'hist-001',
    hospitalName: 'Brigham and Women\'s Hospital',
    dateOfService: '2025-11-22',
    dateResolved: '2026-01-15',
    originalBill: 8420,
    finalAmount: 4890,
    savings: 3530,
    status: 'resolved',
  },
  {
    id: 'hist-002',
    hospitalName: 'Beth Israel Deaconess',
    dateOfService: '2025-12-03',
    dateResolved: '2026-02-01',
    originalBill: 3200,
    finalAmount: 2100,
    savings: 1100,
    status: 'resolved',
  },
  {
    id: 'hist-003',
    hospitalName: 'Tufts Medical Center',
    dateOfService: '2025-10-18',
    dateResolved: '2025-12-20',
    originalBill: 5600,
    finalAmount: 5600,
    savings: 0,
    status: 'denied',
  },
]

const statusConfig = {
  resolved: {
    label: 'Resolved',
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
}

export default function HistoryPage() {
  const totalSavings = closedDisputes.reduce((sum, d) => sum + d.savings, 0)
  const resolvedCount = closedDisputes.filter((d) => d.status === 'resolved').length

  return (
    <section className="py-6">
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          DISPUTE HISTORY
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-text-primary">
          Closed Cases
        </h1>
        <p className="mt-2 font-display text-sm text-text-secondary">
          View completed disputes and track your total savings.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-5">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-amber" />
            <span className="font-mono text-xs uppercase text-text-muted">Total Saved</span>
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
            {closedDisputes.length}
          </p>
        </div>
      </div>

      {/* History List */}
      {closedDisputes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border-subtle bg-bg-surface py-16 text-center">
          <History className="h-12 w-12 text-text-muted" />
          <p className="mt-4 font-display text-lg text-text-secondary">
            No closed disputes yet
          </p>
          <p className="mt-1 font-mono text-xs text-text-muted">
            Completed disputes will appear here.
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
                  Date of Service
                </th>
                <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Original
                </th>
                <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Final
                </th>
                <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Saved
                </th>
                <th className="px-5 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-bg-surface">
              {closedDisputes.map((dispute) => {
                const config = statusConfig[dispute.status]
                const StatusIcon = config.icon
                return (
                  <tr key={dispute.id} className="transition-colors hover:bg-bg-elevated">
                    <td className="px-5 py-4">
                      <span className="font-display text-sm text-text-primary">
                        {dispute.hospitalName}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs text-text-secondary">
                        {dispute.dateOfService}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-mono text-sm text-text-secondary">
                        ${dispute.originalBill.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-mono text-sm text-text-primary">
                        ${dispute.finalAmount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`font-mono text-sm font-medium ${
                          dispute.savings > 0 ? 'text-status-resolved' : 'text-text-muted'
                        }`}
                      >
                        ${dispute.savings.toLocaleString()}
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
