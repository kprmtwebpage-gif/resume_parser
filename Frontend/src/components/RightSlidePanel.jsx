import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'

/**
 * RightSlidePanel — Reusable slide-from-right panel.
 * Uses the EXACT same animation as ProfileModal (transition-all duration-300, translateX).
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - width: string (CSS width for the panel, default '50vw')
 *  - title: string (optional header title)
 *  - subtitle: string (optional header subtitle)
 *  - showHeader: boolean (default true — renders built-in header with close button)
 *  - footer: ReactNode (optional fixed footer content)
 *  - children: ReactNode (scrollable body content)
 */
export default function RightSlidePanel({
  isOpen,
  onClose,
  width = '50vw',
  title,
  subtitle,
  showHeader = true,
  footer,
  children,
}) {
  const [show, setShow] = useState(isOpen)

  useEffect(() => setShow(isOpen), [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!show) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [show, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [show])

  return createPortal(
    <>
      {/* Overlay — same as ProfileModal */}
      {show && (
        <div
          className="fixed inset-0 bg-neutral-900/50 z-50 transition-opacity duration-300"
          style={{ opacity: show ? 1 : 0 }}
          onClick={onClose}
        />
      )}

      {/* Sliding panel — same animation as ProfileModal */}
      <div
        className="fixed top-0 right-0 h-screen z-50 transition-all duration-300"
        style={{
          width,
          maxWidth: '100vw',
          height: '100vh',
          transform: show ? 'translateX(0)' : 'translateX(100%)',
          backgroundColor: '#fff',
          boxShadow: show ? '-6px 0 18px rgba(0, 0, 0, 0.1)' : 'none',
        }}
      >
        <div className="flex h-full flex-col" style={{ maxHeight: '100vh' }}>
          {/* Header (fixed) */}
          {showHeader && (
            <div
              className="flex-shrink-0"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#fff',
              }}
            >
              <div>
                {title && (
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                    {title}
                  </div>
                )}
                {subtitle && (
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    {subtitle}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 transition-all duration-300"
                style={{ color: '#64748b', backgroundColor: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                title="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Body (scrollable) */}
          <div className="flex-1" style={{ overflowY: 'auto' }}>
            {children}
          </div>

          {/* Footer (fixed) */}
          {footer && (
            <div
              className="flex-shrink-0"
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#fff',
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
