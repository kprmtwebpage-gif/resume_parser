import { useState } from 'react'

/**
 * TemplatesList — reusable templates list component.
 * Used in both the Customer Create page (Templates tab) and the standalone Templates page.
 *
 * Props:
 *  - templates: array of template objects
 *  - loading: boolean
 *  - previewId: number|null — currently expanded template id
 *  - onTogglePreview: (id) => void — toggle expand/collapse
 *  - onPreviewClick: (template) => void — open preview modal
 *  - onCreateClick: () => void — open create template modal
 *  - standalone: boolean — when true, uses enhanced card layout for the full page
 */
export default function TemplatesList({ templates, loading, previewId, onTogglePreview, onPreviewClick, onCreateClick, standalone }) {
  const [hoveredCard, setHoveredCard] = useState(null)
  const [hoveredBtn, setHoveredBtn] = useState(null)

  if (loading) {
    return (
      <div style={{
        padding: standalone ? '80px 20px' : '40px',
        textAlign: 'center', color: '#94a3b8', fontSize: '14px',
      }}>
        <div style={{
          display: 'inline-block', width: '28px', height: '28px',
          border: '3px solid #e2e8f0', borderTopColor: '#2563eb',
          borderRadius: '50%', animation: 'tplSpin .7s linear infinite',
        }} />
        <div style={{ marginTop: '12px' }}>Loading templates...</div>
        <style>{`@keyframes tplSpin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ---------- Embedded (tab) layout — unchanged ----------
  if (!standalone) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>
            {templates.length} template{templates.length !== 1 ? 's' : ''} available
          </div>
          <button onClick={onCreateClick} style={{
            padding: '7px 16px', backgroundColor: '#2563eb', color: '#fff',
            border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer',
          }}>+ Create Template</button>
        </div>
        {(!templates || templates.length === 0) ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
            No templates configured yet. Click &quot;+ Create Template&quot; to add one.
          </div>
        ) : templates.map((t) => (
          <div key={t.id}
            style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Subject: {t.subject}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => onPreviewClick(t)}
                  style={{ padding: '5px 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                  Preview
                </button>
                <button onClick={() => onTogglePreview(t.id)}
                  style={{ padding: '5px 12px', backgroundColor: '#fff', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                  {previewId === t.id ? 'Hide' : 'Expand'}
                </button>
              </div>
            </div>
            {previewId === t.id && (
              <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px', backgroundColor: '#fff' }}>
                <div className="template-preview" dangerouslySetInnerHTML={{ __html: t.body }} />
                <style>{`
                  .template-preview table { border-collapse: collapse; width: 100%; table-layout: auto; }
                  .template-preview td, .template-preview th { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
                  .template-preview th { font-weight: 700; background-color: #f0f0f0; }
                `}</style>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // ---------- Standalone (full page) layout — enhanced ----------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Action bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '4px',
      }}>
        <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
          {templates.length} template{templates.length !== 1 ? 's' : ''} available
        </div>
        <button onClick={onCreateClick} style={{
          padding: '10px 22px', backgroundColor: '#2563eb', color: '#fff',
          border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.2s',
          boxShadow: '0 1px 3px rgba(37,99,235,0.3)',
        }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1d4ed8'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(37,99,235,0.3)' }}
        >+ Create Template</button>
      </div>

      {/* Empty state */}
      {(!templates || templates.length === 0) ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '15px',
          backgroundColor: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
          No templates configured yet. Click &quot;+ Create Template&quot; to add one.
        </div>
      ) : (
        /* Template cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {templates.map((t) => {
            const isHovered = hoveredCard === t.id
            const isExpanded = previewId === t.id
            return (
              <div key={t.id}
                onMouseEnter={() => setHoveredCard(t.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  backgroundColor: '#fff',
                  border: `1px solid ${isHovered ? '#bfdbfe' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: isHovered
                    ? '0 4px 16px rgba(0,0,0,0.07)'
                    : '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Card header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '18px 22px',
                  flexWrap: 'wrap', gap: '12px',
                }}>
                  <div style={{ flex: '1 1 auto', minWidth: '200px' }}>
                    <div style={{
                      fontSize: '15px', fontWeight: 600, color: '#1e293b',
                      lineHeight: '1.4',
                    }}>
                      {t.name}
                    </div>
                    <div style={{
                      fontSize: '13px', color: '#64748b', marginTop: '4px',
                      lineHeight: '1.4',
                    }}>
                      Subject: {t.subject}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => onPreviewClick(t)}
                      onMouseEnter={() => setHoveredBtn(`preview-${t.id}`)}
                      onMouseLeave={() => setHoveredBtn(null)}
                      style={{
                        padding: '7px 16px', backgroundColor: hoveredBtn === `preview-${t.id}` ? '#1d4ed8' : '#2563eb',
                        color: '#fff', border: 'none', borderRadius: '7px',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => onTogglePreview(t.id)}
                      onMouseEnter={() => setHoveredBtn(`expand-${t.id}`)}
                      onMouseLeave={() => setHoveredBtn(null)}
                      style={{
                        padding: '7px 16px',
                        backgroundColor: hoveredBtn === `expand-${t.id}` ? '#f1f5f9' : '#fff',
                        color: '#334155', border: '1px solid #e2e8f0', borderRadius: '7px',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                </div>

                {/* Expanded preview */}
                {isExpanded && (
                  <div style={{
                    borderTop: '1px solid #e2e8f0',
                    padding: '20px 22px',
                    backgroundColor: '#fafbfc',
                  }}>
                    <div className="tpl-standalone-preview" dangerouslySetInnerHTML={{ __html: t.body }} />
                    <style>{`
                      .tpl-standalone-preview table {
                        border-collapse: collapse;
                        width: 100%;
                        table-layout: auto;
                      }
                      .tpl-standalone-preview td,
                      .tpl-standalone-preview th {
                        border: 1px solid #000;
                        padding: 6px 8px;
                        vertical-align: top;
                      }
                      .tpl-standalone-preview th {
                        font-weight: 700;
                        background-color: #f0f0f0;
                      }
                    `}</style>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
