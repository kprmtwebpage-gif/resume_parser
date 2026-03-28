/**
 * Email OAuth API service.
 * Handles OAuth connection flow and OAuth-based email sending.
 */
import { api } from './api'

/* ── OAuth Connection Status ───────────────────────────────────── */

/**
 * Check which email providers the current user has connected via OAuth.
 * Returns { gmail: { email, connected, expires_at } | null, outlook: ... }
 */
export async function getOAuthStatus() {
  const res = await api.get('/email/oauth/status')
  return res.data
}

/* ── OAuth Login Redirect ──────────────────────────────────────── */

/**
 * Redirect the browser to the Google OAuth consent screen.
 * After the user grants permission, Google redirects back to the backend
 * callback, which then redirects to `returnUrl` with ?oauth_success=gmail.
 */
export function startGoogleOAuth(returnUrl) {
  const token = localStorage.getItem('rp_token')
  if (!token) throw new Error('Not logged in. Please log in first.')
  const ret = returnUrl || window.location.href
  window.location.href = `/email/oauth/google/login?token=${encodeURIComponent(token)}&return_url=${encodeURIComponent(ret)}`
}

/**
 * Redirect the browser to the Microsoft OAuth consent screen.
 */
export function startOutlookOAuth(returnUrl) {
  const token = localStorage.getItem('rp_token')
  if (!token) throw new Error('Not logged in. Please log in first.')
  const ret = returnUrl || window.location.href
  window.location.href = `/email/oauth/outlook/login?token=${encodeURIComponent(token)}&return_url=${encodeURIComponent(ret)}`
}

/* ── Send Email via OAuth ──────────────────────────────────────── */

/**
 * Send an email using the user's OAuth-connected account.
 */
export async function sendEmailOAuth({ candidateId, recipientEmail, subject, body, provider }) {
  const res = await api.post('/email/oauth/send', {
    candidate_id: candidateId,
    recipient_email: recipientEmail,
    subject,
    body,
    provider,
  })
  return res.data
}

/* ── Disconnect Provider ───────────────────────────────────────── */

export async function disconnectProvider(provider) {
  const res = await api.post(`/email/oauth/disconnect?provider=${provider}`)
  return res.data
}
