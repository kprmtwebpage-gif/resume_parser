import { useTheme } from '../../contexts/ThemeContext'

const STAGE_COLORS = {
  screening:             { accent: '#3b82f6', bg: '#eff6ff', darkBg: '#1e3a5f' },
  written_test:          { accent: '#8b5cf6', bg: '#f5f3ff', darkBg: '#2d1b69' },
  level_1:               { accent: '#06b6d4', bg: '#ecfeff', darkBg: '#164e63' },
  level_2:               { accent: '#f59e0b', bg: '#fffbeb', darkBg: '#78350f' },
  level_3:               { accent: '#ef4444', bg: '#fef2f2', darkBg: '#450a0a' },
  offer:                 { accent: '#10b981', bg: '#ecfdf5', darkBg: '#064e3b' },
  onboarding_initiated:  { accent: '#6366f1', bg: '#eef2ff', darkBg: '#312e81' },
  onboarding_completed:  { accent: '#059669', bg: '#d1fae5', darkBg: '#065f46' },
}

const RANKING_BADGES = {
  potential_candidate:       { label: 'Potential', bg: '#dcfce7', color: '#166534', icon: '★' },
  average:                   { label: 'Average', bg: '#dbeafe', color: '#1e40af', icon: '●' },
  below_average:             { label: 'Below Avg', bg: '#fef3c7', color: '#92400e', icon: '▼' },
  poor:                      { label: 'Poor', bg: '#fee2e2', color: '#991b1b', icon: '✕' },
  fake_or_not_recommended:   { label: 'Not Rec.', bg: '#fce7f3', color: '#9d174d', icon: '⚠' },
}

function CandidateCard({ candidate, onDragStart, onClick, onFeedback }) {
  const { isDark, colors } = useTheme()
  const rb = RANKING_BADGES[candidate.ranking]

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('candidateId', candidate.id)
        e.dataTransfer.setData('fromStage', candidate.current_stage)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.(candidate)
      }}
      onClick={() => onClick?.(candidate)}
      style={{
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
        borderRadius: '10px',
        padding: '12px 14px',
        marginBottom: '8px',
        cursor: 'grab',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Name + score row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: colors.text, lineHeight: '1.3' }}>
          {candidate.candidate_name}
        </div>
        {candidate.overall_score != null && (
          <div style={{
            fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '6px',
            backgroundColor: candidate.overall_score >= 80 ? '#dcfce7' : candidate.overall_score >= 60 ? '#dbeafe' : candidate.overall_score >= 40 ? '#fef3c7' : '#fee2e2',
            color: candidate.overall_score >= 80 ? '#166534' : candidate.overall_score >= 60 ? '#1e40af' : candidate.overall_score >= 40 ? '#92400e' : '#991b1b',
          }}>
            {Math.round(candidate.overall_score)}
          </div>
        )}
      </div>

      {/* Email */}
      {candidate.candidate_email && (
        <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {candidate.candidate_email}
        </div>
      )}

      {/* Job title */}
      {candidate.job_title && (
        <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' }}>
          {candidate.job_title}
        </div>
      )}

      {/* Bottom row: ranking badge + feedback button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {rb ? (
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
            backgroundColor: rb.bg, color: rb.color,
          }}>
            {rb.icon} {rb.label}
          </span>
        ) : <span />}
        <button
          onClick={(e) => { e.stopPropagation(); onFeedback?.(candidate) }}
          style={{
            fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
            border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
            backgroundColor: 'transparent', color: isDark ? '#94a3b8' : '#6b7280',
            cursor: 'pointer',
          }}
        >+ Feedback</button>
      </div>
    </div>
  )
}


export default function StageColumn({ stage, label, candidates, count, onDrop, onCandidateClick, onFeedback, onDragStart }) {
  const { isDark, colors } = useTheme()
  const stageColor = STAGE_COLORS[stage] || STAGE_COLORS.screening

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    e.currentTarget.style.backgroundColor = isDark ? stageColor.darkBg : stageColor.bg
  }

  const handleDragLeave = (e) => {
    e.currentTarget.style.backgroundColor = 'transparent'
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.currentTarget.style.backgroundColor = 'transparent'
    const candidateId = e.dataTransfer.getData('candidateId')
    const fromStage = e.dataTransfer.getData('fromStage')
    if (candidateId && fromStage !== stage) {
      onDrop?.(candidateId, fromStage, stage)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        flex: '0 0 280px',
        minHeight: '400px',
        borderRadius: '12px',
        border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
        backgroundColor: isDark ? colors.card : '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: `2px solid ${stageColor.accent}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: colors.text }}>{label}</div>
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
          backgroundColor: stageColor.accent + '20',
          color: stageColor.accent,
        }}>{count}</span>
      </div>

      {/* Cards */}
      <div style={{ padding: '10px 10px', flex: 1, overflowY: 'auto' }}>
        {candidates.map(c => (
          <CandidateCard
            key={c.id}
            candidate={c}
            onDragStart={onDragStart}
            onClick={onCandidateClick}
            onFeedback={onFeedback}
          />
        ))}
        {count === 0 && (
          <div style={{
            padding: '30px 10px', textAlign: 'center',
            fontSize: '12px', color: isDark ? '#475569' : '#cbd5e1',
            fontStyle: 'italic',
          }}>
            Drop candidates here
          </div>
        )}
      </div>
    </div>
  )
}

export { RANKING_BADGES, STAGE_COLORS }
