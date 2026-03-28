import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listEmailTemplates } from '../services/emailApi'
import TemplatesList from '../components/templates/TemplatesList'
import CreateTemplateModal from '../components/email/CreateTemplateModal'
import TemplatePreviewModal from '../components/email/TemplatePreviewModal'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [previewId, setPreviewId] = useState(null)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const navigate = useNavigate()

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/customer')
    }
  }

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listEmailTemplates()
      setTemplates(data || [])
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      minHeight: 'calc(100vh - 56px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header bar */}
      <div style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '28px 0 24px',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px' }}>
          {/* Breadcrumb */}
          <div style={{ marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              onClick={() => navigate('/customer')}
              style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}
            >
              Customer
            </span>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ color: '#64748b' }}>Templates</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{
                margin: 0, fontSize: '26px', fontWeight: 700, color: '#0f172a',
                letterSpacing: '-0.02em',
              }}>
                Email Templates
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#64748b' }}>
                Manage and preview your email templates
              </p>
            </div>
            <button
              onClick={handleBack}
              style={{
                backgroundColor: '#f1f5f9', color: '#374151',
                border: '1px solid #e2e8f0', borderRadius: '8px',
                padding: '8px 20px', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
            >
              &#8592; Back
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 32px' }}>
        <TemplatesList
          standalone
          templates={templates}
          loading={loading}
          previewId={previewId}
          onTogglePreview={(id) => setPreviewId(prev => prev === id ? null : id)}
          onPreviewClick={(t) => setPreviewTemplate(t)}
          onCreateClick={() => setShowCreate(true)}
        />
      </div>

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadTemplates}
      />

      {/* Preview/Edit Template Modal */}
      <TemplatePreviewModal
        isOpen={!!previewTemplate}
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onUpdated={() => { setPreviewTemplate(null); loadTemplates() }}
      />
    </div>
  )
}
