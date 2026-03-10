/**
 * AdminResumes.jsx
 * =================
 * Admin page: browse all resumes uploaded by users with statistics
 *
 * Route:  /admin/resumes
 * Guard:  requires role === 'admin'
 *
 * Shows:
 *  - Total resumes uploaded
 *  - Resumes per user
 *  - Upload timestamps
 *  - User information
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl } from '../config'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminResumes() {
  const { getAuthHeaders } = useAuth()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(apiUrl('/api/auth/admin/users'), { headers: getAuthHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to load users')
      // Filter to users who have uploaded resumes
      const withResumes = data.filter(u => u.resumes_uploaded > 0)
      setUsers(withResumes.sort((a, b) => b.resumes_uploaded - a.resumes_uploaded))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [getAuthHeaders])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const totalResumes = users.reduce((sum, u) => sum + (u.resumes_uploaded || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Resume Uploads</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Track resumes uploaded by users</p>
        </div>
        <button onClick={fetchUsers}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-[12px] font-medium uppercase tracking-wider text-gray-400">Total Resumes Uploaded</p>
        <p className="mt-2 text-3xl font-bold text-violet-600 tabular-nums">{totalResumes}</p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-500" />
        </div>
      ) : error ? (
        <div className="text-center text-[14px] text-red-500 py-16">{error}</div>
      ) : users.length === 0 ? (
        <div className="text-center text-[13px] text-gray-400 py-16">No resumes uploaded yet.</div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Username', 'Email', 'Role', 'Resumes Uploaded', 'Last Upload', 'Created At'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white uppercase flex-shrink-0">
                        {u.username?.charAt(0)}
                      </div>
                      <span className="text-[13px] font-medium text-gray-900">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-gray-500">{u.email || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      u.role === 'admin' ? 'bg-violet-50 text-violet-700' : 'bg-gray-100 text-gray-600'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-0.5 text-[13px] font-semibold tabular-nums">
                      {u.resumes_uploaded}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-gray-500 whitespace-nowrap">{formatDate(u.last_login)}</td>
                  <td className="px-5 py-3.5 text-[13px] text-gray-500 whitespace-nowrap">{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        * Resume count is tracked per user. Click "History" in User Management to see upload details per session.
      </p>
    </div>
  )
}
