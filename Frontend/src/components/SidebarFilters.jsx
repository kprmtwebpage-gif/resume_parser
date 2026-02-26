import { useState, useEffect, useRef } from 'react'
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

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

// Job Title Dropdown Component
function JobTitleDropdown({ value, onChange, onValidSelect }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [jobTitles, setJobTitles] = useState([])
  const [loading, setLoading] = useState(false)
  const [allJobTitles, setAllJobTitles] = useState([])
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)
  
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Fetch all job titles on mount for dropdown
  useEffect(() => {
    const fetchAllTitles = async () => {
      setLoading(true)
      try {
        const response = await fetch('/job-titles/all')
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
  }, [])

  // Filter job titles based on search
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setJobTitles(allJobTitles.slice(0, 50))
      return
    }
    
    const query = debouncedSearch.toLowerCase()
    const filtered = allJobTitles.filter(title => 
      title.toLowerCase().includes(query)
    ).slice(0, 50)
    setJobTitles(filtered)
  }, [debouncedSearch, allJobTitles])

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
    onChange(title)
    onValidSelect?.(title)
    setSearchQuery('')
    setIsOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
    onValidSelect?.('')
    setSearchQuery('')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) setTimeout(() => inputRef.current?.focus(), 100)
        }}
        className={`w-full flex items-center justify-between rounded-lg border bg-white px-3 py-2.5 text-sm cursor-pointer transition-all ${
          isOpen 
            ? 'border-brand-500 ring-2 ring-brand-100' 
            : 'border-neutral-300 hover:border-neutral-400'
        }`}
      >
        <span className={value ? 'text-neutral-900' : 'text-neutral-400'}>
          {value || 'Select job title'}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-neutral-100 rounded"
            >
              <XMarkIcon className="w-4 h-4 text-neutral-400" />
            </button>
          )}
          <ChevronDownIcon className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-neutral-100">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search job titles..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-100"
              />
            </div>
          </div>
          
          {/* Job titles list */}
          <ul className="max-h-60 overflow-y-auto">
            {loading ? (
              <li className="px-3 py-8 text-center text-sm text-neutral-500">
                Loading...
              </li>
            ) : jobTitles.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-neutral-500">
                No job titles found
              </li>
            ) : (
              jobTitles.map((title, idx) => (
                <li
                  key={idx}
                  onClick={() => handleSelect(title)}
                  className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    value === title 
                      ? 'bg-brand-50 text-brand-700 font-medium' 
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {title}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// Experience Range Dropdown
function RangeDropdown({ value, onChange, max = 50, placeholder }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

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

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm cursor-pointer transition-all ${
          isOpen 
            ? 'border-brand-500 ring-2 ring-brand-100' 
            : 'border-neutral-300 hover:border-neutral-400'
        }`}
      >
        <span className={value !== null && value !== undefined ? 'text-neutral-900' : 'text-neutral-400'}>
          {value !== null && value !== undefined ? value : placeholder}
        </span>
        <ChevronDownIcon className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {options.map((num) => (
            <li
              key={num}
              onClick={() => {
                onChange(num)
                setIsOpen(false)
              }}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                value === num 
                  ? 'bg-brand-50 text-brand-700 font-medium' 
                  : 'text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {num}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Experience Status Dropdown
function StatusDropdown({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  
  const options = [
    { value: 'current_and_past', label: 'Current and Past' },
    { value: 'current', label: 'Current' },
    { value: 'past', label: 'Past' },
  ]

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(opt => opt.value === value) || options[0]

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm cursor-pointer transition-all ${
          isOpen 
            ? 'border-brand-500 ring-2 ring-brand-100' 
            : 'border-neutral-300 hover:border-neutral-400'
        }`}
      >
        <span className="text-neutral-700">{selectedOption.label}</span>
        <ChevronDownIcon className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
          {options.map((opt) => (
            <li
              key={opt.value}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                value === opt.value 
                  ? 'bg-brand-50 text-brand-700 font-medium' 
                  : 'text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Selected Filter Tag
function FilterTag({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-md">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="hover:bg-neutral-200 rounded p-0.5"
      >
        <XMarkIcon className="w-3 h-3" />
      </button>
    </span>
  )
}

export default function SidebarFilters({ filters, onChange, onSearch, onSave, validationError, setValidationError }) {
  const [experienceFrom, setExperienceFrom] = useState(filters.experienceFrom ?? null)
  const [experienceTo, setExperienceTo] = useState(filters.experienceTo ?? null)
  const [experienceStatus, setExperienceStatus] = useState(filters.experienceStatus || 'current_and_past')
  const [localKeywords, setLocalKeywords] = useState(filters.keywords || '')
  const [localName, setLocalName] = useState(filters.name || '')
  const [localLocation, setLocalLocation] = useState(filters.location || '')
  
  const debouncedName = useDebounce(localName, 300)
  const debouncedLocation = useDebounce(localLocation, 300)
  const debouncedKeywords = useDebounce(localKeywords, 300)

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

  // Update experience filters in parent
  useEffect(() => {
    onChange(prev => ({
      ...prev,
      experienceFrom,
      experienceTo,
      experienceStatus,
    }))
  }, [experienceFrom, experienceTo, experienceStatus])

  // Count active filters
  const activeFilters = [
    filters.name,
    filters.location,
    filters.jobTitle,
    experienceFrom !== null || experienceTo !== null,
    filters.keywords,
  ].filter(Boolean).length

  const handleClearFilters = () => {
    setLocalName('')
    setLocalLocation('')
    setLocalKeywords('')
    setExperienceFrom(null)
    setExperienceTo(null)
    setExperienceStatus('current_and_past')
    onChange({
      name: '',
      location: '',
      jobTitle: '',
      keywords: '',
      experienceFrom: null,
      experienceTo: null,
      experienceStatus: 'current_and_past',
    })
    setValidationError?.('')
  }

  const handleSearch = () => {
    // Validation: If experience is selected but no job title
    if ((experienceFrom !== null || experienceTo !== null) && !filters.jobTitle) {
      setValidationError?.('Please select Job Title to filter by experience.')
      return
    }
    setValidationError?.('')
    onSearch()
  }

  const handleJobTitleSelect = (title) => {
    onChange(prev => ({ ...prev, jobTitle: title }))
    // Clear validation error when job title is selected
    if (title) {
      setValidationError?.('')
    }
  }

  const formatExperienceDisplay = () => {
    if (experienceFrom === null && experienceTo === null) return null
    const from = experienceFrom ?? 0
    const to = experienceTo ?? 50
    return `${from} - ${to}`
  }

  return (
    <aside className="fixed left-0 top-16 w-64 bg-white border-r border-neutral-200 h-[calc(100vh-4rem)] overflow-y-auto z-20 shadow-sm">
      <div className="p-4 flex flex-col min-h-full">
        {/* Header with Clear Filters */}
        {activeFilters > 0 && (
          <div className="mb-3 pb-3 border-b border-neutral-200">
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <span className="font-medium">Clear filters</span>
              <XMarkIcon className="w-4 h-4" />
            </button>
            <p className="mt-1 text-xs text-neutral-500">{activeFilters} filter{activeFilters !== 1 ? 's' : ''} applied</p>
          </div>
        )}

        {/* Section Header */}
        <div className="mb-4">
          <h2 className="text-base font-semibold text-neutral-900">People Search</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Filter candidates</p>
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600 font-medium">{validationError}</p>
          </div>
        )}

        {/* General Section */}
        <CollapsibleSection title="General" defaultOpen={true}>
          <div className="space-y-4 px-1">
            {/* Profile Name */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                Profile Name
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                placeholder="e.g., John Doe"
              />
            </div>

            {/* Profile Location */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                Profile Location
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all"
                value={localLocation}
                onChange={(e) => setLocalLocation(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                placeholder="e.g., Austin, TX"
              />
            </div>

            {/* Job Title Dropdown */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                Job Title
              </label>
              <JobTitleDropdown
                value={filters.jobTitle}
                onChange={(title) => onChange(prev => ({ ...prev, jobTitle: title }))}
                onValidSelect={handleJobTitleSelect}
              />
            </div>

            {/* Years of Experience */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">
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
              
              {/* Status Dropdown */}
              <div className="mb-2">
                <StatusDropdown
                  value={experienceStatus}
                  onChange={setExperienceStatus}
                />
              </div>
              
              {/* Range Selectors */}
              <div className="flex items-center gap-2">
                <RangeDropdown
                  value={experienceFrom}
                  onChange={setExperienceFrom}
                  max={50}
                  placeholder="From"
                />
                <span className="text-neutral-400 text-sm">-</span>
                <RangeDropdown
                  value={experienceTo}
                  onChange={setExperienceTo}
                  max={50}
                  placeholder="To"
                />
              </div>
            </div>

            {/* Keywords (Skills) */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                Keywords
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all"
                value={localKeywords}
                onChange={(e) => setLocalKeywords(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                placeholder="e.g., React, Node, Python"
              />
              <p className="mt-1 text-xs text-neutral-400">Separate skills with commas</p>
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
            className="w-full py-2.5 px-4 bg-white hover:bg-neutral-50 text-neutral-600 font-medium text-sm rounded-lg border border-neutral-300 transition-all duration-200"
            onClick={onSave}
          >
            Save search
          </button>
        </div>
      </div>
    </aside>
  )
}
