import { useCallback, useEffect, useRef, useState } from 'react'
import EmailBodyField from './EmailBodyField'
import TemplatePickerModal from './TemplatePickerModal'
import { sendEmail, sendEmailWithAttachments, getSenderInfo } from '../../services/emailApi'
import { prepareEmailHtml } from '../../services/emailHtmlUtils'
import { fetchCandidateById } from '../../services/api'

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

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
  const fileInputRef = useRef(null)
  const [subject, setSubject] = useState(initialSubject || '')
  const [body, setBody] = useState(initialBody || '')
  const [files, setFiles] = useState([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [candidate, setCandidate] = useState(null)
  const [senderInfo, setSenderInfo] = useState({ gmail: { email: '', configured: false }, outlook: { email: '', configured: false } })
  // activeProvider: switchable per session, persists to localStorage
  const [activeProvider, setActiveProvider] = useState(
    () => provider || localStorage.getItem('emailProvider') || 'gmail'
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

  const handleProviderChange = useCallback((p) => {
    setActiveProvider(p)
    localStorage.setItem('emailProvider', p)
  }, [])

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

    setSending(true)
    try {
      const emailBody = prepareEmailHtml(body)

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
      const msg = err?.response?.data?.detail || err.message || 'Failed to send email'
      onToast?.({ message: msg, type: 'error' })
    } finally {
      setSending(false)
    }
  }, [candidateId, candidateEmail, subject, body, files, activeProvider, onToast, onSent])

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

        {/* Provider toggle — Gmail / Outlook */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '3px',
        }}>
          {[{ key: 'gmail', label: 'Gmail', color: '#2563eb' }, { key: 'outlook', label: 'Outlook', color: '#0078d4' }].map(({ key, label, color }) => (
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

        {/* Sending From banner */}
        {(() => {
          const info = senderInfo[activeProvider]
          const senderEmail = info?.email || ''
          const isOutlook = activeProvider === 'outlook'
          return (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
              padding: '10px 16px', marginBottom: '10px',
              backgroundColor: isOutlook ? '#f0f4ff' : '#fef2f2',
              borderRadius: '8px',
              border: `1px solid ${isOutlook ? '#c7d5fe' : '#fecaca'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={isOutlook ? '#0078d4' : '#dc2626'} strokeWidth="2">
                  <path d="M22 2L11 13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span style={{ fontSize: '13px', color: isOutlook ? '#1e3a8a' : '#991b1b', fontWeight: 500 }}>
                  Sending from: <strong>{senderEmail || 'Not configured'}</strong>
                </span>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 10px',
                borderRadius: '20px', letterSpacing: '0.03em',
                backgroundColor: isOutlook ? '#0078d4' : '#dc2626',
                color: '#fff',
              }}>
                {isOutlook ? 'Outlook' : 'Gmail'}
              </span>
            </div>
          )
        })()}

        {/* Sending to banner */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
          padding: '10px 16px', marginBottom: '16px',
          backgroundColor: activeProvider === 'outlook' ? '#f0f7ff' : '#eff6ff',
          borderRadius: '8px',
          border: `1px solid ${activeProvider === 'outlook' ? '#bae0ff' : '#bfdbfe'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={activeProvider === 'outlook' ? '#0078d4' : '#2563eb'} strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span style={{ fontSize: '13px', color: activeProvider === 'outlook' ? '#0369a1' : '#1e40af', fontWeight: 500 }}>
              Sending to: {candidateEmail || candidateName || 'Unknown'}
            </span>
          </div>
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '2px 10px',
            borderRadius: '20px', letterSpacing: '0.03em',
            backgroundColor: activeProvider === 'outlook' ? '#0078d4' : '#2563eb',
            color: '#fff',
          }}>
            {activeProvider === 'outlook' ? 'Outlook' : 'Gmail'}
          </span>
        </div>

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
            backgroundColor: sending ? '#94a3b8' : (activeProvider === 'outlook' ? '#0078d4' : '#2563eb'),
            border: 'none', borderRadius: '8px',
            cursor: sending ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            opacity: sending ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (!sending) e.currentTarget.style.backgroundColor = activeProvider === 'outlook' ? '#006cbe' : '#1d4ed8' }}
          onMouseLeave={e => { if (!sending) e.currentTarget.style.backgroundColor = activeProvider === 'outlook' ? '#0078d4' : '#2563eb' }}
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
