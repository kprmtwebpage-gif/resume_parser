import { useState } from 'react'
import { apiUrl } from '../config'
import { useAuth } from '../contexts/AuthContext'
import logoImage from '../assets/onlyBird.png'
import './login.css'

export default function LoginPage({ onLoginSuccess }) {
  const { login, error: authError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotUser, setForgotUser] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    if (!username || !password) {
      setError('Please enter both username and password')
      return
    }

    setIsLoading(true)
    try {
      const success = await login(username, password)
      if (success) {
        sessionStorage.setItem('userLoginAuth', 'true')
        onLoginSuccess?.()
      } else {
        setError(authError || 'Invalid credentials')
      }
    } catch (err) {
      setError('Unable to reach the server. Please try again.')
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="admin-login-container">
      <div className="admin-login-content-wrapper">
        <div className="admin-login-card">
          <div className="admin-login-left">
            <div className="admin-login-left-content">
              <h1 className="admin-login-welcome-title">Welcome to KPRMT</h1>
              <p className="admin-login-welcome-desc">
                KPRMT Global Solutions is an IT consulting and talent solutions company
                delivering high-quality technology services and staffing solutions
                to organizations worldwide.
              </p>
              <button 
                className="know-more-btn" 
                type="button"
                onClick={() => window.open("https://www.kprmt.com/index.php#about", "_blank")}
              >
                Know More
              </button>
            </div>
          </div>

          <div className="admin-login-right">
            <div className="admin-logo-section">
              <img src={logoImage} alt="KPRMT Logo" className="admin-logo-image" />
              <h2 className="admin-logo-text">KPRMT Sign In</h2>
            </div>

            {error && <div className="admin-error-message">{error}</div>}

            <form onSubmit={handleLogin} className="admin-login-form">
              <div className="admin-form-group">
                <label htmlFor="username" className="admin-form-label">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  placeholder="Enter admin username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  className="admin-form-input"
                  autoFocus
                />
              </div>

              <div className="admin-form-group">
                <label htmlFor="password" className="admin-form-label">
                  Password
                </label>
                <div className="admin-password-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="admin-form-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="admin-password-toggle"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`admin-btn-login ${isLoading ? 'loading' : ''}`}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>

              <button
                type="button"
                onClick={() => { setShowForgot(true); setForgotMsg(''); setForgotUser('') }}
                className="admin-forgot-password-link"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6366f1',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  marginTop: '8px',
                  display: 'block',
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                Forgot Password?
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '380px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
              Forgot Password
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              Enter your username. Your admin will be notified to reset your password.
            </p>
            {forgotMsg && (
              <div style={{
                backgroundColor: forgotMsg.includes('submitted') ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${forgotMsg.includes('submitted') ? '#10b981' : '#ef4444'}`,
                borderRadius: '8px', padding: '10px 14px',
                color: forgotMsg.includes('submitted') ? '#065f46' : '#991b1b',
                fontSize: '13px', marginBottom: '12px',
              }}>
                {forgotMsg}
              </div>
            )}
            <input
              type="text"
              value={forgotUser}
              onChange={(e) => setForgotUser(e.target.value)}
              placeholder="Enter your username"
              autoFocus
              style={{
                width: '100%', padding: '10px 14px',
                border: '1px solid #d1d5db', borderRadius: '8px',
                fontSize: '14px', marginBottom: '16px',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowForgot(false)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: '1px solid #d1d5db', backgroundColor: '#fff',
                  fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                  color: '#374151',
                }}
              >
                Cancel
              </button>
              <button
                disabled={forgotLoading || !forgotUser.trim()}
                onClick={async () => {
                  setForgotLoading(true); setForgotMsg('')
                  try {
                    const res = await fetch(apiUrl('/api/auth/forgot-password'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ username: forgotUser.trim() }),
                    })
                    const data = await res.json()
                    setForgotMsg(data.detail || 'Request submitted. Your admin will reset your password shortly.')
                  } catch {
                    setForgotMsg('Failed to submit request. Please try again.')
                  } finally {
                    setForgotLoading(false)
                  }
                }}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: 'none', backgroundColor: forgotLoading ? '#94a3b8' : '#6366f1',
                  fontSize: '14px', fontWeight: 600, cursor: forgotLoading ? 'not-allowed' : 'pointer',
                  color: '#fff',
                }}
              >
                {forgotLoading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-login-bg-gradient"></div>
    </div>
  )
}
