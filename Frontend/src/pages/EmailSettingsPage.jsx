import { useCallback, useEffect, useState } from 'react'
import {
  getEmailSettings,
  saveEmailSetting,
  disconnectProvider,
  setDefaultProvider,
  testEmailConnection,
  getOAuth2Status,
  getOAuth2AuthorizeUrl,
  disconnectOAuth2,
} from '../services/emailApi'

/* ── Provider config ─────────────────────────────────────────── */

const PROVIDER_CONFIG = {
  outlook: {
    label: 'Outlook',
    color: '#0078d4',
    colorLight: '#e8f0fe',
    colorBorder: '#b3d4fc',
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    smtp_host: 'smtp.office365.com',
    smtp_port: 587,
    ssl_enabled: 'STARTTLS',
    auth_method: 'Normal password',
    smtp_ssl_enabled: 'STARTTLS',
    smtp_auth_method: 'Normal password',
    warning: 'Microsoft has disabled Basic Auth for Outlook.com. Use "Sign in with Microsoft" (OAuth2) below, or use Gmail with an App Password.',
    warningBg: '#eff6ff',
    warningBorder: '#bfdbfe',
    warningColor: '#1e40af',
    warningIcon: 'ℹ️',
  },
  zoho: {
    label: 'Zoho',
    color: '#16a34a',
    colorLight: '#ecfdf5',
    colorBorder: '#86efac',
    imap_host: 'imap.zoho.com',
    imap_port: 993,
    smtp_host: 'smtp.zoho.com',
    smtp_port: 587,
    ssl_enabled: 'STARTTLS',
    auth_method: 'Normal password',
    smtp_ssl_enabled: 'STARTTLS',
    smtp_auth_method: 'Normal password',
    warning: 'Use an App Password if 2FA is enabled on your Zoho account.',
    warningBg: '#f0fdf4',
    warningBorder: '#bbf7d0',
    warningColor: '#166534',
    warningIcon: 'ℹ️',
  },
  gmail: {
    label: 'Gmail',
    color: '#dc2626',
    colorLight: '#fef2f2',
    colorBorder: '#fecaca',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    ssl_enabled: 'STARTTLS',
    auth_method: 'Normal password',
    smtp_ssl_enabled: 'STARTTLS',
    smtp_auth_method: 'Normal password',
    warning: 'An App Password is required. Go to Google Account → Security → App Passwords.',
    warningBg: '#fef2f2',
    warningBorder: '#fecaca',
    warningColor: '#991b1b',
    warningIcon: '⚠️',
  },
}

const PROVIDERS = ['outlook', 'zoho', 'gmail']

const SSL_OPTIONS = ['Autodetect', 'None', 'STARTTLS', 'SSL/TLS']
const AUTH_OPTIONS = ['Autodetect', 'Normal password', 'Encrypted password', 'NTLM']

/* ── Auto-detect provider from email domain ────────────────── */
function detectProviderFromEmail(email) {
  if (!email) return null
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null
  if (domain.includes('gmail.com') || domain.includes('googlemail.com')) return 'gmail'
  if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com') || domain.includes('office365.com')) return 'outlook'
  if (domain.includes('zoho.com') || domain.includes('zohomail.com')) return 'zoho'
  return null
}

/* ── Main Component ──────────────────────────────────────────── */

