export default function SidebarFilters({ filters, onChange, onSearch, onSave }) {
  return (
    <aside className="card sticky top-20 h-[calc(100vh-96px)] w-full max-w-[360px] overflow-auto p-6 bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 p-1 shadow-lg">
        <button type="button" className="flex-1 rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-md transform transition-transform hover:scale-[1.02]">
          🔍 People Search
        </button>
      </div>

      <div className="mt-6">
        <div className="text-xs font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Filters</div>

        <div className="mt-4 space-y-4">
          <div className="group">
            <label className="mb-2 block text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="text-blue-500">👤</span> Profile name
            </label>
            <input
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:outline-none hover:border-slate-300 group-hover:shadow-md"
              value={filters.name}
              onChange={(e) => onChange({ ...filters, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
              placeholder="e.g., John Doe"
            />
          </div>

          <div className="group">
            <label className="mb-2 block text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="text-green-500">📍</span> Location
            </label>
            <input
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-green-400 focus:ring-4 focus:ring-green-100 focus:outline-none hover:border-slate-300 group-hover:shadow-md"
              value={filters.location}
              onChange={(e) => onChange({ ...filters, location: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
              placeholder="e.g., Austin, TX"
            />
          </div>

          <div className="group">
            <label className="mb-2 block text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="text-purple-500">💼</span> Job title
            </label>
            <input
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-100 focus:outline-none hover:border-slate-300 group-hover:shadow-md"
              value={filters.jobTitle}
              onChange={(e) => onChange({ ...filters, jobTitle: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
              placeholder="e.g., Full Stack Developer"
            />
          </div>

          {/* Experience section - commented out */}
          {/* <div className="group">
            <label className="mb-2 block text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="text-orange-500">⏱️</span> Experience
            </label>
            <input
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-100 focus:outline-none hover:border-slate-300 group-hover:shadow-md"
              value={filters.years}
              onChange={(e) => onChange({ ...filters, years: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
              placeholder="e.g., 5+, 3-5 years"
            />
          </div> */}

          {/* Skills & Keywords section - commented out */}
          {/* <div className="group">
            <label className="mb-2 block text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="text-pink-500">🏷️</span> Skills & Keywords
            </label>
            <input
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-pink-400 focus:ring-4 focus:ring-pink-100 focus:outline-none hover:border-slate-300 group-hover:shadow-md"
              value={filters.keywords}
              onChange={(e) => onChange({ ...filters, keywords: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
              placeholder="e.g., React, AWS, Python"
            />
          </div> */}

          <div className="flex gap-3 pt-4">
            <button type="button" className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]" onClick={onSearch}>
              🔍 Search
            </button>
            {/* Save button - commented out */}
            {/* <button type="button" className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md hover:bg-slate-50" onClick={onSave}>
              💾 Save
            </button> */}
          </div>
        </div>
      </div>
    </aside>
  )
}
