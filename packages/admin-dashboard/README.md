# @kprmt/admin-dashboard

A portable, self-contained React admin dashboard package.

## Features

- **Dashboard Overview** — KPI cards, login/upload charts, user performance, activity feed
- **Upload Metrics** — per-user upload analytics with period toggle and chart type switcher
- **Users Management** — user CRUD (create, toggle active, reset password, view login history)
- **Activity Log** — login and upload activity log with search and type filter
- **Collapsible dark sidebar** with nested Dashboard submenu
- **Responsive** — mobile menu overlay + collapsible desktop sidebar
- **Zero external API calls** in standalone mode — all sample data included

## Requirements (peer dependencies)

```
react >= 18
react-dom >= 18
react-router-dom >= 6
recharts >= 2
lucide-react >= 0.300
tailwindcss >= 3
```

## Quick Start

### 1. Add to your project

In your project's `package.json`:

```json
"dependencies": {
  "@kprmt/admin-dashboard": "file:../../packages/admin-dashboard"
}
```

Then `npm install`.

### 2. Mount the route

In your `App.jsx` (inside an existing `<BrowserRouter>`):

```jsx
import AdminDashboard from '@kprmt/admin-dashboard'
import companyLogo from './assets/logo.png'

// Inside your <Routes>:
<Route path="/admin/*" element={
  <AdminDashboard
    user={{ username: 'Vamshi K', role: 'admin' }}
    onLogout={() => { doLogout(); navigate('/login') }}
    logo={companyLogo}
    homeHref="/"
  />
} />
```

This mounts:

| URL                        | Page              |
|----------------------------|-------------------|
| `/admin/`                  | Dashboard Overview|
| `/admin/upload-metrics`    | Upload Metrics    |
| `/admin/users`             | Users Management  |
| `/admin/activity`          | Activity Log      |

### 3. Tailwind theme tokens (optional)

In `tailwind.config.cjs`:

```js
const { themeExtension } = require('@kprmt/admin-dashboard/theme')

module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: themeExtension,
  },
}
```

## Props

| Prop        | Type              | Required | Default | Description                              |
|-------------|-------------------|----------|---------|------------------------------------------|
| `user`      | `{ username, role? }` | ✓    | —       | Logged-in user object                    |
| `onLogout`  | `() => void`      | ✓        | —       | Called when user clicks Logout           |
| `logo`      | `string` (img src)| —        | —       | Sidebar logo image                       |
| `homeHref`  | `string`          | —        | `'/'`   | URL for "Back to Home" button            |

## Named Exports

```js
import {
  // Components
  DashboardProvider, useDashboard,
  AdminLayout,
  DashboardOverview, UploadMetrics, UsersManagement, ActivityLog,

  // Theme tokens
  COLORS, PIE_COLORS, USER_COLORS,
  FONT_FAMILY, labelStyle, headingStyle, valueStyle,
  timeAgo, formatDate, trendPercent,
  KPICard, TrendBadge, PeriodToggle, ChartCard, MiniSparkline,
  themeExtension,
} from '@kprmt/admin-dashboard'
```

## Structure

```
src/
  index.jsx              ← Main entry / AdminDashboard component
  context/
    DashboardContext.jsx  ← DashboardProvider + useDashboard hook
  layout/
    AdminLayout.jsx       ← Sidebar + header shell (uses <Outlet>)
  pages/
    DashboardOverview.jsx
    UploadMetrics.jsx
    UsersManagement.jsx   ← Operates on local sample data
    ActivityLog.jsx
  theme/                  ← Portable design system (colors, typography, utils, components)
    colors.js
    typography.js
    utils.js
    components.jsx
    tailwind.extend.js
    index.js
```
