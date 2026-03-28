import { useEffect, useState } from 'react'

/**
 * Toast notification component.
 * Shows a success/error/info message in the top-right corner.
 *
 * Props:
 *  - message: string
 *  - type: 'success' | 'error' | 'info'
 *  - visible: boolean
 *  - onClose: () => void
 *  - duration: number (ms, default 3000)
 */
export default function Toast({ message, type = 'success', visible, onClose, duration = 3000 }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
      const timer = setTimeout(() => {
        setShow(false)
        setTimeout(() => onClose?.(), 300)
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [visible, duration, onClose])

  if (!visible && !show) return null

  const colors = {
    success: { bg: '#ffffff', border: '#22c55e', icon: '#22c55e', text: '#15803d' },
    error: { bg: '#ffffff', border: '#ef4444', icon: '#ef4444', text: '#b91c1c' },
    info: { bg: '#ffffff', border: '#3b82f6', icon: '#3b82f6', text: '#1d4ed8' },
  }[type]

  const icons = {
    success: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={colors.icon} strokeWidth="2" />
        <path d="M8 12l2.5 2.5L16 9" stroke={colors.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    error: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={colors.icon} strokeWidth="2" />
        <path d="M15 9l-6 6M9 9l6 6" stroke={colors.icon} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    info: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={colors.icon} strokeWidth="2" />
        <path d="M12 16v-4M12 8h.01" stroke={colors.icon} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        minWidth: '280px',
        maxWidth: '400px',
        transform: show ? 'translateX(0)' : 'translateX(120%)',
        opacity: show ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{ flexShrink: 0 }}>{icons[type]}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>
          {type === 'success' ? 'Success!' : type === 'error' ? 'Error' : 'Info'}
        </div>
        <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>
          {message}
        </div>
      </div>
      <button
        onClick={() => { setShow(false); setTimeout(() => onClose?.(), 300) }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#94a3b8',
          fontSize: '18px',
          padding: '4px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
