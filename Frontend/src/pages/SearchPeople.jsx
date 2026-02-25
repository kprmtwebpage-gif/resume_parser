import { useCallback, useEffect, useMemo, useState } from 'react'

import SidebarFilters from '../components/SidebarFilters.jsx'
import SearchBar from '../components/SearchBar.jsx'
import ResultsList from '../components/ResultsList.jsx'
import Pagination from '../components/Pagination.jsx'
import ProfileModal from '../components/ProfileModal.jsx'
import EditProfileModal from '../components/EditProfileModal.jsx'

import { fetchCandidateById, fetchCandidates, updateCandidate } from '../services/api.js'
import { onCandidateSelected } from '../chatbot/candidateEvents.js'
import { apiUrl } from '../config'

export default function SearchPeople() {
  const [filters, setFilters] = useState({
    name: '',
    location: '',
    jobTitle: '',
    years: '',
    keywords: '',
  })

  const [searchText, setSearchText] = useState('')
  const [allRows, setAllRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  const [selectedIds, setSelectedIds] = useState(() => new Set())
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

  // Client-side filtering based on search text
  const filteredRows = useMemo(() => {
    if (!searchText.trim()) {
      return allRows
    }

    const query = searchText.toLowerCase().trim()

    return allRows.filter(candidate => {
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
  }, [allRows, searchText])

  // Paginated rows from filtered results
  const paginatedRows = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage
    const endIndex = startIndex + rowsPerPage
    return filteredRows.slice(startIndex, endIndex)
  }, [filteredRows, page, rowsPerPage])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchCandidates({ 
        name: filters.name || undefined,
        location: filters.location || undefined,
        jobTitle: filters.jobTitle || undefined,
        limit: 1000, // Load more records for client-side filtering
        offset: 0 
      })
      const nextRows = Array.isArray(data) ? data : Array.isArray(data?.candidates) ? data.candidates : []
      setAllRows(nextRows)
      setSelectedIds(new Set())
    } catch (e) {
      console.error('Load candidates error:', e)
      // Don't show error during sync operations, just log it
      if (!syncing) {
        setError('Failed to load candidates. Check that the FastAPI backend is running.')
      }
      setAllRows([])
    } finally {
      setLoading(false)
    }
  }, [filters.name, filters.location, filters.jobTitle, syncing])

  useEffect(() => {
    load()
  }, [load])
  
  // Auto-refresh every 30 seconds to catch new resumes
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      load()
    }, 30000) // 30 seconds
    
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
    // load() will run due to offset/q change
  }

  const onSave = () => {
    // No backend endpoint for saved searches yet; keep this UI-only.
    window.alert('Save search is not wired yet.')
  }

  const onToggle = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const markAsDownloaded = useCallback((id) => {
    setDownloadedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const openProfile = async (id) => {
    setModalOpen(true)
    setActiveId(id)
    setActiveCandidate(null)
    setActiveTab('skills')

    try {
      const data = await fetchCandidateById(id)
      setActiveCandidate(data)
    } catch (e) {
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
      <SidebarFilters filters={filters} onChange={setFilters} onSearch={onSearch} onSave={onSave} />

      <main className="ml-64 h-screen overflow-y-auto overflow-x-hidden bg-neutral-50">
          {error ? (
            <div className="mx-6 mt-4 px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">{error}</div>
          ) : null}

          {/* Top Search Section */}
          <div className="bg-white border-b border-neutral-200 px-6 py-4">
            <div className="flex items-center gap-6">
              <h1 className="text-lg font-semibold text-neutral-900 whitespace-nowrap">Search Profiles</h1>
              <div className="w-full max-w-md">
                <input
                  type="text"
                  placeholder="Enter email, phone number, full name or linkedin url"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value)
                    setPage(1) // Reset to first page on search
                  }}
                  className="w-full px-4 py-2.5 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {syncMessage && (
                <span className="text-xs text-green-600 whitespace-nowrap">{syncMessage}</span>
              )}
            </div>
          </div>

          {/* Results Section */}
          <div className="px-6 py-4">
            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
              <ResultsList 
            rows={paginatedRows} 
            selectedIds={selectedIds} 
            downloadedIds={downloadedIds}
            onToggle={onToggle} 
            onOpen={openProfile}
            onDownload={markAsDownloaded}
            onEdit={openEditProfile}
          />

          <div className="px-4 py-3 border-t border-neutral-200">
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
