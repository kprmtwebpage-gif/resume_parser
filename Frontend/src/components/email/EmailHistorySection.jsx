/**
 * EmailHistorySection — User-level email history with analytics, filters, and timeline.
 *
 * Displays:
 *  - 4 analytics cards (Total, Outlook, Gmail, Zoho)
 *  - Provider filter tabs (All / Gmail / Zoho / Outlook)
 *  - Date range dropdown (Today / Yesterday / Last 7 Days / etc.)
 *  - Timeline-style email list grouped by date
 *
 * Clicking an email item navigates to the search page with the candidate's name
 * pre-filled so the user can locate the candidate profile.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { getUserEmailHistory } from '../../services/emailApi'
import { fetchCandidateById } from '../../services/api'
import ProfileModal from '../ProfileModal'
import RightSlidePanel from '../RightSlidePanel'

/* ── Provider colours (matches ActionCenter theme) ──────────── */
const PROVIDER_THEME = {
  gmail:   { color: '#d93025', bg: '#fef2f2', border: '#fca5a5', label: 'Gmail',   dot: '#d93025' },
  zoho:    { color: '#1b7f3b', bg: '#f0fdf4', border: '#86efac', label: 'Zoho',    dot: '#1b7f3b' },
  outlook: { color: '#0b5ed7', bg: '#eff6ff', border: '#bfdbfe', label: 'Outlook', dot: '#0b5ed7' },
  default: { color: '#6c757d', bg: '#f8f9fa', border: '#dee2e6', label: 'Email',   dot: '#94a3b8' },
}

function theme(provider) {
  return PROVIDER_THEME[provider?.toLowerCase()] || PROVIDER_THEME.default
}

/* ── Date range options ──────────────────────────────────────── */
const DATE_RANGES = [
  { value: 'all',       label: 'All Time'     },
  { value: 'today',     label: 'Today'        },
  { value: 'yesterday', label: 'Yesterday'    },
  { value: 'last7',     label: 'Last 7 Days'  },
  { value: 'last30',    label: 'Last 30 Days' },
  { value: 'thismonth', label: 'This Month'   },
  { value: 'lastmonth', label: 'Last Month'   },
  { value: 'custom',    label: 'Custom Range' },
]

/* ── Helpers ─────────────────────────────────────────────────── */
function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateGroup(iso) {
  if (!iso) return 'Unknown'
  const d = new Date(iso)
  const now = new Date()
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const sent      = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (sent.getTime() === today.getTime())     return 'Today'
  if (sent.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

/* ── Stats card ──────────────────────────────────────────────── */
function StatsCard({ label, count, emoji, accentColor, accentBg }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 150,
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '18px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{
        width: 46,
        height: 46,
        borderRadius: 11,
        background: accentBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
      }}>
        {emoji}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', lineHeight: 1.1 }}>{count}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  )
}

