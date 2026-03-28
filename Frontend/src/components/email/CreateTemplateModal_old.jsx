import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { createEmailTemplate } from '../../services/emailApi'

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'align', 'list', 'bullet', 'link',
  'table', 'td', 'tr', 'th', 'tbody', 'thead',
]

const VARIABLES = [
  { key: 'candidate_name', label: 'Candidate Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'location', label: 'Location' },
  { key: 'experience', label: 'Experience' },
  { key: 'us_experience', label: 'US Experience' },
  { key: 'work_auth', label: 'Work Auth' },
  { key: 'visa_validity', label: 'Visa Validity' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'rate', label: 'Rate' },
  { key: 'education', label: 'Education' },
  { key: 'passport', label: 'Passport' },
  { key: 'availability', label: 'Availability' },
  { key: 'skills', label: 'Skills' },
]

/**
 * CreateTemplateModal — full-screen modal for creating a new email template.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onCreated: () => void  (refresh list after save)
 */
export default function CreateTemplateModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const backdropRef = useRef(null)
  const quillRef = useRef(null)

  // Reset on open
  useEffect(() => {
    if (isOpen) { setName(''); setSubject(''); setBody(''); setError('') }
  }, [isOpen])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleSave = useCallback(async () => {
    if (!name.trim()) { setError('Template name is required'); return }
    if (!subject.trim()) { setError('Subject is required'); return }
    if (!body.trim() || body === '<p><br></p>') { setError('Email body is required'); return }
    setError('')
    setSaving(true)
    try {
      await createEmailTemplate({ name, subject, body })
      onCreated?.()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }, [name, subject, body, onClose, onCreated])

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
        [{ color: [] }, { background: [] }],
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

  if (!isOpen) return null

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) onClose()
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        animation: 'ctmFadeIn 0.18s ease',
      }}
    >
      <div style={{
        backgroundColor: '#fff', borderRadius: '14px',
        width: '720px', maxWidth: '95vw', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        animation: 'ctmSlideUp 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
        }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
            Create New Template
          </h3>
          <button onClick={onClose} style={{
            width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', backgroundColor: '#f1f5f9', borderRadius: '6px', cursor: 'pointer',
            fontSize: '16px', color: '#64748b',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {error && (
            <div style={{ marginBottom: '12px', padding: '10px 14px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '13px', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          {/* Name */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Template Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. TYPE E — Custom Submission"
              style={inputStyle} />
          </div>

          {/* Subject */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Subject Line</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Candidate Submission: {{candidate_name}}"
              style={inputStyle} />
          </div>

          {/* Variable chips */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Insert Variable (click → subject, double-click → body)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {VARIABLES.map(v => (
                <button key={v.key}
                  onClick={() => setSubject(prev => `${prev}{{${v.key}}}`)}
                  onDoubleClick={() => setBody(prev => `${prev}{{${v.key}}}`)}
                  style={{
                    padding: '3px 9px', backgroundColor: '#e0e7ff', color: '#3730a3',
                    border: '1px solid #c7d2fe', borderRadius: '5px', fontSize: '11px',
                    fontWeight: 500, cursor: 'pointer',
                  }}
                >{`{{${v.key}}}`}</button>
              ))}
            </div>
          </div>

          {/* Body editor */}
          <div style={{ marginBottom: '8px' }}>
            <label style={labelStyle}>Email Body</label>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={body}
                onChange={setBody}
                modules={modules}
                formats={QUILL_FORMATS}
                placeholder="Compose your template body..."
                style={{ minHeight: '220px' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
          padding: '14px 24px', borderTop: '1px solid #e2e8f0',
        }}>
          <button onClick={onClose} style={{
            padding: '9px 22px', backgroundColor: '#fff', color: '#374151',
            border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 22px', backgroundColor: saving ? '#93c5fd' : '#2563eb', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? 'Saving...' : 'Save Template'}</button>
        </div>
      </div>

      <style>{`
        @keyframes ctmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ctmSlideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        .ql-container.ql-snow { border: none !important; font-size: 14px; }
        .ql-toolbar.ql-snow { border: none !important; border-bottom: 1px solid #e2e8f0 !important; background: #fafbfc; }
        .ql-editor { min-height: 180px; max-height: 320px; overflow-y: auto !important; padding: 14px; line-height: 1.6; }
        .ql-insertTable::after { content: '⊞'; font-size: 16px; font-weight: bold; }
        .ql-insertTable { width: auto !important; padding: 0 5px !important; }
      `}</style>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '5px' }
const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}
