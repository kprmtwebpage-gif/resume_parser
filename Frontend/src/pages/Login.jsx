/**
 * Login.jsx
 * =========
 * KPRMT-branded login page matching the company design reference.
 * Uses JWT auth via AuthContext — no hardcoded credentials.
 */

import { useState, useEffect } from 'react'
import { useNavigate }          from 'react-router-dom'
import { useAuth }              from '../contexts/AuthContext'
import { apiUrl }               from '../config'

import logoImage from '../assets/assets/onlyBird.png'
import sponsor1  from '../assets/assets/sponsor-1.png'
import sponsor2  from '../assets/assets/sponsor-2.png'
import sponsor3  from '../assets/assets/sponsor-3.png'
import sponsor4  from '../assets/assets/sponsor-4.png'
import './Login.css'

export default function Login() {
  const { login, isAuthenticated, loading, error } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)

  // Forgot password state
  const [showForgot,     setShowForgot]     = useState(false)
  const [forgotUser,     setForgotUser]     = useState('')
  const [forgotLoading,  setForgotLoading]  = useState(false)
  const [forgotDone,     setForgotDone]     = useState(false)
  const [forgotErr,      setForgotErr]      = useState(null)

  const sponsors = [sponsor1, sponsor2, sponsor3, sponsor4]

  // If already authenticated, skip to main app
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    const ok = await login(username.trim(), password)
    if (ok) navigate('/', { replace: true })
  }

  async function handleForgotSubmit() {
    if (!forgotUser.trim()) { setForgotErr('Enter your username'); return }
    setForgotLoading(true); setForgotErr(null)
    try {
      const res  = await fetch(apiUrl('/api/auth/forgot-password'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: forgotUser.trim() }),
      })
      await res.json()
      setForgotDone(true)
    } catch { setForgotErr('Could not send request. Try again.') }
    finally { setForgotLoading(false) }
  }

  return (
    <div className="admin-login-container">
      <div className="admin-login-content-wrapper">
        {/* ── Main card ── */}
        <div className="admin-login-card">
          {/* Left panel — building image + welcome text */}
          <div className="admin-login-left">
            <div className="admin-login-left-content">
              <h1 className="admin-login-welcome-title">Welcome back</h1>
              <p className="admin-login-welcome-subtitle">KPRMT Global Solutions</p>
              <p className="admin-login-welcome-desc">Sign in to access your existing account</p>
            </div>
          </div>

          {/* Right panel — form */}
          <div className="admin-login-right">
            <div className="admin-logo-section">
              <img src={logoImage} alt="KPRMT Logo" className="admin-logo-image" />
              <h2 className="admin-logo-text">KPRMT Sign In</h2>
            </div>

            {/* Error banner */}
            {error && <div className="admin-error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="admin-login-form">
              {/* Username */}
              <div className="admin-form-group">
                <label htmlFor="login-username" className="admin-form-label">Username</label>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="Enter admin username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={loading}
                  className="admin-form-input"
                  autoFocus
                />
              </div>

              {/* Password */}
              <div className="admin-form-group">
                <label htmlFor="login-password" className="admin-form-label">Password</label>
                <div className="admin-password-wrapper">
                  <input
                    id="login-password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    className="admin-form-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="admin-password-toggle"
                    tabIndex={-1}
                  >
                    {showPw ? (
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

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={`admin-btn-login ${loading ? 'loading' : ''}`}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            {/* ── Forgot Password ── */}
            <div className="admin-forgot-section">
              {!showForgot ? (
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotDone(false); setForgotErr(null); setForgotUser('') }}
                  className="admin-forgot-link"
                >
                  Forgot password?
                </button>
              ) : forgotDone ? (
                <div className="admin-forgot-success">
                  Request sent ✓ &nbsp;Your admin will reset your password shortly.
                </div>
              ) : (
                <div className="admin-forgot-form">
                  <p className="admin-forgot-hint">Enter your username and the admin will be notified.</p>
                  {forgotErr && <p className="admin-forgot-error">{forgotErr}</p>}
                  <input
                    type="text"
                    placeholder="Your username"
                    value={forgotUser}
                    onChange={e => setForgotUser(e.target.value)}
                    className="admin-form-input"
                  />
                  <div className="admin-forgot-buttons">
                    <button type="button" onClick={() => setShowForgot(false)} className="admin-forgot-cancel">Cancel</button>
                    <button type="button" disabled={forgotLoading} onClick={handleForgotSubmit} className="admin-forgot-send">
                      {forgotLoading ? 'Sending…' : 'Send Request'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrolling sponsor strip ── */}
        <div className="sponsor-container">
          <div className="sponsor-track">
            {sponsors.map((logo, i) => (
              <img key={`s1-${i}`} src={logo} alt={`Sponsor ${i+1}`} className="sponsor-logo" />
            ))}
            {sponsors.map((logo, i) => (
              <img key={`s2-${i}`} src={logo} alt={`Sponsor ${i+1}`} className="sponsor-logo" />
            ))}
          </div>
        </div>
      </div>

      <div className="admin-login-bg-gradient"></div>
    </div>
  )
}
