import { useEffect, useMemo, useState } from 'react'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import mammoth from 'mammoth'

import ProfileTabs from './ProfileTabs.jsx'
import PdfScrollViewer from './PdfScrollViewer.jsx'
import { notifyModalOpened, notifyModalClosed, onChatbotOpened } from '../chatbot/modalEvents.js'
import { useTheme } from '../contexts/ThemeContext'

function initials(first, last) {
  const a = (first || '').trim()[0] || ''
  const b = (last || '').trim()[0] || ''
  return (a + b).toUpperCase() || '—'
}

function sanitizeLinkedInUrl(url) {
  if (!url) return null
  
  // Trim whitespace
  url = url.trim()
  
  // If URL doesn't start with http/https, add https
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  
  // Convert http to https for LinkedIn
  if (url.startsWith('http://') && url.includes('linkedin.com')) {
    url = url.replace('http://', 'https://')
  }
  
  return url
}

export default function ProfileModal({
  open,
  onClose,
  candidate,
  tab,
  onTab,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) {
  const fullName = useMemo(() => {
    if (!candidate) return ''
    return [candidate.first_name, candidate.last_name].filter(Boolean).join(' ') || `Candidate #${candidate.id}`
  }, [candidate])

  const [show, setShow] = useState(open)
  const [resumeLoadError, setResumeLoadError] = useState(false)
  const [docxHtml, setDocxHtml] = useState(null)
  const [docxLoading, setDocxLoading] = useState(false)
  const [docxError, setDocxError] = useState(false)
  const [pdfError, setPdfError] = useState(false)
  
  // Use global theme context
  const { isDark, colors } = useTheme()

  // Construct resume URL similar to ProfileCard
  const hasResume = candidate?.resume_filename
  const baseResumeUrl = hasResume ? `/candidates/${candidate.id}/resume` : null
  const viewResumeUrl = hasResume ? `/candidates/${candidate.id}/resume?inline=true` : null
  const resumeIsDocx = hasResume && (candidate.resume_filename.toLowerCase().endsWith('.docx') || candidate.resume_filename.toLowerCase().endsWith('.doc'))
  const resumeIsPdf = hasResume && candidate.resume_filename.toLowerCase().endsWith('.pdf')
  const resumeIsImage = hasResume && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(candidate.resume_filename)

  useEffect(() => setShow(open), [open])

  useEffect(() => {
    if (open) {
      setResumeLoadError(false)
      setDocxHtml(null)
      setDocxError(false)
      setPdfError(false)
    }
  }, [open, candidate])



  // Convert DOCX/DOC to HTML via mammoth when modal opens
  useEffect(() => {
    if (!open || !resumeIsDocx || !baseResumeUrl) return

    setDocxLoading(true)
    setDocxHtml(null)
    setDocxError(false)

    fetch(baseResumeUrl)
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
  }, [open, resumeIsDocx, baseResumeUrl])



  // Listen for Chatbot opening - close profile drawer when chatbot opens
  useEffect(() => {
    const unsubscribe = onChatbotOpened(() => {
      if (open) {
        onClose();
      }
    });
    return unsubscribe;
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      notifyModalOpened()
      // Disable body scroll when drawer is open
      document.body.style.overflow = 'hidden'
    } else {
      notifyModalClosed()
      // Re-enable body scroll when drawer is closed
      document.body.style.overflow = ''
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      {/* Overlay - 30% left side with dark background */}
      {show && (
        <div
          className="fixed inset-0 bg-neutral-900/50 z-50 transition-opacity duration-300"
          style={{
            opacity: show ? 1 : 0,
          }}
          onClick={onClose}
        />
      )}

      {/* Right-side Drawer - 82vw width to match SignalHire size */}
      <div
        className="fixed top-0 right-0 h-screen shadow-2xl z-50 transition-all duration-300"
        style={{
          width: '82vw',
          height: '100vh',
          transform: show ? 'translateX(0)' : 'translateX(100%)',
          backgroundColor: colors.background,
        }}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div 
            className="flex-shrink-0 transition-all duration-300" 
            style={{ 
              width: '100%',
              backgroundColor: colors.background,
              borderBottom: `1px solid ${colors.border}`
            }}
          >
            <div 
              className="flex items-center justify-between"
              style={{
                padding: '20px 24px',
              }}
            >
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="rounded-full p-2 transition-all duration-300"
                  style={{
                    color: isDark ? '#94a3b8' : '#64748b',
                    backgroundColor: isDark ? 'transparent' : 'transparent'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? colors.card : '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={onClose}
                  title="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
                <div 
                  className="text-lg font-medium transition-colors duration-300"
                  style={{ color: colors.text }}
                >
                  Profile Details
                </div>
              </div>
              {/* Navigation arrows */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300"
                  style={{
                    color: hasPrev ? colors.text : (isDark ? '#475569' : '#cbd5e1'),
                    cursor: hasPrev ? 'pointer' : 'not-allowed',
                    opacity: hasPrev ? 1 : 0.5
                  }}
                  onMouseEnter={(e) => {
                    if (hasPrev) e.currentTarget.style.backgroundColor = isDark ? colors.card : '#f1f5f9'
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title="Previous"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300"
                  style={{
                    color: hasNext ? colors.text : (isDark ? '#475569' : '#cbd5e1'),
                    cursor: hasNext ? 'pointer' : 'not-allowed',
                    opacity: hasNext ? 1 : 0.5
                  }}
                  onMouseEnter={(e) => {
                    if (hasNext) e.currentTarget.style.backgroundColor = isDark ? colors.card : '#f1f5f9'
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title="Next"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {!candidate ? (
              <div className="py-16 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-500">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="mt-4 text-base text-neutral-500">Loading profile...</div>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-6 h-full">
                      {/* LEFT SIDE - Profile Details */}
                      <div className="w-full lg:w-[42%] overflow-y-auto pr-4" style={{ maxHeight: '100%' }}>
                        <div className="flex flex-wrap items-start justify-between gap-6">
                          <div className="flex items-start gap-5">
                            <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-brand-500">
                              {candidate.profile_picture_url ? (
                                <img 
                                  src={candidate.profile_picture_url} 
                                  alt={fullName}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    // Hide image and show initials if loading fails
                                    e.target.style.display = 'none'
                                  }}
                                />
                              ) : null}
                              <div className={`absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white ${candidate.profile_picture_url ? 'hidden' : ''}`}>
                                {initials(candidate.first_name, candidate.last_name)}
                              </div>
                            </div>
                            <div>
                              <div className="text-2xl font-semibold text-neutral-900">{fullName}</div>
                              <div className="mt-2 flex items-center gap-2 text-base text-neutral-600">
                                {candidate.job_title || '—'}
                                {candidate.company ? <span className="text-neutral-400"> · </span> : null}
                                {candidate.company ? candidate.company : null}
                              </div>
                              <div className="mt-2 flex items-center gap-2 text-sm text-neutral-600">
                                {candidate.location || '—'}
                              </div>
                              {candidate.email && (
                                <div className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
                                  <a href={`mailto:${candidate.email}`} className="hover:text-brand-500 break-all" title={candidate.email}>
                                    {candidate.email}
                                  </a>
                                </div>
                              )}
                              {candidate.phone && (
                                <div className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
                                  <a href={`tel:${candidate.phone}`} className="hover:text-brand-500" title={candidate.phone}>
                                    {candidate.phone}
                                  </a>
                                </div>
                              )}
                              {candidate.linkedin && (
                                <div className="mt-3">
                                  <a
                                    href={sanitizeLinkedInUrl(candidate.linkedin)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-button bg-[#0A66C2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004182] transition-all"
                                  >
                                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                    </svg>
                                    View Profile
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <ProfileTabs active={tab} onChange={onTab} />

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div className="md:col-span-2">
                            {tab === 'skills' && (
                              <div className="rounded-lg bg-white p-6 border border-neutral-200">
                                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Technical Skills</h3>
                                <div className="flex flex-wrap gap-2">
                                  {(candidate.skills || []).length === 0 ? (
                                    <div className="text-sm text-neutral-500">No skills available</div>
                                  ) : (
                                    candidate.skills.map((s) => (
                                      <span key={s} className="rounded-button bg-brand-50 border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-600">
                                        {s}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}

                            {tab === 'experience' && (
                              <div className="rounded-lg bg-white p-6 border border-neutral-200">
                                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Work Experience</h3>
                                <div className="rounded-lg bg-neutral-50 p-5 border border-neutral-200">
                                  <div className="text-base font-semibold text-neutral-900">{candidate.experience?.job_title || candidate.job_title || '—'}</div>
                                  <div className="mt-2 text-sm text-neutral-600">
                                    Years of experience: {candidate.experience?.years_of_experience ?? '—'}
                                  </div>
                                </div>

                                <div className="mt-5">
                                  <div className="text-sm font-semibold uppercase tracking-wider text-neutral-500 mb-3">Certifications</div>
                                  <div className="flex flex-wrap gap-2">
                                    {(candidate.experience?.certifications || []).length === 0 ? (
                                      <div className="text-sm text-neutral-500">No certifications</div>
                                    ) : (
                                      candidate.experience.certifications.map((c) => (
                                        <span key={c} className="rounded-button bg-green-50 border border-green-200 px-3 py-1.5 text-sm font-medium text-green-700">
                                          {c}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {tab === 'education' && (
                              <div className="rounded-lg bg-white p-6 border border-neutral-200">
                                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Education</h3>
                                {(() => {
                                  const edu = candidate.education
                                  if (!edu) return <div className="text-sm text-neutral-500">No education data available</div>

                                  const entries = Array.isArray(edu) ? edu : [edu]
                                  if (entries.length === 0) return <div className="text-sm text-neutral-500">No education data available</div>

                                  // Build "Degree in Specialization" label
                                  const buildTitle = (entry) => {
                                    const degree = (entry.degree || entry.level || '').trim()
                                    const spec = (entry.specialization || '').trim()
                                    // Include specialization only if it looks like an academic subject
                                    const isSubject = spec.length > 0 && (
                                      spec.includes(' ') ||
                                      /computer|science|engineer|technolog|business|commerce|arts|math|information|software|data|finance|management|economics|admin|medical|pharmac|bio|electrical|mechanic|civil|network/i.test(spec)
                                    )
                                    return isSubject ? `${degree} in ${spec}` : degree
                                  }

                                  // Strip trailing department/location info from university names
                                  const cleanUniversity = (univ) => {
                                    if (!univ) return ''
                                    return univ
                                      .replace(/\s+(information\s*technology|i\.?t\.?\s*department|department\s+of|department|division|campus|coral\s+gables|florida|usa|india|bangalore|chennai|hyderabad|mumbai|delhi|pune|new\s+york|california|texas)[\s\S]*/gi, '')
                                      .trim()
                                  }

                                  return (
                                    <div className="space-y-3">
                                      {entries.map((entry, i) => {
                                        if (typeof entry === 'string') {
                                          return (
                                            <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
                                              <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                                                <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422A12.083 12.083 0 0121 12c0 2.485-.82 4.775-2.196 6.618L12 22l-6.804-3.382A12.083 12.083 0 013 12c0-.574.04-1.14.117-1.694L12 14z"/></svg>
                                              </div>
                                              <div className="text-sm text-neutral-900">{entry}</div>
                                            </div>
                                          )
                                        }
                                        if (typeof entry !== 'object' || entry === null) return null

                                        const title = buildTitle(entry)
                                        const university = cleanUniversity(entry.university || '')
                                        const gradYear = entry.grad_year || null

                                        return (
                                          <div key={i} className="flex items-start gap-4 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
                                            <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center">
                                              <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422A12.083 12.083 0 0121 12c0 2.485-.82 4.775-2.196 6.618L12 22l-6.804-3.382A12.083 12.083 0 013 12c0-.574.04-1.14.117-1.694L12 14z"/></svg>
                                            </div>
                                            <div className="min-w-0">
                                              {title && (
                                                <div className="text-base font-semibold text-neutral-900 leading-snug">{title}</div>
                                              )}
                                              {university && (
                                                <div className="mt-0.5 text-sm text-neutral-600">{university}</div>
                                              )}
                                              {gradYear && (
                                                <div className="mt-1 text-xs text-neutral-400">Graduated {gradYear}</div>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* RIGHT SIDE - Resume Viewer */}
                      <div 
                        className="w-full lg:w-[58%] pl-6 transition-all duration-300" 
                        style={{ 
                          height: '80vh', 
                          display: 'flex', 
                          flexDirection: 'column',
                          borderLeft: `1px solid ${colors.border}`
                        }}
                      >
                        {/* Resume Preview Header with Export Button */}
                        <div className="flex-shrink-0 mb-4 flex items-center justify-between">
                          <div>
                            <h3 
                              className="text-lg font-semibold transition-colors duration-300"
                              style={{ color: colors.text }}
                            >
                              Resume Preview
                            </h3>
                            {candidate.resume_filename && (
                              <p 
                                className="text-sm mt-1 truncate transition-colors duration-300"
                                style={{ color: isDark ? '#94a3b8' : '#64748b' }}
                              >
                                {candidate.resume_filename}
                              </p>
                            )}
                          </div>
                          {/* Export Button in Header */}
                          {hasResume && (
                            <a
                              href={`/candidates/${candidate.id}/resume`}
                              download
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300"
                              style={{
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
                              title="Export Resume"
                            >
                              Export
                            </a>
                          )}
                        </div>
                        <div 
                          className="relative flex-1 rounded-lg overflow-hidden shadow-sm transition-all duration-300" 
                          style={{ 
                            minHeight: 0,
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                            {!hasResume ? (
                              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                <div className="mb-4" style={{ color: '#94a3b8' }}>
                                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <p className="text-lg font-medium transition-colors duration-300" style={{ color: colors.text }}>No resume available</p>
                                <p className="text-sm mt-2 transition-colors duration-300" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>This candidate hasn't uploaded a resume yet</p>
                              </div>
                            ) : (resumeLoadError || resumeIsDocx) ? (
                              docxLoading ? (
                                <div className="flex items-center justify-center h-full">
                                  <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm transition-colors duration-300" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Rendering document...</p>
                                  </div>
                                </div>
                              ) : (docxError || resumeLoadError) ? (
                                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                  <div className="mb-4" style={{ color: '#94a3b8' }}>
                                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                  </div>
                                  <p className="text-lg font-medium mb-2 transition-colors duration-300" style={{ color: colors.text }}>Failed to load document</p>
                                  <p className="text-sm transition-colors duration-300" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Use the Export button to download this file.</p>
                                </div>
                              ) : docxHtml ? (
                                <div
                                  className="p-8 max-w-full w-full h-full overflow-y-auto prose prose-neutral"
                                  style={{ 
                                    fontFamily: 'Georgia, serif', 
                                    fontSize: '14px', 
                                    lineHeight: '1.7', 
                                    color: colors.text,
                                    transition: 'color 0.3s ease'
                                  }}
                                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                                />
                              ) : null
                            ) : resumeIsImage ? (
                              <div 
                                className="w-full h-full overflow-auto flex items-start justify-center p-6 transition-all duration-300" 
                                style={{ 
                                  backgroundColor: colors.card,
                                }}
                              >
                                <img
                                  src={viewResumeUrl}
                                  alt="Resume"
                                  className="max-w-full h-auto object-contain"
                                  style={{ maxHeight: '100%' }}
                                  onError={() => setResumeLoadError(true)}
                                />
                              </div>
                            ) : resumeIsPdf ? (
                              viewResumeUrl ? (
                                <PdfScrollViewer
                                  url={viewResumeUrl}
                                  isDark={isDark}
                                  colors={colors}
                                />
                              ) : null
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                <p className="text-lg font-medium mb-2 transition-colors duration-300" style={{ color: colors.text }}>Preview not available</p>
                                <p className="text-sm transition-colors duration-300" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Use the Export button to download this file.</p>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
    </>
  )
}
