import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Home,
  Clock,
  History,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/status', label: 'Status', icon: Clock },
  { to: '/history', label: 'History', icon: History },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`relative flex flex-col border-r border-[rgba(232,184,75,0.18)] bg-bg-surface transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center border-b border-[rgba(232,184,75,0.18)] px-4">
        <FileText className="h-6 w-6 shrink-0 text-amber" />
        <span
          className={`ml-3 font-display text-lg font-bold transition-opacity duration-300 ${
            collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
          }`}
        >
          <span className="text-text-primary">Pay</span>
          <span className="text-amber">Back</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="mt-6 flex flex-1 flex-col gap-1 px-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-md px-3 py-2.5 font-display text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-amber-dim text-amber border border-amber-border'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary border border-transparent'
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span
              className={`whitespace-nowrap transition-all duration-300 ${
                collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
              }`}
            >
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Footer tagline */}
      <div
        className={`border-t border-[rgba(232,184,75,0.18)] px-4 py-4 transition-opacity duration-300 ${
          collapsed ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <p className="font-mono text-[10px] text-text-muted">
          Decode. Dispute. Done.
        </p>
      </div>

      {/* Collapse Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-amber-border bg-bg-surface text-amber transition-colors hover:bg-bg-elevated"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  )
}
