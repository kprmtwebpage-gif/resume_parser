import { XMarkIcon, BookmarkIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline'

/**
 * SavedJobsPanel - Slide-in panel showing saved jobs
 * 
 * Props:
 *  - savedJobs: Array of saved job objects
 *  - onClose: Function to close panel
 *  - onRemove: Function to remove a saved job
 *  - onViewJob: Function to view job details
 */
export default function SavedJobsPanel({ savedJobs, onClose, onRemove, onViewJob }) {
  // Format salary
  const formatSalary = (job) => {
    const actualJob = job.job || job
    if (!actualJob.salary_start && !actualJob.salary_end) return null
    const currency = actualJob.currency || 'USD'
    const start = actualJob.salary_start ? Number(actualJob.salary_start).toLocaleString() : ''
    const end = actualJob.salary_end ? Number(actualJob.salary_end).toLocaleString() : ''
    
    if (start && end) return `${currency} ${start} - ${end}`
    if (start) return `${currency} ${start}+`
    if (end) return `Up to ${currency} ${end}`
    return null
  }

  // Get company initial
  const getCompanyInitial = (company) => {
    return company?.charAt(0)?.toUpperCase() || 'J'
  }

  // Get random color for company logo
  const getLogoColor = (company) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500'
    ]
    const hash = (company || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  // Format saved date
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookmarkIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Saved Jobs</h2>
              <p className="text-sm text-gray-500">{savedJobs.length} saved</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-80px)]">
          {savedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
              <BookmarkIcon className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No saved jobs</h3>
              <p className="text-sm text-gray-500">
                Jobs you save will appear here for easy access
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {savedJobs.map((savedJob, index) => {
                const job = savedJob.job || savedJob
                const salary = formatSalary(savedJob)
                
                return (
                  <div
                    key={savedJob.id || index}
                    className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    {/* Job Info */}
                    <div className="flex items-start gap-3 mb-3">
                      {/* Logo */}
                      {job.photo_url ? (
                        <img
                          src={job.photo_url}
                          alt={job.company}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-lg ${getLogoColor(job.company)} flex items-center justify-center text-white font-bold`}>
                          {getCompanyInitial(job.company)}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {job.job_title || 'Untitled Position'}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">{job.company || 'Company'}</p>
                        <p className="text-xs text-gray-400">{job.location || 'Location'}</p>
                      </div>
                    </div>
                    
                    {/* Salary */}
                    {salary && (
                      <p className="text-sm text-green-600 font-medium mb-3">{salary}</p>
                    )}
                    
                    {/* Saved date */}
                    <p className="text-xs text-gray-400 mb-3">
                      Saved on {formatDate(savedJob.saved_at)}
                    </p>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onViewJob(savedJob)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <EyeIcon className="w-4 h-4" />
                        View Job
                      </button>
                      <button
                        onClick={() => onRemove(job)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove from saved"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
