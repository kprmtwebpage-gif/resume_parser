import { useState, useCallback, useEffect, useRef } from 'react'
import { WordEditorModal } from '../editor'
import { updateEmailTemplate } from '../../services/emailApi'

/**
 * TemplatePreviewModal — shows a template preview with HTML,
 * and an "Edit in Word Editor" button that opens the full TipTap editor.
 *
 * Props:
 *   isOpen, template, onClose, onUpdated
 */
export default function TemplatePreviewModal({ isOpen, template, onClose, onUpdated }) {
  const [showEditor, setShowEditor] = useState(false)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [editingMeta, setEditingMeta] = useState(false)
  const backdropRef = useRef(null)

  useEffect(() => {
    if (isOpen && template) {
      setName(template.name || '')
      setSubject(template.subject || '')
      setShowEditor(false)
      setEditingMeta(false)
    }
  }, [isOpen, template])

  const handleSaveFromEditor = useCallback(async (html) => {
    await updateEmailTemplate(template.id, {
      name: name.trim() || template.name,
      subject: subject.trim() || template.subject,
      body: html,
    })
    setShowEditor(false)
    onUpdated?.()
  }, [template, name, subject, onUpdated])

  const handleSaveMeta = useCallback(async () => {
    if (!name.trim() || !subject.trim()) return
    await updateEmailTemplate(template.id, {
      name: name.trim(),
      subject: subject.trim(),
      body: template.body,
    })
    setEditingMeta(false)
    onUpdated?.()
  }, [template, name, subject, onUpdated])

  if (!isOpen || !template) return null

  // If full editor is open, render only the WordEditorModal
  if (showEditor) {
    return (
      <WordEditorModal
        isOpen
        onClose={() => setShowEditor(false)}
        title={`Edit — ${name || template.name}`}
        initialContent={template.body || ''}
        onSave={handleSaveFromEditor}
        showPreview
        showVariables
      />
    )
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff', borderRadius: '12px', width: '800px',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>
              Template Preview
            </h2>
            {!editingMeta && (
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{template.name}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setShowEditor(true)} style={{
              padding: '7px 16px', backgroundColor: '#2563eb', color: '#fff',
              border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}>Edit in Word Editor</button>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer',
              color: '#9ca3af', lineHeight: 1,
            }}>×</button>
          </div>
        </div>

        {/* Meta editing (name + subject) */}
        {editingMeta ? (
          <div style={{ padding: '14px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Template Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingMeta(false)} style={{
                padding: '6px 16px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleSaveMeta} style={{
                padding: '6px 16px', fontSize: '12px', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer',
              }}>Save</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '10px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>Subject: </span>
              <span style={{ fontSize: '14px', color: '#1e293b' }}>{template.subject}</span>
            </div>
            <button onClick={() => setEditingMeta(true)} style={{
              padding: '4px 12px', fontSize: '11px', color: '#2563eb', background: '#eff6ff',
              border: '1px solid #bfdbfe', borderRadius: '5px', cursor: 'pointer', fontWeight: 500,
            }}>Edit Name / Subject</button>
          </div>
        )}

        {/* Body preview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <div
            style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff', minHeight: '200px' }}
            dangerouslySetInnerHTML={{ __html: template.body }}
          />
        </div>
      </div>
    </div>
  )
}
