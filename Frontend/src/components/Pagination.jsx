import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'

export default function Pagination({ page, rowsPerPage, onRowsPerPage, onPrev, onNext, isPrevDisabled, isNextDisabled }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span>Rows per page</span>
        <select
          className="input !w-auto !py-1.5"
          value={rowsPerPage}
          onChange={(e) => onRowsPerPage(Number(e.target.value))}
        >
          {[10, 25, 50].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary" onClick={onPrev} disabled={isPrevDisabled}>
          <ChevronLeftIcon className="h-4 w-4" />
          Prev
        </button>
        <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">Page {page}</div>
        <button type="button" className="btn-secondary" onClick={onNext} disabled={isNextDisabled}>
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
