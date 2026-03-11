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

import { createContext, useContext, useState, useCallback } from 'react'
import { apiUrl } from '../config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken]   = useState(() => localStorage.getItem('rp_token') || null)
  const [user,  setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('rp_user') || 'null') } catch { return null }
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  /** POST /api/auth/login with username/password form data. */
  const login = useCallback(async (username, password) => {
    setLoading(true)
    setError(null)
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

  /** Clear credentials — server-side JWT is already stateless. */
  const logout = useCallback(() => {
    localStorage.removeItem('rp_token')
    localStorage.removeItem('rp_user')
    setToken(null)
    setUser(null)
  }, [])

  /** Returns Authorization header object to attach to fetch calls. */
  const getAuthHeaders = useCallback(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token])

  const isAuthenticated = Boolean(token && user)
  const isAdmin         = user?.role === 'superuser' || user?.role === 'admin'

  return (
    <AuthContext.Provider value={{
      token, user, loading, error,
      isAuthenticated, isAdmin,
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
