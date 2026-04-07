import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import StageColumn from '../../components/pipeline/StageColumn'
import FeedbackModal from '../../components/pipeline/FeedbackModal'
import CandidateDetailPanel from '../../components/pipeline/CandidateDetailPanel'
import { useNavigate } from 'react-router-dom'
import {
  fetchBoard, moveCandidate, addFeedback, addToPipeline,
  fetchPipelineAnalytics, removeFromPipeline,
} from '../../services/pipelineApi'

export default function PipelineBoard() {
  const { isDark, colors } = useTheme()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('board')
  const [analytics, setAnalytics] = useState(null)

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
        {['board', 'analytics'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
            borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
            color: tab === t ? '#6366f1' : (isDark ? '#94a3b8' : '#64748b'),
            backgroundColor: 'transparent', textTransform: 'capitalize',
          }}>{t === 'board' ? 'Pipeline Board' : 'Analytics'}</button>
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
