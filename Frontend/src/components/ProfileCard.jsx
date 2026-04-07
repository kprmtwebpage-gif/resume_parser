import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  EnvelopeIcon,
  MapPinIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'
import { FaLinkedin } from 'react-icons/fa'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl } from '../config'
import { api } from '../services/api'
import ResumeViewer from './ResumeViewer.jsx'
import CommentModal from './CommentModal.jsx'
import SendEmailPanel from './email/SendEmailPanel.jsx'

function initials(first, last) {
  const a = (first || '').trim()[0] || ''
  const b = (last || '').trim()[0] || ''
  return (a + b).toUpperCase() || '—'
}

function sanitizeLinkedInUrl(url) {
  if (!url) return null
  url = url.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  if (url.startsWith('http://') && url.includes('linkedin.com')) {
    url = url.replace('http://', 'https://')
  }
  return url
}

// Portal-based Actions Dropdown
function ActionsDropdown({ anchorRef, isOpen, onClose, children, colors }) {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      const dropdownHeight = 250 // Approximate dropdown height

      let top = rect.bottom + window.scrollY + 4
      let left = rect.right - 180 + window.scrollX

      // If dropdown would go below viewport, open upward
      if (rect.bottom + dropdownHeight > window.innerHeight) {
        top = rect.top - dropdownHeight + window.scrollY - 4
      }

      setPosition({ top, left })
    }
  }, [isOpen, anchorRef])

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose, anchorRef])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: '180px',
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        borderRadius: '8px',
        padding: '8px 0',
        zIndex: 9999
      }}
    >
      {children}
    </div>,
    document.body
  )
}

