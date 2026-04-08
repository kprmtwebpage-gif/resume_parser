import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ArrowLeftIcon,
  BookmarkIcon,
  ClockIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid'
import { api } from '../services/api'
import PublicJobCard from '../components/PublicJobCard'
import JobDetailsModal from '../components/JobDetailsModal'
import ApplyJobModal from '../components/ApplyJobModal'
import SavedJobsPanel from '../components/SavedJobsPanel'
import SearchHistoryPanel from '../components/SearchHistoryPanel'
import './FindJobs.css'

export default function FindJobs() {
  const navigate = useNavigate()
  
  // Map stored experience values to filter categories
  const mapExperienceToCategory = (exp) => {
    if (!exp) return null
    const lower = exp.toLowerCase().trim()
    if (lower === 'fresher' || lower === 'intern' || lower === 'entry level') return 'Under 1 Year'
    // Extract numeric value
    const match = lower.match(/(\d+)/)
    if (!match) return null
    const years = parseInt(match[1], 10)
    if (years < 1) return 'Under 1 Year'
    if (years <= 2) return '1 - 2 Year'
    if (years <= 6) return '2 - 6 Year'
    if (years <= 10) return '6 - 10 Year'
    if (years <= 15) return '10 - 15 Year'
    return '15 - 20 Year'
  }
  
  // Jobs state
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Pagination state
  const [visibleCount, setVisibleCount] = useState(10)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [salaryRange, setSalaryRange] = useState({ min: '', max: '' })
  
  // View toggle state
  const [activeTab, setActiveTab] = useState('search') // 'search' | 'history'
  
  // Filters state
  const [filters, setFilters] = useState({
    jobType: [], // Full Time, Freelance, Part Time
    experience: [] // Under 1 Year, 1-2 Year, 2-6 Year, Over 6 Years
  })
  
  // Job type counts
  const [jobTypeCounts, setJobTypeCounts] = useState({
    'Full Time': 0,
    'Freelance': 0,
    'Part Time': 0,
    'Contract': 0,
    'Temporary': 0
  })
  
  // Experience counts  
  const [experienceCounts, setExperienceCounts] = useState({
    'Under 1 Year': 0,
    '1 - 2 Year': 0,
    '2 - 6 Year': 0,
    '6 - 10 Year': 0,
    '10 - 15 Year': 0,
    '15 - 20 Year': 0
  })
  
  // Modal state
  const [selectedJob, setSelectedJob] = useState(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  
  // Saved jobs state
  const [savedJobs, setSavedJobs] = useState([])
  const [showSavedJobs, setShowSavedJobs] = useState(false)
  
  // Search history state
  const [searchHistory, setSearchHistory] = useState([])
  const [showSearchHistory, setShowSearchHistory] = useState(false)

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await api.get('/api/job-projects/public', { params: { limit: 500 } })
      console.log('[PUBLIC_JOBS] Public API returned jobs', { count: data?.length || 0 })
      setJobs(data || [])
      calculateCounts(data || [])
    } catch (err) {
      console.error('Failed to load jobs:', err)
      setError('Could not load jobs. Please try again later.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Calculate filter counts
  const calculateCounts = (jobsData) => {
    const typeCounts = {
      'Full Time': 0,
      'Freelance': 0,
      'Part Time': 0,
      'Contract': 0,
      'Temporary': 0
    }
    
    jobsData.forEach(job => {
      const type = job.employment_type
      if (type && typeCounts[type] !== undefined) {
        typeCounts[type]++
      }
    })
    
    setJobTypeCounts(typeCounts)
    
    // Calculate real experience counts from job data
    const expCounts = {
      'Under 1 Year': 0,
      '1 - 2 Year': 0,
      '2 - 6 Year': 0,
      '6 - 10 Year': 0,
      '10 - 15 Year': 0,
      '15 - 20 Year': 0
    }
    jobsData.forEach(job => {
      const category = mapExperienceToCategory(job.experience)
      if (category && expCounts[category] !== undefined) {
        expCounts[category]++
      }
    })
    setExperienceCounts(expCounts)
  }

  // Fetch saved jobs
  const fetchSavedJobs = useCallback(async () => {
    try {
      const { data } = await api.get('/saved-jobs')
      setSavedJobs(data || [])
    } catch (err) {
      // If endpoint doesn't exist, use local storage
      const localSaved = JSON.parse(localStorage.getItem('savedJobs') || '[]')
      setSavedJobs(localSaved)
    }
  }, [])

  // Fetch search history
  const fetchSearchHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/search-history')
      setSearchHistory(data || [])
    } catch (err) {
      // If endpoint doesn't exist, use local storage
      const localHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]')
      setSearchHistory(localHistory)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
    fetchSavedJobs()
    fetchSearchHistory()
  }, [fetchJobs, fetchSavedJobs, fetchSearchHistory])

  // Handle search
  const handleSearch = async () => {
    // Save to search history
    if (searchQuery || locationQuery) {
      const historyEntry = {
        id: Date.now(),
        query: searchQuery,
        location: locationQuery,
        created_at: new Date().toISOString()
      }
      
      try {
        await api.post('/search-history', historyEntry)
      } catch (err) {
        // Save locally if API fails
        const localHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]')
        localHistory.unshift(historyEntry)
        localStorage.setItem('searchHistory', JSON.stringify(localHistory.slice(0, 50)))
        setSearchHistory(prev => [historyEntry, ...prev].slice(0, 50))
      }
    }
    
    // Filter jobs based on search
    fetchJobs()
  }

  // Handle reset
  const handleReset = () => {
    setSearchQuery('')
    setLocationQuery('')
    setSalaryRange({ min: '', max: '' })
    setFilters({ jobType: [], experience: [] })
    setVisibleCount(10)
    fetchJobs()
  }

  // Handle job type filter toggle
  const toggleJobTypeFilter = (type) => {
    setFilters(prev => ({
      ...prev,
      jobType: prev.jobType.includes(type)
        ? prev.jobType.filter(t => t !== type)
        : [...prev.jobType, type]
    }))
  }

  // Handle experience filter toggle
  const toggleExperienceFilter = (exp) => {
    setFilters(prev => ({
      ...prev,
      experience: prev.experience.includes(exp)
        ? prev.experience.filter(e => e !== exp)
        : [...prev.experience, exp]
    }))
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters({ jobType: [], experience: [] })
  }

  // Toggle save job
  const toggleSaveJob = async (job) => {
    const isAlreadySaved = savedJobs.some(saved => saved.job_id === job.id || saved.id === job.id)
    
    if (isAlreadySaved) {
      // Remove from saved jobs
      try {
        await api.delete(`/saved-jobs/${job.id}`)
      } catch (err) {
        // Handle locally
      }
      setSavedJobs(prev => prev.filter(saved => saved.job_id !== job.id && saved.id !== job.id))
      
      // Update local storage
      const localSaved = JSON.parse(localStorage.getItem('savedJobs') || '[]')
      const updatedLocal = localSaved.filter(s => s.job_id !== job.id && s.id !== job.id)
      localStorage.setItem('savedJobs', JSON.stringify(updatedLocal))
    } else {
      // Add to saved jobs
      const savedEntry = {
        id: Date.now(),
        job_id: job.id,
        job: job,
        saved_at: new Date().toISOString()
      }
      
      try {
        await api.post('/saved-jobs', { job_id: job.id })
      } catch (err) {
        // Save locally if API fails
      }
      setSavedJobs(prev => [...prev, savedEntry])
      
      // Update local storage
      const localSaved = JSON.parse(localStorage.getItem('savedJobs') || '[]')
      localSaved.push(savedEntry)
      localStorage.setItem('savedJobs', JSON.stringify(localSaved))
    }
  }

  // Check if job is saved
  const isJobSaved = (jobId) => {
    return savedJobs.some(saved => saved.job_id === jobId || saved.id === jobId)
  }

  // Open job details modal
  const openJobDetails = (job) => {
    setSelectedJob(job)
    setIsDetailsModalOpen(true)
  }

  // Open apply modal
  const openApplyModal = (job) => {
    setSelectedJob(job)
    setIsApplyModalOpen(true)
  }

  // Filter jobs based on search and filters
  const filteredJobs = jobs.filter(job => {
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesTitle = job.job_title?.toLowerCase().includes(query)
      const matchesCompany = job.company?.toLowerCase().includes(query)
      const matchesExperience = job.experience?.toLowerCase().includes(query)
      if (!matchesTitle && !matchesCompany && !matchesExperience) return false
    }
    
    // Location filter
    if (locationQuery) {
      const location = locationQuery.toLowerCase()
      if (!job.location?.toLowerCase().includes(location)) return false
    }
    
    // Salary filter — range overlap: exclude only if job's range is completely outside user's range
    if (salaryRange.min) {
      const minSalary = parseFloat(salaryRange.min)
      // Exclude if job's max salary is below user's min (no overlap)
      const jobEnd = job.salary_end ? parseFloat(job.salary_end) : (job.salary_start ? parseFloat(job.salary_start) : null)
      if (jobEnd !== null && jobEnd < minSalary) return false
    }
    
    if (salaryRange.max) {
      const maxSalary = parseFloat(salaryRange.max)
      // Exclude if job's min salary is above user's max (no overlap)
      const jobStart = job.salary_start ? parseFloat(job.salary_start) : (job.salary_end ? parseFloat(job.salary_end) : null)
      if (jobStart !== null && jobStart > maxSalary) return false
    }
    
    // Job type filter
    if (filters.jobType.length > 0) {
      if (!filters.jobType.includes(job.employment_type)) return false
    }
    
    // Experience filter
    if (filters.experience.length > 0) {
      const category = mapExperienceToCategory(job.experience)
      if (!category || !filters.experience.includes(category)) return false
    }
    
    return true
  })

  return (
    <div className="find-jobs-page min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="find-jobs-header bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Left: Back button and title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(sessionStorage.getItem('userLoginAuth') === 'true' ? '/jobs' : '/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm font-medium">{sessionStorage.getItem('userLoginAuth') === 'true' ? 'Back to Jobs' : 'Back to Home'}</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <MagnifyingGlassIcon className="w-5 h-5 text-blue-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Find Job</h1>
            </div>
          </div>
          
          {/* Right: Controls */}
          <div className="flex items-center gap-4">
            {/* Search / History Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('search')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'search'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Search
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'history'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                History
              </button>
            </div>
            
            {/* Saved Jobs Button */}
            <button
              onClick={() => setShowSavedJobs(true)}
              className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors"
              title="Saved Jobs"
            >
              <BookmarkIcon className="w-6 h-6" />
              {savedJobs.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                  {savedJobs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Let's find your dream job</h2>
            <p className="text-sm text-gray-500">{filteredJobs.length}+ available job vacancies here</p>
          </div>
          
          {/* Search Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Job Title / Company Input */}
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg">
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Job Title, Company, or Anything"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
                  />
                </div>
              </div>
              
              {/* Location Input */}
              <div className="flex-1 min-w-[150px]">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg">
                  <MapPinIcon className="w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Location"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
                  />
                </div>
              </div>
              
              {/* Salary Range */}
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg">
                  <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    placeholder="Min Salary"
                    value={salaryRange.min}
                    onChange={(e) => setSalaryRange(prev => ({ ...prev, min: e.target.value }))}
                    className="w-24 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={salaryRange.max}
                    onChange={(e) => setSalaryRange(prev => ({ ...prev, max: e.target.value }))}
                    className="w-24 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
                  />
                </div>
              </div>
              
              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={handleSearch}
                  className="flex items-center gap-2 px-6 py-3 text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" />
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex gap-8">
          {/* Job Cards Grid */}
          <div className="flex-1">
            {activeTab === 'search' ? (
              <>
                {/* Loading State */}
                {loading && (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                )}
                
                {/* Error State */}
                {!loading && error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                    <p className="text-red-600">{error}</p>
                    <button
                      onClick={fetchJobs}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      Try Again
                    </button>
                  </div>
                )}
                
                {/* Empty State */}
                {!loading && !error && filteredJobs.length === 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No jobs found</h3>
                    <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
                
                {/* Job Cards List — single column with pagination */}
                {!loading && !error && filteredJobs.length > 0 && (
                  <div>
                    <div className="space-y-0">
                      {filteredJobs.slice(0, visibleCount).map(job => (
                        <PublicJobCard
                          key={job.id}
                          job={job}
                          isSaved={isJobSaved(job.id)}
                          onSave={() => toggleSaveJob(job)}
                          onClick={() => openJobDetails(job)}
                          onApply={() => openApplyModal(job)}
                        />
                      ))}
                    </div>
                    {visibleCount < filteredJobs.length && (
                      <div className="flex justify-center mt-6">
                        <button
                          onClick={() => setVisibleCount(prev => prev + 10)}
                          className="px-8 py-3 text-sm font-semibold text-blue-600 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          Load More ({filteredJobs.length - visibleCount} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* History Tab */
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Search History</h3>
                {searchHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No search history yet</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {searchHistory.map((entry, index) => (
                      <li
                        key={entry.id || index}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                        onClick={() => {
                          setSearchQuery(entry.query || '')
                          setLocationQuery(entry.location || '')
                          setActiveTab('search')
                        }}
                      >
                        <ClockIcon className="w-5 h-5 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">{entry.query || 'All Jobs'}</p>
                          {entry.location && (
                            <p className="text-xs text-gray-500">{entry.location}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          
          {/* Right Sidebar - Filters */}
          <aside className="w-72 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto">
              {/* Filters Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Job Filter</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-500 hover:text-blue-600"
                >
                  Clear all
                </button>
              </div>
              
              {/* Job Type Filter */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Job Type</h4>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, jobType: [] }))}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-2">
                  {Object.entries(jobTypeCounts).map(([type, count]) => (
                    <label
                      key={type}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={filters.jobType.includes(type)}
                          onChange={() => toggleJobTypeFilter(type)}
                          className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{type}</span>
                      </div>
                      <span className="text-xs text-gray-500">{count} Jobs</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Experience Filter */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Experience</h4>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, experience: [] }))}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-2">
                  {Object.entries(experienceCounts).map(([exp, count]) => (
                    <label
                      key={exp}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={filters.experience.includes(exp)}
                          onChange={() => toggleExperienceFilter(exp)}
                          className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{exp}</span>
                      </div>
                      <span className="text-xs text-gray-500">{count} Jobs</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Modals */}
      {isDetailsModalOpen && selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          isSaved={isJobSaved(selectedJob.id)}
          onClose={() => {
            setIsDetailsModalOpen(false)
            setSelectedJob(null)
          }}
          onSave={() => toggleSaveJob(selectedJob)}
          onApply={() => {
            setIsDetailsModalOpen(false)
            openApplyModal(selectedJob)
          }}
        />
      )}
      
      {isApplyModalOpen && selectedJob && (
        <ApplyJobModal
          job={selectedJob}
          onClose={() => {
            setIsApplyModalOpen(false)
            setSelectedJob(null)
          }}
        />
      )}
      
      {/* Saved Jobs Panel */}
      {showSavedJobs && (
        <SavedJobsPanel
          savedJobs={savedJobs}
          onClose={() => setShowSavedJobs(false)}
          onRemove={(job) => toggleSaveJob(job)}
          onViewJob={(job) => {
            setShowSavedJobs(false)
            openJobDetails(job.job || job)
          }}
        />
      )}
    </div>
  )
}
