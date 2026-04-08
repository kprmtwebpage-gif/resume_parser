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
  // OTP flow state
  const [forgotStep, setForgotStep] = useState('username') // 'username' | 'otp' | 'newpass' | 'done'
  const [otpCode, setOtpCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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
                onClick={() => {
                  setShowForgot(true); setForgotMsg(''); setForgotUser('')
                  setForgotStep('username'); setOtpCode(''); setResetToken('')
                  setNewPassword(''); setConfirmPassword('')
                }}
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

      {/* Forgot Password Modal — multi-step OTP flow */}
      {showForgot && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
              {forgotStep === 'done' ? 'Password Reset' : 'Forgot Password'}
            </h3>

            {/* Status message */}
            {forgotMsg && (
              <div style={{
                backgroundColor: forgotMsg.includes('successfully') || forgotMsg.includes('OTP sent') || forgotMsg.includes('verified') ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${forgotMsg.includes('successfully') || forgotMsg.includes('OTP sent') || forgotMsg.includes('verified') ? '#10b981' : '#ef4444'}`,
                borderRadius: '8px', padding: '10px 14px',
                color: forgotMsg.includes('successfully') || forgotMsg.includes('OTP sent') || forgotMsg.includes('verified') ? '#065f46' : '#991b1b',
                fontSize: '13px', marginBottom: '12px',
              }}>
                {forgotMsg}
              </div>
            )}

            {/* Step 1: Enter username */}
            {forgotStep === 'username' && (
              <>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                  Enter your username. If you are a superuser, an OTP will be sent to your email. Regular users will receive assistance from the superuser.
                </p>
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
                      fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: '#374151',
                    }}
                  >Cancel</button>
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
                        let data
                        try { data = await res.json() } catch { throw new Error('Invalid server response') }
                        if (data.otp_sent) {
                          setForgotMsg(data.detail || 'OTP sent to your email.')
                          setForgotStep('otp')
                        } else {
                          setForgotMsg(data.detail || 'Your password reset request has been sent to the superuser. Please contact them for assistance.')
                          setForgotStep('done')
                        }
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
                  >{forgotLoading ? 'Sending...' : 'Submit'}</button>
                </div>
              </>
            )}

            {/* Step 2: Enter OTP */}
            {forgotStep === 'otp' && (
              <>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                  Enter the 6-digit OTP sent to your email.
                </p>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  autoFocus
                  maxLength={6}
                  style={{
                    width: '100%', padding: '12px 14px',
                    border: '1px solid #d1d5db', borderRadius: '8px',
                    fontSize: '20px', letterSpacing: '6px', textAlign: 'center',
                    marginBottom: '16px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => { setForgotStep('username'); setForgotMsg(''); setOtpCode('') }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px',
                      border: '1px solid #d1d5db', backgroundColor: '#fff',
                      fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: '#374151',
                    }}
                  >Back</button>
                  <button
                    disabled={forgotLoading || otpCode.length !== 6}
                    onClick={async () => {
                      setForgotLoading(true); setForgotMsg('')
                      try {
                        const res = await fetch(apiUrl('/api/auth/verify-otp'), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ username: forgotUser.trim(), otp: otpCode }),
                        })
                        let data
                        try { data = await res.json() } catch { throw new Error('Invalid server response') }
                        if (res.ok && data.reset_token) {
                          setResetToken(data.reset_token)
                          setForgotMsg('OTP verified! Set your new password.')
                          setForgotStep('newpass')
                        } else {
                          setForgotMsg(data.detail || 'Invalid OTP. Try again.')
                        }
                      } catch {
                        setForgotMsg('Verification failed. Please try again.')
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
                  >{forgotLoading ? 'Verifying...' : 'Verify OTP'}</button>
                </div>
              </>
            )}

            {/* Step 3: Set new password */}
            {forgotStep === 'newpass' && (
              <>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                  Enter your new password (min 6 characters).
                </p>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 14px',
                    border: '1px solid #d1d5db', borderRadius: '8px',
                    fontSize: '14px', marginBottom: '12px',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
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
                      fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: '#374151',
                    }}
                  >Cancel</button>
                  <button
                    disabled={forgotLoading || newPassword.length < 6 || newPassword !== confirmPassword}
                    onClick={async () => {
                      setForgotLoading(true); setForgotMsg('')
                      try {
                        const res = await fetch(apiUrl('/api/auth/reset-password-otp'), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
                        })
                        let data
                        try { data = await res.json() } catch { throw new Error('Invalid server response') }
                        if (res.ok) {
                          setForgotMsg(data.detail || 'Password reset successfully!')
                          setForgotStep('done')
                        } else {
                          setForgotMsg(data.detail || 'Reset failed. Try again.')
                        }
                      } catch {
                        setForgotMsg('Reset failed. Please try again.')
                      } finally {
                        setForgotLoading(false)
                      }
                    }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px',
                      border: 'none',
                      backgroundColor: forgotLoading || newPassword.length < 6 || newPassword !== confirmPassword ? '#94a3b8' : '#6366f1',
                      fontSize: '14px', fontWeight: 600,
                      cursor: forgotLoading || newPassword.length < 6 || newPassword !== confirmPassword ? 'not-allowed' : 'pointer',
                      color: '#fff',
                    }}
                  >{forgotLoading ? 'Resetting...' : 'Reset Password'}</button>
                </div>
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>Passwords do not match</p>
                )}
              </>
            )}

            {/* Step 4: Done */}
            {forgotStep === 'done' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>&#10003;</div>
                <button
                  onClick={() => setShowForgot(false)}
                  style={{
                    padding: '10px 32px', borderRadius: '8px',
                    border: 'none', backgroundColor: '#6366f1',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    color: '#fff', marginTop: '8px',
                  }}
                >Back to Login</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="admin-login-bg-gradient"></div>
    </div>
  )
}
