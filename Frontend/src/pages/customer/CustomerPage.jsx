/**
 * CustomerPage — 2-panel layout wrapper for the Customer module.
 *
 * Left Sidebar: Category selector (Client / Vendor / Others → Own Company / Candidate)
 * Right Panel:  CustomerList filtered by selected category
 *
 * URL: /customer?type=client | /customer?type=vendor | /customer?type=own_company | /customer?type=candidate
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CustomerList from './CustomerList'
import CandidateTemplates from '../admin/CandidateTemplates'

const TOP_CATEGORIES = [
  { key: 'client', label: 'Client' },
  { key: 'vendor', label: 'Vendor' },
]

const OTHERS_ITEMS = [
  { key: 'own_company', label: 'Own Company' },
  { key: 'candidate', label: 'Candidate' },
  { key: 'candidate_templates', label: 'Candidate Templates' },
]

export default function CustomerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedType = searchParams.get('type') || 'client'
  const [othersOpen, setOthersOpen] = useState(
    OTHERS_ITEMS.some(i => i.key === selectedType)
  )

  const isOthersActive = OTHERS_ITEMS.some(i => i.key === selectedType)

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 56px)',
      overflow: 'hidden',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>

      {/* ── Left Sidebar ─────────────────────────────────────── */}
      <div style={{
        width: '196px',
        flexShrink: 0,
        backgroundColor: '#fff',
        borderRight: '1px solid #e5e7eb',
        padding: '20px 10px',
        overflowY: 'auto',
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#9ca3af',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          paddingLeft: '8px',
          marginBottom: '10px',
        }}>
          Category
        </div>

        {/* Client + Vendor */}
        {TOP_CATEGORIES.map(cat => {
          const isActive = selectedType === cat.key
          return (
            <div
              key={cat.key}
              onClick={() => setSearchParams({ type: cat.key })}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '4px',
                cursor: 'pointer',
                backgroundColor: isActive ? '#eff6ff' : 'transparent',
                border: `1.5px solid ${isActive ? '#bfdbfe' : 'transparent'}`,
                color: isActive ? '#1d4ed8' : '#374151',
                transition: 'all 0.15s',
                userSelect: 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: isActive ? 600 : 500, lineHeight: '1.2' }}>
                {cat.label}
              </div>
            </div>
          )
        })}

        {/* Others — dropdown group */}
        <div style={{ marginBottom: '4px' }}>
          {/* Dropdown header */}
          <div
            onClick={() => setOthersOpen(v => !v)}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: isOthersActive ? '#eff6ff' : 'transparent',
              border: `1.5px solid ${isOthersActive ? '#bfdbfe' : 'transparent'}`,
              color: isOthersActive ? '#1d4ed8' : '#374151',
              transition: 'all 0.15s',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onMouseEnter={e => {
              if (!isOthersActive) e.currentTarget.style.backgroundColor = '#f3f4f6'
            }}
            onMouseLeave={e => {
              if (!isOthersActive) e.currentTarget.style.backgroundColor = isOthersActive ? '#eff6ff' : 'transparent'
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: isOthersActive ? 600 : 500, lineHeight: '1.2' }}>
              Others
            </div>
            <div style={{
              fontSize: '11px',
              color: isOthersActive ? '#1d4ed8' : '#9ca3af',
              transition: 'transform 0.2s',
              transform: othersOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              lineHeight: 1,
            }}>
              ▾
            </div>
          </div>

          {/* Sub-items — smooth expand */}
          <div style={{
            overflow: 'hidden',
            maxHeight: othersOpen ? '200px' : '0',
            transition: 'max-height 0.22s ease',
          }}>
            {OTHERS_ITEMS.map(item => {
              const isActive = selectedType === item.key
              return (
                <div
                  key={item.key}
                  onClick={() => setSearchParams({ type: item.key })}
                  style={{
                    padding: '9px 12px 9px 26px',
                    borderRadius: '8px',
                    marginTop: '2px',
                    cursor: 'pointer',
                    backgroundColor: isActive ? '#eff6ff' : 'transparent',
                    border: `1.5px solid ${isActive ? '#bfdbfe' : 'transparent'}`,
                    color: isActive ? '#1d4ed8' : '#374151',
                    transition: 'all 0.15s',
                    userSelect: 'none',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 400,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.backgroundColor = '#f3f4f6'
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  {item.label}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Right Panel ──────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', backgroundColor: '#fff' }}>
        {selectedType === 'candidate_templates' ? (
          <CandidateTemplates />
        ) : (
          <CustomerList key={selectedType} entityType={selectedType} />
        )}
      </div>
    </div>
  )
}

