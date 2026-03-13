import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiUrl } from '../../config'


function timeAgo(iso) {
  if (!iso) return ''
  const now = new Date()
  // Postgres returns UTC timestamps without 'Z'; append it so the browser
  // doesn't misinterpret them as local time (causes ~5h offset in IST).
  const isoUtc = (typeof iso === 'string' && !iso.endsWith('Z') && !iso.includes('+')) ? iso + 'Z' : iso
  const then = new Date(isoUtc)
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr  = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr  < 24) return `${diffHr}h ago`
  if (diffDay < 7)  return `${diffDay}d ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function generateSampleActivity() {
  return []
}

const eventMeta = {
  upload: {
    bg: 'bg-violet-50',
    ring: 'ring-violet-200',
    icon: (
      <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
  login: {
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
    icon: (
      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
      </svg>
    ),
  },
}

const typeFilters = [
  { key: 'all',    label: 'All' },
  { key: 'login',  label: 'Logins' },
  { key: 'upload', label: 'Uploads' },
]

export default function ActivityLog() {
  const { getAuthHeaders } = useAuth()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/admin/activity-log'), { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setActivities(data)
      }
    } catch (e) { console.error('Failed to fetch activity:', e) }
    finally { setLoading(false) }
  }, [getAuthHeaders])

  useEffect(() => {
    fetchActivity()
    const interval = setInterval(fetchActivity, 30 * 1000) // auto-refresh every 30 seconds
    return () => clearInterval(interval)
  }, [fetchActivity])

  const filtered = activities.filter(a => {
    const hasUpload = (a.resumes_uploaded_this_session ?? 0) > 0
    const type = hasUpload ? 'upload' : 'login'
    if (filter !== 'all' && type !== filter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (a.username?.toLowerCase().includes(q) || a.ip_address?.toLowerCase().includes(q))
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-gray-900" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Activity Logs</h2>
        <p className="text-[11px] font-medium tracking-wide uppercase mt-1" style={{ color: 'var(--dash-secondary, #6B7280)', letterSpacing: '0.04em' }}>Complete log of user logins and resume uploads</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl">
          {typeFilters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition ${
                filter === f.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search by user or IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-64 rounded-xl border border-gray-200 bg-gray-50/50 pl-9 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
          />
        </div>
        <span className="ml-auto text-[11px] font-medium tracking-wide uppercase" style={{ color: 'var(--dash-secondary, #6B7280)', letterSpacing: '0.04em' }}>{filtered.length} events</span>
      </div>

      {/* Log list */}
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-gray-400">No activity found</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((a, i) => {
              const hasUpload = (a.resumes_uploaded_this_session ?? 0) > 0
              const ev = hasUpload ? eventMeta.upload : eventMeta.login
              return (
                <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${ev.bg} ring-1 ${ev.ring}`}>
                    {ev.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-700 truncate">
                      <span className="font-bold text-gray-900">{a.username}</span>
                      {' '}
                      {hasUpload
                        ? <>uploaded <span className="font-semibold text-violet-600">{a.resumes_uploaded_this_session}</span> resume{a.resumes_uploaded_this_session !== 1 ? 's' : ''}</>
                        : 'logged in'
                      }
                    </p>
                    {a.ip_address && (
                      <p className="text-[11px] font-medium text-gray-400 mt-0.5 font-mono">{a.ip_address}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      hasUpload ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {hasUpload ? 'Upload' : 'Login'}
                    </span>
                    <p className="text-[11px] font-medium text-gray-400 mt-1">{timeAgo(a.logged_in_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
