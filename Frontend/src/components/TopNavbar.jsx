import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl } from '../config'
import logoUrl from '../assets/company-logo.png'

const baseNavItems = [
  { label: 'Search', path: '/' },
  { label: 'Jobs', path: '/jobs' },
  { label: 'Upload', path: '/upload' },
  { label: 'Customer', path: '/customer' },
]

export default function TopNavbar() {
  const { isDark, toggleTheme, colors } = useTheme()
  const { getAuthHeaders, isAdmin, isUploadUser } = useAuth()
  const location = useLocation()
  const navItems = isUploadUser
    ? [{ label: 'Upload', path: '/upload' }]
    : isAdmin
      ? [...baseNavItems, { label: 'Admin', path: '/admin' }]
      : baseNavItems
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [showOldPwd, setShowOldPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)

  const handleLogout = () => {
    sessionStorage.removeItem('userLoginAuth')
    localStorage.removeItem('rp_token')
    localStorage.removeItem('rp_user')
    window.location.reload()
  }

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd || newPwd.length < 6) {
      setPwdMsg('New password must be at least 6 characters')
      return
    }
    setPwdLoading(true); setPwdMsg('')
    try {
      const res = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      setPwdMsg('Password changed successfully!')
      setTimeout(() => { setShowChangePwd(false); setPwdMsg(''); setOldPwd(''); setNewPwd('') }, 1500)
    } catch (e) {
      setPwdMsg(e.message)
    } finally { setPwdLoading(false) }
  }

  return (
    <header 
      className="fixed top-0 z-40 w-full shadow-sm transition-colors duration-300"
      style={{ 
        backgroundColor: colors.background, 
        borderBottom: `1px solid ${colors.border}` 
      }}
    >
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left side: Logo + Nav */}
        <div className="flex items-center gap-6">
          <img src={logoUrl} alt="Company Logo" className="h-10 w-auto object-contain" />
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isItemActive = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)
              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  className={() =>
                    `rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                      isItemActive
                        ? 'bg-brand-500 text-white'
                        : isDark 
                          ? 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Right side: Theme toggle + Logout */}
        <div className="flex items-center gap-2">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
            style={{
              backgroundColor: isDark ? colors.card : colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text
            }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <SunIcon className="h-4 w-4" />
            ) : (
              <MoonIcon className="h-4 w-4" />
            )}
          </button>

          {/* Change Password */}
          <button
            onClick={() => { setShowChangePwd(true); setPwdMsg(''); setOldPwd(''); setNewPwd('') }}
            className="px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
            style={{
              backgroundColor: isDark ? colors.card : '#f1f5f9',
              color: colors.text,
              border: `1px solid ${colors.border}`,
              cursor: 'pointer'
            }}
            title="Change Password"
          >
            Change Password
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
            title="Logout"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePwd && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: isDark ? '#1e293b' : '#fff', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '380px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
            border: isDark ? '1px solid #334155' : 'none',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: '16px' }}>
              Change Password
            </h3>
            {pwdMsg && (
              <div style={{
                backgroundColor: pwdMsg.includes('successfully') ? (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2'),
                border: `1px solid ${pwdMsg.includes('successfully') ? '#10b981' : '#ef4444'}`,
                borderRadius: '8px', padding: '10px 14px',
                color: pwdMsg.includes('successfully') ? (isDark ? '#34d399' : '#065f46') : (isDark ? '#f87171' : '#991b1b'),
                fontSize: '13px', marginBottom: '12px',
              }}>
                {pwdMsg}
              </div>
            )}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                type={showOldPwd ? 'text' : 'password'}
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                placeholder="Current password"
                style={{
                  width: '100%', padding: '10px 60px 10px 14px',
                  border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`, borderRadius: '8px',
                  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                  backgroundColor: isDark ? '#0f172a' : '#fff', color: isDark ? '#e2e8f0' : '#111827',
                }}
              />
              <button type="button" onClick={() => setShowOldPwd(!showOldPwd)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '12px' }}>
                {showOldPwd ? 'Hide' : 'Show'}
              </button>
            </div>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input
                type={showNewPwd ? 'text' : 'password'}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="New password (min 6 chars)"
                style={{
                  width: '100%', padding: '10px 60px 10px 14px',
                  border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`, borderRadius: '8px',
                  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                  backgroundColor: isDark ? '#0f172a' : '#fff', color: isDark ? '#e2e8f0' : '#111827',
                }}
              />
              <button type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '12px' }}>
                {showNewPwd ? 'Hide' : 'Show'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowChangePwd(false)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`, backgroundColor: isDark ? '#0f172a' : '#fff',
                  fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: isDark ? '#e2e8f0' : '#374151',
                }}
              >
                Cancel
              </button>
              <button
                disabled={pwdLoading}
                onClick={handleChangePassword}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: 'none', backgroundColor: pwdLoading ? '#94a3b8' : '#3b82f6',
                  fontSize: '14px', fontWeight: 600, cursor: pwdLoading ? 'not-allowed' : 'pointer',
                  color: '#fff',
                }}
              >
                {pwdLoading ? 'Changing...' : 'Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
