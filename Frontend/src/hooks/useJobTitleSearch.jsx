/**
 * Job Title Search Hook for React
 * 
 * Example usage of the job title search endpoint
 * Demonstrates intelligent search with debouncing and caching
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Custom hook for job title search with debouncing
 * 
 * @param {number} debounceMs - Debounce delay in milliseconds
 * @returns {Object} Search state and functions
 */
export function useJobTitleSearch(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [count, setCount] = useState(0);
  
  // Cache to avoid redundant API calls — entries expire after 30 seconds
  // so freshly-parsed data is never hidden behind a stale cache.
  const CACHE_TTL_MS = 30_000;
  const cacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);

  /**
   * Search job titles with the given query
   */
  const search = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setCount(0);
      setStrategy(null);
      return;
    }

    // Check cache first (honour TTL)
    const cached = cacheRef.current.get(searchQuery);
    if (cached && (Date.now() - cached._ts) < CACHE_TTL_MS) {
      setResults(cached.results);
      setCount(cached.count);
      setStrategy(cached.strategy);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/job-titles/search?q=${encodeURIComponent(searchQuery)}`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the results with timestamp
      cacheRef.current.set(searchQuery, { ...data, _ts: Date.now() });
      
      setResults(data.results || []);
      setCount(data.count || 0);
      setStrategy(data.strategy);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setResults([]);
        setCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Debounced search effect
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs, search]);

  /**
   * Clear search results and query
   */
  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setCount(0);
    setStrategy(null);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    strategy,
    count,
    clear,
  };
}


/**
 * Example JobTitleSearchInput Component
 * 
 * A complete search input with autocomplete dropdown
 */
export function JobTitleSearchInput({ onSelect, placeholder = "Search job titles..." }) {
  const { 
    query, 
    setQuery, 
    results, 
    loading, 
    error, 
    strategy, 
    count 
  } = useJobTitleSearch(300);
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);

  const handleSelect = (title) => {
    setQuery(title);
    setShowDropdown(false);
    if (onSelect) {
      onSelect(title);
    }
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (results.length > 0 && query.length > 0) {
      setShowDropdown(true);
      setSelectedIndex(-1);
    } else {
      setShowDropdown(false);
    }
  }, [results, query]);

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 text-sm text-red-600">
          Error: {error}
        </div>
      )}

      {/* Strategy Badge */}
      {strategy && query && (
        <div className="mt-1 text-xs text-gray-500">
          {strategy === 'broad_search' && `🔍 Showing ${count} matching titles`}
          {strategy === 'exact_match' && '✅ Exact match found'}
          {strategy === 'fuzzy_match' && `🎯 Found ${count} similar titles`}
          {strategy === 'token_match' && `📋 Found ${count} results`}
        </div>
      )}

      {/* Dropdown Results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map((title, index) => (
            <div
              key={index}
              onClick={() => handleSelect(title)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`px-4 py-2 cursor-pointer transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-100 text-blue-900'
                  : 'hover:bg-gray-100'
              }`}
            >
              {title}
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {showDropdown && results.length === 0 && query && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          <div className="px-4 py-3 text-gray-500 text-center">
            No job titles found for "{query}"
          </div>
        </div>
      )}
    </div>
  );
}


/**
 * Example usage in a page component
 */
export function ExampleJobSearchPage() {
  const [selectedTitle, setSelectedTitle] = useState(null);
  const [candidates, setCandidates] = useState([]);

  const handleTitleSelect = async (title) => {
    setSelectedTitle(title);
    
    // Fetch candidates with this job title
    const response = await fetch(
      `${API_BASE_URL}/candidates?jobTitle=${encodeURIComponent(title)}`
    );
    const data = await response.json();
    setCandidates(data);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Search Candidates by Job Title</h1>
      
      <div className="max-w-md mb-8">
        <JobTitleSearchInput 
          onSelect={handleTitleSelect}
          placeholder="Search for a job title..."
        />
      </div>

      {selectedTitle && (
        <div className="mb-4">
          <span className="text-lg">
            Showing candidates for: 
            <strong className="ml-2">{selectedTitle}</strong>
          </span>
        </div>
      )}

      {/* Display candidates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {candidates.map((candidate) => (
          <div key={candidate.id} className="border rounded-lg p-4 shadow">
            <h3 className="font-semibold">
              {candidate.first_name} {candidate.last_name}
            </h3>
            <p className="text-sm text-gray-600">{candidate.location}</p>
            <p className="text-sm text-gray-600">{candidate.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


/**
 * Standalone function for direct API usage
 */
export async function searchJobTitles(query, limit = 100) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/job-titles/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Job title search failed:', error);
    throw error;
  }
}


// Example usage:
// const result = await searchJobTitles("Software Engineer");
// console.log(result.results); // ["Software Engineer"]
// console.log(result.strategy); // "exact_match"
