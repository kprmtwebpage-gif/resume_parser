import { createContext, useContext, useState, useRef, useCallback } from 'react'
import { uploadResume } from '../services/api'

const UploadContext = createContext(null)

export function useUpload() {
  const ctx = useContext(UploadContext)
  if (!ctx) throw new Error('useUpload must be used within UploadProvider')
  return ctx
}

export function UploadProvider({ children }) {
  const [uploads, setUploads] = useState([])
  const fileInputRef = useRef(null)

  // ---- upload a single file to the backend ----
  const uploadFileToBackend = useCallback(async (upload) => {
    try {
      const result = await uploadResume(upload.file, (progress) => {
        setUploads(prev =>
          prev.map(u => u.id === upload.id ? { ...u, progress: Math.min(progress, 95) } : u)
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
        // Auto-remove completed after 5 s
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.id !== upload.id))
        }, 5000)

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
  }, [])

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
        status: 'uploading',
        errorMessage: null,
        candidateInfo: null,
      }))

      setUploads((prev) => [...prev, ...newUploads])

      // max 3 concurrent uploads
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

  /** Number of uploads currently in progress */
  const activeCount = uploads.filter((u) => u.status === 'uploading').length

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
