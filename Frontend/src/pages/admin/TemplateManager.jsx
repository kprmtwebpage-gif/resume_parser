import { useState, useEffect, useMemo, useCallback } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import {
  listEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from '../../services/emailApi'

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'align', 'list', 'bullet', 'link',
]

const VARIABLES = [
  { key: 'candidate_name', label: 'Candidate Name' },
  { key: 'location', label: 'Location' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'experience', label: 'Total Experience' },
  { key: 'us_experience', label: 'US Experience' },
  { key: 'work_auth', label: 'Work Authorization' },
  { key: 'visa_validity', label: 'Visa Validity' },
  { key: 'passport', label: 'Passport No' },
  { key: 'rate', label: 'Rate' },
  { key: 'education', label: 'Education' },
  { key: 'availability', label: 'Availability' },
]

export default function TemplateManager() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const loadTemplates = useCallback(async () => {
    try {
      const data = await listEmailTemplates()
      setTemplates(data)
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setName('')
    setSubject('')
    setBody('')
  }

  const handleEdit = (t) => {
    setEditingId(t.id)
    setName(t.name)
    setSubject(t.subject)
    setBody(t.body)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await updateEmailTemplate(editingId, { name, subject, body })
      } else {
        await createEmailTemplate({ name, subject, body })
      }
      resetForm()
      await loadTemplates()
    } catch (err) {
      console.error('Failed to save template:', err)
      alert('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return
    try {
      await deleteEmailTemplate(id)
      await loadTemplates()
    } catch (err) {
      console.error('Failed to delete template:', err)
    }
  }

  const insertVariable = (key) => {
    setSubject((prev) => `${prev}{{${key}}}`)
  }

  const insertVariableToBody = (key) => {
    setBody((prev) => `${prev}{{${key}}}`)
  }

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ color: [] }],
        [{ align: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
      ],
    },
    clipboard: { matchVisual: false },
  }), [])

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Email Templates</h2>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true) }}
            style={{ padding: '8px 20px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            + New Template
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginTop: 0, marginBottom: '16px' }}>
            {editingId ? 'Edit Template' : 'New Template'}
          </h3>

          {/* Name */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Template Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Candidate Submission - Type A"
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Subject */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Subject Line</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Candidate Submission: {{candidate_name}}"
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Variable helper */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              Insert Variable (click to add to subject / double-click to add to body)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {VARIABLES.map((v) => (
                <button key={v.key}
                  onClick={() => insertVariable(v.key)}
                  onDoubleClick={() => insertVariableToBody(v.key)}
                  title={`Click → subject | Double-click → body | Variable: {{${v.key}}}`}
                  style={{
                    padding: '4px 10px', backgroundColor: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe',
                    borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                  }}>
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Body editor */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Email Body</label>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
              <ReactQuill
                theme="snow"
                value={body}
                onChange={setBody}
                modules={modules}
                formats={QUILL_FORMATS}
                placeholder="Compose your template body..."
                style={{ minHeight: '250px' }}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '10px 24px', backgroundColor: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Save Template'}
            </button>
            <button onClick={resetForm}
              style={{ padding: '10px 24px', backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading templates...</div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          No templates yet. Click "New Template" to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {templates.map((t) => (
            <div key={t.id}
              style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                  Subject: {t.subject}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Created {new Date(t.created_at).toLocaleDateString()} by {t.created_by || 'System'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleEdit(t)}
                  style={{ padding: '6px 14px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(t.id)}
                  style={{ padding: '6px 14px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
