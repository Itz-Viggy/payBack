import { Fragment, useMemo, useState } from 'react'
import { formatCurrency, formatCurrencyDetailed, formatOvercharge } from '../utils/format'

const severityConfig = {
  high: {
    rowBg: 'bg-flag-high-dim',
    rowBorder: 'border-l-flag-high',
    panelBorder: 'border-l-flag-high',
    badge: 'border-flag-high-border bg-flag-high-dim text-flag-high',
    label: 'HIGH',
  },
  medium: {
    rowBg: 'bg-flag-medium-dim',
    rowBorder: 'border-l-flag-medium',
    panelBorder: 'border-l-flag-medium',
    badge: 'border-flag-medium-border bg-flag-medium-dim text-flag-medium',
    label: 'MEDIUM',
  },
  low: {
    rowBg: 'bg-flag-low-dim',
    rowBorder: 'border-l-flag-low',
    panelBorder: 'border-l-flag-low',
    badge: 'border-flag-low-border bg-flag-low-dim text-flag-low',
    label: 'LOW',
  },
  clear: {
    rowBg: '',
    rowBorder: 'border-l-transparent',
    panelBorder: 'border-l-transparent',
    badge: 'border-transparent bg-transparent text-text-muted',
    label: 'CLEAR',
  },
}

function getOverchargeSeverityClass(markup) {
  if (markup > 3) return 'text-flag-high'
  if (markup > 1.5) return 'text-flag-medium'
  if (markup > 1) return 'text-flag-low'
  return 'text-text-secondary'
}

export default function DecodedBillTable({
  items,
  filter = 'all',
  selectedItemIds,
  onToggleSelect,
}) {
  const [expandedId, setExpandedId] = useState(null)

  const visibleItems = useMemo(() => {
    if (filter === 'flagged') return items.filter((item) => item.severity !== 'clear')
    if (filter === 'clear') return items.filter((item) => item.severity === 'clear')
    return items
  }, [filter, items])

  const toggleExpanded = (item) => {
    if (item.severity === 'clear') return
    setExpandedId((prev) => (prev === item.id ? null : item.id))
  }

  if (!visibleItems.length) {
    return (
      <div className="surface-panel p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">No rows in this filter.</p>
      </div>
    )
  }

  return (
    <div className="surface-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="h-10 border-b border-border-default bg-[rgba(255,255,255,0.01)]">
              <th className="px-5 text-left font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted">CPT Code</th>
              <th className="px-5 text-left font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted">Description</th>
              <th className="px-5 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted">Qty</th>
              <th className="px-5 text-right font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted">Billed</th>
              <th className="px-5 text-right font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted">Benchmark</th>
              <th className="px-5 text-right font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted">Overcharge</th>
              <th className="px-5 text-right font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted">Severity</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => {
              const cfg = severityConfig[item.severity]
              const selected = selectedItemIds.includes(item.id)
              const expanded = expandedId === item.id

              return (
                <Fragment key={item.id}>
                  <tr
                    className={`h-[54px] cursor-pointer border-b border-border-subtle transition ${
                      selected
                        ? 'bg-amber-dim'
                        : item.severity === 'clear'
                          ? 'hover:bg-bg-elevated'
                          : cfg.rowBg
                    }`}
                    onClick={() => toggleExpanded(item)}
                  >
                    <td
                      className={`border-l-[3px] px-5 font-mono text-sm font-semibold ${
                        selected ? 'border-l-amber text-amber' : `${cfg.rowBorder} text-amber`
                      }`}
                    >
                      {item.cptCode}
                    </td>
                    <td className="px-5 font-display text-sm text-text-primary">{item.description}</td>
                    <td className="px-5 text-center font-mono text-sm text-text-code">{item.qty}</td>
                    <td className="px-5 text-right font-mono text-sm text-text-code">
                      {formatCurrency(item.billed)}
                    </td>
                    <td className="px-5 text-right font-mono text-sm text-text-secondary">
                      {formatCurrency(item.benchmark)}
                    </td>
                    <td className={`px-5 text-right font-mono text-sm font-semibold ${getOverchargeSeverityClass(item.markup)}`}>
                      ${formatOvercharge(item.billed, item.benchmark)}
                    </td>
                    <td className="px-5 text-right">
                      {item.severity === 'clear' ? (
                        <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-text-muted">CLEAR</span>
                      ) : (
                        <span
                          className={`rounded-sharp border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.10em] ${cfg.badge}`}
                        >
                          {cfg.label}
                        </span>
                      )}
                    </td>
                  </tr>

                  {expanded ? (
                    <tr className="border-b border-border-subtle bg-bg-surface">
                      <td
                        colSpan={7}
                        className={`border-l-[3px] px-7 py-6 ${selected ? 'border-l-amber' : cfg.panelBorder}`}
                      >
                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">What this means</p>
                            <p className="mt-2 font-display text-sm leading-6 text-text-primary">{item.reason}</p>
                            <p className="mt-2 font-display text-[13px] text-text-secondary">{item.citation}</p>
                          </div>

                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Benchmark</p>
                            <div className="mt-2 space-y-1 font-mono">
                              <p className="text-base font-semibold text-flag-high">
                                Billed: {formatCurrencyDetailed(item.billed)}
                              </p>
                              <p className="text-sm text-text-secondary">
                                Negotiated: {formatCurrencyDetailed(item.negotiated)}
                              </p>
                              <p className="text-xs text-text-muted">
                                Medicare: {formatCurrencyDetailed(item.medicare)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <label className="mt-5 inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => onToggleSelect(item.id)}
                            className="h-4 w-4 accent-amber"
                            onClick={(event) => event.stopPropagation()}
                          />
                          <span className="font-display text-sm text-text-primary">Include in dispute letter</span>
                        </label>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
