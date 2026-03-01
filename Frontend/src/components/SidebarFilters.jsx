import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../contexts/ThemeContext'
import { apiUrl } from '../config.js'

// Highlight matching substring in suggestion text
function HighlightMatch({ text, query, isDark }) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className={`rounded-sm px-0.5 ${isDark ? 'bg-yellow-500/30 text-yellow-200' : 'bg-yellow-200 text-yellow-900'}`}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// Debounce helper
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

// Collapsible Section Component
function CollapsibleSection({ title, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const { colors, isDark } = useTheme()
  
  return (
    <div className="border-b last:border-b-0 transition-all duration-300" style={{ borderColor: colors.border }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-1 text-left transition-all duration-300 rounded-md"
        style={{ color: isDark ? '#e2e8f0' : '#1f2937' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <span className="text-sm font-semibold">{title}</span>
        {isOpen ? (
          <ChevronUpIcon className="w-4 h-4" style={{ color: isDark ? '#94a3b8' : '#6b7280' }} />
        ) : (
          <ChevronDownIcon className="w-4 h-4" style={{ color: isDark ? '#94a3b8' : '#6b7280' }} />
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

// Job Title Multi-Select Component with Tags
function JobTitleMultiSelect({ selectedTitles, onChange, onValidSelect }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [jobTitles, setJobTitles] = useState([])
  const [loading, setLoading] = useState(false)
  const [allJobTitles, setAllJobTitles] = useState([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const { colors, isDark } = useTheme()
  
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Fetch all job titles on mount AND refresh every 60 seconds
  // so newly-parsed candidates' titles appear without a page reload.
  useEffect(() => {
    const fetchAllTitles = async () => {
      setLoading(true)
      try {
        const response = await fetch(apiUrl('/job-titles/all'))
        if (response.ok) {
          const data = await response.json()
          setAllJobTitles(data.results || [])
          setJobTitles((data.results || []).slice(0, 50))
        }
      } catch (err) {
        console.error('Failed to fetch job titles:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAllTitles()
    const interval = setInterval(fetchAllTitles, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Filter job titles based on search
  useEffect(() => {
    const query = (debouncedSearch || '').toLowerCase().trim()
    let filtered = allJobTitles.filter(title => !selectedTitles.includes(title))

    if (query) {
      filtered = filtered.filter(title => title.toLowerCase().includes(query))
      // Sort: prefix matches first, then by length, then alpha
      filtered.sort((a, b) => {
        const aL = a.toLowerCase(), bL = b.toLowerCase()
        const aP = aL.startsWith(query), bP = bL.startsWith(query)
        if (aP && !bP) return -1
        if (!aP && bP) return 1
        if (a.length !== b.length) return a.length - b.length
        return aL.localeCompare(bL)
      })
    }

    setJobTitles(filtered.slice(0, 50))
    setActiveIdx(-1)
  }, [debouncedSearch, allJobTitles, selectedTitles])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (title) => {
    if (!selectedTitles.includes(title)) {
      const newTitles = [...selectedTitles, title]
      onChange(newTitles)
      onValidSelect?.(newTitles)
    }
    setSearchQuery('')
    setActiveIdx(-1)
  }

  const handleRemoveTag = (indexToRemove) => {
    const newTitles = selectedTitles.filter((_, index) => index !== indexToRemove)
    onChange(newTitles)
    onValidSelect?.(newTitles)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(prev => Math.min(prev + 1, jobTitles.length - 1))
      // Scroll active item into view
      setTimeout(() => {
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
      }, 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(prev => Math.max(prev - 1, 0))
      setTimeout(() => {
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
      }, 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && activeIdx < jobTitles.length) {
        handleSelect(jobTitles[activeIdx])
      } else if (searchQuery.trim()) {
        // Only allow selection of job titles that exist in the DB
        const match = allJobTitles.find(t => t.toLowerCase() === searchQuery.trim().toLowerCase())
        if (match && !selectedTitles.includes(match)) {
          handleSelect(match)
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    } else if (e.key === 'Backspace' && !searchQuery && selectedTitles.length > 0) {
      const newTitles = selectedTitles.slice(0, -1)
      onChange(newTitles)
      onValidSelect?.(newTitles)
    }
  }

  const inputBg = isDark ? colors.card : '#ffffff'
  const inputBorder = isDark ? colors.border : '#d1d5db'
  const inputText = isDark ? '#e2e8f0' : '#111827'
  const placeholderColor = isDark ? '#64748b' : '#9ca3af'
  const dropBg = isDark ? colors.card : '#ffffff'
  const dropBorder = isDark ? colors.border : '#e5e7eb'
  const tagBg = isDark ? 'rgba(59,130,246,0.15)' : undefined
  const tagText = isDark ? '#93c5fd' : undefined
  const tagBorder = isDark ? 'rgba(59,130,246,0.3)' : undefined

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 100)
        }}
        className={`w-full rounded-lg border px-3 py-2 text-sm cursor-text transition-all min-h-[42px] ${
          isOpen ? 'ring-2 ring-brand-100' : ''
        }`}
        style={{
          backgroundColor: inputBg,
          borderColor: isOpen ? '#6366f1' : inputBorder,
        }}
      >
        <div className="flex flex-wrap gap-1.5 items-center">
          {selectedTitles.map((title, index) => (
            <span
              key={index}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border ${
                isDark ? '' : 'bg-brand-50 text-brand-700 border-brand-200'
              }`}
              style={isDark ? { backgroundColor: tagBg, color: tagText, borderColor: tagBorder } : undefined}
            >
              {title}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemoveTag(index) }}
                className={`rounded p-0.5 transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-brand-100'}`}
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            className="flex-1 min-w-[120px] outline-none bg-transparent"
            style={{ color: inputText }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedTitles.length === 0 ? "Type or select job title" : ""}
          />
        </div>
      </div>
      
      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg shadow-lg overflow-hidden border"
          style={{ backgroundColor: dropBg, borderColor: dropBorder }}
          onWheel={(e) => e.stopPropagation()}
        >
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto overscroll-contain"
            onWheel={(e) => {
              const target = e.currentTarget
              const { scrollTop, scrollHeight, clientHeight } = target
              if ((scrollTop === 0 && e.deltaY < 0) || (scrollTop + clientHeight >= scrollHeight && e.deltaY > 0)) {
                e.preventDefault()
              }
              e.stopPropagation()
            }}
          >
            {loading ? (
              <li className="px-3 py-8 text-center text-sm" style={{ color: placeholderColor }}>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  Loading...
                </div>
              </li>
            ) : jobTitles.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm" style={{ color: placeholderColor }}>
                {searchQuery.trim() ? 'No matching job titles found' : 'No more job titles available'}
              </li>
            ) : (
              jobTitles.map((title, idx) => (
                <li
                  key={idx}
                  data-active={idx === activeIdx}
                  onClick={() => handleSelect(title)}
                  className="px-3 py-2.5 text-sm cursor-pointer transition-colors"
                  style={{
                    color: idx === activeIdx
                      ? (isDark ? '#ffffff' : '#1e3a5f')
                      : (isDark ? '#cbd5e1' : '#374151'),
                    backgroundColor: idx === activeIdx
                      ? (isDark ? 'rgba(99,102,241,0.2)' : '#eef2ff')
                      : 'transparent',
                  }}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <HighlightMatch text={title} query={searchQuery} isDark={isDark} />
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      <p className="mt-1 text-xs" style={{ color: isDark ? '#475569' : '#9ca3af' }}>
        Type to search available job titles
      </p>
    </div>
  )
}

// Experience Range Dropdown
function RangeDropdown({ value, onChange, max = 50, placeholder }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const { colors, isDark } = useTheme()

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const options = Array.from({ length: max + 1 }, (_, i) => i)
  const inputBg = isDark ? colors.card : '#ffffff'
  const inputBorder = isDark ? colors.border : '#d1d5db'

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all ${
          isOpen ? 'ring-2 ring-brand-100' : ''
        }`}
        style={{
          backgroundColor: inputBg,
          borderColor: isOpen ? '#6366f1' : inputBorder,
        }}
      >
        <span style={{ color: value !== null && value !== undefined ? (isDark ? '#e2e8f0' : '#111827') : (isDark ? '#64748b' : '#9ca3af') }}>
          {value !== null && value !== undefined ? value : placeholder}
        </span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: isDark ? '#64748b' : '#9ca3af' }} />
      </div>
      
      {isOpen && (
        <ul
          className="absolute z-50 mt-1 w-full rounded-lg shadow-lg max-h-48 overflow-y-auto overscroll-contain border"
          style={{ backgroundColor: isDark ? colors.card : '#ffffff', borderColor: isDark ? colors.border : '#e5e7eb' }}
          onWheel={(e) => {
            const target = e.currentTarget
            const { scrollTop, scrollHeight, clientHeight } = target
            if ((scrollTop === 0 && e.deltaY < 0) || (scrollTop + clientHeight >= scrollHeight && e.deltaY > 0)) {
              e.preventDefault()
            }
            e.stopPropagation()
          }}
        >
          {options.map((num) => (
            <li
              key={num}
              onClick={() => { onChange(num); setIsOpen(false) }}
              className="px-3 py-2 text-sm cursor-pointer transition-colors"
              style={{
                color: value === num
                  ? (isDark ? '#93c5fd' : '#4338ca')
                  : (isDark ? '#cbd5e1' : '#374151'),
                backgroundColor: value === num
                  ? (isDark ? 'rgba(59,130,246,0.15)' : '#eef2ff')
                  : 'transparent',
                fontWeight: value === num ? 500 : 400,
              }}
              onMouseEnter={(e) => { if (value !== num) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}
              onMouseLeave={(e) => { if (value !== num) e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              {num}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Selected Filter Tag
function FilterTag({ label, onRemove }) {
  const { isDark } = useTheme()
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md"
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
        color: isDark ? '#cbd5e1' : '#374151',
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className={`rounded p-0.5 ${isDark ? 'hover:bg-white/10' : 'hover:bg-neutral-200'}`}
      >
        <XMarkIcon className="w-3 h-3" />
      </button>
    </span>
  )
}

export default function SidebarFilters({ filters, onChange, onSearch, onSave, validationError, setValidationError, uniqueProfiles, setUniqueProfiles, totalCount, filteredCount, allRows }) {
  const { colors, isDark } = useTheme()

  // Saved searches state (localStorage)
  const STORAGE_KEY = 'kprmt_saved_searches'
  const [savedSearches, setSavedSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
  })
  const [showSavedPanel, setShowSavedPanel] = useState(false)
  const savedPanelRef = useRef(null)

  // Close saved panel on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (savedPanelRef.current && !savedPanelRef.current.contains(e.target)) {
        setShowSavedPanel(false)
      }
    }
    if (showSavedPanel) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSavedPanel])

  const handleSaveSearch = () => {
    const name = prompt('Enter a name for this search:')
    if (!name || !name.trim()) return
    const entry = { name: name.trim(), filters: { ...filters }, uniqueProfiles, savedAt: new Date().toISOString() }
    const updated = [...savedSearches, entry]
    setSavedSearches(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const handleLoadSearch = (entry) => {
    onChange(entry.filters)
    if (entry.uniqueProfiles !== undefined) setUniqueProfiles(entry.uniqueProfiles)
    setShowSavedPanel(false)
    // Trigger search after loading
    setTimeout(() => onSearch(), 100)
  }

  const handleDeleteSavedSearch = (index, e) => {
    e.stopPropagation()
    const updated = savedSearches.filter((_, i) => i !== index)
    setSavedSearches(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const [experienceFrom, setExperienceFrom] = useState(filters.experienceFrom ?? null)
  const [experienceTo, setExperienceTo] = useState(filters.experienceTo ?? null)
  const [keywordTags, setKeywordTags] = useState(() => {
    // Parse existing keywords string into array
    if (!filters.keywords) return []
    return filters.keywords.split(',').map(k => k.trim()).filter(Boolean)
  })
  const [keywordInput, setKeywordInput] = useState('')
  
  // Profile Name multi-select state
  const [nameTags, setNameTags] = useState(() => {
    if (!filters.name) return []
    return filters.name.split(',').map(n => n.trim()).filter(Boolean)
  })
  const [nameInput, setNameInput] = useState('')
  const [showNameSuggestions, setShowNameSuggestions] = useState(false)
  const [nameDropdownPosition, setNameDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const nameInputRef = useRef(null)
  const nameContainerRef = useRef(null)
  const nameSuggestionsRef = useRef(null)
  
  // Profile Location multi-select state
  const [locationTags, setLocationTags] = useState(() => {
    if (!filters.location) return []
    return filters.location.split(',').map(l => l.trim()).filter(Boolean)
  })
  const [locationInput, setLocationInput] = useState('')
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [locationDropdownPosition, setLocationDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const locationInputRef = useRef(null)
  const locationContainerRef = useRef(null)
  const locationSuggestionsRef = useRef(null)
  
  // Job Title Tags state
  const [jobTitleTags, setJobTitleTags] = useState(() => {
    // Parse existing jobTitle string into array
    if (!filters.jobTitle) return []
    return filters.jobTitle.split(',').map(t => t.trim()).filter(Boolean)
  })
  
  // Keyword suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const keywordInputRef = useRef(null)
  const keywordContainerRef = useRef(null)
  const suggestionsRef = useRef(null)
  
  // Convert name/location tags to strings for debouncing
  const namesString = nameTags.join(', ')
  const locationsString = locationTags.join(', ')
  const debouncedName = useDebounce(namesString, 300)
  const debouncedLocation = useDebounce(locationsString, 300)
  // Convert keyword tags array to comma-separated string for backend
  const keywordsString = keywordTags.join(', ')
  const debouncedKeywords = useDebounce(keywordsString, 300)

  // Sync debounced values to parent filters
  useEffect(() => {
    onChange(prev => ({ ...prev, name: debouncedName }))
  }, [debouncedName])

  useEffect(() => {
    onChange(prev => ({ ...prev, location: debouncedLocation }))
  }, [debouncedLocation])

  useEffect(() => {
    onChange(prev => ({ ...prev, keywords: debouncedKeywords }))
  }, [debouncedKeywords])

  // Convert job title tags array to comma-separated string for backend
  const jobTitlesString = jobTitleTags.join(', ')
  const debouncedJobTitles = useDebounce(jobTitlesString, 300)

  // Sync job title tags to parent filters
  useEffect(() => {
    onChange(prev => ({ ...prev, jobTitle: debouncedJobTitles }))
  }, [debouncedJobTitles])

  // Sync jobTitleTags when filters.jobTitle changes externally (e.g., from clear filters)
  useEffect(() => {
    if (!filters.jobTitle) {
      setJobTitleTags([])
    } else {
      const tags = filters.jobTitle.split(',').map(t => t.trim()).filter(Boolean)
      // Only update if different to avoid infinite loop
      if (tags.join(',') !== jobTitleTags.join(',')) {
        setJobTitleTags(tags)
      }
    }
  }, [filters.jobTitle])

  // Sync keywordTags when filters.keywords changes externally (e.g., from clear filters)
  useEffect(() => {
    if (!filters.keywords) {
      setKeywordTags([])
    } else {
      const tags = filters.keywords.split(',').map(k => k.trim()).filter(Boolean)
      // Only update if different to avoid infinite loop
      if (tags.join(',') !== keywordTags.join(',')) {
        setKeywordTags(tags)
      }
    }
  }, [filters.keywords])

  // Sync nameTags when filters.name changes externally (e.g., from clear filters)
  useEffect(() => {
    if (!filters.name) {
      setNameTags([])
    } else {
      const tags = filters.name.split(',').map(n => n.trim()).filter(Boolean)
      if (tags.join(',') !== nameTags.join(',')) {
        setNameTags(tags)
      }
    }
  }, [filters.name])

  // Sync locationTags when filters.location changes externally (e.g., from clear filters)
  useEffect(() => {
    if (!filters.location) {
      setLocationTags([])
    } else {
      const tags = filters.location.split(',').map(l => l.trim()).filter(Boolean)
      if (tags.join(',') !== locationTags.join(',')) {
        setLocationTags(tags)
      }
    }
  }, [filters.location])

  // Update experience filters in parent
  useEffect(() => {
    onChange(prev => ({
      ...prev,
      experienceFrom,
      experienceTo,
    }))
  }, [experienceFrom, experienceTo])

  // Count active filters
  const activeFilters = [
    nameTags.length > 0,
    locationTags.length > 0,
    jobTitleTags.length > 0,
    experienceFrom !== null || experienceTo !== null,
    keywordTags.length > 0,
    uniqueProfiles,
  ].filter(Boolean).length

  // Fetch all skills from DB for suggestions (instead of just from loaded rows)
  const [dbSkills, setDbSkills] = useState([])
  useEffect(() => {
    fetch(apiUrl('/skills/all'))
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.results) setDbSkills(data.results) })
      .catch(() => {})
  }, [])
  const availableSkills = dbSkills.length > 0 ? dbSkills : (() => {
    if (!allRows || allRows.length === 0) return []
    const skillsSet = new Set()
    allRows.forEach(candidate => {
      if (Array.isArray(candidate.skills)) {
        candidate.skills.forEach(skill => {
          if (skill && typeof skill === 'string') skillsSet.add(skill.trim())
        })
      }
    })
    return Array.from(skillsSet).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  })()

  // Extract unique names from loaded profiles for suggestions
  const availableNames = useMemo(() => {
    if (!allRows || allRows.length === 0) return []
    const namesSet = new Set()
    allRows.forEach(candidate => {
      // Try different name field combinations
      let fullName = ''
      if (candidate.name && typeof candidate.name === 'string') {
        fullName = candidate.name.trim()
      } else if (candidate.first_name || candidate.last_name) {
        fullName = [candidate.first_name, candidate.last_name].filter(Boolean).join(' ').trim()
      }
      if (fullName) namesSet.add(fullName)
    })
    return Array.from(namesSet).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  }, [allRows])

  // Fetch all locations from DB for suggestions (instead of just from loaded rows)
  const [dbLocations, setDbLocations] = useState([])
  useEffect(() => {
    fetch(apiUrl('/locations/all'))
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.results) setDbLocations(data.results) })
      .catch(() => {})
  }, [])
  const availableLocations = dbLocations.length > 0 ? dbLocations : (() => {
    if (!allRows || allRows.length === 0) return []
    const locationsSet = new Set()
    allRows.forEach(candidate => {
      if (candidate.location && typeof candidate.location === 'string') {
        const loc = candidate.location.trim()
        if (loc) locationsSet.add(loc)
      }
    })
    return Array.from(locationsSet).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  })()

  // Filter suggestions based on keyword input - show all when focused, prioritize prefix matches
  const filteredSuggestions = useMemo(() => {
    const query = (keywordInput || '').toLowerCase().trim()
    
    // Show available skills (excluding already selected) even without typing
    const matchingSkills = availableSkills.filter(skill => {
      if (keywordTags.includes(skill)) return false
      if (!query) return true
      return skill.toLowerCase().includes(query)
    })
    
    // Sort: prefix matches first, then by length (shorter = more relevant), then alphabetically
    const sorted = matchingSkills.sort((a, b) => {
      if (!query) return a.toLowerCase().localeCompare(b.toLowerCase())
      const aLower = a.toLowerCase()
      const bLower = b.toLowerCase()
      const aStartsWith = aLower.startsWith(query)
      const bStartsWith = bLower.startsWith(query)
      
      // Prefix matches come first
      if (aStartsWith && !bStartsWith) return -1
      if (!aStartsWith && bStartsWith) return 1
      
      // Among same type, shorter skills are more relevant
      if (a.length !== b.length) return a.length - b.length
      
      // Finally, sort alphabetically
      return aLower.localeCompare(bLower)
    })
    
    return sorted.slice(0, 20)
  }, [keywordInput, availableSkills, keywordTags])

  // Filter name suggestions based on input - prioritize prefix matches
  const filteredNameSuggestions = useMemo(() => {
    if (!nameInput.trim()) return []
    const query = nameInput.toLowerCase().trim()
    
    const matchingNames = availableNames.filter(name => 
      name.toLowerCase().includes(query) && !nameTags.includes(name)
    )
    
    const sorted = matchingNames.sort((a, b) => {
      const aLower = a.toLowerCase()
      const bLower = b.toLowerCase()
      const aStartsWith = aLower.startsWith(query)
      const bStartsWith = bLower.startsWith(query)
      
      if (aStartsWith && !bStartsWith) return -1
      if (!aStartsWith && bStartsWith) return 1
      if (a.length !== b.length) return a.length - b.length
      return aLower.localeCompare(bLower)
    })
    
    return sorted.slice(0, 10)
  }, [nameInput, availableNames, nameTags])

  // Filter location suggestions based on input - prioritize prefix matches
  const filteredLocationSuggestions = useMemo(() => {
    const query = (locationInput || '').toLowerCase().trim()
    
    // Show all available locations (excluding selected) when focused but no query typed
    const matchingLocations = availableLocations.filter(loc => {
      if (locationTags.includes(loc)) return false
      if (!query) return true
      return loc.toLowerCase().includes(query)
    })
    
    // Sort: prefix matches first, then by length, then alphabetically
    const sorted = matchingLocations.sort((a, b) => {
      if (!query) return a.toLowerCase().localeCompare(b.toLowerCase())
      const aLower = a.toLowerCase()
      const bLower = b.toLowerCase()
      const aStartsWith = aLower.startsWith(query)
      const bStartsWith = bLower.startsWith(query)
      
      if (aStartsWith && !bStartsWith) return -1
      if (!aStartsWith && bStartsWith) return 1
      if (a.length !== b.length) return a.length - b.length
      return aLower.localeCompare(bLower)
    })
    
    return sorted.slice(0, 20)
  }, [locationInput, availableLocations, locationTags])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Keywords suggestions
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          keywordContainerRef.current && !keywordContainerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
      // Name suggestions
      if (nameSuggestionsRef.current && !nameSuggestionsRef.current.contains(e.target) &&
          nameContainerRef.current && !nameContainerRef.current.contains(e.target)) {
        setShowNameSuggestions(false)
      }
      // Location suggestions
      if (locationSuggestionsRef.current && !locationSuggestionsRef.current.contains(e.target) &&
          locationContainerRef.current && !locationContainerRef.current.contains(e.target)) {
        setShowLocationSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Calculate dropdown position when showing suggestions
  useEffect(() => {
    if (showSuggestions && keywordContainerRef.current && filteredSuggestions.length > 0) {
      const rect = keywordContainerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
  }, [showSuggestions, filteredSuggestions.length])

  // Calculate name dropdown position
  useEffect(() => {
    if (showNameSuggestions && nameContainerRef.current && filteredNameSuggestions.length > 0) {
      const rect = nameContainerRef.current.getBoundingClientRect()
      setNameDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
  }, [showNameSuggestions, filteredNameSuggestions.length])

  // Calculate location dropdown position
  useEffect(() => {
    if (showLocationSuggestions && locationContainerRef.current && filteredLocationSuggestions.length > 0) {
      const rect = locationContainerRef.current.getBoundingClientRect()
      setLocationDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
  }, [showLocationSuggestions, filteredLocationSuggestions.length])

  const handleClearFilters = () => {
    setNameTags([])
    setNameInput('')
    setLocationTags([])
    setLocationInput('')
    setKeywordTags([])
    setKeywordInput('')
    setJobTitleTags([])
    setExperienceFrom(null)
    setExperienceTo(null)
    setUniqueProfiles(false)
    onChange({
      name: '',
      location: '',
      jobTitle: '',
      keywords: '',
      experienceFrom: null,
      experienceTo: null,
    })
    setValidationError?.('')
  }

  const handleSearch = () => {
    // Validation: If experience is selected but no job title
    if ((experienceFrom !== null || experienceTo !== null) && jobTitleTags.length === 0) {
      setValidationError?.('Please select Job Title to filter by experience.')
      return
    }
    setValidationError?.('')
    onSearch()
  }

  const handleJobTitleChange = (titles) => {
    setJobTitleTags(titles)
    // Clear validation error when job title is selected
    if (titles.length > 0) {
      setValidationError?.('')
    }
  }

  const formatExperienceDisplay = () => {
    if (experienceFrom === null && experienceTo === null) return null
    const from = experienceFrom ?? 0
    const to = experienceTo ?? 50
    return `${from} - ${to} yrs`
  }

  const handleAddKeyword = () => {
    const keyword = keywordInput.trim()
    if (keyword && !keywordTags.includes(keyword)) {
      setKeywordTags([...keywordTags, keyword])
      setKeywordInput('')
    }
  }

  const handleRemoveKeyword = (indexToRemove) => {
    setKeywordTags(keywordTags.filter((_, index) => index !== indexToRemove))
  }

  const handleKeywordKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddKeyword()
    } else if (e.key === 'Backspace' && !keywordInput && keywordTags.length > 0) {
      // Remove last tag if backspace is pressed with empty input
      setKeywordTags(keywordTags.slice(0, -1))
    }
  }

  // Name handlers
  const handleAddName = () => {
    const name = nameInput.trim()
    if (name && !nameTags.includes(name)) {
      setNameTags([...nameTags, name])
      setNameInput('')
    }
    setShowNameSuggestions(false)
  }

  const handleRemoveName = (indexToRemove) => {
    setNameTags(nameTags.filter((_, index) => index !== indexToRemove))
  }

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddName()
    } else if (e.key === 'Backspace' && !nameInput && nameTags.length > 0) {
      setNameTags(nameTags.slice(0, -1))
    }
  }

  // Location handlers
  const handleAddLocation = () => {
    const location = locationInput.trim()
    if (location && !locationTags.includes(location)) {
      setLocationTags([...locationTags, location])
      setLocationInput('')
    }
    setShowLocationSuggestions(false)
  }

  const handleRemoveLocation = (indexToRemove) => {
    setLocationTags(locationTags.filter((_, index) => index !== indexToRemove))
  }

  const handleLocationKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddLocation()
    } else if (e.key === 'Backspace' && !locationInput && locationTags.length > 0) {
      setLocationTags(locationTags.slice(0, -1))
    }
  }

  return (
    <aside 
      className="fixed left-0 top-16 w-64 h-[calc(100vh-4rem)] overflow-y-auto z-20 shadow-sm transition-all duration-300"
      style={{
        backgroundColor: colors.background,
        borderRight: `1px solid ${colors.border}`
      }}
    >
      <div className="p-4 flex flex-col min-h-full">
        {/* Header with Clear Filters */}
        {activeFilters > 0 && (
          <div className="mb-3 pb-3 border-b" style={{ borderColor: colors.border }}>
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex items-center gap-2 text-sm transition-colors"
              style={{ color: isDark ? '#94a3b8' : '#4b5563' }}
              onMouseEnter={(e) => e.currentTarget.style.color = isDark ? '#e2e8f0' : '#111827'}
              onMouseLeave={(e) => e.currentTarget.style.color = isDark ? '#94a3b8' : '#4b5563'}
            >
              <span className="font-medium">Clear filters</span>
              <XMarkIcon className="w-4 h-4" />
            </button>
            <p className="mt-1 text-xs" style={{ color: isDark ? '#64748b' : '#6b7280' }}>{activeFilters} filter{activeFilters !== 1 ? 's' : ''} applied</p>
          </div>
        )}

        {/* Section Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: isDark ? '#f1f5f9' : '#111827' }}>People Search</h2>
            <span className="text-xs whitespace-nowrap" style={{ color: isDark ? '#64748b' : '#6b7280' }}>
              <span className="font-semibold text-brand-600">{filteredCount || 0}</span> / <span className="font-semibold" style={{ color: isDark ? '#cbd5e1' : '#374151' }}>{totalCount || 0}</span>
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: isDark ? '#64748b' : '#6b7280' }}>Filter candidates</p>
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#fecaca'}` }}>
            <p className="text-xs font-medium" style={{ color: isDark ? '#fca5a5' : '#dc2626' }}>{validationError}</p>
          </div>
        )}

        {/* General Section */}
        <CollapsibleSection title="General" defaultOpen={true}>
          <div className="space-y-4 px-1">
            {/* Profile Name with Smart Suggestions */}
            <div className="relative">
              <label className="mb-1.5 block text-xs font-medium" style={{ color: isDark ? '#94a3b8' : '#4b5563' }}>
                Profile Name
              </label>
              <div 
                ref={nameContainerRef}
                className="w-full rounded-lg border px-3 py-2 text-sm transition-all focus-within:ring-2 focus-within:ring-brand-100 min-h-[42px]"
                style={{
                  backgroundColor: isDark ? colors.card : '#ffffff',
                  borderColor: isDark ? colors.border : '#d1d5db',
                }}
              >
                <div className="flex flex-wrap gap-1.5 items-center">
                  {/* Name Tags */}
                  {nameTags.map((name, index) => (
                    <span
                      key={index}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border ${
                        isDark ? '' : 'bg-brand-50 text-brand-700 border-brand-200'
                      }`}
                      style={isDark ? { backgroundColor: 'rgba(59,130,246,0.15)', color: '#93c5fd', borderColor: 'rgba(59,130,246,0.3)' } : undefined}
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => handleRemoveName(index)}
                        className={`rounded p-0.5 transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-brand-100'}`}
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {/* Input for adding new names */}
                  <input
                    ref={nameInputRef}
                    type="text"
                    className="flex-1 min-w-[120px] outline-none bg-transparent"
                    style={{ color: isDark ? '#e2e8f0' : '#111827' }}
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value)
                      setShowNameSuggestions(true)
                    }}
                    onFocus={() => setShowNameSuggestions(true)}
                    onKeyDown={handleNameKeyDown}
                    placeholder={nameTags.length === 0 ? "e.g., John Doe" : ""}
                  />
                </div>
              </div>
              
              {/* Smart Suggestions Dropdown - Fixed positioning */}
              {showNameSuggestions && filteredNameSuggestions.length > 0 && (
                <div 
                  ref={nameSuggestionsRef}
                  className="fixed z-[9999] rounded-lg shadow-xl overflow-hidden border"
                  style={{
                    top: nameDropdownPosition.top,
                    left: nameDropdownPosition.left,
                    width: nameDropdownPosition.width,
                    backgroundColor: isDark ? colors.card : '#ffffff',
                    borderColor: isDark ? colors.border : '#e5e7eb',
                  }}
                  onWheel={(e) => e.stopPropagation()}
                >
                  <ul 
                    className="max-h-48 overflow-y-auto overscroll-contain"
                    onWheel={(e) => {
                      const target = e.currentTarget
                      const { scrollTop, scrollHeight, clientHeight } = target
                      if ((scrollTop === 0 && e.deltaY < 0) || (scrollTop + clientHeight >= scrollHeight && e.deltaY > 0)) {
                        e.preventDefault()
                      }
                      e.stopPropagation()
                    }}
                  >
                    {filteredNameSuggestions.map((suggestion, idx) => (
                      <li
                        key={idx}
                        onClick={() => {
                          if (!nameTags.includes(suggestion)) {
                            setNameTags([...nameTags, suggestion])
                          }
                          setNameInput('')
                          setShowNameSuggestions(false)
                        }}
                        className="px-3 py-2 text-sm cursor-pointer transition-colors"
                        style={{ color: isDark ? '#cbd5e1' : '#374151' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <HighlightMatch text={suggestion} query={nameInput} isDark={isDark} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-1 text-xs" style={{ color: isDark ? '#475569' : '#9ca3af' }}>Press Enter to add names</p>
            </div>

            {/* Profile Location with Smart Suggestions */}
            <div className="relative">
              <label className="mb-1.5 block text-xs font-medium" style={{ color: isDark ? '#94a3b8' : '#4b5563' }}>
                Profile Location
              </label>
              <div 
                ref={locationContainerRef}
                className="w-full rounded-lg border px-3 py-2 text-sm transition-all focus-within:ring-2 focus-within:ring-brand-100 min-h-[42px]"
                style={{
                  backgroundColor: isDark ? colors.card : '#ffffff',
                  borderColor: isDark ? colors.border : '#d1d5db',
                }}
              >
                <div className="flex flex-wrap gap-1.5 items-center">
                  {/* Location Tags */}
                  {locationTags.map((location, index) => (
                    <span
                      key={index}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border ${
                        isDark ? '' : 'bg-brand-50 text-brand-700 border-brand-200'
                      }`}
                      style={isDark ? { backgroundColor: 'rgba(59,130,246,0.15)', color: '#93c5fd', borderColor: 'rgba(59,130,246,0.3)' } : undefined}
                    >
                      {location}
                      <button
                        type="button"
                        onClick={() => handleRemoveLocation(index)}
                        className={`rounded p-0.5 transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-brand-100'}`}
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {/* Input for adding new locations */}
                  <input
                    ref={locationInputRef}
                    type="text"
                    className="flex-1 min-w-[120px] outline-none bg-transparent"
                    style={{ color: isDark ? '#e2e8f0' : '#111827' }}
                    value={locationInput}
                    onChange={(e) => {
                      setLocationInput(e.target.value)
                      setShowLocationSuggestions(true)
                    }}
                    onFocus={() => setShowLocationSuggestions(true)}
                    onKeyDown={handleLocationKeyDown}
                    placeholder={locationTags.length === 0 ? "e.g., Austin, TX" : ""}
                  />
                </div>
              </div>
              
              {/* Smart Suggestions Dropdown - Fixed positioning */}
              {showLocationSuggestions && filteredLocationSuggestions.length > 0 && (
                <div 
                  ref={locationSuggestionsRef}
                  className="fixed z-[9999] rounded-lg shadow-xl overflow-hidden border"
                  style={{
                    top: locationDropdownPosition.top,
                    left: locationDropdownPosition.left,
                    width: locationDropdownPosition.width,
                    backgroundColor: isDark ? colors.card : '#ffffff',
                    borderColor: isDark ? colors.border : '#e5e7eb',
                  }}
                  onWheel={(e) => e.stopPropagation()}
                >
                  <ul 
                    className="max-h-48 overflow-y-auto overscroll-contain"
                    onWheel={(e) => {
                      const target = e.currentTarget
                      const { scrollTop, scrollHeight, clientHeight } = target
                      if ((scrollTop === 0 && e.deltaY < 0) || (scrollTop + clientHeight >= scrollHeight && e.deltaY > 0)) {
                        e.preventDefault()
                      }
                      e.stopPropagation()
                    }}
                  >
                    {filteredLocationSuggestions.map((suggestion, idx) => (
                      <li
                        key={idx}
                        onClick={() => {
                          if (!locationTags.includes(suggestion)) {
                            setLocationTags([...locationTags, suggestion])
                          }
                          setLocationInput('')
                          setShowLocationSuggestions(false)
                        }}
                        className="px-3 py-2 text-sm cursor-pointer transition-colors"
                        style={{ color: isDark ? '#cbd5e1' : '#374151' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <HighlightMatch text={suggestion} query={locationInput} isDark={isDark} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-1 text-xs" style={{ color: isDark ? '#475569' : '#9ca3af' }}>Press Enter to add locations</p>
            </div>

            {/* Job Title Multi-Select */}
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: isDark ? '#94a3b8' : '#4b5563' }}>
                Job Title
              </label>
              <JobTitleMultiSelect
                selectedTitles={jobTitleTags}
                onChange={handleJobTitleChange}
                onValidSelect={handleJobTitleChange}
              />
            </div>

            {/* Years of Experience */}
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: isDark ? '#94a3b8' : '#4b5563' }}>
                Years of Experience
              </label>
              
              {/* Selected Experience Display */}
              {formatExperienceDisplay() && (
                <div className="mb-2">
                  <FilterTag 
                    label={formatExperienceDisplay()} 
                    onRemove={() => {
                      setExperienceFrom(null)
                      setExperienceTo(null)
                    }} 
                  />
                </div>
              )}
              
              {/* Range Selectors */}
              <div className="flex items-center gap-2">
                <RangeDropdown
                  value={experienceFrom}
                  onChange={setExperienceFrom}
                  max={50}
                  placeholder="From"
                />
                <span className="text-sm" style={{ color: isDark ? '#64748b' : '#9ca3af' }}>-</span>
                <RangeDropdown
                  value={experienceTo}
                  onChange={setExperienceTo}
                  max={50}
                  placeholder="To"
                />
              </div>
              <p className="mt-1 text-xs" style={{ color: isDark ? '#475569' : '#9ca3af' }}>Requires a job title to be selected</p>
            </div>

            {/* Keywords (Skills) with Smart Suggestions */}
            <div className="relative">
              <label className="mb-1.5 block text-xs font-medium" style={{ color: isDark ? '#94a3b8' : '#4b5563' }}>
                Keywords
              </label>
              <div 
                ref={keywordContainerRef}
                className="w-full rounded-lg border px-3 py-2 text-sm transition-all focus-within:ring-2 focus-within:ring-brand-100 min-h-[42px]"
                style={{
                  backgroundColor: isDark ? colors.card : '#ffffff',
                  borderColor: isDark ? colors.border : '#d1d5db',
                }}
              >
                <div className="flex flex-wrap gap-1.5 items-center">
                  {/* Keyword Tags */}
                  {keywordTags.map((keyword, index) => (
                    <span
                      key={index}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border ${
                        isDark ? '' : 'bg-brand-50 text-brand-700 border-brand-200'
                      }`}
                      style={isDark ? { backgroundColor: 'rgba(59,130,246,0.15)', color: '#93c5fd', borderColor: 'rgba(59,130,246,0.3)' } : undefined}
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(index)}
                        className={`rounded p-0.5 transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-brand-100'}`}
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {/* Input for adding new keywords */}
                  <input
                    ref={keywordInputRef}
                    type="text"
                    className="flex-1 min-w-[120px] outline-none bg-transparent"
                    style={{ color: isDark ? '#e2e8f0' : '#111827' }}
                    value={keywordInput}
                    onChange={(e) => {
                      setKeywordInput(e.target.value)
                      setShowSuggestions(true)
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeywordKeyDown}
                    placeholder={keywordTags.length === 0 ? "Type to search skills" : ""}
                  />
                </div>
              </div>
              
              {/* Smart Suggestions Dropdown - Fixed positioning to escape overflow container */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="fixed z-[9999] rounded-lg shadow-xl overflow-hidden border"
                  style={{
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                    width: dropdownPosition.width,
                    backgroundColor: isDark ? colors.card : '#ffffff',
                    borderColor: isDark ? colors.border : '#e5e7eb',
                  }}
                  onWheel={(e) => e.stopPropagation()}
                >
                  <ul 
                    className="max-h-48 overflow-y-auto overscroll-contain"
                    onWheel={(e) => {
                      const target = e.currentTarget
                      const { scrollTop, scrollHeight, clientHeight } = target
                      if ((scrollTop === 0 && e.deltaY < 0) || (scrollTop + clientHeight >= scrollHeight && e.deltaY > 0)) {
                        e.preventDefault()
                      }
                      e.stopPropagation()
                    }}
                  >
                    {filteredSuggestions.map((suggestion, idx) => (
                      <li
                        key={idx}
                        onClick={() => {
                          if (!keywordTags.includes(suggestion)) {
                            setKeywordTags([...keywordTags, suggestion])
                          }
                          setKeywordInput('')
                          setShowSuggestions(false)
                        }}
                        className="px-3 py-2 text-sm cursor-pointer transition-colors"
                        style={{ color: isDark ? '#cbd5e1' : '#374151' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <HighlightMatch text={suggestion} query={keywordInput} isDark={isDark} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-1 text-xs" style={{ color: isDark ? '#475569' : '#9ca3af' }}>Type to search skills, press Enter to add</p>
            </div>

            {/* Unique Profiles Checkbox */}
            <div className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                id="uniqueProfiles"
                checked={uniqueProfiles}
                onChange={(e) => setUniqueProfiles(e.target.checked)}
                className="w-4 h-4 text-brand-600 border-neutral-300 rounded focus:ring-2 focus:ring-brand-100 cursor-pointer"
                style={{ backgroundColor: isDark ? colors.card : '#ffffff' }}
              />
              <label htmlFor="uniqueProfiles" className="text-sm cursor-pointer select-none flex items-center gap-1" style={{ color: isDark ? '#cbd5e1' : '#374151' }}>
                Unique profiles
                <span className="text-xs" style={{ color: isDark ? '#64748b' : '#9ca3af' }} title="Will show profiles of people who are not on LinkedIn">
                  &#9432;
                </span>
              </label>
            </div>
          </div>
        </CollapsibleSection>

        {/* Search Button */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm rounded-lg shadow-sm transition-all duration-200"
            onClick={handleSearch}
          >
            Search
          </button>
          
          <button
            type="button"
            className="w-full py-2.5 px-4 font-medium text-sm rounded-lg border transition-all duration-200"
            style={{
              backgroundColor: isDark ? 'transparent' : '#ffffff',
              borderColor: isDark ? colors.border : '#d1d5db',
              color: isDark ? '#94a3b8' : '#4b5563',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'transparent' : '#ffffff' }}
            onClick={handleSaveSearch}
          >
            Save search
          </button>

          {/* Saved Searches Panel */}
          {savedSearches.length > 0 && (
            <div className="relative" ref={savedPanelRef}>
              <button
                type="button"
                className="w-full py-2 px-4 text-xs transition-colors flex items-center justify-center gap-1"
                style={{ color: isDark ? '#64748b' : '#6b7280' }}
                onMouseEnter={(e) => e.currentTarget.style.color = isDark ? '#94a3b8' : '#374151'}
                onMouseLeave={(e) => e.currentTarget.style.color = isDark ? '#64748b' : '#6b7280'}
                onClick={() => setShowSavedPanel(!showSavedPanel)}
              >
                <span>{savedSearches.length} saved search{savedSearches.length !== 1 ? 'es' : ''}</span>
                <ChevronDownIcon className={`w-3 h-3 transition-transform ${showSavedPanel ? 'rotate-180' : ''}`} />
              </button>
              {showSavedPanel && (
                <div
                  className="absolute bottom-full left-0 right-0 mb-1 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto border"
                  style={{
                    backgroundColor: isDark ? colors.card : '#ffffff',
                    borderColor: isDark ? colors.border : '#e5e7eb',
                  }}
                >
                  {savedSearches.map((entry, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleLoadSearch(entry)}
                      className="flex items-center justify-between px-3 py-2.5 cursor-pointer border-b last:border-b-0 group"
                      style={{ borderColor: isDark ? colors.border : '#f3f4f6' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: isDark ? '#e2e8f0' : '#374151' }}>{entry.name}</p>
                        <p className="text-xs truncate" style={{ color: isDark ? '#64748b' : '#9ca3af' }}>
                          {entry.filters.jobTitle ? `Job: ${entry.filters.jobTitle}` : ''}
                          {entry.filters.keywords ? ` | Skills: ${entry.filters.keywords}` : ''}
                          {entry.filters.location ? ` | Loc: ${entry.filters.location}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSavedSearch(idx, e)}
                        className="ml-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
                        style={{ color: '#ef4444' }}
                        title="Delete saved search"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
