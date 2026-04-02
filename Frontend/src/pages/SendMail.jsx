import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ActionCenter from '../components/email/ActionCenter'
import Toast from '../components/email/Toast'

/**
 * SendMail page — standalone compose page at /send-mail.
 * Reads candidateId, email, name from query params.
 * When fromFlow=1, also reads pre-filled subject/body from sessionStorage.
 * After sending, redirects back to previous page.
 */
export default function SendMail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' })

  const candidateId = searchParams.get('candidateId')
  const candidateName = searchParams.get('name') || ''
  const fromFlow = searchParams.get('fromFlow') === '1'
  const candidateEmail = searchParams.get('email') || ''

  // templateType and recipientType come from URL params (stable across re-renders)
  const templateType = fromFlow ? (searchParams.get('templateType') || null) : null
  const recipientType = fromFlow ? (searchParams.get('recipientType') || null) : null

  // Subject, body, companyName are in sessionStorage (too long for URL)
  // Read once into state to avoid StrictMode double-read issues
  const [initialData] = useState(() => {
    if (!fromFlow) return null
    return {
      subject: sessionStorage.getItem('smf_subject') || '',
      body: sessionStorage.getItem('smf_body') || '',
      hrName: sessionStorage.getItem('smf_hrName') || '',
      companyName: sessionStorage.getItem('smf_companyName') || '',
    }
  })

  // Clean up sessionStorage after reading (useEffect runs once, after mount)
  useEffect(() => {
    if (!fromFlow) return
    sessionStorage.removeItem('smf_subject')
    sessionStorage.removeItem('smf_body')
    sessionStorage.removeItem('smf_hrName')
    sessionStorage.removeItem('smf_companyName')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Determine provider: URL param > localStorage preference > default gmail
  const provider = searchParams.get('provider') || localStorage.getItem('emailProvider') || 'gmail'

  const handleBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const handleSent = useCallback(() => {
    sessionStorage.setItem('emailJustSent', 'true')
    setTimeout(() => {
      navigate(-1)
    }, 1500)
  }, [navigate])

  const handleToast = useCallback(({ message, type }) => {
    setToast({ visible: true, message, type })
  }, [])

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }))
  }, [])

  return (
    <div style={{
      height: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
    }}>
      <ActionCenter
        candidateId={candidateId ? Number(candidateId) : null}
        candidateEmail={candidateEmail}
        candidateName={candidateName}
        provider={provider}
        initialSubject={initialData?.subject}
        initialBody={initialData?.body}
        templateType={templateType}
        recipientType={recipientType}
        clientName={initialData?.companyName}
        onBack={handleBack}
        onSent={handleSent}
        onToast={handleToast}
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
    </div>
  )
}
