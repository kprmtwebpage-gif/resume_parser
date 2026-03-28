import { useState, useCallback, useRef, useEffect } from 'react'
import WordEditor from './WordEditor'
import './WordEditor.css'

const SAMPLE_DATA = {
  candidate_name: 'John Doe',
  phone: '+1 (555) 123-4567',
  email: 'john.doe@example.com',
  location: 'New York, NY',
  experience: '8 years',
  us_experience: '5 years',
  work_auth: 'H1B',
  visa_validity: '2027-12-31',
  linkedin: 'linkedin.com/in/johndoe',
  rate: '$85/hr',
  education: 'MS Computer Science, MIT 2018',
  passport: 'Available',
  availability: 'Immediate',
  skills: 'React, Node.js, Python, AWS',
  willingness_to_relocate: 'Yes',
  dob: '1990-05-15',
  ssn_last4: '1234',
}

/**
 * WordEditorModal — full‑screen modal wrapping the WordEditor.
 *
 * Props:
 *   isOpen       — boolean
 *   onClose      — () => void
 *   title        — modal title
 *   initialContent — starting HTML
 *   onSave       — (html: string) => void — called when user clicks Save
 *   showPreview  — enable preview tab (default: true)
 *   showVariables — show variable chips (default: true)
 */
export default function WordEditorModal({
  isOpen,
  onClose,
  title = 'Template Editor',
  initialContent = '',
  onSave,
  showPreview = true,
  showVariables = true,
}) {
  const [tab, setTab] = useState('edit') // 'edit' | 'preview'
  const [html, setHtml] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const backdropRef = useRef(null)

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setHtml(initialContent)
      setTab('edit')
    }
  }, [isOpen, initialContent])

  const handleSave = useCallback(async () => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(html)
    } finally {
      setSaving(false)
    }
  }, [html, onSave])

  // Escape key close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Replace variables with sample data for preview
  const previewHtml = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return SAMPLE_DATA[key] || match
  })

  return (
    <div
      className="word-editor-modal-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="word-editor-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="word-editor-modal-header">
          <h3>{title}</h3>
          <div className="word-editor-modal-header-actions">
            {showPreview && (
              <div style={{ display: 'flex', gap: 2, background: '#f3f4f6', borderRadius: 6, padding: 2 }}>
                <button
                  onClick={() => setTab('edit')}
                  style={{
                    padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 4, border: 'none',
                    background: tab === 'edit' ? '#fff' : 'transparent',
                    color: tab === 'edit' ? '#1d4ed8' : '#6b7280',
                    boxShadow: tab === 'edit' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => setTab('preview')}
                  style={{
                    padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 4, border: 'none',
                    background: tab === 'preview' ? '#fff' : 'transparent',
                    color: tab === 'preview' ? '#1d4ed8' : '#6b7280',
                    boxShadow: tab === 'preview' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  Preview
                </button>
              </div>
            )}
            {onSave && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '6px 20px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none',
                  background: saving ? '#93c5fd' : '#2563eb', color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
            <button className="word-editor-modal-close" onClick={onClose} title="Close">×</button>
          </div>
        </div>

        {/* Body */}
        {tab === 'edit' ? (
          <WordEditor
            content={html}
            onUpdate={setHtml}
            showVariables={showVariables}
          />
        ) : (
          <div className="word-preview-area">
            <div className="word-preview-page">
              <div style={{ marginBottom: 12, fontSize: '9pt', color: '#666', fontStyle: 'italic' }}>
                Preview — variables are replaced with sample data
              </div>
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
