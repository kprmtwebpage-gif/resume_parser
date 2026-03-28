import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers, deleteCustomer } from '../../services/customerApi'

export default function CustomerList() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [menuOpen, setMenuOpen] = useState(false)
  const [sortSubmenu, setSortSubmenu] = useState(null)
  const menuRef = useRef(null)
  const filterRef = useRef(null)

  const filterLabels = {
    all: 'All Customers',
    active: 'Active Customers',
    inactive: 'Inactive Customers',
  }

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCustomers({
        search: search || undefined,
        status: filterStatus === 'all' ? undefined : filterStatus,
        sortBy,
        sortOrder,
      })
      setCustomers(data)
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, sortBy, sortOrder])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  useEffect(() => {
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterDropdownOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handleSort = (field, order) => {
    setSortBy(field)
    setSortOrder(order)
    setMenuOpen(false)
    setSortSubmenu(null)
  }

  const getDisplayName = (c) => {
    if (c.display_name) return c.display_name
    const parts = [c.salutation, c.first_name, c.last_name].filter(Boolean)
    return parts.join(' ') || 'Unnamed'
  }

  const getPhone = (c) => {
    if (!c.phone) return ''
    return `${c.country_code || '+91'}-${c.phone}`
  }

  return (
    <div style={{ backgroundColor: '#fff', minHeight: 'calc(100vh - 56px)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Top bar: Refresh + Search */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid #e5e7eb',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={loadCustomers}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
              color: '#6b7280', fontSize: '18px', display: 'flex', alignItems: 'center',
            }}
            title="Refresh"
          >
            &#8635;
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
            <span style={{ color: '#9ca3af', fontSize: '16px' }}>&#128269;</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in Customers ( / )"
              style={{
                border: 'none', outline: 'none', fontSize: '14px', color: '#374151',
                width: '220px', padding: '4px 8px', backgroundColor: 'transparent',
              }}
            />
          </div>
        </div>
      </div>

      {/* Filter + New + Menu bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px 12px',
      }}>
        {/* Filter dropdown */}
        <div ref={filterRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '18px', fontWeight: 600, color: '#1f2937',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {filterLabels[filterStatus]}
            <span style={{ fontSize: '12px', color: '#6b7280' }}>&#9660;</span>
          </button>
          {filterDropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: '4px',
              backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '200px',
              overflow: 'hidden', animation: 'fadeIn 0.15s ease',
            }}>
              {Object.entries(filterLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setFilterStatus(key); setFilterDropdownOpen(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 16px', border: 'none', cursor: 'pointer',
                    backgroundColor: filterStatus === key ? '#eff6ff' : '#fff',
                    color: filterStatus === key ? '#2563eb' : '#374151',
                    fontSize: '14px', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = filterStatus === key ? '#eff6ff' : '#f9fafb'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = filterStatus === key ? '#eff6ff' : '#fff'}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Templates Button */}
          <button
            onClick={() => navigate('/customer/templates')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: '#2563eb', color: '#fff', border: 'none',
              borderRadius: '6px', padding: '8px 18px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 600, transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
          >
            Templates
          </button>

          {/* + New Button */}
          <button
            onClick={() => navigate('/customer/new')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: '#2563eb', color: '#fff', border: 'none',
              borderRadius: '6px', padding: '8px 18px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 600, transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
          >
            + New
          </button>

          {/* 3-dot menu */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setMenuOpen(!menuOpen); setSortSubmenu(null) }}
              style={{
                background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px',
                cursor: 'pointer', padding: '6px 10px', color: '#6b7280', fontSize: '18px',
                display: 'flex', alignItems: 'center',
              }}
            >
              &#8943;
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '220px',
                overflow: 'visible', animation: 'fadeIn 0.15s ease',
              }}>
                {/* Name sort */}
                <button
                  onClick={() => handleSort('name', 'asc')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '10px 16px', border: 'none', cursor: 'pointer',
                    backgroundColor: sortBy === 'name' ? '#eff6ff' : '#fff',
                    color: '#374151', fontSize: '14px', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = sortBy === 'name' ? '#eff6ff' : '#fff'}
                >
                  Name (A-Z)
                  {sortBy === 'name' && <span style={{ color: '#2563eb' }}>&#10003;</span>}
                </button>

                {/* Created Time sort */}
                <button
                  onClick={() => handleSort('created_at', 'desc')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '10px 16px', border: 'none', cursor: 'pointer',
                    backgroundColor: sortBy === 'created_at' ? '#eff6ff' : '#fff',
                    color: '#374151', fontSize: '14px', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = sortBy === 'created_at' ? '#eff6ff' : '#fff'}
                >
                  Created Time (Latest)
                  {sortBy === 'created_at' && <span style={{ color: '#2563eb' }}>&#10003;</span>}
                </button>

                {/* Company Name sort */}
                <button
                  onClick={() => handleSort('company_name', 'asc')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '10px 16px', border: 'none', cursor: 'pointer',
                    backgroundColor: sortBy === 'company_name' ? '#eff6ff' : '#fff',
                    color: '#374151', fontSize: '14px', textAlign: 'left',
                    borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px',
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = sortBy === 'company_name' ? '#eff6ff' : '#fff'}
                >
                  Company Name
                  {sortBy === 'company_name' && <span style={{ color: '#2563eb' }}>&#10003;</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', borderTop: '1px solid #e5e7eb' }}>
              <th style={{ width: '40px', padding: '10px 12px' }}>
                <input type="checkbox" disabled style={{ opacity: 0.4 }} />
              </th>
              <th style={thStyle}>NAME &#8597;</th>
              <th style={thStyle}>COMPANY NAME</th>
              <th style={thStyle}>EMAIL</th>
              <th style={thStyle}>PHONE</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '14px' }}>
                  Loading customers...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '14px' }}>
                  No customers found. Click &quot;+ New&quot; to create one.
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/customer/${c.id}`)}
                  style={{
                    borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <td style={{ padding: '12px', width: '40px' }}>
                    <input type="checkbox" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 500 }}>
                    {getDisplayName(c)}
                  </td>
                  <td style={tdStyle}>{c.company_name || '-'}</td>
                  <td style={tdStyle}>{c.email || '-'}</td>
                  <td style={tdStyle}>{getPhone(c) || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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

const thStyle = {
  textAlign: 'left', padding: '10px 16px', fontSize: '11px',
  fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.05em', whiteSpace: 'nowrap',
}

const tdStyle = {
  padding: '14px 16px', fontSize: '14px', color: '#374151',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  maxWidth: '250px',
}
