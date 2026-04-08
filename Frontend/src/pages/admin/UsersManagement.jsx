/**
 * UsersManagement.jsx
 * Extracted from the original AdminDashboard.jsx – full user management CRUD.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { apiUrl } from '../../config'

function formatDate(iso) {
  if (!iso) return '—'
  // Ensure UTC interpretation if no timezone suffix present
  const dateStr = typeof iso === 'string' && !iso.endsWith('Z') && !iso.includes('+') ? iso + 'Z' : iso
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function RoleBadge({ role }) {
  const isSuperuser = role === 'superuser' || role === 'admin'
  const cls = isSuperuser
    ? 'bg-violet-50 text-violet-700'
    : role === 'upload_user'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {role.replace(/_/g, ' ').replace('superuser', 'super user')}
    </span>
  )
}

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-400">
      <span className="h-2 w-2 rounded-full bg-gray-300" />Disabled
    </span>
  )
}

/* ── Modals ─────────────────────────────────────────────────────────────────── */
function ModalOverlay({ children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      {children}
    </div>
  )
}

function CreateUserModal({ onClose, onCreated, getAuthHeaders }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user', showPwd: false })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setErr(null)
    try {
      const res = await fetch(apiUrl('/api/auth/admin/create-user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      onCreated(); onClose()
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const inp = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

  return (
    <ModalOverlay>
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <h2 className="text-[16px] font-extrabold tracking-tight text-gray-900 mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Create User</h2>
        <p className="text-[12px] font-medium text-gray-500 mb-4">Fill in the details to add a new user</p>
        {err && <p className="mb-3 text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        <form onSubmit={submit} className="space-y-3">
          <input required className={inp} placeholder="Username" value={form.username} onChange={e => setForm(f=>({...f, username: e.target.value.toLowerCase()}))} style={{ textTransform: 'lowercase' }} />
          <input className={inp} placeholder="Email (optional)" value={form.email} onChange={e => setForm(f=>({...f, email: e.target.value}))} type="email" />
          <div className="relative">
            <input required className={inp + ' pr-10'} placeholder="Password (min 6)" value={form.password} onChange={e => setForm(f=>({...f, password: e.target.value}))} type={form.showPwd ? 'text' : 'password'} minLength={6} />
            <button type="button" onClick={() => setForm(f=>({...f, showPwd: !f.showPwd}))} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs" tabIndex={-1}>{form.showPwd ? 'Hide' : 'Show'}</button>
          </div>
          <select className={inp} value={form.role} onChange={e => setForm(f=>({...f, role: e.target.value}))}>
            <option value="user">user</option>
            <option value="upload_user">upload user</option>
            <option value="superuser">super user</option>
          </select>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-[13px] font-medium text-white hover:bg-blue-700 transition disabled:opacity-50">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

function ResetPasswordModal({ target, onClose, onDone, getAuthHeaders }) {
  const [newPwd, setNewPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setErr(null)
    try {
      const res = await fetch(apiUrl(`/api/auth/admin/reset-password/${target.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ new_password: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      setOk(true)
      setTimeout(() => { onDone(); onClose() }, 1000)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const inp = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

  return (
    <ModalOverlay>
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <h2 className="text-[16px] font-extrabold tracking-tight text-gray-900 mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Reset Password</h2>
        <p className="text-[12px] font-medium text-gray-500 mb-4">For user <span className="font-semibold text-gray-900">{target.username}</span></p>
        {err && <p className="mb-3 text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        {ok && <p className="mb-3 text-[12px] text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">Password reset successfully</p>}
        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <input required className={inp + ' pr-10'} type={showPwd ? 'text' : 'password'} placeholder="New password (min 6)" minLength={6} value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs" tabIndex={-1}>{showPwd ? 'Hide' : 'Show'}</button>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading || ok} className="flex-1 rounded-lg bg-amber-500 py-2.5 text-[13px] font-medium text-white hover:bg-amber-600 transition disabled:opacity-50">
              {loading ? 'Resetting...' : 'Reset'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

function DeleteConfirmModal({ target, onClose, onDeleted, getAuthHeaders }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  async function confirmDelete() {
    setLoading(true); setErr(null)
    try {
      const res = await fetch(apiUrl(`/api/auth/admin/delete-user/${target.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      let data
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        const text = await res.text()
        data = { detail: text || `Server error (${res.status})` }
      }
      if (!res.ok) throw new Error(data.detail || 'Failed to delete user')
      onDeleted(); onClose()
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <ModalOverlay>
      <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 shadow-2xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 mb-3">
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-[16px] font-extrabold tracking-tight text-gray-900 mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Delete User</h2>
        <p className="text-[13px] font-medium text-gray-500 mb-4">
          Permanently delete <span className="font-semibold text-gray-900">{target.username}</span>? This cannot be undone.
        </p>
        {err && <p className="mb-3 text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={confirmDelete} disabled={loading} className="flex-1 rounded-lg bg-red-600 py-2.5 text-[13px] font-medium text-white hover:bg-red-700 transition disabled:opacity-50">
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

function LoginHistoryModal({ target, onClose, getAuthHeaders }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(apiUrl(`/api/auth/admin/login-sessions/${target.id}`), { headers: getAuthHeaders() })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Failed')
        setSessions(Array.isArray(data) ? data : [])
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [target.id, getAuthHeaders])

  return (
    <ModalOverlay>
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-[16px] font-extrabold tracking-tight text-gray-900" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Login History</h2>
            <p className="text-[12px] font-medium text-gray-500 mt-0.5">
              <span className="font-semibold text-gray-900">{target.username}</span> — {sessions.length} sessions
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="text-center text-[13px] text-gray-400 py-10">Loading...</div>
          ) : error ? (
            <div className="text-center text-[13px] text-red-500 py-10">{error}</div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-[13px] text-gray-400 py-10">No sessions recorded</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--dash-secondary, #6B7280)', letterSpacing: '0.04em' }}>#</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--dash-secondary, #6B7280)', letterSpacing: '0.04em' }}>Date</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--dash-secondary, #6B7280)', letterSpacing: '0.04em' }}>IP</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--dash-secondary, #6B7280)', letterSpacing: '0.04em' }}>Uploads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map((s, i) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition">
                    <td className="px-3 py-2.5 text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2.5 text-gray-900 whitespace-nowrap">{formatDate(s.logged_in_at)}</td>
                    <td className="px-3 py-2.5 text-gray-500 font-mono">{s.ip_address || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        (s.resumes_uploaded_this_session || 0) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {s.resumes_uploaded_this_session || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t border-gray-100 px-6 py-3">
          <button onClick={onClose} className="w-full rounded-lg border border-gray-200 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">Close</button>
        </div>
      </div>
    </ModalOverlay>
  )
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
export default function UsersManagement() {
  const { getAuthHeaders, logout } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [resetRequests, setResetRequests] = useState([])

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null) }
    try {
      const res = await fetch(apiUrl('/api/auth/admin/users'), { headers: getAuthHeaders() })
      if (res.status === 401) {
        logout()
        navigate('/dashboard')
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to load users')
      setUsers(data)
    } catch (e) { if (!silent) setError(e.message) }
    finally { if (!silent) setLoading(false) }
  }, [getAuthHeaders, logout, navigate])

  const fetchResetRequests = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/admin/reset-requests'), { headers: getAuthHeaders() })
      const data = await res.json()
      if (res.ok) setResetRequests(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }, [getAuthHeaders])

  useEffect(() => {
    fetchUsers(); fetchResetRequests()
    const interval = setInterval(() => { fetchUsers(true); fetchResetRequests() }, 30000)
    return () => clearInterval(interval)
  }, [fetchUsers, fetchResetRequests])

  async function toggleUser(id) {
    try {
      const res = await fetch(apiUrl(`/api/auth/admin/toggle-user/${id}`), { method: 'PATCH', headers: getAuthHeaders() })
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail) }
      fetchUsers()
    } catch (e) { alert(e.message) }
  }

  async function dismissResetRequest(id) {
    try {
      await fetch(apiUrl(`/api/auth/admin/reset-requests/${id}`), { method: 'DELETE', headers: getAuthHeaders() })
      fetchResetRequests()
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>User Management</h1>
          <p className="text-[13px] font-medium text-gray-500 mt-0.5">{users.length} users registered</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchUsers()}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Refresh
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New User
          </button>
        </div>
      </div>

      {/* Pending Reset Requests */}
      {resetRequests.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="flex items-center gap-2 text-[13px] font-bold tracking-tight text-amber-800 mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {resetRequests.length} Pending Password Reset Request{resetRequests.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {resetRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5">
                <div>
                  <span className="text-[13px] font-medium text-gray-900">{req.username}</span>
                  <span className="ml-3 text-[11px] text-gray-400">{formatDate(req.requested_at)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setResetTarget({ id: req.user_id, username: req.username })}
                    className="rounded-lg border border-amber-300 px-3 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50 transition">
                    Reset Pwd
                  </button>
                  <button onClick={() => dismissResetRequest(req.id)}
                    className="rounded-lg border border-gray-200 px-3 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-50 transition">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-500" />
        </div>
      ) : error ? (
        <div className="text-center text-[14px] text-red-500 py-16">{error}</div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Username', 'Email', 'Role', 'Status', 'Total Logins', 'Resumes', 'Last Login', 'Created', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--dash-secondary, #6B7280)', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="group hover:bg-gray-50/50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white uppercase flex-shrink-0">
                          {u.username?.charAt(0)}
                        </div>
                        <span className="text-[13px] font-medium text-gray-900">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-gray-500">{u.email || '—'}</td>
                    <td className="px-5 py-3.5"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-3.5"><StatusBadge active={u.is_active} /></td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-gray-900 tabular-nums text-center">{u.total_logins}</td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-gray-900 tabular-nums text-center">{u.resumes_uploaded}</td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-gray-500 whitespace-nowrap">{formatDate(u.last_login)}</td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-gray-500 whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => toggleUser(u.id)}
                          className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                            u.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                          }`}>
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => setResetTarget(u)}
                          className="rounded-md px-2 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-50 transition">
                          Reset Pwd
                        </button>
                        {!(u.role === 'superuser' && users.filter(x => x.role === 'superuser').length <= 1) && (
                          <button onClick={() => setDeleteTarget(u)}
                            className="rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="text-center text-[13px] text-gray-400 py-10">No users found</div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={fetchUsers} getAuthHeaders={getAuthHeaders} />}
      {resetTarget && <ResetPasswordModal target={resetTarget} onClose={() => setResetTarget(null)} onDone={() => { fetchUsers(); fetchResetRequests() }} getAuthHeaders={getAuthHeaders} />}
      {deleteTarget && <DeleteConfirmModal target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchUsers} getAuthHeaders={getAuthHeaders} />}
    </div>
  )
}
