import { useState, useCallback } from 'react'
import { 
  DocumentIcon, 
  XMarkIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  InformationCircleIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline'
import { useUpload } from '../contexts/UploadContext'

export default function Upload() {
  const { uploads, fileInputRef, handleFileSelect, removeUpload, retryUpload } = useUpload()
  const [isDragging, setIsDragging] = useState(false)
  const [hoveredError, setHoveredError] = useState(null)

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
    e.target.value = ''
  }

  const getStatusIcon = (upload) => {
    if (upload.status === 'completed') {
      return <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
    }
    if (upload.status === 'duplicate') {
      return <InformationCircleIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />
    }
    if (upload.status === 'failed') {
      return <ExclamationCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
    }
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          removeUpload(upload.id)
        }}
        className="p-0.5 hover:bg-neutral-200 rounded transition-colors"
      >
        <XMarkIcon className="h-4 w-4 text-neutral-500" />
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
      case 'pending':
        return 'Queued'
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
      case 'pending':
        return 'bg-neutral-400'
      default:
        return 'bg-brand-500'
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-neutral-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Upload Resumes</h1>
          <p className="text-neutral-600">
            Upload your resume files to add candidates to your database.
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          {/* Supported Fields Info */}
          <div className="mb-6 text-sm text-neutral-600">
            <p className="mb-2">Supported fields that will be automatically extracted:</p>
            <div className="flex flex-wrap gap-2">
              {['Name', 'Email', 'Phone', 'Job Title', 'Skills', 'Experience', 'Education', 'Location'].map(field => (
                <span key={field} className="px-2 py-1 bg-neutral-100 rounded text-xs text-neutral-700">
                  {field}
                </span>
              ))}
            </div>
          </div>

          {/* Upload Area */}
          <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative cursor-pointer rounded-lg border-2 border-dashed p-12
              flex flex-col items-center justify-center
              transition-all duration-200
              ${isDragging 
                ? 'border-brand-500 bg-brand-50' 
                : 'border-neutral-300 hover:border-brand-400 hover:bg-neutral-50'
              }
            `}
          >
            <div className={`
              w-16 h-16 rounded-full flex items-center justify-center mb-4
              ${isDragging ? 'bg-brand-500' : 'bg-brand-100'}
              transition-colors duration-200
            `}>
              <ArrowUpTrayIcon className={`h-8 w-8 ${isDragging ? 'text-white' : 'text-brand-600'}`} />
            </div>
            <span className="text-base font-medium text-neutral-700 mb-1">Select file</span>
            <span className="text-sm text-neutral-500">or drop files to upload</span>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              onChange={handleInputChange}
              className="hidden"
            />
          </div>

          {/* Supported Formats */}
          <p className="mt-4 text-xs text-neutral-500 text-center">
            Supported file formats: PDF, DOC, DOCX
          </p>

          {/* Upload Progress List */}
          {uploads.length > 0 && (
            <div className="mt-6 space-y-3">
              {uploads.map(upload => (
                <div 
                  key={upload.id} 
                  className={`rounded-lg p-4 border ${
                    upload.status === 'failed' 
                      ? 'bg-red-50 border-red-200' 
                      : upload.status === 'completed'
                      ? 'bg-green-50 border-green-200'
                      : upload.status === 'duplicate'
                      ? 'bg-amber-50 border-amber-200'
                      : upload.status === 'pending'
                      ? 'bg-neutral-50 border-neutral-300'
                      : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <DocumentIcon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                      upload.status === 'failed' ? 'text-red-500' 
                      : upload.status === 'completed' ? 'text-green-500'
                      : upload.status === 'duplicate' ? 'text-amber-500'
                      : 'text-neutral-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-medium truncate ${
                          upload.status === 'failed' ? 'text-red-800' 
                          : upload.status === 'completed' ? 'text-green-800'
                          : upload.status === 'duplicate' ? 'text-amber-800'
                          : 'text-neutral-800'
                        }`}>
                          {upload.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {upload.status === 'failed' && upload.errorMessage && (
                            <div 
                              className="relative"
                              onMouseEnter={() => setHoveredError(upload.id)}
                              onMouseLeave={() => setHoveredError(null)}
                            >
                              <InformationCircleIcon className="h-5 w-5 text-red-500 cursor-help" />
                              {hoveredError === upload.id && (
                                <div className="absolute right-0 bottom-full mb-1 z-50 w-64 p-2 bg-neutral-900 text-white text-xs rounded shadow-lg">
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
                      <div className="mt-2">
                        <div className={`h-2 rounded-full overflow-hidden ${
                          upload.status === 'failed' ? 'bg-red-200' 
                          : upload.status === 'completed' ? 'bg-green-200'
                          : upload.status === 'duplicate' ? 'bg-amber-200'
                          : 'bg-neutral-200'
                        }`}>
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(upload)}`}
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className={`text-xs ${
                            upload.status === 'failed' ? 'text-red-600' 
                            : upload.status === 'completed' ? 'text-green-600'
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
                              className="text-xs font-medium text-brand-600 hover:text-brand-700"
                            >
                              Retry
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-neutral-600">
                              {upload.progress}%
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Candidate info for successful uploads */}
                      {upload.status === 'completed' && upload.candidateInfo && (
                        <div className="mt-2 pt-2 border-t border-green-200 text-xs text-green-700">
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
      </div>
    </div>
  )
}
