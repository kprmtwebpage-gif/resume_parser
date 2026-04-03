/**
 * AuthContext.jsx
 * ===============
 * Provides:
 *   - AuthProvider         – wraps the app, stores token in localStorage
 *   - useAuth()            – hook to read auth state and call login/logout
 *
 * Token storage: localStorage key = "rp_token"
 * User info:     localStorage key = "rp_user"  (JSON: {username, role})
 *
 * The token is automatically attached to every fetch/axios call from
 * Upload.jsx via the getAuthHeaders() helper exported here.
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { apiUrl } from '../config'

const AuthContext = createContext(null)

const IDLE_TIMEOUT_MS = 20 * 60 * 1000 // 20 minutes of inactivity → auto-logout

export function AuthProvider({ children }) {
  const [token, setToken]   = useState(() => localStorage.getItem('rp_token') || null)
  const [user,  setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('rp_user') || 'null') } catch { return null }
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  const idleTimerRef  = useRef(null)
  const logoutRef     = useRef(null) // stable ref so the timeout closure always calls latest logout

  /** Clear credentials — server-side JWT is already stateless. */
  const logout = useCallback((expired = false) => {
    localStorage.removeItem('rp_token')
    localStorage.removeItem('rp_user')
    setToken(null)
    setUser(null)
    if (expired) setSessionExpired(true)
  }, [])

  // Keep logoutRef current so idle timer closure works without stale reference
  useEffect(() => { logoutRef.current = logout }, [logout])

  // Idle timeout — runs only while logged in.
  // Any mouse/key/touch/scroll activity resets the 20-min countdown.
  useEffect(() => {
    if (!token) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      return
    }

    function resetTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        logoutRef.current(true) // expired = true → shows banner on login page
      }, IDLE_TIMEOUT_MS)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer() // kick off the timer on login

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [token])

  /** POST /api/auth/login with username/password form data. */
  const login = useCallback(async (username, password) => {
    setLoading(true)
    setError(null)
    setSessionExpired(false) // clear expiry flag on fresh login attempt
    try {
      const body = new URLSearchParams({ username, password })
      const res  = await fetch(apiUrl('/api/auth/login'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')

      localStorage.setItem('rp_token', data.access_token)
      localStorage.setItem('rp_user',  JSON.stringify({ username: data.username, role: data.role }))
      setToken(data.access_token)
      setUser({ username: data.username, role: data.role })
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  /** Returns Authorization header object to attach to fetch calls. */
  const getAuthHeaders = useCallback(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token])

  const isAuthenticated = Boolean(token && user)
  const isAdmin         = user?.role === 'superuser' || user?.role === 'admin'
  const isUploadUser    = user?.role === 'upload_user'

  return (
    <AuthContext.Provider value={{
      token, user, loading, error,
      isAuthenticated, isAdmin, isUploadUser,
      sessionExpired,
      login, logout, getAuthHeaders,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Hook: must be used inside <AuthProvider> */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
