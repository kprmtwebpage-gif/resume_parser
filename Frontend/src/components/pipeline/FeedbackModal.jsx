import { useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'

const RATING_LABELS = ['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent']

function StarRow({ label, value, onChange }) {
  const { isDark } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', width: '140px' }}>{label}</span>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            width: '28px', height: '28px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontSize: '14px', fontWeight: 600, transition: 'all 0.15s',
            backgroundColor: n <= value ? (value >= 4 ? '#dcfce7' : value >= 3 ? '#dbeafe' : '#fee2e2') : (isDark ? '#1e293b' : '#f1f5f9'),
            color: n <= value ? (value >= 4 ? '#166534' : value >= 3 ? '#1e40af' : '#991b1b') : (isDark ? '#475569' : '#cbd5e1'),
          }}>{n}</button>
        ))}
        <span style={{ fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', width: '70px', textAlign: 'right' }}>
          {value ? RATING_LABELS[value] : ''}
        </span>
      </div>
    </div>
  )
}

const RECOMMENDATIONS = [
  { key: 'potential_candidate', label: 'Potential Candidate', color: '#059669' },
  { key: 'average', label: 'Average', color: '#3b82f6' },
  { key: 'below_average', label: 'Below Average', color: '#f59e0b' },
  { key: 'poor', label: 'Poor', color: '#ef4444' },
  { key: 'fake_or_not_recommended', label: 'Fake / Not Recommended', color: '#be185d' },
]

export default function FeedbackModal({ candidate, stage, onSubmit, onClose }) {
  const { isDark, colors } = useTheme()
  const { user } = useAuth()

  const [form, setForm] = useState({
    technical_rating: 0,
    communication_rating: 0,
    problem_solving_rating: 0,
    cultural_fit_rating: 0,
    overall_rating: 0,
    recommendation: '',
    comments: '',
    strengths: '',
    weaknesses: '',
  })

  const handleSubmit = () => {
    const data = {
      ...form,
      stage: stage,
      reviewer_name: user?.username || 'Unknown',
      reviewer_email: '',
      technical_rating: form.technical_rating || null,
      communication_rating: form.communication_rating || null,
      problem_solving_rating: form.problem_solving_rating || null,
      cultural_fit_rating: form.cultural_fit_rating || null,
      overall_rating: form.overall_rating || null,
      recommendation: form.recommendation || null,
    }
    onSubmit?.(data)
  }

  const hasRating = form.technical_rating || form.communication_rating || form.problem_solving_rating || form.overall_rating

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        backgroundColor: isDark ? '#1e293b' : '#fff', borderRadius: '16px', padding: '28px',
        width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.text, margin: 0 }}>
            Stage Feedback
          </h2>
          <p style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '4px' }}>
            {candidate?.candidate_name} — {stage?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </p>
        </div>

        {/* Ratings */}
        <div style={{ marginBottom: '16px' }}>
          <StarRow label="Technical Skills" value={form.technical_rating} onChange={v => setForm(p => ({...p, technical_rating: v}))} />
          <StarRow label="Communication" value={form.communication_rating} onChange={v => setForm(p => ({...p, communication_rating: v}))} />
          <StarRow label="Problem Solving" value={form.problem_solving_rating} onChange={v => setForm(p => ({...p, problem_solving_rating: v}))} />
          <StarRow label="Cultural Fit" value={form.cultural_fit_rating} onChange={v => setForm(p => ({...p, cultural_fit_rating: v}))} />
          <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: '8px', paddingTop: '8px' }}>
            <StarRow label="Overall Rating" value={form.overall_rating} onChange={v => setForm(p => ({...p, overall_rating: v}))} />
          </div>
        </div>

        {/* Recommendation */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '6px' }}>Recommendation</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {RECOMMENDATIONS.map(r => (
              <button key={r.key} onClick={() => setForm(p => ({...p, recommendation: r.key}))} style={{
                padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                border: form.recommendation === r.key ? `2px solid ${r.color}` : `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                backgroundColor: form.recommendation === r.key ? r.color + '15' : 'transparent',
                color: form.recommendation === r.key ? r.color : (isDark ? '#94a3b8' : '#6b7280'),
                transition: 'all 0.15s',
              }}>{r.label}</button>
            ))}
          </div>
        </div>

        {/* Text fields */}
        {[
          { key: 'strengths', label: 'Strengths' },
          { key: 'weaknesses', label: 'Areas for Improvement' },
          { key: 'comments', label: 'Additional Comments' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>{f.label}</label>
            <textarea value={form[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))}
              rows={2} style={{
                width: '100%', padding: '8px 12px', borderRadius: '8px',
                border: `1px solid ${colors.border}`, backgroundColor: isDark ? '#0f172a' : '#fff',
                color: colors.text, fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: '8px', border: `1px solid ${colors.border}`,
            backgroundColor: 'transparent', color: colors.text, fontWeight: 600, cursor: 'pointer', fontSize: '14px',
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!hasRating} style={{
            padding: '10px 24px', borderRadius: '8px', border: 'none',
            backgroundColor: hasRating ? '#6366f1' : '#94a3b8',
            color: '#fff', fontWeight: 600, cursor: hasRating ? 'pointer' : 'not-allowed', fontSize: '14px',
          }}>Submit Feedback</button>
        </div>
      </div>
    </div>
  )
}
