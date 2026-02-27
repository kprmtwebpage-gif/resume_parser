import { XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import mammoth from 'mammoth'
import PdfScrollViewer from './PdfScrollViewer.jsx'
import { useTheme } from '../contexts/ThemeContext'

export default function ResumeViewer({ isOpen, onClose, resumeUrl, fileName }) {
  const [loadError, setLoadError] = useState(false)
  const [docxHtml, setDocxHtml] = useState(null)
  const [docxLoading, setDocxLoading] = useState(false)
  const [docxError, setDocxError] = useState(false)
  const { isDark, colors } = useTheme()

  // Lock body scroll when modal opens
  useEffect(() => {
    if (!isOpen) return

    const body = document.body
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth

    // Save current scroll position
    const scrollY = window.scrollY

    // Lock scroll
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.overflowY = 'scroll'
    body.style.paddingRight = `${scrollBarWidth}px`

    // Disable pointer events on root app
    const appRoot = document.getElementById('root')
    if (appRoot) {
      appRoot.style.pointerEvents = 'none'
    }

    // Reset error state
    setLoadError(false)
    setDocxHtml(null)
    setDocxError(false)

    return () => {
      // Restore scroll
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      body.style.overflowY = ''
      body.style.paddingRight = ''
      window.scrollTo(0, scrollY)

      // Re-enable pointer events
      if (appRoot) {
        appRoot.style.pointerEvents = ''
      }
    }
  }, [isOpen])

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Convert DOCX/DOC to HTML via mammoth when opened
  useEffect(() => {
    if (!isOpen || !resumeUrl) return
    const lower = (fileName || '').toLowerCase()
    if (!lower.endsWith('.docx') && !lower.endsWith('.doc')) return

    setDocxLoading(true)
    setDocxHtml(null)
    setDocxError(false)

    fetch(resumeUrl)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch')
        return r.arrayBuffer()
      })
      .then(buffer => mammoth.convertToHtml({ arrayBuffer: buffer }))
      .then(result => {
        setDocxHtml(result.value)
        setDocxLoading(false)
      })
      .catch(() => {
        setDocxError(true)
        setDocxLoading(false)
      })
  }, [isOpen, resumeUrl, fileName])



  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  const handleIframeError = useCallback(() => {
    setLoadError(true)
  }, [])

  if (!isOpen || !resumeUrl) return null

  const isPdf = fileName?.toLowerCase().endsWith('.pdf')
  const isDocx = fileName?.toLowerCase().endsWith('.docx')
  const isDoc = fileName?.toLowerCase().endsWith('.doc')

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center"
      style={{ 
        zIndex: 99999,
        pointerEvents: 'auto'
      }}
      onClick={handleBackdropClick}
    >
      <div 
        className="relative bg-white rounded-lg shadow-2xl flex flex-col"
        style={{ 
          width: '90vw', 
          height: '90vh', 
          maxWidth: '1400px',
          pointerEvents: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-white rounded-t-lg">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-neutral-900">Resume Viewer</h2>
            <p className="text-sm text-neutral-600 truncate mt-1">
              <span className="font-medium">File:</span> {fileName || 'resume'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-4 p-2 rounded-button hover:bg-neutral-100 transition-colors"
            aria-label="Close viewer"
            type="button"
          >
            <XMarkIcon className="h-6 w-6 text-neutral-700" />
          </button>
        </div>

        {/* Viewer Content */}
        <div 
          className="flex-1 bg-white overflow-auto" 
          style={{ minHeight: 0 }}
        >
          {(loadError && !isDocx && !isDoc) ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="text-neutral-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-neutral-700 mb-2">Unable to preview this document</p>
              <p className="text-sm text-neutral-500 mb-4">This file format cannot be previewed in the browser.</p>
              <button onClick={onClose} className="btn-primary">Close and use Download button</button>
            </div>
          ) : (isDocx || isDoc) ? (
            docxLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-neutral-500">Rendering document...</p>
                </div>
              </div>
            ) : docxError ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="text-neutral-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-neutral-700 mb-2">Failed to load document</p>
                <p className="text-sm text-neutral-500 mb-4">Could not render this file. Use the Download button to open it in Word.</p>
                <button onClick={onClose} className="btn-primary">Close and use Download button</button>
              </div>
            ) : (
              <div
                className="p-8 max-w-4xl mx-auto w-full prose prose-neutral"
                style={{ fontFamily: 'Georgia, serif', fontSize: '14px', lineHeight: '1.7', color: '#1a1a1a' }}
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            )
          ) : (
            <>
              {isPdf ? (
                <PdfScrollViewer
                  url={resumeUrl}
                  isDark={isDark}
                  colors={colors}
                />
              ) : (
                <iframe
                  src={resumeUrl}
                  className="w-full h-full"
                  title="Resume Viewer"
                  onError={handleIframeError}
                  style={{ border: 'none', minHeight: '100%' }}
                />
              )}
            </>
          )}
        </div>

        {/* Footer Info */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between text-xs text-neutral-600 rounded-b-lg">
          <div>
            {isPdf && <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-700 font-medium">PDF</span>}
            {isDocx && <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">DOCX</span>}
            {isDoc && <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">DOC</span>}
          </div>
          <div className="text-neutral-500">
            Press <kbd className="px-2 py-0.5 bg-white border border-neutral-300 rounded text-xs font-mono">ESC</kbd> to close
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
