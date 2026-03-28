import { useState, useEffect, useCallback } from 'react'
import {
  listEmailTemplates,
  getCPTemplates,
  assignCPTemplate,
  unassignCPTemplate,
} from '../../services/emailApi'

/**
 * Modal to assign / un-assign email templates to a contact person (HR).
 * Props:
 *  - contactPerson: { id, first_name, last_name, email }
 *  - onClose: () => void
 *  - onUpdate: () => void  (callback to refresh parent data)
 */
export default function TemplateAssignModal({ contactPerson, onClose, onUpdate }) {
  const [allTemplates, setAllTemplates] = useState([])
  const [assigned, setAssigned] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)

  const cpName = [contactPerson.first_name, contactPerson.last_name].filter(Boolean).join(' ') || 'Contact'

  const load = useCallback(async () => {
    try {
      const [all, mapped] = await Promise.all([
        listEmailTemplates(),
        getCPTemplates(contactPerson.id),
      ])
      setAllTemplates(all)
      setAssigned(mapped)
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }, [contactPerson.id])

  useEffect(() => { load() }, [load])

  const assignedIds = new Set(assigned.map((t) => t.id))
  const available = allTemplates.filter((t) => !assignedIds.has(t.id))

  const handleAssign = async () => {
    if (!selectedId) return
    setAssigning(true)
    try {
      await assignCPTemplate(contactPerson.id, selectedId)
      setSelectedId('')
      await load()
      onUpdate?.()
    } catch (err) {
      console.error('Failed to assign template:', err)
      alert(err?.response?.data?.detail || 'Failed to assign template')
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassign = async (templateId) => {
    try {
      await unassignCPTemplate(contactPerson.id, templateId)
      await load()
      onUpdate?.()
    } catch (err) {
      console.error('Failed to unassign template:', err)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '14px', padding: '28px',
        width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            Templates — {cpName}
          </h3>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8' }}>
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : (
          <>
            {/* Assigned list */}
            <div style={{ marginBottom: '16px', flex: 1, overflowY: 'auto' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                Assigned Templates ({assigned.length})
              </div>
              {assigned.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#94a3b8', padding: '12px 0' }}>No templates assigned.</div>
              ) : (
                assigned.map((t) => (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px',
                    border: '1px solid #e2e8f0', marginBottom: '6px',
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{t.subject}</div>
                    </div>
                    <button onClick={() => handleUnassign(t.id)}
                      style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Assign new */}
            {available.length > 0 && (
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Add Template
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none' }}>
                    <option value="">Select a template...</option>
                    {available.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button onClick={handleAssign} disabled={!selectedId || assigning}
                    style={{ padding: '8px 16px', backgroundColor: !selectedId ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: !selectedId ? 'not-allowed' : 'pointer' }}>
                    {assigning ? '...' : 'Assign'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
