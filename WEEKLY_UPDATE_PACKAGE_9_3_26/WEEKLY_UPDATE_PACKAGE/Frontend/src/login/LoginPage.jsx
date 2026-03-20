import { useState } from 'react'
import { authStore } from './authStore'
import logoImage from '../assets/onlyBird.png'
import sponsor1 from '../assets/sponsor-1.png'
import sponsor2 from '../assets/sponsor-2.png'
import sponsor3 from '../assets/sponsor-3.png'
import sponsor4 from '../assets/sponsor-4.png'
import './login.css'

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const sponsors = [sponsor1, sponsor2, sponsor3, sponsor4]

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')

    if (!username || !password) {
      setError('Please enter both username and password')
      return
    }

    setIsLoading(true)
    try {
      const result = authStore.login(username, password)
      if (result.success) {
        onLoginSuccess?.()
      } else {
        setError('Invalid credentials')
        alert('Invalid credentials')
      }
    } catch (err) {
      setError('An error occurred during login')
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
            </form>
          </div>
        </div>

        <div className="sponsor-container">
          <div className="sponsor-track">
            {sponsors.map((logo, index) => (
              <img
                key={`sponsors-1-${index}`}
                src={logo}
                alt={`Sponsor ${index + 1}`}
                className="sponsor-logo"
              />
            ))}
            {sponsors.map((logo, index) => (
              <img
                key={`sponsors-2-${index}`}
                src={logo}
                alt={`Sponsor ${index + 1}`}
                className="sponsor-logo"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="admin-login-bg-gradient"></div>
    </div>
  )
}
