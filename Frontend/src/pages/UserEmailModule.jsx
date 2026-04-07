/**
 * UserEmailModule — Combined email centre with a vertical sidebar navigation.
 *
 * Route: /user/email
 *
 * Sections:
 *  ① Email Settings  — the existing EmailSettingsPage embedded in the right panel
 *  ② Email History   — new EmailHistorySection with analytics + timeline
 *
 * Layout:
 *  ┌──────────────┬───────────────────────────────────────┐
 *  │  SIDEBAR     │  MAIN CONTENT PANEL                   │
 *  │  Email       │  (EmailSettingsPage or                │
 *  │  Settings    │   EmailHistorySection)                 │
 *  │  Email       │                                       │
 *  │  History     │                                       │
 *  └──────────────┴───────────────────────────────────────┘
 */
import { useState } from 'react'
import EmailSettingsPage   from './EmailSettingsPage'
import EmailHistorySection from '../components/email/EmailHistorySection'

const NAV = [
  {
    id:          'settings',
    icon:        '⚙️',
    label:       'Email Settings',
    description: 'Configure providers',
  },
  {
    id:          'history',
    icon:        '📋',
    label:       'Email History',
    description: 'Track sent emails',
  },
]

export default function UserEmailModule() {
  const [active, setActive] = useState('settings')

  return (
    <div style={{
      display:   'flex',
      minHeight: 'calc(100vh - 56px)',
      background: '#f8fafc',
    }}>
      {/* ── Left sidebar ──────────────────────────────────────── */}
      <div style={{
        width:        220,
        background:   '#fff',
        borderRight:  '1px solid #e2e8f0',
        flexShrink:   0,
        display:      'flex',
        flexDirection: 'column',
      }}>
        {/* Sidebar heading */}
        <div style={{
          padding:      '20px 18px 14px',
          borderBottom: '1px solid #f1f5f9',
        }}>
          <div style={{
            fontSize:       11,
            fontWeight:     700,
            color:          '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
          }}>
            Email Centre
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {NAV.map(item => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                style={{
                  width:        '100%',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          10,
                  padding:      '10px 12px',
                  borderRadius: 8,
                  border:       'none',
                  borderLeft:   `3px solid ${isActive ? '#2563eb' : 'transparent'}`,
                  background:   isActive ? '#eff6ff' : 'transparent',
                  cursor:       'pointer',
                  textAlign:    'left',
                  marginBottom: 2,
                  transition:   'background 0.13s, border-left-color 0.13s',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = '#f8fafc'
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: 17 }}>{item.icon}</span>
                <div>
                  <div style={{
                    fontSize:   13,
                    fontWeight: isActive ? 600 : 500,
                    color:      isActive ? '#1d4ed8' : '#374151',
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize:  11,
                    color:     '#94a3b8',
                    marginTop: 1,
                  }}>
                    {item.description}
                  </div>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Sidebar footer */}
        <div style={{
          padding:   '14px 18px',
          borderTop: '1px solid #f1f5f9',
        }}>
          <div style={{ fontSize: 11, color: '#c0ccd8', textAlign: 'center' }}>
            KPRMT Email Centre
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {active === 'settings' ? (
          <EmailSettingsPage />
        ) : (
          <EmailHistorySection />
        )}
      </div>
    </div>
  )
}
