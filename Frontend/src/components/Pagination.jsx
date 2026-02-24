import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'

export default function Pagination({ page, rowsPerPage, totalRows, onRowsPerPage, onPrev, onNext, isPrevDisabled, isNextDisabled }) {
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1
  const rangeStart = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(page * rowsPerPage, totalRows)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <span className="text-sm text-neutral-600">
          {totalRows === 0
            ? 'No results'
            : `Showing ${rangeStart}–${rangeEnd} of ${totalRows}`}
        </span>
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span>Per page</span>
          <select
            className="input !w-auto !py-1.5"
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
        <button type="button" className="btn-secondary" onClick={onPrev} disabled={isPrevDisabled}>
          <ChevronLeftIcon className="h-4 w-4" />
          Prev
        </button>
        <div className="rounded-button bg-white px-3 py-2 text-sm text-neutral-700 border border-neutral-200">
          Page {page} of {totalPages}
        </div>
        <button type="button" className="btn-secondary" onClick={onNext} disabled={isNextDisabled}>
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
