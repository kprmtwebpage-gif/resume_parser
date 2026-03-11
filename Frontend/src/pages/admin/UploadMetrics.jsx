import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiUrl } from '../../config'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  Upload, TrendingUp, Users, Calendar, Filter,
  ChevronDown, X, BarChart3, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { COLORS, USER_COLORS } from '../../theme/colors'
import { formatDate } from '../../theme/utils'
import { MiniSparkline as ThemeMiniSparkline } from '../../theme/components'

/* ── Sample Data Generator ────────────────────────────── */

const EMPTY_DATA = { users: [], dailyData: [], weeklyData: [], monthlyData: [], yearlyData: [], userSummaries: [] }

/* ── Custom Tooltip ───────────────────────────────────── */

function MetricTooltip({ active, payload, label, period }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-4 py-3 shadow-xl border-0 min-w-[180px]" style={{ backgroundColor: COLORS.text }}>
      <p className="text-[10px] text-gray-400 mb-2 font-medium">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-[11px] text-gray-300">{p.name}</span>
          </div>
          <span className="text-[12px] font-semibold text-white tabular-nums">{p.value}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <span className="text-[10px] text-gray-400">Total</span>
        <span className="text-[12px] font-bold text-white tabular-nums">
          {payload.reduce((s, p) => s + p.value, 0)}
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   UPLOAD METRICS PAGE
   ═══════════════════════════════════════════════════════ */

export default function UploadMetrics() {
  const { getAuthHeaders } = useAuth()
  const [data, setData] = useState(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('daily')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [chartType, setChartType] = useState('bar') // 'bar' | 'line' | 'area'
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/upload-metrics'), { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
      setSelectedUsers(json.users.map(u => u.name))
    } catch (e) {
      console.error('Upload metrics fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  /* period data source */
  const chartData = useMemo(() => {
    const src = period === 'daily' ? data.dailyData
      : period === 'weekly' ? data.weeklyData
      : period === 'monthly' ? data.monthlyData
      : data.yearlyData
    return src
  }, [data, period])

  /* KPIs for selected period + users */
  const kpis = useMemo(() => {
    const totalUploads = chartData.reduce((sum, row) => {
      return sum + selectedUsers.reduce((s, name) => s + (row[name] || 0), 0)
    }, 0)
    const avgPerPeriod = chartData.length > 0 ? Math.round(totalUploads / chartData.length) : 0
    const peakRow = chartData.reduce((best, row) => {
      const rowTotal = selectedUsers.reduce((s, name) => s + (row[name] || 0), 0)
      return rowTotal > (best.val || 0) ? { val: rowTotal, date: row.date } : best
    }, { val: 0, date: '' })
    const activeUsers = selectedUsers.filter(name => {
      const lastRow = chartData[chartData.length - 1]
      return (lastRow?.[name] || 0) > 0
    }).length

    return { totalUploads, avgPerPeriod, peakUploads: peakRow.val, peakDate: peakRow.date, activeUsers }
  }, [chartData, selectedUsers])

  /* filtered user summaries */
  const filteredSummaries = useMemo(() => {
    return data.userSummaries.filter(u => selectedUsers.includes(u.name))
      .sort((a, b) => b.total - a.total)
  }, [data.userSummaries, selectedUsers])

  /* toggle user selection */
  const toggleUser = (name) => {
    setSelectedUsers(prev => {
      if (prev.includes(name)) {
        if (prev.length <= 1) return prev // keep at least 1
        return prev.filter(n => n !== name)
      }
      return [...prev, name]
    })
  }

  const selectAll = () => setSelectedUsers(data.users.map(u => u.name))
  const clearAll = () => setSelectedUsers(data.users.length ? [data.users[0].name] : [])

  const periodLabels = {
    daily: 'Last 90 Days',
    weekly: 'Last 24 Weeks',
    monthly: 'Last 12 Months',
    yearly: 'Last 3 Years',
  }

  const kpiDefs = [
    { label: 'Total Uploads', value: kpis.totalUploads.toLocaleString(), icon: Upload, bg: '#F0FDF4', iconColor: COLORS.teal },
    { label: `Avg / ${period === 'daily' ? 'Day' : period === 'weekly' ? 'Week' : period === 'monthly' ? 'Month' : 'Year'}`, value: kpis.avgPerPeriod.toLocaleString(), icon: TrendingUp, bg: '#EFF6FF', iconColor: COLORS.primary },
    { label: 'Peak Uploads', value: kpis.peakUploads.toLocaleString(), icon: BarChart3, bg: '#FFFBEB', iconColor: COLORS.amber },
    { label: 'Active Users', value: kpis.activeUsers, icon: Users, bg: '#EEF2FF', iconColor: COLORS.indigo },
  ]

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: COLORS.primary }} />
      <span className="ml-3 text-sm" style={{ color: COLORS.secondary }}>Loading upload metrics...</span>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Upload Metrics</p>
        <h2 className="text-2xl font-extrabold tracking-tight mt-0.5" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
          User Upload Performance
        </h2>
        <p className="text-[11px] font-medium tracking-wide uppercase mt-1" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>
          Track and compare upload activity across users over any time period
        </p>
      </div>

      {/* ─── FILTERS BAR ─────────────────────────────── */}
      <div className="bg-white rounded-xl p-4 flex flex-wrap items-center gap-3" style={{ border: `1px solid ${COLORS.border}` }}>
        {/* Period Toggle */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" style={{ color: COLORS.secondary }} />
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            {['daily', 'weekly', 'monthly', 'yearly'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-md capitalize transition-all ${
                  period === p ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}>{p}</button>
            ))}
          </div>
        </div>

        <div className="w-px h-7 bg-gray-200 hidden sm:block" />

        {/* User Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all hover:bg-gray-50"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}
          >
            <Filter className="h-3.5 w-3.5" style={{ color: COLORS.secondary }} />
            <span>{selectedUsers.length === data.users.length ? 'All Users' : `${selectedUsers.length} User${selectedUsers.length > 1 ? 's' : ''}`}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} style={{ color: COLORS.secondary }} />
          </button>

          {userDropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setUserDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-1 z-40 bg-white rounded-xl shadow-xl py-2 min-w-[220px]"
                style={{ border: `1px solid ${COLORS.border}` }}>
                {/* Select All / Clear */}
                <div className="flex items-center justify-between px-3 py-1.5 mb-1" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <button onClick={selectAll} className="text-[11px] font-medium text-blue-600 hover:text-blue-700">Select All</button>
                  <button onClick={clearAll} className="text-[11px] font-medium text-gray-400 hover:text-gray-600">Clear</button>
                </div>
                {data.users.map(u => {
                  const checked = selectedUsers.includes(u.name)
                  return (
                    <button key={u.id} onClick={() => toggleUser(u.name)}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left">
                      <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                        checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {checked && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: u.color }} />
                      <span className="text-[12px] font-medium" style={{ color: COLORS.text }}>{u.name}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Selected user chips */}
        {selectedUsers.length < data.users.length && (
          <div className="flex flex-wrap gap-1.5">
            {selectedUsers.map(name => {
              const user = data.users.find(u => u.name === name)
              return (
                <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: user?.color + '18', color: user?.color, border: `1px solid ${user?.color}30` }}>
                  {name.split(' ')[0]}
                  <button onClick={() => toggleUser(name)} className="hover:opacity-70 ml-0.5">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        <div className="flex-1" />

        {/* Chart Type Toggle */}
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
          {[
            { key: 'bar', label: 'Bar' },
            { key: 'line', label: 'Line' },
            { key: 'area', label: 'Area' },
          ].map(ct => (
            <button key={ct.key} onClick={() => setChartType(ct.key)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                chartType === ct.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}>{ct.label}</button>
          ))}
        </div>
      </div>

      {/* ─── KPI CARDS ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiDefs.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all duration-300" style={{ border: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: kpi.bg }}>
                  <Icon className="h-[18px] w-[18px]" style={{ color: kpi.iconColor }} />
                </div>
              </div>
              <p className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>{kpi.label}</p>
              <p className="text-[26px] font-extrabold tracking-tight mt-0.5" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{kpi.value}</p>
            </div>
          )
        })}
      </div>

      {/* ─── MAIN CHART ──────────────────────────────── */}
      <div className="bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
              Upload Activity — {period.charAt(0).toUpperCase() + period.slice(1)} View
            </h3>
            <p className="text-[11px] font-medium tracking-wide uppercase mt-0.5" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>
              {periodLabels[period]} • {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={380}>
          {chartType === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false}
                tickFormatter={v => formatDate(v, period)} interval={period === 'daily' ? 6 : 0} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={32} />
              <Tooltip content={<MetricTooltip period={period} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
              {selectedUsers.map(name => {
                const user = data.users.find(u => u.name === name)
                return (
                  <Bar key={name} dataKey={name} fill={user?.color || COLORS.primary}
                    radius={[3, 3, 0, 0]}
                    barSize={Math.max(4, Math.min(18, Math.floor(600 / (chartData.length * selectedUsers.length))))} />
                )
              })}
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false}
                tickFormatter={v => formatDate(v, period)} interval={period === 'daily' ? 6 : 0} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={32} />
              <Tooltip content={<MetricTooltip period={period} />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
              {selectedUsers.map(name => {
                const user = data.users.find(u => u.name === name)
                return (
                  <Line key={name} type="monotone" dataKey={name} stroke={user?.color || COLORS.primary}
                    strokeWidth={2} dot={false} activeDot={{ r: 4, fill: user?.color, stroke: '#fff', strokeWidth: 2 }} />
                )
              })}
            </LineChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <defs>
                {selectedUsers.map(name => {
                  const user = data.users.find(u => u.name === name)
                  return (
                    <linearGradient key={name} id={`areaGrad_${name.replace(/\s/g, '_')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={user?.color || COLORS.primary} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={user?.color || COLORS.primary} stopOpacity={0.02} />
                    </linearGradient>
                  )
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false}
                tickFormatter={v => formatDate(v, period)} interval={period === 'daily' ? 6 : 0} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={32} />
              <Tooltip content={<MetricTooltip period={period} />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
              {selectedUsers.map(name => {
                const user = data.users.find(u => u.name === name)
                return (
                  <Area key={name} type="monotone" dataKey={name} stroke={user?.color || COLORS.primary}
                    strokeWidth={2} fill={`url(#areaGrad_${name.replace(/\s/g, '_')})`}
                    dot={false} activeDot={{ r: 4, fill: user?.color, stroke: '#fff', strokeWidth: 2 }} />
                )
              })}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* ─── USER PERFORMANCE TABLE ──────────────────── */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
              Individual Performance
            </h3>
            <p className="text-[11px] font-medium tracking-wide uppercase mt-0.5" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>
              Detailed breakdown by user • {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} shown
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#FAFAFA', borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left px-6 py-3">
                  <span className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>User</span>
                </th>
                <th className="text-center px-4 py-3">
                  <span className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Today</span>
                </th>
                <th className="text-center px-4 py-3">
                  <span className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Last 7 Days</span>
                </th>
                <th className="text-center px-4 py-3">
                  <span className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Weekly Trend</span>
                </th>
                <th className="text-center px-4 py-3">
                  <span className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Last 30 Days</span>
                </th>
                <th className="text-center px-4 py-3">
                  <span className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Monthly Trend</span>
                </th>
                <th className="text-center px-4 py-3">
                  <span className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Total (90d)</span>
                </th>
                <th className="text-right px-6 py-3">
                  <span className="text-[11px] font-medium tracking-wide uppercase" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Spark</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.map((u, i) => (
                <tr key={u.id}
                  className="hover:bg-gray-50/50 transition-colors"
                  style={{ borderBottom: i < filteredSummaries.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white uppercase"
                        style={{ backgroundColor: u.color }}>
                        {u.name.charAt(0)}
                      </div>
                      <span className="text-[13px] font-semibold" style={{ color: COLORS.text }}>{u.name}</span>
                    </div>
                  </td>
                  <td className="text-center px-4 py-3.5">
                    <span className="text-[14px] font-bold tabular-nums" style={{ color: COLORS.text }}>{u.today}</span>
                  </td>
                  <td className="text-center px-4 py-3.5">
                    <span className="text-[14px] font-bold tabular-nums" style={{ color: COLORS.text }}>{u.last7}</span>
                  </td>
                  <td className="text-center px-4 py-3.5">
                    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      u.weeklyTrend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                    }`}>
                      {u.weeklyTrend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(u.weeklyTrend)}%
                    </span>
                  </td>
                  <td className="text-center px-4 py-3.5">
                    <span className="text-[14px] font-bold tabular-nums" style={{ color: COLORS.text }}>{u.last30}</span>
                  </td>
                  <td className="text-center px-4 py-3.5">
                    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      u.monthlyTrend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                    }`}>
                      {u.monthlyTrend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(u.monthlyTrend)}%
                    </span>
                  </td>
                  <td className="text-center px-4 py-3.5">
                    <span className="text-[15px] font-extrabold tabular-nums" style={{ color: COLORS.indigo }}>{u.total}</span>
                  </td>
                  <td className="px-6 py-3.5">
                    <MiniSparkline data={data.dailyData} userName={u.name} color={u.color} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── COMPARISON BAR CHART ────────────────────── */}
      <div className="bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
        <div className="mb-5">
          <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
            Period Comparison
          </h3>
          <p className="text-[11px] font-medium tracking-wide uppercase mt-0.5" style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>
            Today vs Last 7 Days vs Last 30 Days — side by side
          </p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={filteredSummaries} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.text, fontWeight: 500 }} tickLine={false} axisLine={false}
              tickFormatter={name => name?.split(' ')[0]} />
            <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={32} />
            <Tooltip content={<MetricTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
            <Bar dataKey="today" name="Today" fill={COLORS.primary} radius={[3, 3, 0, 0]} barSize={16} />
            <Bar dataKey="last7" name="Last 7 Days" fill={COLORS.teal} radius={[3, 3, 0, 0]} barSize={16} />
            <Bar dataKey="last30" name="Last 30 Days" fill={COLORS.amber} radius={[3, 3, 0, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ── Mini Sparkline (local wrapper around theme component) ── */

function MiniSparkline({ data, userName, color }) {
  const sparkData = data.slice(-14).map(d => ({ v: d[userName] || 0 }))
  return <ThemeMiniSparkline data={sparkData} color={color} />
}
