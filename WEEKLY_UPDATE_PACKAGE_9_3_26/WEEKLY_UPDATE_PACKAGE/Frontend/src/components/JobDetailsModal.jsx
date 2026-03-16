import { XMarkIcon, MapPinIcon, CurrencyDollarIcon, BriefcaseIcon, AcademicCapIcon, ClockIcon } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid'

/**
 * JobDetailsModal - Displays full job details in a modal
 * 
 * Props:
 *  - job: Job data object
 *  - isSaved: Boolean indicating if job is saved
 *  - onClose: Function to close modal
 *  - onSave: Function to toggle save status
 *  - onApply: Function to open apply modal
 */
export default function JobDetailsModal({ job, isSaved, onClose, onSave, onApply }) {
  // Format salary
  const formatSalary = () => {
    if (!job.salary_start && !job.salary_end) return 'Not disclosed'
    const currency = job.currency || 'USD'
    const start = job.salary_start ? Number(job.salary_start).toLocaleString() : ''
    const end = job.salary_end ? Number(job.salary_end).toLocaleString() : ''
    
    if (start && end) return `${currency} ${start} - ${end}`
    if (start) return `${currency} ${start}+`
    if (end) return `Up to ${currency} ${end}`
    return 'Not disclosed'
  }

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  // Parse skills
  const getSkills = () => {
    if (!job.skills) return []
    return job.skills.split(',').map(s => s.trim()).filter(s => s)
  }

  // Get company logo or fallback
  const getLogoUrl = () => {
    if (job.photo_url && job.photo_url.startsWith('/')) {
      return job.photo_url
    }
    return job.photo_url
  }

  // Get company initial for fallback
  const getCompanyInitial = () => {
    return job.company?.charAt(0)?.toUpperCase() || 'J'
  }

  // Generate color for fallback logo
  const getLogoColor = () => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500'
    ]
    const hash = (job.company || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const skills = getSkills()
  const logoUrl = getLogoUrl()

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            {/* Company Logo */}
            <div className="flex-shrink-0">
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
              <h2 className="text-xl font-bold text-gray-900">{job.job_title || 'Job Position'}</h2>
              <p className="text-gray-600">{job.company || 'Company'}</p>
              {job.created_at && (
                <p className="text-sm text-gray-400 mt-1">
                  Posted on {formatDate(job.created_at)}
                </p>
              )}
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Job Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Location */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <MapPinIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Location</p>
                <p className="text-sm font-medium text-gray-900">{job.location || 'Not specified'}</p>
              </div>
            </div>
            
            {/* Salary */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Salary</p>
                <p className="text-sm font-medium text-gray-900">{formatSalary()}</p>
              </div>
            </div>
            
            {/* Employment Type */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <BriefcaseIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Employment Type</p>
                <p className="text-sm font-medium text-gray-900">{job.employment_type || 'Full Time'}</p>
              </div>
            </div>
            
            {/* Department */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <AcademicCapIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Department</p>
                <p className="text-sm font-medium text-gray-900">{job.department || job.category || 'Not specified'}</p>
              </div>
            </div>
          </div>
          
          {/* Job Description */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h3>
            <div 
              className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: job.job_description || '<p>No description available</p>' 
              }}
            />
          </div>
          
          {/* Requirements / Qualifications */}
          {job.required_qualification && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Requirements</h3>
              <div 
                className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: job.required_qualification 
                }}
              />
            </div>
          )}
          
          {/* Skills */}
          {skills.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Skills Required</h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Open Positions */}
          {job.open_positions && (
            <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-xl">
              <ClockIcon className="w-5 h-5 text-amber-600" />
              <span className="text-sm text-amber-800">
                {job.open_positions} position{job.open_positions > 1 ? 's' : ''} available
              </span>
            </div>
          )}
        </div>
        
        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onSave}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-colors ${
              isSaved 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isSaved ? (
              <>
                <BookmarkSolid className="w-5 h-5" />
                Saved
              </>
            ) : (
              <>
                <BookmarkOutline className="w-5 h-5" />
                Save Job
              </>
            )}
          </button>
          
          <button
            onClick={onApply}
            className="flex items-center gap-2 px-8 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            Apply for this Job
          </button>
        </div>
      </div>
    </div>
  )
}
