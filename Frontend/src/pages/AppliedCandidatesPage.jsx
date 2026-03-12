import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRightIcon, BriefcaseIcon, ListBulletIcon, ArrowUpTrayIcon, ArrowLeftIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../services/api'

export default function AppliedCandidatesPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { colors, isDark } = useTheme()

  const [job, setJob] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [jobDetailOpen, setJobDetailOpen] = useState(false)
  const [candidateListOpen, setCandidateListOpen] = useState(false)

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

  const handleExport = () => {
    if (!applications.length) return
    const headers = ['S.No', 'First Name', 'Last Name', 'Address', 'Phone', 'Email', 'Qualification', 'Work Authorization Type', 'LinkedIn', 'Tech Experience', 'Domain Expert', 'Resume', 'Submitted On', 'Created On']
    const rows = applications.map((app, idx) => [
      idx + 1,
      app.first_name || '',
      app.last_name || '',
      app.address || '',
      app.phone || app.candidate_phone || '',
      app.email || app.candidate_email || '',
      app.education || '',
      app.citizenship || '',
      app.linkedin_url || '',
      app.tech_experience || '',
      app.domain_expert || '',
      app.resume_filename || '',
      app.submitted_at ? new Date(app.submitted_at).toLocaleString() : '',
      job?.created_at ? new Date(job.created_at).toLocaleString() : ''
    ])
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `candidates_${job?.job_title || 'job'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getStatusBadge = (s) => {
    const map = {
      POSTED: 'bg-green-100 text-green-700',
      DRAFT: 'bg-gray-100 text-gray-700',
      HELD: 'bg-amber-100 text-amber-700',
      CLOSED: 'bg-red-100 text-red-700',
      'NOT PUBLISHED': 'bg-red-50 text-red-600',
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
  const jobSalaryStart = job?.salary_start ?? job?.salary_min
  const jobSalaryEnd = job?.salary_end ?? job?.salary_max
  const jobSalary = (jobSalaryStart != null && jobSalaryEnd != null)
    ? `$${Number(jobSalaryStart).toLocaleString()} - $${Number(jobSalaryEnd).toLocaleString()}`
    : job?.salary || '—'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm mb-5">
        <Link to="/jobs" className="text-gray-400 hover:text-gray-600 transition-colors">Jobs</Link>
        <span className="text-gray-300">/</span>
        <Link to="/jobs" className="text-gray-400 hover:text-gray-600 transition-colors">Posted Jobs</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold" style={{ color: colors.text }}>Candidate details</span>
      </nav>

      {/* Back Button */}
      <button
        onClick={() => navigate('/jobs')}
        className="flex items-center gap-2 px-5 py-2.5 mb-6 text-sm font-medium text-white rounded-lg transition-colors"
        style={{ backgroundColor: '#6366f1' }}
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back
      </button>

      {/* Job Detail Accordion */}
      <div
        className="rounded-xl border mb-4 overflow-hidden"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        <button
          onClick={() => setJobDetailOpen(!jobDetailOpen)}
          className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors hover:opacity-80"
        >
          <div className="flex items-center gap-3">
            <BriefcaseIcon className="h-5 w-5 text-gray-500" />
            <span className="text-base font-semibold" style={{ color: '#6366f1' }}>Job Detail</span>
          </div>
          <ChevronRightIcon
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${jobDetailOpen ? 'rotate-90' : ''}`}
          />
        </button>

        {jobDetailOpen && (
          <div className="px-6 pb-6 border-t" style={{ borderColor: colors.border }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 mt-5 text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold min-w-[160px]" style={{ color: '#6366f1' }}>Id :</span>
                <span style={{ color: colors.text }}>{ applications.length > 0 ? 1 : '—' }</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold min-w-[160px]" style={{ color: '#6366f1' }}>Title :</span>
                <span style={{ color: colors.text }}>{jobTitle}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold min-w-[160px]" style={{ color: '#6366f1' }}>Type :</span>
                <span className="px-3 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-700">{jobType}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold min-w-[160px]" style={{ color: '#6366f1' }}>Company Name :</span>
                <span style={{ color: colors.text }}>{jobCompany}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold min-w-[160px]" style={{ color: '#6366f1' }}>Salary :</span>
                <span className="px-3 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700">{jobSalary}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold min-w-[160px]" style={{ color: '#6366f1' }}>Qualification :</span>
                <span style={{ color: colors.text }}>{jobQualification}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold min-w-[160px]" style={{ color: '#6366f1' }}>Applied Candidate No :</span>
                <span style={{ color: colors.text }}>{applications.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold min-w-[160px]" style={{ color: '#6366f1' }}>Status :</span>
                <span className={`px-3 py-0.5 text-xs font-semibold rounded ${getStatusBadge(jobStatus)}`}>{jobStatus}</span>
              </div>
            </div>
            {job?.job_description && (
              <div className="mt-5 text-sm">
                <span className="font-semibold" style={{ color: '#6366f1' }}>Description: </span>
                <span
                  className="prose prose-sm max-w-none inline"
                  style={{ color: colors.text }}
                  dangerouslySetInnerHTML={{ __html: job.job_description }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Candidate List Accordion */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        <button
          onClick={() => setCandidateListOpen(!candidateListOpen)}
          className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors hover:opacity-80"
        >
          <div className="flex items-center gap-3">
            <ListBulletIcon className="h-5 w-5 text-gray-500" />
            <span className="text-base font-semibold" style={{ color: '#6366f1' }}>Candidate List</span>
          </div>
          <ChevronRightIcon
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${candidateListOpen ? 'rotate-90' : ''}`}
          />
        </button>

        {candidateListOpen && (
          <div className="border-t" style={{ borderColor: colors.border }}>
            {/* Export Button */}
            <div className="px-6 py-4">
              <button
                onClick={handleExport}
                disabled={!applications.length}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#6366f1' }}
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                Export
              </button>
            </div>

            {applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <h3 className="text-lg font-medium mb-2" style={{ color: colors.text }}>No applications yet</h3>
                <p className="text-sm" style={{ color: colors.textSecondary }}>Candidates who apply to this job will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto px-6 pb-6">
                <table className="w-full text-sm border-collapse" style={{ borderColor: colors.border, minWidth: '1400px' }}>
                  <thead>
                    <tr style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>S.No</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>First Name</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>Last Name</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>Address</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>Email</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>Qualification</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>Work Authorization Type</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>LinkedIn</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>Tech Experience</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>Domain Expert</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>Resume</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>Submitted On</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border" style={{ color: colors.textSecondary, borderColor: colors.border }}>Created On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app, idx) => {
                      const appId = app.application_id || app.id
                      return (
                        <tr
                          key={appId}
                          className="border-b transition-colors"
                          style={{
                            borderColor: colors.border,
                            backgroundColor: idx % 2 === 0
                              ? (isDark ? '#0f172a' : '#ffffff')
                              : (isDark ? '#1e293b' : '#f9fafb')
                          }}
                        >
                          <td className="px-4 py-3 border" style={{ color: colors.text, borderColor: colors.border }}>{idx + 1}</td>
                          <td className="px-4 py-3 border" style={{ color: colors.text, borderColor: colors.border }}>{app.first_name || '—'}</td>
                          <td className="px-4 py-3 border" style={{ color: colors.text, borderColor: colors.border }}>{app.last_name || '—'}</td>
                          <td className="px-4 py-3 border" style={{ color: colors.text, borderColor: colors.border }}>{app.address || '—'}</td>
                          <td className="px-4 py-3 border" style={{ color: colors.text, borderColor: colors.border }}>{app.phone || app.candidate_phone || '—'}</td>
                          <td className="px-4 py-3 border" style={{ color: colors.text, borderColor: colors.border }}>{app.email || app.candidate_email || '—'}</td>
                          <td className="px-4 py-3 border" style={{ color: colors.text, borderColor: colors.border }}>{app.education || '—'}</td>
                          <td className="px-4 py-3 border" style={{ color: colors.text, borderColor: colors.border }}>{app.citizenship || '—'}</td>
                          <td className="px-4 py-3 border" style={{ borderColor: colors.border }}>
                            {app.linkedin_url ? (
                              <a href={app.linkedin_url} target="_blank" rel="noopener noreferrer" title="View LinkedIn Profile">
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#0A66C2">
                                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                </svg>
                              </a>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 border" style={{ color: colors.text, borderColor: colors.border }}>{app.tech_experience || '—'}</td>
                          <td className="px-4 py-3 border" style={{ color: colors.text, borderColor: colors.border }}>{app.domain_expert || '—'}</td>
                          <td className="px-4 py-3 border" style={{ borderColor: colors.border }}>
                            {app.resume_url ? (
                              <a href={`${import.meta.env.VITE_API_BASE_URL || ''}${app.resume_url}`} target="_blank" rel="noopener noreferrer" title={app.resume_filename || 'Download Resume'}>
                                <ArrowDownTrayIcon className="h-5 w-5 text-blue-600 hover:text-blue-800" />
                              </a>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap border" style={{ color: colors.text, borderColor: colors.border }}>{app.submitted_at ? new Date(app.submitted_at).toLocaleString() : '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap border" style={{ color: colors.text, borderColor: colors.border }}>{job?.created_at ? new Date(job.created_at).toLocaleString() : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
