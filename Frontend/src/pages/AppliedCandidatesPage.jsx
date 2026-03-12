import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, DocumentArrowDownIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../services/api'
import CandidateProfileModal from '../components/CandidateProfileModal'

export default function AppliedCandidatesPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { colors, isDark } = useTheme()

  const [job, setJob] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  useEffect(() => {
    if (jobId) {
      fetchJobAndApplications()
    }
  }, [jobId])

  const fetchJobAndApplications = async () => {
    try {
      setLoading(true)
      setError(null)
      const [jobRes, appsRes] = await Promise.all([
        api.get(`/api/job-projects/${jobId}`),
        api.get(`/api/job-projects/${jobId}/applications`)
      ])
      setJob(jobRes.data)
      setApplications(appsRes.data || [])
    } catch (err) {
      console.error('Failed to fetch job/applications:', err)
      if (err.response?.status === 404) {
        setError('Job not found. It may have been deleted.')
      } else {
        setError('Could not load applications. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteApplication = async (app) => {
    const appId = app.application_id || app.id
    const name = `${app.first_name || ''} ${app.last_name || ''}`.trim() || app.candidate_name || 'this candidate'
    if (!window.confirm(`Are you sure you want to delete the application from ${name}?\n\nThis action cannot be undone.`)) return

    try {
      setDeletingId(appId)
      await api.delete(`/api/job-projects/applications/${appId}`)
      setApplications(prev => prev.filter(a => (a.application_id || a.id) !== appId))
    } catch (err) {
      console.error('Failed to delete application:', err)
      alert(err.response?.data?.detail || 'Failed to delete application.')
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

  const handleViewProfile = (app) => {
    setSelectedCandidate(app)
    setIsProfileModalOpen(true)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span className="ml-3 text-sm text-neutral-500">Loading applications...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button onClick={fetchJobAndApplications} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg">
          Retry
        </button>
      </div>
    )
  }

  const jobTitle = job?.job_title || job?.title || 'Untitled Job'
  const jobCompany = job?.company || '—'
  const jobType = job?.employment_type || job?.type || '—'
  const jobStatus = job?.status || '—'
  const jobQualification = job?.required_qualification || job?.qualification || '—'
  const jobSalary = job?.salary_min && job?.salary_max
    ? `$${Number(job.salary_min).toLocaleString()} – $${Number(job.salary_max).toLocaleString()}`
    : job?.salary || '—'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/jobs')}
        className="flex items-center gap-2 text-sm font-medium mb-4 hover:underline"
        style={{ color: colors.primary || '#3b82f6' }}
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Jobs
      </button>

      {/* Job Details Card */}
      <div
        className="rounded-xl border p-6 mb-6"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        <h1 className="text-xl font-bold mb-4" style={{ color: colors.text }}>
          Candidate Details
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium" style={{ color: colors.textSecondary }}>Title</span>
            <p className="mt-1" style={{ color: colors.text }}>{jobTitle}</p>
          </div>
          <div>
            <span className="font-medium" style={{ color: colors.textSecondary }}>Type</span>
            <p className="mt-1" style={{ color: colors.text }}>{jobType}</p>
          </div>
          <div>
            <span className="font-medium" style={{ color: colors.textSecondary }}>Company</span>
            <p className="mt-1" style={{ color: colors.text }}>{jobCompany}</p>
          </div>
          <div>
            <span className="font-medium" style={{ color: colors.textSecondary }}>Salary</span>
            <p className="mt-1" style={{ color: colors.text }}>{jobSalary}</p>
          </div>
          <div>
            <span className="font-medium" style={{ color: colors.textSecondary }}>Qualification</span>
            <p className="mt-1" style={{ color: colors.text }}>{jobQualification}</p>
          </div>
          <div>
            <span className="font-medium" style={{ color: colors.textSecondary }}>Applied Candidates</span>
            <p className="mt-1 font-semibold" style={{ color: colors.text }}>{applications.length}</p>
          </div>
          <div>
            <span className="font-medium" style={{ color: colors.textSecondary }}>Status</span>
            <p className="mt-1">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(jobStatus)}`}>
                {jobStatus}
              </span>
            </p>
          </div>
        </div>
        {job?.job_description && (
          <div className="mt-4">
            <span className="font-medium text-sm" style={{ color: colors.textSecondary }}>Description</span>
            <p className="mt-1 text-sm whitespace-pre-line" style={{ color: colors.text }}>{job.job_description}</p>
          </div>
        )}
      </div>

      {/* Candidates Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        {applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.text }}>No applications yet</h3>
            <p className="text-sm" style={{ color: colors.textSecondary }}>Candidates who apply to this job will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc' }}>
                  <th className="px-4 py-3 text-left font-semibold border-b" style={{ color: colors.text, borderColor: colors.border }}>S.No</th>
                  <th className="px-4 py-3 text-left font-semibold border-b" style={{ color: colors.text, borderColor: colors.border }}>First Name</th>
                  <th className="px-4 py-3 text-left font-semibold border-b" style={{ color: colors.text, borderColor: colors.border }}>Last Name</th>
                  <th className="px-4 py-3 text-left font-semibold border-b" style={{ color: colors.text, borderColor: colors.border }}>Address</th>
                  <th className="px-4 py-3 text-left font-semibold border-b" style={{ color: colors.text, borderColor: colors.border }}>Phone</th>
                  <th className="px-4 py-3 text-left font-semibold border-b" style={{ color: colors.text, borderColor: colors.border }}>Email</th>
                  <th className="px-4 py-3 text-left font-semibold border-b" style={{ color: colors.text, borderColor: colors.border }}>Qualification</th>
                  <th className="px-4 py-3 text-left font-semibold border-b" style={{ color: colors.text, borderColor: colors.border }}>Work Auth Type</th>
                  <th className="px-4 py-3 text-left font-semibold border-b" style={{ color: colors.text, borderColor: colors.border }}>Applied Date</th>
                  <th className="px-4 py-3 text-left font-semibold border-b" style={{ color: colors.text, borderColor: colors.border }}>Status</th>
                  <th className="px-4 py-3 text-center font-semibold border-b" style={{ color: colors.text, borderColor: colors.border }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app, idx) => {
                  const appId = app.application_id || app.id
                  const isDeleting = deletingId === appId
                  return (
                    <tr
                      key={appId}
                      className={`border-b transition-colors ${isDeleting ? 'opacity-50' : ''}`}
                      style={{
                        borderColor: colors.border,
                        backgroundColor: idx % 2 === 0
                          ? (isDark ? '#0f172a' : '#ffffff')
                          : (isDark ? '#1e293b' : '#f9fafb')
                      }}
                    >
                      <td className="px-4 py-3" style={{ color: colors.text }}>{idx + 1}</td>
                      <td className="px-4 py-3" style={{ color: colors.text }}>{app.first_name || '—'}</td>
                      <td className="px-4 py-3" style={{ color: colors.text }}>{app.last_name || '—'}</td>
                      <td className="px-4 py-3" style={{ color: colors.text }}>{app.address || '—'}</td>
                      <td className="px-4 py-3" style={{ color: colors.text }}>{app.phone || app.candidate_phone || '—'}</td>
                      <td className="px-4 py-3" style={{ color: colors.text }}>{app.email || app.candidate_email || '—'}</td>
                      <td className="px-4 py-3" style={{ color: colors.text }}>{app.education || '—'}</td>
                      <td className="px-4 py-3" style={{ color: colors.text }}>{app.citizenship || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: colors.textSecondary }}>{formatDate(app.applied_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(app.application_status)}`}>
                          {app.application_status || 'applied'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewProfile(app)}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                            title="View Profile"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          {(app.resume_file || app.resume_url) && (
                            <button
                              onClick={() => handleDownloadResume(app)}
                              className="p-1.5 rounded hover:bg-green-50 text-green-600 transition-colors"
                              title="Download Resume"
                            >
                              <DocumentArrowDownIcon className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteApplication(app)}
                            disabled={isDeleting}
                            className="p-1.5 rounded hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                            title="Delete Application"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Candidate Profile Modal */}
      <CandidateProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => { setIsProfileModalOpen(false); setSelectedCandidate(null) }}
        candidate={selectedCandidate}
      />
    </div>
  )
}
