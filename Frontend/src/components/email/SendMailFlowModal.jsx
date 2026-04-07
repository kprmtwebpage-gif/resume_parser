import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers, fetchCustomer } from '../../services/customerApi'
import { listCandidateEmailTemplates, listEmailTemplates } from '../../services/emailApi'
import { fetchCandidateById } from '../../services/api'

/**
 * SendMailFlowModal — 3-step selection: Company → HR Contact → Template
 * Then sends via /api/send-email.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - candidateId: number
 *  - candidateName: string
 *  - provider: string ('gmail' | 'outlook')
 */
export default function SendMailFlowModal({ isOpen, onClose, candidateId, candidateName, provider }) {
  const navigate = useNavigate()
  const backdropRef = useRef(null)

  // Data
  const [companies, setCompanies] = useState([])
  const [contacts, setContacts] = useState([])
  const [templates, setTemplates] = useState([])
  const [candidate, setCandidate] = useState(null)

  // Selections
  const [recipientType, setRecipientType] = useState('client')  // 'client' | 'vendor' | 'own_company' | 'candidate'
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedContact, setSelectedContact] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Candidate direct-email mode (kept for reset on type switch)

  // Loading
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [sendError, setSendError] = useState('')

  // Load companies + templates + candidate on open / recipientType change
  useEffect(() => {
    if (!isOpen) return
    setSendError('')
    setSelectedCompanyId('')
    setSelectedContact(null)
    setSelectedTemplate(null)
    setContacts([])
    if (recipientType !== 'candidate') {
      setLoadingCompanies(true)
      fetchCustomers({ limit: 500, entityType: recipientType })
        .then(res => setCompanies(res.customers || res || []))
        .catch(() => setCompanies([]))
        .finally(() => setLoadingCompanies(false))
    } else {
      setCompanies([])
    }

    setLoadingTemplates(true)
    const templatePromise = recipientType === 'candidate'
      ? listCandidateEmailTemplates()
      : listEmailTemplates({ type: 'COMMON' })
    templatePromise
      .then(data => setTemplates(data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false))

    if (candidateId) {
      fetchCandidateById(candidateId)
        .then(data => setCandidate(data))
        .catch(() => setCandidate(null))
    }
  }, [isOpen, recipientType, candidateId])

  // Load contacts when company selected
  useEffect(() => {
    if (!selectedCompanyId) { setContacts([]); setSelectedContact(null); return }
    setLoadingContacts(true)
    setSelectedContact(null)
    fetchCustomer(selectedCompanyId)
      .then(data => setContacts(data.contact_persons || []))
      .catch(() => setContacts([]))
      .finally(() => setLoadingContacts(false))
  }, [selectedCompanyId])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleTemplateSelect = useCallback((template) => {
    setSelectedTemplate((prev) => (prev?.id === template?.id ? null : template))
  }, [])

  const handleCompose = useCallback(() => {
    if (!candidateId || !selectedTemplate) return
    if (recipientType !== 'candidate' && (!selectedCompanyId || !selectedContact?.id)) return

    const contactName = [selectedContact?.first_name, selectedContact?.last_name].filter(Boolean).join(' ')
    const recipientEmail = recipientType === 'candidate'
      ? (candidate?.email || '')
      : (selectedContact?.email || '')

    if (!recipientEmail) {
      setSendError('No recipient email address.')
      return
    }

    setSendError('')
    sessionStorage.setItem('smf_subject', selectedTemplate?.subject || '')
    sessionStorage.setItem('smf_body', selectedTemplate?.body || '')
    sessionStorage.setItem('smf_hrName', recipientType === 'candidate' ? (candidateName || '') : (contactName || ''))
    const company = companies.find(c => String(c.id) === String(selectedCompanyId))
    const companyName = company?.display_name || company?.company_name || ''
    sessionStorage.setItem('smf_companyName', companyName)

    const templateType = recipientType === 'candidate' ? 'candidate' : 'common'
    const params = new URLSearchParams({
      candidateId: candidateId || '',
      email: recipientEmail || '',
      name: candidateName || '',
      provider: provider || (localStorage.getItem('emailProvider') || 'gmail'),
      fromFlow: '1',
      templateType,
      recipientType,
    })

    onClose?.()
    navigate(`/send-mail?${params.toString()}`)
  }, [candidateId, selectedTemplate, recipientType, selectedCompanyId, selectedContact, candidate, candidateName, provider, navigate, onClose])

  if (!isOpen) return null

  const canProceed = recipientType === 'candidate'
    ? !!candidateId && !!selectedTemplate
    : !!candidateId && !!selectedContact && !!selectedTemplate && !!selectedCompanyId

  return (
    <>
      <div
        ref={backdropRef}
        onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.45)',
          animation: 'smfFadeIn 0.18s ease',
        }}
      >
        <div style={{
          backgroundColor: '#fff', borderRadius: '14px',
          width: '540px', maxWidth: '95vw', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          animation: 'smfSlideUp 0.2s ease',
        }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
              {recipientType === 'candidate'
                ? (candidateName ? `Direct Email – (${candidateName})` : 'Direct Email to Candidate')
                : recipientType === 'vendor'
                ? (candidateName ? `Vendor Submission – (${candidateName})` : 'Vendor Submission')
                : recipientType === 'own_company'
                ? (candidateName ? `KPRMT Submission – (${candidateName})` : 'KPRMT Submission')
                : (candidateName ? `Client Submission – (${candidateName})` : 'Client Submission')}
            </h3>
          </div>
          <button onClick={onClose} style={{
            width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', backgroundColor: '#f1f5f9', borderRadius: '6px', cursor: 'pointer',
            fontSize: '16px', color: '#64748b',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Recipient Type Selector */}
          <div style={{ marginBottom: '18px' }}>
            <label style={labelSt}>Recipient Type</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { value: 'client', label: '🏢 Client' },
                { value: 'vendor', label: '🤝 Vendor' },
                { value: 'own_company', label: '🏠 Own Company' },
                { value: 'candidate', label: '👤 Candidate' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRecipientType(opt.value)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: '8px', border: '1.5px solid',
                    borderColor: recipientType === opt.value ? '#2563eb' : '#e2e8f0',
                    backgroundColor: recipientType === opt.value ? '#eff6ff' : '#f8fafc',
                    color: recipientType === opt.value ? '#1d4ed8' : '#64748b',
                    fontWeight: recipientType === opt.value ? 700 : 500,
                    fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s',
                    minWidth: '80px',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* CLIENT / VENDOR sections */}
          {recipientType !== 'candidate' && (
            <>
              {/* Step 1: Select Company */}
              <div style={{ marginBottom: '18px' }}>
                <label style={labelSt}>
                  {recipientType === 'vendor' ? '1. Select Vendor Company'
                  : recipientType === 'own_company' ? '1. Select Own Company'
                  : '1. Select Company'}
                </label>
                <select value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} style={selectSt}>
                  <option value="">
                    {loadingCompanies ? 'Loading...' : `— Select a ${recipientType === 'vendor' ? 'vendor' : recipientType === 'own_company' ? 'company' : 'company'} —`}
                  </option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.display_name || c.company_name || `Customer ${c.id}`}
                    </option>
                  ))}
                </select>
                {!loadingCompanies && companies.length === 0 && (
                  <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '6px' }}>
                    No {recipientType === 'vendor' ? 'vendor' : recipientType === 'own_company' ? 'own company' : 'client'} companies found. Create one in Customer → set Category to {recipientType === 'vendor' ? 'Vendor' : recipientType === 'own_company' ? 'Own Company' : 'Client'}.
                  </div>
                )}
              </div>

              {/* Step 2: Select Contact */}
              <div style={{ marginBottom: '18px', opacity: selectedCompanyId ? 1 : 0.4, pointerEvents: selectedCompanyId ? 'auto' : 'none' }}>
                <label style={labelSt}>
                  {recipientType === 'vendor' ? '2. Select Vendor Contact' : '2. Select HR Contact'}
                </label>
                {loadingContacts ? (
                  <div style={{ fontSize: '13px', color: '#94a3b8', padding: '8px 0' }}>Loading contacts...</div>
                ) : contacts.length === 0 && selectedCompanyId ? (
                  <div style={{ fontSize: '13px', color: '#ef4444', padding: '8px 0' }}>No contact persons found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {contacts.map(cp => {
                      const cpName = [cp.first_name, cp.last_name].filter(Boolean).join(' ') || 'Unnamed'
                      const isActive = selectedContact?.id === cp.id
                      return (
                        <div key={cp.id} onClick={() => setSelectedContact(cp)}
                          style={{
                            padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                            backgroundColor: isActive ? '#eff6ff' : '#f8fafc',
                            border: `1px solid ${isActive ? '#3b82f6' : '#e2e8f0'}`,
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{cpName}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{cp.email || 'No email'}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Step 3: Select Template */}
              <div style={{ marginBottom: '8px', opacity: selectedContact ? 1 : 0.4, pointerEvents: selectedContact ? 'auto' : 'none' }}>
                <label style={labelSt}>3. Select Email Template</label>
                {loadingTemplates ? (
                  <div style={{ fontSize: '13px', color: '#94a3b8', padding: '8px 0' }}>Loading templates...</div>
                ) : templates.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#ef4444', padding: '8px 0' }}>No templates available.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {templates.map(t => {
                      const isActive = selectedTemplate?.id === t.id
                      return (
                        <div key={t.id} onClick={() => handleTemplateSelect(t)}
                          style={{
                            padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                            backgroundColor: isActive ? '#eff6ff' : '#f8fafc',
                            border: `1px solid ${isActive ? '#3b82f6' : '#e2e8f0'}`,
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Subject: {t.subject}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* CANDIDATE — Templates only (centered) */}
          {recipientType === 'candidate' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Candidate info box */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', marginBottom: '18px', width: '100%',
                background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', background: '#dcfce7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', color: '#16a34a', fontWeight: 700, flexShrink: 0,
                }}>
                  {(candidateName || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#15803d' }}>{candidateName || 'Candidate'}</div>
                  <div style={{ fontSize: '12px', color: '#16a34a' }}>
                    {candidate?.email ? `To: ${candidate.email}` : 'Candidate email will be resolved automatically'}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Auto-selected</div>
              </div>

              {/* Templates — centered */}
              <div style={{ width: '100%' }}>
                <label style={{ ...labelSt, textAlign: 'center', display: 'block', marginBottom: '14px' }}>
                  Select Email Template
                </label>
                {loadingTemplates ? (
                  <div style={{ textAlign: 'center', fontSize: '13px', color: '#94a3b8', padding: '20px 0' }}>
                    Loading templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div style={{ textAlign: 'center', fontSize: '13px', color: '#94a3b8', padding: '20px 0' }}>
                    No candidate templates available. Create one in Admin {'->'} Candidate Templates.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {templates.map(t => {
                      const isActive = selectedTemplate?.id === t.id
                      return (
                        <div key={t.id} onClick={() => handleTemplateSelect(t)}
                          style={{
                            padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                            backgroundColor: isActive ? '#eff6ff' : '#f8fafc',
                            border: `1.5px solid ${isActive ? '#3b82f6' : '#e2e8f0'}`,
                            transition: 'all 0.15s', textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Subject: {t.subject}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {sendError && (
            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '12px' }}>
              {sendError}
            </div>
          )}

        </div>{/* end scrollable body */}

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
          padding: '14px 24px', borderTop: '1px solid #e2e8f0',
        }}>
          <button onClick={onClose} style={{
            padding: '9px 22px', backgroundColor: '#fff', color: '#374151',
            border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
          }}>Cancel</button>
          <button
            onClick={handleCompose}
            disabled={!canProceed}
            style={{
              padding: '9px 22px',
              backgroundColor: canProceed ? '#2563eb' : '#93c5fd', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: canProceed ? 'pointer' : 'not-allowed',
            }}
          >Compose Mail</button>
        </div>
      </div>

        <style>{`
          @keyframes smfFadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes smfSlideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        `}</style>
      </div>
    </>
  )
}

const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }
const selectSt = {
  width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff',
}
