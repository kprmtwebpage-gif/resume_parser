import { useState, useCallback, useEffect, useRef } from 'react'
import {
  EnvelopeIcon,
  MapPinIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'
import { useTheme } from '../contexts/ThemeContext'
import { apiUrl } from '../config.js'
import ResumeViewer from './ResumeViewer.jsx'
import EmailProviderModal from './EmailProviderModal.jsx'

function initials(first, last) {
  const a = (first || '').trim()[0] || ''
  const b = (last || '').trim()[0] || ''
  return (a + b).toUpperCase() || '—'
}

// Ensure LinkedIn URLs always have https:// and are well-formed
function sanitizeLinkedInUrl(url) {
  if (!url) return null
  url = url.trim()
  // Strip trailing slashes
  url = url.replace(/\/+$/, '')
  // Add https:// if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  // Upgrade http to https
  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://')
  }
  return url
}

export default function ProfileCard({ row, downloaded, onOpen, onDownload, onEdit }) {
  const { colors, isDark } = useTheme()
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [isGenerated, setIsGenerated] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ') || `Candidate #${row.id}`
  const location = row.location || row.address || '—'
  const hasResume = row.resume_filename
  const baseResumeUrl = hasResume ? apiUrl(`/candidates/${row.id}/resume`) : null
  const viewResumeUrl = hasResume ? apiUrl(`/candidates/${row.id}/resume?inline=true`) : null
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
    <div 
      className="transition-all duration-300"
      style={{ backgroundColor: colors.background }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? colors.card : '#f9fafb'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.background}
    >
      <div className="grid items-center py-4" style={{ gridTemplateColumns: '30% 26% 32% 12%', width: '100%' }}>

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
                className="block truncate text-left text-sm font-semibold hover:text-brand-500 transition-colors duration-300"
                style={{ color: colors.text }}
                onClick={onOpen}
                title={fullName}
              >
                {fullName}
              </button>
              <div 
                className="truncate text-xs transition-colors duration-300" 
                style={{ color: isDark ? '#94a3b8' : '#6b7280' }}
                title={row.job_title || ''}
              >
                {row.job_title || '—'}
              </div>
              {/* LinkedIn logo */}
              {row.linkedin && (
                <a
                  href={sanitizeLinkedInUrl(row.linkedin)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-block mt-0.5 transition-opacity hover:opacity-80"
                  title="View LinkedIn Profile"
                >
                  <svg className="w-[18px] h-[18px]" fill="#0A66C2" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden px-6">
          <div 
            className="flex items-center gap-1.5 text-sm transition-colors duration-300"
            style={{ color: colors.text }}
          >
            <MapPinIcon className="h-4 w-4 flex-shrink-0" style={{ color: isDark ? '#94a3b8' : '#6b7280' }} />
            <span className="truncate" title={location}>{location}</span>
          </div>
        </div>

        <div className="overflow-hidden px-6">
          <div className="space-y-1">
            {row.email && (
              <div 
                className="flex items-center gap-1.5 text-sm overflow-hidden transition-colors duration-300"
                style={{ color: colors.text }}
              >
                <EnvelopeIcon className="h-4 w-4 flex-shrink-0" style={{ color: isDark ? '#94a3b8' : '#6b7280' }} />
                <a href={`mailto:${row.email}`} className="hover:text-brand-500 truncate" title={row.email}>
                  {row.email}
                </a>
              </div>
            )}
            {row.phone && (
              <div 
                className="flex items-center gap-1.5 text-sm transition-colors duration-300"
                style={{ color: colors.text }}
              >
                <PhoneIcon className="h-4 w-4 flex-shrink-0" style={{ color: isDark ? '#94a3b8' : '#6b7280' }} />
                <a href={`tel:${row.phone}`} className="hover:text-brand-500 truncate" title={row.phone}>
                  {row.phone}
                </a>
              </div>
            )}
            {!row.email && !row.phone && (
              <span className="text-sm" style={{ color: isDark ? '#64748b' : '#cbd5e1' }}>—</span>
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
              <div 
                className="absolute right-0 top-full mt-1 w-44 rounded-md shadow-lg py-1 z-50 transition-colors duration-300"
                style={{ 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`
                }}
              >
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="w-full px-4 py-2 text-left text-sm transition-all duration-300"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? colors.card : '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleGenerateClick}
                  className="w-full px-4 py-2 text-left text-sm transition-all duration-300"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? colors.card : '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Send Mail
                </button>
                {hasResume ? (
                  <>
                    <button
                      type="button"
                      onClick={handleViewResume}
                      className="w-full px-4 py-2 text-left text-sm transition-all duration-300"
                      style={{ color: colors.text }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? colors.card : '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      View Resume
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadResume}
                      className="w-full px-4 py-2 text-left text-sm transition-all duration-300"
                      style={{ color: colors.text }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? colors.card : '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Download Resume
                    </button>
                  </>
                ) : (
                  <>
                    <div 
                      className="px-4 py-2 text-sm cursor-not-allowed"
                      style={{ color: isDark ? '#64748b' : '#cbd5e1' }}
                    >
                      View Resume
                    </div>
                    <div 
                      className="px-4 py-2 text-sm cursor-not-allowed"
                      style={{ color: isDark ? '#64748b' : '#cbd5e1' }}
                    >
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
