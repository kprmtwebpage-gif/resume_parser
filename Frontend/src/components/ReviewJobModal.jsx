import { XMarkIcon, MapPinIcon, CurrencyDollarIcon, BriefcaseIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { apiUrl } from '../config'

/**
 * ReviewJobModal - Professional read-only job details popup for the HR Jobs page.
 * Matches the Find Jobs page popup style (JobDetailsModal).
 *
 * Props:
 *  - isOpen: Boolean
 *  - onClose: Function
 *  - job: Job data object (frontend format from fromApiRecord)
 */
export default function ReviewJobModal({ isOpen, onClose, job }) {
  if (!isOpen || !job) return null

  /* ── Helpers ── */

  const formatSalary = () => {
    const start = job.salary_start
    const end = job.salary_end
    if (!start && !end) return 'Not disclosed'
    const currency = job.currency || 'USD'
    const fmt = (v) => Number(v).toLocaleString()
    if (start && end) return `${currency} ${fmt(start)} – ${fmt(end)}`
    if (start) return `${currency} ${fmt(start)}+`
    return `Up to ${currency} ${fmt(end)}`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // location is a pipe-separated string or array in frontend format
  const formatLocation = () => {
    const loc = job.location
    if (!loc) return 'Not specified'
    if (Array.isArray(loc)) return loc.join(', ')
    return loc.replace(/ \| /g, ', ').replace(/\|/g, ', ')
  }

  const getSkills = () => {
    if (!job.skills) return []
    const raw = job.skills
    const sep = raw.includes(' | ') ? ' | ' : ','
    return raw.split(sep).map((s) => s.trim()).filter(Boolean)
  }

  const getLogoUrl = () => {
    if (job.photo_url) return apiUrl(job.photo_url)
    return null
  }

  const getCompanyInitial = () => job.company?.charAt(0)?.toUpperCase() || 'J'

  const getLogoColor = () => {
    const palette = [
      'bg-blue-500', 'bg-purple-500', 'bg-green-500',
      'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
    ]
    const hash = (job.company || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    return palette[hash % palette.length]
  }

  const logoUrl = getLogoUrl()
  const skills = getSkills()
  const postedDate = formatDate(job.createdAt || job.created_at)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Company Logo */}
            <div className="flex-shrink-0 relative">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={job.company}
                  className="w-16 h-16 rounded-xl object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
              ) : null}
              <div
                className={`w-16 h-16 rounded-xl ${getLogoColor()} flex items-center justify-center text-white font-bold text-2xl ${logoUrl ? 'hidden' : ''}`}
              >
                {getCompanyInitial()}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900">{job.title || 'Job Position'}</h2>
              <p className="text-gray-600 text-sm mt-0.5">{job.company || 'Company'}</p>
              {postedDate && (
                <p className="text-xs text-gray-400 mt-1">Posted on {postedDate}</p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="p-6 overflow-y-auto flex-1">

          {/* Info Cards Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Location */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPinIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Location</p>
                <p className="text-sm font-medium text-gray-900 truncate">{formatLocation()}</p>
              </div>
            </div>

            {/* Salary */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Salary</p>
                <p className="text-sm font-medium text-gray-900 truncate">{formatSalary()}</p>
              </div>
            </div>

            {/* Employment Type */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <BriefcaseIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Employment Type</p>
                <p className="text-sm font-medium text-gray-900">{job.employment_type || 'Not specified'}</p>
              </div>
            </div>

            {/* Department */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <BuildingOfficeIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Department</p>
                <p className="text-sm font-medium text-gray-900">{job.department || job.category || 'Not specified'}</p>
              </div>
            </div>
          </div>

          {/* Job Description */}
          {job.description && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h3>
              <div
                className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            </div>
          )}

          {/* Requirements / Qualifications */}
          {job.qualification && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Requirements</h3>
              <div
                className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: job.qualification }}
              />
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Skills Required</h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Open Positions */}
          {job.positions && (
            <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-xl">
              <BriefcaseIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <span className="text-sm text-amber-800">
                {job.positions} position{Number(job.positions) !== 1 ? 's' : ''} available
              </span>
            </div>
          )}
        </div>


      </div>
    </div>
  )
}
