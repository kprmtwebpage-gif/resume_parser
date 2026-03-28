import { useCallback, useEffect, useRef, useState } from 'react'
import { WordEditorModal } from '../editor'
import { createEmailTemplate } from '../../services/emailApi'

/**
 * CreateTemplateModal — two-phase creation:
 *   1. Enter name + subject in a small dialog
 *   2. Open full WordEditorModal for the body
 *
 * Props:
 *   isOpen, onClose, onCreated
 */
export default function CreateTemplateModal({ isOpen, onClose, onCreated }) {
  const [step, setStep] = useState(1) // 1 = meta form, 2 = body editor
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [error, setError] = useState('')
  const backdropRef = useRef(null)

  useEffect(() => {
    if (isOpen) { setName(''); setSubject(''); setError(''); setStep(1) }
  }, [isOpen])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const goToEditor = () => {
    if (!name.trim()) { setError('Template name is required'); return }
    if (!subject.trim()) { setError('Subject is required'); return }
    setError('')
    setStep(2)
  }

  const handleSaveBody = useCallback(async (html) => {
    await createEmailTemplate({ name: name.trim(), subject: subject.trim(), body: html })
    onCreated?.()
    onClose()
  }, [name, subject, onClose, onCreated])

  if (!isOpen) return null

  // Step 2: Full Word editor for body
  if (step === 2) {
    return (
      <WordEditorModal
        isOpen
        onClose={() => setStep(1)}
        title={`New Template — ${name}`}
        initialContent=""
        onSave={handleSaveBody}
        showPreview
        showVariables
      />
    )
  }

  // Step 1: Name + Subject form
  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
      }}
    >
      <div style={{
        backgroundColor: '#fff', borderRadius: '14px',
        width: '520px', maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
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
        <div style={{ padding: '20px 24px' }}>
          {error && (
            <div style={{ marginBottom: '12px', padding: '10px 14px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '13px', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Template Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. TYPE E — Custom Submission"
              style={inputStyle} />
          </div>

          <div style={{ marginBottom: '6px' }}>
            <label style={labelStyle}>Subject Line</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Candidate Submission: {{candidate_name}}"
              style={inputStyle} />
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
          <button onClick={goToEditor} style={{
            padding: '9px 22px', backgroundColor: '#2563eb', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>Next → Open Editor</button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '5px' }
const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}
