import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiUrl } from '../../config'

const STATUS_META = {
  completed:    { label: 'Parsed',       cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  failed:       { label: 'Failed',       cls: 'bg-red-50 text-red-600 ring-1 ring-red-200' },
  not_a_resume: { label: 'Not a Resume', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  unknown:      { label: 'Unknown',      cls: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200' },
}

function formatDate(iso) {
  if (!iso) return '—'
  const utc = (typeof iso === 'string' && !iso.endsWith('Z') && !iso.includes('+'))
    ? iso + 'Z' : iso
  const d = new Date(utc)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function UploadLog() {
  const { getAuthHeaders } = useAuth()
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [userFilter, setUserFilter]     = useState('all')
  const [users, setUsers]       = useState([]) // distinct uploaders

  const fetchLog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/admin/upload-log'), { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setRows(data)
        // Build distinct uploader list
        const seen = new Map()
        data.forEach(r => {
          if (r.uploader_id && !seen.has(r.uploader_id)) {
            seen.set(r.uploader_id, r.uploader_username)
          }
        })
        setUsers([...seen.entries()].map(([id, name]) => ({ id, name })))
      }
    } catch (e) { console.error('Failed to fetch upload log:', e) }
    finally { setLoading(false) }
  }, [getAuthHeaders])

  useEffect(() => { fetchLog() }, [fetchLog])

  const filtered = rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (userFilter !== 'all' && String(r.uploader_id) !== userFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const name = `${r.first_name} ${r.last_name}`.toLowerCase()
      return (
        name.includes(q) ||
        (r.resume_filename || '').toLowerCase().includes(q) ||
        (r.job_title || '').toLowerCase().includes(q) ||
        (r.uploader_username || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2
          className="text-xl font-extrabold tracking-tight text-gray-900"
          style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
        >
          Upload Log
        </h2>
        <p
          className="text-[11px] font-medium tracking-wide uppercase mt-1"
          style={{ color: 'var(--dash-secondary, #6B7280)', letterSpacing: '0.04em' }}
        >
          Every resume uploaded — candidate name, file, uploader, date
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search name, file, job title, uploader…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-72 rounded-xl border border-gray-200 bg-gray-50/50 pl-9 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[12px] font-medium text-gray-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Parsed</option>
          <option value="failed">Failed</option>
          <option value="not_a_resume">Not a Resume</option>
        </select>

        {/* Uploader filter */}
        <select
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
          className="h-9 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[12px] font-medium text-gray-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
        >
          <option value="all">All Uploaders</option>
          {users.map(u => (
            <option key={u.id} value={String(u.id)}>{u.name}</option>
          ))}
        </select>

        {/* Refresh */}
        <button
          onClick={fetchLog}
          className="ml-auto flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 h-9 text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>

        <span
          className="text-[11px] font-medium tracking-wide uppercase"
          style={{ color: 'var(--dash-secondary, #6B7280)', letterSpacing: '0.04em' }}
        >
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[13px] text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-gray-400">No records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">#</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Candidate</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Job Title</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Resume File</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Uploaded By</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Date</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r, i) => {
                  const sm = STATUS_META[r.status] ?? STATUS_META.unknown
                  const candidateName = [r.first_name, r.last_name].filter(Boolean).join(' ') || '—'
                  const initials = [r.first_name?.[0], r.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-gray-400 font-mono text-[11px]">{i + 1}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white shadow-sm">
                            {initials}
                          </div>
                          <span className="font-medium text-gray-800 truncate max-w-[160px]">{candidateName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 truncate max-w-[160px]">{r.job_title || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className="inline-block max-w-[220px] truncate rounded-lg bg-gray-100 px-2.5 py-1 font-mono text-[11px] text-gray-600"
                          title={r.resume_filename}
                        >
                          {r.resume_filename || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-800">{r.uploader_username}</span>
                          {r.uploader_email && (
                            <span className="text-[11px] text-gray-400 truncate max-w-[160px]">{r.uploader_email}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-[12px]">{formatDate(r.parsed_at)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${sm.cls}`}>
                          {sm.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
