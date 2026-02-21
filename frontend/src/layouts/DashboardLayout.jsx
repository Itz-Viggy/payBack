import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

export default function DashboardLayout() {
  return (
    <div className="app-background flex min-h-screen">
      {/* Persistent Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* Optional Top Bar (can be expanded later) */}
        <header className="h-16 shrink-0 border-b border-[rgba(232,184,75,0.18)] bg-bg-surface/50 backdrop-blur-sm">
          <div className="flex h-full items-center justify-between px-6">
            <div />
            <p className="font-mono text-xs text-text-secondary">
              Medical Bill Auditor
            </p>
          </div>
        </header>

        {/* Page Content via Outlet */}
        <main className="app-shell-content flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
