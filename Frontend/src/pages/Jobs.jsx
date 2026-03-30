import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon, ArchiveBoxIcon, ArrowPathIcon, TrashIcon, MagnifyingGlassIcon, ArrowDownTrayIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { api } from '../services/api'
import CreateJobModal from '../components/CreateJobModal'
import JobCard from '../components/JobCard'
import JobMatchPanel from '../components/ats/JobMatchPanel'
import FloatingInput from '../components/FloatingInput'
import TagInput from '../components/TagInput'
import '../components/FloatingInput.css'

/* ── Field-name mapping between frontend form keys and API (DB) keys ── */
const FRONTEND_TO_API = {
  title: 'job_title',
  description: 'job_description',
  qualification: 'required_qualification',
  positions: 'open_positions',
}
const API_TO_FRONTEND = Object.fromEntries(
  Object.entries(FRONTEND_TO_API).map(([k, v]) => [v, k]),
)
const LOGO_KEYS = new Set(['logoFile', 'logoPreview'])

/** Convert a frontend form object → API payload */
function toApiPayload(formObj) {
  const out = {}
  for (const [k, v] of Object.entries(formObj)) {
    if (LOGO_KEYS.has(k)) continue            // skip client-only logo fields
    const apiKey = FRONTEND_TO_API[k] || k
    if (apiKey === 'open_positions') {
      out[apiKey] = v ? Number(v) : null
    } else if (apiKey === 'salary_start' || apiKey === 'salary_end') {
      out[apiKey] = v ? String(v) : null
    } else {
      out[apiKey] = v || null
    }
  }
  return out
}

/** Convert an API response object → frontend-friendly object */
function fromApiRecord(rec) {
  const out = {}
  for (const [k, v] of Object.entries(rec)) {
    const feKey = API_TO_FRONTEND[k] || k
    if (feKey === 'positions') {
      out[feKey] = v != null ? String(v) : ''
    } else {
      out[feKey] = v ?? ''
    }
  }
  // aliases the JobCard still reads directly
  out.createdAt = rec.created_at
  return out
}

