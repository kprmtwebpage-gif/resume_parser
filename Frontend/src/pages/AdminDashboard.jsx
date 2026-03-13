/**
 * AdminDashboard.jsx
 * ==================
 * Admin-only page: displays all users with their stats.
 *
 * Route:  /admin
 * Guard:  requires role === 'admin' (enforced in App.jsx via <AdminRoute>)
 *
 * API:    GET /api/auth/admin/users   (returns array of user rows)
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate }                        from 'react-router-dom'
import { useAuth }                            from '../contexts/AuthContext'
import { apiUrl }                             from '../config'

// ── helpers ────────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function RoleBadge({ role }) {
  const cls = role === 'superuser' || role === 'admin'
    ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
    : role === 'upload_user'
      ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
      : 'bg-slate-700 text-slate-300 border border-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {role.replace(/_/g, ' ')}
    </span>
  )
}

function StatusBadge({ active }) {
  return active
    ? <span className="inline-flex items-center gap-1 text-xs text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />Active</span>
    : <span className="inline-flex items-center gap-1 text-xs text-red-400"><span   className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"   />Disabled</span>
}

// ── Create User modal ──────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated, getAuthHeaders }) {
  const [form,    setForm]    = useState({ username: '', email: '', password: '', role: 'user' })
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState(null)

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setErr(null)
    try {
      const res  = await fetch(apiUrl('/api/auth/admin/create-user'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      onCreated()
      onClose()
    } catch (e) { setErr(e.message) }
    finally      { setLoading(false) }
  }

  const inp = 'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-white mb-4">New User</h2>
        {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
        <form onSubmit={submit} className="space-y-3">
          <input required className={inp} placeholder="Username"  value={form.username} onChange={e => setForm(f=>({...f, username: e.target.value}))} />
          <input required className={inp} placeholder="Email"     value={form.email}    onChange={e => setForm(f=>({...f, email:    e.target.value}))} type="email" />
          <input required className={inp} placeholder="Password"  value={form.password} onChange={e => setForm(f=>({...f, password: e.target.value}))} type="password" minLength={6} />
          <select className={inp} value={form.role} onChange={e => setForm(f=>({...f, role: e.target.value}))}>
            <option value="user">user</option>
            <option value="upload_user">upload user</option>
            <option value="superuser">superuser</option>
          </select>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition disabled:opacity-50">
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Eye toggle helper ────────────────────────────────────────────────────────
function EyeIcon({ show }) {
  return show ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

// ── Reset Password modal ───────────────────────────────────────────────────
function ResetPasswordModal({ target, onClose, onDone, getAuthHeaders }) {
  const [newPwd,  setNewPwd]  = useState('')
  const [showPw,  setShowPw]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState(null)
  const [ok,      setOk]      = useState(false)

  const inp = 'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10'

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setErr(null)
    try {
      const res  = await fetch(apiUrl(`/api/auth/admin/reset-password/${target.id}`), {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body:    JSON.stringify({ new_password: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      setOk(true)
      setTimeout(() => { onDone(); onClose() }, 1200)
    } catch (e) { setErr(e.message) }
    finally     { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-white mb-1">Reset Password</h2>
        <p className="text-slate-400 text-sm mb-4">
          New password for <span className="text-white font-medium">{target.username}</span>
        </p>
        {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
        {ok  && <p className="mb-3 text-sm text-green-400">Password reset ✓</p>}
        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <input required className={inp} type={showPw ? 'text' : 'password'} placeholder="New password (min 6)"
              minLength={6} value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            <button type="button" tabIndex={-1} onClick={() => setShowPw(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
              <EyeIcon show={showPw} />
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition">
              Cancel
            </button>
            <button type="submit" disabled={loading || ok}
              className="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm transition disabled:opacity-50">
              {loading ? 'Resetting…' : 'Reset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Login History Modal ─────────────────────────────────────────────────────────
function LoginHistoryModal({ target, onClose, getAuthHeaders }) {
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)
      try {
        const res  = await fetch(apiUrl(`/api/auth/admin/login-sessions/${target.id}`), {
          headers: getAuthHeaders(),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Failed to load sessions')
        setSessions(Array.isArray(data) ? data : [])
      } catch (e) { setError(e.message) }
      finally     { setLoading(false) }
    }
    load()
  }, [target.id, getAuthHeaders])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Login History</h2>
            <p className="text-slate-400 text-sm">
              <span className="text-white font-medium">{target.username}</span>
              {' — '}
              <span>{sessions.length} sessions (last 50)</span>
            </p>
          </div>
          <button onClick={onClose}
            className="text-slate-400 hover:text-white transition text-xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center text-slate-400 py-10">Loading…</div>
          ) : error ? (
            <div className="text-center text-red-400 py-10">{error}</div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-slate-500 py-10">No login sessions recorded yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50 text-slate-300 text-xs uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Date &amp; Time</th>
                  <th className="px-4 py-2 text-left">IP Address</th>
                  <th className="px-4 py-2 text-center">Resumes Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sessions.map((s, i) => (
                  <tr key={s.id} className="hover:bg-slate-700/30 transition">
                    <td className="px-4 py-2.5 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5 text-white whitespace-nowrap">{formatDate(s.logged_in_at)}</td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{s.ip_address || '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-semibold ${
                        (s.resumes_uploaded_this_session || 0) > 0 
                          ? 'bg-green-900/40 text-green-300' 
                          : 'bg-slate-700 text-slate-400'
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

        <div className="mt-4 pt-4 border-t border-slate-700">
          <button onClick={onClose}
            className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirmation Modal ──────────────────────────────────────────────────
function DeleteConfirmationModal({ target, onClose, onDeleted, getAuthHeaders }) {
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState(null)

  async function confirmDelete() {
    setLoading(true); setErr(null)
    try {
      const res = await fetch(apiUrl(`/api/auth/admin/delete-user/${target.id}`), {
        method:  'DELETE',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to delete user')
      onDeleted()
      onClose()
    } catch (e) { setErr(e.message) }
    finally     { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-red-700/50 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-white mb-2">Delete User?</h2>
        <p className="text-slate-400 text-sm mb-4">
          This will permanently delete <span className="text-white font-medium">{target.username}</span>. This action cannot be undone.
        </p>
        {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition">
            Cancel
          </button>
          <button type="button" onClick={confirmDelete} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white font-medium text-sm transition disabled:opacity-50">
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, isAdmin, logout, getAuthHeaders } = useAuth()
  const navigate = useNavigate()

  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)   // user row to reset pwd
  const [resetRequests, setResetRequests] = useState([]) // pending forgot-pwd requests
  const [historyTarget, setHistoryTarget] = useState(null) // user to show login history
  const [deleteTarget, setDeleteTarget] = useState(null) // user to delete

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null) }
    try {
      const res  = await fetch(apiUrl('/api/auth/admin/users'), { headers: getAuthHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to load users')
      setUsers(data)
    } catch (e) { if (!silent) setError(e.message) }
    finally     { if (!silent) setLoading(false) }
  }, [getAuthHeaders])

  const fetchResetRequests = useCallback(async () => {
    try {
      const res  = await fetch(apiUrl('/api/auth/admin/reset-requests'), { headers: getAuthHeaders() })
      const data = await res.json()
      if (res.ok) setResetRequests(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }, [getAuthHeaders])

  useEffect(() => { 
    fetchUsers(); 
    fetchResetRequests()
    
    // Auto-refresh every 30 seconds silently (no loading flash)
    const interval = setInterval(() => {
      fetchUsers(true)   // silent=true: update data without blanking the table
      fetchResetRequests()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [fetchUsers, fetchResetRequests])

  async function dismissResetRequest(id) {
    try {
      await fetch(apiUrl(`/api/auth/admin/reset-requests/${id}`), {
        method: 'DELETE', headers: getAuthHeaders(),
      })
      fetchResetRequests()
    } catch { /* silent */ }
  }

  async function toggleUser(id) {
    try {
      const res  = await fetch(apiUrl(`/api/auth/admin/toggle-user/${id}`), {
        method:  'PATCH',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      fetchUsers()          // refresh list
    } catch (e) { alert(e.message) }
  }

  async function deleteUser(id) {
    try {
      const res  = await fetch(apiUrl(`/api/auth/admin/delete-user/${id}`), {
        method:  'DELETE',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setDeleteTarget(null) // close modal
      fetchUsers()          // refresh list
    } catch (e) { alert(e.message) }
  }

  const totalLogins  = users.reduce((s, u) => s + (u.total_logins  || 0), 0)
  const totalUploads = users.reduce((s, u) => s + (u.resumes_uploaded || 0), 0)

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">User management &amp; upload stats</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="px-4 py-2 text-sm rounded-lg border border-slate-600 hover:bg-slate-700 transition">
            ← Back to App
          </button>
          <button onClick={fetchUsers}
            className="px-4 py-2 text-sm rounded-lg border border-slate-600 hover:bg-slate-700 transition">
            🔄 Refresh
          </button>
          <button onClick={() => navigate('/admin/resumes')}
            className="px-4 py-2 text-sm rounded-lg border border-green-700 text-green-400 hover:bg-green-900/40 transition">
            📊 View Resumes
          </button>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 font-medium transition">
            + New User
          </button>
          <button onClick={logout}
            className="px-4 py-2 text-sm rounded-lg bg-red-700/60 hover:bg-red-700 border border-red-700 transition">
            Sign Out ({user?.username})
          </button>
        </div>
      </div>

      {/* ── Pending password reset requests ── */}
      {resetRequests.length > 0 && (
        <div className="mb-8 bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4">
          <h2 className="text-base font-semibold text-yellow-300 mb-3 flex items-center gap-2">
            🔔 Pending Password Reset Requests
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-slate-900 text-xs font-bold">
              {resetRequests.length}
            </span>
          </h2>
          <div className="space-y-2">
            {resetRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-4 py-2.5">
                <div>
                  <span className="text-white font-medium">{req.username}</span>
                  <span className="ml-3 text-slate-400 text-xs">{formatDate(req.requested_at)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setResetTarget({ id: req.user_id, username: req.username })}
                    className="text-xs px-3 py-1 rounded-lg border border-orange-700 text-orange-400 hover:bg-orange-900/40 transition"
                  >
                    Reset Pwd
                  </button>
                  <button
                    onClick={() => dismissResetRequest(req.id)}
                    className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-700 transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users',   value: users.length },
          { label: 'Active',        value: users.filter(u=>u.is_active).length },
          { label: 'Total Logins',  value: totalLogins },
          { label: 'Resumes Uploaded (tracked)', value: totalUploads },
        ].map(c => (
          <div key={c.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Users table ── */}
      {loading ? (
        <div className="text-center text-slate-400 py-16">Loading…</div>
      ) : error ? (
        <div className="text-center text-red-400 py-16">{error}</div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50 text-slate-300 text-xs uppercase tracking-wider">
              <tr>
                {['Username','Email','Role','Status','Total Logins','Resumes Uploaded','Last Login','Created','Actions','History'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-700/30 transition">
                  <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                  <td className="px-4 py-3 text-slate-400">{u.email || '—'}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3"><StatusBadge active={u.is_active} /></td>
                  <td className="px-4 py-3 text-center tabular-nums">{u.total_logins}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{u.resumes_uploaded}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(u.last_login)}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleUser(u.id)}
                      className={`text-xs px-3 py-1 rounded-lg border transition ${
                        u.is_active
                          ? 'border-red-700 text-red-400 hover:bg-red-900/40'
                          : 'border-green-700 text-green-400 hover:bg-green-900/40'
                      }`}
                    >
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => setResetTarget(u)}
                      className="text-xs px-3 py-1 rounded-lg border border-orange-700 text-orange-400 hover:bg-orange-900/40 transition"
                    >
                      Reset Pwd
                    </button>
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="text-xs px-3 py-1 rounded-lg border border-red-700 text-red-500 hover:bg-red-900/40 transition"
                    >
                      Delete
                    </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setHistoryTarget(u)}
                      className="text-xs px-3 py-1 rounded-lg border border-blue-700 text-blue-400 hover:bg-blue-900/40 transition"
                    >
                      History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center text-slate-500 py-10">No users found</div>
          )}
        </div>
      )}

      {/* ── Note about legacy uploads ── */}
      <p className="mt-4 text-xs text-slate-500">
        * "Resumes Uploaded" only counts uploads made after the auth system was activated.
          Resumes uploaded before login existed show as 0 (they are tracked as legacy / unknown uploader).
      </p>

      {/* ── Create user modal ── */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchUsers}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          target={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={() => { fetchUsers(); fetchResetRequests() }}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {historyTarget && (
        <LoginHistoryModal
          target={historyTarget}
          onClose={() => setHistoryTarget(null)}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmationModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={fetchUsers}
          getAuthHeaders={getAuthHeaders}
        />
      )}
    </div>
  )
}
