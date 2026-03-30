import { useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

const STAGE_LABELS = {
  screening: 'Screening', written_test: 'Written Test',
  level_1: 'Level 1 Interview', level_2: 'Level 2 Interview', level_3: 'Level 3 Interview',
  offer: 'Offer', onboarding_initiated: 'Onboarding Initiated', onboarding_completed: 'Onboarding Completed',
}

export default function StageTransitionModal({ candidate, fromStage, toStage, onConfirm, onCancel }) {
  const { isDark, colors } = useTheme()

  const [form, setForm] = useState({
    notes: '',
    interview_date: '',
    interview_time: '',
    duration_minutes: 60,
    meeting_platform: 'zoom',
    meeting_link: '',
    send_to_candidate: true,
    send_to_interviewer: true,
    send_to_recruiter: true,
    send_to_manager: true,
    interviewer_name: '',
    interviewer_email: '',
  })

  const handleConfirm = () => {
    onConfirm({
      ...form,
      to_stage: toStage,
      candidate_name: candidate?.candidate_name,
      candidate_email: candidate?.candidate_email,
    })
  }

  const fromLabel = STAGE_LABELS[fromStage] || fromStage?.replace(/_/g, ' ')
  const toLabel = STAGE_LABELS[toStage] || toStage?.replace(/_/g, ' ')

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: '8px', boxSizing: 'border-box',
    border: `1px solid ${colors.border}`, backgroundColor: isDark ? '#0f172a' : '#fff',
    color: colors.text, fontSize: '13px', outline: 'none',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        backgroundColor: isDark ? '#1e293b' : '#fff', borderRadius: '16px', padding: '28px',
        width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.text, margin: '0 0 4px' }}>Move Candidate</h2>
        <p style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '16px' }}>
          <strong>{candidate?.candidate_name}</strong> : {fromLabel} → {toLabel}
        </p>

        {/* Interview Details */}
        <div style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: `1px solid ${colors.border}` }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: colors.text, marginBottom: '12px' }}>Interview Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '3px' }}>Date</label>
              <input type="date" value={form.interview_date} onChange={e => setForm(p => ({...p, interview_date: e.target.value}))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '3px' }}>Time</label>
              <input type="time" value={form.interview_time} onChange={e => setForm(p => ({...p, interview_time: e.target.value}))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '3px' }}>Duration (min)</label>
              <input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({...p, duration_minutes: parseInt(e.target.value) || 60}))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '3px' }}>Platform</label>
              <select value={form.meeting_platform} onChange={e => setForm(p => ({...p, meeting_platform: e.target.value}))} style={inputStyle}>
                <option value="zoom">Zoom</option>
                <option value="teams">Microsoft Teams</option>
                <option value="google_meet">Google Meet</option>
                <option value="webex">Webex</option>
                <option value="phone">Phone</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '3px' }}>Interviewer Name</label>
              <input type="text" value={form.interviewer_name} onChange={e => setForm(p => ({...p, interviewer_name: e.target.value}))} placeholder="e.g. John Parker" style={inputStyle} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '3px' }}>Interviewer Email</label>
              <input type="email" value={form.interviewer_email} onChange={e => setForm(p => ({...p, interviewer_email: e.target.value}))} placeholder="interviewer@company.com" style={inputStyle} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '3px' }}>Meeting Link (optional)</label>
              <input type="url" value={form.meeting_link} onChange={e => setForm(p => ({...p, meeting_link: e.target.value}))} placeholder="https://zoom.us/j/..." style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Email Notifications */}
        <div style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: `1px solid ${colors.border}` }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: colors.text, marginBottom: '10px' }}>Send Notifications To</h3>
          {[
            { key: 'send_to_recruiter', label: 'Recruiter (Internal)', icon: '👤' },
            { key: 'send_to_manager', label: 'Talent Manager (Internal)', icon: '👥' },
            { key: 'send_to_candidate', label: 'Candidate (External)', icon: '📧' },
            { key: 'send_to_interviewer', label: 'Interviewer (External)', icon: '🎯' },
          ].map(n => (
            <label key={n.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', cursor: 'pointer', fontSize: '13px', color: colors.text }}>
              <input type="checkbox" checked={form[n.key]} onChange={e => setForm(p => ({...p, [n.key]: e.target.checked}))}
                style={{ width: '16px', height: '16px', accentColor: '#6366f1' }} />
              <span>{n.icon} {n.label}</span>
            </label>
          ))}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '3px' }}>Notes</label>
          <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))}
            rows={3} placeholder="Add any notes about this stage transition..."
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '10px 20px', borderRadius: '8px', border: `1px solid ${colors.border}`,
            backgroundColor: 'transparent', color: colors.text, fontWeight: 600, cursor: 'pointer', fontSize: '14px',
          }}>Cancel</button>
          <button onClick={handleConfirm} style={{
            padding: '10px 24px', borderRadius: '8px', border: 'none',
            backgroundColor: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
          }}>Confirm & Move</button>
        </div>
      </div>
    </div>
  )
}
