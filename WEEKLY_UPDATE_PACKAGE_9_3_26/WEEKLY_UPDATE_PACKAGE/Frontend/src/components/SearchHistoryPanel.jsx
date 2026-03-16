import { XMarkIcon, ClockIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

/**
 * SearchHistoryPanel - Displays search history like browser history
 * 
 * Props:
 *  - searchHistory: Array of search history entries
 *  - onClose: Function to close panel
 *  - onSelectSearch: Function called when user selects a previous search
 *  - onClearHistory: Function to clear all history
 *  - onDeleteEntry: Function to delete a single entry
 */
export default function SearchHistoryPanel({ 
  searchHistory, 
  onClose, 
  onSelectSearch, 
  onClearHistory,
  onDeleteEntry 
}) {
  // Group history by date
  const groupByDate = (history) => {
    const groups = {}
    
    history.forEach(entry => {
      const date = new Date(entry.created_at)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      let dateKey
      if (date.toDateString() === today.toDateString()) {
        dateKey = 'Today'
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = 'Yesterday'
      } else {
        dateKey = date.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric',
          year: 'numeric'
        })
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(entry)
    })
    
    return groups
  }

  // Format time
  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const groupedHistory = groupByDate(searchHistory)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <ClockIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Search History</h2>
              <p className="text-sm text-gray-500">{searchHistory.length} searches</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {searchHistory.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-sm text-red-500 hover:text-red-600 px-3 py-1"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-80px)]">
          {searchHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
              <ClockIcon className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No search history</h3>
              <p className="text-sm text-gray-500">
                Your recent searches will appear here
              </p>
            </div>
          ) : (
            <div className="p-4">
              {Object.entries(groupedHistory).map(([date, entries]) => (
                <div key={date} className="mb-6">
                  {/* Date Header */}
                  <h3 className="text-sm font-semibold text-gray-500 mb-3">{date}</h3>
                  
                  {/* Entries */}
                  <div className="space-y-2">
                    {entries.map((entry, index) => (
                      <div
                        key={entry.id || index}
                        className="group flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={() => onSelectSearch(entry)}
                      >
                        {/* Icon */}
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-white transition-colors">
                          <MagnifyingGlassIcon className="w-4 h-4 text-gray-500" />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">
                            {entry.query || 'All Jobs'}
                          </p>
                          {entry.location && (
                            <p className="text-xs text-gray-500 truncate">
                              📍 {entry.location}
                            </p>
                          )}
                        </div>
                        
                        {/* Time & Delete */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {formatTime(entry.created_at)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteEntry && onDeleteEntry(entry)
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove from history"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