export default function EmailSettingsPage() {
  const [provider, setProvider] = useState('outlook')
  const [settings, setSettings] = useState({}) // { gmail: {...}, outlook: {...}, zoho: {...} }
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [toast, setToast] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [oauth2Status, setOAuth2Status] = useState({ oauth2_available: false, oauth2_connected: false, email: null })
  const [oauth2Loading, setOAuth2Loading] = useState(false)

  /* ── Load existing settings ─────────────────────────────────── */
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getEmailSettings()
      const map = {}
      data.forEach(s => { map[s.provider] = s })
      setSettings(map)
    } catch (err) {
      console.error('Failed to load email settings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  /* ── Load OAuth2 status ─────────────────────────────────────── */
  const loadOAuth2Status = useCallback(async () => {
    try {
      const status = await getOAuth2Status()
      setOAuth2Status(status)
    } catch {
      // OAuth2 not configured on server — that's OK
    }
  }, [])

  useEffect(() => { loadOAuth2Status() }, [loadOAuth2Status])

  /* ── Listen for OAuth2 popup callback ───────────────────────── */
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'oauth2_callback') {
        if (event.data.status === 'success') {
          showToast(event.data.message || 'Outlook connected via OAuth2!')
          loadSettings()
          loadOAuth2Status()
        } else {
          showToast(event.data.message || 'OAuth2 connection failed', 'error')
        }
        setOAuth2Loading(false)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [loadSettings, loadOAuth2Status]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Sync form when provider changes ────────────────────────── */
  useEffect(() => {
    const existing = settings[provider]
    const cfg = PROVIDER_CONFIG[provider]
    if (existing) {
      setForm({
        email: existing.email || '',
        imap_host: existing.imap_host || cfg.imap_host,
        imap_port: existing.imap_port || cfg.imap_port,
        smtp_host: existing.smtp_host || cfg.smtp_host,
        smtp_port: existing.smtp_port || cfg.smtp_port,
        username: existing.username || '',
        password: '',
        ssl_enabled: existing.ssl_enabled || cfg.ssl_enabled,
        auth_method: existing.auth_method || cfg.auth_method,
        smtp_username: existing.smtp_username || '',
        smtp_password: '',
        smtp_ssl_enabled: existing.smtp_ssl_enabled || cfg.smtp_ssl_enabled,
        smtp_auth_method: existing.smtp_auth_method || cfg.smtp_auth_method,
      })
    } else {
      setForm({
        email: '',
        imap_host: cfg.imap_host,
        imap_port: cfg.imap_port,
        smtp_host: cfg.smtp_host,
        smtp_port: cfg.smtp_port,
        username: '',
        password: '',
        ssl_enabled: cfg.ssl_enabled,
        auth_method: cfg.auth_method,
        smtp_username: '',
        smtp_password: '',
        smtp_ssl_enabled: cfg.smtp_ssl_enabled,
        smtp_auth_method: cfg.smtp_auth_method,
      })
    }
    setShowPassword(false)
    setShowSmtpPassword(false)
  }, [provider, settings])

  /* ── Auto-detect provider from email  ───────────────────────── */
  const handleEmailChange = (val) => {
    setForm(f => ({ ...f, email: val }))
    const detected = detectProviderFromEmail(val)
    if (detected && detected !== provider) {
      setProvider(detected)
    }
  }

  const handleChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
  }

  /* ── Show toast ─────────────────────────────────────────────── */
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  /* ── Save / Connect ─────────────────────────────────────────── */
  const handleSave = async () => {
    if (!form.email?.trim()) { showToast('Email is required', 'error'); return }
    const appPwd = form.password?.trim()
    const smtpPwd = form.smtp_password?.trim()
    if (!appPwd && !smtpPwd && !settings[provider]?.is_connected) {
      showToast('App Password is required', 'error'); return
    }

    const cfgDefaults = PROVIDER_CONFIG[provider]
    setSaving(true)
    try {
      const payload = {
        provider,
        email: form.email.trim(),
        imap_host: form.imap_host || cfgDefaults.imap_host,
        imap_port: form.imap_port ? Number(form.imap_port) : cfgDefaults.imap_port,
        smtp_host: form.smtp_host || cfgDefaults.smtp_host,
        smtp_port: form.smtp_port ? Number(form.smtp_port) : cfgDefaults.smtp_port,
        username: form.username?.trim() || form.email.trim(),
        password: appPwd || undefined,
        ssl_enabled: form.ssl_enabled || cfgDefaults.ssl_enabled,
        auth_method: form.auth_method || cfgDefaults.auth_method,
        // In simple mode, reuse the same password for SMTP; backend also does this fallback
        smtp_username: form.smtp_username?.trim() || form.username?.trim() || form.email.trim(),
        smtp_password: smtpPwd || appPwd || undefined,
        smtp_ssl_enabled: form.smtp_ssl_enabled || cfgDefaults.smtp_ssl_enabled,
        smtp_auth_method: form.smtp_auth_method || cfgDefaults.smtp_auth_method,
        is_default: !Object.values(settings).some(s => s.is_default),
      }
      // Don't send empty passwords for update (backend keeps existing)
      if (!payload.password) delete payload.password
      if (!payload.smtp_password) delete payload.smtp_password

      await saveEmailSetting(payload)
      showToast(`${PROVIDER_CONFIG[provider].label} account connected successfully!`)
      await loadSettings()
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Failed to save settings'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  /* ── Test Connection ────────────────────────────────────────── */
  const handleTest = async () => {
    const cfgDefaults = PROVIDER_CONFIG[provider]
    const smtpHost = form.smtp_host?.trim() || cfgDefaults.smtp_host
    const smtpPort = Number(form.smtp_port) || cfgDefaults.smtp_port
    const smtpUser = form.smtp_username?.trim() || form.username?.trim() || form.email?.trim()
    const smtpPass = form.smtp_password?.trim() || form.password?.trim()
    if (!smtpHost || !smtpUser || !smtpPass) {
      showToast('Email address and App Password are required to test', 'error')
      return
    }
    setTesting(true)
    try {
      const result = await testEmailConnection({
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        username: smtpUser,
        password: smtpPass,
        ssl_enabled: form.smtp_ssl_enabled || form.ssl_enabled || cfgDefaults.smtp_ssl_enabled,
      })
      showToast(result.message, result.status === 'success' ? 'success' : 'error')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Connection test failed', 'error')
    } finally {
      setTesting(false)
    }
  }

  /* ── Disconnect ─────────────────────────────────────────────── */
  const handleDisconnect = async (prov) => {
    if (!window.confirm(`Disconnect ${PROVIDER_CONFIG[prov].label} account?`)) return
    try {
      await disconnectProvider(prov)
      showToast(`${PROVIDER_CONFIG[prov].label} disconnected`)
      await loadSettings()
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to disconnect', 'error')
    }
  }

  /* ── Set as Default ─────────────────────────────────────────── */
  const handleSetDefault = async (prov) => {
    try {
      await setDefaultProvider(prov)
      showToast(`${PROVIDER_CONFIG[prov].label} set as default`)
      await loadSettings()
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to set default', 'error')
    }
  }

  /* ── OAuth2 Sign In (Outlook) ───────────────────────────────── */
  const handleOAuth2SignIn = async () => {
    setOAuth2Loading(true)
    try {
      const { auth_url } = await getOAuth2AuthorizeUrl()
      // Open popup for Microsoft sign-in
      const w = 600, h = 700
      const left = window.screenX + (window.outerWidth - w) / 2
      const top = window.screenY + (window.outerHeight - h) / 2
      const popup = window.open(auth_url, 'outlook_oauth2', `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`)
      if (!popup) {
        showToast('Popup blocked! Please allow popups for this site.', 'error')
        setOAuth2Loading(false)
      }
      // The popup will postMessage when done — handled by the useEffect listener
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to start OAuth2 sign-in', 'error')
      setOAuth2Loading(false)
    }
  }

  /* ── OAuth2 Disconnect (Outlook) ────────────────────────────── */
  const handleOAuth2Disconnect = async () => {
    if (!window.confirm('Disconnect Outlook OAuth2? You will need to sign in again.')) return
    try {
      await disconnectOAuth2()
      showToast('Outlook OAuth2 disconnected')
      await loadSettings()
      await loadOAuth2Status()
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to disconnect OAuth2', 'error')
    }
  }

  const isConnected = settings[provider]?.is_connected
  const cfg = PROVIDER_CONFIG[provider]

  return (
    <div style={{ width: '100%', minHeight: 'calc(100vh - 56px)', backgroundColor: '#f8fafc' }}>

      {/* ── Toast notification ──────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '72px', right: '24px', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 24px', borderRadius: '10px', maxWidth: '480px',
          backgroundColor: toast.type === 'error' ? '#fef2f2' : '#ecfdf5',
          border: `1px solid ${toast.type === 'error' ? '#fca5a5' : '#6ee7b7'}`,
          color: toast.type === 'error' ? '#991b1b' : '#065f46',
          fontSize: '14px', fontWeight: 500,
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
          animation: 'slideInRight 0.3s ease-out',
        }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>
            {toast.type === 'error' ? '❌' : '✅'}
          </span>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8', padding: 0, lineHeight: 1 }}>
            ×
          </button>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ padding: '28px 40px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Email Settings
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0' }}>
          Connect your email account to send emails from the Action Center. Your credentials are encrypted and stored securely.
        </p>
      </div>

      {/* ── Main 2-column layout ────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0', padding: '24px 40px 40px', alignItems: 'flex-start' }}>

        {/* ═══════════ LEFT PANEL — Connected Accounts (fixed width) ═══════════ */}
        <div style={{ width: '280px', flexShrink: 0, marginRight: '28px' }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '12px',
            border: '1px solid #e2e8f0', overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              backgroundColor: '#fafbfc',
            }}>
              <h3 style={{
                fontSize: '12px', fontWeight: 700, color: '#64748b', margin: 0,
                textTransform: 'uppercase', letterSpacing: '0.8px',
              }}>
                Connected Accounts
              </h3>
            </div>

            <div style={{ padding: '8px' }}>
              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  Loading accounts...
                </div>
              ) : (
                PROVIDERS.map(prov => {
                  const s = settings[prov]
                  const c = PROVIDER_CONFIG[prov]
                  const isActive = provider === prov
                  return (
                    <div
                      key={prov}
                      onClick={() => setProvider(prov)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '14px 16px', marginBottom: '4px',
                        borderRadius: '10px', cursor: 'pointer',
                        border: isActive ? `2px solid ${c.color}` : '2px solid transparent',
                        backgroundColor: isActive ? c.colorLight : '#fff',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        backgroundColor: isActive ? c.color : '#f1f5f9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.2s',
                      }}>
                        <span style={{ fontSize: '16px', color: isActive ? '#fff' : '#94a3b8', fontWeight: 700 }}>
                          {c.label[0]}
                        </span>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '14px', fontWeight: 600,
                            color: isActive ? '#0f172a' : '#475569',
                          }}>
                            {c.label}
                          </span>
                          {s?.is_default && (
                            <span style={{
                              fontSize: '9px', fontWeight: 700, color: '#fff',
                              backgroundColor: c.color, borderRadius: '3px',
                              padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.3px',
                            }}>
                              Default
                            </span>
                          )}
                        </div>
                        {s?.is_connected ? (
                          <div style={{ fontSize: '12px', color: '#059669', marginTop: '1px', fontWeight: 500 }}>
                            Connected ✓
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>
                            Not connected
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ═══════════ RIGHT PANEL — Provider Settings (flex 1) ═══════════ */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '12px',
            border: '1px solid #e2e8f0', overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>

            {/* ── Provider tabs ──────────────────────────────────── */}
            <div style={{
              display: 'flex', borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#fafbfc',
            }}>
              {PROVIDERS.map(prov => {
                const c = PROVIDER_CONFIG[prov]
                const isActive = provider === prov
                return (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => setProvider(prov)}
                    style={{
                      flex: 1, padding: '14px 20px',
                      fontSize: '14px', fontWeight: 600,
                      border: 'none',
                      borderBottom: isActive ? `3px solid ${c.color}` : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: isActive ? '#fff' : 'transparent',
                      color: isActive ? c.color : '#64748b',
                    }}
                  >
                    {c.label}
                    {settings[prov]?.is_connected && (
                      <span style={{ marginLeft: '6px', fontSize: '11px' }}>✅</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* ── Form body ──────────────────────────────────────── */}
            <div style={{ padding: '28px 32px 32px' }}>

              {/* Warning / info banner */}
              {provider === 'outlook' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', marginBottom: '24px',
                  backgroundColor: '#e7f3ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  fontSize: '13px', color: '#0b5ed7', fontWeight: 500,
                }}>
                  <span style={{ fontSize: '15px', flexShrink: 0 }}>\u2139\uFE0F</span>
                  Outlook integration uses secure external redirect. No manual SMTP setup required.
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 16px', marginBottom: '24px',
                  backgroundColor: cfg.warningBg,
                  border: `1px solid ${cfg.warningBorder}`,
                  borderRadius: '8px',
                  fontSize: '13px', color: cfg.warningColor, fontWeight: 500,
                }}>
                  <span>{cfg.warningIcon}</span>
                  {cfg.warning}
                </div>
              )}

              {/* ── OAuth2 section (Outlook only) ─────────────────── */}
              {provider === 'outlook' && oauth2Status.oauth2_available && (
                <div style={{
                  padding: '20px 24px', marginBottom: '24px',
                  backgroundColor: oauth2Status.oauth2_connected ? '#ecfdf5' : '#f0f9ff',
                  border: `1.5px solid ${oauth2Status.oauth2_connected ? '#6ee7b7' : '#93c5fd'}`,
                  borderRadius: '10px',
                }}>
                  {oauth2Status.oauth2_connected ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#065f46', marginBottom: '2px' }}>
                          ✅ Connected via Microsoft OAuth2
                        </div>
                        <div style={{ fontSize: '13px', color: '#047857' }}>
                          Signed in as <strong>{oauth2Status.email}</strong> — emails send via secure OAuth2 token.
                        </div>
                      </div>
                      <button
                        onClick={handleOAuth2Disconnect}
                        style={{
                          padding: '8px 18px', fontSize: '13px', fontWeight: 600,
                          backgroundColor: '#fff', color: '#dc2626',
                          border: '1.5px solid #fca5a5', borderRadius: '8px',
                          cursor: 'pointer', transition: 'all 0.2s',
                        }}
                      >
                        Disconnect OAuth2
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e40af', marginBottom: '6px' }}>
                        🔐 Sign in with Microsoft (Recommended)
                      </div>
                      <p style={{ fontSize: '13px', color: '#3b82f6', margin: '0 0 14px' }}>
                        Microsoft has disabled password-based SMTP. Use OAuth2 to securely connect your Outlook account without sharing your password.
                      </p>
                      <button
                        onClick={handleOAuth2SignIn}
                        disabled={oauth2Loading}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '10px',
                          padding: '12px 28px', fontSize: '14px', fontWeight: 600,
                          backgroundColor: '#0078d4', color: '#fff',
                          border: 'none', borderRadius: '8px',
                          cursor: oauth2Loading ? 'not-allowed' : 'pointer',
                          opacity: oauth2Loading ? 0.7 : 1, transition: 'all 0.2s',
                          boxShadow: '0 2px 8px rgba(0,120,212,0.3)',
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
                          <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                          <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                          <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                          <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                        </svg>
                        {oauth2Loading ? 'Signing in...' : 'Sign in with Microsoft'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Manual SMTP section header (if Outlook + OAuth2 available) ── */}
              {provider === 'outlook' && oauth2Status.oauth2_available && !oauth2Status.oauth2_connected && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  marginBottom: '20px', color: '#94a3b8', fontSize: '12px', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                  OR CONFIGURE MANUALLY
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                </div>
              )}

              {/* ── Email form section (disabled for Outlook) ──────── */}
              <div style={{ position: 'relative' }}>
                {/* Blur wrapper */}
                <div style={{
                  pointerEvents: provider === 'outlook' ? 'none' : 'auto',
                  opacity: provider === 'outlook' ? 0.45 : 1,
                  filter: provider === 'outlook' ? 'blur(1.5px)' : 'none',
                  transition: 'all 0.3s ease',
                }}>

              {/* ── Quick Connect: Email + App Password ─────────── */}
              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle(cfg.color)}>Email Address *</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={e => handleEmailChange(e.target.value)}
                  placeholder="your.email@example.com"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle(cfg.color)}>App Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password || ''}
                    onChange={e => handleChange('password', e.target.value)}
                    placeholder={isConnected ? '(unchanged — leave blank to keep)' : 'Enter your App Password'}
                    style={{ ...inputStyle, paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={eyeBtnStyle}
                    title={showPassword ? 'Hide' : 'Show'}
                  >
                    {showPassword ? eyeOffSvg : eyeOnSvg}
                  </button>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                  {provider === 'gmail'
                    ? '⚠️ Use an App Password, not your Gmail password. Generate at: Google Account → Security → App Passwords'
                    : provider === 'zoho'
                    ? '⚠️ Use an App Password if 2FA is enabled. Generate at: Zoho Account → Security → App Passwords'
                    : '⚠️ Use an App Password for secure SMTP access.'}
                </p>
              </div>

              {/* ── IMAP/SMTP info summary (read-only) ────────────── */}
              {!showAdvanced && (
                <div style={{
                  display: 'flex', gap: '16px', marginBottom: '24px',
                  padding: '12px 16px', backgroundColor: '#f8fafc',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  fontSize: '12px', color: '#64748b',
                }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#475569' }}>IMAP:</strong> {form.imap_host || cfg.imap_host}:{form.imap_port || cfg.imap_port}
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#475569' }}>SMTP:</strong> {form.smtp_host || cfg.smtp_host}:{form.smtp_port || cfg.smtp_port}
                  </div>
                  <div>
                    <strong style={{ color: '#475569' }}>SSL:</strong> {form.ssl_enabled || cfg.ssl_enabled}
                  </div>
                </div>
              )}

              {/* ── Advanced toggle ───────────────────────────────── */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '13px', fontWeight: 600, color: cfg.color,
                  marginBottom: showAdvanced ? '20px' : '24px',
                  padding: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {showAdvanced ? 'Hide Advanced Settings' : 'Advanced Settings (IMAP / SMTP)'}
              </button>

              {/* ── Advanced: Full IMAP / SMTP layout ─────────────── */}
              {showAdvanced && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '24px' }}>

                {/* ═══ LEFT COLUMN — Receiving emails (IMAP) ═══ */}
                <fieldset style={fieldsetStyle}>
                  <legend style={legendStyle}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>Receiving emails</span>
                    <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: 400, marginTop: '1px' }}>Server Type: IMAP Mail Server</span>
                  </legend>

                  {/* Server Name + Port */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={fieldLabelStyle(cfg.color)}>Server Name</label>
                      <input value={form.imap_host || ''} onChange={e => handleChange('imap_host', e.target.value)} placeholder="Server Name" style={inputStyle} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle(cfg.color)}>Port</label>
                      <input type="number" value={form.imap_port || ''} onChange={e => handleChange('imap_port', e.target.value)} placeholder="993" style={inputStyle} />
                    </div>
                  </div>

                  {/* User Name */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={fieldLabelStyle(cfg.color)}>User Name</label>
                    <input
                      value={form.username || ''}
                      onChange={e => handleChange('username', e.target.value)}
                      placeholder="User Name"
                      style={inputStyle}
                    />
                  </div>

                  {/* Security Settings */}
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
                      Security Settings:
                    </h4>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={fieldLabelStyle(cfg.color)}>SSL (connection protection)</label>
                      <select
                        value={form.ssl_enabled || 'Autodetect'}
                        onChange={e => handleChange('ssl_enabled', e.target.value)}
                        style={selectStyle}
                      >
                        {SSL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabelStyle(cfg.color)}>Authentication methods</label>
                      <select
                        value={form.auth_method || 'Autodetect'}
                        onChange={e => handleChange('auth_method', e.target.value)}
                        style={selectStyle}
                      >
                        {AUTH_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* IMAP Password (separate) */}
                  <div>
                    <label style={fieldLabelStyle(cfg.color)}>IMAP Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password || ''}
                        onChange={e => handleChange('password', e.target.value)}
                        placeholder={isConnected ? '(unchanged)' : 'Password'}
                        style={{ ...inputStyle, paddingRight: '48px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={eyeBtnStyle}
                        title={showPassword ? 'Hide' : 'Show'}
                      >
                        {showPassword ? eyeOffSvg : eyeOnSvg}
                      </button>
                    </div>
                  </div>
                </fieldset>

                {/* ═══ RIGHT COLUMN — Sending emails (SMTP) ═══ */}
                <fieldset style={fieldsetStyle}>
                  <legend style={legendStyle}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>Sending emails</span>
                    <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: 400, marginTop: '1px' }}>Server Type: SMTP Mail Server</span>
                  </legend>

                  {/* Server Name + Port */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={fieldLabelStyle(cfg.color)}>Server Name</label>
                      <input value={form.smtp_host || ''} onChange={e => handleChange('smtp_host', e.target.value)} placeholder="Server Name" style={inputStyle} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle(cfg.color)}>Port</label>
                      <input type="number" value={form.smtp_port || ''} onChange={e => handleChange('smtp_port', e.target.value)} placeholder="587" style={inputStyle} />
                    </div>
                  </div>

                  {/* User Name */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={fieldLabelStyle(cfg.color)}>User Name</label>
                    <input
                      value={form.smtp_username || ''}
                      onChange={e => handleChange('smtp_username', e.target.value)}
                      placeholder="User Name"
                      style={inputStyle}
                    />
                  </div>

                  {/* Security Settings */}
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
                      Security Settings:
                    </h4>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={fieldLabelStyle(cfg.color)}>SSL (connection protection)</label>
                      <select
                        value={form.smtp_ssl_enabled || 'Autodetect'}
                        onChange={e => handleChange('smtp_ssl_enabled', e.target.value)}
                        style={selectStyle}
                      >
                        {SSL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabelStyle(cfg.color)}>Authentication methods</label>
                      <select
                        value={form.smtp_auth_method || 'Autodetect'}
                        onChange={e => handleChange('smtp_auth_method', e.target.value)}
                        style={selectStyle}
                      >
                        {AUTH_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* SMTP Password (separate) */}
                  <div>
                    <label style={fieldLabelStyle(cfg.color)}>SMTP Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showSmtpPassword ? 'text' : 'password'}
                        value={form.smtp_password || ''}
                        onChange={e => handleChange('smtp_password', e.target.value)}
                        placeholder={isConnected ? '(unchanged)' : 'Password'}
                        style={{ ...inputStyle, paddingRight: '48px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                        style={eyeBtnStyle}
                        title={showSmtpPassword ? 'Hide' : 'Show'}
                      >
                        {showSmtpPassword ? eyeOffSvg : eyeOnSvg}
                      </button>
                    </div>
                  </div>
                </fieldset>
              </div>
              )}

              {/* ── Sync checkbox ─────────────────────────────────── */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                fontSize: '13px', color: '#475569', cursor: 'pointer',
                marginBottom: '28px',
              }}>
                <input
                  type="checkbox"
                  defaultChecked
                  style={{ width: '16px', height: '16px', accentColor: cfg.color, cursor: 'pointer' }}
                />
                Connect your provider account to KPRMT and sync your outgoing emails and replies
              </label>

              {/* ── Action buttons ────────────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '12px 32px', fontSize: '14px', fontWeight: 600,
                    backgroundColor: cfg.color, color: '#fff',
                    border: 'none', borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1, transition: 'all 0.2s',
                    boxShadow: `0 2px 8px ${cfg.color}40`,
                  }}
                >
                  {saving ? 'Connecting...' : isConnected ? 'Update Account' : 'Connect your account'}
                </button>

                <button
                  onClick={handleTest}
                  disabled={testing}
                  style={{
                    padding: '12px 28px', fontSize: '14px', fontWeight: 600,
                    backgroundColor: '#fff', color: cfg.color,
                    border: `2px solid ${cfg.color}`, borderRadius: '8px',
                    cursor: testing ? 'not-allowed' : 'pointer',
                    opacity: testing ? 0.7 : 1, transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>

                {isConnected && !settings[provider]?.is_default && (
                  <button
                    onClick={() => handleSetDefault(provider)}
                    style={{
                      padding: '12px 24px', fontSize: '14px', fontWeight: 600,
                      backgroundColor: '#f8fafc', color: '#475569',
                      border: '1.5px solid #cbd5e1', borderRadius: '8px',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    ⭐ Set as Default
                  </button>
                )}

                {isConnected && (
                  <button
                    onClick={() => handleDisconnect(provider)}
                    style={{
                      padding: '12px 24px', fontSize: '14px', fontWeight: 600,
                      backgroundColor: '#fff', color: '#dc2626',
                      border: '1.5px solid #fca5a5', borderRadius: '8px',
                      cursor: 'pointer', transition: 'all 0.2s',
                      marginLeft: 'auto',
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
                </div>{/* end blur wrapper */}

                {/* ── Outlook overlay ────────────────────────────── */}
                {provider === 'outlook' && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.55)',
                    zIndex: 10, borderRadius: '8px',
                  }}>
                    <div style={{
                      backgroundColor: '#fff', padding: '28px 32px',
                      borderRadius: '14px', textAlign: 'center',
                      maxWidth: '420px', width: '90%',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      border: '1px solid #e2e8f0',
                    }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        backgroundColor: '#f0f4ff', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 14px', fontSize: '22px',
                      }}>{'\u2699\uFE0F'}</div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
                        Outlook Setup Not Required
                      </h3>
                      <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.6 }}>
                        Outlook email sending is handled via secure external redirect.
                        Manual SMTP configuration is not needed.
                      </p>
                      <div style={{
                        backgroundColor: '#f0f6ff', borderRadius: '8px',
                        padding: '12px 16px', fontSize: '12px', color: '#0078d4',
                        lineHeight: 1.8, fontWeight: 500,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078d4" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                          External redirect enabled
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078d4" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                          No credentials needed
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078d4" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                          Secure compose flow
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>{/* end relative container */}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/* ── Style helpers ───────────────────────────────────────────── */

const eyeBtnStyle = {
  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#94a3b8', fontSize: '16px', padding: '0', lineHeight: 1,
  display: 'flex', alignItems: 'center',
}

const eyeOffSvg = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
)

const eyeOnSvg = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
)

const labelStyle = (color) => ({
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: color || '#dc2626',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

const fieldLabelStyle = (color) => ({
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: color || '#6b7280',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
})

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  fontSize: '14px',
  border: '1.5px solid #d1d5db',
  borderRadius: '8px',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
  backgroundColor: '#fff',
  color: '#1e293b',
  lineHeight: '1.4',
}

const selectStyle = {
  width: '100%',
  padding: '11px 14px',
  fontSize: '14px',
  border: '1.5px solid #d1d5db',
  borderRadius: '8px',
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
  backgroundColor: '#fff',
  color: '#1e293b',
  cursor: 'pointer',
  appearance: 'auto',
}

const fieldsetStyle = {
  border: '1.5px solid #e2e8f0',
  borderRadius: '10px',
  padding: '16px 18px 18px',
  margin: 0,
}

const legendStyle = {
  padding: '0 8px',
  fontSize: '13px',
}