export default function ProfileCard({ row, checked, downloaded, onToggle, onOpen, onDownload, onEdit, onDelete }) {
  const { colors, isDark } = useTheme()
  const { isAdmin, user } = useAuth()
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [isSendFlowOpen, setIsSendFlowOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false)
  const [showPipelineJobPicker, setShowPipelineJobPicker] = useState(false)
  const [pipelineJobs, setPipelineJobs] = useState([])
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const actionsButtonRef = useRef(null)

  const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ') || `Candidate #${row.id}`
  const isParseFailedOrStuck = row.parse_status === 'failed' || row.parse_status === 'processing'
  const location = row.location || row.address || '—'
  const linkedinUrl = row.linkedin || row.linkedin_url
  const hasResume = row.resume_filename
  const baseResumeUrl = hasResume ? apiUrl(`/candidates/${row.id}/resume`) : null
  const viewResumeUrl = hasResume ? apiUrl(`/candidates/${row.id}/resume?inline=true`) : null
  const downloadResumeUrl = hasResume ? baseResumeUrl : null



  const handleViewResume = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!viewResumeUrl) return
    setIsViewerOpen(true)
    setIsDropdownOpen(false)
  }, [viewResumeUrl])

  const handleDownloadResume = useCallback(async (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!row.id || !row.resume_filename) return
    setIsDownloaded(true)
    setIsDropdownOpen(false)
    try {
      const res = await api.get(`/candidates/${row.id}/resume`, { responseType: 'blob' })
      const contentType = res.headers['content-type'] || ''
      if (contentType.includes('application/json')) {
        alert('Resume file is not available on the server.')
        return
      }
      const blob = new Blob([res.data], { type: contentType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = (row.resume_filename || `resume_${row.id}`).split('/').pop()
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      if (err.response?.status === 429) {
        alert(err.response?.data?.detail || 'Daily download limit reached (10 resumes/day). Superusers have unlimited downloads.')
      } else {
        alert('Failed to download resume. Please try again.')
      }
    }
  }, [row.id, row.resume_filename])

  const handleCloseViewer = useCallback(() => {
    setIsViewerOpen(false)
  }, [])

  const handleSendToHRClick = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    setIsDropdownOpen(false)
    setIsSendFlowOpen(true)
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
LinkedIn: ${linkedinUrl || 'N/A'}

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

  const handleDeleteClick = useCallback(async (e) => {
    e.stopPropagation()
    setIsDropdownOpen(false)
    const fullLabel = [row.first_name, row.last_name].filter(Boolean).join(' ') || `Candidate #${row.id}`
    if (!window.confirm(`Permanently delete "${fullLabel}"? This cannot be undone.`)) return
    try {
      await api.delete(`/candidates/${row.id}`)
      if (onDelete) onDelete(row.id)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete candidate.')
    }
  }, [row.id, row.first_name, row.last_name, onDelete])

  const handleEditClick = useCallback((e) => {
    e.stopPropagation()
    setIsDropdownOpen(false)
    onEdit()
  }, [onEdit])

  const handleCommentClick = useCallback((e) => {
    e.stopPropagation()
    setIsDropdownOpen(false)
    setIsCommentModalOpen(true)
  }, [])

  return (
    <div 
      className="transition-all duration-300"
      style={{ backgroundColor: colors.background }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? colors.card : '#f9fafb'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.background}
    >
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

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="truncate text-left text-sm font-semibold hover:text-brand-500 transition-colors duration-300"
                  style={{ color: colors.text }}
                  onClick={() => onOpen()}
                  title={fullName}
                >
                  {fullName}
                </button>
                {isParseFailedOrStuck && (
                  <span
                    className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 border border-red-200 cursor-help"
                    title={row.parse_failure_reason || 'Resume could not be parsed'}
                  >
                    Parse Failed
                  </span>
                )}
              </div>
              <div 
                className="truncate text-xs transition-colors duration-300" 
                style={{ color: isDark ? '#94a3b8' : '#6b7280' }}
                title={row.job_title || ''}
              >
                {row.job_title || '—'}
              </div>
              {linkedinUrl && (
                <a
                  href={sanitizeLinkedInUrl(linkedinUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="linkedin-bottom-icon"
                  onClick={(e) => e.stopPropagation()}
                  title="View LinkedIn Profile"
                  style={{
                    marginTop: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: '#0A66C2',
                    fontSize: '18px',
                    transition: '0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)'
                    e.currentTarget.style.color = '#004182'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.color = '#0A66C2'
                  }}
                >
                  <FaLinkedin />
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
        <div className="flex justify-end px-4">
          <button
            ref={actionsButtonRef}
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

          <ActionsDropdown
            anchorRef={actionsButtonRef}
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            colors={colors}
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
                  onClick={handleSendToHRClick}
                  className="w-full px-4 py-2 text-left text-sm transition-all duration-300"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? colors.card : '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Send Email
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
                    {isAdmin && (
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
                    )}
                  </>
                ) : (
                  <>
                    <div 
                      className="px-4 py-2 text-sm cursor-not-allowed"
                      style={{ color: isDark ? '#64748b' : '#cbd5e1' }}
                    >
                      View Resume
                    </div>
                    {isAdmin && (
                    <div 
                      className="px-4 py-2 text-sm cursor-not-allowed"
                      style={{ color: isDark ? '#64748b' : '#cbd5e1' }}
                    >
                      Download Resume
                    </div>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={handleCommentClick}
                  className="w-full px-4 py-2 text-left text-sm transition-all duration-300"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? colors.card : '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Comment
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsDropdownOpen(false)
                    setShowPipelineJobPicker(true)
                  }}
                  className="w-full px-4 py-2 text-left text-sm transition-all duration-300"
                  style={{ color: '#6366f1' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#1e1b4b' : '#eef2ff'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Add to Pipeline
                </button>
                {user?.role === 'superuser' && (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="w-full px-4 py-2 text-left text-sm transition-all duration-300"
                    style={{ color: '#ef4444' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#3b0f0f' : '#fef2f2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Delete
                  </button>
                )}
          </ActionsDropdown>
        </div>
      </div>

      <ResumeViewer
        isOpen={isViewerOpen}
        onClose={handleCloseViewer}
        resumeUrl={viewResumeUrl}
        fileName={row.resume_filename}
      />

      <CommentModal
        isOpen={isCommentModalOpen}
        onClose={(saved) => {
          setIsCommentModalOpen(false)
          if (saved) onOpen('comments')
        }}
        candidateId={row.id}
        candidateName={fullName}
      />

      <SendEmailPanel
        isOpen={isSendFlowOpen}
        onClose={() => setIsSendFlowOpen(false)}
        candidateId={row.id}
        candidateName={fullName}
        provider={localStorage.getItem('emailProvider') || 'gmail'}
      />

      {/* Job Picker for Pipeline */}
      {showPipelineJobPicker && (
        <div style={{ position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center' }}
             onClick={() => setShowPipelineJobPicker(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: isDark ? '#1e293b' : '#fff', borderRadius:'16px', padding:'28px',
            width:'100%', maxWidth:'480px', maxHeight:'70vh', overflowY:'auto',
            boxShadow:'0 25px 50px -12px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ fontSize:'18px', fontWeight:700, color: colors.text, marginBottom:'4px' }}>Add to Interview Pipeline</h3>
            <p style={{ fontSize:'13px', color: isDark ? '#94a3b8' : '#64748b', marginBottom:'16px' }}>
              Select a job for <strong>{fullName}</strong>
            </p>
            {!pipelineJobs.length && !pipelineLoading && (
              <div style={{ textAlign:'center', padding:'20px', color: isDark ? '#64748b' : '#94a3b8' }}>
                <button onClick={() => {
                  setPipelineLoading(true)
                  api.get('/api/job-projects').then(r => setPipelineJobs(r.data)).catch(console.error).finally(() => setPipelineLoading(false))
                }} style={{ padding:'10px 24px', borderRadius:'8px', border:'none', backgroundColor:'#6366f1', color:'#fff', fontWeight:600, cursor:'pointer', fontSize:'14px' }}>
                  Load Jobs
                </button>
              </div>
            )}
            {pipelineLoading && <div style={{ padding:'20px', textAlign:'center', color: isDark ? '#64748b' : '#94a3b8' }}>Loading jobs...</div>}
            {pipelineJobs.map(job => (
              <div key={job.id} onClick={() => {
                import('../services/pipelineApi').then(({ addToPipeline }) => {
                  addToPipeline({
                    candidate_id: row.id,
                    candidate_name: fullName,
                    candidate_email: row.email,
                    candidate_phone: row.phone,
                    job_id: job.id,
                    job_title: job.job_title,
                    current_stage: 'screening',
                  }).then(() => { setShowPipelineJobPicker(false); alert(`${fullName} added to pipeline for "${job.job_title}"`) })
                    .catch(err => alert(err.response?.data?.detail || 'Failed'))
                })
              }} style={{
                padding:'12px 16px', borderRadius:'10px', cursor:'pointer', marginBottom:'8px',
                border:`1px solid ${isDark ? '#334155' : '#e5e7eb'}`, transition:'all 0.15s',
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.backgroundColor = isDark ? '#1e1b4b' : '#eef2ff' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? '#334155' : '#e5e7eb'; e.currentTarget.style.backgroundColor = isDark ? '#0f172a' : '#f8fafc' }}>
                <div style={{ fontWeight:600, fontSize:'14px', color: colors.text }}>{job.job_title}</div>
                <div style={{ fontSize:'12px', color: isDark ? '#64748b' : '#9ca3af', marginTop:'2px' }}>
                  {job.company} {job.location ? `• ${job.location}` : ''} {job.status ? `• ${job.status}` : ''}
                </div>
              </div>
            ))}
            {pipelineJobs.length > 0 && (
              <div onClick={() => {
                import('../services/pipelineApi').then(({ addToPipeline }) => {
                  addToPipeline({
                    candidate_id: row.id, candidate_name: fullName,
                    candidate_email: row.email, candidate_phone: row.phone,
                    current_stage: 'screening',
                  }).then(() => { setShowPipelineJobPicker(false); alert(`${fullName} added to pipeline (no specific job)`) })
                    .catch(err => alert(err.response?.data?.detail || 'Failed'))
                })
              }} style={{
                padding:'12px 16px', borderRadius:'10px', cursor:'pointer', marginTop:'4px',
                border:`1px dashed ${isDark ? '#475569' : '#cbd5e1'}`, textAlign:'center',
                color: isDark ? '#94a3b8' : '#64748b', fontSize:'13px',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor='#6366f1'}
              onMouseLeave={e => e.currentTarget.style.borderColor = isDark ? '#475569' : '#cbd5e1'}>
                Add without specific job
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
