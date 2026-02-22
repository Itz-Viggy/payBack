import { formatDateTime } from '../utils/format'

export default function ConfirmationScreen({ receipt, onTrack, onDecodeAnother }) {
  return (
    <div className="mx-auto w-full max-w-[620px] py-16 text-center">
      <svg className="mx-auto h-16 w-16" viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <circle cx="26" cy="26" r="24" stroke="rgba(232,184,75,0.25)" strokeWidth="2" />
        <path
          className="animate-draw-check"
          d="M15 27 L23 35 L38 18"
          stroke="#E8B84B"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeDasharray: 100, strokeDashoffset: 100 }}
        />
      </svg>

      <h1 className="mt-6 font-display text-4xl font-bold sm:text-[52px]">Letter sent.</h1>

      <p className="mt-4 font-mono text-[13px] leading-8 text-text-secondary">
        Sent from {receipt.fromEmail}
        <br />
        {formatDateTime(receipt.sentAt)}
        <br />
        A copy is in your email Sent folder.
      </p>

      <div className="my-8 h-px w-full bg-amber-border" />

      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">WHAT HAPPENS NEXT</p>
      <p className="mx-auto mt-3 max-w-[560px] font-display text-sm leading-7 text-text-secondary">
        Hospitals must respond to written billing disputes. Expect a reply within 7-14 business days.
      </p>

      <div className="mt-6 space-y-3">
        <div>
          <button type="button" className="btn-ghost" onClick={onTrack}>
            TRACK THIS DISPUTE ?
          </button>
        </div>
        <div>
          <button type="button" className="btn-ghost" onClick={onDecodeAnother}>
            DECODE ANOTHER BILL
          </button>
        </div>
      </div>
    </div>
  )
}
