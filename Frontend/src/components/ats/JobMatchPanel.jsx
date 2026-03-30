import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { analyzeJob, fetchMatches, fetchMatchSummary, toggleShortlist } from '../../services/atsApi'

const TIER_COLORS = {
  best_match:    { bg: '#dcfce7', color: '#166534', label: 'Best Match', icon: '★' },
  good_match:    { bg: '#dbeafe', color: '#1e40af', label: 'Good Match', icon: '●' },
  partial_match: { bg: '#fef3c7', color: '#92400e', label: 'Partial', icon: '◐' },
  low_match:     { bg: '#fee2e2', color: '#991b1b', label: 'Low Match', icon: '○' },
}

function ScoreBadge({ score }) {
  const bg = score >= 80 ? '#dcfce7' : score >= 60 ? '#dbeafe' : score >= 40 ? '#fef3c7' : '#fee2e2'
  const color = score >= 80 ? '#166534' : score >= 60 ? '#1e40af' : score >= 40 ? '#92400e' : '#991b1b'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
      fontSize: '12px', fontWeight: 700, backgroundColor: bg, color,
    }}>{Math.round(score)}%</span>
  )
}

function MiniBar({ label, value, max = 100 }) {
  const { isDark } = useTheme()
  const pct = Math.round((value / max) * 100)
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: isDark ? '#64748b' : '#9ca3af', marginBottom: '2px' }}>
        <span>{label}</span><span style={{ fontWeight: 600, color }}>{pct}%</span>
      </div>
      <div style={{ height: '4px', borderRadius: '2px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
        <div style={{ height: '100%', borderRadius: '2px', backgroundColor: color, width: `${pct}%`, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

export default function JobMatchPanel({ jobId, jobTitle, onClose }) {
  const { isDark, colors } = useTheme()
  const [matches, setMatches] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [tierFilter, setTierFilter] = useState('')
  const [tab, setTab] = useState('results')

  const loadResults = useCallback(async () => {
    setLoading(true)
    try {
      const [m, s] = await Promise.all([
        fetchMatches(jobId, { tier: tierFilter || undefined }),
        fetchMatchSummary(jobId),
      ])
      setMatches(m)
      setSummary(s)
    } catch (err) {
      console.error('Failed to load matches:', err)
    } finally {
      setLoading(false)
    }
  }, [jobId, tierFilter])

  useEffect(() => { loadResults() }, [loadResults])

  const handleAnalyze = async (force = false) => {
    setAnalyzing(true)
    try {
      await analyzeJob(jobId, force)
      await loadResults()
    } catch (err) {
      alert('Analysis failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setAnalyzing(false)
    }
  }

  const handleShortlist = async (matchId) => {
    try {
      await toggleShortlist(matchId)
      loadResults()
    } catch (err) {
      console.error('Shortlist failed:', err)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        width: '720px', height: '100%', backgroundColor: isDark ? '#0f172a' : '#fff',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.text, margin: 0 }}>Candidate Matching</h2>
              <p style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>{jobTitle}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleAnalyze(true)} disabled={analyzing} style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: analyzing ? '#94a3b8' : '#6366f1', color: '#fff',
                fontWeight: 600, fontSize: '13px', cursor: analyzing ? 'wait' : 'pointer',
              }}>{analyzing ? 'Analyzing...' : 'Re-Analyze'}</button>
              <button onClick={onClose} style={{
                width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                backgroundColor: 'transparent', color: colors.text, fontSize: '18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>
          </div>

          {/* Summary cards */}
          {summary && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
              {[
                { label: 'Total', value: summary.total_candidates, color: '#6366f1' },
                { label: 'Best', value: summary.best_matches, color: '#10b981' },
                { label: 'Good', value: summary.good_matches, color: '#3b82f6' },
                { label: 'Partial', value: summary.partial_matches, color: '#f59e0b' },
                { label: 'Applied', value: summary.applied, color: '#8b5cf6' },
                { label: 'Shortlisted', value: summary.shortlisted, color: '#059669' },
              ].map(c => (
                <div key={c.label} style={{
                  padding: '8px 14px', borderRadius: '10px', textAlign: 'center',
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc', border: `1px solid ${colors.border}`,
                  flex: '1 1 80px',
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#9ca3af' }}>{c.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div style={{ padding: '10px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', gap: '6px', flexShrink: 0 }}>
          {['', 'best_match', 'good_match', 'partial_match', 'low_match'].map(t => {
            const tc = TIER_COLORS[t]
            return (
              <button key={t} onClick={() => setTierFilter(t)} style={{
                padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                border: tierFilter === t ? '2px solid #6366f1' : `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
                backgroundColor: tierFilter === t ? (isDark ? '#312e81' : '#eef2ff') : 'transparent',
                color: tierFilter === t ? '#6366f1' : (isDark ? '#94a3b8' : '#6b7280'),
              }}>{t ? (tc?.label || t) : 'All'}</button>
            )
          })}
        </div>

        {/* Results list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#64748b' : '#94a3b8' }}>Loading matches...</div>
          ) : matches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
                {summary?.total_candidates === 0 ? 'No analysis results yet.' : 'No matches for this filter.'}
              </p>
              {summary?.total_candidates === 0 && (
                <button onClick={() => handleAnalyze(true)} disabled={analyzing} style={{
                  padding: '10px 24px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer',
                }}>{analyzing ? 'Analyzing...' : 'Analyze Profiles Now'}</button>
              )}
            </div>
          ) : (
            matches.map(m => {
              const tc = TIER_COLORS[m.match_tier] || TIER_COLORS.low_match
              return (
                <div key={m.id} style={{
                  border: `1px solid ${m.match_tier === 'best_match' ? '#86efac' : colors.border}`,
                  borderRadius: '10px', padding: '14px', marginBottom: '10px',
                  backgroundColor: m.match_tier === 'best_match' ? (isDark ? '#052e16' : '#f0fdf4') : (isDark ? '#1e293b' : '#fff'),
                  transition: 'all 0.15s',
                }}>
                  {/* Top row: name + score + actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <ScoreBadge score={m.overall_score} />
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: colors.text }}>{m.candidate_name}</span>
                        {m.is_applied && <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '6px', backgroundColor: '#e0e7ff', color: '#4338ca', marginLeft: '6px' }}>APPLIED</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', backgroundColor: tc.bg, color: tc.color }}>
                        {tc.icon} {tc.label}
                      </span>
                      <button onClick={() => handleShortlist(m.id)} style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                        border: 'none', backgroundColor: m.is_shortlisted ? '#059669' : (isDark ? '#334155' : '#f1f5f9'),
                        color: m.is_shortlisted ? '#fff' : (isDark ? '#94a3b8' : '#6b7280'),
                      }}>{m.is_shortlisted ? '★ Shortlisted' : '☆ Shortlist'}</button>
                    </div>
                  </div>

                  {/* Email */}
                  <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginBottom: '8px' }}>{m.candidate_email}</div>

                  {/* Score bars */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                    <MiniBar label="Skills" value={m.skills_score} />
                    <MiniBar label="Experience" value={m.experience_score} />
                    <MiniBar label="Title" value={m.title_score} />
                    <MiniBar label="Location" value={m.location_score} />
                    <MiniBar label="Education" value={m.education_score} />
                  </div>

                  {/* Matched/Missing skills */}
                  {m.matched_skills && (
                    <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>Matched: </span>
                      <span style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>{m.matched_skills}</span>
                    </div>
                  )}
                  {m.missing_skills && (
                    <div style={{ fontSize: '11px' }}>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>Missing: </span>
                      <span style={{ color: isDark ? '#64748b' : '#9ca3af' }}>{m.missing_skills}</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
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
