import { useState, useCallback, useEffect, useRef } from 'react'
import {
  EnvelopeIcon,
  MapPinIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'
import ResumeViewer from './ResumeViewer.jsx'
import EmailProviderModal from './EmailProviderModal.jsx'

function initials(first, last) {
  const a = (first || '').trim()[0] || ''
  const b = (last || '').trim()[0] || ''
  return (a + b).toUpperCase() || '—'
}

export default function ProfileCard({ row, checked, downloaded, onToggle, onOpen, onDownload, onEdit }) {
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [isGenerated, setIsGenerated] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ') || `Candidate #${row.id}`
  const location = row.location || row.address || '—'
  const hasResume = row.resume_filename
  const baseResumeUrl = hasResume ? `/candidates/${row.id}/resume` : null
  const viewResumeUrl = hasResume ? `/candidates/${row.id}/resume?inline=true` : null
  const downloadResumeUrl = hasResume ? baseResumeUrl : null

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const handleViewResume = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!viewResumeUrl) return
    setIsViewerOpen(true)
    setIsDropdownOpen(false)
  }, [viewResumeUrl])

  const handleDownloadResume = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!downloadResumeUrl) return
    
    // Mark as downloaded (temporary state only)
    setIsDownloaded(true)
    setIsDropdownOpen(false)
    
    // Then trigger download
    const link = document.createElement('a')
    link.href = downloadResumeUrl
    link.download = row.resume_filename || `resume_${row.id}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [downloadResumeUrl, row.resume_filename, row.id])

  const handleCloseViewer = useCallback(() => {
    setIsViewerOpen(false)
  }, [])

  const handleGenerateClick = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    // Mark as generated and open modal
    setIsGenerated(true)
    setIsDropdownOpen(false)
    setIsEmailModalOpen(true)
  }, [])

  const handleEmailProvider = useCallback((provider) => {
    // Generate email subject and body from candidate data
    const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ') || `Candidate #${row.id}`
    const primarySkill = row.job_title || row.primary_skill || 'N/A'
    
    const subject = `Profile Submission – ${fullName} – ${primarySkill}`
    
    const body = `PERSONAL DETAILS:
Full Name: ${fullName}
Current Location: ${row.location || row.address || 'N/A'}
Phone: ${row.phone || 'N/A'}
Email: ${row.email || 'N/A'}
LinkedIn: ${row.linkedin_url || 'N/A'}

EDUCATIONAL DETAILS:
Degree: ${row.degree || row.education || 'N/A'}
University: ${row.university || 'N/A'}
Year of Completion: ${row.graduation_year || 'N/A'}

SUBMITTAL DETAILS:
Work Authorization: ${row.work_authorization || row.visa_status || 'N/A'}
Submittal Type: ${row.submittal_type || 'N/A'}
Rate: $${row.rate || row.hourly_rate || 'N/A'}
Availability: ${row.availability || 'N/A'}`

    // Encode subject and body for URL
    const encodedSubject = encodeURIComponent(subject)
    const encodedBody = encodeURIComponent(body)

    // Build email URL based on provider
    let emailUrl = ''
    if (provider === 'gmail') {
      emailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodedSubject}&body=${encodedBody}`
    } else if (provider === 'outlook') {
      emailUrl = `https://outlook.office.com/mail/deeplink/compose?to=&subject=${encodedSubject}&body=${encodedBody}`
    }

    // Open in new tab
    if (emailUrl) {
      window.open(emailUrl, '_blank', 'noopener,noreferrer')
    }

    // Close modal
    setIsEmailModalOpen(false)
  }, [row])

  const handleEditClick = useCallback((e) => {
    e.stopPropagation()
    setIsDropdownOpen(false)
    onEdit()
  }, [onEdit])

  return (
    <div className="bg-white hover:bg-neutral-50/50 transition-colors duration-150">
      <div className="grid items-center py-4" style={{ gridTemplateColumns: '5% 27% 26% 32% 10%', width: '100%' }}>
        <div className="flex justify-center px-4">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-neutral-300 text-brand-500 focus:ring-brand-200 focus:ring-2 transition-all hover:border-brand-400 cursor-pointer"
            checked={checked}
            onChange={(e) => onToggle(e.target.checked)}
          />
        </div>

        <div className="overflow-hidden px-6">
          <div className="flex items-center gap-2">
            <div className="relative h-9 w-9 rounded-lg overflow-hidden bg-brand-500 flex items-center justify-center flex-shrink-0">
              {row.profile_picture_url ? (
                <img 
                  src={row.profile_picture_url} 
                  alt={`${row.first_name || ''} ${row.last_name || ''}`.trim()}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              ) : null}
              <div className={`absolute inset-0 flex items-center justify-center text-sm font-semibold text-white ${row.profile_picture_url ? 'hidden' : ''}`}>
                {initials(row.first_name, row.last_name)}
              </div>
            </div>

            <div className="min-w-0">
              <button
                type="button"
                className="block truncate text-left text-sm font-semibold text-neutral-900 hover:text-brand-500 transition-colors"
                onClick={onOpen}
                title={fullName}
              >
                {fullName}
              </button>
              <div className="truncate text-xs text-neutral-600" title={row.job_title || ''}>
                {row.job_title || '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden px-6">
          <div className="flex items-center gap-1.5 text-sm text-neutral-800">
            <MapPinIcon className="h-4 w-4 text-neutral-500 flex-shrink-0" />
            <span className="truncate" title={location}>{location}</span>
          </div>
        </div>

        <div className="overflow-hidden px-6">
          <div className="space-y-1">
            {row.email && (
              <div className="flex items-center gap-1.5 text-sm text-neutral-800 overflow-hidden">
                <EnvelopeIcon className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                <a href={`mailto:${row.email}`} className="hover:text-brand-500 truncate" title={row.email}>
                  {row.email}
                </a>
              </div>
            )}
            {row.phone && (
              <div className="flex items-center gap-1.5 text-sm text-neutral-800">
                <PhoneIcon className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                <a href={`tel:${row.phone}`} className="hover:text-brand-500 truncate" title={row.phone}>
                  {row.phone}
                </a>
              </div>
            )}
            {!row.email && !row.phone && (
              <span className="text-neutral-400 text-sm">—</span>
            )}
          </div>
        </div>

        {/* Actions Dropdown */}
        <div className="flex justify-end px-4" ref={dropdownRef}>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsDropdownOpen(!isDropdownOpen)
              }}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
            >
              Actions
              <span className="text-neutral-400">⋮</span>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-md shadow-lg border border-neutral-200 py-1 z-50"
                style={{ boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
              >
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleGenerateClick}
                  className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Send Mail
                </button>
                {hasResume ? (
                  <>
                    <button
                      type="button"
                      onClick={handleViewResume}
                      className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      View Resume
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadResume}
                      className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      Download Resume
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-4 py-2 text-sm text-neutral-400 cursor-not-allowed">
                      View Resume
                    </div>
                    <div className="px-4 py-2 text-sm text-neutral-400 cursor-not-allowed">
                      Download Resume
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ResumeViewer
        isOpen={isViewerOpen}
        onClose={handleCloseViewer}
        resumeUrl={viewResumeUrl}
        fileName={row.resume_filename}
      />

      <EmailProviderModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSelectProvider={handleEmailProvider}
      />
    </div>
  )
}
