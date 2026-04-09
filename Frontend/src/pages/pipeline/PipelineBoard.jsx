import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import StageColumn from '../../components/pipeline/StageColumn'
import FeedbackModal from '../../components/pipeline/FeedbackModal'
import CandidateDetailPanel from '../../components/pipeline/CandidateDetailPanel'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchBoard, moveCandidate, addFeedback, addToPipeline,
  fetchPipelineAnalytics, removeFromPipeline,
} from '../../services/pipelineApi'
import {
  fetchInterviews, createInterview, deleteInterview,
  confirmInterview, cancelInterview, completeInterview,
  fetchInterviewAnalytics,
} from '../../services/interviewApi'

const INTERVIEW_TYPES = ['video', 'phone', 'onsite', 'panel', 'technical', 'hr', 'behavioral']
const INT_STATUSES = ['all', 'scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show']
const PLATFORMS = ['zoom', 'teams', 'google_meet', 'webex', 'phone']

const INT_STATUS_COLORS = {
  scheduled: { bg: '#dbeafe', text: '#1d4ed8' },
  confirmed: { bg: '#d1fae5', text: '#059669' },
  completed: { bg: '#e0e7ff', text: '#4338ca' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
  rescheduled: { bg: '#fef3c7', text: '#d97706' },
  no_show: { bg: '#fce7f3', text: '#be185d' },
  in_progress: { bg: '#cffafe', text: '#0891b2' },
}

function IntStatusBadge({ status }) {
  const c = INT_STATUS_COLORS[status] || { bg: '#f1f5f9', text: '#475569' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
      fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
      backgroundColor: c.bg, color: c.text,
    }}>{status}</span>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function PipelineBoard() {
  const { isDark, colors } = useTheme()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialTab = searchParams.get('tab') || 'board'

  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState(initialTab)
  const [analytics, setAnalytics] = useState(null)

  // Interview state
  const [interviews, setInterviews] = useState([])
  const [intLoading, setIntLoading] = useState(false)
  const [intSearch, setIntSearch] = useState('')
  const [intStatusFilter, setIntStatusFilter] = useState('all')
  const [intTypeFilter, setIntTypeFilter] = useState('')
  const [intAnalytics, setIntAnalytics] = useState(null)
  const [intSubTab, setIntSubTab] = useState('list')
  const [showIntCreate, setShowIntCreate] = useState(false)
  const [intForm, setIntForm] = useState({
    candidate_name: '', candidate_email: '', candidate_phone: '',
    job_title: '', interview_type: 'video', round_number: 1,
    round_label: '', scheduled_date: '', duration_minutes: 60,
    meeting_platform: 'zoom', location: '', notes: '', panel_members: [],
  })

  // Modals
  const [feedbackTarget, setFeedbackTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)

  const loadBoard = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchBoard({ search: search || undefined })
      setBoard(data)
    } catch (err) {
      console.error('Failed to load board:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalytics(await fetchPipelineAnalytics())
    } catch (err) {
      console.error('Failed to load analytics:', err)
    }
  }, [])

  useEffect(() => { loadBoard() }, [loadBoard])
  useEffect(() => { if (tab === 'analytics') loadAnalytics() }, [tab, loadAnalytics])

  // ── Interview loaders ──
  const loadInterviews = useCallback(async () => {
    setIntLoading(true)
    try {
      const data = await fetchInterviews({
        search: intSearch || undefined,
        status: intStatusFilter === 'all' ? undefined : intStatusFilter,
        type: intTypeFilter || undefined,
      })
      setInterviews(data)
    } catch (err) { console.error('Failed to load interviews:', err) }
    finally { setIntLoading(false) }
  }, [intSearch, intStatusFilter, intTypeFilter])

  const loadIntAnalytics = useCallback(async () => {
    try { setIntAnalytics(await fetchInterviewAnalytics()) }
    catch (err) { console.error('Failed to load interview analytics:', err) }
  }, [])

  useEffect(() => { if (tab === 'interviews') loadInterviews() }, [tab, loadInterviews])
  useEffect(() => { if (tab === 'interviews' && intSubTab === 'analytics') loadIntAnalytics() }, [tab, intSubTab, loadIntAnalytics])

  const handleIntCreate = async () => {
    try {
      const payload = { ...intForm }
      if (payload.scheduled_date) payload.scheduled_date = new Date(payload.scheduled_date).toISOString()
      await createInterview(payload)
      setShowIntCreate(false)
      setIntForm({ candidate_name: '', candidate_email: '', candidate_phone: '', job_title: '', interview_type: 'video', round_number: 1, round_label: '', scheduled_date: '', duration_minutes: 60, meeting_platform: 'zoom', location: '', notes: '', panel_members: [] })
      loadInterviews()
    } catch (err) {
      console.error('Failed to create interview:', err)
      alert('Failed to schedule interview: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleIntAction = async (id, action) => {
    try {
      if (action === 'confirm') await confirmInterview(id)
      else if (action === 'cancel') await cancelInterview(id, prompt('Cancellation reason?'))
      else if (action === 'complete') {
        const outcome = prompt('Outcome (passed/failed/on_hold/strong_hire/hire/no_hire):')
        const rating = prompt('Rating (1-5):')
        await completeInterview(id, { outcome, rating: rating ? parseInt(rating) : undefined })
      } else if (action === 'delete') {
        if (confirm('Delete this interview?')) await deleteInterview(id)
      }
      loadInterviews()
    } catch (err) { console.error(`Failed to ${action}:`, err) }
  }

  const handleTabChange = (t) => {
    setTab(t)
    setSearchParams(t === 'board' ? {} : { tab: t })
  }

  const handleDrop = async (candidateId, fromStage, toStage) => {
    try {
      await moveCandidate(candidateId, toStage)
      loadBoard()
    } catch (err) {
      console.error('Move failed:', err)
      alert('Failed to move candidate: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleFeedbackSubmit = async (data) => {
    if (!feedbackTarget) return
    try {
      await addFeedback(feedbackTarget.id, data)
      setFeedbackTarget(null)
      loadBoard()
    } catch (err) {
      console.error('Feedback failed:', err)
      alert('Failed to submit feedback')
    }
  }

  const cardStyle = {
    backgroundColor: isDark ? colors.card : '#ffffff',
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    padding: '20px',
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', backgroundColor: colors.background }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: colors.text, margin: 0 }}>
            Interview Pipeline
          </h1>
          <p style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '13px', marginTop: '4px' }}>
            Drag and drop candidates across stages to track their progress
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {board && (
            <span style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>
              {board.total_candidates} candidate{board.total_candidates !== 1 ? 's' : ''} in pipeline
            </span>
          )}
          {isAdmin && (
            <button onClick={() => navigate('/pipeline/settings')} style={{
              padding: '8px 16px', borderRadius: '8px', border: `1px solid ${colors.border}`,
              backgroundColor: 'transparent', color: '#6366f1', fontWeight: 600, cursor: 'pointer', fontSize: '13px',
            }}>Configure Stages</button>
          )}
          <button onClick={loadBoard} style={{
            padding: '8px 16px', borderRadius: '8px', border: `1px solid ${colors.border}`,
            backgroundColor: 'transparent', color: colors.text, fontWeight: 600, cursor: 'pointer', fontSize: '13px',
          }}>Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '12px 24px 0', borderBottom: `1px solid ${colors.border}` }}>
        {['board', 'interviews', 'analytics'].map(t => (
          <button key={t} onClick={() => handleTabChange(t)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
            borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
            color: tab === t ? '#6366f1' : (isDark ? '#94a3b8' : '#64748b'),
            backgroundColor: 'transparent', textTransform: 'capitalize',
          }}>{t === 'board' ? 'Pipeline Board' : t === 'interviews' ? 'Interviews' : 'Analytics'}</button>
        ))}
      </div>

      {tab === 'board' && (
        <>
          {/* Search bar */}
          <div style={{ padding: '16px 24px' }}>
            <input
              type="text" placeholder="Search candidates in pipeline..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', maxWidth: '400px', padding: '8px 14px', borderRadius: '8px',
                border: `1px solid ${colors.border}`, backgroundColor: isDark ? colors.card : '#fff',
                color: colors.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Kanban Board */}
          <div style={{
            padding: '0 24px 24px',
            overflowX: 'auto',
          }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: isDark ? '#64748b' : '#94a3b8' }}>Loading pipeline...</div>
            ) : !board ? (
              <div style={{ padding: '60px', textAlign: 'center', color: isDark ? '#64748b' : '#94a3b8' }}>Failed to load pipeline</div>
            ) : (
              <div style={{
                display: 'flex',
                gap: '12px',
                minWidth: 'max-content',
                paddingBottom: '16px',
              }}>
                {board.columns.map(col => (
                  <StageColumn
                    key={col.stage}
                    stage={col.stage}
                    label={col.label}
                    candidates={col.candidates}
                    count={col.count}
                    onDrop={handleDrop}
                    onCandidateClick={(c) => setDetailTarget(c.id)}
                    onFeedback={(c) => setFeedbackTarget(c)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'analytics' && analytics && (
        <div style={{ padding: '24px' }}>
          {/* Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#6366f1' }}>{analytics.total_in_pipeline}</div>
              <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>In Pipeline</div>
            </div>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#10b981' }}>{analytics.avg_score ? Math.round(analytics.avg_score) : '—'}</div>
              <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>Avg Score</div>
            </div>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#3b82f6' }}>{analytics.by_stage.offer || 0}</div>
              <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>In Offer Stage</div>
            </div>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#059669' }}>{analytics.by_stage.onboarding_completed || 0}</div>
              <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>Onboarded</div>
            </div>
          </div>

          {/* Conversion funnel */}
          <div style={{ ...cardStyle, marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.text, marginBottom: '16px' }}>Conversion Funnel</h3>
            {Object.entries(analytics.conversion_rates).map(([stage, pct]) => (
              <div key={stage} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b', textTransform: 'capitalize' }}>
                    {stage.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontWeight: 600, color: colors.text }}>{pct}%</span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                  <div style={{
                    height: '100%', borderRadius: '4px', width: `${pct}%`,
                    backgroundColor: pct >= 80 ? '#10b981' : pct >= 50 ? '#3b82f6' : pct >= 20 ? '#f59e0b' : '#ef4444',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* By ranking */}
          {Object.keys(analytics.by_ranking).length > 0 && (
            <div style={{ ...cardStyle }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.text, marginBottom: '12px' }}>By Ranking</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {Object.entries(analytics.by_ranking).map(([rank, count]) => (
                  <div key={rank} style={{
                    padding: '8px 16px', borderRadius: '10px',
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    border: `1px solid ${colors.border}`,
                  }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: colors.text }}>{count}</div>
                    <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', textTransform: 'capitalize' }}>
                      {rank.replace(/_/g, ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Interviews Tab ── */}
      {tab === 'interviews' && (
        <div style={{ padding: '24px' }}>
          {/* Sub-header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['list', 'analytics'].map(st => (
                <button key={st} onClick={() => setIntSubTab(st)} style={{
                  padding: '6px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                  borderRadius: '6px',
                  backgroundColor: intSubTab === st ? '#6366f1' : 'transparent',
                  color: intSubTab === st ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
                }}>{st === 'list' ? 'All Interviews' : 'Analytics'}</button>
              ))}
            </div>
            <button onClick={() => setShowIntCreate(true)} style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: '#6366f1', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}>+ Schedule Interview</button>
          </div>

          {intSubTab === 'list' && (
            <>
              {/* Filters */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Search candidate, email, job..." value={intSearch}
                  onChange={e => setIntSearch(e.target.value)}
                  style={{
                    flex: 1, minWidth: '200px', padding: '8px 14px', borderRadius: '8px',
                    border: `1px solid ${colors.border}`, backgroundColor: isDark ? colors.card : '#fff',
                    color: colors.text, fontSize: '14px', outline: 'none',
                  }} />
                <select value={intStatusFilter} onChange={e => setIntStatusFilter(e.target.value)} style={{
                  padding: '8px 14px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                  backgroundColor: isDark ? colors.card : '#fff', color: colors.text, fontSize: '14px',
                }}>
                  {INT_STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
                </select>
                <select value={intTypeFilter} onChange={e => setIntTypeFilter(e.target.value)} style={{
                  padding: '8px 14px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                  backgroundColor: isDark ? colors.card : '#fff', color: colors.text, fontSize: '14px',
                }}>
                  <option value="">All Types</option>
                  {INTERVIEW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Table */}
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                {intLoading ? (
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
                            <div>{fmtDate(iv.scheduled_date)}</div>
                            <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8' }}>{fmtTime(iv.scheduled_date)}</div>
                          </td>
                          <td style={{ padding: '12px 16px', color: colors.text }}>{iv.duration_minutes}m</td>
                          <td style={{ padding: '12px 16px' }}><IntStatusBadge status={iv.status} /></td>
                          <td style={{ padding: '12px 16px', color: colors.text }}>{iv.overall_rating ? `${iv.overall_rating}/5` : '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {iv.status === 'scheduled' && (
                                <button onClick={() => handleIntAction(iv.id, 'confirm')} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #059669', backgroundColor: 'transparent', color: '#059669', fontSize: '11px', cursor: 'pointer' }}>Confirm</button>
                              )}
                              {['scheduled','confirmed','rescheduled'].includes(iv.status) && (
                                <button onClick={() => handleIntAction(iv.id, 'complete')} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #6366f1', backgroundColor: 'transparent', color: '#6366f1', fontSize: '11px', cursor: 'pointer' }}>Complete</button>
                              )}
                              {['scheduled','confirmed','rescheduled'].includes(iv.status) && (
                                <button onClick={() => handleIntAction(iv.id, 'cancel')} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                              )}
                              {isAdmin && (
                                <button onClick={() => handleIntAction(iv.id, 'delete')} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: '#ef4444', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Del</button>
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

          {intSubTab === 'analytics' && intAnalytics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {[
                { label: 'Total Interviews', value: intAnalytics.total_interviews, color: '#6366f1' },
                { label: 'Scheduled', value: intAnalytics.scheduled, color: '#3b82f6' },
                { label: 'Completed', value: intAnalytics.completed, color: '#059669' },
                { label: 'Cancelled', value: intAnalytics.cancelled, color: '#ef4444' },
                { label: 'No Show', value: intAnalytics.no_show, color: '#d97706' },
                { label: 'Avg Rating', value: intAnalytics.avg_rating ? `${intAnalytics.avg_rating}/5` : 'N/A', color: '#8b5cf6' },
                { label: 'Pass Rate', value: intAnalytics.pass_rate ? `${intAnalytics.pass_rate}%` : 'N/A', color: '#10b981' },
                { label: 'This Week', value: intAnalytics.interviews_this_week, color: '#0891b2' },
              ].map(card => (
                <div key={card.label} style={{ ...cardStyle, textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '4px' }}>{card.label}</div>
                </div>
              ))}
              {intAnalytics.interviewer_load?.length > 0 && (
                <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.text, marginBottom: '12px' }}>Interviewer Load</h3>
                  {intAnalytics.interviewer_load.map((il, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
                      <span style={{ color: colors.text, fontSize: '13px' }}>{il.name}</span>
                      <span style={{ color: '#6366f1', fontWeight: 600, fontSize: '13px' }}>{il.count} interviews</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Interview Create Modal */}
      {showIntCreate && (
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
                  <input type={f.type} value={intForm[f.key]}
                    onChange={e => setIntForm(p => ({ ...p, [f.key]: f.type === 'number' ? parseInt(e.target.value) || '' : e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: isDark ? '#0f172a' : '#fff', color: colors.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>Type</label>
                <select value={intForm.interview_type} onChange={e => setIntForm(p => ({ ...p, interview_type: e.target.value }))} style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                  backgroundColor: isDark ? '#0f172a' : '#fff', color: colors.text, fontSize: '14px',
                }}>{INTERVIEW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>Platform</label>
                <select value={intForm.meeting_platform} onChange={e => setIntForm(p => ({ ...p, meeting_platform: e.target.value }))} style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                  backgroundColor: isDark ? '#0f172a' : '#fff', color: colors.text, fontSize: '14px',
                }}>{PLATFORMS.map(p => <option key={p} value={p}>{p.replace('_',' ')}</option>)}</select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>Notes</label>
                <textarea value={intForm.notes} onChange={e => setIntForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: isDark ? '#0f172a' : '#fff', color: colors.text, fontSize: '14px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowIntCreate(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.text, fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={handleIntCreate} disabled={!intForm.candidate_name || !intForm.scheduled_date} style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                backgroundColor: !intForm.candidate_name || !intForm.scheduled_date ? '#94a3b8' : '#6366f1',
                color: '#fff', fontWeight: 600, cursor: !intForm.candidate_name || !intForm.scheduled_date ? 'not-allowed' : 'pointer', fontSize: '14px',
              }}>Schedule Interview</button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackTarget && (
        <FeedbackModal
          candidate={feedbackTarget}
          stage={feedbackTarget.current_stage}
          onSubmit={handleFeedbackSubmit}
          onClose={() => setFeedbackTarget(null)}
        />
      )}

      {/* Detail Panel (slide-in) */}
      {detailTarget && (
        <CandidateDetailPanel
          candidateId={detailTarget}
          onClose={() => { setDetailTarget(null); loadBoard() }}
        />
      )}
    </div>
  )
}
