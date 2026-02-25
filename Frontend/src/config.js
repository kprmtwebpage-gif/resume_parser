// ================================================================
// Runtime configuration derived from Vite build-time env vars
// ================================================================

// Base path for the application (e.g., '/dev', '/uat', or '' for production root)
// Set via VITE_BASE_PATH at Docker build time
export const BASE_PATH = import.meta.env.VITE_BASE_PATH || ''

// API base URL — equals BASE_PATH because Nginx strips the prefix
// before forwarding to the backend container
export const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

// Helper: prefix any API path with the base URL
// Usage:  fetch(apiUrl('/candidates'))  →  '/dev/candidates' in dev
export function apiUrl(path) {
  // Ensure path starts with /
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${p}`
}
