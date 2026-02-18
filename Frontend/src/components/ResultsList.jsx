import ProfileCard from './ProfileCard.jsx'

export default function ResultsList({ rows, selectedIds, onToggle, onOpen }) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[48px_1fr_240px] items-center gap-4 border-b border-slate-100 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <div className="flex items-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
            checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
            onChange={(e) => {
              const shouldSelectAll = e.target.checked
              rows.forEach((r) => onToggle(r.id, shouldSelectAll))
            }}
          />
        </div>
        <div className="grid grid-cols-[1fr_260px] gap-4">
          <div>Name</div>
          <div>Location</div>
        </div>
        <div className="text-right">Contacts</div>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <ProfileCard
            key={row.id}
            row={row}
            checked={selectedIds.has(row.id)}
            onToggle={(checked) => onToggle(row.id, checked)}
            onOpen={() => onOpen(row.id)}
          />
        ))}

        {rows.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-slate-500">No results</div>
        )}
      </div>
    </div>
  )
}
