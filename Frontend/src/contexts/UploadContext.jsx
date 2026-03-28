import { createContext, useContext, useState, useRef, useCallback } from 'react'
import { uploadResume, checkUploadStatus } from '../services/api'

const UploadContext = createContext(null)

export function useUpload() {
  const ctx = useContext(UploadContext)
  if (!ctx) throw new Error('useUpload must be used within UploadProvider')
  return ctx
}

export function UploadProvider({ children }) {
  const [uploads, setUploads] = useState([])
  const fileInputRef = useRef(null)

  // ---- poll for background parse completion ----
  const pollParseStatus = useCallback(async (upload, candidateId) => {
    // Phase 1: wait in queue — no timeout, just keep polling every 2s until
    // the file leaves the queue (queue_ahead drops to 0 or status changes)
    // Phase 2: once parsing has started, allow max 90 attempts (3 min) to complete
    const MAX_PARSE_ATTEMPTS = 180 // 180 * 2s = 6 min — covers OCR-heavy PDFs (tesseract on scanned docs)
    let parseAttempts = 0
    let parsingStarted = false

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise(r => setTimeout(r, 2000))
      try {
        const status = await checkUploadStatus(candidateId)
        if (status.status === 'completed') {
          setUploads(prev =>
            prev.map(u =>
              u.id === upload.id
                ? {
                    ...u,
                    progress: 100,
                    status: 'completed',
                    candidateInfo: {
                      name: status.name,
                      email: status.email,
                      jobTitle: status.job_title,
                    },
                  }
                : u
            )
          )
          setTimeout(() => {
            setUploads(prev => prev.filter(u => u.id !== upload.id))
          }, 5000)
          return
        } else if (status.status === 'not_a_resume') {
          setUploads(prev =>
            prev.map(u =>
              u.id === upload.id
                ? { ...u, progress: 100, status: 'not_a_resume', errorMessage: status.message || 'This file does not appear to be a resume' }
                : u
            )
          )
          return
        } else if (status.status === 'failed') {
          setUploads(prev =>
            prev.map(u =>
              u.id === upload.id
                ? { ...u, progress: 100, status: 'failed', errorMessage: status.message || 'Parsing failed' }
                : u
            )
          )
          return
        }

        const queueAhead = status.queue_ahead ?? 0

        if (queueAhead === 0) {
          // File has left the queue — parsing is now active
          parsingStarted = true
        }

        if (parsingStarted) {
          parseAttempts++
          if (parseAttempts >= MAX_PARSE_ATTEMPTS) {
            // Parsing took too long after actually starting — mark background
            break
          }
        }

        // Update progress indicator
        const progressVal = parsingStarted
          ? Math.min(60 + parseAttempts, 95)
          : Math.min(30 + Math.floor(parseAttempts / 2), 49)
        setUploads(prev =>
          prev.map(u =>
            u.id === upload.id
              ? { ...u, progress: progressVal, queueAhead }
              : u
          )
        )
      } catch {
        // Polling error — keep trying
      }
    }
    // Polling window elapsed — parsing is still running in the background.
    // Mark as 'background' so the UI shows a helpful message instead of an error.
    setUploads(prev =>
      prev.map(u =>
        u.id === upload.id
          ? { ...u, progress: 100, status: 'background', errorMessage: 'Still parsing — results will appear in search once complete' }
          : u
      )
    )
  }, [])

  // ---- upload a single file to the backend ----
  const uploadFileToBackend = useCallback(async (upload) => {
    try {
      // Transition from pending → uploading
      setUploads(prev =>
        prev.map(u => u.id === upload.id ? { ...u, status: 'uploading' } : u)
      )
      const result = await uploadResume(upload.file, (progress) => {
        setUploads(prev =>
          prev.map(u => u.id === upload.id ? { ...u, progress: Math.min(progress, 50) } : u)
        )
      })

      if (result.status === 'completed') {
        setUploads(prev =>
          prev.map(u =>
            u.id === upload.id
              ? {
                  ...u,
                  progress: 100,
                  status: 'completed',
                  candidateInfo: {
                    name: result.name,
                    email: result.email,
                    jobTitle: result.job_title,
                  },
                }
              : u
          )
        )
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.id !== upload.id))
        }, 5000)

      } else if (result.status === 'processing') {
        // Backend accepted file — parsing in background. Poll for result.
        setUploads(prev =>
          prev.map(u =>
            u.id === upload.id
              ? { ...u, progress: 50, status: 'uploading' }
              : u
          )
        )
        await pollParseStatus(upload, result.id)

      } else if (result.status === 'duplicate') {
        setUploads(prev =>
          prev.map(u =>
            u.id === upload.id
              ? {
                  ...u,
                  progress: 100,
                  status: 'duplicate',
                  candidateInfo: {
                    name: result.name,
                    email: result.email,
                    jobTitle: result.job_title,
                  },
                }
              : u
          )
        )
        // Auto-remove duplicate notices after 7 s
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.id !== upload.id))
        }, 7000)

      } else if (result.status === 'failed') {
        setUploads(prev =>
          prev.map(u =>
            u.id === upload.id
              ? {
                  ...u,
                  progress: 100,
                  status: 'failed',
                  errorMessage:
                    result.error || result.message || 'Unknown error occurred',
                }
              : u
          )
        )
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.detail ||
        error.message ||
        'Failed to upload resume. Please try again.'

      setUploads(prev =>
        prev.map(u =>
          u.id === upload.id
            ? { ...u, progress: 100, status: 'failed', errorMessage: errorMsg }
            : u
        )
      )
    }
  }, [pollParseStatus])

  // ---- accept files, enqueue, and run with concurrency ----
  const handleFileSelect = useCallback(
    (files) => {
      const validFiles = Array.from(files).filter((file) => {
        const ext = file.name.toLowerCase()
        return (
          ext.endsWith('.pdf') ||
          ext.endsWith('.doc') ||
          ext.endsWith('.docx')
        )
      })

      if (validFiles.length === 0) {
        alert('Please select PDF, DOC, or DOCX files only.')
        return
      }

      const newUploads = validFiles.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        progress: 0,
        status: 'pending',
        errorMessage: null,
        candidateInfo: null,
      }))

      setUploads((prev) => [...prev, ...newUploads])

      // 3 concurrent uploads — fast but each file's timeout only counts from
      // when it actually starts parsing, not from when it enters the queue
      const runWithConcurrency = async (items, concurrency = 3) => {
        const queue = [...items]
        const workers = Array.from(
          { length: Math.min(concurrency, items.length) },
          async () => {
            while (queue.length > 0) {
              const item = queue.shift()
              if (item) await uploadFileToBackend(item)
            }
          }
        )
        await Promise.all(workers)
      }

      runWithConcurrency(newUploads, 3)
    },
    [uploadFileToBackend]
  )

  // ---- helpers ----
  const removeUpload = useCallback((id) => {
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }, [])

  const retryUpload = useCallback(
    (upload) => {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id
            ? { ...u, progress: 0, status: 'uploading', errorMessage: null }
            : u
        )
      )
      uploadFileToBackend(upload)
    },
    [uploadFileToBackend]
  )

  /** Number of uploads currently in progress or pending */
  const activeCount = uploads.filter((u) => u.status === 'uploading' || u.status === 'pending').length

  return (
    <UploadContext.Provider
      value={{
        uploads,
        fileInputRef,
        handleFileSelect,
        removeUpload,
        retryUpload,
        activeCount,
      }}
    >
      {children}
    </UploadContext.Provider>
  )
}
