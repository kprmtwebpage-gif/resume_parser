import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmailBodyField from './EmailBodyField'
import TemplatePickerModal from './TemplatePickerModal'
import { sendEmail, sendEmailWithAttachments, getSenderInfo, getEmailSettings, logSentEmail } from '../../services/emailApi'
import { prepareEmailHtml } from '../../services/emailHtmlUtils'
import { fetchCandidateById } from '../../services/api'

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * Detect email provider from an email address domain.
 */
function getEmailProvider(email) {
  if (!email) return 'default'
  const domain = email.toLowerCase()
  if (domain.includes('@gmail.com') || domain.includes('@googlemail.com')) return 'gmail'
  if (domain.includes('@zohomail.in') || domain.includes('@zoho.com')) return 'zoho'
  if (domain.includes('@outlook.com') || domain.includes('@hotmail.com') || domain.includes('@live.com') || domain.includes('@office365.com')) return 'outlook'
  return 'default'
}

const providerTheme = {
  gmail:   { bg: '#fdecea', border: '#f5c2c7', text: '#d93025', badgeBg: '#d93025', badgeText: '#fff' },
  zoho:    { bg: '#e7f5ec', border: '#b7e4c7', text: '#1b7f3b', badgeBg: '#1b7f3b', badgeText: '#fff' },
  outlook: { bg: '#e7f0ff', border: '#b6d4fe', text: '#0b5ed7', badgeBg: '#0b5ed7', badgeText: '#fff' },
  default: { bg: '#f8f9fa', border: '#dee2e6', text: '#495057', badgeBg: '#6c757d', badgeText: '#fff' },
}

/**
 * Replace {{variable}} placeholders in a string with candidate data.
 */
function replaceTemplateVars(html, candidate, fallbackName) {
  if (!html) return ''
  const c = candidate || {}
  const expYears = c.experience?.years_of_experience
    ? `${c.experience.years_of_experience} years` : ''
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || fallbackName || ''

  const vars = {
    candidate_name: name,
    phone: c.phone || (c.phones && c.phones[0]) || '',
    email: c.email || (c.emails && c.emails[0]) || '',
    location: c.location || c.address || '',
    experience: expYears,
    us_experience: c.us_experience || '',
    work_auth: c.work_authorization || c.visa_support || '',
    visa_validity: c.visa_validity || '',
    linkedin: c.linkedin || '',
    rate: c.rate || '',
    education: c.qualification || '',
    passport: c.passport_number || '',
    availability: c.availability || '',
    skills: Array.isArray(c.skills) ? c.skills.join(', ') : (c.skills || ''),
    dob: c.dob || '',
    university: c.university || '',
    year_of_completion: c.year_of_completion || '',
    submittal_type: c.submittal_type || '',
    willingness_to_relocate: c.willingness_to_relocate || '',
    ssn_last4: c.ssn_last4 || '',
  }

  let result = html
  for (const [key, val] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi')
    result = result.replace(re, val)
  }
  // Strip any remaining unresolved {{...}} placeholders
  result = result.replace(/\{\{\s*\w+\s*\}\}/g, '')
  return result
}

/**
 * ActionCenter — Email compose panel (SMTP-based).
 *
 * Props:
 *  - candidateId: number
 *  - candidateEmail: string
 *  - candidateName: string
 *  - provider: string ('gmail' | 'outlook')
 *  - onBack: () => void — go back to email history
 *  - onSent: () => void — callback after successful send
 *  - onToast: ({ message, type }) => void — show a toast notification
 */
