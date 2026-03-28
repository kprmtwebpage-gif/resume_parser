import { useCallback, useMemo, useState } from 'react'
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

  // When coming from SendMailFlowModal, use HR email & pre-filled data
  const candidateEmail = fromFlow
    ? (sessionStorage.getItem('smf_hrEmail') || searchParams.get('email') || '')
    : (searchParams.get('email') || '')

  const initialData = useMemo(() => {
    if (!fromFlow) return null
    const subj = sessionStorage.getItem('smf_subject') || ''
    const body = sessionStorage.getItem('smf_body') || ''
    const hrName = sessionStorage.getItem('smf_hrName') || ''
    // Clean up after reading
    sessionStorage.removeItem('smf_subject')
    sessionStorage.removeItem('smf_body')
    sessionStorage.removeItem('smf_hrEmail')
    sessionStorage.removeItem('smf_hrName')
    return { subject: subj, body, hrName }
  }, [fromFlow])

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
