import ProfileCard from './ProfileCard.jsx'

export default function ResultsList({ rows, selectedIds, downloadedIds, onToggle, onOpen, onDownload, onEdit }) {
  return (
    <div className="space-y-0">
      <div className="grid items-center py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-50 border-b border-neutral-200" style={{ gridTemplateColumns: '5% 27% 26% 32% 10%', width: '100%' }}>
        <div className="flex justify-center px-4">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-200"
            checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
            onChange={(e) => {
              const shouldSelectAll = e.target.checked
              rows.forEach((r) => onToggle(r.id, shouldSelectAll))
            }}
          />
        </div>
        <div className="truncate px-6">Candidate</div>
        <div className="truncate px-6">Location</div>
        <div className="truncate px-6">Contact</div>
        <div className="flex justify-end px-4">Actions</div>
      </div>

      <div className="divide-y divide-neutral-100">
        {rows.map((row) => (
          <ProfileCard
            key={row.id}
            row={row}
            checked={selectedIds.has(row.id)}
            downloaded={downloadedIds.has(row.id)}
            onToggle={(checked) => onToggle(row.id, checked)}
            onOpen={() => onOpen(row.id)}
            onDownload={() => onDownload(row.id)}
            onEdit={() => onEdit(row.id)}
          />
        ))}

        {rows.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-neutral-500">No results</div>
        )}
      </div>
    </div>
  )
}
