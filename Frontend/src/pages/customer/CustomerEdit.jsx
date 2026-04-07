import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchCustomer, updateCustomer, addContactPerson, updateContactPerson as apiUpdateCP, deleteContactPerson } from '../../services/customerApi'
import { listEmailTemplates } from '../../services/emailApi'
import CreateTemplateModal from '../../components/email/CreateTemplateModal'
import TemplatePreviewModal from '../../components/email/TemplatePreviewModal'
import TemplatesList from '../../components/templates/TemplatesList'
import ContactPersonSection from '../../components/customer/ContactPersonSection'
import countryCodes from './countryCodes'

const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.']

export default function CustomerEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Basic details (pre-filled from existing customer)
  const [customerType, setCustomerType] = useState('Business')
  const [entityType, setEntityType] = useState(searchParams.get('type') || 'client')
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

  // Tabs
  const [activeTab, setActiveTab] = useState('templates')

  // Contact Persons
  const [contactPersons, setContactPersons] = useState([
    { salutation: '', firstName: '', lastName: '', email: '', workPhone: '', mobile: '', ccWork: '+91', ccMobile: '+91' },
  ])
  const [originalContactPersonIds, setOriginalContactPersonIds] = useState([])

  // Templates tab
  const [availableTemplates, setAvailableTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [previewTemplateId, setPreviewTemplateId] = useState(null)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)

  // Refs
  const salRef = useRef(null)
  const dnRef = useRef(null)
  const ccRef = useRef(null)

  // Load existing customer data
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await fetchCustomer(id)

        if (searchParams.get('type') && data?.entity_type && data.entity_type !== searchParams.get('type')) {
          navigate(`/customer?type=${searchParams.get('type')}`, { replace: true })
          return
        }

        setCustomerType(data.customer_type || 'Business')
        setEntityType(data.entity_type || searchParams.get('type') || 'client')
        setSalutation(data.salutation || '')
        setFirstName(data.first_name || '')
        setLastName(data.last_name || '')
        setCompanyName(data.company_name || '')
        setDisplayName(data.display_name || '')
        setEmail(data.email || '')

        // Try to extract country code and phone number
        const rawPhone = data.phone || ''
        const rawCC = data.country_code || '+91'
        setCountryCode(rawCC)
        setPhone(rawPhone)

        // Pre-fill contact persons
        if (data.contact_persons && data.contact_persons.length > 0) {
          const cps = data.contact_persons.map(cp => {
            // Try to split work_phone into code + number
            let cpCCWork = '+91'
            let cpWorkPhone = cp.work_phone || ''
            let cpCCMobile = '+91'
            let cpMobile = cp.mobile || ''
            // If phone starts with a known code, split it
            const matchWork = cpWorkPhone.match(/^(\+\d{1,3})(.*)$/)
            if (matchWork) { cpCCWork = matchWork[1]; cpWorkPhone = matchWork[2] }
            const matchMobile = cpMobile.match(/^(\+\d{1,3})(.*)$/)
            if (matchMobile) { cpCCMobile = matchMobile[1]; cpMobile = matchMobile[2] }
            return {
              _id: cp.id,   // track existing CP id for updates
              salutation: cp.salutation || '',
              firstName: cp.first_name || '',
              lastName: cp.last_name || '',
              email: cp.email || '',
              workPhone: cpWorkPhone,
              mobile: cpMobile,
              ccWork: cpCCWork,
              ccMobile: cpCCMobile,
            }
          })
          setContactPersons(cps)
          setOriginalContactPersonIds(cps.map(cp => cp._id).filter(Boolean))
        } else {
          setOriginalContactPersonIds([])
        }
      } catch (err) {
        console.error('Failed to load customer:', err)
        alert('Failed to load customer data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, navigate, searchParams])

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

  const addContactPersonRow = () => {
    setContactPersons(prev => [
      ...prev,
      { salutation: '', firstName: '', lastName: '', email: '', workPhone: '', mobile: '', ccWork: '+91', ccMobile: '+91' },
    ])
  }

  const updateContactPersonLocal = (index, field, value) => {
    setContactPersons(prev => prev.map((cp, i) => i === index ? { ...cp, [field]: value } : cp))
  }

  const removeContactPersonLocal = (index) => {
    if (index === 0 && contactPersons.length === 1) return
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
      // Update basic customer fields
      await updateCustomer(id, {
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
      })

      const hasContactData = (cp) => Boolean(
        (cp.firstName && cp.firstName.trim()) ||
        (cp.lastName && cp.lastName.trim()) ||
        (cp.email && cp.email.trim()) ||
        (cp.workPhone && cp.workPhone.trim()) ||
        (cp.mobile && cp.mobile.trim())
      )

      const cpRowsToKeep = contactPersons.filter(hasContactData)
      const currentExistingIds = new Set(cpRowsToKeep.filter(cp => cp._id).map(cp => cp._id))
      const cpIdsToDelete = originalContactPersonIds.filter(cpId => !currentExistingIds.has(cpId))

      for (const cpId of cpIdsToDelete) {
        await deleteContactPerson(id, cpId)
      }

      for (const cp of cpRowsToKeep) {
        const cpPayload = {
          salutation: cp.salutation || null,
          first_name: cp.firstName || null,
          last_name: cp.lastName || null,
          email: cp.email || null,
          work_phone: cp.workPhone ? `${cp.ccWork}${cp.workPhone}` : null,
          mobile: cp.mobile ? `${cp.ccMobile}${cp.mobile}` : null,
        }

        if (cp._id) {
          await apiUpdateCP(id, cp._id, cpPayload)
        } else {
          await addContactPerson(id, cpPayload)
        }
      }

      navigate(`/customer/${id}?type=${entityType}`)
    } catch (err) {
      console.error('Save failed:', err)
      alert(err?.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - 56px)', color: '#9ca3af', fontSize: '16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        Loading...
      </div>
    )
  }

  const entityLabel = entityType === 'vendor'
    ? 'Vendor'
    : entityType === 'own_company' || entityType === 'own'
    ? 'Own Company'
    : entityType === 'candidate'
    ? 'Candidate'
    : 'Client'

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
            <span
              onClick={() => navigate(`/customer/${id}?type=${entityType}`)}
              style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}
            >
              {displayName}
            </span>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ color: '#64748b' }}>Edit</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Edit {entityLabel}
            </h1>
            <button
              onClick={() => navigate(`/customer/${id}?type=${entityType}`)}
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
          <h2 style={sectionTitleStyle}>{entityLabel} Details</h2>

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

          {/* Two-column: Company + Display, Email + Phone */}
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
                    {dnDropOpen ? '▲' : '▼'}
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
                        onMouseEnter={(e) => { if (displayName !== s) e.currentTarget.style.backgroundColor = '#f1f5f9' }}
                        onMouseLeave={(e) => { if (displayName !== s) e.currentTarget.style.backgroundColor = '#fff' }}>
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
            onChange={updateContactPersonLocal}
            onAdd={addContactPersonRow}
            onRemove={removeContactPersonLocal}
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

          <div style={{ minHeight: '120px' }}>
            {activeTab === 'other' && (
              <div style={{ fontSize: '14px', color: '#6b7280', padding: '16px 0' }}>
                To manage documents, go back to the detail view.
              </div>
            )}
            {activeTab === 'templates' && (
              <TemplatesTabContent
                templates={availableTemplates}
                loading={templatesLoading}
                previewId={previewTemplateId}
                onTogglePreview={(tid) => setPreviewTemplateId(prev => prev === tid ? null : tid)}
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

      {/* Template Preview Modal */}
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
            onClick={() => navigate(`/customer/${id}?type=${entityType}`)}
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

const TemplatesTabContent = TemplatesList
