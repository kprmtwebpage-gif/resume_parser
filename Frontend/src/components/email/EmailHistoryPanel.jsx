import { useState } from 'react'

/**
 * EmailHistoryPanel — shows sent/received email list for a candidate.
 * Clicking an item expands it to show full email content (accordion).
 *
 * Props:
 *  - emails: array — pre-fetched & merged email list from parent
 *  - loading: boolean — loading state from parent
 *  - candidateEmail: string
 *  - onCompose: () => void — opens the Action Center
 */
export default function EmailHistoryPanel({ emails = [], loading = false, candidateEmail, onCompose }) {
  const [expandedId, setExpandedId] = useState(null)

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    return `${day} ${time}`
  }

  const formatDateShort = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const toggle = (id) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
            Email History
          </h3>
          {candidateEmail && (
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              {candidateEmail}
            </p>
          )}
        </div>
        <button
          onClick={onCompose}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', fontSize: '13px', fontWeight: 600,
            color: '#ffffff', backgroundColor: '#2563eb',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#2563eb'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          Compose
        </button>
      </div>

      {/* Email List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            <div style={{
              width: '32px', height: '32px', border: '3px solid #e2e8f0',
              borderTopColor: '#2563eb', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
            }} />
            Loading emails...
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : emails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#475569', margin: '0 0 4px' }}>
              No emails yet
            </p>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              Send the first email to this candidate
            </p>
          </div>
        ) : (
          emails.map((email) => {
            const isSent = email.direction === 'sent'
            const isExpanded = expandedId === email.id

            return (
              <div key={email.id} style={{
                margin: '0 12px 8px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden',
                transition: 'box-shadow 0.15s',
                boxShadow: isExpanded ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              }}>
                {/* Email Header (clickable) */}
                <div
                  onClick={() => toggle(email.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    padding: '14px 16px', cursor: 'pointer',
                    backgroundColor: isExpanded ? '#f8fafc' : '#ffffff',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#ffffff' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Subject */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Subject: {email.subject || '(No subject)'}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Direction badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                        borderRadius: '999px',
                        color: isSent ? '#16a34a' : '#dc2626',
                        backgroundColor: isSent ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${isSent ? '#bbf7d0' : '#fecaca'}`,
                      }}>
                        {isSent ? '↑' : '↓'}
                        {isSent ? 'Sent' : 'Received'}
                      </span>

                      {/* Provider badge */}
                      {email.provider && (
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                          borderRadius: '999px',
                          color: email.provider === 'gmail' ? '#dc2626' : '#16a34a',
                          backgroundColor: email.provider === 'gmail' ? '#fef2f2' : '#f0fdf4',
                          border: `1px solid ${email.provider === 'gmail' ? '#fecaca' : '#bbf7d0'}`,
                          textTransform: 'capitalize',
                        }}>
                          {email.provider}
                        </span>
                      )}

                      {/* To/From */}
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {isSent ? `To: ${email.recipient_email || ''}` : `From: ${email.sender_email || ''}`}
                      </span>
                    </div>
                  </div>

                  {/* Right side: Date + chevron */}
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {isSent ? 'Sent:' : 'Received:'} {formatDateShort(email.sent_at)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      {formatDate(email.sent_at).split(' ').slice(-2).join(' ')}
                    </div>
                    {/* Reply icon */}
                    <div style={{ marginTop: '6px', textAlign: 'right' }}>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="#94a3b8" strokeWidth="2"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded email content */}
                <div style={{
                  maxHeight: isExpanded ? '600px' : '0',
                  overflow: isExpanded ? 'auto' : 'hidden',
                  transition: 'max-height 0.3s ease',
                }}>
                  <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                  }}>
                    {/* Email metadata */}
                    <div style={{
                      fontSize: '12px', color: '#64748b',
                      marginBottom: '12px', lineHeight: 1.6,
                    }}>
                      {email.sender_email && <div><strong>From:</strong> {email.sender_email}</div>}
                      {email.recipient_email && <div><strong>To:</strong> {email.recipient_email}</div>}
                      {email.sent_by && <div><strong>Sent by:</strong> {email.sent_by}</div>}
                    </div>

                    {/* Email body */}
                    <div
                      style={{
                        fontSize: '14px', lineHeight: 1.7, color: '#1e293b',
                        wordBreak: 'break-word',
                      }}
                      dangerouslySetInnerHTML={{ __html: email.body || '<p style="color:#94a3b8">(No content)</p>' }}
                    />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
