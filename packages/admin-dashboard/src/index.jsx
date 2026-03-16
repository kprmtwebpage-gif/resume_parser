/**
 * @kprmt/admin-dashboard — Main Entry Point
 * ─────────────────────────────────────────────────────────
 * USAGE
 * ─────
 * 1. Install peer deps:
 *    npm install react react-dom react-router-dom recharts lucide-react tailwindcss
 *
 * 2. Install this package (local):
 *    # In your project's package.json:
 *    "@kprmt/admin-dashboard": "file:../../packages/admin-dashboard"
 *    # Then: npm install
 *
 * 3. Add the Tailwind theme tokens (optional but recommended):
 *    // tailwind.config.cjs
 *    const { themeExtension } = require('@kprmt/admin-dashboard/theme')
 *    module.exports = { theme: { extend: themeExtension } }
 *
 * 4. Mount inside your react-router BrowserRouter at /admin:
 *    // App.jsx
 *    import AdminDashboard from '@kprmt/admin-dashboard'
 *    import companyLogo from './assets/logo.png'
 *
 *    <Route path="/admin/*" element={
 *      <AdminDashboard
 *        user={{ username: 'Vamshi K', role: 'admin' }}
 *        onLogout={() => { doLogout(); navigate('/login') }}
 *        logo={companyLogo}
 *        homeHref="/"
 *      />
 *    } />
 *
 *    This mounts:
 *      /admin/               → Overview (KPI cards, charts, user performance)
 *      /admin/upload-metrics → Upload Metrics (per-user upload analytics)
 *      /admin/users          → Users Management
 *      /admin/activity       → Activity Log
 *
 * EXPORTS
 * ───────
 * Default: AdminDashboard          — ready-made wrapper (recommended)
 * Named:   DashboardProvider       — manual context wrapper
 *          useDashboard            — context hook
 *          AdminLayout             — sidebar + header shell
 *          DashboardOverview       — overview page
 *          UploadMetrics           — upload metrics page
 *          UsersManagement         — user CRUD page
 *          ActivityLog             — activity log page
 *          + all theme exports (see ./theme/index.js)
 */

import { Routes, Route } from 'react-router-dom'
import { DashboardProvider } from './context/DashboardContext'
import AdminLayout         from './layout/AdminLayout'
import DashboardOverview   from './pages/DashboardOverview'
import UploadMetrics       from './pages/UploadMetrics'
import UsersManagement     from './pages/UsersManagement'
import ActivityLog         from './pages/ActivityLog'

/**
 * AdminDashboard — top-level component.
 * Mount this inside your existing <BrowserRouter> at the /admin wildcard route.
 *
 * @param {object}   props
 * @param {{ username: string, role?: string }} props.user
 * @param {function} props.onLogout   called when the user clicks "Logout"
 * @param {string}   [props.logo]     image src for the sidebar logo
 * @param {string}   [props.homeHref] URL for "Back to Home" (default '/')
 */
export default function AdminDashboard({ user, onLogout, logo, homeHref = '/' }) {
  return (
    <DashboardProvider user={user} onLogout={onLogout} logo={logo} homeHref={homeHref}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index                  element={<DashboardOverview />} />
          <Route path="upload-metrics"  element={<UploadMetrics />} />
          <Route path="users"           element={<UsersManagement />} />
          <Route path="activity"        element={<ActivityLog />} />
        </Route>
      </Routes>
    </DashboardProvider>
  )
}

/* Named exports so consumers can compose individually */
export { DashboardProvider, useDashboard } from './context/DashboardContext'
export { default as AdminLayout }        from './layout/AdminLayout'
export { default as DashboardOverview }  from './pages/DashboardOverview'
export { default as UploadMetrics }      from './pages/UploadMetrics'
export { default as UsersManagement }    from './pages/UsersManagement'
export { default as ActivityLog }        from './pages/ActivityLog'

/* Re-export theme */
export * from './theme/index'
