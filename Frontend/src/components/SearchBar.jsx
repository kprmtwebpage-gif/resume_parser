import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'

export default function SearchBar({ value, onChange, onSubmit }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl blur-xl"></div>
      <div className="card relative px-6 py-4 bg-white/80 backdrop-blur-sm">
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-blue-500" />
          <input
            className="w-full rounded-full border-2 border-slate-200 bg-white px-14 py-4 text-base font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none hover:border-slate-300"
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
              className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