export default function ActionCenter({
  candidateId,
  candidateEmail,
  candidateName,
  provider,
  initialSubject,
  initialBody,
  onBack,
  onSent,
  onToast,
}) {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [subject, setSubject] = useState(initialSubject || '')
  const [body, setBody] = useState(initialBody || '')
  const [files, setFiles] = useState([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [candidate, setCandidate] = useState(null)
  const [senderInfo, setSenderInfo] = useState({ gmail: { email: '', configured: false }, outlook: { email: '', configured: false }, zoho: { email: '', configured: false } })
  const [configuredProviders, setConfiguredProviders] = useState({}) // { gmail: true, outlook: false, zoho: false }
  const [showNotConfigured, setShowNotConfigured] = useState(false)
  // activeProvider: switchable per session, persists to localStorage
  const [activeProvider, setActiveProvider] = useState(
    () => provider || localStorage.getItem('emailProvider') || 'outlook'
  )

  // Fetch full candidate data on mount for template variable replacement
  useEffect(() => {
    if (!candidateId) return
    let cancelled = false
    fetchCandidateById(candidateId)
      .then(data => { if (!cancelled) setCandidate(data) })
      .catch(err => console.warn('Could not fetch candidate for variable replacement:', err))
    return () => { cancelled = true }
  }, [candidateId])

  // Fetch sender info (configured "from" emails) on mount
  useEffect(() => {
    let cancelled = false
    getSenderInfo()
      .then(data => { if (!cancelled) setSenderInfo(data) })
      .catch(err => console.warn('Could not fetch sender info:', err))
    return () => { cancelled = true }
  }, [])

  // Fetch which providers are configured by the user
  useEffect(() => {
    let cancelled = false
    getEmailSettings()
      .then(data => {
        if (!cancelled) {
          const map = {}
          data.forEach(s => { map[s.provider] = s.is_connected })
          setConfiguredProviders(map)
        }
      })
      .catch(err => console.warn('Could not fetch email settings:', err))
    return () => { cancelled = true }
  }, [])

  const handleProviderChange = useCallback((p) => {
    // Outlook uses web compose — no SMTP config needed
    if (p === 'outlook') {
      setActiveProvider(p)
      localStorage.setItem('emailProvider', p)
      return
    }
    // Check if provider is configured
    if (!configuredProviders[p] && !senderInfo[p]?.configured) {
      setShowNotConfigured(p)
      return
    }
    setActiveProvider(p)
    localStorage.setItem('emailProvider', p)
  }, [configuredProviders, senderInfo])

  /* ── File attachments ────────────────────────────────────────── */
  const handleFileSelect = useCallback((e) => {
    const selected = Array.from(e.target.files || [])
    const errors = []

    const validFiles = selected.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        errors.push(`${f.name} exceeds 10MB`)
        return false
      }
      return true
    })

    if (files.length + validFiles.length > MAX_FILES) {
      onToast?.({ message: `Maximum ${MAX_FILES} attachments allowed`, type: 'error' })
      return
    }
    if (errors.length) {
      onToast?.({ message: errors.join(', '), type: 'error' })
    }

    setFiles(prev => [...prev, ...validFiles])
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [files.length, onToast])

  const removeFile = useCallback((idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const [sending, setSending] = useState(false)
  const [outlookModal, setOutlookModal] = useState({ open: false, status: 'copied' }) // status: 'copied' | 'fallback'
  const [outlookConfirm, setOutlookConfirm] = useState(false) // confirmation popup after user returns
  const outlookUrlRef = useRef('')
  const outlookFlowActiveRef = useRef(false)

  // Detect when user returns to the app after Outlook tab
  useEffect(() => {
    const onFocus = () => {
      if (outlookFlowActiveRef.current) {
        outlookFlowActiveRef.current = false
        setOutlookConfirm(true)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  /* ── Prepare Outlook: copy HTML, store URL, show modal ──────── */
  const handleOutlookWebCompose = useCallback(async () => {
    // prepareEmailHtml returns a full <!DOCTYPE html>…</html> document (for SMTP).
    // For clipboard rich-paste we need ONLY the inner body HTML wrapped in a <div>.
    const fullDoc = prepareEmailHtml(body)
    const bodyMatch = fullDoc.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    const innerHtml = bodyMatch ? bodyMatch[1] : body
    const richHtml = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${innerHtml}</div>`

    // Copy as rich HTML using ClipboardItem + text/html MIME type
    let copied = false
    try {
      const htmlBlob = new Blob([richHtml], { type: 'text/html' })
      const textBlob = new Blob([richHtml], { type: 'text/plain' })
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ])
      copied = true
    } catch (clipErr) {
      console.warn('[ActionCenter] ClipboardItem write failed:', clipErr)
      // Fallback: execCommand('copy') via hidden contentEditable div (preserves rich HTML)
      try {
        const div = document.createElement('div')
        div.contentEditable = 'true'
        div.innerHTML = richHtml
        div.style.position = 'fixed'
        div.style.left = '-9999px'
        div.style.top = '-9999px'
        div.style.opacity = '0'
        document.body.appendChild(div)
        const range = document.createRange()
        range.selectNodeContents(div)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
        document.execCommand('copy')
        sel.removeAllRanges()
        document.body.removeChild(div)
        copied = true
      } catch (fallbackErr) {
        console.error('[ActionCenter] Fallback rich copy also failed:', fallbackErr)
      }
    }

    // If clipboard totally failed — download .html file as last resort
    if (!copied) {
      try {
        const blob = new Blob([fullDoc], { type: 'text/html' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `email-${(subject || 'draft').replace(/[^a-z0-9]/gi, '_').slice(0, 40)}.html`
        a.click()
        URL.revokeObjectURL(a.href)
      } catch (dlErr) {
        console.error('[ActionCenter] Download fallback failed:', dlErr)
      }
    }

    // Store URL — Outlook opens only when user clicks "Got it"
    outlookUrlRef.current = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(candidateEmail)}&subject=${encodeURIComponent(subject)}`

    // Show instruction modal
    setOutlookModal({ open: true, status: copied ? 'copied' : 'fallback' })
  }, [body, candidateEmail, subject])

  /* ── "Got it" handler: open Outlook → close modal → wait for return */
  const handleOutlookGotIt = useCallback(() => {
    // 1. Open Outlook compose in new tab
    if (outlookUrlRef.current) {
      window.open(outlookUrlRef.current, '_blank', 'noopener,noreferrer')
    }
    // 2. Close instruction modal
    setOutlookModal({ open: false, status: 'copied' })
    // 3. Arm the focus listener so confirmation shows when user returns
    outlookFlowActiveRef.current = true
  }, [])

  /* ── Send email via SMTP (configured in .env) ─────────────────── */
  const handleSend = useCallback(async () => {
    if (!candidateEmail) {
      onToast?.({ message: 'No recipient email address', type: 'error' })
      return
    }
    if (!subject.trim()) {
      onToast?.({ message: 'Please enter a subject', type: 'error' })
      return
    }
    if (!body || !body.trim()) {
      onToast?.({ message: 'Please enter email content', type: 'error' })
      return
    }

    // Outlook: skip SMTP, open Outlook Web Compose with HTML on clipboard
    if (activeProvider === 'outlook') {
      await handleOutlookWebCompose()
      return
    }

    setSending(true)
    try {
      const emailBody = prepareEmailHtml(body)
      console.log('[ActionCenter] Sending with provider:', activeProvider)
      console.log('[ActionCenter] Recipient:', candidateEmail)

      let result
      // Send via SMTP (configured in server .env)
      if (files.length > 0) {
        result = await sendEmailWithAttachments({
          candidateId: candidateId || 0,
          recipientEmail: candidateEmail,
          subject,
          body: emailBody,
          provider: activeProvider,
          files,
        })
      } else {
        result = await sendEmail({
          candidateId: candidateId || 0,
          recipientEmail: candidateEmail,
          subject,
          body: emailBody,
          provider: activeProvider,
        })
      }

      if (result?.status === 'pending') {
        onToast?.({ message: 'Email service not configured on server. Contact admin.', type: 'error' })
      } else if (result?.status === 'failed') {
        onToast?.({ message: 'Email delivery failed. Check server logs.', type: 'error' })
      } else {
        const senderInfo = result?.sender_email ? ` from ${result.sender_email}` : ''
        onToast?.({ message: `Email sent successfully${senderInfo}!`, type: 'success' })
        onSent?.()
      }
    } catch (err) {
      console.error('Failed to send email:', err)
      console.error('Response data:', err?.response?.data)
      console.error('Response status:', err?.response?.status)
      const detail = err?.response?.data?.detail
      const msg = detail || err.message || 'Failed to send email'
      onToast?.({ message: msg, type: 'error' })
    } finally {
      setSending(false)
    }
  }, [candidateId, candidateEmail, subject, body, files, activeProvider, handleOutlookWebCompose, onToast, onSent])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', border: 'none',
            backgroundColor: '#f1f5f9', borderRadius: '6px',
            cursor: 'pointer', color: '#475569', fontSize: '16px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
          title="Back to Email History"
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
            Action Center
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
            Compose email
          </p>
        </div>

        {/* Provider toggle — Gmail / Outlook / Zoho */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '3px',
        }}>
          {[
            { key: 'outlook', label: 'Outlook', color: '#0078d4' },
            { key: 'zoho', label: 'Zoho', color: '#16a34a' },
            { key: 'gmail', label: 'Gmail', color: '#dc2626' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleProviderChange(key)}
              style={{
                padding: '5px 14px', fontSize: '12px', fontWeight: 600,
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: activeProvider === key ? color : 'transparent',
                color: activeProvider === key ? '#fff' : '#64748b',
                boxShadow: activeProvider === key ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Compose area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* Not configured popup */}
        {showNotConfigured && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              backgroundColor: '#fff', borderRadius: '16px', padding: '32px',
              maxWidth: '420px', width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📧</div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
                  Account Not Connected
                </h3>
                <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                  Please connect your <strong>{typeof showNotConfigured === 'string' ? showNotConfigured.charAt(0).toUpperCase() + showNotConfigured.slice(1) : ''}</strong> account first to send emails with this provider.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowNotConfigured(false)}
                  style={{
                    flex: 1, padding: '10px', fontSize: '14px', fontWeight: 600,
                    backgroundColor: '#f1f5f9', color: '#475569',
                    border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer',
                  }}
                >Cancel</button>
                <button
                  onClick={() => navigate('/user/email-settings')}
                  style={{
                    flex: 1, padding: '10px', fontSize: '14px', fontWeight: 600,
                    backgroundColor: '#0078d4', color: '#fff',
                    border: 'none', borderRadius: '8px', cursor: 'pointer',
                  }}
                >Go to Email Settings</button>
              </div>
            </div>
          </div>
        )}

        {/* Sending From banner */}
        {(() => {
          const info = senderInfo[activeProvider]
          const senderEmail = info?.email || ''
          const fromProvider = activeProvider === 'outlook' ? 'outlook' : (senderEmail ? getEmailProvider(senderEmail) : activeProvider)
          const theme = providerTheme[fromProvider] || providerTheme.default
          const providerLabel = (fromProvider === 'default' ? activeProvider : fromProvider).charAt(0).toUpperCase() + (fromProvider === 'default' ? activeProvider : fromProvider).slice(1)
          const bannerText = activeProvider === 'outlook'
            ? 'Content will be copied automatically — paste with Ctrl + V in Outlook'
            : `Sending from: <strong>${senderEmail || 'Not configured'}</strong>`
          return (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
              padding: '10px 16px', marginBottom: '10px',
              backgroundColor: theme.bg, borderRadius: '8px', border: `1px solid ${theme.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={theme.badgeBg} strokeWidth="2">
                  {activeProvider === 'outlook' ? (
                    <>
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </>
                  ) : (
                    <><path d="M22 2L11 13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>
                  )}
                </svg>
                <span style={{ fontSize: '13px', color: theme.text, fontWeight: 500 }}
                  dangerouslySetInnerHTML={{ __html: bannerText }}
                />
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 10px',
                borderRadius: '20px', letterSpacing: '0.03em',
                backgroundColor: theme.badgeBg, color: theme.badgeText,
              }}>
                {providerLabel}
              </span>
            </div>
          )
        })()}

        {/* Sending to banner */}
        {(() => {
          const toProvider = getEmailProvider(candidateEmail)
          const toTheme = providerTheme[toProvider] || providerTheme.default
          const badgeLabel = toProvider === 'default' ? 'Email' : toProvider.charAt(0).toUpperCase() + toProvider.slice(1)
          return (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
              padding: '10px 16px', marginBottom: '16px',
              backgroundColor: toTheme.bg,
              borderRadius: '8px',
              border: `1px solid ${toTheme.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={toTheme.badgeBg} strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span style={{ fontSize: '13px', color: toTheme.text, fontWeight: 500 }}>
                  Sending to: {candidateEmail || candidateName || 'Unknown'}
                </span>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 10px',
                borderRadius: '20px', letterSpacing: '0.03em',
                backgroundColor: toTheme.badgeBg,
                color: toTheme.badgeText,
              }}>
                {badgeLabel}
              </span>
            </div>
          )
        })()}

        {/* Subject */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Enter email subject..."
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              color: '#1e293b', backgroundColor: '#ffffff',
              border: '1px solid #d1d5db', borderRadius: '8px',
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
            onBlur={e => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        {/* Rich Text Editor */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              Email Content
            </label>
            <button
              onClick={() => setShowTemplateModal(true)}
              style={{
                padding: '5px 12px', fontSize: '12px', fontWeight: 600,
                color: '#c2410c', backgroundColor: 'transparent',
                border: 'none', cursor: 'pointer',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#9a3412'}
              onMouseLeave={e => e.currentTarget.style.color = '#c2410c'}
            >
              Load Email Templates
            </button>
          </div>
          <EmailBodyField
            value={body}
            onChange={setBody}
            placeholder="Compose your email..."
          />
        </div>

        {/* Attachments */}
        <div style={{ marginBottom: '16px' }}>
          {/* File list */}
          {files.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px',
            }}>
              {files.map((f, idx) => (
                <div key={idx} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 10px', fontSize: '12px',
                  backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: '6px', color: '#475569',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                  <span>{f.name}</span>
                  <span style={{ color: '#94a3b8' }}>({formatFileSize(f.size)})</span>
                  <button
                    onClick={() => removeFile(idx)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ef4444', fontSize: '14px', padding: '0 2px',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add attachments button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_FILES}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', fontSize: '13px', fontWeight: 500,
              color: files.length >= MAX_FILES ? '#94a3b8' : '#475569',
              backgroundColor: '#ffffff',
              border: `1px solid ${files.length >= MAX_FILES ? '#e2e8f0' : '#d1d5db'}`,
              borderRadius: '6px',
              cursor: files.length >= MAX_FILES ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            Add Attachments {files.length > 0 && `(${files.length}/${MAX_FILES})`}
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '14px 20px', borderTop: '1px solid #e2e8f0',
        backgroundColor: '#fafbfc',
      }}>
        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '10px 24px', fontSize: '14px', fontWeight: 600,
            color: '#ffffff',
            backgroundColor: sending ? '#94a3b8' : (providerTheme[activeProvider] || providerTheme.default).badgeBg,
            border: 'none', borderRadius: '8px',
            cursor: sending ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            opacity: sending ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (!sending) { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.filter = 'brightness(0.9)' } }}
          onMouseLeave={e => { if (!sending) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.filter = 'none' } }}
        >
          {sending ? (
            <>
              <div style={{
                width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Sending...
            </>
          ) : activeProvider === 'outlook' ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open in Outlook
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Send Email
            </>
          )}
        </button>
      </div>

      {/* Template Picker Modal */}
      <TemplatePickerModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelect={(tpl) => {
          // Replace {{variables}} with actual candidate data
          setSubject(replaceTemplateVars(tpl.subject, candidate, candidateName))
          setBody(replaceTemplateVars(tpl.body, candidate, candidateName))
          setShowTemplateModal(false)
        }}
      />

      {/* ── Outlook Instruction Modal ────────────────────────────── */}
      {outlookModal.open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOutlookModal({ open: false, status: 'copied' }) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'outlookFadeIn 0.25s ease-out',
          }}
        >
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '32px 28px',
            maxWidth: '420px', width: '90%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
            animation: 'outlookSlideUp 0.3s ease-out',
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                backgroundColor: '#f0f4ff', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px', fontSize: '26px',
              }}>
                {outlookModal.status === 'copied' ? '\u2709\uFE0F' : '\uD83D\uDCC4'}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                {outlookModal.status === 'copied' ? 'Outlook Ready' : 'Email HTML Downloaded'}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                {outlookModal.status === 'copied'
                  ? 'Your formatted email content has been copied. Click the button below to open Outlook.'
                  : 'Clipboard was unavailable. The email was saved as an HTML file.'}
              </p>
            </div>

            {/* Steps */}
            {outlookModal.status === 'copied' ? (
              <div style={{
                backgroundColor: '#f8fafc', borderRadius: '10px',
                padding: '16px 18px', marginBottom: '20px',
                border: '1px solid #e2e8f0',
              }}>
                {[
                  { num: '1', text: 'Click "Got it" to open Outlook', icon: '\uD83D\uDD17' },
                  { num: '2', text: 'Click inside the email body area', icon: '\uD83D\uDDB1\uFE0F' },
                  { num: '3', text: 'Press  Ctrl + V  to paste', icon: '\u2328\uFE0F', bold: true },
                ].map(({ num, text, icon, bold }) => (
                  <div key={num} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '8px 0',
                    borderBottom: num !== '3' ? '1px solid #f1f5f9' : 'none',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      backgroundColor: '#0078d4', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 700, flexShrink: 0,
                    }}>{num}</div>
                    <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: bold ? 700 : 500 }}>
                      {text}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '16px' }}>{icon}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                backgroundColor: '#fffbeb', borderRadius: '10px',
                padding: '14px 16px', marginBottom: '20px',
                border: '1px solid #fde68a', fontSize: '13px', color: '#92400e', lineHeight: 1.6,
              }}>
                Open the downloaded <strong>.html</strong> file, select all content (Ctrl+A),
                copy (Ctrl+C), then paste into Outlook (Ctrl+V).
              </div>
            )}

            {/* Copied badge */}
            {outlookModal.status === 'copied' && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '10px', marginBottom: '18px',
                backgroundColor: '#f0fdf4', borderRadius: '8px',
                border: '1px solid #bbf7d0',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#15803d' }}>
                  Email content copied to clipboard
                </span>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={handleOutlookGotIt}
              style={{
                width: '100%', padding: '11px', fontSize: '14px', fontWeight: 600,
                backgroundColor: '#0078d4', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                transition: 'background 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#006cbe'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0078d4'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Got it — Open Outlook
            </button>
          </div>
        </div>
      )}

      {/* ── Outlook Paste Confirmation Modal ────────────────────── */}
      {outlookConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'outlookFadeIn 0.25s ease-out',
          }}
        >
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '32px 28px',
            maxWidth: '400px', width: '90%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
            animation: 'outlookSlideUp 0.3s ease-out',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                backgroundColor: '#f0fdf4', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px', fontSize: '26px',
              }}>{'\u2705'}</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                Email Ready?
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Did you paste the content in Outlook and send it?
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setOutlookConfirm(false)}
                style={{
                  flex: 1, padding: '11px', fontSize: '14px', fontWeight: 600,
                  backgroundColor: '#f1f5f9', color: '#475569',
                  border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              >
                Not yet
              </button>
              <button
                onClick={async () => {
                  setOutlookConfirm(false)
                  try {
                    await logSentEmail({
                      candidateId:    candidateId || 0,
                      recipientEmail: candidateEmail || '',
                      senderEmail:    '',
                      subject:        subject || '',
                      provider:       'outlook',
                    })
                  } catch (logErr) {
                    console.warn('[ActionCenter] Outlook log failed:', logErr)
                  }
                  onSent?.()
                }}
                style={{
                  flex: 1, padding: '11px', fontSize: '14px', fontWeight: 600,
                  backgroundColor: '#16a34a', color: '#fff',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  transition: 'background 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#15803d'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#16a34a'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Yes, done
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes outlookFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes outlookSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}
