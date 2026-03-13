import { useState, useMemo } from 'react'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatusDot({ active }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
  )
}

export default function UserPerformanceTable({ users = [] }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('resumes_uploaded')
  const [sortDir, setSortDir] = useState('desc')

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    let result = users
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(u => u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    }
    result = [...result].sort((a, b) => {
      const aVal = a[sortKey] ?? 0
      const bVal = b[sortKey] ?? 0
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })
    return result
  }, [users, search, sortKey, sortDir])

  const columns = [
    { key: 'username',          label: 'User Name',       sortable: true },
    { key: 'last_login',        label: 'Last Login',      sortable: true },
    { key: 'daily_uploads',     label: 'Daily Uploads',   sortable: true },
    { key: 'weekly_uploads',    label: 'Weekly Uploads',  sortable: true },
    { key: 'monthly_uploads',   label: 'Monthly Uploads', sortable: true },
    { key: 'resumes_uploaded',  label: 'Total Resumes',   sortable: true },
  ]

  const maxResumes = Math.max(...users.map(u => u.resumes_uploaded || 1), 1)

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 px-6 py-4 gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-gray-900">User Activity Table</h3>
          <p className="text-[12px] text-gray-400 mt-0.5">{users.length} total users</p>
        </div>
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-56 rounded-xl border border-gray-200 bg-gray-50/50 pl-9 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/30">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap ${
                    col.sortable ? 'cursor-pointer hover:text-gray-600 select-none' : ''
                  }`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <svg className={`w-3 h-3 transition ${sortDir === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-gray-400">No users found</td></tr>
            ) : (
              filtered.map(u => (
                <tr key={u.id} className="group hover:bg-blue-50/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white uppercase flex-shrink-0 shadow-sm">
                        {u.username?.charAt(0) || '?'}
                      </div>
                      <div>
                        <span className="text-[13px] font-medium text-gray-900">{u.username}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <StatusDot active={u.is_active} />
                          <span className={`text-[11px] font-medium ${u.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            u.role === 'admin' ? 'bg-violet-50 text-violet-700' : 'bg-gray-100 text-gray-500'
                          }`}>{u.role.replace(/_/g, ' ').replace('superuser', 'super user')}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-gray-500 whitespace-nowrap">{formatDate(u.last_login)}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] font-semibold text-gray-900 tabular-nums">{u.daily_uploads ?? 0}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] font-semibold text-gray-900 tabular-nums">{u.weekly_uploads ?? 0}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] font-semibold text-gray-900 tabular-nums">{u.monthly_uploads ?? 0}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-bold text-gray-900 tabular-nums w-8 text-right">
                        {u.resumes_uploaded ?? 0}
                      </span>
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-700"
                          style={{ width: `${Math.min(100, ((u.resumes_uploaded ?? 0) / maxResumes) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
