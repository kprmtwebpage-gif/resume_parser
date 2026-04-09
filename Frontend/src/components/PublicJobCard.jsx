import { useState } from 'react'
import { BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid'
import { BriefcaseIcon, ShareIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { apiUrl } from '../config'
import './PublicJobCard.css'

/**
 * PublicJobCard - Professional job card for the public Find Jobs page.
 * Displays posted date, job ID, title, tags, description preview,
 * Read More expand, Apply and Share buttons.
 */
export default function PublicJobCard({ job, isSaved, onSave, onClick, onApply }) {
  const [expanded, setExpanded] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)

  // Format posted date
  const formatDate = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return d.toISOString().split('T')[0] // YYYY-MM-DD
  }

  // Format salary
  const formatSalary = () => {
    if (!job.salary_start && !job.salary_end) return null
    const fmt = (v) => `$${Number(v).toLocaleString()}`
    if (job.salary_start && job.salary_end) return `${fmt(job.salary_start)} - ${fmt(job.salary_end)}`
    if (job.salary_start) return `${fmt(job.salary_start)}+`
    if (job.salary_end) return `Up to ${fmt(job.salary_end)}`
    return null
  }

  // Strip HTML and truncate
  const stripHtml = (text) => {
    if (!text) return ''
    return text.replace(/<[^>]*>/g, '')
  }

  const descriptionPlain = stripHtml(job.job_description)
  const qualificationPlain = stripHtml(job.required_qualification)
  const previewText = descriptionPlain.length > 150 ? descriptionPlain.substring(0, 150) + '...' : descriptionPlain
  const hasMoreContent = descriptionPlain.length > 150 || qualificationPlain || job.skills

  // Get company logo or fallback
  const getLogoUrl = () => {
    if (job.photo_url) {
      return apiUrl(job.photo_url)
    }
    return null
  }

  const getCompanyInitial = () => job.company?.charAt(0)?.toUpperCase() || 'J'

  const getLogoColor = () => {
    const colors = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EC4899','#14B8A6','#6366F1','#EF4444']
    const hash = (job.company || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const logoUrl = getLogoUrl()
  const salary = formatSalary()
  const postedDate = formatDate(job.posted_date || job.created_at)

  // Count applicants (placeholder based on job data)
  const applicantCount = job.applicant_count || 0

  const handleShare = (platform) => {
    const jobUrl = `${window.location.origin}/job-search?job=${job.id}`
    const text = `Check out this job: ${job.job_title} at ${job.company}`
    switch (platform) {
      case 'copy':
        navigator.clipboard.writeText(jobUrl)
        alert('Link copied to clipboard!')
        break
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`, '_blank', 'noopener,noreferrer')
        break
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(jobUrl)}`, '_blank', 'noopener,noreferrer')
        break
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(jobUrl)}`
        break
      default:
        break
    }
    setShowShareMenu(false)
  }

  return (
    <div className="pjc-card">
      {/* Top row: Posted date + Job ID + Applicant badge */}
      <div className="pjc-top-row">
        <span className="pjc-posted-date">Posted on {postedDate || 'N/A'}</span>
        <div className="pjc-top-right">
          <span className="pjc-job-id">{job.job_id || '—'}</span>
          {applicantCount > 0 && (
            <span className="pjc-applicant-badge">{applicantCount} applicant{applicantCount !== 1 ? 's' : ''}</span>
          )}
          {applicantCount === 0 && (
            <span className="pjc-applicant-badge pjc-applicant-badge--first">Be the first applicant</span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="pjc-title" onClick={onClick} style={{ cursor: 'pointer' }}>
        {job.job_title || 'Untitled Position'}
      </h3>

      {/* Tags row */}
      <div className="pjc-tags">
        {job.category && <span className="pjc-tag pjc-tag--category">{job.category}</span>}
        {salary && <span className="pjc-tag pjc-tag--salary">{salary}</span>}
        {job.employment_type && <span className="pjc-tag pjc-tag--type">{job.employment_type}</span>}
        {job.experience && <span className="pjc-tag pjc-tag--experience">{job.experience}</span>}
      </div>

      {/* Company & qualification */}
      <div className="pjc-company-section">
        <div className="pjc-logo">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={job.company}
              className="pjc-logo-img"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
          ) : null}
          <div
            className="pjc-logo-fallback"
            style={{ display: logoUrl ? 'none' : 'flex', backgroundColor: getLogoColor() }}
          >
            {getCompanyInitial()}
          </div>
        </div>
        <div>
          <p className="pjc-company-name">{job.company || 'Company'}</p>
          {job.required_qualification && !expanded && (
            <p className="pjc-qualification">{stripHtml(job.required_qualification).substring(0, 80)}</p>
          )}
        </div>
      </div>

      {/* Description preview */}
      {!expanded && (
        <p className="pjc-description-preview">
          {previewText || 'No description available.'}
          {hasMoreContent && (
            <button className="pjc-read-more" onClick={(e) => { e.stopPropagation(); setExpanded(true) }}>
              Read More
            </button>
          )}
        </p>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="pjc-expanded">
          {descriptionPlain && (
            <div className="pjc-section">
              <h4>Description</h4>
              <div dangerouslySetInnerHTML={{ __html: job.job_description }} />
            </div>
          )}
          {qualificationPlain && (
            <div className="pjc-section">
              <h4>Requirements</h4>
              <div dangerouslySetInnerHTML={{ __html: job.required_qualification }} />
            </div>
          )}
          {job.skills && (
            <div className="pjc-section">
              <h4>Skills</h4>
              <div className="pjc-skills-list">
                {(job.skills.includes(' | ') ? job.skills.split(' | ') : job.skills.split(',')).map((skill, i) => (
                  <span key={i} className="pjc-skill-tag">{skill.trim()}</span>
                ))}
              </div>
            </div>
          )}
          <button className="pjc-read-less" onClick={(e) => { e.stopPropagation(); setExpanded(false) }}>
            <ChevronUpIcon className="w-4 h-4" /> Show Less
          </button>
        </div>
      )}

      {/* Bottom actions: Apply + Share */}
      <div className="pjc-actions">
        <button
          className="pjc-apply-btn"
          onClick={(e) => { e.stopPropagation(); onApply() }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          APPLY
        </button>
        <div className="pjc-share-wrapper" style={{ position: 'relative' }}>
          <button
            className="pjc-share-btn"
            onClick={(e) => { e.stopPropagation(); setShowShareMenu(!showShareMenu) }}
          >
            <ShareIcon className="w-4 h-4" />
            Share
            <ChevronDownIcon className="w-3 h-3" />
          </button>
          {showShareMenu && (
            <div className="pjc-share-menu">
              <button onClick={(e) => { e.stopPropagation(); handleShare('copy') }}>Copy Link</button>
              <button onClick={(e) => { e.stopPropagation(); handleShare('linkedin') }}>LinkedIn</button>
              <button onClick={(e) => { e.stopPropagation(); handleShare('twitter') }}>Twitter</button>
              <button onClick={(e) => { e.stopPropagation(); handleShare('email') }}>Email</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
