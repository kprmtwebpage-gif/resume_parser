import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  fetchCustomers, fetchCustomer, updateCustomer, deleteCustomer,
  cloneCustomer, uploadDocuments, deleteDocument, fetchActivities,
  updateContactPerson, deleteContactPerson,
} from '../../services/customerApi'
import { getCPTemplates } from '../../services/emailApi'
import TemplateAssignModal from '../../components/email/TemplateAssignModal'
import SendToHRModal from '../../components/email/SendToHRModal'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  // State
  const [customer, setCustomer] = useState(null)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [attachPopup, setAttachPopup] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)

  const [templateModalCP, setTemplateModalCP] = useState(null)
  const [sendEmailCP, setSendEmailCP] = useState(null)
  const [cpTemplateCounts, setCpTemplateCounts] = useState({})
  const [editingCP, setEditingCP] = useState(null)
  const [editCPData, setEditCPData] = useState({})
  const [savingCP, setSavingCP] = useState(false)

  const moreRef = useRef(null)
  const filterRef = useRef(null)
  const attachRef = useRef(null)

  const filterLabels = {
    all: 'All Customers',
    active: 'Active Customers',
    inactive: 'Inactive Customers',
  }

  const loadList = useCallback(async () => {
    try {
      const data = await fetchCustomers({
        search: search || undefined,
        status: filterStatus === 'all' ? undefined : filterStatus,
        sortBy: 'created_at', sortOrder: 'desc',
      })
      setCustomers(data)
    } catch (err) {
      console.error('Failed to load customers list:', err)
    }
  }, [search, filterStatus])

  const loadDetail = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await fetchCustomer(id)
      setCustomer(data)
    } catch (err) {
      console.error('Failed to load customer:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadDetail() }, [loadDetail])

  // Load template counts for each contact person
  const refreshTemplateCounts = useCallback(async () => {
    if (!customer?.contact_persons?.length) return
    const counts = {}
    await Promise.all(
      customer.contact_persons.map(async (cp) => {
        try {
          const templates = await getCPTemplates(cp.id)
          counts[cp.id] = templates.length
        } catch { counts[cp.id] = 0 }
      })
    )
    setCpTemplateCounts(counts)
  }, [customer])

  useEffect(() => { refreshTemplateCounts() }, [refreshTemplateCounts])

  useEffect(() => {
    const handle = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterDropdownOpen(false)
      if (attachRef.current && !attachRef.current.contains(e.target)) setAttachPopup(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handleDelete = async () => {
    if (!window.confirm(`Delete customer "${customer.display_name}"?`)) return
    try {
      await deleteCustomer(id)
      navigate('/customer')
    } catch (err) {
      alert('Failed to delete customer')
    }
  }

  const handleClone = async () => {
    try {
      const cloned = await cloneCustomer(id)
      setMoreOpen(false)
      navigate(`/customer/${cloned.id}`)
    } catch (err) {
      alert('Failed to clone customer')
    }
  }

  const handleEdit = () => {
    setEditData({
      display_name: customer.display_name,
      email: customer.email || '',
      phone: customer.phone || '',
      company_name: customer.company_name || '',
      customer_type: customer.customer_type,
    })
    setEditing(true)
    setMoreOpen(false)
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const updated = await updateCustomer(id, editData)
      setCustomer(updated)
      setEditing(false)
    } catch (err) {
      alert('Failed to update customer')
    } finally {
      setSaving(false)
    }
  }

  const getDisplayName = (c) => {
    if (c.display_name) return c.display_name
    const parts = [c.salutation, c.first_name, c.last_name].filter(Boolean)
    return parts.join(' ') || 'Unnamed'
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const docCount = customer?.documents?.length || 0

  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 56px)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#fff',
    }}>
      {/* Left Panel - Customer List */}
      <div style={{
        width: '260px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
        flexShrink: 0, backgroundColor: '#fff',
      }}>
        {/* Search bar */}
        <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#9ca3af', fontSize: '14px' }}>&#128269;</span>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in Customers"
              style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#374151', width: '100%', backgroundColor: 'transparent' }} />
          </div>
        </div>

        {/* Filter + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div ref={filterRef} style={{ position: 'relative' }}>
            <button onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {filterLabels[filterStatus]}
              <span style={{ fontSize: '10px', color: '#6b7280' }}>&#9660;</span>
            </button>
            {filterDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '180px' }}>
                {Object.entries(filterLabels).map(([key, label]) => (
                  <button key={key} onClick={() => { setFilterStatus(key); setFilterDropdownOpen(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', cursor: 'pointer', backgroundColor: filterStatus === key ? '#eff6ff' : '#fff', color: filterStatus === key ? '#2563eb' : '#374151', fontSize: '13px' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = filterStatus === key ? '#eff6ff' : '#f9fafb'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = filterStatus === key ? '#eff6ff' : '#fff'}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => navigate('/customer/new')}
              style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              +
            </button>
          </div>
        </div>

        {/* Customer list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {customers.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/customer/${c.id}`)}
              style={{
                padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                backgroundColor: c.id === id ? '#eff6ff' : '#fff',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (c.id !== id) e.currentTarget.style.backgroundColor = '#f9fafb' }}
              onMouseLeave={(e) => { if (c.id !== id) e.currentTarget.style.backgroundColor = '#fff' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" onClick={(e) => e.stopPropagation()} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937' }}>{getDisplayName(c)}</div>
                  {c.document_count > 0 && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      &#128206; {c.document_count}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Panel */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
            Loading...
          </div>
        ) : !customer ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
            Customer not found
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px', borderBottom: '1px solid #e5e7eb',
            }}>
              <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
                {getDisplayName(customer)}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={handleEdit}
                  style={{ padding: '7px 18px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff', color: '#374151', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                  Edit
                </button>

                {/* Attachments badge */}
                {docCount > 0 && (
                  <div ref={attachRef} style={{ position: 'relative' }}>
                    <button onClick={() => setAttachPopup(!attachPopup)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                      &#128206; {docCount}
                    </button>
                    {attachPopup && (
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                        backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, width: '320px',
                        animation: 'fadeIn 0.15s ease',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px', color: '#1f2937' }}>Attachments</span>
                          <button onClick={() => setAttachPopup(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px' }}>
                            &#10005;
                          </button>
                        </div>
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          {customer.documents.map((doc) => (
                            <a
                              key={doc.id}
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'block', padding: '10px 16px',
                                borderBottom: '1px solid #f3f4f6', textDecoration: 'none',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                            >
                              <div style={{ fontSize: '13px', color: '#dc2626', fontWeight: 500 }}>
                                {doc.file_name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                                File Size: {formatFileSize(doc.file_size)}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* More dropdown */}
                <div ref={moreRef} style={{ position: 'relative' }}>
                  <button onClick={() => setMoreOpen(!moreOpen)}
                    style={{ padding: '7px 14px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff', color: '#374151', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                    More &#9660;
                  </button>
                  {moreOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                      backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '160px',
                      overflow: 'hidden',
                    }}>
                      <button onClick={handleClone}
                        style={menuItemStyle}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}>
                        Clone
                      </button>
                      <button onClick={handleDelete}
                        style={{ ...menuItemStyle, color: '#dc2626' }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#fef2f2'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Close button */}
                <button onClick={() => navigate('/customer')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af', padding: '4px' }}>
                  &#10005;
                </button>
              </div>
            </div>

            {/* Content area */}
            <div style={{ display: 'flex', gap: '0' }}>
              {/* Left info */}
              <div style={{ flex: 1, padding: '24px', borderRight: '1px solid #e5e7eb' }}>
                {/* Company tag */}
                {customer.company_name && (
                  <div style={{ backgroundColor: '#eff6ff', padding: '8px 16px', borderRadius: '6px', fontSize: '14px', color: '#1e40af', marginBottom: '20px', fontWeight: 500 }}>
                    {customer.company_name}
                  </div>
                )}

                {/* Edit form */}
                {editing ? (
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#6b7280', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Edit Customer</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={labelStyle}>Display Name</label>
                        <input type="text" value={editData.display_name} onChange={(e) => setEditData(prev => ({ ...prev, display_name: e.target.value }))}
                          style={editInputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Company Name</label>
                        <input type="text" value={editData.company_name} onChange={(e) => setEditData(prev => ({ ...prev, company_name: e.target.value }))}
                          style={editInputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Email</label>
                        <input type="email" value={editData.email} onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                          style={editInputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Phone</label>
                        <input type="text" value={editData.phone} onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                          style={editInputStyle} />
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button onClick={handleSaveEdit} disabled={saving}
                          style={{ padding: '8px 20px', backgroundColor: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setEditing(false)}
                          style={{ padding: '8px 20px', backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Contact info card */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                        <div style={{
                          width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#e5e7eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '18px', color: '#6b7280', fontWeight: 600,
                        }}>
                          {(customer.first_name || customer.display_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937' }}>
                            {getDisplayName(customer)}
                          </div>
                          {customer.email && (
                            <div style={{ fontSize: '13px', color: '#2563eb', marginTop: '2px' }}>
                              {customer.email}
                            </div>
                          )}
                          {customer.phone && (
                            <div style={{ fontSize: '13px', color: '#374151', marginTop: '2px' }}>
                              &#9742; {customer.country_code || '+91'}-{customer.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Other Details */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '14px',
                      }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                          OTHER DETAILS
                        </h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <DetailRow label="Customer Type" value={customer.customer_type} />
                        <DetailRow label="Default Currency" value={customer.currency || 'INR'} />
                        <DetailRow label="Status" value={customer.is_active ? 'Active' : 'Inactive'} valueColor={customer.is_active ? '#16a34a' : '#dc2626'} />
                      </div>
                    </div>

                    {/* Contact Persons */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '14px',
                      }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                          CONTACT PERSONS
                        </h3>
                      </div>
                      {(!customer.contact_persons || customer.contact_persons.length === 0) ? (
                        <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '16px' }}>
                          No contact persons found.
                        </div>
                      ) : (
                        customer.contact_persons.map((cp) => (
                          <div key={cp.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937' }}>
                                  {[cp.salutation, cp.first_name, cp.last_name].filter(Boolean).join(' ')}
                                </div>
                                {cp.email && <div style={{ fontSize: '12px', color: '#6b7280' }}>{cp.email}</div>}
                                {cp.work_phone && <div style={{ fontSize: '12px', color: '#6b7280' }}>Work: {cp.work_phone}</div>}
                                {cp.mobile && <div style={{ fontSize: '12px', color: '#6b7280' }}>Mobile: {cp.mobile}</div>}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <button onClick={() => {
                                  setEditCPData({
                                    first_name: cp.first_name || '',
                                    last_name: cp.last_name || '',
                                    email: cp.email || '',
                                    work_phone: cp.work_phone || '',
                                    mobile: cp.mobile || '',
                                    salutation: cp.salutation || '',
                                  })
                                  setEditingCP(cp)
                                }}
                                  style={{
                                    padding: '4px 10px', backgroundColor: '#f0fdf4', color: '#15803d',
                                    border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '11px',
                                    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                  }}>
                                  Edit
                                </button>
                                <button onClick={async () => {
                                  if (!window.confirm('Delete this contact person?')) return
                                  try {
                                    await deleteContactPerson(id, cp.id)
                                    loadDetail()
                                  } catch { alert('Failed to delete contact person') }
                                }}
                                  style={{
                                    padding: '4px 10px', backgroundColor: '#fef2f2', color: '#dc2626',
                                    border: '1px solid #fecaca', borderRadius: '6px', fontSize: '11px',
                                    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                  }}>
                                  Delete
                                </button>
                                <button onClick={() => setTemplateModalCP(cp)}
                                  style={{
                                    padding: '4px 10px', backgroundColor: '#e0e7ff', color: '#3730a3',
                                    border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '11px',
                                    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                  }}>
                                  Templates ({cpTemplateCounts[cp.id] || 0})
                                </button>
                                {cp.email && (
                                  <button onClick={() => setSendEmailCP(cp)}
                                    style={{
                                      padding: '4px 10px', backgroundColor: '#dbeafe', color: '#1d4ed8',
                                      border: '1px solid #93c5fd', borderRadius: '6px', fontSize: '11px',
                                      fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                    }}>
                                    Send Email
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Record Info */}
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '14px',
                      }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                          RECORD INFO
                        </h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <DetailRow label="Customer ID" value={customer.customer_id} />
                        <DetailRow label="Created On" value={formatDate(customer.created_at)} />
                        <DetailRow label="Created By" value={customer.created_by || '-'} />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right panel - Activity Timeline */}
              <div style={{ width: '420px', padding: '24px', flexShrink: 0 }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '20px' }}>
                  Activity Timeline
                </h3>
                {(!customer.activities || customer.activities.length === 0) ? (
                  <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', paddingTop: '40px' }}>
                    No activity recorded yet.
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    {/* Vertical line */}
                    <div style={{
                      position: 'absolute', left: '95px', top: '0', bottom: '0',
                      width: '2px', backgroundColor: '#dbeafe',
                    }} />
                    {customer.activities.map((act, i) => (
                      <div key={act.id} style={{ display: 'flex', gap: '16px', marginBottom: '24px', position: 'relative' }}>
                        {/* Date */}
                        <div style={{ width: '80px', flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                            {formatDate(act.created_at).split(' ').slice(0, 1).join('')}
                          </div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                            {formatDate(act.created_at).split(' ').slice(1).join(' ')}
                          </div>
                        </div>
                        {/* Dot */}
                        <div style={{
                          width: '12px', height: '12px', borderRadius: '50%',
                          backgroundColor: '#fff', border: '2px solid #2563eb',
                          position: 'relative', zIndex: 1, marginTop: '4px', flexShrink: 0,
                        }} />
                        {/* Content */}
                        <div style={{
                          flex: 1, backgroundColor: '#f9fafb', borderRadius: '8px',
                          border: '1px solid #e5e7eb', padding: '12px 16px',
                        }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                            {act.action}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {act.description}
                          </div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                            by {act.performed_by || 'System'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Template Assign Modal */}
      {templateModalCP && (
        <TemplateAssignModal
          contactPerson={templateModalCP}
          onClose={() => setTemplateModalCP(null)}
          onUpdate={refreshTemplateCounts}
        />
      )}

      {/* Send Email to HR Modal */}
      {sendEmailCP && (
        <SendToHRModal
          contactPerson={sendEmailCP}
          onClose={() => setSendEmailCP(null)}
          onSent={() => {}}
        />
      )}

      {/* Contact Person Edit Modal */}
      {editingCP && (
        <div onClick={() => setEditingCP(null)} style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: '#fff', borderRadius: '12px', width: '480px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>Edit Contact Person</h3>
              <button onClick={() => setEditingCP(null)} style={{
                background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9ca3af',
              }}>×</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>First Name</label>
                  <input type="text" value={editCPData.first_name} onChange={e => setEditCPData(prev => ({ ...prev, first_name: e.target.value }))} style={editInputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Last Name</label>
                  <input type="text" value={editCPData.last_name} onChange={e => setEditCPData(prev => ({ ...prev, last_name: e.target.value }))} style={editInputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={editCPData.email} onChange={e => setEditCPData(prev => ({ ...prev, email: e.target.value }))} style={editInputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Work Phone</label>
                  <input type="text" value={editCPData.work_phone} onChange={e => setEditCPData(prev => ({ ...prev, work_phone: e.target.value }))} style={editInputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Mobile</label>
                  <input type="text" value={editCPData.mobile} onChange={e => setEditCPData(prev => ({ ...prev, mobile: e.target.value }))} style={editInputStyle} />
                </div>
              </div>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: '10px',
              padding: '14px 20px', borderTop: '1px solid #e5e7eb',
            }}>
              <button onClick={() => setEditingCP(null)} style={{
                padding: '8px 20px', backgroundColor: '#fff', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
              }}>Cancel</button>
              <button disabled={savingCP} onClick={async () => {
                setSavingCP(true)
                try {
                  await updateContactPerson(id, editingCP.id, editCPData)
                  setEditingCP(null)
                  loadDetail()
                } catch { alert('Failed to update contact person') }
                finally { setSavingCP(false) }
              }} style={{
                padding: '8px 20px', backgroundColor: savingCP ? '#93c5fd' : '#2563eb', color: '#fff',
                border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                cursor: savingCP ? 'not-allowed' : 'pointer',
              }}>{savingCP ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Fade-in animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}


function DetailRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', gap: '16px' }}>
      <span style={{ fontSize: '13px', color: '#6b7280', width: '140px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '13px', color: valueColor || '#1f2937', fontWeight: 500 }}>{value || '-'}</span>
    </div>
  )
}


const menuItemStyle = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '10px 16px', border: 'none', cursor: 'pointer',
  backgroundColor: '#fff', color: '#374151', fontSize: '14px',
}

const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px',
}

const editInputStyle = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px',
  fontSize: '14px', color: '#374151', outline: 'none', boxSizing: 'border-box',
}
