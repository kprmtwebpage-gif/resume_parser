import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'

import SidebarFilters from '../components/SidebarFilters.jsx'
import SearchBar from '../components/SearchBar.jsx'
import ResultsList from '../components/ResultsList.jsx'
import Pagination from '../components/Pagination.jsx'
import ProfileModal from '../components/ProfileModal.jsx'
import EditProfileModal from '../components/EditProfileModal.jsx'

import { fetchCandidateById, fetchCandidates, updateCandidate, bulkDownloadResumes } from '../services/api.js'
import { apiUrl } from '../config.js'
import { onCandidateSelected } from '../chatbot/candidateEvents.js'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function SearchPeople() {
  const { colors, isDark } = useTheme()
  const { isAdmin } = useAuth()
  const [filters, setFilters] = useState({
    name: '',
    location: '',
    jobTitle: '',
    keywords: '',
    experienceFrom: null,
    experienceTo: null,
  })

  const [validationError, setValidationError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [allRows, setAllRows] = useState([])
  const [allProfilesCache, setAllProfilesCache] = useState([]) // Cache all profiles for suggestions
  const cachePopulatedRef = useRef(false) // Track if cache has been populated
  const [totalProfilesCount, setTotalProfilesCount] = useState(0) // Absolute total count
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uniqueProfiles, setUniqueProfiles] = useState(false)

  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  const [downloadedIds, setDownloadedIds] = useState(() => new Set())

  const [modalOpen, setModalOpen] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [activeCandidate, setActiveCandidate] = useState(null)
  const [activeTab, setActiveTab] = useState('skills')
  
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  // Edit profile modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editCandidate, setEditCandidate] = useState(null)
  const [saving, setSaving] = useState(false)

  // Multi-select export state
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [exporting, setExporting] = useState(false)

  // Client-side filtering based on search text, unique profiles, job titles, names, and locations (OR logic)
  const filteredRows = useMemo(() => {
    let rows = allRows

    // Filter by job titles using OR logic (frontend filtering)
    const jobTitleTags = filters.jobTitle ? filters.jobTitle.split(',').map(t => t.trim()).filter(Boolean) : []
    if (jobTitleTags.length > 0) {
      rows = rows.filter(candidate => {
        const candidateJobTitle = (candidate.job_title || candidate.jobTitle || '').toLowerCase()
        // OR logic: match if ANY selected job title is found in candidate's job title
        return jobTitleTags.some(tag => 
          candidateJobTitle.includes(tag.toLowerCase())
        )
      })
    }

    // Filter by names using OR logic (frontend filtering)
    const nameTags = filters.name ? filters.name.split(',').map(n => n.trim()).filter(Boolean) : []
    if (nameTags.length > 0) {
      rows = rows.filter(candidate => {
        // Build full name from various possible fields
        let candidateName = ''
        if (candidate.name && typeof candidate.name === 'string') {
          candidateName = candidate.name.toLowerCase()
        } else {
          candidateName = [candidate.first_name, candidate.last_name].filter(Boolean).join(' ').toLowerCase()
        }
        // OR logic: match if ANY selected name is found in candidate's name
        return nameTags.some(tag => 
          candidateName.includes(tag.toLowerCase())
        )
      })
    }

    // Filter by locations using OR logic (frontend filtering)
    // Uses word-boundary regex so "India" won't match "Indiana"
    const locationTags = filters.location ? filters.location.split(',').map(l => l.trim()).filter(Boolean) : []
    if (locationTags.length > 0) {
      rows = rows.filter(candidate => {
        const candidateLocation = (candidate.location || candidate.address || '')
        // OR logic: match if ANY selected location is found as a whole word
        return locationTags.some(tag => {
          const regex = new RegExp(`\\b${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
          return regex.test(candidateLocation)
        })
      })
    }

    // Filter by unique profiles (no LinkedIn)
    if (uniqueProfiles) {
      rows = rows.filter(candidate => {
        const hasLinkedIn = candidate.linkedin || candidate.linkedin_url
        return !hasLinkedIn || (typeof hasLinkedIn === 'string' && hasLinkedIn.trim() === '')
      })
    }

    // Filter by search text
    if (!searchText.trim()) {
      return rows
    }

    const query = searchText.toLowerCase().trim()

    return rows.filter(candidate => {
      const fullName = [candidate.first_name, candidate.last_name].filter(Boolean).join(' ').toLowerCase()
      const email = (candidate.email || '').toLowerCase()
      const phone = (candidate.phone || '').toLowerCase()
      const location = (candidate.location || candidate.address || '').toLowerCase()

      return (
        fullName.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        location.includes(query)
      )
    })
  }, [allRows, searchText, uniqueProfiles, filters.jobTitle, filters.name, filters.location])

  // Paginated rows from filtered results
  const paginatedRows = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage
    const endIndex = startIndex + rowsPerPage
    return filteredRows.slice(startIndex, endIndex)
  }, [filteredRows, page, rowsPerPage])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      // Only send backend-required filters (keywords, experience).
      // Name, location, jobTitle are filtered client-side in filteredRows useMemo.
      const data = await fetchCandidates({ 
        keywords: filters.keywords || undefined,
        experienceFrom: filters.experienceFrom ?? undefined,
        experienceTo: filters.experienceTo ?? undefined,
        limit: 10000,
        offset: 0 
      })
      const nextRows = Array.isArray(data) ? data : Array.isArray(data?.candidates) ? data.candidates : []
      setAllRows(nextRows)

      const grandTotal = data?.total ?? null

      const hasBackendFilters = filters.keywords || filters.experienceFrom !== null || 
                                 filters.experienceTo !== null
      if (!hasBackendFilters) {
        setAllProfilesCache(nextRows)
        setTotalProfilesCount(grandTotal ?? nextRows.length)
        cachePopulatedRef.current = true
      } else if (!cachePopulatedRef.current) {
        setAllProfilesCache(nextRows)
        cachePopulatedRef.current = true
      }
      if (grandTotal != null) {
        setTotalProfilesCount(grandTotal)
      }
    } catch (e) {
      console.error('Load candidates error:', e)
      if (!silent) {
        const status = e?.response?.status
        if (status === 401 || status === 403) {
          setError('Session expired. Please log in again.')
        } else if (status >= 500) {
          setError(`Server error (${status}). The backend is running but returned an error.`)
        } else if (e?.isNetworkError || e?.code === 'ERR_NETWORK') {
          setError('Cannot reach the server. Check your connection or try again in a moment.')
        } else {
          setError(`Failed to load candidates (${status || e?.message || 'unknown error'}). Check that the backend is running.`)
        }
      }
      if (!silent) setAllRows([])
    } finally {
      setLoading(false)
    }
  }, [filters.keywords, filters.experienceFrom, filters.experienceTo])

  useEffect(() => {
    load()
  }, [load])
  
  // Auto-refresh every 30 seconds to catch new resumes (silent - no spinner)
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      load(true)
    }, 30000)
    
    return () => clearInterval(autoRefreshInterval)
  }, [load])
  
  const syncFromGoogleDrive = async () => {
    setSyncing(true)
    setSyncMessage('Syncing...')
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout
      
      const response = await fetch(apiUrl('/gdrive/sync-and-parse'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        const msg = data.downloaded > 0 
          ? `✓ Synced ${data.downloaded} new resume(s) - parsing in background...`
          : `✓ No new resumes found`
        setSyncMessage(msg)
        // Reload candidates after a delay to allow background parsing
        if (data.downloaded > 0) {
          setTimeout(() => load(), 3000)
        }
      } else {
        setSyncMessage('⚠ Sync completed with warnings')
      }
    } catch (error) {
      console.error('Sync error:', error)
      if (error.name === 'AbortError') {
        setSyncMessage('✗ Sync timed out (took >2 min)')
      } else {
        setSyncMessage(`✗ Sync failed: ${error.message}`)
      }
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMessage(''), 5000)
    }
  }

  const onSearch = () => {
    setPage(1)
    setModalOpen(false)
    setActiveId(null)
    setActiveCandidate(null)
    setActiveTab('skills')
    setSelectedIds(new Set()) // Clear selections on new search
    // load() will run due to offset/q change
  }

  const onSave = () => {
    // No backend endpoint for saved searches yet; keep this UI-only.
    window.alert('Save search is not wired yet.')
  }



  const markAsDownloaded = useCallback((id) => {
    setDownloadedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // Selection handlers for multi-select export
  const handleToggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleToggleSelectAll = useCallback((ids) => {
    setSelectedIds(prev => {
      const allSelected = ids.every(id => prev.has(id))
      if (allSelected) {
        // Deselect all on this page
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      } else {
        // Select all on this page
        const next = new Set(prev)
        ids.forEach(id => next.add(id))
        return next
      }
    })
  }, [])

  const handleExportSelected = useCallback(async () => {
    if (selectedIds.size === 0) return
    setExporting(true)
    try {
      const blob = await bulkDownloadResumes([...selectedIds])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `resumes_${selectedIds.size}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
      if (e.response?.status === 429) {
        alert(e.response?.data?.detail || 'Daily download limit reached (10 resumes/day). Superusers have unlimited downloads.')
      } else {
        alert('Failed to export resumes. Please try again.')
      }
    } finally {
      setExporting(false)
    }
  }, [selectedIds])

  const handleExportAll = useCallback(async () => {
    const allIds = filteredRows.map(r => r.id)
    if (allIds.length === 0) return
    setExporting(true)
    try {
      const blob = await bulkDownloadResumes(allIds)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `resumes_all_${allIds.length}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export all failed:', e)
      if (e.response?.status === 429) {
        alert(e.response?.data?.detail || 'Daily download limit reached (10 resumes/day). Superusers have unlimited downloads.')
      } else {
        alert('Failed to export resumes. Please try again.')
      }
    } finally {
      setExporting(false)
    }
  }, [filteredRows])

  const openProfileRef = useRef(0)

  const openProfile = async (id, tab) => {
    const requestId = ++openProfileRef.current
    setModalOpen(true)
    setActiveId(id)
    setActiveCandidate(null)
    setActiveTab(tab || 'skills')

    try {
      const data = await fetchCandidateById(id)
      // Only update if this is still the latest request (prevents race condition)
      if (openProfileRef.current === requestId) {
        setActiveCandidate(data)
      }
    } catch (e) {
      if (openProfileRef.current === requestId) {
        setActiveCandidate({
          id,
          first_name: '',
          last_name: '',
          job_title: '',
          company: null,
          location: '',
          emails: [],
          phones: [],
          skills: [],
          experience: {},
          education: null,
          summary: null,
        })
      }
    }
  }

  // Open edit profile modal
  const openEditProfile = async (id) => {
    setEditModalOpen(true)
    setEditCandidate(null)

    try {
      const data = await fetchCandidateById(id)
      setEditCandidate(data)
    } catch (e) {
      console.error('Failed to fetch candidate for editing:', e)
      setEditModalOpen(false)
    }
  }

  // Handle save profile changes
  const handleSaveProfile = async (updatedData) => {
    if (!editCandidate?.id) return

    setSaving(true)
    try {
      await updateCandidate(editCandidate.id, updatedData)
      
      // Reload from DB to reflect all changes accurately
      await load()

      // Also update activeCandidate if it's the same record
      if (activeCandidate?.id === editCandidate.id) {
        setActiveCandidate(prev => ({ ...prev, ...updatedData }))
      }
      
      setEditModalOpen(false)
      setEditCandidate(null)
    } catch (e) {
      console.error('Failed to save candidate:', e)
      alert('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Listen for candidate selection from chatbot
  useEffect(() => {
    const unsubscribe = onCandidateSelected((event) => {
      const { id } = event.detail
      if (id) {
        openProfile(id)
      }
    })
    return unsubscribe
  }, [])

  const activeIndex = useMemo(() => {
    if (activeId == null) return -1
    return paginatedRows.findIndex((r) => r.id === activeId)
  }, [paginatedRows, activeId])

  const hasPrev = activeIndex > 0
  const hasNext = activeIndex >= 0 && activeIndex < paginatedRows.length - 1

  const goPrev = () => {
    if (!hasPrev) return
    openProfile(paginatedRows[activeIndex - 1].id)
  }

  const goNext = () => {
    if (!hasNext) return
    openProfile(paginatedRows[activeIndex + 1].id)
  }

  return (
    <div className="h-screen overflow-hidden">
      <SidebarFilters 
        filters={filters} 
        onChange={setFilters} 
        onSearch={onSearch} 
        onSave={onSave}
        validationError={validationError}
        setValidationError={setValidationError}
        uniqueProfiles={uniqueProfiles}
        setUniqueProfiles={setUniqueProfiles}
        totalCount={totalProfilesCount || allProfilesCache.length}
        filteredCount={filteredRows.length}
        allRows={allProfilesCache.length > 0 ? allProfilesCache : allRows}
      />

      <main 
        className="ml-64 h-screen overflow-y-auto overflow-x-hidden transition-colors duration-300"
        style={{ backgroundColor: colors.card }}
      >
          {error ? (
            <div 
              className="mx-6 mt-4 px-4 py-3 text-sm rounded-md flex items-center justify-between"
              style={{
                color: isDark ? '#fca5a5' : '#b91c1c',
                backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#fecaca'}`,
              }}
            >
              <span>{error}</span>
              <button
                onClick={() => { setError(''); load() }}
                className="ml-4 px-3 py-1 rounded text-xs font-medium bg-white border border-red-300 hover:bg-red-50 transition-colors"
                style={{ color: '#b91c1c' }}
              >
                Retry
              </button>
            </div>
          ) : null}

          {/* Top Search Section */}
          <div 
            className="border-b px-6 py-4 transition-colors duration-300"
            style={{
              backgroundColor: colors.background,
              borderColor: colors.border
            }}
          >
            <div className="flex items-center gap-6">
              <h1 
                className="text-lg font-semibold whitespace-nowrap transition-colors duration-300"
                style={{ color: colors.text }}
              >
                Search Profiles
              </h1>
              <div className="w-full max-w-md">
                <input
                  type="text"
                  placeholder="Enter email, phone number, full name or linkedin url"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value)
                    setPage(1) // Reset to first page on search
                  }}
                  className="w-full px-4 py-2.5 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
                  style={{
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.border}`,
                    color: colors.text
                  }}
                />
              </div>
              {syncMessage && (
                <span className="text-xs text-green-600 whitespace-nowrap">{syncMessage}</span>
              )}

              {/* Export Button - Admin only, visible only when items selected */}
              <div className="ml-auto flex items-center gap-2">
                {isAdmin && selectedIds.size > 0 && (
                <button
                  onClick={handleExportSelected}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Exporting…
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Export Selected ({selectedIds.size})
                    </>
                  )}
                </button>
                )}
              </div>

            </div>
          </div>

          {/* Results Section */}
          <div className="px-6 py-4">
            <div 
              className="rounded-lg transition-colors duration-300"
              style={{
                backgroundColor: colors.background,
                border: `1px solid ${colors.border}`
              }}
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <svg className="animate-spin h-8 w-8 mb-3" style={{ color: colors.primary || '#3b82f6' }} viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <p className="text-sm" style={{ color: colors.textSecondary || '#6b7280' }}>Loading candidates...</p>
                </div>
              ) : (
              <>
              <ResultsList 
            rows={paginatedRows} 
            downloadedIds={downloadedIds}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onOpen={openProfile}
            onDownload={markAsDownloaded}
            onEdit={openEditProfile}
          />

          <div 
            className="px-4 py-3 border-t transition-colors duration-300"
            style={{ borderColor: colors.border }}
          >
            <Pagination
              page={page}
              rowsPerPage={rowsPerPage}
              totalRows={filteredRows.length}
              onRowsPerPage={(n) => {
                setRowsPerPage(n)
                setPage(1)
              }}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
              isPrevDisabled={page === 1}
              isNextDisabled={page >= Math.ceil(filteredRows.length / rowsPerPage)}
            />
          </div>
              </>
              )}
        </div>
      </div>
      </main>

      <ProfileModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        candidate={activeCandidate}
        tab={activeTab}
        onTab={setActiveTab}
        onPrev={goPrev}
        onNext={goNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />

      <EditProfileModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditCandidate(null)
        }}
        candidate={editCandidate}
        onSave={handleSaveProfile}
        saving={saving}
      />
    </div>
  )
}
