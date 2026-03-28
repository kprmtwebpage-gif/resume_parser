import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers, fetchCustomer } from '../../services/customerApi'
import { listEmailTemplates } from '../../services/emailApi'
import { fetchCandidateById } from '../../services/api'

/**
 * SendMailFlowModal — 3-step selection: Company → HR Contact → Template
 * Then redirects to the compose page with pre-filled data.
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
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedContact, setSelectedContact] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Loading
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Load companies + templates + candidate on open
  useEffect(() => {
    if (!isOpen) return
    setSelectedCompanyId('')
    setSelectedContact(null)
    setSelectedTemplate(null)
    setContacts([])

    setLoadingCompanies(true)
    fetchCustomers({ limit: 500 })
      .then(res => setCompanies(res.customers || res || []))
      .catch(() => setCompanies([]))
      .finally(() => setLoadingCompanies(false))

    setLoadingTemplates(true)
    listEmailTemplates()
      .then(data => setTemplates(data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false))

    if (candidateId) {
      fetchCandidateById(candidateId)
        .then(data => setCandidate(data))
        .catch(() => setCandidate(null))
    }
  }, [isOpen, candidateId])

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

  // Build template body with candidate variables substituted
  const buildFilledBody = useCallback((template) => {
    if (!template) return ''
    let html = template.body || ''
    const c = candidate || {}
    const expYears = c.experience?.years_of_experience
      ? `${c.experience.years_of_experience} years` : ''
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || candidateName || ''

    const vars = {
      candidate_name: name,
      phone: c.phone || (c.phones && c.phones[0]) || '',
      email: c.email || (c.emails && c.emails[0]) || '',
      location: c.location || c.address || '',
      experience: expYears,
      us_experience: '',
      work_auth: c.work_authorization || c.visa_support || '',
      visa_validity: '',
      linkedin: c.linkedin || '',
      rate: '',
      education: c.qualification || '',
      passport: '',
      availability: '',
      skills: (c.skills || []).join(', '),
      dob: '',
      university: '',
      year_of_completion: '',
      submittal_type: '',
      willingness_to_relocate: '',
      ssn_last4: '',
    }

    for (const [key, val] of Object.entries(vars)) {
      const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi')
      html = html.replace(re, val)
    }
    // Remove any remaining unresolved variables
    html = html.replace(/\{\{\s*\w+\s*\}\}/g, '')
    return html
  }, [candidate, candidateName])

  const buildFilledSubject = useCallback((template) => {
    if (!template) return ''
    let subj = template.subject || ''
    const c = candidate || {}
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || candidateName || ''
    subj = subj.replace(/\{\{\s*candidate_name\s*\}\}/gi, name)
    return subj
  }, [candidate, candidateName])

  const handleProceed = useCallback(() => {
    if (!selectedContact || !selectedTemplate) return

    const hrEmail = selectedContact.email
    const filledSubject = buildFilledSubject(selectedTemplate)
    const filledBody = buildFilledBody(selectedTemplate)

    // Store body in sessionStorage (too large for URL params)
    sessionStorage.setItem('smf_body', filledBody)
    sessionStorage.setItem('smf_subject', filledSubject)
    sessionStorage.setItem('smf_hrEmail', hrEmail)
    sessionStorage.setItem('smf_hrName',
      [selectedContact.first_name, selectedContact.last_name].filter(Boolean).join(' '))

    const params = new URLSearchParams({
      candidateId: candidateId || '',
      email: hrEmail,
      name: candidateName || '',
      provider: provider || 'gmail',
      fromFlow: '1',
    })

    onClose()
    navigate(`/send-mail?${params.toString()}`)
  }, [selectedContact, selectedTemplate, buildFilledSubject, buildFilledBody, candidateId, candidateName, provider, navigate, onClose])

  if (!isOpen) return null

  const canProceed = selectedContact && selectedTemplate

  return (
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
              Send Email to HR
            </h3>
            {candidateName && (
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                Candidate: {candidateName}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{
            width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', backgroundColor: '#f1f5f9', borderRadius: '6px', cursor: 'pointer',
            fontSize: '16px', color: '#64748b',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Step 1: Select Company */}
          <div style={{ marginBottom: '18px' }}>
            <label style={labelSt}>1. Select Company</label>
            <select
              value={selectedCompanyId}
              onChange={e => setSelectedCompanyId(e.target.value)}
              style={selectSt}
            >
              <option value="">
                {loadingCompanies ? 'Loading companies...' : '— Select a company —'}
              </option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.display_name || c.company_name || `Customer ${c.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Select HR Contact */}
          <div style={{ marginBottom: '18px', opacity: selectedCompanyId ? 1 : 0.4, pointerEvents: selectedCompanyId ? 'auto' : 'none' }}>
            <label style={labelSt}>2. Select HR Contact</label>
            {loadingContacts ? (
              <div style={{ fontSize: '13px', color: '#94a3b8', padding: '8px 0' }}>Loading contacts...</div>
            ) : contacts.length === 0 && selectedCompanyId ? (
              <div style={{ fontSize: '13px', color: '#ef4444', padding: '8px 0' }}>No contact persons found for this company.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {contacts.map(cp => {
                  const cpName = [cp.first_name, cp.last_name].filter(Boolean).join(' ') || 'Unnamed'
                  const isActive = selectedContact?.id === cp.id
                  return (
                    <div key={cp.id}
                      onClick={() => setSelectedContact(cp)}
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
              <div style={{ fontSize: '13px', color: '#ef4444', padding: '8px 0' }}>No templates available. Create templates in Customer → Templates tab.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {templates.map(t => {
                  const isActive = selectedTemplate?.id === t.id
                  return (
                    <div key={t.id}
                      onClick={() => setSelectedTemplate(t)}
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
        </div>

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
            onClick={handleProceed}
            disabled={!canProceed}
            style={{
              padding: '9px 22px',
              backgroundColor: canProceed ? '#2563eb' : '#93c5fd', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: canProceed ? 'pointer' : 'not-allowed',
            }}
          >Compose Email →</button>
        </div>
      </div>

      <style>{`
        @keyframes smfFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes smfSlideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}

const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }
const selectSt = {
  width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff',
}
