import { useCallback, useEffect, useMemo, useState } from 'react'

import SidebarFilters from '../components/SidebarFilters.jsx'
import SearchBar from '../components/SearchBar.jsx'
import ResultsList from '../components/ResultsList.jsx'
import Pagination from '../components/Pagination.jsx'
import ProfileModal from '../components/ProfileModal.jsx'

import { fetchCandidateById, fetchCandidates } from '../services/api.js'
import { onCandidateSelected } from '../chatbot/candidateEvents.js'

export default function SearchPeople() {
  const [filters, setFilters] = useState({
    name: '',
    location: '',
    jobTitle: '',
    years: '',
    keywords: '',
  })

  const [searchText, setSearchText] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [lastPageSize, setLastPageSize] = useState(0)

  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const [modalOpen, setModalOpen] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [activeCandidate, setActiveCandidate] = useState(null)
  const [activeTab, setActiveTab] = useState('skills')
  
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  const offset = useMemo(() => (page - 1) * rowsPerPage, [page, rowsPerPage])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchCandidates({ 
        q: searchText || undefined,
        name: filters.name || undefined,
        location: filters.location || undefined,
        jobTitle: filters.jobTitle || undefined,
        limit: rowsPerPage, 
        offset 
      })
      const nextRows = Array.isArray(data) ? data : Array.isArray(data?.candidates) ? data.candidates : []
      setRows(nextRows)
      setLastPageSize(nextRows.length)
      setSelectedIds(new Set())
    } catch (e) {
      console.error('Load candidates error:', e)
      // Don't show error during sync operations, just log it
      if (!syncing) {
        setError('Failed to load candidates. Check that the FastAPI backend is running.')
      }
      setRows([])
      setLastPageSize(0)
    } finally {
      setLoading(false)
    }
  }, [searchText, filters.name, filters.location, filters.jobTitle, rowsPerPage, offset, syncing])

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
      
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
      const response = await fetch(`${apiBaseUrl}/gdrive/sync-and-parse`, {
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
    return rows.findIndex((r) => r.id === activeId)
  }, [rows, activeId])

  const hasPrev = activeIndex > 0
  const hasNext = activeIndex >= 0 && activeIndex < rows.length - 1

  const goPrev = () => {
    if (!hasPrev) return
    openProfile(rows[activeIndex - 1].id)
  }

  const goNext = () => {
    if (!hasNext) return
    openProfile(rows[activeIndex + 1].id)
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-10">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <SidebarFilters filters={filters} onChange={setFilters} onSearch={onSearch} onSave={onSave} />

        <main className="space-y-4">
          {/* SearchBar removed */}

          {error ? (
            <div className="card px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
          ) : null}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm font-semibold text-slate-900">Search People</div>
              <button
                onClick={syncFromGoogleDrive}
                disabled={syncing}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <svg className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncing ? 'Syncing...' : 'Sync from Google Drive'}
              </button>
              {syncMessage && (
                <span className="text-xs text-green-600 font-medium">{syncMessage}</span>
              )}
            </div>
            <div className="text-sm text-slate-600">
              {loading ? 'Loading…' : `${rows.length} results`}
            </div>
          </div>

          <ResultsList rows={rows} selectedIds={selectedIds} onToggle={onToggle} onOpen={openProfile} />

          <Pagination
            page={page}
            rowsPerPage={rowsPerPage}
            onRowsPerPage={(n) => {
              setRowsPerPage(n)
              setPage(1)
            }}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            isPrevDisabled={page === 1}
            isNextDisabled={lastPageSize < rowsPerPage}
          />
        </main>
      </div>

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
    </div>
  )
}
