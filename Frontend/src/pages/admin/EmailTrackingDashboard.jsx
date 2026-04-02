import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiUrl } from '../../config'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  Mail, Users, AtSign, Download, Filter, ChevronDown,
  X, BarChart3, AlertCircle, CheckCircle,
} from 'lucide-react'
import { COLORS } from '../../theme/colors'
import { formatDate, timeAgo } from '../../theme/utils'

/* â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const EMPTY_DATA = {
  hrs: [],
  totalEmails: 0, totalHRs: 0, totalRecipients: 0, totalSent: 0, totalFailed: 0,
  chartData: [], hrStats: [],
}

const PERIOD_LABELS = {
  daily:   'Last 90 Days',
  weekly:  'Last 24 Weeks',
  monthly: 'Last 12 Months',
  yearly:  'Last 5 Years',
  custom:  'Custom Range',
}

/* â”€â”€ Custom Tooltip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function MetricTooltip({ active, payload, label, period }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-4 py-3 shadow-xl min-w-[180px]" style={{ backgroundColor: COLORS.tooltipBg }}>
      <p className="text-[10px] text-gray-400 mb-2 font-medium">
        {formatDate(label, period)}
      </p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-[11px] text-gray-300">{p.name}</span>
          </div>
          <span className="text-[12px] font-semibold text-white tabular-nums">{p.value}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex items-center justify-between gap-4 mt-2 pt-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="text-[10px] text-gray-400">Total</span>
          <span className="text-[12px] font-bold text-white tabular-nums">
            {payload.reduce((s, p) => s + (p.value || 0), 0)}
          </span>
        </div>
      )}
    </div>
  )
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   EMAIL TRACKING DASHBOARD
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export default function EmailTrackingDashboard() {
  const { getAuthHeaders } = useAuth()

  const [data, setData]           = useState(EMPTY_DATA)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [period, setPeriod]       = useState('daily')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [chartType, setChartType] = useState('bar')
  const [selectedHRs, setSelectedHRs] = useState([])  // [] means "all"
  const [hrDropdownOpen, setHrDropdownOpen] = useState(false)
  const [tableSearch, setTableSearch] = useState('')
  const [tablePage, setTablePage]     = useState(1)
  const TABLE_PAGE_SIZE = 10

  /* â”€â”€ Fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const fetchStats = useCallback(async () => {
    if (period === 'custom' && (!startDate || !endDate)) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ period })
      if (period === 'custom') {
        params.set('startDate', startDate)
        params.set('endDate', endDate)
      }
      const res = await fetch(apiUrl(`/email/admin/stats?${params}`), {
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
      // Default: select all HRs
      setSelectedHRs((json.hrs || []).map(h => h.name))
      setTablePage(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [period, startDate, endDate, getAuthHeaders])

  useEffect(() => { fetchStats() }, [fetchStats])

  /* â”€â”€ HR filter helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const allHRNames = useMemo(() => data.hrs.map(h => h.name), [data.hrs])
  const isAllSelected = selectedHRs.length === allHRNames.length

  const toggleHR = (name) => {
    setSelectedHRs(prev => {
      if (prev.includes(name)) {
        if (prev.length <= 1) return prev
        return prev.filter(n => n !== name)
      }
      return [...prev, name]
    })
  }
  const selectAll  = () => setSelectedHRs(allHRNames)
  const clearAll   = () => setSelectedHRs(allHRNames.length ? [allHRNames[0]] : [])

  /* â”€â”€ Filtered chart data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const chartData = useMemo(() => {
    if (!data.chartData.length) return []
    return data.chartData.map(row => {
      const filtered = { date: row.date }
      let total = 0
      selectedHRs.forEach(name => {
        filtered[name] = row[name] || 0
        total += row[name] || 0
      })
      filtered['Total'] = total
      return filtered
    })
  }, [data.chartData, selectedHRs])

  /* â”€â”€ Filtered HR stats table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const filteredHRStats = useMemo(() => {
    return (data.hrStats || [])
      .filter(hr => selectedHRs.includes(hr.name))
      .filter(hr => !tableSearch || hr.name.toLowerCase().includes(tableSearch.toLowerCase()))
  }, [data.hrStats, selectedHRs, tableSearch])

  const totalTablePages = Math.max(1, Math.ceil(filteredHRStats.length / TABLE_PAGE_SIZE))
  const pagedHRStats = filteredHRStats.slice(
    (tablePage - 1) * TABLE_PAGE_SIZE,
    tablePage * TABLE_PAGE_SIZE,
  )

  /* â”€â”€ KPIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const kpiDefs = [
    { label: 'Total Emails Sent', value: data.totalEmails.toLocaleString(), icon: Mail, bg: 'var(--dash-tint-blue)', iconColor: COLORS.primary },
    { label: 'Active HRs', value: data.totalHRs, icon: Users, bg: 'var(--dash-tint-green)', iconColor: COLORS.teal },
    { label: 'Unique Recipients', value: data.totalRecipients.toLocaleString(), icon: AtSign, bg: 'var(--dash-tint-amber)', iconColor: COLORS.amber },
    { label: 'Failed Emails', value: data.totalFailed.toLocaleString(), icon: AlertCircle, bg: '#FEF2F2', iconColor: '#DC2626' },
  ]

  /* â”€â”€ CSV Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function handleExport() {
    const rows = [
      ['HR Name', 'Emails Sent', 'Sent OK', 'Failed', 'Unique Recipients', 'Provider', 'Last Email'],
      ...(data.hrStats || []).map(hr => [
        hr.name, hr.totalEmails, hr.sent, hr.failed,
        hr.uniqueRecipients, hr.provider,
        hr.lastEmailSent ? new Date(hr.lastEmailSent).toLocaleDateString() : '',
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `email-tracking-${period}-${new Date().toISOString().slice(0, 10)}.csv`,
    })
    a.click(); URL.revokeObjectURL(a.href)
  }

  /* â”€â”€ Loading state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: COLORS.primary }} />
      <span className="ml-3 text-sm" style={{ color: COLORS.secondary }}>Loading email stats...</span>
    </div>
  )

  /* â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  return (
    <div className="space-y-6">

      {/* â”€â”€ Page Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div>
        <p className="text-[11px] font-medium tracking-wide uppercase"
          style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>Email Analytics</p>
        <h2 className="text-2xl font-extrabold tracking-tight mt-0.5"
          style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
          HR Email Performance
        </h2>
        <p className="text-[11px] font-medium tracking-wide uppercase mt-1"
          style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>
          Track and compare email activity across HRs over any time period
        </p>
      </div>

      {/* â”€â”€ Error Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-medium"
          style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load email stats: {error}
        </div>
      )}

      {/* â”€â”€ Filters Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white rounded-xl p-4 flex flex-wrap items-center gap-3"
        style={{ border: `1px solid ${COLORS.border}` }}>

        {/* Period Toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            {['daily', 'weekly', 'monthly', 'yearly'].map(p => (
              <button key={p} onClick={() => { setPeriod(p); setTablePage(1) }}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-md capitalize transition-all ${
                  period === p ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}>{p}</button>
            ))}
            <button onClick={() => { setPeriod('custom'); setTablePage(1) }}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                period === 'custom' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}>Custom</button>
          </div>
        </div>

        {/* Custom date inputs */}
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="rounded-lg px-2 py-1.5 text-[12px] outline-none"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
            <span className="text-[12px]" style={{ color: COLORS.secondary }}>to</span>
            <input type="date" value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="rounded-lg px-2 py-1.5 text-[12px] outline-none"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
          </div>
        )}

        <div className="w-px h-7 bg-gray-200 hidden sm:block" />

        {/* HR Filter Dropdown */}
        <div className="relative">
          <button onClick={() => setHrDropdownOpen(!hrDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all hover:bg-gray-50"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}>
            <Filter className="h-3.5 w-3.5" style={{ color: COLORS.secondary }} />
            <span>{isAllSelected ? 'All HRs' : `${selectedHRs.length} HR${selectedHRs.length > 1 ? 's' : ''}`}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${hrDropdownOpen ? 'rotate-180' : ''}`}
              style={{ color: COLORS.secondary }} />
          </button>
          {hrDropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setHrDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-1 z-40 bg-white rounded-xl shadow-xl py-2 min-w-[220px]"
                style={{ border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between px-3 py-1.5 mb-1"
                  style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <button onClick={selectAll} className="text-[11px] font-medium text-blue-600 hover:text-blue-700">Select All</button>
                  <button onClick={clearAll}  className="text-[11px] font-medium text-gray-400 hover:text-gray-600">Clear</button>
                </div>
                {data.hrs.length === 0 && (
                  <p className="px-3 py-2 text-[12px]" style={{ color: COLORS.secondary }}>No HRs found</p>
                )}
                {data.hrs.map(hr => {
                  const checked = selectedHRs.includes(hr.name)
                  return (
                    <button key={hr.id + hr.name} onClick={() => toggleHR(hr.name)}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left">
                      <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                        checked ? 'border-blue-600' : 'border-gray-300'
                      }`} style={{ backgroundColor: checked ? hr.color : 'transparent' }}>
                        {checked && <span className="text-white text-[10px] font-bold">&#10003;</span>}
                      </div>
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: hr.color }} />
                      <span className="text-[12px] font-medium" style={{ color: COLORS.text }}>{hr.name}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Selected HR chips */}
        {!isAllSelected && (
          <div className="flex flex-wrap gap-1.5">
            {selectedHRs.map(name => {
              const hr = data.hrs.find(h => h.name === name)
              return (
                <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: (hr?.color || '#2563EB') + '18', color: hr?.color || '#2563EB', border: `1px solid ${(hr?.color || '#2563EB')}30` }}>
                  {name.split(' ')[0]}
                  <button onClick={() => toggleHR(name)} className="hover:opacity-70 ml-0.5">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        <div className="flex-1" />

        {/* Export CSV */}
        <button onClick={handleExport}
          disabled={!data.hrStats?.length}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40"
          style={{ backgroundColor: COLORS.primary, color: '#fff' }}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>

        {/* Chart Type Toggle */}
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
          {[{ key: 'bar', label: 'Bar' }, { key: 'line', label: 'Line' }, { key: 'area', label: 'Area' }].map(ct => (
            <button key={ct.key} onClick={() => setChartType(ct.key)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                chartType === ct.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}>{ct.label}</button>
          ))}
        </div>
      </div>

      {/* â”€â”€ KPI Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiDefs.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} className="bg-white rounded-2xl p-5 hover:shadow-lg transition-all duration-300"
              style={{ border: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: kpi.bg }}>
                  <Icon className="h-[18px] w-[18px]" style={{ color: kpi.iconColor }} />
                </div>
              </div>
              <p className="text-[11px] font-medium tracking-wide uppercase"
                style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>{kpi.label}</p>
              <p className="text-[26px] font-extrabold tracking-tight mt-0.5"
                style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{kpi.value}</p>
            </div>
          )
        })}
      </div>

      {/* â”€â”€ Main Chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight"
              style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
              Email Activity - {period.charAt(0).toUpperCase() + period.slice(1)} View
            </h3>
            <p className="text-[11px] font-medium tracking-wide uppercase mt-0.5"
              style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>
              {PERIOD_LABELS[period]} &bull; {selectedHRs.length} HR{selectedHRs.length > 1 ? 's' : ''} selected
            </p>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <BarChart3 className="h-8 w-8 opacity-20" style={{ color: COLORS.secondary }} />
            <p className="text-[13px]" style={{ color: COLORS.secondary }}>No email data for this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            {chartType === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false}
                  tickFormatter={v => formatDate(v, period)} interval={period === 'daily' ? 6 : 0} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip content={<MetricTooltip period={period} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
                {selectedHRs.map(name => {
                  const hr = data.hrs.find(h => h.name === name)
                  return (
                    <Bar key={name} dataKey={name} fill={hr?.color || COLORS.primary}
                      radius={[3, 3, 0, 0]}
                      barSize={Math.max(4, Math.min(18, Math.floor(600 / (chartData.length * selectedHRs.length))))} />
                  )
                })}
              </BarChart>
            ) : chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false}
                  tickFormatter={v => formatDate(v, period)} interval={period === 'daily' ? 6 : 0} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip content={<MetricTooltip period={period} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
                {selectedHRs.map(name => {
                  const hr = data.hrs.find(h => h.name === name)
                  return (
                    <Line key={name} type="monotone" dataKey={name} stroke={hr?.color || COLORS.primary}
                      strokeWidth={2} dot={false}
                      activeDot={{ r: 4, fill: hr?.color, stroke: '#fff', strokeWidth: 2 }} />
                  )
                })}
              </LineChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  {selectedHRs.map(name => {
                    const hr = data.hrs.find(h => h.name === name)
                    const safeId = `emailGrad_${name.replace(/\W/g, '_')}`
                    return (
                      <linearGradient key={name} id={safeId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={hr?.color || COLORS.primary} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={hr?.color || COLORS.primary} stopOpacity={0.02} />
                      </linearGradient>
                    )
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false}
                  tickFormatter={v => formatDate(v, period)} interval={period === 'daily' ? 6 : 0} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip content={<MetricTooltip period={period} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
                {selectedHRs.map(name => {
                  const hr = data.hrs.find(h => h.name === name)
                  const safeId = `emailGrad_${name.replace(/\W/g, '_')}`
                  return (
                    <Area key={name} type="monotone" dataKey={name} stroke={hr?.color || COLORS.primary}
                      strokeWidth={2} fill={`url(#${safeId})`}
                      dot={false} activeDot={{ r: 4, fill: hr?.color, stroke: '#fff', strokeWidth: 2 }} />
                  )
                })}
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* â”€â”€ HR Performance Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
        {/* Table header */}
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
          style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight"
              style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
              HR Email Activity
            </h3>
            <p className="text-[11px] font-medium tracking-wide uppercase mt-0.5"
              style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>
              Detailed breakdown by HR {filteredHRStats.length} HR{filteredHRStats.length !== 1 ? 's' : ''} shown
            </p>
          </div>
          {/* Table search */}
          <input
            type="text"
            placeholder="Search HR name..."
            value={tableSearch}
            onChange={e => { setTableSearch(e.target.value); setTablePage(1) }}
            className="rounded-lg px-3 py-1.5 text-[12px] outline-none w-52"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text, backgroundColor: '#F8FAFC' }}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-row-alt)', borderBottom: `1px solid ${COLORS.border}` }}>
                {['HR Name', 'Emails Sent', 'Sent OK', 'Failed', 'Unique Recipients', 'Email Provider', 'Last Email'].map(col => (
                  <th key={col} className={`${col === 'HR Name' ? 'text-left px-6' : 'text-center px-4'} py-3`}>
                    <span className="text-[11px] font-medium tracking-wide uppercase"
                      style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>{col}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedHRStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[13px]" style={{ color: COLORS.secondary }}>
                    {tableSearch ? 'No HRs match your search.' : 'No email activity found for this period.'}
                  </td>
                </tr>
              ) : (
                pagedHRStats.map((hr, i) => (
                  <tr key={hr.id + hr.name} className="hover:bg-gray-50/50 transition-colors"
                    style={{ borderBottom: i < pagedHRStats.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
                    {/* HR Name */}
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white uppercase"
                          style={{ backgroundColor: hr.color }}>
                          {(hr.name || '?').charAt(0)}
                        </div>
                        <span className="text-[13px] font-semibold" style={{ color: COLORS.text }}>{hr.name}</span>
                      </div>
                    </td>
                    {/* Emails Sent */}
                    <td className="text-center px-4 py-3.5">
                      <span className="text-[14px] font-bold tabular-nums" style={{ color: COLORS.text }}>
                        {hr.totalEmails.toLocaleString()}
                      </span>
                    </td>
                    {/* Sent OK */}
                    <td className="text-center px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: '#ECFDF5', color: COLORS.teal }}>
                        <CheckCircle className="h-3 w-3" />
                        {hr.sent.toLocaleString()}
                      </span>
                    </td>
                    {/* Failed */}
                    <td className="text-center px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: hr.failed > 0 ? '#FEF2F2' : '#F9FAFB', color: hr.failed > 0 ? '#DC2626' : COLORS.secondary }}>
                        {hr.failed > 0 && <AlertCircle className="h-3 w-3" />}
                        {hr.failed.toLocaleString()}
                      </span>
                    </td>
                    {/* Unique Recipients */}
                    <td className="text-center px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: '#EFF6FF', color: COLORS.primary }}>
                        {hr.uniqueRecipients.toLocaleString()}
                      </span>
                    </td>
                    {/* Provider */}
                    <td className="text-center px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                        style={{
                          backgroundColor: hr.provider === 'gmail' ? '#FEF3C7' : hr.provider === 'outlook' ? '#EFF6FF' : '#F3F4F6',
                          color: hr.provider === 'gmail' ? '#D97706' : hr.provider === 'outlook' ? COLORS.primary : COLORS.secondary,
                        }}>
                        {hr.provider || '-'}
                      </span>
                    </td>
                    {/* Last Email */}
                    <td className="text-center px-4 py-3.5 text-[12px]" style={{ color: COLORS.secondary }}>
                      {hr.lastEmailSent ? timeAgo(hr.lastEmailSent) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalTablePages > 1 && (
          <div className="flex items-center justify-between px-6 py-3"
            style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <p className="text-[12px]" style={{ color: COLORS.secondary }}>
              Showing {Math.min((tablePage - 1) * TABLE_PAGE_SIZE + 1, filteredHRStats.length)}-{Math.min(tablePage * TABLE_PAGE_SIZE, filteredHRStats.length)} of {filteredHRStats.length}
            </p>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalTablePages }, (_, i) => i + 1).map(pg => (
                <button key={pg} onClick={() => setTablePage(pg)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-medium transition-colors"
                  style={{
                    border: `1px solid ${pg === tablePage ? COLORS.primary : COLORS.border}`,
                    backgroundColor: pg === tablePage ? COLORS.primary : 'transparent',
                    color: pg === tablePage ? '#fff' : COLORS.secondary,
                  }}>{pg}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€ Comparison Bar Chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {data.hrStats && data.hrStats.length > 0 && (
        <div className="bg-white rounded-xl p-6" style={{ border: `1px solid ${COLORS.border}` }}>
          <div className="mb-5">
            <h3 className="text-[15px] font-extrabold tracking-tight"
              style={{ color: COLORS.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
              HR Comparison
            </h3>
            <p className="text-[11px] font-medium tracking-wide uppercase mt-0.5"
              style={{ color: COLORS.secondary, letterSpacing: '0.04em' }}>
              Emails sent vs unique recipients - side by side
            </p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={filteredHRStats.slice(0, 15)}
              margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name"
                tick={{ fontSize: 11, fill: COLORS.text, fontWeight: 500 }}
                tickLine={false} axisLine={false}
                tickFormatter={n => n?.split(' ')[0]} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <Tooltip
                formatter={(value, name) => [value.toLocaleString(), name]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
                cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
              <Bar dataKey="totalEmails" name="Emails Sent"        fill={COLORS.primary} radius={[3, 3, 0, 0]} barSize={16} />
              <Bar dataKey="uniqueRecipients" name="Unique Recipients" fill={COLORS.teal}   radius={[3, 3, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  )
}
