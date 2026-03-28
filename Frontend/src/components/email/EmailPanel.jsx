import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Toast from './Toast'

/**
 * EmailPanel — Email tab inside ProfileModal.
 * SMTP-only (no OAuth). Shows a Compose button that navigates to /send-mail.
 */
export default function EmailPanel({ candidateId, candidateEmail, candidateName }) {
  const navigate = useNavigate()
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' })

  const handleCompose = useCallback(() => {
    const provider = localStorage.getItem('emailProvider') || 'gmail'
    const params = new URLSearchParams({
      candidateId: candidateId || '',
      email: candidateEmail || '',
      name: candidateName || '',
      provider,
    })
    navigate(`/send-mail?${params.toString()}`)
  }, [candidateId, candidateEmail, candidateName, navigate])

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Compose prompt */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            backgroundColor: '#eff6ff', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
            Send Email
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px', lineHeight: 1.6 }}>
            Compose and send an email to this candidate via Gmail or Outlook SMTP.
          </p>
          <button onClick={handleCompose} style={{
            padding: '12px 28px', backgroundColor: '#2563eb', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#2563eb'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Compose
          </button>
        </div>
      </div>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
    </div>
  )
}
