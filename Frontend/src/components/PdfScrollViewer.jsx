import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Set worker source — use the bundled worker via Vite URL resolution
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export default function PdfScrollViewer({ url, isDark, colors }) {
  const containerRef = useRef(null)
  const [numPages, setNumPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const renderTasksRef = useRef([])
  const pdfRef = useRef(null)

  useEffect(() => {
    if (!url) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setNumPages(0)

    // Cancel previous renders
    renderTasksRef.current.forEach(t => { try { t.cancel() } catch (_) {} })
    renderTasksRef.current = []
    if (containerRef.current) containerRef.current.innerHTML = ''

    // Fetch PDF as ArrayBuffer first, then hand to pdfjs
    // This avoids cross-origin issues and gives clearer error handling
    ;(async () => {
      try {
        const resp = await fetch(url)
        if (!resp.ok) {
          throw new Error(`Server returned ${resp.status} ${resp.statusText}`)
        }
        const contentType = (resp.headers.get('content-type') || '').toLowerCase()
        // Reject obvious non-PDF types (DOCX, HTML, plain text) but accept anything else
        if (contentType.includes('html') || contentType.includes('text/plain') ||
            contentType.includes('wordprocessing') || contentType.includes('msword')) {
          throw new Error('This file is not a PDF. Use the Download button instead.')
        }
        const buffer = await resp.arrayBuffer()
        if (cancelled) return
        // Quick check: PDF files start with %PDF
        const header = new Uint8Array(buffer.slice(0, 5))
        const sig = String.fromCharCode(...header)
        if (!sig.startsWith('%PDF')) {
          throw new Error('File does not appear to be a valid PDF')
        }

        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
        if (cancelled) { pdf.destroy(); return }
        pdfRef.current = pdf
        setNumPages(pdf.numPages)
        setLoading(false)

        const container = containerRef.current
        if (!container) return

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) break
          const page = await pdf.getPage(pageNum)

          const dpr = window.devicePixelRatio || 1
          // Scale to fit container width (max ~900px logical)
          const desiredWidth = Math.min(container.clientWidth - 32, 900)
          const unscaledViewport = page.getViewport({ scale: 1 })
          const scale = desiredWidth / unscaledViewport.width
          const viewport = page.getViewport({ scale })
          const hiResViewport = page.getViewport({ scale: scale * dpr })

          const wrapper = document.createElement('div')
          wrapper.style.cssText = 'display:flex;justify-content:center;margin:0 auto 16px auto;'

          const canvas = document.createElement('canvas')
          canvas.width = hiResViewport.width
          canvas.height = hiResViewport.height
          canvas.style.width = `${viewport.width}px`
          canvas.style.height = `${viewport.height}px`
          canvas.style.display = 'block'
          canvas.style.maxWidth = '100%'
          canvas.style.borderRadius = '4px'
          canvas.style.boxShadow = isDark
            ? '0 2px 8px rgba(0,0,0,0.5)'
            : '0 2px 8px rgba(0,0,0,0.15)'

          wrapper.appendChild(canvas)
          container.appendChild(wrapper)

          const ctx = canvas.getContext('2d')
          const renderTask = page.render({ canvasContext: ctx, viewport: hiResViewport })
          renderTasksRef.current.push(renderTask)

          try { await renderTask.promise } catch (e) {
            if (e?.name !== 'RenderingCancelledException') console.error(`Page ${pageNum} render error`, e)
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error('PDF load error:', e)
          setLoading(false)
          setError(e.message || 'Failed to load PDF')
        }
      }
    })()

    return () => {
      cancelled = true
      renderTasksRef.current.forEach(t => { try { t.cancel() } catch (_) {} })
      renderTasksRef.current = []
      if (pdfRef.current) { pdfRef.current.destroy(); pdfRef.current = null }
    }
  }, [url])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>
          Loading PDF…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
        <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ color: isDark ? '#94a3b8' : '#9ca3af' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-base font-medium" style={{ color: colors?.text || '#374151' }}>
          Failed to load PDF
        </p>
        <p className="text-sm" style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>
          {error}
        </p>
        {url && (
          <a
            href={url}
            download
            className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Download Instead
          </a>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden p-4"
      style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
    />
  )
}
