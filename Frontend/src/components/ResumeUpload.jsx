import { useState, useRef, useCallback, useEffect } from 'react'
import { 
  PlusIcon, 
  DocumentIcon, 
  XMarkIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline'
import { uploadResume, fetchStats } from '../services/api'

export default function ResumeUpload({ onUploadSuccess }) {
  const [uploads, setUploads] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [resumeCount, setResumeCount] = useState(null)
  const [hoveredError, setHoveredError] = useState(null)
  const fileInputRef = useRef(null)

  // Fetch resume count on mount and after successful uploads
  const fetchResumeCount = useCallback(async () => {
    try {
      const stats = await fetchStats()
      setResumeCount(stats.total_candidates)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }, [])

  useEffect(() => {
    fetchResumeCount()
  }, [fetchResumeCount])

  const handleFileSelect = useCallback((files) => {
    const validFiles = Array.from(files).filter(file => {
      const ext = file.name.toLowerCase()
      return ext.endsWith('.pdf') || ext.endsWith('.doc') || ext.endsWith('.docx')
    })

    if (validFiles.length === 0) {
      alert('Please select PDF, DOC, or DOCX files only.')
      return
    }

    // Add files to upload queue
    const newUploads = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name,
      progress: 0,
      status: 'uploading', // uploading, completed, failed
      errorMessage: null,
      candidateInfo: null,
    }))

    setUploads(prev => [...prev, ...newUploads])

    // Start uploading each file
    newUploads.forEach(upload => {
      uploadFileToBackend(upload)
    })
  }, [])

  const uploadFileToBackend = async (upload) => {
    try {
      // Use the API function with progress tracking
      const result = await uploadResume(upload.file, (progress) => {
        setUploads(prev => 
          prev.map(u => u.id === upload.id 
            ? { ...u, progress: Math.min(progress, 95) } // Cap at 95% until server responds
            : u
          )
        )
      })
      
      // Handle response based on status
      if (result.status === 'completed') {
        setUploads(prev => 
          prev.map(u => u.id === upload.id 
            ? { 
                ...u, 
                progress: 100, 
                status: 'completed',
                candidateInfo: {
                  name: result.name,
                  email: result.email,
                  jobTitle: result.job_title,
                }
              } 
            : u
          )
        )
        
        // Refresh resume count after successful upload
        fetchResumeCount()
        
        // Notify parent to refresh candidate list
        if (onUploadSuccess) {
          onUploadSuccess()
        }
        
        // Auto-remove completed uploads after 5 seconds
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.id !== upload.id))
        }, 5000)

      } else if (result.status === 'duplicate') {
        setUploads(prev =>
          prev.map(u => u.id === upload.id
            ? {
                ...u,
                progress: 100,
                status: 'duplicate',
                candidateInfo: {
                  name: result.name,
                  email: result.email,
                  jobTitle: result.job_title,
                }
              }
            : u
          )
        )
        // Auto-remove duplicate notices after 7 seconds
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.id !== upload.id))
        }, 7000)

      } else if (result.status === 'failed') {
        setUploads(prev => 
          prev.map(u => u.id === upload.id 
            ? { 
                ...u, 
                progress: 100, 
                status: 'failed',
                errorMessage: result.error || result.message || 'Unknown error occurred'
              } 
            : u
          )
        )
      }
      
    } catch (error) {
      // Network or server error
      const errorMsg = error.response?.data?.detail 
        || error.message 
        || 'Failed to upload resume. Please try again.'
      
      setUploads(prev => 
        prev.map(u => u.id === upload.id 
          ? { ...u, progress: 100, status: 'failed', errorMessage: errorMsg } 
          : u
        )
      )
    }
  }

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleInputChange = (e) => {
    if (e.target.files?.length) {
      handleFileSelect(e.target.files)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const removeUpload = (id) => {
    setUploads(prev => prev.filter(u => u.id !== id))
  }

  const retryUpload = (upload) => {
    setUploads(prev => 
      prev.map(u => u.id === upload.id 
        ? { ...u, progress: 0, status: 'uploading', errorMessage: null } 
        : u
      )
    )
    uploadFileToBackend(upload)
  }

  const getStatusIcon = (upload) => {
    if (upload.status === 'completed') {
      return <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
    }
    if (upload.status === 'duplicate') {
      return <InformationCircleIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
    }
    if (upload.status === 'failed') {
      return (
        <div className="relative">
          <ExclamationCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
        </div>
      )
    }
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          removeUpload(upload.id)
        }}
        className="p-0.5 hover:bg-neutral-200 rounded transition-colors"
      >
        <XMarkIcon className="h-3.5 w-3.5 text-neutral-500" />
      </button>
    )
  }

  const getStatusText = (upload) => {
    switch (upload.status) {
      case 'completed':
        return 'Completed'
      case 'duplicate':
        return 'File already exists'
      case 'failed':
        return 'Failed'
      default:
        return 'Uploading...'
    }
  }

  const getProgressBarColor = (upload) => {
    switch (upload.status) {
      case 'completed':
        return 'bg-green-500'
      case 'duplicate':
        return 'bg-amber-400'
      case 'failed':
        return 'bg-red-500'
      default:
        return 'bg-brand-500'
    }
  }

  return (
    <div className="border-t border-neutral-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-900">Resume Upload</h3>
        {resumeCount !== null && (
          <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
            {resumeCount} resumes
          </span>
        )}
      </div>
      
      {/* Upload Area */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative cursor-pointer rounded-lg border-2 border-dashed p-6
          flex flex-col items-center justify-center
          transition-all duration-200
          ${isDragging 
            ? 'border-brand-500 bg-brand-50' 
            : 'border-neutral-300 hover:border-brand-400 hover:bg-neutral-50'
          }
        `}
      >
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center mb-2
          ${isDragging ? 'bg-brand-500' : 'bg-brand-100'}
          transition-colors duration-200
        `}>
          <PlusIcon className={`h-5 w-5 ${isDragging ? 'text-white' : 'text-brand-600'}`} />
        </div>
        <span className="text-sm font-medium text-neutral-700">Upload Resume</span>
        <span className="text-xs text-neutral-500 mt-1">PDF, DOC, DOCX</span>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* Upload Progress List */}
      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploads.map(upload => (
            <div 
              key={upload.id} 
              className={`rounded-lg p-3 border ${
                upload.status === 'failed' 
                  ? 'bg-red-50 border-red-200'
                  : upload.status === 'duplicate'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <div className="flex items-start gap-2">
                <DocumentIcon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                  upload.status === 'failed' ? 'text-red-500'
                  : upload.status === 'duplicate' ? 'text-amber-500'
                  : 'text-neutral-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-medium truncate ${
                      upload.status === 'failed' ? 'text-red-800'
                      : upload.status === 'duplicate' ? 'text-amber-800'
                      : 'text-neutral-800'
                    }`}>
                      {upload.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {/* Error info icon with tooltip */}
                      {upload.status === 'failed' && upload.errorMessage && (
                        <div 
                          className="relative"
                          onMouseEnter={() => setHoveredError(upload.id)}
                          onMouseLeave={() => setHoveredError(null)}
                        >
                          <InformationCircleIcon className="h-4 w-4 text-red-500 cursor-help" />
                          {hoveredError === upload.id && (
                            <div className="absolute right-0 bottom-full mb-1 z-50 w-48 p-2 bg-neutral-900 text-white text-xs rounded shadow-lg">
                              {upload.errorMessage}
                              <div className="absolute right-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-neutral-900" />
                            </div>
                          )}
                        </div>
                      )}
                      {getStatusIcon(upload)}
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-1.5">
                    <div className={`h-1.5 rounded-full overflow-hidden ${
                      upload.status === 'failed' ? 'bg-red-200'
                      : upload.status === 'duplicate' ? 'bg-amber-200'
                      : 'bg-neutral-200'
                    }`}>
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(upload)}`}
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className={`text-[10px] ${
                        upload.status === 'failed' ? 'text-red-600'
                        : upload.status === 'duplicate' ? 'text-amber-600'
                        : 'text-neutral-500'
                      }`}>
                        {getStatusText(upload)}
                      </span>
                      {upload.status === 'failed' ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            retryUpload(upload)
                          }}
                          className="text-[10px] font-medium text-brand-600 hover:text-brand-700"
                        >
                          Retry
                        </button>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-600">
                          {upload.progress}%
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Candidate info for successful uploads */}
                  {upload.status === 'completed' && upload.candidateInfo && (
                    <div className="mt-2 pt-2 border-t border-green-200 text-[10px] text-green-700">
                      {upload.candidateInfo.name && (
                        <div>Name: {upload.candidateInfo.name}</div>
                      )}
                      {upload.candidateInfo.jobTitle && (
                        <div>Title: {upload.candidateInfo.jobTitle}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
