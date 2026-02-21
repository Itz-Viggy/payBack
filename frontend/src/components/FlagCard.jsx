import { formatCurrency, formatMarkup } from '../utils/format'

const severityStyles = {
  high: {
    badge: 'border-flag-high-border bg-flag-high-dim text-flag-high',
    border: 'border-l-flag-high',
    label: 'HIGH',
  },
  medium: {
    badge: 'border-flag-medium-border bg-flag-medium-dim text-flag-medium',
    border: 'border-l-flag-medium',
    label: 'MEDIUM',
  },
  low: {
    badge: 'border-flag-low-border bg-flag-low-dim text-flag-low',
    border: 'border-l-flag-low',
    label: 'LOW',
  },
}

export default function FlagCard({ item }) {
  const style = severityStyles[item.severity] ?? severityStyles.low

  return (
    <article className={`rounded-sharp border border-border-subtle border-l-[3px] bg-bg-surface p-4 ${style.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.12em] text-amber">{item.cptCode}</p>
          <h3 className="mt-1 font-display text-sm text-text-primary">{item.description}</h3>
        </div>
        <span
          className={`rounded-sharp border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.10em] ${style.badge}`}
        >
          ? {style.label}
        </span>
      </div>

      <p className="mt-3 font-display text-[13px] leading-6 text-text-secondary">{item.reason}</p>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 font-mono text-xs text-text-code">
        <span>BILLED {formatCurrency(item.billed)}</span>
        <span>BENCHMARK {formatCurrency(item.benchmark)}</span>
        <span>MARKUP {formatMarkup(item.markup)}</span>
      </div>
    </article>
  )
}
