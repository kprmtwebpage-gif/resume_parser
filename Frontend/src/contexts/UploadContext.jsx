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
                ? { ...u, progress: 100, status: 'not_a_resume', errorMessage: status.message || 'Corrupt Format / Not a Resume. Please check and upload.' }
                : u
            )
          )
          return
        } else if (status.status === 'failed') {
          setUploads(prev =>
            prev.map(u =>
              u.id === upload.id
                ? { ...u, progress: 100, status: 'failed', errorMessage: status.message || 'Corrupt Format / Parse Error. Please check and upload.' }
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
      } catch (err) {
        const httpStatus = err?.response?.status
        // 404 means the placeholder was deleted (parse failed or not-a-resume)
        // Stop polling and surface it as a failure so the user can re-upload
        if (httpStatus === 404) {
          setUploads(prev =>
            prev.map(u =>
              u.id === upload.id
                ? { ...u, progress: 100, status: 'failed', errorMessage: 'Corrupt Format / Not a Resume. Please check and upload.' }
                : u
            )
          )
          return
        }
        // 500 errors (e.g. pool exhaustion under heavy load) — keep retrying,
        // the server will recover once connections free up.
        // Other network errors — also keep trying
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
        // Fire-and-forget: worker moves to next file immediately; polling
        // updates this card's status in the background.
        setUploads(prev =>
          prev.map(u =>
            u.id === upload.id
              ? { ...u, progress: 50, status: 'uploading' }
              : u
          )
        )
        pollParseStatus(upload, result.id)

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

      if (validFiles.length > 50) {
        alert('You can upload a maximum of 50 resumes at a time.')
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

      // 8 concurrent uploads — feeds the 12-slot server parse queue
      const runWithConcurrency = async (items, concurrency = 8) => {
        console.log(`[Upload DEBUG] Starting upload of ${items.length} files with ${Math.min(concurrency, items.length)} workers`)
        items.forEach((u, i) => console.log(`[Upload DEBUG] Queued [${i+1}/${items.length}]: ${u.file.name} (${u.file.size} bytes)`))
        const queue = [...items]
        let dispatched = 0
        const workers = Array.from(
          { length: Math.min(concurrency, items.length) },
          async (_, workerIdx) => {
            while (queue.length > 0) {
              const item = queue.shift()
              if (item) {
                dispatched++
                console.log(`[Upload DEBUG] Worker-${workerIdx} dispatching [${dispatched}]: ${item.file.name}`)
                await uploadFileToBackend(item)
                console.log(`[Upload DEBUG] Worker-${workerIdx} finished: ${item.file.name}, queue remaining: ${queue.length}`)
              }
            }
          }
        )
        await Promise.all(workers)
        console.log(`[Upload DEBUG] All workers done. Total dispatched: ${dispatched} / ${items.length}`)
      }

      runWithConcurrency(newUploads, 8)
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
