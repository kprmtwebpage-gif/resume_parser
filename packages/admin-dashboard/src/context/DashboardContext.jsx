/**
 * DashboardContext
 * ─────────────────────────────────────────────────────────
 * The only thing the AdminDashboard package needs from the host app:
 *   - user       { username: string, role: string }
 *   - onLogout   () => void
 *   - logo       image src (import yourLogo from './logo.png')
 *   - homeHref   URL for "Back to Home" link (default '/')
 *
 * Wrap the AdminDashboard component with DashboardProvider,
 * OR use the <AdminDashboard> convenience wrapper which does this automatically.
 *
 * @example
 * // Option A — convenience wrapper (recommended)
 * <AdminDashboard user={user} onLogout={logout} logo={companyLogo} />
 *
 * // Option B — manual provider
 * <DashboardProvider user={user} onLogout={logout} logo={companyLogo} homeHref="/">
 *   <AdminLayout />
 * </DashboardProvider>
 */

import { createContext, useContext } from 'react'

const DashboardContext = createContext(null)

/**
 * @param {object} props
 * @param {{ username: string, role?: string }} props.user
 * @param {function} props.onLogout
 * @param {string}   [props.logo]      image src
 * @param {string}   [props.homeHref]  default '/'
 * @param {React.ReactNode} props.children
 */
export function DashboardProvider({ user, onLogout, logo, homeHref = '/', children }) {
  return (
    <DashboardContext.Provider value={{ user, onLogout, logo, homeHref }}>
      {children}
    </DashboardContext.Provider>
  )
}

/**
 * Returns { user, onLogout, logo, homeHref } from the nearest DashboardProvider.
 * Throws if used outside a DashboardProvider.
 */
export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used inside a <DashboardProvider>')
  return ctx
}
