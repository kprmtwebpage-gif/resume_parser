import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, DocumentArrowDownIcon, EnvelopeIcon, PhoneIcon, UserIcon, EyeIcon, TrashIcon } from '@heroicons/react/24/outline'
import { api } from '../services/api'
import CandidateProfileModal from './CandidateProfileModal'

export default function AppliedCandidatesModal({ isOpen, onClose, job }) {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (isOpen && job?.id) {
      fetchApplications()
    }
  }, [isOpen, job?.id])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await api.get(`/api/job-projects/${job.id}/applications`)
      setApplications(data || [])
    } catch (err) {
      console.error('Failed to fetch applications:', err)
      if (err.response?.status === 500) {
        setError('Could not load applications. Please ensure the FastAPI server is running on http://localhost:8000')
      } else if (err.response?.status === 404) {
        setError('Job not found. It may have been deleted.')
      } else if (err.isNetworkError || err.code === 'ERR_NETWORK') {
        setError('Cannot connect to backend server. Please ensure the FastAPI server is running on http://localhost:8000')
      } else {
        setError('Could not load applications. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleViewProfile = (application) => {
    setSelectedCandidate(application)
    setIsProfileModalOpen(true)
  }

  const closeProfileModal = () => {
    setIsProfileModalOpen(false)
    setSelectedCandidate(null)
  }

  const handleDeleteApplication = async (app) => {
    const appId = app.application_id || app.id
    const name = `${app.first_name || ''} ${app.last_name || ''}`.trim() || app.candidate_name || 'this candidate'
    
    if (!window.confirm(`Are you sure you want to delete the application from ${name}?\n\nThis action cannot be undone.`)) {
      return
    }

    try {
      setDeletingId(appId)
      await api.delete(`/api/job-projects/applications/${appId}`)
      // Remove from local state immediately
      setApplications(prev => prev.filter(a => (a.application_id || a.id) !== appId))
    } catch (err) {
      console.error('Failed to delete application:', err)
      alert(err.response?.data?.detail || 'Failed to delete application. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownloadResume = (app) => {
    const resumeUrl = app.resume_file || app.resume_url
    if (resumeUrl) {
      const fullUrl = resumeUrl.startsWith('http')
        ? resumeUrl
        : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${resumeUrl}`
      window.open(fullUrl, '_blank')
    }
  }

  const getCandidateName = (app) => {
    if (app.first_name || app.last_name) {
      return `${app.first_name || ''} ${app.last_name || ''}`.trim()
    }
    if (app.candidate_name) return app.candidate_name
    return 'Unknown Candidate'
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'â€”'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (s) => {
    const map = {
      applied: 'bg-blue-100 text-blue-700',
      PENDING: 'bg-amber-100 text-amber-700',
      REVIEWED: 'bg-blue-100 text-blue-700',
      SHORTLISTED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
      HIRED: 'bg-purple-100 text-purple-700',
    }
    return map[s] || 'bg-gray-100 text-gray-700'
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-neutral-900">
                      Applied Candidates
                    </Dialog.Title>
                    {job && (
                      <p className="text-sm text-neutral-500 mt-0.5">
                        {job.title || job.job_title || 'Untitled Job'} â€¢ {applications.length} application{applications.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                  {loading && (
                    <div className="flex items-center justify-center py-12">
                      <p className="text-sm text-neutral-500">Loading applications...</p>
                    </div>
                  )}

                  {!loading && error && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <p className="text-sm text-red-600 mb-3">{error}</p>
                      <button
                        type="button"
                        className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm rounded-lg"
                        onClick={fetchApplications}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!loading && !error && applications.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <UserIcon className="h-12 w-12 text-neutral-300 mb-4" />
                      <h3 className="text-lg font-medium text-neutral-700 mb-2">No applications yet</h3>
                      <p className="text-sm text-neutral-500">Candidates who apply to this job will appear here.</p>
                    </div>
                  )}

                  {!loading && !error && applications.length > 0 && (
                    <div className="space-y-3">
                      {applications.map((app) => {
                        const appId = app.application_id || app.id
                        const isDeleting = deletingId === appId
                        return (
                          <div
                            key={appId}
                            className={`flex items-start gap-4 p-4 bg-neutral-50 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-all ${isDeleting ? 'opacity-50' : ''}`}
                          >
                            {/* Avatar */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                              <UserIcon className="h-5 w-5 text-brand-600" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <button
                                  type="button"
                                  className="text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline truncate text-left"
                                  onClick={() => handleViewProfile(app)}
                                  title="Click to view full profile"
                                >
                                  {getCandidateName(app)}
                                </button>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${getStatusBadge(app.application_status)}`}>
                                  {app.application_status || 'applied'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                                {(app.email || app.candidate_email) && (
                                  <span className="flex items-center gap-1">
                                    <EnvelopeIcon className="h-3.5 w-3.5" />
                                    {app.email || app.candidate_email}
                                  </span>
                                )}
                                {(app.phone || app.candidate_phone) && (
                                  <span className="flex items-center gap-1">
                                    <PhoneIcon className="h-3.5 w-3.5" />
                                    {app.phone || app.candidate_phone}
                                  </span>
                                )}
                                <span>Applied: {formatDate(app.applied_at)}</span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                type="button"
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 rounded-md hover:bg-neutral-200 transition-colors"
                                onClick={() => handleViewProfile(app)}
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                View Profile
                              </button>
                              {(app.resume_file || app.resume_url) && (
                                <button
                                  type="button"
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-brand-700 bg-brand-100 rounded-md hover:bg-brand-200 transition-colors"
                                  onClick={() => handleDownloadResume(app)}
                                >
                                  <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                                  Resume
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isDeleting}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => handleDeleteApplication(app)}
                                title="Delete this application"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                                {isDeleting ? '...' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end border-t border-neutral-200 px-6 py-4">
                  <button
                    type="button"
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium text-sm rounded-lg transition-colors"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>

      {/* Candidate Profile Modal */}
      <CandidateProfileModal
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
        candidate={selectedCandidate}
      />
    </Transition>
  )
}