/* ── Loading skeleton rows ───────────────────────────────────── */
function SkeletonRow() {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '14px 18px',
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      <div style={{ width: 10, height: 44, borderRadius: 5, background: '#e2e8f0' }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: '38%', height: 13, background: '#e2e8f0', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ width: '65%', height: 12, background: '#f1f5f9', borderRadius: 4, marginBottom: 6 }} />
        <div style={{ width: '48%', height: 11, background: '#f1f5f9', borderRadius: 4 }} />
      </div>
      <div style={{ width: 75, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ width: 55, height: 11, background: '#e2e8f0', borderRadius: 4 }} />
        <div style={{ width: 48, height: 20, background: '#f1f5f9', borderRadius: 10 }} />
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────── */
export default function EmailHistorySection() {
  const [activeProvider, setActiveProvider] = useState('all')
  const [dateRange,      setDateRange]      = useState('all')
  const [customFrom,     setCustomFrom]     = useState('')
  const [customTo,       setCustomTo]       = useState('')
  const [showDateDrop,   setShowDateDrop]   = useState(false)

  const [emails,  setEmails]  = useState([])
  const [stats,   setStats]   = useState({ total: 0, gmail: 0, zoho: 0, outlook: 0 })
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Profile drawer state
  const [profileOpen,      setProfileOpen]      = useState(false)
  const [profileTab,       setProfileTab]       = useState('skills')
  const [profileCandidate, setProfileCandidate] = useState(null)
  const [profileLoading,   setProfileLoading]   = useState(false)
  const [profileError,     setProfileError]     = useState(null)
  const [selectedEmailId,  setSelectedEmailId]  = useState(null)

  const dateDropRef = useRef(null)

  /* Close dropdown on outside click */
  useEffect(() => {
    function onOutside(e) {
      if (dateDropRef.current && !dateDropRef.current.contains(e.target)) {
        setShowDateDrop(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  /* Fetch data */
  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const opts = {}
      if (activeProvider !== 'all') opts.provider = activeProvider
      if (dateRange !== 'all' && dateRange !== 'custom') opts.dateRange = dateRange
      if (dateRange === 'custom') {
        if (customFrom) opts.dateFrom = customFrom
        if (customTo)   opts.dateTo   = customTo
      }
      const data = await getUserEmailHistory(opts)
      setEmails(data.emails || [])
      if (data.stats) setStats(data.stats)
    } catch (err) {
      console.error('EmailHistorySection fetch error:', err)
      setError('Failed to load email history. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [activeProvider, dateRange, customFrom, customTo])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  /* Open candidate profile drawer */
  async function handleOpenProfile(email) {
    if (!email.candidate_id) return
    setSelectedEmailId(email.id)
    setProfileCandidate(null)
    setProfileError(null)
    setProfileLoading(true)
    setProfileOpen(true)
    setProfileTab('skills')
    try {
      const data = await fetchCandidateById(email.candidate_id)
      setProfileCandidate(data)
    } catch (err) {
      console.error('Failed to fetch candidate profile:', err)
      setProfileError('Unable to load candidate profile.')
    } finally {
      setProfileLoading(false)
    }
  }

  function closeProfile() {
    setProfileOpen(false)
    setSelectedEmailId(null)
  }

  /* Group emails by date label */
  const grouped = emails.reduce((acc, email) => {
    const key = fmtDateGroup(email.sent_at)
    if (!acc[key]) acc[key] = []
    acc[key].push(email)
    return acc
  }, {})

  const selectedDateLabel = DATE_RANGES.find(d => d.value === dateRange)?.label ?? 'Filter by Date'

  return (
    <div style={{ padding: '28px 36px', minHeight: '100%', background: '#f8fafc' }}>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
          Email History
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Track all emails sent from your connected accounts
        </p>
      </div>

      {/* ── Stats cards ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        <StatsCard
          label="Total Sent"
          count={stats.total}
          emoji="✉️"
          accentColor="#475569"
          accentBg="#f1f5f9"
        />
        <StatsCard
          label="Outlook Emails"
          count={stats.outlook}
          emoji="📬"
          accentColor="#0b5ed7"
          accentBg="#eff6ff"
        />
        <StatsCard
          label="Gmail Emails"
          count={stats.gmail}
          emoji="📧"
          accentColor="#d93025"
          accentBg="#fef2f2"
        />
        <StatsCard
          label="Zoho Emails"
          count={stats.zoho}
          emoji="📨"
          accentColor="#1b7f3b"
          accentBg="#f0fdf4"
        />
      </div>

      {/* ── Filter bar ──────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '10px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        {/* Provider tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { value: 'all',     label: 'All',     color: '#334155' },
            { value: 'gmail',   label: '🔴 Gmail',   color: '#d93025' },
            { value: 'zoho',    label: '🟢 Zoho',    color: '#1b7f3b' },
            { value: 'outlook', label: '🔵 Outlook', color: '#0b5ed7' },
          ].map(tab => {
            const isActive = activeProvider === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setActiveProvider(tab.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: `2px solid ${isActive ? tab.color : 'transparent'}`,
                  background: isActive ? tab.color + '14' : 'transparent',
                  color: isActive ? tab.color : '#64748b',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Date range dropdown */}
        <div ref={dateDropRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDateDrop(v => !v)}
            style={{
              padding: '7px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#f8fafc',
              color: '#374151',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 500,
            }}
          >
            <span>📅</span>
            <span>{selectedDateLabel}</span>
            <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
          </button>

          {showDateDrop && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 38,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
              zIndex: 200,
              minWidth: 210,
              overflow: 'hidden',
            }}>
              {DATE_RANGES.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => {
                    setDateRange(opt.value)
                    if (opt.value !== 'custom') setShowDateDrop(false)
                  }}
                  style={{
                    padding: '9px 15px',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: dateRange === opt.value ? '#2563eb' : '#374151',
                    background: dateRange === opt.value ? '#eff6ff' : 'transparent',
                    fontWeight: dateRange === opt.value ? 600 : 400,
                  }}
                  onMouseEnter={e => {
                    if (dateRange !== opt.value) e.currentTarget.style.background = '#f8fafc'
                  }}
                  onMouseLeave={e => {
                    if (dateRange !== opt.value) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {opt.label}
                </div>
              ))}

              {dateRange === 'custom' && (
                <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                      FROM
                    </label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                      TO
                    </label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <button
                    onClick={() => setShowDateDrop(false)}
                    style={{
                      width: '100%',
                      padding: 7,
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Result count ─────────────────────────────────────────── */}
      {!loading && !error && (
        <div style={{ marginBottom: 12, fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
          {emails.length === 0
            ? 'No emails found'
            : `Showing ${emails.length} email${emails.length !== 1 ? 's' : ''}`}
        </div>
      )}

      {/* ── Email list ───────────────────────────────────────────── */}
      {loading ? (
        <div>
          {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : error ? (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #fecaca',
          color: '#ef4444',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>{error}</div>
          <button
            onClick={fetchHistory}
            style={{
              marginTop: 16,
              padding: '8px 20px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      ) : emails.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '64px 24px',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📭</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            No emails sent yet
          </div>
          <div style={{ fontSize: 13, color: '#64748b', maxWidth: 340, margin: '0 auto' }}>
            Emails you send from the Action Center will appear here, grouped by date.
          </div>
        </div>
      ) : (
        <div>
          {Object.entries(grouped).map(([dateKey, dateEmails]) => (
            <div key={dateKey} style={{ marginBottom: 22 }}>
              {/* Date group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  whiteSpace: 'nowrap',
                }}>
                  {dateKey}
                </span>
                <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
              </div>

              {/* Email items */}
              {dateEmails.map(email => {
                const t = theme(email.provider)
                const isSent = email.status === 'sent'
                const isSelected = selectedEmailId === email.id
                return (
                  <div
                    key={email.id}
                    onClick={() => handleOpenProfile(email)}
                    title="Click to view candidate profile"
                    style={{
                      background: isSelected ? '#eff6ff' : '#fff',
                      border: `1px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                      borderRadius: 10,
                      padding: '13px 18px',
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      cursor: 'pointer',
                      transition: 'box-shadow 0.14s, border-color 0.14s, background 0.14s',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.08)'
                        e.currentTarget.style.borderColor = '#94a3b8'
                        e.currentTarget.style.background = '#f8fafc'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.boxShadow = 'none'
                        e.currentTarget.style.borderColor = '#e2e8f0'
                        e.currentTarget.style.background = '#fff'
                      }
                    }}
                  >
                    {/* Provider colour bar */}
                    <div style={{
                      width: 4,
                      minHeight: 46,
                      borderRadius: 3,
                      background: t.color,
                      flexShrink: 0,
                      alignSelf: 'stretch',
                    }} />

                    {/* Provider dot badge */}
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: t.bg,
                      border: `1px solid ${t.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      flexShrink: 0,
                    }}>
                      {email.provider === 'gmail'   ? '📧'
                       : email.provider === 'zoho'  ? '📨'
                       : email.provider === 'outlook' ? '📬'
                       : '✉️'}
                    </div>

                    {/* Email info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 700,
                        color: '#1e293b',
                        fontSize: 14,
                        marginBottom: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {email.candidate_name || 'Unknown Candidate'}
                      </div>
                      <div style={{
                        color: '#475569',
                        fontSize: 13,
                        marginBottom: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {email.subject || '(No subject)'}
                      </div>
                      <div style={{
                        color: '#94a3b8',
                        fontSize: 11,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        To: {email.recipient_email}
                      </div>
                    </div>

                    {/* Time + status */}
                    <div style={{
                      textAlign: 'right',
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 6,
                    }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {fmtTime(email.sent_at)}
                      </div>
                      <span style={{
                        padding: '3px 9px',
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        background: isSent ? '#dcfce7' : '#fee2e2',
                        color:      isSent ? '#166534' : '#991b1b',
                      }}>
                        {isSent ? '✓ Sent' : '✗ Failed'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── Profile drawer: loading / error state ───────────────── */}
      {profileOpen && !profileCandidate && (
        <RightSlidePanel
          isOpen={profileOpen}
          onClose={closeProfile}
          width="82vw"
          title="Profile Details"
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60vh',
            gap: 16,
          }}>
            {profileLoading ? (
              <>
                <div style={{
                  width: 40,
                  height: 40,
                  border: '4px solid #e2e8f0',
                  borderTopColor: '#2563eb',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <div style={{ color: '#64748b', fontSize: 14 }}>Loading candidate profile…</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40 }}>⚠️</div>
                <div style={{ color: '#ef4444', fontSize: 14, fontWeight: 600 }}>{profileError}</div>
                <button
                  onClick={closeProfile}
                  style={{
                    padding: '8px 22px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </RightSlidePanel>
      )}

      {/* ── Profile drawer: candidate data ──────────────────────── */}
      <ProfileModal
        open={profileOpen && !!profileCandidate}
        onClose={closeProfile}
        candidate={profileCandidate}
        tab={profileTab}
        onTab={setProfileTab}
        hasPrev={false}
        hasNext={false}
      />
    </div>
  )
}