// Collapsible Section Component
function CollapsibleSection({ title, children, defaultOpen = true, isMainFilter = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  if (isMainFilter) {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors rounded-lg ${
            isOpen 
              ? 'bg-brand-500 text-white' 
              : 'bg-brand-500 text-white hover:bg-brand-600'
          }`}
        >
          <span className="text-sm font-medium">{title}</span>
          {isOpen ? (
            <ChevronUpIcon className="w-4 h-4" />
          ) : (
            <ChevronDownIcon className="w-4 h-4" />
          )}
        </button>
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isOpen ? 'max-h-[3000px] opacity-100 mt-4' : 'max-h-0 opacity-0'
          }`}
        >
          {children}
        </div>
      </div>
    )
  }
  
  return (
    <div className="border-b border-neutral-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-neutral-50 transition-colors rounded-md"
      >
        <span className="text-sm font-semibold text-neutral-800">{title}</span>
        {isOpen ? (
          <ChevronUpIcon className="w-4 h-4 text-neutral-500" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 text-neutral-500" />
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100 pb-4' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

export default function Jobs() {
  const navigate = useNavigate()
  
  /* ── Jobs state ── */
  const [jobs, setJobs] = useState([])
  const [analyzeJobTarget, setAnalyzeJobTarget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /* ── Archive state ── */
  const [archivedJobs, setArchivedJobs] = useState([])
  const [showArchive, setShowArchive] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)

  /* ── Modal state ── */
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')   // 'create' | 'edit' | 'review'
  const [modalJob, setModalJob] = useState(null)          // job being edited / reviewed

  const [filters, setFilters] = useState({
    title: '',
    location: '',
    company: '',
    status: '',
    priority: '',
    createdBy: '',
    assignees: '',
    skills: [],  // Changed to array for tag input
    category: '',
    reason: '',
    department: '',
    salaryMin: '',
    salaryMax: '',
    employmentType: '',
  })

  /* ── Filter suggestions from API ── */
  const [filterSuggestions, setFilterSuggestions] = useState({
    jobTitles: [],
    companies: [],
    locations: [],
    departments: [],
    categories: [],
    skills: [],
  })

  /* ── Fetch filter suggestions from API ── */
  const fetchFilterSuggestions = useCallback(async () => {
    try {
      const [titlesRes, companiesRes, locationsRes, depsRes, catsRes, skillsRes] = await Promise.all([
        api.get('/api/job-projects/filters/job-titles').catch(() => ({ data: { data: [] } })),
        api.get('/api/job-projects/filters/companies').catch(() => ({ data: { data: [] } })),
        api.get('/api/job-projects/filters/locations').catch(() => ({ data: { data: [] } })),
        api.get('/api/job-projects/filters/departments').catch(() => ({ data: { data: [] } })),
        api.get('/api/job-projects/filters/categories').catch(() => ({ data: { data: [] } })),
        api.get('/api/job-projects/filters/skills').catch(() => ({ data: { data: [] } })),
      ])
      setFilterSuggestions({
        jobTitles: titlesRes.data?.data || [],
        companies: companiesRes.data?.data || [],
        locations: locationsRes.data?.data || [],
        departments: depsRes.data?.data || [],
        categories: catsRes.data?.data || [],
        skills: skillsRes.data?.data || [],
      })
    } catch (err) {
      console.error('Failed to load filter suggestions:', err)
    }
  }, [])

  /* ── Fetch all jobs from API ── */
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await api.get('/api/job-projects', { params: { limit: 500 } })
      setJobs(data.map(fromApiRecord))
    } catch (err) {
      console.error('Failed to load jobs:', err)
      setError('Could not load jobs. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [])

  /* ── Fetch archived jobs from API ── */
  const fetchArchivedJobs = useCallback(async () => {
    try {
      setArchiveLoading(true)
      const { data } = await api.get('/api/job-projects/archived', { params: { limit: 500 } })
      setArchivedJobs(data.map(fromApiRecord))
    } catch (err) {
      console.error('Failed to load archived jobs:', err)
    } finally {
      setArchiveLoading(false)
    }
  }, [])

  useEffect(() => { fetchJobs(); fetchFilterSuggestions(); }, [fetchJobs, fetchFilterSuggestions])
  
  // Fetch archived jobs when switching to archive view
  useEffect(() => {
    if (showArchive) {
      fetchArchivedJobs()
    }
  }, [showArchive, fetchArchivedJobs])

  const handleClearFilters = () => {
    setFilters({
      title: '',
      location: '',
      company: '',
      status: '',
      priority: '',
      createdBy: '',
      assignees: '',
      skills: [],  // Reset to empty array for tag input
      category: '',
      reason: '',
      department: '',
      salaryMin: '',
      salaryMax: '',
      employmentType: '',
    })
  }

  // Count active filters (handle both string and array values)
  const activeFiltersCount = Object.values(filters).filter(v => {
    if (Array.isArray(v)) return v.length > 0
    return v !== ''
  }).length

  const handleSearch = () => {
    // Search functionality - triggers filter update
    console.log('Searching with filters:', filters)
  }

  const handleExport = async () => {
    try {
      // Build query params from current filters
      const params = new URLSearchParams()
      if (filters.title) params.append('title', filters.title)
      if (filters.location) params.append('location', filters.location)
      if (filters.company) params.append('company', filters.company)
      if (filters.status) params.append('status', filters.status)
      if (filters.category) params.append('category', filters.category)
      if (filters.department) params.append('department', filters.department)
      if (filters.employmentType) params.append('employment_type', filters.employmentType)

      const response = await api.get(`/api/job-projects/export/excel?${params.toString()}`, {
        responseType: 'blob'
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const timestamp = new Date().toISOString().slice(0, 10)
      link.setAttribute('download', `jobs_export_${timestamp}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Failed to export jobs. Please try again.')
    }
  }

  /* ── Open modal in different modes ── */
  const handleCreateJob = () => {
    setModalMode('create')
    setModalJob(null)
    setIsCreateModalOpen(true)
  }

  const handleEditJob = (job) => {
    setModalMode('edit')
    setModalJob(job)
    setIsCreateModalOpen(true)
  }

  const handleReviewJob = (job) => {
    setModalMode('review')
    setModalJob(job)
    setIsCreateModalOpen(true)
  }

  /* ── Save handler (create or edit) — persists to API ── */
  const handleSaveJob = async (payload, mode) => {
    try {
      const formData = new FormData()
      
      // Map frontend field names to API field names and append to FormData
      const fieldMapping = {
        title: 'job_title',
        description: 'job_description',
        comments: 'comments',
        qualification: 'required_qualification',
        positions: 'open_positions',
      }

      // Fields that are client-only and should never be sent to the API
      const skipKeys = new Set(['logoFile', 'logoPreview', 'removePhoto', '_draftId'])
      
      // Append all form fields
      for (const [key, value] of Object.entries(payload)) {
        if (skipKeys.has(key)) continue

        const apiKey = fieldMapping[key] || key

        if (apiKey === 'job_description' || apiKey === 'comments') {
          // Always send rich-text fields (even if empty) so the server clears them on edit
          formData.append(apiKey, String(value ?? ''))
        } else if (Array.isArray(value)) {
          // Arrays (location, skills): join with pipe separator to preserve commas in values
          if (value.length > 0) {
            formData.append(apiKey, value.join(' | '))
          }
        } else if (value !== null && value !== undefined && value !== '') {
          formData.append(apiKey, String(value))
        }
      }
      
      // Append photo file if it exists
      if (payload.logoFile && payload.logoFile instanceof File) {
        formData.append('photo', payload.logoFile)
      }
      
      // Append remove_photo flag if logo should be deleted
      if (payload.removePhoto) {
        formData.append('remove_photo', 'true')
      }
      
      // Do NOT manually set Content-Type — axios/browser sets
      // multipart/form-data with the correct boundary automatically.
      if (mode === 'create') {
        // If a draft was auto-saved, delete it first and wait before creating the final record
        if (payload._draftId) {
          try {
            await api.delete(`/api/job-projects/${payload._draftId}`)
          } catch (delErr) {
            console.warn('Draft cleanup failed (may already be gone):', delErr)
          }
        }
        // Check guard: only create if we haven't already created for this submit
        await api.post('/api/job-projects', formData)
      } else if (mode === 'edit' && modalJob) {
        await api.put(`/api/job-projects/${modalJob.id}`, formData)
      }
      await fetchJobs()                 // refresh list from DB
    } catch (err) {
      console.error('Save failed:', err)
      alert('Failed to save job. Please try again.')
    }
  }

  /* ── Publish / Unpost handler — toggles status via API ── */
  const updateJobInState = (updated) => {
    const mapped = fromApiRecord(updated)
    setJobs(prev => prev.map(existing => (existing.id === mapped.id ? { ...existing, ...mapped } : existing)))
  }

  const handlePublishJob = async (job) => {
    const isPosted = job.status === 'POSTED'
    console.log('[JOB_PROJECTS] Publish toggle clicked', { jobId: job.id, status: job.status })

    if (isPosted) {
      // Unpost
      const confirmed = window.confirm(
        `Unpost "${job.title || 'this job'}" from Public?\n\nThis will remove it from the public job portal.`,
      )
      if (!confirmed) return
      try {
        const { data } = await api.post(`/api/job-projects/${job.id}/unpost`)
        console.log('[JOB_PROJECTS] Unpost API success', { jobId: job.id })
        updateJobInState(data)
      } catch (err) {
        console.error('Unpost failed:', err)
        alert('Failed to unpost job.')
      }
    } else {
      // Post
      const confirmed = window.confirm(
        `Post "${job.title || 'this job'}" to Public?\n\nThis will make it visible on the public job portal.`,
      )
      if (!confirmed) return
      try {
        const { data } = await api.post(`/api/job-projects/${job.id}/post`)
        console.log('[JOB_PROJECTS] Post API success', { jobId: job.id })
        updateJobInState(data)
      } catch (err) {
        console.error('Post failed:', err)
        alert('Failed to post job.')
      }
    }
  }

  /* ── Archive handler (moves job to archive via API) ── */
  const handleArchiveJob = async (job) => {
    try {
      await api.post(`/api/job-projects/${job.id}/archive`)
      await fetchJobs()  // Refresh active jobs list
      // Close modal after archiving
      closeModal()
      // Show success message
      setTimeout(() => {
        alert('Job moved to archive successfully!')
      }, 100)
    } catch (err) {
      console.error('Archive failed:', err)
      alert('Failed to archive job.')
    }
  }

  /* ── Restore handler (restores job from archive via API) ── */
  const handleRestoreJob = async (job) => {
    try {
      await api.post(`/api/job-projects/${job.id}/restore`)
      // Refresh both lists
      await fetchArchivedJobs()
      await fetchJobs()
    } catch (err) {
      console.error('Restore failed:', err)
      alert('Failed to restore job. Please try again.')
    }
  }

  /* ── Delete forever handler (permanently deletes from DB) ── */
  const handleDeleteForever = async (job) => {
    const confirmed = window.confirm(`Permanently delete "${job.title || 'this job'}"?\n\nThis action cannot be undone.`)
    if (!confirmed) return
    try {
      await api.delete(`/api/job-projects/${job.id}/permanent-delete`)
      await fetchArchivedJobs()  // Refresh archived jobs list
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Failed to delete job. Please try again.')
    }
  }

  /* ── Multi-select state for bulk delete (Issue 2) ── */
  const [selectedJobs, setSelectedJobs] = useState([])
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)

  const handleSelectJob = (jobId) => {
    setSelectedJobs(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    )
  }

  const handleSelectAll = () => {
    if (selectedJobs.length === archivedJobs.length) {
      setSelectedJobs([])
    } else {
      setSelectedJobs(archivedJobs.map(job => job.id))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedJobs.length === 0) return
    
    const confirmed = window.confirm(
      `Permanently delete ${selectedJobs.length} job(s)?\n\nThis action cannot be undone.`
    )
    if (!confirmed) return
    
    try {
      setBulkDeleteLoading(true)
      await api.post('/api/job-projects/bulk-delete', { job_ids: selectedJobs })
      setSelectedJobs([])  // Clear selection
      await fetchArchivedJobs()  // Refresh archived jobs list
    } catch (err) {
      console.error('Bulk delete failed:', err)
      alert('Failed to delete selected jobs. Please try again.')
    } finally {
      setBulkDeleteLoading(false)
    }
  }

  // Clear selection when leaving archive view
  useEffect(() => {
    if (!showArchive) {
      setSelectedJobs([])
    }
  }, [showArchive])

  /* ── Duplicate job handler (creates copy via API) ── */
  const handleDuplicateJob = async (job) => {
    try {
      const { data } = await api.post(`/api/job-projects/${job.id}/duplicate`)
      // Refresh the jobs list to include the new duplicate
      await fetchJobs()
      // Convert the API response to frontend format
      const newJob = fromApiRecord(data)
      // Close the current modal first
      closeModal()
      // Small delay to ensure modal closes before reopening with the new job
      setTimeout(() => {
        setModalMode('edit')
        setModalJob(newJob)
        setIsCreateModalOpen(true)
      }, 150)
    } catch (err) {
      console.error('Duplicate failed:', err)
      console.error('Error details:', err.response?.data || err.message)
      alert('Failed to duplicate job. Please check the console for details.')
    }
  }

  /* ── Copy job handler (same as duplicate, triggered from card menu) ── */
  const handleCopyJob = async (job) => {
    await handleDuplicateJob(job)
  }

  /* ── Hold job handler (pauses the job) ── */
  const handleHoldJob = async (job) => {
    try {
      const { data } = await api.post(`/api/job-projects/${job.id}/hold`)
      updateJobInState(data)
    } catch (err) {
      console.error('Hold failed:', err)
      alert('Failed to hold job.')
    }
  }

  /* ── Unhold job handler (resumes the job) ── */
  const handleUnholdJob = async (job) => {
    try {
      const { data } = await api.post(`/api/job-projects/${job.id}/unhold`)
      updateJobInState(data)
    } catch (err) {
      console.error('Unhold failed:', err)
      alert('Failed to resume job.')
    }
  }

  /* ── Close job handler (closes and archives the job) ── */
  const handleCloseJob = async (job) => {
    const confirmed = window.confirm(
      `Close "${job.title || 'this job'}"?\n\nThis will mark the job as closed and move it to archive.`
    )
    if (!confirmed) return
    try {
      await api.post(`/api/job-projects/${job.id}/close`)
      await fetchJobs()  // Refresh to remove from active list
    } catch (err) {
      console.error('Close failed:', err)
      alert('Failed to close job.')
    }
  }

  /* ── Applied candidates handler (navigates to page) ── */
  const handleAppliedClick = (job) => {
    navigate(`/jobs/${job.id}/applied`)
  }

  const closeModal = () => {
    setIsCreateModalOpen(false)
    setModalJob(null)
  }

  /* ── Filter jobs ── */
  // Helper: safely convert a job field to lowercase string (handles arrays and non-strings)
  const toStr = (v) => (Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v)).toLowerCase()

  const filteredJobs = jobs.filter((job) => {
    const f = filters
    if (f.title && !toStr(job.title).includes(f.title.toLowerCase())) return false
    if (f.location && !toStr(job.location).includes(f.location.toLowerCase())) return false
    if (f.company && !toStr(job.company).includes(f.company.toLowerCase())) return false
    if (f.status && !toStr(job.status).includes(f.status.toLowerCase())) return false
    if (f.priority && !toStr(job.priority).includes(f.priority.toLowerCase())) return false
    if (f.department && !toStr(job.department).includes(f.department.toLowerCase())) return false
    // Skills is now an array - check if job has ALL selected skills
    if (f.skills && f.skills.length > 0) {
      const jobSkills = toStr(job.skills)
      for (const skill of f.skills) {
        if (!jobSkills.includes(String(skill).toLowerCase())) return false
      }
    }
    if (f.category && !toStr(job.category).includes(f.category.toLowerCase())) return false
    if (f.employmentType && !toStr(job.employment_type).includes(f.employmentType.toLowerCase())) return false
    // Salary filter — range overlap: exclude only if job's range is completely outside user's range
    if (f.salaryMin) {
      const jobEnd = job.salary_end ? Number(job.salary_end) : (job.salary_start ? Number(job.salary_start) : null)
      if (jobEnd !== null && jobEnd < Number(f.salaryMin)) return false
    }
    if (f.salaryMax) {
      const jobStart = job.salary_start ? Number(job.salary_start) : (job.salary_end ? Number(job.salary_end) : null)
      if (jobStart !== null && jobStart > Number(f.salaryMax)) return false
    }
    return true
  })

  return (
    <div className="h-screen overflow-hidden">
      {/* Left Sidebar - Filters (Feature 6 & 7: Floating labels + Fixed buttons) */}
      <aside className="fixed left-0 top-14 w-72 bg-white border-r border-neutral-200 h-[calc(100vh-3.5rem)] z-20 shadow-sm flex flex-col">
        {/* Scrollable Filter Content — no scrollbar needed with compact layout */}
        <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* Filter Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-brand-500" />
              <h2 className="text-sm font-semibold text-neutral-900">Filters</h2>
              {activeFiltersCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-brand-100 text-brand-700 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </div>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-medium text-neutral-500 hover:text-brand-600 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Filter Fields — compact spacing so all fit without scrolling */}
          <div className="space-y-2">
            {/* Title */}
            <FloatingInput
              label="Job Title"
              name="title"
              value={filters.title}
              onChange={(e) => setFilters({ ...filters, title: e.target.value })}
              list="title-suggestions"
              suggestions={filterSuggestions.jobTitles}
            />

            {/* Company */}
            <FloatingInput
              label="Company"
              name="company"
              value={filters.company}
              onChange={(e) => setFilters({ ...filters, company: e.target.value })}
              list="company-suggestions"
              suggestions={filterSuggestions.companies}
            />

            {/* Location */}
            <FloatingInput
              label="Location"
              name="location"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              list="location-suggestions"
              suggestions={filterSuggestions.locations}
            />

            {/* Status + Priority — 2-column row to save vertical space */}
            <div className="flex gap-2">
              <div className="fi-wrapper flex-1">
                <select
                  className="fi-select"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  style={{ paddingTop: filters.status ? '16px' : '10px', paddingBottom: filters.status ? '4px' : '10px' }}
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="POSTED">Posted</option>
                  <option value="HOLD">On Hold</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div className="fi-wrapper flex-1">
                <select
                  className="fi-select"
                  value={filters.priority}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                  style={{ paddingTop: filters.priority ? '16px' : '10px', paddingBottom: filters.priority ? '4px' : '10px' }}
                >
                  <option value="">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Normal">Normal</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Department */}
            <FloatingInput
              label="Department"
              name="department"
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              list="department-suggestions"
              suggestions={filterSuggestions.departments}
            />

            {/* Category */}
            <FloatingInput
              label="Category"
              name="category"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              list="category-suggestions"
              suggestions={filterSuggestions.categories}
            />

            {/* Skills - Tag Input with suggestions */}
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wide">
                Skills
              </label>
              <TagInput
                tags={filters.skills}
                onChange={(skills) => setFilters({ ...filters, skills })}
                suggestions={filterSuggestions.skills}
                placeholder="Type skill name (e.g., JavaScript...)"
              />
            </div>

            {/* Employment Type */}
            <div className="fi-wrapper">
              <select
                className="fi-select"
                value={filters.employmentType}
                onChange={(e) => setFilters({ ...filters, employmentType: e.target.value })}
                style={{ paddingTop: filters.employmentType ? '16px' : '10px', paddingBottom: filters.employmentType ? '4px' : '10px' }}
              >
                <option value="">All Employment Types</option>
                <option value="Full Time">Full Time</option>
                <option value="Part Time">Part Time</option>
                <option value="Contract">Contract</option>
                <option value="Temporary">Temporary</option>
                <option value="Remote Work">Remote Work</option>
              </select>
            </div>

            {/* Salary Range */}
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wide">
                Salary Range ($/year)
              </label>
              <div className="fi-range-wrapper">
                <FloatingInput
                  label="Min"
                  name="salaryMin"
                  type="number"
                  value={filters.salaryMin}
                  onChange={(e) => setFilters({ ...filters, salaryMin: e.target.value })}
                />
                <span className="fi-range-divider">—</span>
                <FloatingInput
                  label="Max"
                  name="salaryMax"
                  type="number"
                  value={filters.salaryMax}
                  onChange={(e) => setFilters({ ...filters, salaryMax: e.target.value })}
                />
              </div>
            </div>

            {/* Created By + Assignees — 2-column row to save vertical space */}
            <div className="flex gap-2">
              <div className="flex-1">
                <FloatingInput
                  label="Created By"
                  name="createdBy"
                  value={filters.createdBy}
                  onChange={(e) => setFilters({ ...filters, createdBy: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <FloatingInput
                  label="Assignees"
                  name="assignees"
                  value={filters.assignees}
                  onChange={(e) => setFilters({ ...filters, assignees: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Export Buttons — side-by-side to save vertical space */}
        <div className="flex-shrink-0 p-3 border-t border-neutral-200 bg-white">
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm rounded-lg shadow-sm transition-all duration-200"
              onClick={handleSearch}
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              Search
            </button>
            
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-neutral-50 text-neutral-700 font-medium text-sm rounded-lg border border-neutral-300 transition-all duration-200"
              onClick={handleExport}
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-72 h-screen overflow-y-auto overflow-x-hidden bg-neutral-50">
        {/* Header */}
        <div className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Back to Jobs button - only show in archive view */}
              {showArchive && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
                  onClick={() => setShowArchive(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Jobs
                </button>
              )}
              <h1 className="text-lg font-semibold text-neutral-900">
                {showArchive ? 'Archived Jobs' : 'Job Projects'}
              </h1>
              
              {/* Find Job Link - Candidate Portal */}
              {!showArchive && (
                <>
                  <span className="text-neutral-300">|</span>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors"
                    onClick={() => navigate('/find-jobs')}
                  >
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    Find Job
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Archive button - only show when NOT in archive view */}
              {!showArchive && (
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 font-medium text-sm rounded-lg transition-all duration-200 bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border border-neutral-300"
                  onClick={() => setShowArchive(true)}
                >
                  <ArchiveBoxIcon className="w-4 h-4" />
                  Archive
                  {archivedJobs.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                      {archivedJobs.length}
                    </span>
                  )}
                </button>
              )}
              {!showArchive && (
                <button
                  type="button"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm rounded-lg shadow-sm transition-all duration-200"
                  onClick={handleCreateJob}
                >
                  + Create new job
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="px-6 py-4">
          {/* Archive Panel */}
          {showArchive && (
            <div className="space-y-3">
              {/* Loading state for archived jobs */}
              {archiveLoading && (
                <div className="bg-white rounded-lg border border-neutral-200 min-h-[400px] flex items-center justify-center">
                  <p className="text-sm text-neutral-500">Loading archived jobs…</p>
                </div>
              )}
              
              {/* Empty state */}
              {!archiveLoading && archivedJobs.length === 0 && (
                <div className="bg-white rounded-lg border border-neutral-200 min-h-[400px] flex flex-col items-center justify-center">
                  <ArchiveBoxIcon className="w-12 h-12 text-neutral-300 mb-4" />
                  <h3 className="text-lg font-medium text-neutral-700 mb-2">Archive is empty</h3>
                  <p className="text-sm text-neutral-500">Deleted jobs will appear here for recovery.</p>
                </div>
              )}
              
              {/* Archived jobs list */}
              {!archiveLoading && archivedJobs.length > 0 && (
                <>
                  {/* Header with count and bulk actions */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-neutral-500">
                      {archivedJobs.length} archived job{archivedJobs.length !== 1 ? 's' : ''}
                    </p>
                    
                    {/* Bulk actions toolbar - shows when items selected */}
                    {selectedJobs.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-600">
                          {selectedJobs.length} selected
                        </span>
                        <button
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
                          onClick={handleBulkDelete}
                          disabled={bulkDeleteLoading}
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          {bulkDeleteLoading ? 'Deleting...' : 'Delete Selected'}
                        </button>
                        <button
                          className="text-xs text-neutral-500 hover:text-neutral-700"
                          onClick={() => setSelectedJobs([])}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Select all checkbox */}
                  <div className="flex items-center gap-2 mb-3 px-4 py-2 bg-neutral-100 rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedJobs.length === archivedJobs.length && archivedJobs.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-brand-500 border-neutral-300 rounded focus:ring-brand-500"
                    />
                    <span className="text-sm text-neutral-600">
                      Select All
                    </span>
                  </div>
                  
                  {archivedJobs.map((job) => (
                    <div 
                      key={job.id} 
                      className={`flex items-center gap-4 p-4 bg-white border rounded-lg hover:border-neutral-300 transition-all ${
                        selectedJobs.includes(job.id) ? 'border-brand-500 bg-brand-50' : 'border-neutral-200'
                      }`}
                    >
                      {/* Checkbox for multi-select */}
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(job.id)}
                        onChange={() => handleSelectJob(job.id)}
                        className="w-4 h-4 text-brand-500 border-neutral-300 rounded focus:ring-brand-500"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-neutral-900 truncate">{job.title || 'Untitled Job'}</h3>
                        <p className="text-xs text-neutral-500">{job.company || '—'}</p>
                        <p className="text-xs text-neutral-400 mt-1">
                          Archived: {job.archived_at ? new Date(job.archived_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
                          onClick={() => handleRestoreJob(job)}
                        >
                          <ArrowPathIcon className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        <button
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
                          onClick={() => handleDeleteForever(job)}
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          Delete Forever
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Normal Jobs Content */}
          {!showArchive && (
            <>
              {/* Loading state */}
              {loading && (
                <div className="bg-white rounded-lg border border-neutral-200 min-h-[500px] flex items-center justify-center">
                  <p className="text-sm text-neutral-500">Loading jobs…</p>
                </div>
              )}

              {/* Error state */}
              {!loading && error && (
                <div className="bg-white rounded-lg border border-red-200 min-h-[200px] flex flex-col items-center justify-center gap-3 p-8">
                  <p className="text-sm text-red-600">{error}</p>
                  <button
                    type="button"
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm rounded-lg"
                    onClick={fetchJobs}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && filteredJobs.length === 0 && (
                <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden min-h-[500px] flex flex-col items-center justify-center">
                  <div className="text-center py-16">
                    <h3 className="text-lg font-medium text-neutral-700 mb-2">
                      {jobs.length === 0 ? "You don't have any job yet" : 'No jobs match your filters'}
                    </h3>
                    <p className="text-sm text-neutral-500 mb-6">
                      {jobs.length === 0
                        ? 'To start using jobs click Create new job'
                        : 'Try adjusting your filter criteria'}
                    </p>
                    {jobs.length === 0 && (
                      <button
                        type="button"
                        className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm rounded-lg shadow-sm transition-all duration-200"
                        onClick={handleCreateJob}
                      >
                        Create new job
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Jobs list */}
              {!loading && !error && filteredJobs.length > 0 && (
                <div className="space-y-2">
                  {/* Jobs header bar */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-neutral-500">
                      {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
                      {filteredJobs.length !== jobs.length && ` (of ${jobs.length} total)`}
                    </p>
                  </div>

                  {/* Job cards */}
                  {filteredJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onEdit={handleEditJob}
                      onReview={handleReviewJob}
                      onPublish={handlePublishJob}
                      onCopy={handleCopyJob}
                      onHold={handleHoldJob}
                      onUnhold={handleUnholdJob}
                      onClose={handleCloseJob}
                      onApplied={handleAppliedClick}
                      onAnalyze={(job) => setAnalyzeJobTarget(job)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Create / Edit / Review Job Modal */}
      <CreateJobModal
        isOpen={isCreateModalOpen}
        onClose={closeModal}
        mode={modalMode}
        initialData={modalJob}
        onSave={handleSaveJob}
        onDelete={handleArchiveJob}
        onDuplicate={handleDuplicateJob}
      />

      {/* ATS Match Panel */}
      {analyzeJobTarget && (
        <JobMatchPanel
          jobId={analyzeJobTarget.id}
          jobTitle={analyzeJobTarget.job_title}
          onClose={() => setAnalyzeJobTarget(null)}
        />
      )}
    </div>
  )
}
