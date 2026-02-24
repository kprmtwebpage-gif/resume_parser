import { useState } from 'react'

export default function Jobs() {
  const [filters, setFilters] = useState({
    title: '',
    location: '',
    company: '',
    status: '',
    priority: '',
    createdBy: '',
    assignees: '',
    skills: '',
  })

  const handleSearch = () => {
    // Search functionality to be implemented
    console.log('Searching with filters:', filters)
  }

  const handleExport = () => {
    // Export functionality to be implemented
    alert('Export functionality coming soon')
  }

  const handleCreateJob = () => {
    // Create job functionality to be implemented
    alert('Create new job functionality coming soon')
  }

  return (
    <div className="h-screen overflow-hidden">
      {/* Left Sidebar - Filters */}
      <aside className="fixed left-0 top-16 w-64 bg-white border-r border-neutral-200 h-[calc(100vh-4rem)] overflow-y-auto z-20">
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-neutral-900">Filters</h2>
            <button 
              type="button" 
              className="text-xs text-neutral-500 hover:text-neutral-700"
              onClick={() => setFilters({
                title: '',
                location: '',
                company: '',
                status: '',
                priority: '',
                createdBy: '',
                assignees: '',
                skills: '',
              })}
            >
              Clear filters ×
            </button>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">Title</label>
              <input
                className="w-full rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={filters.title}
                onChange={(e) => setFilters({ ...filters, title: e.target.value })}
                placeholder=""
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">Location</label>
              <input
                className="w-full rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                placeholder=""
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">Company</label>
              <input
                className="w-full rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={filters.company}
                onChange={(e) => setFilters({ ...filters, company: e.target.value })}
                placeholder=""
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">Status</label>
              <input
                className="w-full rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                placeholder=""
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">Priority</label>
              <input
                className="w-full rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                placeholder=""
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">Created by</label>
              <input
                className="w-full rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={filters.createdBy}
                onChange={(e) => setFilters({ ...filters, createdBy: e.target.value })}
                placeholder=""
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">Assignees</label>
              <input
                className="w-full rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={filters.assignees}
                onChange={(e) => setFilters({ ...filters, assignees: e.target.value })}
                placeholder=""
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">Skills</label>
              <input
                className="w-full rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={filters.skills}
                onChange={(e) => setFilters({ ...filters, skills: e.target.value })}
                placeholder=""
              />
            </div>
          </div>

          {/* Bottom Buttons */}
          <div className="mt-4 space-y-2 pt-4 border-t border-neutral-200">
            <button
              type="button"
              className="w-full btn-primary"
              onClick={handleSearch}
            >
              Search
            </button>
            <button
              type="button"
              className="w-full rounded-button border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              onClick={handleExport}
            >
              Export
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 h-screen overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-neutral-900">Job Projects</h1>
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input type="checkbox" className="rounded border-neutral-300" />
              Show my jobs only
            </label>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={handleCreateJob}
          >
            Create new job
          </button>
        </div>

        {/* Table Header */}
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Job/Company/Department
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Opened ↓
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Open days ↑
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Status ↑
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Priority ↑
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Quantity ↑
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  On board
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Hired ↑
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {/* Empty state */}
              <tr>
                <td colSpan="9" className="px-4 py-16 text-center text-neutral-500">
                  Data not found
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>Total 0 profiles</span>
          <div className="flex items-center gap-2">
            <button className="p-1 rounded hover:bg-neutral-100 disabled:opacity-50" disabled>
              &lt;
            </button>
            <button className="p-1 rounded hover:bg-neutral-100 disabled:opacity-50" disabled>
              &gt;
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
