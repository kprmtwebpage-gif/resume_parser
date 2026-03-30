import { useState, useEffect } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { fetchPipelineCandidate, updateFeedback, deleteFeedback } from '../../services/pipelineApi'
import { RANKING_BADGES } from './StageColumn'

const STAGE_LABELS = {
  screening: 'Screening', written_test: 'Written Test',
  level_1: 'Level 1', level_2: 'Level 2', level_3: 'Level 3',
  offer: 'Offer', onboarding_initiated: 'Onboarding Init', onboarding_completed: 'Onboarding Done',
}

function ScoreBar({ label, value, max = 5 }) {
  const { isDark } = useTheme()
  const pct = value ? (value / max) * 100 : 0
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
        <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{label}</span>
        <span style={{ fontWeight: 600, color }}>{value ? `${value.toFixed(1)}/5` : 'N/A'}</span>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
        <div style={{ height: '100%', borderRadius: '3px', backgroundColor: color, width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

export default function CandidateDetailPanel({ candidateId, onClose }) {
  const { isDark, colors } = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('scorecard')

  useEffect(() => {
    if (!candidateId) return
    setLoading(true)
    fetchPipelineCandidate(candidateId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [candidateId])

  if (!candidateId) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        width: '520px', height: '100%', backgroundColor: isDark ? '#1e293b' : '#fff',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.15)', overflowY: 'auto',
        animation: 'slideInRight 0.25s ease',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: isDark ? '#64748b' : '#94a3b8' }}>Loading...</div>
        ) : !data ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Not found</div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.text, margin: 0 }}>{data.candidate_name}</h2>
                <p style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                  {data.candidate_email} {data.job_title && `• ${data.job_title}`}
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px',
                    backgroundColor: '#dbeafe', color: '#1d4ed8', textTransform: 'uppercase',
                  }}>{STAGE_LABELS[data.current_stage] || data.current_stage}</span>
                  {data.ranking && RANKING_BADGES[data.ranking] && (
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px',
                      backgroundColor: RANKING_BADGES[data.ranking].bg,
                      color: RANKING_BADGES[data.ranking].color,
                    }}>{RANKING_BADGES[data.ranking].icon} {RANKING_BADGES[data.ranking].label}</span>
                  )}
                  {data.overall_score != null && (
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#6366f1' }}>
                      Score: {Math.round(data.overall_score)}/100
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onClose} style={{
                width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                backgroundColor: 'transparent', color: colors.text, fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
              {['scorecard', 'feedback', 'history'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: '12px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
                  color: tab === t ? '#6366f1' : (isDark ? '#94a3b8' : '#64748b'),
                  backgroundColor: 'transparent', textTransform: 'capitalize',
                }}>{t}</button>
              ))}
            </div>

            {/* Content */}
            <div style={{ padding: '20px 24px' }}>
              {tab === 'scorecard' && data.scorecard && (
                <>
                  {/* Big score circle */}
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{
                      width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '24px', fontWeight: 800,
                      backgroundColor: data.scorecard.final_score >= 80 ? '#dcfce7' : data.scorecard.final_score >= 60 ? '#dbeafe' : data.scorecard.final_score >= 40 ? '#fef3c7' : '#fee2e2',
                      color: data.scorecard.final_score >= 80 ? '#166534' : data.scorecard.final_score >= 60 ? '#1e40af' : data.scorecard.final_score >= 40 ? '#92400e' : '#991b1b',
                    }}>
                      {data.scorecard.final_score ? Math.round(data.scorecard.final_score) : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: isDark ? '#64748b' : '#9ca3af' }}>
                      {data.scorecard.review_count} review(s) • {data.scorecard.stages_completed} stage(s)
                    </div>
                  </div>

                  <ScoreBar label="Technical" value={data.scorecard.technical_avg} />
                  <ScoreBar label="Communication" value={data.scorecard.communication_avg} />
                  <ScoreBar label="Problem Solving" value={data.scorecard.problem_solving_avg} />
                  <ScoreBar label="Cultural Fit" value={data.scorecard.cultural_fit_avg} />
                  <ScoreBar label="Overall" value={data.scorecard.overall_avg} />
                </>
              )}

              {tab === 'scorecard' && !data.scorecard && (
                <div style={{ textAlign: 'center', padding: '30px', color: isDark ? '#64748b' : '#9ca3af', fontSize: '13px' }}>
                  No scorecard yet. Add feedback to generate scores.
                </div>
              )}

              {tab === 'feedback' && (
                data.feedback_entries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: isDark ? '#64748b' : '#9ca3af', fontSize: '13px' }}>No feedback yet. Click "+ Feedback" on the candidate card to add.</div>
                ) : data.feedback_entries.map(fb => (
                  <div key={fb.id} style={{
                    border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '14px', marginBottom: '10px',
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: colors.text }}>{fb.reviewer_name}</span>
                        <span style={{ fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginLeft: '8px' }}>
                          {(fb.stage || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {fb.overall_rating && (
                          <span style={{ fontWeight: 700, fontSize: '13px', color: fb.overall_rating >= 4 ? '#10b981' : fb.overall_rating >= 3 ? '#3b82f6' : '#ef4444' }}>
                            {fb.overall_rating}/5
                          </span>
                        )}
                        <button onClick={async () => {
                          const newComment = prompt('Edit comments:', fb.comments || '')
                          if (newComment !== null) {
                            const newRating = prompt('Edit overall rating (1-5):', fb.overall_rating || '')
                            await updateFeedback(fb.id, {
                              comments: newComment,
                              overall_rating: newRating ? parseInt(newRating) : fb.overall_rating
                            })
                            fetchPipelineCandidate(candidateId).then(setData)
                          }
                        }} style={{
                          fontSize: '10px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer',
                          border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`, backgroundColor: 'transparent',
                          color: '#3b82f6',
                        }}>Edit</button>
                        <button onClick={async () => {
                          if (confirm('Delete this feedback?')) {
                            await deleteFeedback(fb.id)
                            fetchPipelineCandidate(candidateId).then(setData)
                          }
                        }} style={{
                          fontSize: '10px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer',
                          border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`, backgroundColor: 'transparent',
                          color: '#ef4444',
                        }}>Del</button>
                      </div>
                    </div>
                    {fb.recommendation && (
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#6366f1', marginBottom: '6px', textTransform: 'capitalize' }}>
                        {fb.recommendation.replace(/_/g, ' ')}
                      </div>
                    )}
                    {fb.strengths && <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0' }}>+ {fb.strengths}</p>}
                    {fb.weaknesses && <p style={{ fontSize: '12px', color: '#ef4444', margin: '4px 0' }}>- {fb.weaknesses}</p>}
                    {fb.comments && <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', margin: '4px 0' }}>{fb.comments}</p>}
                    <div style={{ fontSize: '10px', color: isDark ? '#475569' : '#cbd5e1', marginTop: '6px' }}>
                      {new Date(fb.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}

              {tab === 'history' && (
                data.stage_history.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: isDark ? '#64748b' : '#9ca3af', fontSize: '13px' }}>No history yet.</div>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: '20px' }}>
                    {/* Timeline line */}
                    <div style={{ position: 'absolute', left: '6px', top: '6px', bottom: '6px', width: '2px', backgroundColor: isDark ? '#334155' : '#e5e7eb' }} />
                    {data.stage_history.map((h, i) => (
                      <div key={h.id} style={{ position: 'relative', marginBottom: '16px', paddingLeft: '16px' }}>
                        <div style={{
                          position: 'absolute', left: '-14px', top: '4px', width: '10px', height: '10px', borderRadius: '50%',
                          backgroundColor: h.action === 'added' ? '#6366f1' : h.action === 'failed' ? '#ef4444' : '#10b981',
                          border: `2px solid ${isDark ? '#1e293b' : '#fff'}`,
                        }} />
                        <div style={{ fontSize: '12px', fontWeight: 600, color: colors.text }}>
                          {h.from_stage ? `${STAGE_LABELS[h.from_stage] || h.from_stage} → ` : ''}
                          {STAGE_LABELS[h.to_stage] || h.to_stage}
                          <span style={{ fontWeight: 400, color: isDark ? '#64748b' : '#9ca3af', marginLeft: '6px' }}>({h.action})</span>
                        </div>
                        {h.notes && <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '2px' }}>{h.notes}</div>}
                        <div style={{ fontSize: '10px', color: isDark ? '#475569' : '#cbd5e1', marginTop: '2px' }}>
                          {h.moved_by && `by ${h.moved_by} • `}{new Date(h.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
