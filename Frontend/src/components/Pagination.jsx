import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import { useTheme } from '../contexts/ThemeContext'

export default function Pagination({ page, rowsPerPage, totalRows, onRowsPerPage, onPrev, onNext, isPrevDisabled, isNextDisabled }) {
  const { colors, isDark } = useTheme()
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1
  const rangeStart = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(page * rowsPerPage, totalRows)

  const btnStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#e2e8f0' : '#374151',
    border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <span className="text-sm" style={{ color: isDark ? '#94a3b8' : '#4b5563' }}>
          {totalRows === 0
            ? 'No results'
            : `Showing ${rangeStart}–${rangeEnd} of ${totalRows}`}
        </span>
        <div className="flex items-center gap-2 text-sm" style={{ color: isDark ? '#94a3b8' : '#4b5563' }}>
          <span>Per page</span>
          <select
            className="rounded-button px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#e2e8f0' : '#111827',
              border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
            }}
            value={rowsPerPage}
            onChange={(e) => onRowsPerPage(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-button px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-40"
          style={btnStyle}
          onClick={onPrev}
          disabled={isPrevDisabled}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Prev
        </button>
        <div
          className="rounded-button px-3 py-2 text-sm"
          style={{
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#e2e8f0' : '#374151',
            border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
          }}
        >
          Page {page} of {totalPages}
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-button px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-40"
          style={btnStyle}
          onClick={onNext}
          disabled={isNextDisabled}
        >
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
