import { useState, useMemo } from 'react'
import { useDashboard } from '../context/DashboardContext'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Users, FileText, Activity, Upload, LogIn, Search,
  ArrowUpRight, ArrowDownRight, TrendingUp, X,
} from 'lucide-react'
import { COLORS, PIE_COLORS } from '../theme/colors'
import { timeAgo, formatDate } from '../theme/utils'
import { PeriodToggle, ChartTooltip } from '../theme/components'

function PerformanceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const user = payload[0]?.payload
  return (
    <div className="rounded-xl px-4 py-3 shadow-xl border-0 min-w-[160px]" style={{ backgroundColor: COLORS.text }}>
      <p className="text-[13px] font-semibold text-white mb-2">{user?.username}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-[11px] text-gray-300">{p.name}: <span className="text-white font-medium">{p.value}</span></span>
        </div>
      ))}
      <p className="text-[10px] text-gray-500 mt-2 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>Click bar to view details</p>
    </div>
  )
}

/* ── Sample Data Generator ────────────────────────────── */

function generateSampleData() {
  const now = Date.now()
  const DAY = 86400000

  // Empty sample data - all data cleared
  const sampleUsers = []

  const loginDaily = Array.from({ length: 90 }, (_, i) => ({
    date: new Date(now - DAY * (89 - i)).toISOString().split('T')[0],
    logins: Math.floor(Math.random() * 18) + 5 + Math.floor(Math.sin(i / 7) * 4),
  }))

  const loginWeekly = Array.from({ length: 12 }, (_, i) => ({
    date: new Date(now - DAY * 7 * (11 - i)).toISOString().split('T')[0],
    logins: Math.floor(Math.random() * 60) + 40 + Math.floor(Math.sin(i / 3) * 15),
  }))

  const loginMonthly = Array.from({ length: 12 }, (_, i) => ({
    date: new Date(2025, 3 + i, 1).toISOString().split('T')[0],
    logins: Math.floor(Math.random() * 150) + 120 + i * 8,
  }))

  const uploadDaily = Array.from({ length: 90 }, (_, i) => ({
    date: new Date(now - DAY * (89 - i)).toISOString().split('T')[0],
    uploads: Math.floor(Math.random() * 12) + 3 + Math.floor(Math.sin(i / 5) * 3),
  }))

  const uploadWeekly = Array.from({ length: 12 }, (_, i) => ({
    date: new Date(now - DAY * 7 * (11 - i)).toISOString().split('T')[0],
    uploads: Math.floor(Math.random() * 40) + 25 + Math.floor(Math.sin(i / 3) * 10),
  }))

  const uploadMonthly = Array.from({ length: 12 }, (_, i) => ({
    date: new Date(2025, 3 + i, 1).toISOString().split('T')[0],
    uploads: Math.floor(Math.random() * 80) + 60 + i * 5,
  }))

  const recentActivity = []

  return {
    total_users: 0, total_resumes: 0, active_today: 0, success_rate: 0,
    users_trend: 0, resumes_trend: 0,
    login_activity: loginDaily, login_weekly: loginWeekly, login_monthly: loginMonthly,
    upload_trend: uploadDaily, upload_weekly: uploadWeekly, upload_monthly: uploadMonthly,
    user_performance: sampleUsers, recent_activity: recentActivity,
  }
}

/* ═══════════════════════════════════════════════════════
   USER DETAIL DRAWER
   ═══════════════════════════════════════════════════════ */

