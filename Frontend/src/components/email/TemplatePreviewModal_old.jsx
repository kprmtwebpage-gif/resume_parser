import { useState, useRef, useMemo, useCallback } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { updateEmailTemplate } from '../../services/emailApi'

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'align', 'list', 'bullet', 'link',
  'table', 'td', 'tr', 'th', 'tbody', 'thead',
]

const VARIABLES = [
  '{{candidate_name}}', '{{phone}}', '{{email}}', '{{location}}',
  '{{experience}}', '{{us_experience}}', '{{work_auth}}',
  '{{visa_validity}}', '{{linkedin}}', '{{rate}}',
  '{{education}}', '{{passport}}', '{{availability}}', '{{skills}}',
]

export default function TemplatePreviewModal({ isOpen, template, onClose, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const quillRef = useRef(null)

  const startEdit = useCallback(() => {
    setName(template.name || '')
    setSubject(template.subject || '')
    setBody(template.body || '')
    setError('')
    setEditing(true)
  }, [template])

  const handleSave = async () => {
    if (!name.trim()) { setError('Template name is required'); return }
    if (!subject.trim()) { setError('Subject is required'); return }
    setSaving(true)
    setError('')
    try {
      await updateEmailTemplate(template.id, { name: name.trim(), subject: subject.trim(), body })
      setEditing(false)
      onUpdated?.()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update template')
    } finally {
      setSaving(false)
    }
  }

  const insertVariable = (variable, target) => {
    if (target === 'subject') {
      setSubject(prev => prev + ' ' + variable)
    } else {
      const quill = quillRef.current?.getEditor?.()
      if (quill) {
        const range = quill.getSelection(true)
        quill.insertText(range.index, variable)
        quill.setSelection(range.index + variable.length)
      }
    }
  }

  const insertTable = useCallback(() => {
    const quill = quillRef.current?.getEditor?.()
    if (!quill) return
    const range = quill.getSelection(true)
    const tableHtml = `<table border="1" style="border-collapse:collapse;width:100%"><tr><td style="padding:8px;border:1px solid #ccc">Header 1</td><td style="padding:8px;border:1px solid #ccc">Header 2</td></tr><tr><td style="padding:8px;border:1px solid #ccc">Value</td><td style="padding:8px;border:1px solid #ccc">Value</td></tr></table><p><br></p>`
    quill.clipboard.dangerouslyPasteHTML(range.index, tableHtml)
  }, [])

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ color: [] }],
        [{ align: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['insertTable'],
        ['clean'],
      ],
      handlers: {
        insertTable: () => insertTable(),
      },
    },
    clipboard: { matchVisual: false },
  }), [insertTable])

  if (!isOpen || !template) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#fff', borderRadius: '12px', width: '780px',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>
              {editing ? 'Edit Template' : 'Template Preview'}
            </h2>
            {!editing && (
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                {template.name}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!editing && (
              <button onClick={startEdit} style={{
                padding: '7px 16px', backgroundColor: '#2563eb', color: '#fff',
                border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer',
              }}>Edit</button>
            )}
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer',
              color: '#9ca3af', lineHeight: 1,
            }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && (
                <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', fontSize: '13px' }}>
                  {error}
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Template Name
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Subject Line
                </label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Insert Variable (click → subject, double-click → body)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {VARIABLES.map(v => (
                    <button key={v}
                      onClick={() => insertVariable(v, 'subject')}
                      onDoubleClick={() => insertVariable(v, 'body')}
                      style={{
                        padding: '4px 10px', fontSize: '12px', fontWeight: 500,
                        backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe',
                        borderRadius: '14px', cursor: 'pointer',
                      }}>{v}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Email Body
                </label>
                <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
                  <ReactQuill ref={quillRef} theme="snow" value={body} onChange={setBody}
                    modules={modules} formats={QUILL_FORMATS}
                    placeholder="Edit template body..." style={{ minHeight: '200px' }} />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '12px', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>Subject: </span>
                <span style={{ fontSize: '14px', color: '#1e293b' }}>{template.subject}</span>
              </div>
              <div
                style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff', minHeight: '200px' }}
                dangerouslySetInnerHTML={{ __html: template.body }}
              />
            </>
          )}
        </div>

        {/* Footer */}
        {editing && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            padding: '16px 24px', borderTop: '1px solid #e5e7eb',
          }}>
            <button onClick={() => setEditing(false)} style={{
              padding: '9px 22px', backgroundColor: '#fff', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '13px', cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '9px 22px', backgroundColor: saving ? '#93c5fd' : '#2563eb', color: '#fff',
              border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}>{saving ? 'Saving...' : 'Save Template'}</button>
          </div>
        )}

        <style>{`
          @keyframes fadeIn { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform: translateY(0); } }
          .ql-container.ql-snow { border: none !important; font-size: 14px; }
          .ql-toolbar.ql-snow { border: none !important; border-bottom: 1px solid #e2e8f0 !important; background: #fafbfc; }
          .ql-editor { min-height: 180px; max-height: 320px; overflow-y: auto !important; padding: 14px; }
          .ql-insertTable::after { content: '⊞'; font-size: 16px; font-weight: bold; }
          .ql-insertTable { width: auto !important; padding: 0 5px !important; }
        `}</style>
      </div>
    </div>
  )
}
