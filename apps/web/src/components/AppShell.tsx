import { Outlet, NavLink } from 'react-router-dom'
import styles from './AppShell.module.css'

const NAV_ITEMS = [
  { to: '/',         label: 'Generate' },
  { to: '/library',  label: 'Library'  },
  { to: '/chat',     label: 'Chat'     },
  { to: '/discover', label: 'Discover' },
  { to: '/profile',  label: 'Profile'  },
] as const

export default function AppShell() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>

      <nav className={styles.nav} role="tablist" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            role="tab"
            className={({ isActive }) =>
              [styles.navItem, isActive ? styles.navItemActive : ''].join(' ')
            }
          >
            <NavIcon label={label} />
            <span className={styles.navLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function NavIcon({ label }: { label: string }) {
  // Placeholder SVG icons — Phase 3 will replace with custom designs
  // Generate uses the 3-bar frequency motif per FRONTEND.md
  if (label === 'Generate') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4"  y="14" width="3" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="10" y="10" width="3" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="16" y="6"  width="3" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    )
  }
  if (label === 'Library') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )
  }
  if (label === 'Discover') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M14.5 9.5l-5 2-2 5 5-2 2-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    )
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
