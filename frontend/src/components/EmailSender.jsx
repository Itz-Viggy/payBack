import { formatCurrency } from '../utils/format'

export default function EmailSender({
  draft,
  gmailConnection,
  onConnect,
  onSend,
  isSending,
  onCopy,
}) {
  const disputedTotal = draft.selectedItems.reduce((sum, item) => sum + item.billed, 0)

  return (
    <div className="mx-auto w-full max-w-[540px] py-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">READY TO SEND</p>
      <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] text-text-primary sm:text-[52px]">
        Send from your
        <br />
        own Gmail.
      </h1>
      <p className="mt-4 max-w-[500px] font-display text-[15px] leading-7 text-text-secondary">
        The letter arrives from your email address, creating a legal paper trail.
      </p>

      <section className="surface-panel mt-10 p-6">
        {!gmailConnection.connected ? (
          <>
            <div className="flex items-center gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-sharp border border-border-subtle bg-bg-elevated font-mono text-sm text-text-secondary">
                G
              </div>
              <button type="button" className="btn-primary" onClick={onConnect}>
                CONNECT GMAIL
              </button>
            </div>
            <p className="mt-3 font-mono text-[11px] text-text-muted">
              Send-only access. We never read your inbox.
            </p>
          </>
        ) : (
          <>
            <p className="font-mono text-xs font-semibold text-amber">? CONNECTED</p>
            <p className="mt-2 font-mono text-sm text-text-secondary">{gmailConnection.email}</p>
          </>
        )}
      </section>

      <section className="mt-6 rounded-sharp border border-border-subtle bg-bg-surface px-6 py-5">
        <p className="font-mono text-xs leading-8 text-text-secondary">
          TO: {draft.recipient}
          <br />
          SUBJECT: {draft.subject}
          <br />
          DISPUTED: {formatCurrency(disputedTotal)} across {draft.selectedItems.length} items
        </p>
      </section>

      <button
        type="button"
        className="btn-primary mt-6 w-full"
        onClick={onSend}
        disabled={!gmailConnection.connected || isSending}
      >
        {isSending ? 'SENDING...' : 'SEND'}
      </button>

      <div className="mt-3 text-center">
        <button type="button" className="btn-ghost" onClick={onCopy}>
          COPY TO CLIPBOARD INSTEAD
        </button>
      </div>
    </div>
  )
}
