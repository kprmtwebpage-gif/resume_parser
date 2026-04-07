import { useEffect, useRef, useState } from 'react'
import { listEmailTemplates, listCandidateEmailTemplates } from '../../services/emailApi'

/**
 * TemplatePickerModal — centered modal that lists email template names.
 * On click, fires onSelect(template) and closes.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onSelect: (template: { id, name, subject, body }) => void
 *  - templateType: 'candidate' | 'common' | null — which templates to load
 *  - useCandidateTemplates: boolean — legacy alias for templateType='candidate'
 */
export default function TemplatePickerModal({ isOpen, onClose, onSelect, templateType = null, useCandidateTemplates = false }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [hoveredId, setHoveredId] = useState(null)
  const backdropRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    const isCandidateType = templateType === 'candidate' || useCandidateTemplates
    let loader
    if (isCandidateType) {
      loader = listCandidateEmailTemplates()
    } else if (templateType === 'common') {
      loader = listEmailTemplates({ type: 'COMMON' })
    } else {
      loader = listEmailTemplates()
    }
    loader
      .then((data) => setTemplates(data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [isOpen, templateType, useCandidateTemplates])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

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
        backgroundColor: 'rgba(0,0,0,0.4)',
        animation: 'tplFadeIn 0.18s ease',
      }}
    >
      <div style={{
        backgroundColor: '#fff', borderRadius: '12px',
        width: '440px', maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        animation: 'tplSlideUp 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
            {(templateType === 'candidate' || useCandidateTemplates) ? 'Candidate Email Templates' : 'Email Templates'}
          </h3>
          <button
            onClick={onClose}
            style={{
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', backgroundColor: '#f1f5f9', borderRadius: '6px',
              cursor: 'pointer', fontSize: '16px', color: '#64748b',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: '14px' }}>
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: '14px' }}>
              No templates available. Create templates in Admin → Email Templates.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => { onSelect(t); onClose() }}
                  onMouseEnter={() => setHoveredId(t.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                    backgroundColor: hoveredId === t.id ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${hoveredId === t.id ? '#bfdbfe' : '#e2e8f0'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                    Subject: {t.subject}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tplFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tplSlideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}
