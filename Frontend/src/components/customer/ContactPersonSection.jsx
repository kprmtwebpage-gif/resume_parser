import { useState, useEffect, useRef } from 'react'
import countryCodes from '../../pages/customer/countryCodes'

const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.']

/**
 * ContactPersonSection — editable list of contact persons.
 * Renders inline rows (not inside a tab) with full visibility.
 *
 * Props:
 *  - contactPersons: array of { salutation, firstName, lastName, email, workPhone, mobile, ccWork, ccMobile }
 *  - onChange: (index, field, value) => void
 *  - onAdd: () => void
 *  - onRemove: (index) => void
 */
export default function ContactPersonSection({ contactPersons, onChange, onAdd, onRemove }) {
  return (
    <div>
      {/* Section heading */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
          Contact Persons
        </h3>
        <button
          onClick={onAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'none', border: '1px solid #2563eb', borderRadius: '6px',
            padding: '6px 14px', cursor: 'pointer',
            color: '#2563eb', fontSize: '13px', fontWeight: 600,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#eff6ff' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          + Add Contact Person
        </button>
      </div>

      {/* Contact rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {contactPersons.map((cp, i) => (
          <ContactPersonCard
            key={i}
            index={i}
            cp={cp}
            onChange={onChange}
            onRemove={onRemove}
            canDelete={i > 0}
            label={i === 0 ? 'Primary' : `Contact ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}


function ContactPersonCard({ index, cp, onChange, onRemove, canDelete, label }) {
  const [salOpen, setSalOpen] = useState(false)
  const [ccWorkOpen, setCcWorkOpen] = useState(false)
  const [ccMobileOpen, setCcMobileOpen] = useState(false)
  const [ccWorkSearch, setCcWorkSearch] = useState('')
  const [ccMobileSearch, setCcMobileSearch] = useState('')
  const salRef = useRef(null)
  const ccWorkRef = useRef(null)
  const ccMobileRef = useRef(null)

  useEffect(() => {
    const handle = (e) => {
      if (salRef.current && !salRef.current.contains(e.target)) setSalOpen(false)
      if (ccWorkRef.current && !ccWorkRef.current.contains(e.target)) setCcWorkOpen(false)
      if (ccMobileRef.current && !ccMobileRef.current.contains(e.target)) setCcMobileOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filteredCcWork = ccWorkSearch
    ? countryCodes.filter(c => c.country.toLowerCase().includes(ccWorkSearch.toLowerCase()) || c.code.includes(ccWorkSearch))
    : countryCodes
  const filteredCcMobile = ccMobileSearch
    ? countryCodes.filter(c => c.country.toLowerCase().includes(ccMobileSearch.toLowerCase()) || c.code.includes(ccMobileSearch))
    : countryCodes

  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px',
      backgroundColor: '#fafbfc',
    }}>
      {/* Row header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '14px',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
        {canDelete && (
          <button onClick={() => onRemove(index)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#94a3b8', fontSize: '18px', lineHeight: 1, padding: '2px 4px',
              borderRadius: '4px', transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
            title="Remove contact person"
          >
            ✕
          </button>
        )}
      </div>

      {/* Fields in a responsive grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '12px',
      }}>
        {/* Salutation */}
        <div>
          <label style={fieldLabelStyle}>Salutation</label>
          <div ref={salRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setSalOpen(!salOpen)}
              style={{
                ...fieldInputStyle, width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', backgroundColor: '#fff',
              }}>
              <span style={{ color: cp.salutation ? '#374151' : '#9ca3af' }}>
                {cp.salutation || 'Select'}
              </span>
              <span style={{ fontSize: '10px', color: '#9ca3af' }}>&#9660;</span>
            </button>
            {salOpen && (
              <div style={dropdownMenuStyle}>
                {SALUTATIONS.map(s => (
                  <button key={s}
                    onClick={() => { onChange(index, 'salutation', s); setSalOpen(false) }}
                    style={dropdownItemStyle}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff' }}
                  >{s}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* First Name */}
        <div>
          <label style={fieldLabelStyle}>First Name</label>
          <input type="text" value={cp.firstName}
            onChange={e => onChange(index, 'firstName', e.target.value)}
            placeholder="First Name"
            style={fieldInputStyle} />
        </div>

        {/* Last Name */}
        <div>
          <label style={fieldLabelStyle}>Last Name</label>
          <input type="text" value={cp.lastName}
            onChange={e => onChange(index, 'lastName', e.target.value)}
            placeholder="Last Name"
            style={fieldInputStyle} />
        </div>

        {/* Email */}
        <div>
          <label style={fieldLabelStyle}>Email Address</label>
          <input type="email" value={cp.email}
            onChange={e => onChange(index, 'email', e.target.value)}
            placeholder="email@example.com"
            style={fieldInputStyle} />
        </div>

        {/* Work Phone */}
        <div>
          <label style={fieldLabelStyle}>Work Phone</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div ref={ccWorkRef} style={{ position: 'relative' }}>
              <button type="button"
                onClick={() => { setCcWorkOpen(!ccWorkOpen); setCcWorkSearch('') }}
                style={{
                  ...fieldInputStyle, width: '68px', padding: '0 6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', fontSize: '13px',
                }}>
                <span>{cp.ccWork}</span>
                <span style={{ fontSize: '8px', color: '#9ca3af' }}>&#9660;</span>
              </button>
              {ccWorkOpen && (
                <CountryCodeDropdown
                  search={ccWorkSearch}
                  onSearchChange={setCcWorkSearch}
                  filtered={filteredCcWork}
                  onSelect={(code) => { onChange(index, 'ccWork', code); setCcWorkOpen(false) }}
                />
              )}
            </div>
            <input type="text" value={cp.workPhone}
              onChange={e => onChange(index, 'workPhone', e.target.value)}
              style={{ ...fieldInputStyle, flex: 1, minWidth: 0 }} />
          </div>
        </div>

        {/* Mobile */}
        <div>
          <label style={fieldLabelStyle}>Mobile</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div ref={ccMobileRef} style={{ position: 'relative' }}>
              <button type="button"
                onClick={() => { setCcMobileOpen(!ccMobileOpen); setCcMobileSearch('') }}
                style={{
                  ...fieldInputStyle, width: '68px', padding: '0 6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', fontSize: '13px',
                }}>
                <span>{cp.ccMobile}</span>
                <span style={{ fontSize: '8px', color: '#9ca3af' }}>&#9660;</span>
              </button>
              {ccMobileOpen && (
                <CountryCodeDropdown
                  search={ccMobileSearch}
                  onSearchChange={setCcMobileSearch}
                  filtered={filteredCcMobile}
                  onSelect={(code) => { onChange(index, 'ccMobile', code); setCcMobileOpen(false) }}
                />
              )}
            </div>
            <input type="text" value={cp.mobile}
              onChange={e => onChange(index, 'mobile', e.target.value)}
              style={{ ...fieldInputStyle, flex: 1, minWidth: 0 }} />
          </div>
        </div>
      </div>
    </div>
  )
}


function CountryCodeDropdown({ search, onSearchChange, filtered, onSelect }) {
  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, marginTop: '2px',
      backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 200,
      width: '240px', overflow: 'hidden',
    }}>
      <div style={{ padding: '6px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, backgroundColor: '#fff' }}>
        <input type="text" value={search} onChange={e => onSearchChange(e.target.value)}
          placeholder="Search country..." autoFocus
          style={{
            width: '100%', padding: '6px 8px', border: '1px solid #d1d5db',
            borderRadius: '5px', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
          }} />
      </div>
      <div style={{ overflowY: 'auto', maxHeight: '180px' }}>
        {filtered.map((c, j) => (
          <button key={j} onClick={() => onSelect(c.code)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '7px 10px', border: 'none', cursor: 'pointer',
              backgroundColor: '#fff', color: '#374151', fontSize: '13px',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff' }}
          >
            {c.code}&nbsp;&nbsp;{c.country}
          </button>
        ))}
      </div>
    </div>
  )
}


// ── Styles ──

const fieldLabelStyle = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b',
  marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.03em',
}

const fieldInputStyle = {
  width: '100%', height: '38px', padding: '0 10px',
  border: '1px solid #d1d5db', borderRadius: '6px',
  fontSize: '14px', color: '#374151', outline: 'none',
  boxSizing: 'border-box', backgroundColor: '#fff',
  transition: 'border-color 0.15s',
}

const dropdownMenuStyle = {
  position: 'absolute', top: '100%', left: 0, marginTop: '2px',
  backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 200,
  width: '120px', overflow: 'hidden',
}

const dropdownItemStyle = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '8px 12px', border: 'none', cursor: 'pointer',
  backgroundColor: '#fff', color: '#374151', fontSize: '14px',
}
