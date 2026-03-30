import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { fetchAllStages, createStage, updateStage, deleteStage, reorderStages } from '../../services/pipelineApi'

const PRESET_COLORS = ['#3b82f6','#8b5cf6','#06b6d4','#f59e0b','#ef4444','#10b981','#6366f1','#059669','#ec4899','#f97316','#14b8a6','#a855f7']

export default function PipelineSettings() {
  const { isDark, colors } = useTheme()
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ stage_key: '', label: '', color: '#6366f1', is_terminal: false, description: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try { setStages(await fetchAllStages()) } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    try {
      if (editId) {
        await updateStage(editId, { label: form.label, color: form.color, is_terminal: form.is_terminal, description: form.description })
      } else {
        const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.stage_order)) + 1 : 0
        await createStage({ ...form, stage_order: maxOrder })
      }
      setShowAdd(false); setEditId(null)
      setForm({ stage_key: '', label: '', color: '#6366f1', is_terminal: false, description: '' })
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this stage? Candidates in this stage will need to be moved first.')) return
    try { await deleteStage(id); load() } catch (e) { alert('Failed to delete') }
  }

  const handleToggle = async (stage) => {
    try { await updateStage(stage.id, { is_active: !stage.is_active }); load() } catch (e) { console.error(e) }
  }

  const handleMoveUp = async (idx) => {
    if (idx === 0) return
    const keys = stages.map(s => s.stage_key)
    ;[keys[idx], keys[idx - 1]] = [keys[idx - 1], keys[idx]]
    try { await reorderStages(keys); load() } catch (e) { console.error(e) }
  }

  const handleMoveDown = async (idx) => {
    if (idx >= stages.length - 1) return
    const keys = stages.map(s => s.stage_key)
    ;[keys[idx], keys[idx + 1]] = [keys[idx + 1], keys[idx]]
    try { await reorderStages(keys); load() } catch (e) { console.error(e) }
  }

  const cardStyle = { backgroundColor: isDark ? colors.card : '#fff', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '20px' }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', backgroundColor: colors.background, padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: colors.text, margin: 0 }}>Pipeline Configuration</h1>
          <p style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '13px', marginTop: '4px' }}>Configure interview pipeline stages. Drag to reorder, toggle to enable/disable.</p>
        </div>
        <button onClick={() => { setShowAdd(true); setEditId(null); setForm({ stage_key: '', label: '', color: '#6366f1', is_terminal: false, description: '' }) }}
          style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
          + Add Stage
        </button>
      </div>

      {loading ? <div style={{ padding: '40px', textAlign: 'center', color: isDark ? '#64748b' : '#94a3b8' }}>Loading...</div> : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          {stages.map((s, idx) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px',
              borderBottom: idx < stages.length - 1 ? `1px solid ${colors.border}` : 'none',
              opacity: s.is_active ? 1 : 0.5,
            }}>
              {/* Order arrows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button onClick={() => handleMoveUp(idx)} disabled={idx === 0} style={{ border: 'none', background: 'none', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '14px', color: isDark ? '#94a3b8' : '#64748b', opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                <button onClick={() => handleMoveDown(idx)} disabled={idx >= stages.length - 1} style={{ border: 'none', background: 'none', cursor: idx >= stages.length - 1 ? 'default' : 'pointer', fontSize: '14px', color: isDark ? '#94a3b8' : '#64748b', opacity: idx >= stages.length - 1 ? 0.3 : 1 }}>▼</button>
              </div>
              {/* Color dot */}
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: s.color || '#6366f1', flexShrink: 0 }} />
              {/* Order number */}
              <span style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#475569' : '#cbd5e1', width: '24px' }}>{idx + 1}</span>
              {/* Label */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: colors.text }}>{s.label}</div>
                <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af' }}>
                  Key: {s.stage_key} {s.is_terminal && '• Terminal stage'} {s.description && `• ${s.description}`}
                </div>
              </div>
              {/* Toggle */}
              <button onClick={() => handleToggle(s)} style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                border: 'none', backgroundColor: s.is_active ? '#dcfce7' : '#fee2e2', color: s.is_active ? '#166534' : '#991b1b',
              }}>{s.is_active ? 'Active' : 'Inactive'}</button>
              {/* Edit */}
              <button onClick={() => {
                setEditId(s.id); setShowAdd(true)
                setForm({ stage_key: s.stage_key, label: s.label, color: s.color || '#6366f1', is_terminal: s.is_terminal, description: s.description || '' })
              }} style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`, backgroundColor: 'transparent', color: '#3b82f6',
              }}>Edit</button>
              {/* Delete */}
              <button onClick={() => handleDelete(s.id)} style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`, backgroundColor: 'transparent', color: '#ef4444',
              }}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
             onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: isDark ? '#1e293b' : '#fff', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: colors.text, marginBottom: '16px' }}>
              {editId ? 'Edit Stage' : 'Add New Stage'}
            </h3>
            {[
              { key: 'stage_key', label: 'Stage Key (unique)', placeholder: 'e.g. coding_test', disabled: !!editId },
              { key: 'label', label: 'Display Label', placeholder: 'e.g. Coding Test' },
              { key: 'description', label: 'Description (optional)', placeholder: 'e.g. Online coding assessment' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>{f.label}</label>
                <input type="text" value={form[f.key]} disabled={f.disabled}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '8px', boxSizing: 'border-box',
                    border: `1px solid ${colors.border}`, backgroundColor: f.disabled ? (isDark ? '#334155' : '#f1f5f9') : (isDark ? '#0f172a' : '#fff'),
                    color: colors.text, fontSize: '14px', outline: 'none',
                  }}
                />
              </div>
            ))}
            {/* Color picker */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '6px' }}>Color</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{
                    width: '28px', height: '28px', borderRadius: '6px', border: form.color === c ? '2px solid #fff' : '2px solid transparent',
                    backgroundColor: c, cursor: 'pointer', boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none',
                  }} />
                ))}
              </div>
            </div>
            {/* Terminal toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: colors.text, marginBottom: '16px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_terminal} onChange={e => setForm(p => ({ ...p, is_terminal: e.target.checked }))} />
              Terminal stage (final stage in pipeline)
            </label>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{
                padding: '10px 20px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                backgroundColor: 'transparent', color: colors.text, fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleSave} disabled={!form.label || (!editId && !form.stage_key)} style={{
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                backgroundColor: form.label ? '#6366f1' : '#94a3b8',
                color: '#fff', fontWeight: 600, cursor: form.label ? 'pointer' : 'not-allowed',
              }}>{editId ? 'Save Changes' : 'Add Stage'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
