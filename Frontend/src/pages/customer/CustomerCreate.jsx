import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createCustomer, uploadDocuments } from '../../services/customerApi'
import { listEmailTemplates } from '../../services/emailApi'
import CreateTemplateModal from '../../components/email/CreateTemplateModal'
import TemplatePreviewModal from '../../components/email/TemplatePreviewModal'
import TemplatesList from '../../components/templates/TemplatesList'
import ContactPersonSection from '../../components/customer/ContactPersonSection'
import countryCodes from './countryCodes'

const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.']

export default function CustomerCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [saving, setSaving] = useState(false)

  // Basic details
  const [customerType, setCustomerType] = useState('Business')
  const [entityType, setEntityType] = useState(searchParams.get('type') || 'client')  // client | vendor | own_company | candidate
  const [salutation, setSalutation] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+91')

  // Dropdowns
  const [salDropOpen, setSalDropOpen] = useState(false)
  const [dnDropOpen, setDnDropOpen] = useState(false)
  const [ccDropOpen, setCcDropOpen] = useState(false)
  const [ccSearch, setCcSearch] = useState('')

  // Tabs (only Templates + Other Details now)
  const [activeTab, setActiveTab] = useState('templates')

  // Files (Other Details tab)
  const [files, setFiles] = useState([])
  const [uploadProgress, setUploadProgress] = useState({})
  const fileInputRef = useRef(null)

  // Contact Persons (inline section, not tab)
  const [contactPersons, setContactPersons] = useState([
    { salutation: '', firstName: '', lastName: '', email: '', workPhone: '', mobile: '', ccWork: '+91', ccMobile: '+91' },
  ])

  // Templates tab
  const [availableTemplates, setAvailableTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [previewTemplateId, setPreviewTemplateId] = useState(null)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)

  // Refs for dropdowns
  const salRef = useRef(null)
  const dnRef = useRef(null)
  const ccRef = useRef(null)

  // Build display name suggestions
  const buildSuggestions = () => {
    const suggestions = []
    const sal = salutation || ''
    const fn = firstName || ''
    const ln = lastName || ''
    const cn = companyName || ''

    if (sal && fn && ln) suggestions.push(`${sal} ${fn} ${ln}`)
    if (fn && ln) suggestions.push(`${fn} ${ln}`)
    if (ln && fn) suggestions.push(`${ln}, ${fn}`)
    if (cn) suggestions.push(cn)

    return [...new Set(suggestions)]
  }

  // Auto-set display name to company name if empty
  useEffect(() => {
    if (!displayName && companyName) {
      setDisplayName(companyName)
    }
  }, [companyName])

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e) => {
      if (salRef.current && !salRef.current.contains(e.target)) setSalDropOpen(false)
      if (dnRef.current && !dnRef.current.contains(e.target)) setDnDropOpen(false)
      if (ccRef.current && !ccRef.current.contains(e.target)) setCcDropOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Load templates when Templates tab is activated
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const data = await listEmailTemplates()
      setAvailableTemplates(data)
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'templates') return
    loadTemplates()
  }, [activeTab, loadTemplates])

  const filteredCountries = ccSearch
    ? countryCodes.filter(c =>
        c.country.toLowerCase().includes(ccSearch.toLowerCase()) ||
        c.code.includes(ccSearch)
      )
    : countryCodes

  const entityLabel = entityType === 'vendor'
    ? 'Vendor'
    : entityType === 'own_company' || entityType === 'own'
    ? 'Own Company'
    : entityType === 'candidate'
    ? 'Candidate'
    : 'Client'

  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files)
    const total = files.length + newFiles.length
    if (total > 5) {
      alert('Maximum 5 files allowed')
      return
    }
    for (const f of newFiles) {
      if (f.size > 10 * 1024 * 1024) {
        alert(`File "${f.name}" exceeds 10MB limit`)
        return
      }
    }
    setFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const newFiles = Array.from(e.dataTransfer.files)
    const total = files.length + newFiles.length
    if (total > 5) {
      alert('Maximum 5 files allowed')
      return
    }
    for (const f of newFiles) {
      if (f.size > 10 * 1024 * 1024) {
        alert(`File "${f.name}" exceeds 10MB limit`)
        return
      }
    }
    setFiles(prev => [...prev, ...newFiles])
  }

  const addContactPerson = () => {
    setContactPersons(prev => [
      ...prev,
      { salutation: '', firstName: '', lastName: '', email: '', workPhone: '', mobile: '', ccWork: '+91', ccMobile: '+91' },
    ])
  }

  const updateContactPerson = (index, field, value) => {
    setContactPersons(prev => prev.map((cp, i) => i === index ? { ...cp, [field]: value } : cp))
  }

  const removeContactPerson = (index) => {
    if (index === 0) return
    setContactPersons(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const handleSave = async () => {
    if (!displayName.trim()) {
      alert('Display Name is required')
      return
    }

    setSaving(true)
    try {
      const cps = contactPersons
        .filter(cp => cp.firstName || cp.lastName || cp.email)
        .map(cp => ({
          salutation: cp.salutation || null,
          first_name: cp.firstName || null,
          last_name: cp.lastName || null,
          email: cp.email || null,
          work_phone: cp.workPhone ? `${cp.ccWork}${cp.workPhone}` : null,
          mobile: cp.mobile ? `${cp.ccMobile}${cp.mobile}` : null,
        }))

      if ((firstName || lastName) && email) {
        const alreadyInList = cps.some(
          cp => cp.email && cp.email.toLowerCase() === email.toLowerCase()
        )
        if (!alreadyInList) {
          cps.unshift({
            salutation: salutation || null,
            first_name: firstName || null,
            last_name: lastName || null,
            email: email,
            work_phone: phone ? `${countryCode}${phone}` : null,
            mobile: null,
          })
        }
      }

      const customer = await createCustomer({
        customer_type: customerType,
        entity_type: entityType,
        salutation: salutation || null,
        first_name: firstName || null,
        last_name: lastName || null,
        company_name: companyName || null,
        display_name: displayName,
        email: email || null,
        phone: phone || null,
        country_code: countryCode,
        contact_persons: cps,
      })

      if (files.length > 0) {
        await uploadDocuments(customer.id, files, (pct) => {
          setUploadProgress({ total: pct })
        })
      }

      navigate('/customer')
    } catch (err) {
      console.error('Save failed:', err)
      alert(err?.response?.data?.detail || 'Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      minHeight: 'calc(100vh - 56px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '24px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px' }}>
          {/* Breadcrumb */}
          <div style={{ marginBottom: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              onClick={() => navigate(`/customer?type=${entityType}`)}
              style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}
            >
              {entityLabel}
            </span>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ color: '#64748b' }}>{`New ${entityLabel}`}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              {`New ${entityLabel}`}
            </h1>
            <button
              onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/customer'); }}
              style={{
                backgroundColor: '#f1f5f9', color: '#374151',
                border: '1px solid #e2e8f0', borderRadius: '8px',
                padding: '8px 20px', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
            >
              &#8592; Back
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 32px 100px' }}>

        {/* ── Section: Customer Details ── */}
        <div style={sectionCardStyle}>
          <h2 style={sectionTitleStyle}>Customer Details</h2>

          {/* Customer Type */}
          <FormRow label="Customer Type">
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <label style={radioLabelStyle}>
                <input type="radio" name="customerType" checked={customerType === 'Business'}
                  onChange={() => setCustomerType('Business')} style={{ accentColor: '#2563eb' }} />
                Business
              </label>
              <label style={radioLabelStyle}>
                <input type="radio" name="customerType" checked={customerType === 'Individual'}
                  onChange={() => setCustomerType('Individual')} style={{ accentColor: '#2563eb' }} />
                Individual
              </label>
            </div>
          </FormRow>

          {/* Primary Contact */}
          <FormRow label="Primary Contact">
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: '10px' }}>
              <div ref={salRef} style={{ position: 'relative' }}>
                <button type="button" onClick={() => setSalDropOpen(!salDropOpen)}
                  style={{
                    ...inputStyle, width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', cursor: 'pointer', backgroundColor: '#fff',
                  }}>
                  <span style={{ color: salutation ? '#374151' : '#9ca3af' }}>{salutation || 'Salutation'}</span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>&#9660;</span>
                </button>
                {salDropOpen && (
                  <div style={dropdownStyle}>
                    {SALUTATIONS.map(s => (
                      <button key={s} onClick={() => { setSalutation(s); setSalDropOpen(false) }}
                        style={dropdownItemStyle}
                        onMouseEnter={(e) => { e.target.style.backgroundColor = '#f1f5f9' }}
                        onMouseLeave={(e) => { e.target.style.backgroundColor = '#fff' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name" style={inputStyle} />
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name" style={inputStyle} />
            </div>
          </FormRow>

          {/* Two-column grid for Company + Display, Email + Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            <FormRow label="Company Name">
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                style={{ ...inputStyle, width: '100%' }} />
            </FormRow>

            <FormRow label={<span style={{ color: '#dc2626' }}>Display Name*</span>}>
              <div ref={dnRef} style={{ position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text" value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onFocus={() => setDnDropOpen(true)}
                    placeholder="Select or type to add"
                    style={{ ...inputStyle, width: '100%', paddingRight: '32px' }}
                  />
                  <button type="button" onClick={() => setDnDropOpen(!dnDropOpen)}
                    style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '10px',
                    }}>
                    {dnDropOpen ? '&#9650;' : '&#9660;'}
                  </button>
                </div>
                {dnDropOpen && buildSuggestions().length > 0 && (
                  <div style={{ ...dropdownStyle, width: '100%' }}>
                    {buildSuggestions().map((s, i) => (
                      <button key={i}
                        onClick={() => { setDisplayName(s); setDnDropOpen(false) }}
                        style={{
                          ...dropdownItemStyle,
                          backgroundColor: displayName === s ? '#2563eb' : '#fff',
                          color: displayName === s ? '#fff' : '#374151',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                        onMouseEnter={(e) => { if (displayName !== s) e.target.style.backgroundColor = '#f1f5f9' }}
                        onMouseLeave={(e) => { if (displayName !== s) e.target.style.backgroundColor = '#fff' }}>
                        <span>{s}</span>
                        {displayName === s && <span>&#10003;</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </FormRow>

            <FormRow label="Email Address">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                style={{ ...inputStyle, width: '100%' }} />
            </FormRow>

            <FormRow label="Phone">
              <div style={{ display: 'flex', gap: '8px' }}>
                <div ref={ccRef} style={{ position: 'relative' }}>
                  <button type="button" onClick={() => { setCcDropOpen(!ccDropOpen); setCcSearch('') }}
                    style={{
                      ...inputStyle, width: '80px', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', cursor: 'pointer', backgroundColor: '#fff',
                    }}>
                    <span style={{ fontSize: '13px' }}>{countryCode}</span>
                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>&#9660;</span>
                  </button>
                  {ccDropOpen && (
                    <div style={{ ...dropdownStyle, width: '280px', maxHeight: '240px' }}>
                      <div style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, backgroundColor: '#fff' }}>
                        <input type="text" value={ccSearch} onChange={(e) => setCcSearch(e.target.value)}
                          placeholder="Search" autoFocus
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ overflowY: 'auto', maxHeight: '190px' }}>
                        {filteredCountries.map((c, i) => (
                          <button key={i}
                            onClick={() => { setCountryCode(c.code); setCcDropOpen(false) }}
                            style={dropdownItemStyle}
                            onMouseEnter={(e) => { e.target.style.backgroundColor = '#f1f5f9' }}
                            onMouseLeave={(e) => { e.target.style.backgroundColor = '#fff' }}>
                            {c.code}&nbsp;&nbsp;{c.country}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="Work Phone" style={{ ...inputStyle, flex: 1 }} />
              </div>
            </FormRow>
          </div>
        </div>

        {/* ── Section: Contact Persons ── */}
        <div style={sectionCardStyle}>
          <ContactPersonSection
            contactPersons={contactPersons}
            onChange={updateContactPerson}
            onAdd={addContactPerson}
            onRemove={removeContactPerson}
          />
        </div>

        {/* ── Section: Tabs (Templates + Other Details) ── */}
        <div style={sectionCardStyle}>
          <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '0' }}>
              {[
                { key: 'templates', label: 'Templates' },
                { key: 'other', label: 'Other Details' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '12px 22px', border: 'none', cursor: 'pointer',
                    backgroundColor: 'transparent', fontSize: '14px', fontWeight: 600,
                    color: activeTab === tab.key ? '#2563eb' : '#64748b',
                    borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div style={{ minHeight: '120px' }}>
            {activeTab === 'other' && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '16px', marginTop: 0 }}>Documents</h3>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => files.length < 5 && fileInputRef.current.click()}
                  style={{
                    border: '2px dashed #d1d5db', borderRadius: '10px', padding: '36px',
                    textAlign: 'center', cursor: files.length < 5 ? 'pointer' : 'default',
                    backgroundColor: '#fafbfc', transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => { if (files.length < 5) e.currentTarget.style.borderColor = '#2563eb' }}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                >
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect}
                    style={{ display: 'none' }} />
                  <div style={{ fontSize: '28px', color: '#9ca3af', marginBottom: '8px' }}>&#8682;</div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    Upload files (Max: {5 - files.length} more files)
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
                    You can upload a maximum of 5 files, 10MB each
                  </div>
                </div>

                {files.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                      {files.length} / 5 files selected
                    </div>
                    {files.map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: '8px', marginBottom: '6px',
                        border: '1px solid #e5e7eb', backgroundColor: '#fff',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '16px' }}>&#128196;</span>
                          <div>
                            <div style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{f.name}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{formatFileSize(f.size)}</div>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px' }}>
                          &#10005;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'templates' && (
              <TemplatesTabContent
                templates={availableTemplates}
                loading={templatesLoading}
                previewId={previewTemplateId}
                onTogglePreview={(id) => setPreviewTemplateId(prev => prev === id ? null : id)}
                onPreviewClick={(t) => setPreviewTemplate(t)}
                onCreateClick={() => setShowCreateTemplate(true)}
                onDeleted={loadTemplates}
                />
            )}
          </div>
        </div>
      </div>

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={showCreateTemplate}
        onClose={() => setShowCreateTemplate(false)}
        onCreated={loadTemplates}
      />

      {/* Template Preview + Edit Modal */}
      <TemplatePreviewModal
        isOpen={!!previewTemplate}
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onUpdated={() => { setPreviewTemplate(null); loadTemplates() }}
      />

      {/* Sticky Save / Cancel bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', borderTop: '1px solid #e2e8f0',
        padding: '14px 32px', display: 'flex', gap: '12px',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.05)', zIndex: 30,
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              backgroundColor: saving ? '#93c5fd' : '#2563eb', color: '#fff',
              border: 'none', borderRadius: '8px', padding: '11px 32px',
              fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = '#1d4ed8' }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.backgroundColor = '#2563eb' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => navigate('/customer')}
            style={{
              backgroundColor: '#fff', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: '8px', padding: '11px 32px',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}


/* ── Shared sub-components & styles ──────────────────────────── */

function FormRow({ label, children }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ fontSize: '14px', color: '#4b5563', fontWeight: 500, marginBottom: '6px' }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}


// ── Styles ──

const sectionCardStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '24px 28px',
  marginBottom: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}

const sectionTitleStyle = {
  margin: '0 0 20px', fontSize: '16px', fontWeight: 700,
  color: '#1e293b', letterSpacing: '-0.01em',
}

const radioLabelStyle = {
  display: 'flex', alignItems: 'center', gap: '6px',
  cursor: 'pointer', fontSize: '14px', color: '#374151',
}

const inputStyle = {
  padding: '0 12px', height: '42px', border: '1px solid #d1d5db', borderRadius: '7px',
  fontSize: '14px', color: '#374151', outline: 'none', boxSizing: 'border-box',
  backgroundColor: '#fff', transition: 'border-color 0.15s',
}

const dropdownStyle = {
  position: 'absolute', top: '100%', left: 0, marginTop: '2px',
  backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100,
  overflow: 'hidden',
}

const dropdownItemStyle = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '9px 14px', border: 'none', cursor: 'pointer',
  backgroundColor: '#fff', color: '#374151', fontSize: '14px',
}


// TemplatesTabContent is now imported from the reusable TemplatesList component
const TemplatesTabContent = TemplatesList
