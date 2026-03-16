/**
 * UsersManagement — Standalone package version.
 * All CRUD operations work on local React state (sample data).
 * No external API calls are made — this is a fully self-contained demo.
 *
 * To connect real data: pass onLoadUsers, onCreateUser, onDeleteUser,
 * onToggleUser, onResetPassword as props (future enhancement).
 */
import { useState } from 'react'

/* ── Sample Data ────────────────────────────────────────────────────────────── */
const now = Date.now()
const DAY = 86400000

function makeSampleUsers() {
  // Empty sample data - all users cleared
  return []

function makeSampleSessions(userId) {
  const names = ['Vamshi K', 'Praveena R', 'Rajesh M', 'Sneha P', 'Arun S', 'Divya L', 'Karthik N', 'Meena T', 'Suresh B', 'Lakshmi V']
  const ips = ['192.168.1.10','192.168.1.22','10.0.0.45','192.168.1.33','10.0.0.12','192.168.1.55','10.0.0.78','192.168.1.90','10.0.0.34','192.168.1.67']
  const idx = ((userId || 1) - 1) % 10
  return Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    logged_in_at: new Date(now - DAY * (i * 3 + Math.random() * 2)).toISOString(),
    ip_address: ips[idx],
    resumes_uploaded_this_session: i % 3 === 0 ? Math.floor(Math.random() * 5) + 1 : 0,
  }))
}

/* ── Utilities ──────────────────────────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function RoleBadge({ role }) {
  const cls = role === 'admin'
    ? 'bg-violet-50 text-violet-700'
    : 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {role}
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

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' })
  const [err, setErr] = useState(null)

  function submit(e) {
    e.preventDefault()
    setErr(null)
    if (!form.username.trim()) return setErr('Username is required')
    if (!form.email.trim()) return setErr('Email is required')
    if (form.password.length < 6) return setErr('Password must be at least 6 characters')
    onCreated({
      id: Date.now(),
      username: form.username,
      email: form.email,
      role: form.role,
      is_active: true,
      total_logins: 0,
      resumes_uploaded: 0,
      last_login: null,
      created_at: new Date().toISOString(),
    })
    onClose()
  }

  const inp = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

  return (
    <ModalOverlay>
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <h2 className="text-[16px] font-extrabold tracking-tight text-gray-900 mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Create User</h2>
        <p className="text-[12px] font-medium text-gray-500 mb-4">Fill in the details to add a new user</p>
        {err && <p className="mb-3 text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        <form onSubmit={submit} className="space-y-3">
          <input required className={inp} placeholder="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          <input required className={inp} placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" />
          <input required className={inp} placeholder="Password (min 6)" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} type="password" minLength={6} />
          <select className={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" className="flex-1 rounded-lg bg-blue-600 py-2.5 text-[13px] font-medium text-white hover:bg-blue-700 transition">Create</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

function ResetPasswordModal({ target, onClose }) {
  const [newPwd, setNewPwd] = useState('')
  const [ok, setOk] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (newPwd.length < 6) return
    setOk(true)
    setTimeout(() => onClose(), 1200)
  }

  const inp = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

  return (
    <ModalOverlay>
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <h2 className="text-[16px] font-extrabold tracking-tight text-gray-900 mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>Reset Password</h2>
        <p className="text-[12px] font-medium text-gray-500 mb-4">For user <span className="font-semibold text-gray-900">{target.username}</span></p>
        {ok && <p className="mb-3 text-[12px] text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">Password reset successfully</p>}
        <form onSubmit={submit} className="space-y-3">
          <input required className={inp} type="password" placeholder="New password (min 6)" minLength={6} value={newPwd} onChange={e => setNewPwd(e.target.value)} />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={ok} className="flex-1 rounded-lg bg-amber-500 py-2.5 text-[13px] font-medium text-white hover:bg-amber-600 transition disabled:opacity-50">
              {ok ? 'Done ✓' : 'Reset'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

function DeleteConfirmModal({ target, onClose, onDeleted }) {
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
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={() => { onDeleted(target.id); onClose() }} className="flex-1 rounded-lg bg-red-600 py-2.5 text-[13px] font-medium text-white hover:bg-red-700 transition">
            Delete
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

function LoginHistoryModal({ target, onClose }) {
  const sessions = makeSampleSessions(target.id)

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
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition text-lg leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide" style={{ color: '#6B7280', letterSpacing: '0.04em' }}>#</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide" style={{ color: '#6B7280', letterSpacing: '0.04em' }}>Date</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide" style={{ color: '#6B7280', letterSpacing: '0.04em' }}>IP</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wide" style={{ color: '#6B7280', letterSpacing: '0.04em' }}>Uploads</th>
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
  const [users, setUsers] = useState(() => makeSampleUsers())
  const [showCreate, setShowCreate] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [historyTarget, setHistoryTarget] = useState(null)

  function addUser(newUser) {
    setUsers(prev => [...prev, newUser])
  }

  function removeUser(id) {
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  function toggleUser(id) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !u.is_active } : u))
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
          <button
            onClick={() => setUsers(makeSampleUsers())}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Username', 'Email', 'Role', 'Status', 'Total Logins', 'Resumes', 'Last Login', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: '#6B7280', letterSpacing: '0.04em' }}>{h}</th>
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
                      <button
                        onClick={() => toggleUser(u.id)}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                          u.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => setResetTarget(u)}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-50 transition"
                      >
                        Pwd
                      </button>
                      <button
                        onClick={() => setHistoryTarget(u)}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 transition"
                      >
                        History
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-[13px] text-gray-400">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={addUser}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          target={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={removeUser}
        />
      )}
      {historyTarget && (
        <LoginHistoryModal
          target={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}
