import { Link } from 'react-router-dom'

export default function AppShell({ children, contentClassName = '' }) {
  return (
    <div className="app-background">
      <div className="app-shell-content min-h-screen">
        <header className="border-b border-[rgba(232,184,75,0.18)]">
          <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-4 sm:px-8">
            <Link to="/" className="font-display text-lg font-bold">
              <span className="text-text-primary">Pay</span>
              <span className="text-amber">Back</span>
            </Link>
            <p className="font-mono text-xs text-text-secondary">Decode. Dispute. Done.</p>
          </div>
        </header>
        <main className={`mx-auto w-full max-w-[1280px] px-4 pb-16 sm:px-8 ${contentClassName}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
