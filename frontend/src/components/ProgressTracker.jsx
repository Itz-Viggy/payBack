const defaultSteps = ['UPLOAD', 'EXTRACT', 'DECODE', 'REVIEW', 'SEND']

export default function ProgressTracker({ activeStep = 0, subLabel = '' }) {
  return (
    <section className="py-6">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-4">
        {defaultSteps.map((step, index) => {
          const isActive = index === activeStep
          const isDone = index < activeStep

          return (
            <div key={step} className="flex min-w-[110px] flex-1 items-center gap-2 sm:min-w-0">
              <div
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isActive
                    ? 'animate-pulse-dot bg-amber'
                    : isDone
                      ? 'bg-text-muted'
                      : 'border border-border-default bg-transparent'
                }`}
              />
              <span
                className={`font-display text-[11px] uppercase tracking-[0.08em] ${
                  isActive ? 'font-bold text-amber' : isDone ? 'font-medium text-text-muted' : 'text-text-muted'
                }`}
              >
                {step}
                {isDone ? ' ?' : ''}
              </span>
              {index < defaultSteps.length - 1 ? (
                <span className="hidden h-px flex-1 bg-border-subtle sm:block" />
              ) : null}
            </div>
          )
        })}
      </div>

      {subLabel ? <p className="mt-3 font-mono text-[11px] text-text-secondary">{subLabel}</p> : null}
    </section>
  )
}