function UserDetailDrawer({ user, onClose }) {
  if (!user) return null

  const now = Date.now()
  const DAY = 86400000
  const uploadData = (user.upload_timeline || []).map((v, i) => ({
    label: new Date(now - DAY * (29 - i)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    uploads: v,
  }))
  const loginData = (user.login_timeline || []).map((v, i) => ({
    label: new Date(now - DAY * (29 - i)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    logins: v,
  }))

  const kpis = [
    { label: 'Daily',   value: user.daily_uploads   ?? 0, color: COLORS.primary },
    { label: 'Weekly',  value: user.weekly_uploads  ?? 0, color: COLORS.teal },
    { label: 'Monthly', value: user.monthly_uploads ?? 0, color: COLORS.amber },
    { label: 'Total',   value: user.resumes_uploaded ?? 0, color: COLORS.indigo },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
        style={{ borderLeft: `1px solid ${COLORS.border}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-6 py-4"
          style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold"
              style={{ backgroundColor: COLORS.primary }}>
              {user.username?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-extrabold text-[15px] tracking-tight" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{user.username}</p>
              <p className="text-[12px] font-medium" style={{ color: COLORS.secondary }}>{user.email || '—'}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" style={{ color: COLORS.secondary }} />
          </button>
        </div>

        <div className="flex-1 space-y-6 p-6">
          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-2">
            {kpis.map(k => (
              <div key={k.label} className="rounded-xl p-3 text-center"
                style={{ backgroundColor: k.color + '14', border: `1px solid ${k.color}28` }}>
                <p className="text-[18px] font-extrabold tabular-nums" style={{ color: k.color }}>{k.value}</p>
                <p className="text-[10px] mt-0.5 font-semibold uppercase tracking-wide" style={{ color: COLORS.secondary }}>{k.label}</p>
              </div>
            ))}
          </div>

          {/* Upload activity chart */}
          <div className="rounded-xl p-4" style={{ border: `1px solid ${COLORS.border}` }}>
            <p className="text-[13px] font-bold tracking-tight mb-1" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
              Upload Activity
              <span className="ml-1.5 text-[11px] font-medium tracking-normal" style={{ color: COLORS.secondary }}>last 30 days</span>
            </p>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={uploadData} barSize={7} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: COLORS.secondary }} tickLine={false} axisLine={false} interval={5} />
                <YAxis tick={{ fontSize: 9, fill: COLORS.secondary }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
                  cursor={{ fill: COLORS.teal + '18' }}
                />
                <Bar dataKey="uploads" name="Uploads" fill={COLORS.teal} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Login activity chart */}
          <div className="rounded-xl p-4" style={{ border: `1px solid ${COLORS.border}` }}>
            <p className="text-[13px] font-bold tracking-tight mb-1" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
              Login Activity
              <span className="ml-1.5 text-[11px] font-medium tracking-normal" style={{ color: COLORS.secondary }}>last 30 days</span>
            </p>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={loginData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={`loginGrad_${user.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.primary} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: COLORS.secondary }} tickLine={false} axisLine={false} interval={5} />
                <YAxis tick={{ fontSize: 9, fill: COLORS.secondary }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
                />
                <Area type="monotone" dataKey="logins" name="Logins" stroke={COLORS.primary} strokeWidth={2}
                  fill={`url(#loginGrad_${user.id})`} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Meta info */}
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
            {[
              { label: 'Last Login',      value: timeAgo(user.last_login) },
              { label: 'Total Sessions',  value: user.total_sessions ?? '—' },
              { label: 'Role',            value: user.role || 'user', badge: true },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 text-[12px]"
                style={{ borderBottom: i < 2 ? `1px solid ${COLORS.border}` : 'none', backgroundColor: i % 2 === 0 ? '#FAFAFA' : 'white' }}>
                <span className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>{row.label}</span>
                {row.badge
                  ? <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: row.value === 'admin' ? '#EFF6FF' : '#F0FDF4',
                        color: row.value === 'admin' ? COLORS.primary : COLORS.teal,
                      }}>{row.value}</span>
                  : <span className="font-medium" style={{ color: COLORS.text }}>{row.value}</span>
                }
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD OVERVIEW
   ═══════════════════════════════════════════════════════ */

export default function DashboardOverview() {
  const { user } = useDashboard()
  const [stats] = useState(() => generateSampleData())
  const [loginPeriod, setLoginPeriod] = useState('daily')
  const [uploadPeriod, setUploadPeriod] = useState('daily')
  const [tableSearch, setTableSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  const d = useMemo(() => {
    if (!stats) return null
    const users = stats.user_performance || []
    const totalUploads = stats.total_resumes || 0
    const totalUsers = stats.total_users || 0
    const activeToday = stats.active_today || 0
    const avgPerUser = totalUsers ? (totalUploads / totalUsers).toFixed(1) : '0'
    const usersTrend = stats.users_trend ?? 0
    const resumesTrend = stats.resumes_trend ?? 0

    const uploadersPie = users
      .filter(u => (u.resumes_uploaded ?? 0) > 0)
      .sort((a, b) => b.resumes_uploaded - a.resumes_uploaded)
      .slice(0, 6)
      .map(u => ({ name: u.username, value: u.resumes_uploaded }))

    const topUploaders = users
      .filter(u => u.resumes_uploaded > 0)
      .sort((a, b) => b.resumes_uploaded - a.resumes_uploaded)
      .slice(0, 8)
    const maxUploads = topUploaders[0]?.resumes_uploaded || 1

    const recentActivity = stats.recent_activity || []

    return {
      totalUploads, totalUsers, activeToday, avgPerUser,
      usersTrend, resumesTrend,
      loginDaily: stats.login_activity || [],
      loginWeekly: stats.login_weekly || [],
      loginMonthly: stats.login_monthly || [],
      uploadDaily: stats.upload_trend || [],
      uploadWeekly: stats.upload_weekly || [],
      uploadMonthly: stats.upload_monthly || [],
      uploadersPie, topUploaders, maxUploads, recentActivity, users,
    }
  }, [stats])

  const loginData = useMemo(() => {
    if (!d) return []
    if (loginPeriod === 'weekly') return d.loginWeekly
    if (loginPeriod === 'monthly' || loginPeriod === 'yearly') return d.loginMonthly
    return d.loginDaily
  }, [d, loginPeriod])

  const uploadData = useMemo(() => {
    if (!d) return []
    if (uploadPeriod === 'weekly') return d.uploadWeekly
    if (uploadPeriod === 'monthly' || uploadPeriod === 'yearly') return d.uploadMonthly
    return d.uploadDaily
  }, [d, uploadPeriod])

  const filteredUsers = useMemo(() => {
    if (!d) return []
    let list = [...d.users]
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase()
      list = list.filter(u => (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
    }
    list.sort((a, b) => (b.resumes_uploaded ?? 0) - (a.resumes_uploaded ?? 0))
    return list
  }, [d, tableSearch])

  if (!d) return <div className="py-16 text-center text-sm" style={{ color: COLORS.secondary }}>No data available</div>

  /* KPI definitions */
  const kpis = [
    { label: 'Total Users', value: d.totalUsers, icon: Users, trend: d.usersTrend, bg: '#EFF6FF', iconColor: COLORS.primary },
    { label: 'Total Resumes Uploaded', value: d.totalUploads.toLocaleString(), icon: FileText, trend: d.resumesTrend, bg: '#F0FDF4', iconColor: COLORS.teal },
    { label: 'Active Users Today', value: d.activeToday, icon: Activity, trend: null, bg: '#FFFBEB', iconColor: COLORS.amber },
    { label: 'Avg Resumes / User', value: d.avgPerUser, icon: TrendingUp, trend: null, bg: '#EEF2FF', iconColor: COLORS.indigo },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Welcome back</p>
        <h2 className="text-2xl font-extrabold tracking-tight mt-0.5" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
          {user?.username || 'Admin'}
        </h2>
        <p className="text-[11px] font-medium tracking-wide uppercase mt-1" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>
          Here's what's happening on your platform today
        </p>
      </div>

      {/* ─── 1. KPI CARDS ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} className="bg-white rounded-2xl p-6 hover:shadow-lg transition-all duration-300" style={{ border: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: kpi.bg }}>
                  <Icon className="h-5 w-5" style={{ color: kpi.iconColor }} />
                </div>
                {kpi.trend !== null && kpi.trend !== undefined && (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    kpi.trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                  }`}>
                    {kpi.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(kpi.trend).toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>{kpi.label}</p>
              <p className="text-[28px] font-extrabold tracking-tight mt-1" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{kpi.value}</p>
            </div>
          )
        })}
      </div>

      {/* ─── 2. LOGIN ACTIVITY LINE CHART ────────────── */}
      <div className="bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Login Activity</h3>
            <p className="text-[11px] font-medium tracking-wide uppercase mt-0.5" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>
              {loginPeriod === 'daily' ? 'Last 90 days' : loginPeriod === 'weekly' ? 'Last 12 weeks' : 'Last 12 months'}
            </p>
          </div>
          <PeriodToggle active={loginPeriod} onChange={setLoginPeriod} />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={loginData}>
            <defs>
              <linearGradient id="loginGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false}
              tickFormatter={v => formatDate(v, loginPeriod)} />
            <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={28} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="logins" stroke={COLORS.primary} strokeWidth={2.5} fill="url(#loginGradient)" name="Logins" dot={false} activeDot={{ r: 5, fill: COLORS.primary, stroke: '#fff', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ─── 3. UPLOAD BAR CHART + PIE CHART ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Upload Bar Chart */}
        <div className="lg:col-span-3 bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Resume Uploads</h3>
              <p className="text-[11px] font-medium tracking-wide uppercase mt-0.5" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>
                {uploadPeriod === 'daily' ? 'Last 90 days' : uploadPeriod === 'weekly' ? 'Last 12 weeks' : 'Last 12 months'}
              </p>
            </div>
            <PeriodToggle active={uploadPeriod} onChange={setUploadPeriod} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={uploadData}>
              <defs>
                <linearGradient id="uploadBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.teal} stopOpacity={1} />
                  <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false}
                tickFormatter={v => formatDate(v, uploadPeriod)} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="uploads" name="Uploads" fill="url(#uploadBarGrad)" radius={[4, 4, 0, 0]}
                barSize={uploadPeriod === 'daily' ? 6 : 18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Upload Distribution Pie */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
          <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Upload Distribution</h3>
          <p className="text-[11px] font-medium tracking-wide uppercase mb-4" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Share by contributor</p>
          {d.uploadersPie.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={d.uploadersPie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                    {d.uploadersPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 justify-center">
                {d.uploadersPie.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[11px]" style={{ color: COLORS.secondary }}>{item.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm" style={{ color: COLORS.secondary }}>No data</div>
          )}
        </div>
      </div>

      {/* ─── 4. TOP USERS HORIZONTAL BAR ─────────────── */}
      <div className="bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
        <h3 className="text-[15px] font-extrabold tracking-tight mb-1" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Top Users</h3>
        <p className="text-[11px] font-medium tracking-wide uppercase mb-5" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Ranked by total resume uploads</p>
        <div className="space-y-3.5">
          {d.topUploaders.map((u, i) => {
            const pct = (u.resumes_uploaded / d.maxUploads) * 100
            const barColors = [COLORS.primary, COLORS.teal, COLORS.amber, COLORS.indigo, '#EC4899', '#06B6D4', '#8B5CF6', '#EF4444']
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-bold w-4 tabular-nums" style={{ color: COLORS.secondary }}>{i + 1}</span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold uppercase" style={{ color: COLORS.secondary }}>
                      {u.username?.charAt(0)}
                    </div>
                    <span className="text-[13px] font-medium" style={{ color: COLORS.text }}>{u.username}</span>
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: COLORS.text }}>{u.resumes_uploaded}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: barColors[i % barColors.length] }}
                  />
                </div>
              </div>
            )
          })}
          {d.topUploaders.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: COLORS.secondary }}>No uploads yet</p>
          )}
        </div>
      </div>

      {/* ─── Section Divider ─── */}
      <div className="flex items-center gap-4 pt-2">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: COLORS.secondary, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Detailed Analytics</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>

      {/* ─── 5. USER PERFORMANCE CHART ────────────────── */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}`, borderLeft: `4px solid ${COLORS.indigo}` }}>
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>User Performance</h3>
            <p className="text-[11px] font-medium tracking-wide uppercase mt-0.5" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Upload activity comparison — click a bar to view details</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 w-56 focus-within:ring-2 transition-all" style={{ border: `1px solid ${COLORS.border}` }}>
            <Search className="h-3.5 w-3.5" style={{ color: COLORS.secondary }} />
            <input type="text" placeholder="Search users..." value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              className="bg-transparent text-[13px] placeholder-gray-400 outline-none w-full" style={{ color: COLORS.text }} />
          </div>
        </div>
        <div className="p-6">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={filteredUsers} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="perfDailyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.indigo} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={COLORS.indigo} stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="perfWeeklyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.teal} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="perfMonthlyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.amber} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={COLORS.amber} stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="perfTotalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="username" tick={{ fontSize: 11, fill: COLORS.text, fontWeight: 500 }} tickLine={false} axisLine={false}
                tickFormatter={name => name?.split(' ')[0]} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} />
              <Tooltip content={<PerformanceTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" iconSize={8} />
              <Bar dataKey="daily_uploads" name="Daily" fill="url(#perfDailyGrad)" radius={[3, 3, 0, 0]}
                cursor="pointer" onClick={(entry) => setSelectedUser(entry)} />
              <Bar dataKey="weekly_uploads" name="Weekly" fill="url(#perfWeeklyGrad)" radius={[3, 3, 0, 0]}
                cursor="pointer" onClick={(entry) => setSelectedUser(entry)} />
              <Bar dataKey="monthly_uploads" name="Monthly" fill="url(#perfMonthlyGrad)" radius={[3, 3, 0, 0]}
                cursor="pointer" onClick={(entry) => setSelectedUser(entry)} />
              <Bar dataKey="resumes_uploaded" name="Total" fill="url(#perfTotalGrad)" radius={[3, 3, 0, 0]}
                cursor="pointer" onClick={(entry) => setSelectedUser(entry)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── 6. RECENT ACTIVITY FEED ─────────────────── */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Recent Activity</h3>
        </div>
        <div className="divide-y" style={{ borderColor: COLORS.border + '40' }}>
          {d.recentActivity.length > 0 ? d.recentActivity.slice(0, 10).map((a, i) => {
            const uploads = a.resumes_uploaded_this_session || 0
            return (
              <div key={i} className="px-6 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: uploads > 0 ? '#F0FDF4' : '#EFF6FF', color: uploads > 0 ? COLORS.teal : COLORS.primary }}>
                  {uploads > 0 ? <Upload className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium" style={{ color: COLORS.secondary }}>
                    <span className="font-bold" style={{ color: COLORS.text }}>{a.username}</span>
                    {uploads > 0 ? ` uploaded ${uploads} resume${uploads > 1 ? 's' : ''}` : ' logged in'}
                  </p>
                </div>
                <span className="text-[11px] font-medium shrink-0" style={{ color: COLORS.secondary }}>{timeAgo(a.logged_in_at)}</span>
              </div>
            )
          }) : (
            <div className="py-10 text-center text-sm" style={{ color: COLORS.secondary }}>No recent activity</div>
          )}
        </div>
      </div>

      {/* ─── USER DETAIL DRAWER ───────────────────────── */}
      <UserDetailDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  )
}
