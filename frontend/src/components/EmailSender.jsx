export default function EmailSender({
  draft,
  onToChange,
  onSubjectChange,
  onOpenDraft,
  onCopyRecipient,
  onCopySubject,
  onCopyBody,
  bodyTooLong,
}) {
  return (
    <div className="mx-auto w-full max-w-[540px] py-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">READY TO SEND</p>
      <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] text-text-primary sm:text-[52px]">
        Open in your
        <br />
        email client.
      </h1>
      <p className="mt-4 max-w-[500px] font-display text-[15px] leading-7 text-text-secondary">
        Use your default mail app to send the dispute from your own address.
      </p>

      <section className="surface-panel mt-10 space-y-4 p-6">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">TO</label>
          <div className="mt-1 flex gap-2">
            <input
              type="email"
              value={draft.recipient}
              onChange={(e) => onToChange?.(e.target.value)}
              className="flex-1 rounded-sharp border border-border-subtle bg-bg-surface px-3 py-2 font-display text-sm text-text-primary outline-none focus:border-amber"
              placeholder="billing@hospital.org"
            />
            <button type="button" className="btn-ghost shrink-0" onClick={onCopyRecipient}>
              COPY
            </button>
          </div>
        </div>

        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">SUBJECT</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={draft.subject}
              onChange={(e) => onSubjectChange?.(e.target.value)}
              className="flex-1 rounded-sharp border border-border-subtle bg-bg-surface px-3 py-2 font-display text-sm text-text-primary outline-none focus:border-amber"
              placeholder="Dispute of Medical Bill – Request for Itemized Statement"
            />
            <button type="button" className="btn-ghost shrink-0" onClick={onCopySubject}>
              COPY
            </button>
          </div>
        </div>

        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">BODY (read-only)</label>
          <div className="mt-1 max-h-[200px] overflow-y-auto rounded-sharp border border-border-subtle bg-bg-elevated px-3 py-2">
            <pre className="whitespace-pre-wrap font-display text-[13px] leading-[1.8] text-text-primary">{draft.letterText || '—'}</pre>
          </div>
          <button type="button" className="btn-ghost mt-2" onClick={onCopyBody}>
            COPY BODY
          </button>
        </div>
      </section>

      <button type="button" className="btn-primary mt-6 w-full" onClick={onOpenDraft}>
        OPEN EMAIL DRAFT
      </button>

      {bodyTooLong && (
        <p className="mt-2 font-mono text-[11px] text-amber">
          Body is long; we&apos;ll open a modal to copy and open a draft with instructions.
        </p>
      )}

      <div className="mt-3 text-center">
        <p className="font-mono text-[10px] text-text-muted">Or copy recipient, subject, and body individually above.</p>
      </div>
    </div>
  )
}
