import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'

export default function SearchBar({ value, onChange, onSubmit }) {
  return (
    <div className="card px-6 py-4">
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
        <input
          className="w-full rounded-button border border-neutral-300 bg-white pl-12 pr-12 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none hover:border-neutral-400"
          placeholder="Search for talented professionals..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
          }}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
