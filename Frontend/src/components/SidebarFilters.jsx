export default function SidebarFilters({ filters, onChange, onSearch, onSave }) {
  return (
    <aside className="fixed left-0 top-16 w-64 bg-white border-r border-neutral-200 h-[calc(100vh-4rem)] overflow-y-auto z-20">
      <div className="p-4 flex flex-col min-h-full">
        {/* Section 1: Search Filters */}
        <div>
          <h2 className="text-base font-semibold text-neutral-900 mb-1">People Search</h2>
          <p className="text-xs text-neutral-500 mb-6">Filter candidates</p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                Profile Name
              </label>
              <input
                className="w-full rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={filters.name}
                onChange={(e) => onChange({ ...filters, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
                placeholder="e.g., John Doe"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                Location
              </label>
              <input
                className="w-full rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={filters.location}
                onChange={(e) => onChange({ ...filters, location: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
                placeholder="e.g., Austin, TX"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                Job Title
              </label>
              <input
                className="w-full rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={filters.jobTitle}
                onChange={(e) => onChange({ ...filters, jobTitle: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
                placeholder="e.g., Full Stack Developer"
              />
            </div>

            <div className="pt-2">
              <button type="button" className="w-full btn-primary" onClick={onSearch}>
                Search
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
