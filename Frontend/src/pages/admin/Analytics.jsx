import { useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import {
  Users, FileText, Activity, TrendingUp, Upload, LogIn,
  ArrowUpRight, ArrowDownRight, Search,
} from 'lucide-react'

/* ── Color Palette ───────────────────────────────────── */

const COLORS = {
  primary: '#2563EB',
  teal: '#10B981',
  amber: '#F59E0B',
  indigo: '#6366F1',
  text: '#111827',
  secondary: '#4B5563',
  border: '#E5E7EB',
}

const PIE_COLORS = [COLORS.primary, COLORS.teal, COLORS.amber, COLORS.indigo, '#EC4899', '#06B6D4']

/* ── Helpers ─────────────────────────────────────────── */

function formatDate(v, period) {
  const d = new Date(v)
  if (period === 'daily') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (period === 'weekly') return 'W' + Math.ceil(((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7)
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function PeriodToggle({ active, onChange }) {
  const periods = ['daily', 'weekly', 'monthly']
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
      {periods.map(p => (
        <button key={p} onClick={() => onChange(p)}
          className={`px-3 py-1.5 text-[11px] font-semibold rounded-md capitalize transition-all ${
            active === p ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          }`}>{p}</button>
      ))}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 shadow-xl border-0" style={{ backgroundColor: COLORS.text }}>
      <p className="text-[10px] text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[12px] font-semibold text-white">
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

function Sparkline({ data, color = COLORS.primary }) {
  if (!data?.length) return <span className="text-[11px]" style={{ color: COLORS.secondary }}>--</span>
  return (
    <ResponsiveContainer width={64} height={24}>
      <LineChart data={data.map((v, i) => ({ i, v }))}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ── Sample Data Generator ────────────────────────────── */

function generateSampleData() {
  const now = Date.now()
  const DAY = 86400000

  const sampleUsers = [
    { id: 1, username: 'Vamshi K', email: 'vamshi@company.com', resumes_uploaded: 142, daily_uploads: 5, weekly_uploads: 28, monthly_uploads: 89, total_sessions: 67, last_login: new Date(now - DAY * 0.1).toISOString(), role: 'admin', upload_timeline: [3,5,2,7,4,6,8,3,5,9,4,6,7,3,5,8,4,6,2,7,5,3,8,4,6,5,7,3,4,5] },
    { id: 2, username: 'Praveena R', email: 'praveena@company.com', resumes_uploaded: 118, daily_uploads: 3, weekly_uploads: 22, monthly_uploads: 74, total_sessions: 52, last_login: new Date(now - DAY * 0.3).toISOString(), role: 'user', upload_timeline: [2,4,3,5,6,4,3,7,5,4,6,3,5,7,4,2,6,5,3,4,7,5,3,6,4,5,3,4,6,5] },
    { id: 3, username: 'Rajesh M', email: 'rajesh@company.com', resumes_uploaded: 97, daily_uploads: 4, weekly_uploads: 19, monthly_uploads: 61, total_sessions: 43, last_login: new Date(now - DAY * 0.5).toISOString(), role: 'user', upload_timeline: [1,3,5,2,4,6,3,5,2,4,7,3,5,4,6,2,3,5,4,6,3,2,5,4,3,6,4,5,3,4] },
    { id: 4, username: 'Sneha P', email: 'sneha@company.com', resumes_uploaded: 85, daily_uploads: 2, weekly_uploads: 15, monthly_uploads: 52, total_sessions: 38, last_login: new Date(now - DAY * 1).toISOString(), role: 'user', upload_timeline: [2,3,4,2,5,3,4,2,6,3,4,5,2,3,4,6,3,2,5,4,3,2,4,5,3,4,2,3,5,4] },
    { id: 5, username: 'Arun S', email: 'arun@company.com', resumes_uploaded: 73, daily_uploads: 1, weekly_uploads: 12, monthly_uploads: 45, total_sessions: 31, last_login: new Date(now - DAY * 1.5).toISOString(), role: 'user', upload_timeline: [1,2,3,4,2,3,1,4,2,3,5,2,3,4,1,2,3,4,2,3,1,4,2,3,5,2,3,1,4,2] },
    { id: 6, username: 'Divya L', email: 'divya@company.com', resumes_uploaded: 64, daily_uploads: 2, weekly_uploads: 10, monthly_uploads: 38, total_sessions: 27, last_login: new Date(now - DAY * 2).toISOString(), role: 'user', upload_timeline: [1,2,1,3,2,4,1,3,2,1,4,2,3,1,2,3,4,1,2,3,1,2,4,3,1,2,3,1,2,3] },
    { id: 7, username: 'Karthik N', email: 'karthik@company.com', resumes_uploaded: 51, daily_uploads: 1, weekly_uploads: 8, monthly_uploads: 30, total_sessions: 22, last_login: new Date(now - DAY * 3).toISOString(), role: 'user', upload_timeline: [1,1,2,3,1,2,1,3,2,1,2,3,1,2,1,3,2,1,2,1,3,2,1,2,3,1,2,1,2,3] },
    { id: 8, username: 'Meena T', email: 'meena@company.com', resumes_uploaded: 39, daily_uploads: 0, weekly_uploads: 5, monthly_uploads: 22, total_sessions: 18, last_login: new Date(now - DAY * 4).toISOString(), role: 'user', upload_timeline: [0,1,2,1,0,2,1,0,1,2,1,0,2,1,0,1,2,1,0,1,2,1,0,2,1,0,1,2,1,0] },
    { id: 9, username: 'Suresh B', email: 'suresh@company.com', resumes_uploaded: 28, daily_uploads: 0, weekly_uploads: 4, monthly_uploads: 16, total_sessions: 14, last_login: new Date(now - DAY * 5).toISOString(), role: 'user', upload_timeline: [0,1,1,0,2,1,0,1,0,1,2,0,1,1,0,1,0,2,1,0,1,0,1,2,0,1,1,0,1,0] },
    { id: 10, username: 'Lakshmi V', email: 'lakshmi@company.com', resumes_uploaded: 15, daily_uploads: 0, weekly_uploads: 2, monthly_uploads: 9, total_sessions: 8, last_login: new Date(now - DAY * 7).toISOString(), role: 'user', upload_timeline: [0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0,0,1,0,1,0,0,1,0,0,1] },
  ]

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

  const recentActivity = [
    { username: 'Vamshi K', logged_in_at: new Date(now - 120000).toISOString(), ip_address: '192.168.1.10', resumes_uploaded_this_session: 3 },
    { username: 'Praveena R', logged_in_at: new Date(now - 600000).toISOString(), ip_address: '192.168.1.22', resumes_uploaded_this_session: 0 },
    { username: 'Sneha P', logged_in_at: new Date(now - 1800000).toISOString(), ip_address: '10.0.0.45', resumes_uploaded_this_session: 5 },
    { username: 'Rajesh M', logged_in_at: new Date(now - 3600000).toISOString(), ip_address: '192.168.1.33', resumes_uploaded_this_session: 2 },
    { username: 'Arun S', logged_in_at: new Date(now - 5400000).toISOString(), ip_address: '10.0.0.12', resumes_uploaded_this_session: 0 },
    { username: 'Divya L', logged_in_at: new Date(now - 7200000).toISOString(), ip_address: '192.168.1.55', resumes_uploaded_this_session: 1 },
    { username: 'Karthik N', logged_in_at: new Date(now - 10800000).toISOString(), ip_address: '10.0.0.78', resumes_uploaded_this_session: 0 },
    { username: 'Meena T', logged_in_at: new Date(now - 14400000).toISOString(), ip_address: '192.168.1.90', resumes_uploaded_this_session: 4 },
    { username: 'Suresh B', logged_in_at: new Date(now - 21600000).toISOString(), ip_address: '10.0.0.34', resumes_uploaded_this_session: 0 },
    { username: 'Lakshmi V', logged_in_at: new Date(now - 28800000).toISOString(), ip_address: '192.168.1.67', resumes_uploaded_this_session: 2 },
  ]

  return {
    total_users: 10, total_resumes: 712, active_today: 6, success_rate: 94.2,
    users_trend: 12.5, resumes_trend: 8.3,
    login_activity: loginDaily, login_weekly: loginWeekly, login_monthly: loginMonthly,
    upload_trend: uploadDaily, upload_weekly: uploadWeekly, upload_monthly: uploadMonthly,
    user_performance: sampleUsers, recent_activity: recentActivity,
  }
}

/* ═══════════════════════════════════════════════════════
   ANALYTICS PAGE
   ═══════════════════════════════════════════════════════ */

export default function Analytics() {
  const { user } = useAuth()
  const [stats] = useState(() => generateSampleData())
  const [loginPeriod, setLoginPeriod] = useState('daily')
  const [uploadPeriod, setUploadPeriod] = useState('daily')
  const [tableSearch, setTableSearch] = useState('')
  const [sortKey, setSortKey] = useState('resumes_uploaded')
  const [sortDir, setSortDir] = useState('desc')

  /* Derived data */
  const data = useMemo(() => {
    if (!stats) return null
    const users = stats.user_performance || []
    const totalUploads = stats.total_resumes || 0
    const totalUsers = stats.total_users || 0
    const activeToday = stats.active_today || 0
    const avgPerUser = totalUsers ? (totalUploads / totalUsers).toFixed(1) : '0'

    const uploadersPie = users
      .filter(u => (u.resumes_uploaded ?? 0) > 0)
      .sort((a, b) => b.resumes_uploaded - a.resumes_uploaded)
      .slice(0, 6).map(u => ({ name: u.username, value: u.resumes_uploaded }))

    const topUploaders = users
      .filter(u => u.resumes_uploaded > 0)
      .sort((a, b) => b.resumes_uploaded - a.resumes_uploaded)
      .slice(0, 8)
    const maxUploads = topUploaders[0]?.resumes_uploaded || 1

    return {
      totalUploads, totalUsers, activeToday, avgPerUser,
      usersTrend: stats.users_trend ?? 0,
      resumesTrend: stats.resumes_trend ?? 0,
      loginDaily: stats.login_activity || [],
      loginWeekly: stats.login_weekly || [],
      loginMonthly: stats.login_monthly || [],
      uploadDaily: stats.upload_trend || [],
      uploadWeekly: stats.upload_weekly || [],
      uploadMonthly: stats.upload_monthly || [],
      uploadersPie, topUploaders, maxUploads,
      recentActivity: stats.recent_activity || [],
      users,
    }
  }, [stats])

  const loginData = useMemo(() => {
    if (!data) return []
    return loginPeriod === 'daily' ? data.loginDaily : loginPeriod === 'weekly' ? data.loginWeekly : data.loginMonthly
  }, [data, loginPeriod])

  const uploadData = useMemo(() => {
    if (!data) return []
    return uploadPeriod === 'daily' ? data.uploadDaily : uploadPeriod === 'weekly' ? data.uploadWeekly : data.uploadMonthly
  }, [data, uploadPeriod])

  const filteredUsers = useMemo(() => {
    if (!data) return []
    let list = [...data.users]
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase()
      list = list.filter(u => (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      if (sortKey === 'last_login') {
        const ta = new Date(av || 0).getTime(), tb = new Date(bv || 0).getTime()
        return sortDir === 'asc' ? ta - tb : tb - ta
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return list
  }, [data, tableSearch, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  if (!data) return <div className="py-16 text-center text-sm" style={{ color: COLORS.secondary }}>No analytics data</div>

  const kpis = [
    { label: 'Total Users', value: data.totalUsers, icon: Users, trend: data.usersTrend, bg: '#EFF6FF', iconColor: COLORS.primary },
    { label: 'Resumes', value: data.totalUploads.toLocaleString(), icon: FileText, trend: data.resumesTrend, bg: '#F0FDF4', iconColor: COLORS.teal },
    { label: 'Active Today', value: data.activeToday, icon: Activity, trend: null, bg: '#FFFBEB', iconColor: COLORS.amber },
    { label: 'Avg / User', value: data.avgPerUser, icon: TrendingUp, trend: null, bg: '#EEF2FF', iconColor: COLORS.indigo },
  ]

  const SortTh = ({ label, k }) => (
    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none"
      style={{ color: COLORS.secondary }}
      onClick={() => toggleSort(k)}>
      {label} {sortKey === k && <span style={{ color: COLORS.primary }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: COLORS.text }}>Analytics</h2>
        <p className="text-sm mt-0.5" style={{ color: COLORS.secondary }}>Detailed insights into usage and performance</p>
      </div>

      {/* ─── KPI CARDS ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} className="bg-white rounded-xl p-5" style={{ border: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: kpi.bg }}>
                  <Icon className="h-5 w-5" style={{ color: kpi.iconColor }} />
                </div>
                {kpi.trend !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    kpi.trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                  }`}>
                    {kpi.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(kpi.trend).toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold" style={{ color: COLORS.text }}>{kpi.value}</p>
              <p className="text-[12px] mt-0.5" style={{ color: COLORS.secondary }}>{kpi.label}</p>
            </div>
          )
        })}
      </div>

      {/* ─── LOGIN SESSIONS ───────────────────────────── */}
      <div className="bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: COLORS.text }}>Login Sessions</h3>
            <p className="text-[12px] mt-0.5" style={{ color: COLORS.secondary }}>
              {loginPeriod === 'daily' ? 'Last 90 days' : loginPeriod === 'weekly' ? 'Last 12 weeks' : 'Last 12 months'}
            </p>
          </div>
          <PeriodToggle active={loginPeriod} onChange={setLoginPeriod} />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={loginData}>
            <defs>
              <linearGradient id="aGradL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.12} />
                <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false}
              tickFormatter={v => formatDate(v, loginPeriod)} />
            <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={28} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="logins" stroke={COLORS.primary} fill="url(#aGradL)" strokeWidth={2} name="Logins" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ─── UPLOAD HISTORY ───────────────────────────── */}
      <div className="bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: COLORS.text }}>Upload History</h3>
            <p className="text-[12px] mt-0.5" style={{ color: COLORS.secondary }}>
              {uploadPeriod === 'daily' ? 'Last 90 days' : uploadPeriod === 'weekly' ? 'Last 12 weeks' : 'Last 12 months'}
            </p>
          </div>
          <PeriodToggle active={uploadPeriod} onChange={setUploadPeriod} />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={uploadData}>
            <defs>
              <linearGradient id="analyticsUploadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.teal} stopOpacity={1} />
                <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false}
              tickFormatter={v => formatDate(v, uploadPeriod)} />
            <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={28} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="uploads" name="Uploads" fill="url(#analyticsUploadGrad)" radius={[4, 4, 0, 0]}
              barSize={uploadPeriod === 'daily' ? 6 : 18} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ─── TOP CONTRIBUTORS + PIE ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
          <h3 className="text-[15px] font-semibold mb-1" style={{ color: COLORS.text }}>Top Contributors</h3>
          <p className="text-[12px] mb-5" style={{ color: COLORS.secondary }}>Ranked by total uploads</p>
          <div className="space-y-3.5">
            {data.topUploaders.map((u, i) => {
              const pct = (u.resumes_uploaded / data.maxUploads) * 100
              const barColors = [COLORS.primary, COLORS.teal, COLORS.amber, COLORS.indigo, '#EC4899', '#06B6D4', '#8B5CF6', '#EF4444']
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold w-4 tabular-nums" style={{ color: COLORS.secondary }}>{i + 1}</span>
                      <span className="text-[13px] font-medium" style={{ color: COLORS.text }}>{u.username}</span>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: COLORS.text }}>{u.resumes_uploaded}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: barColors[i % barColors.length] }} />
                  </div>
                </div>
              )
            })}
            {data.topUploaders.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: COLORS.secondary }}>No uploads yet</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
          <h3 className="text-[15px] font-semibold mb-1" style={{ color: COLORS.text }}>Upload Share</h3>
          <p className="text-[12px] mb-4" style={{ color: COLORS.secondary }}>Distribution by user</p>
          {data.uploadersPie.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.uploadersPie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={46} outerRadius={74} paddingAngle={3} strokeWidth={0}>
                    {data.uploadersPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 justify-center">
                {data.uploadersPie.map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: COLORS.secondary }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {item.name}
                  </span>
                ))}
              </div>
            </>
          ) : <div className="flex items-center justify-center h-[220px] text-sm" style={{ color: COLORS.secondary }}>No data</div>}
        </div>
      </div>

      {/* ─── USER PERFORMANCE TABLE ───────────────────── */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: COLORS.text }}>User Performance</h3>
            <p className="text-[12px] mt-0.5" style={{ color: COLORS.secondary }}>Activity breakdown per user</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 w-56 focus-within:ring-2 transition-all" style={{ border: `1px solid ${COLORS.border}` }}>
            <Search className="h-3.5 w-3.5" style={{ color: COLORS.secondary }} />
            <input type="text" placeholder="Search users..." value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              className="bg-transparent text-[13px] placeholder-gray-400 outline-none w-full" style={{ color: COLORS.text }} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/60">
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.secondary }}>User</th>
                <SortTh label="Daily" k="daily_uploads" />
                <SortTh label="Weekly" k="weekly_uploads" />
                <SortTh label="Monthly" k="monthly_uploads" />
                <SortTh label="Total" k="resumes_uploaded" />
                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.secondary }}>Trend</th>
                <SortTh label="Last Login" k="last_login" />
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: COLORS.border + '60' }}>
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold uppercase" style={{ color: COLORS.secondary }}>
                        {u.username?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: COLORS.text }}>{u.username}</p>
                        {u.email && <p className="text-[11px]" style={{ color: COLORS.secondary }}>{u.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] tabular-nums" style={{ color: COLORS.secondary }}>{u.daily_uploads ?? '--'}</td>
                  <td className="px-4 py-3 text-right text-[13px] tabular-nums" style={{ color: COLORS.secondary }}>{u.weekly_uploads ?? '--'}</td>
                  <td className="px-4 py-3 text-right text-[13px] tabular-nums" style={{ color: COLORS.secondary }}>{u.monthly_uploads ?? '--'}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums" style={{ color: COLORS.text }}>{(u.resumes_uploaded || 0).toLocaleString()}</td>
                  <td className="px-4 py-3"><div className="flex justify-center"><Sparkline data={u.upload_timeline} color={COLORS.primary} /></div></td>
                  <td className="px-4 py-3 text-right text-[12px]" style={{ color: COLORS.secondary }}>{timeAgo(u.last_login)}</td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-sm" style={{ color: COLORS.secondary }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── RECENT ACTIVITY ──────────────────────────── */}
      {data.recentActivity.length > 0 && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            <h3 className="text-[15px] font-semibold" style={{ color: COLORS.text }}>Recent Activity</h3>
          </div>
          <div className="divide-y" style={{ borderColor: COLORS.border + '40' }}>
            {data.recentActivity.slice(0, 12).map((a, i) => {
              const uploads = a.resumes_uploaded_this_session || 0
              return (
                <div key={i} className="px-6 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: uploads > 0 ? '#F0FDF4' : '#EFF6FF', color: uploads > 0 ? COLORS.teal : COLORS.primary }}>
                    {uploads > 0 ? <Upload className="h-3 w-3" /> : <LogIn className="h-3 w-3" />}
                  </div>
                  <p className="flex-1 text-[13px]" style={{ color: COLORS.secondary }}>
                    <span className="font-semibold" style={{ color: COLORS.text }}>{a.username}</span>
                    {uploads > 0 ? ` uploaded ${uploads} resume${uploads > 1 ? 's' : ''}` : ' logged in'}
                  </p>
                  <span className="text-[11px]" style={{ color: COLORS.secondary }}>{timeAgo(a.logged_in_at)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
