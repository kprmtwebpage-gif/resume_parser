import { useState, useRef, useEffect } from 'react'
import { PencilSquareIcon, EyeIcon, GlobeAltIcon, BriefcaseIcon, EllipsisVerticalIcon, UserGroupIcon, DocumentDuplicateIcon, PauseCircleIcon, PlayCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import './JobCard.css'

/**
 * JobCard — displays a single job in the list.
 *
 * Props:
 *  - job           : job data object
 *  - onEdit        : (job) => void
 *  - onReview      : (job) => void
 *  - onPublish     : (job) => void   — used for both Post and Unpost
 *  - onCopy        : (job) => void   — copy/duplicate job
 *  - onHold        : (job) => void   — hold job
 *  - onUnhold      : (job) => void   — resume from hold
 *  - onClose       : (job) => void   — close job
 *  - onApplied     : (job) => void   — view applied candidates
 */
export default function JobCard({ job, onEdit, onReview, onPublish, onCopy, onHold, onUnhold, onClose, onApplied, onAnalyze }) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)
  
  const isPosted = job.status === 'POSTED'
  const isOnHold = job.status === 'HOLD'
  const isClosed = job.status === 'CLOSED'
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* Format salary range */
  const salaryText = () => {
    if (!job.salary_start && !job.salary_end) return null
    const fmt = (v) => Number(v).toLocaleString()
    const cur = job.currency || 'USD'
    if (job.salary_start && job.salary_end) return `${cur} ${fmt(job.salary_start)} – ${fmt(job.salary_end)}`
    if (job.salary_start) return `${cur} ${fmt(job.salary_start)}+`
    return `Up to ${cur} ${fmt(job.salary_end)}`
  }

  /* Format date */
  const dateText = () => {
    if (!job.createdAt) return null
    const d = new Date(job.createdAt)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  /* Priority color */
  const priorityClass = () => {
    switch (job.priority) {
      case 'High': return 'jc-badge--red'
      case 'Low': return 'jc-badge--gray'
      default: return 'jc-badge--blue'
    }
  }

  /* Status color */
  const statusClass = () => {
    if (isPosted) return 'jc-badge--green'
    if (isOnHold) return 'jc-badge--amber'
    if (isClosed) return 'jc-badge--gray'
    switch (job.status) {
      case 'Stopped':
      case 'Closed': return 'jc-badge--gray'
      case 'In Progress': return 'jc-badge--blue'
      case 'Needs Approval': return 'jc-badge--amber'
      default: return 'jc-badge--slate'
    }
  }
  
  /* Status display text */
  const statusText = () => {
    if (isOnHold) return 'ON HOLD'
    if (isClosed) return 'CLOSED'
    if (isPosted) return 'POSTED'
    return job.status || 'DRAFT'
  }
  
  /* Status badge for live/hold/closed */
  const getLiveBadge = () => {
    if (isPosted) {
      return (
        <span className="jc-live-badge jc-live-badge--live">LIVE</span>
      )
    }
    if (isOnHold) {
      return (
        <span className="jc-live-badge jc-live-badge--hold">HOLD</span>
      )
    }
    if (isClosed) {
      return (
        <span className="jc-live-badge jc-live-badge--closed">CLOSED</span>
      )
    }
    return null
  }
  
  // Get applications count
  const applicationsCount = job.applications_count || 0

  return (
    <div className={`jc-card ${isOnHold ? 'jc-card--hold' : ''} ${isClosed ? 'jc-card--closed' : ''}`}>
      {/* Left — logo */}
      <div className="jc-logo-col">
        {job.photo_url ? (
          <img 
            src={`${import.meta.env.VITE_API_BASE_URL || ''}${job.photo_url}`} 
            alt="" 
            className="jc-logo-img" 
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
          />
        ) : null}
        <div className="jc-logo-fallback" style={{ display: job.photo_url ? 'none' : 'flex' }}>
          <BriefcaseIcon className="w-6 h-6" />
        </div>
      </div>

      {/* Center — info */}
      <div className="jc-info-col">
        <div className="flex items-center gap-2">
          <h3 
            className="jc-title jc-title--clickable" 
            onClick={() => onReview && onReview(job)}
            title="Click to view job details"
          >
            {job.title || 'Untitled Job'}
          </h3>
          {getLiveBadge()}
        </div>
        <p className="jc-company">{job.company || '—'}</p>

        <div className="jc-meta">
          {job.location && <span className="jc-meta-item">{String(job.location).replace(/ \| /g, ', ')}</span>}
          {job.employment_type && <span className="jc-meta-item">{job.employment_type}</span>}
          {salaryText() && <span className="jc-meta-item">{salaryText()}</span>}
          {dateText() && <span className="jc-meta-item jc-meta-date">{dateText()}</span>}
        </div>

        <div className="jc-badges">
          <span className={`jc-badge ${priorityClass()}`}>{job.priority || 'Normal'}</span>
          <span className={`jc-badge ${statusClass()}`}>{statusText()}</span>
          {job.department && <span className="jc-badge jc-badge--slate">{job.department}</span>}
        </div>
      </div>

      {/* Right — actions */}
      <div className="jc-actions-col">
        {/* Applied Candidates Button (Feature 11) */}
        {onApplied && (
          <button 
            type="button" 
            className="jc-action-btn jc-action-btn--applied" 
            title="View applied candidates"
            onClick={() => onApplied(job)}
          >
            <UserGroupIcon className="w-4 h-4" />
            <span>Applied ({applicationsCount})</span>
          </button>
        )}
        {/* ATS Analyze Profiles */}
        {onAnalyze && (
          <button
            type="button"
            className="jc-action-btn"
            style={{ backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}
            title="Analyze candidate profiles for this job"
            onClick={() => onAnalyze(job)}
          >
            <BriefcaseIcon className="w-4 h-4" />
            <span>Analyze</span>
          </button>
        )}

        <button type="button" className="jc-action-btn jc-action-btn--blue" title="Edit" onClick={() => onEdit(job)}>
          <PencilSquareIcon className="w-4 h-4" />
          <span>Edit</span>
        </button>
        <button type="button" className="jc-action-btn jc-action-btn--green" title="Review" onClick={() => onReview(job)}>
          <EyeIcon className="w-4 h-4" />
          <span>Review</span>
        </button>
        <button
          type="button"
          className={`jc-action-btn ${isPosted ? 'jc-action-btn--red' : 'jc-action-btn--post'}`}
          title={isPosted ? 'Unpost this job' : 'Post to public'}
          onClick={() => onPublish(job)}
          disabled={isOnHold || isClosed}
        >
          <GlobeAltIcon className="w-4 h-4" />
          <span>{isPosted ? 'Unpost' : 'Post'}</span>
        </button>
        
        {/* Three-dot Action Menu (Feature 5) */}
        <div className="jc-menu-wrapper" ref={menuRef}>
          <button
            type="button"
            className="jc-action-btn jc-action-btn--menu"
            title="More actions"
            onClick={() => setShowMenu(!showMenu)}
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>
          
          {showMenu && (
            <div className="jc-menu-dropdown">
              {/* Copy Job */}
              {onCopy && (
                <button
                  type="button"
                  className="jc-menu-item"
                  onClick={() => {
                    onCopy(job)
                    setShowMenu(false)
                  }}
                >
                  <DocumentDuplicateIcon className="w-4 h-4" />
                  <span>Copy Job</span>
                </button>
              )}
              
              {/* Hold/Unhold Job */}
              {isOnHold ? (
                onUnhold && (
                  <button
                    type="button"
                    className="jc-menu-item"
                    onClick={() => {
                      onUnhold(job)
                      setShowMenu(false)
                    }}
                  >
                    <PlayCircleIcon className="w-4 h-4" />
                    <span>Resume Job</span>
                  </button>
                )
              ) : (
                onHold && !isClosed && (
                  <button
                    type="button"
                    className="jc-menu-item"
                    onClick={() => {
                      onHold(job)
                      setShowMenu(false)
                    }}
                  >
                    <PauseCircleIcon className="w-4 h-4" />
                    <span>Hold Job</span>
                  </button>
                )
              )}
              
              {/* Close Job */}
              {onClose && !isClosed && (
                <button
                  type="button"
                  className="jc-menu-item jc-menu-item--danger"
                  onClick={() => {
                    onClose(job)
                    setShowMenu(false)
                  }}
                >
                  <XCircleIcon className="w-4 h-4" />
                  <span>Close Job</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
