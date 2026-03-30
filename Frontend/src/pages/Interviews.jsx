import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchInterviews, createInterview, updateInterview, deleteInterview,
  confirmInterview, cancelInterview, completeInterview, rescheduleInterview,
  fetchInterviewAnalytics,
} from '../services/interviewApi'

const INTERVIEW_TYPES = ['video', 'phone', 'onsite', 'panel', 'technical', 'hr', 'behavioral']
const STATUSES = ['all', 'scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show']
const PLATFORMS = ['zoom', 'teams', 'google_meet', 'webex', 'phone']
const OUTCOMES = ['passed', 'failed', 'on_hold', 'strong_hire', 'hire', 'no_hire']

const STATUS_COLORS = {
  scheduled: { bg: '#dbeafe', text: '#1d4ed8' },
  confirmed: { bg: '#d1fae5', text: '#059669' },
  completed: { bg: '#e0e7ff', text: '#4338ca' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
  rescheduled: { bg: '#fef3c7', text: '#d97706' },
  no_show: { bg: '#fce7f3', text: '#be185d' },
  in_progress: { bg: '#cffafe', text: '#0891b2' },
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: '#f1f5f9', text: '#475569' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
      fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
      backgroundColor: c.bg, color: c.text,
    }}>{status}</span>
  )
}

function formatDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function Interviews() {
  const { isDark, colors } = useTheme()
  const { isAdmin } = useAuth()

  const [interviews, setInterviews] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [tab, setTab] = useState('list')

  // Create form state
  const [form, setForm] = useState({
    candidate_name: '', candidate_email: '', candidate_phone: '',
    job_title: '', interview_type: 'video', round_number: 1,
    round_label: '', scheduled_date: '', duration_minutes: 60,
    meeting_platform: 'zoom', location: '', notes: '',
    panel_members: [],
  })

  const loadInterviews = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchInterviews({
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter || undefined,
      })
      setInterviews(data)
    } catch (err) {
      console.error('Failed to load interviews:', err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, typeFilter])

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await fetchInterviewAnalytics()
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to load analytics:', err)
    }
  }, [])

  useEffect(() => { loadInterviews() }, [loadInterviews])
  useEffect(() => { if (tab === 'analytics') loadAnalytics() }, [tab, loadAnalytics])

  const handleCreate = async () => {
    try {
      const payload = { ...form }
      if (payload.scheduled_date) {
        payload.scheduled_date = new Date(payload.scheduled_date).toISOString()
      }
      await createInterview(payload)
      setShowCreate(false)
      setForm({
        candidate_name: '', candidate_email: '', candidate_phone: '',
        job_title: '', interview_type: 'video', round_number: 1,
        round_label: '', scheduled_date: '', duration_minutes: 60,
        meeting_platform: 'zoom', location: '', notes: '', panel_members: [],
      })
      loadInterviews()
    } catch (err) {
      console.error('Failed to create interview:', err)
      alert('Failed to schedule interview: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleAction = async (id, action, extraParams) => {
    try {
      if (action === 'confirm') await confirmInterview(id)
      else if (action === 'cancel') await cancelInterview(id, prompt('Cancellation reason?'))
      else if (action === 'complete') {
        const outcome = prompt('Outcome (passed/failed/on_hold/strong_hire/hire/no_hire):')
        const rating = prompt('Rating (1-5):')
        await completeInterview(id, { outcome, rating: rating ? parseInt(rating) : undefined })
      }
      else if (action === 'delete') {
        if (confirm('Delete this interview?')) await deleteInterview(id)
      }
      loadInterviews()
    } catch (err) {
      console.error(`Failed to ${action}:`, err)
    }
  }

  const cardStyle = {
    backgroundColor: isDark ? colors.card : '#ffffff',
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    padding: '20px',
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', backgroundColor: colors.background, padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: colors.text, margin: 0 }}>
            Interview Scheduling
          </h1>
          <p style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '14px', marginTop: '4px' }}>
            Schedule, track, and manage candidate interviews
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '10px 20px', borderRadius: '8px', border: 'none',
            backgroundColor: '#6366f1', color: '#fff', fontWeight: 600,
            fontSize: '14px', cursor: 'pointer',
          }}
        >+ Schedule Interview</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '0' }}>
        {['list', 'analytics'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
            borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
            color: tab === t ? '#6366f1' : (isDark ? '#94a3b8' : '#64748b'),
            backgroundColor: 'transparent',
          }}>{t === 'list' ? 'All Interviews' : 'Analytics'}</button>
        ))}
      </div>

      {tab === 'list' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input
              type="text" placeholder="Search candidate, email, job..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, minWidth: '200px', padding: '8px 14px', borderRadius: '8px',
                border: `1px solid ${colors.border}`, backgroundColor: isDark ? colors.card : '#fff',
                color: colors.text, fontSize: '14px', outline: 'none',
              }}
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
              padding: '8px 14px', borderRadius: '8px', border: `1px solid ${colors.border}`,
              backgroundColor: isDark ? colors.card : '#fff', color: colors.text, fontSize: '14px',
            }}>
              {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{
              padding: '8px 14px', borderRadius: '8px', border: `1px solid ${colors.border}`,
              backgroundColor: isDark ? colors.card : '#fff', color: colors.text, fontSize: '14px',
            }}>
              <option value="">All Types</option>
              {INTERVIEW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Table */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>Loading...</div>
            ) : interviews.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>
                No interviews found. Click "Schedule Interview" to create one.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.border}`, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }}>
                    {['Candidate', 'Job Title', 'Type', 'Round', 'Date & Time', 'Duration', 'Status', 'Rating', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {interviews.map(iv => (
                    <tr key={iv.id} style={{ borderBottom: `1px solid ${colors.border}` }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '12px 16px', color: colors.text }}>
                        <div style={{ fontWeight: 600 }}>{iv.candidate_name}</div>
                        <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8' }}>{iv.candidate_email}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: colors.text }}>{iv.job_title || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', backgroundColor: isDark ? '#334155' : '#f1f5f9', color: colors.text }}>{iv.interview_type}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: colors.text }}>R{iv.round_number}</td>
                      <td style={{ padding: '12px 16px', color: colors.text }}>
                        <div>{formatDate(iv.scheduled_date)}</div>
                        <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8' }}>{formatTime(iv.scheduled_date)}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: colors.text }}>{iv.duration_minutes}m</td>
                      <td style={{ padding: '12px 16px' }}><StatusBadge status={iv.status} /></td>
                      <td style={{ padding: '12px 16px', color: colors.text }}>{iv.overall_rating ? `${iv.overall_rating}/5` : '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {iv.status === 'scheduled' && (
                            <button onClick={() => handleAction(iv.id, 'confirm')} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #059669', backgroundColor: 'transparent', color: '#059669', fontSize: '11px', cursor: 'pointer' }}>Confirm</button>
                          )}
                          {['scheduled','confirmed','rescheduled'].includes(iv.status) && (
                            <button onClick={() => handleAction(iv.id, 'complete')} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #6366f1', backgroundColor: 'transparent', color: '#6366f1', fontSize: '11px', cursor: 'pointer' }}>Complete</button>
                          )}
                          {['scheduled','confirmed','rescheduled'].includes(iv.status) && (
                            <button onClick={() => handleAction(iv.id, 'cancel')} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                          )}
                          {isAdmin && (
                            <button onClick={() => handleAction(iv.id, 'delete')} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: '#ef4444', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Del</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'analytics' && analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[
            { label: 'Total Interviews', value: analytics.total_interviews, color: '#6366f1' },
            { label: 'Scheduled', value: analytics.scheduled, color: '#3b82f6' },
            { label: 'Completed', value: analytics.completed, color: '#059669' },
            { label: 'Cancelled', value: analytics.cancelled, color: '#ef4444' },
            { label: 'No Show', value: analytics.no_show, color: '#d97706' },
            { label: 'Avg Rating', value: analytics.avg_rating ? `${analytics.avg_rating}/5` : 'N/A', color: '#8b5cf6' },
            { label: 'Pass Rate', value: analytics.pass_rate ? `${analytics.pass_rate}%` : 'N/A', color: '#10b981' },
            { label: 'This Week', value: analytics.interviews_this_week, color: '#0891b2' },
          ].map(card => (
            <div key={card.label} style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '4px' }}>{card.label}</div>
            </div>
          ))}

          {analytics.interviewer_load?.length > 0 && (
            <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.text, marginBottom: '12px' }}>Interviewer Load</h3>
              {analytics.interviewer_load.map((il, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
                  <span style={{ color: colors.text, fontSize: '13px' }}>{il.name}</span>
                  <span style={{ color: '#6366f1', fontWeight: 600, fontSize: '13px' }}>{il.count} interviews</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: colors.text, marginBottom: '20px' }}>Schedule Interview</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { key: 'candidate_name', label: 'Candidate Name *', type: 'text', span: 2 },
                { key: 'candidate_email', label: 'Email', type: 'email' },
                { key: 'candidate_phone', label: 'Phone', type: 'text' },
                { key: 'job_title', label: 'Job Title', type: 'text', span: 2 },
                { key: 'scheduled_date', label: 'Date & Time *', type: 'datetime-local' },
                { key: 'duration_minutes', label: 'Duration (min)', type: 'number' },
                { key: 'round_number', label: 'Round #', type: 'number' },
                { key: 'round_label', label: 'Round Label', type: 'text' },
                { key: 'location', label: 'Location (for onsite)', type: 'text', span: 2 },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.span === 2 ? 'span 2' : undefined }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>{f.label}</label>
                  <input
                    type={f.type} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? parseInt(e.target.value) || '' : e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '8px',
                      border: `1px solid ${colors.border}`, backgroundColor: isDark ? '#0f172a' : '#fff',
                      color: colors.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>Type</label>
                <select value={form.interview_type} onChange={e => setForm(p => ({ ...p, interview_type: e.target.value }))} style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                  backgroundColor: isDark ? '#0f172a' : '#fff', color: colors.text, fontSize: '14px',
                }}>
                  {INTERVIEW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>Platform</label>
                <select value={form.meeting_platform} onChange={e => setForm(p => ({ ...p, meeting_platform: e.target.value }))} style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                  backgroundColor: isDark ? '#0f172a' : '#fff', color: colors.text, fontSize: '14px',
                }}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p.replace('_',' ')}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3} style={{
                    width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                    backgroundColor: isDark ? '#0f172a' : '#fff', color: colors.text, fontSize: '14px',
                    resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={{
                padding: '10px 20px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                backgroundColor: 'transparent', color: colors.text, fontWeight: 600, cursor: 'pointer', fontSize: '14px',
              }}>Cancel</button>
              <button onClick={handleCreate} disabled={!form.candidate_name || !form.scheduled_date} style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                backgroundColor: !form.candidate_name || !form.scheduled_date ? '#94a3b8' : '#6366f1',
                color: '#fff', fontWeight: 600, cursor: !form.candidate_name || !form.scheduled_date ? 'not-allowed' : 'pointer', fontSize: '14px',
              }}>Schedule Interview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
