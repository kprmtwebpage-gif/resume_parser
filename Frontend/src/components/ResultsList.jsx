import { useTheme } from '../contexts/ThemeContext'
import ProfileCard from './ProfileCard.jsx'

export default function ResultsList({ rows, downloadedIds, onOpen, onDownload, onEdit, selectedIds, onToggleSelect, onToggleSelectAll }) {
  const { colors, isDark } = useTheme()
  
  const allSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.id))
  const someSelected = rows.some(r => selectedIds.has(r.id))
  
  return (
    <div className="space-y-0">
      <div 
        className="grid items-center py-3 text-xs font-semibold uppercase tracking-wide border-b transition-colors duration-300" 
        style={{ 
          gridTemplateColumns: '40px 1fr 26% 32% 12%', 
          width: '100%',
          color: isDark ? '#94a3b8' : '#6b7280',
          backgroundColor: colors.card,
          borderColor: colors.border
        }}
      >
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={allSelected}
            ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
            onChange={() => onToggleSelectAll(rows.map(r => r.id))}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            title={allSelected ? 'Deselect all' : 'Select all on this page'}
          />
        </div>
        <div className="truncate px-6">Candidate</div>
        <div className="truncate px-6">Location</div>
        <div className="truncate px-6">Contact</div>
        <div className="flex justify-end px-4">Actions</div>
      </div>

      <div className="divide-y transition-colors duration-300" style={{ borderColor: colors.border }}>
        {rows.map((row) => (
          <ProfileCard
            key={row.id}
            row={row}
            downloaded={downloadedIds.has(row.id)}
            checked={selectedIds.has(row.id)}
            onToggle={() => onToggleSelect(row.id)}
            onOpen={(tab) => onOpen(row.id, tab)}
            onDownload={() => onDownload(row.id)}
            onEdit={() => onEdit(row.id)}
          />
        ))}

        {rows.length === 0 && (
          <div 
            className="px-6 py-10 text-center text-sm transition-colors duration-300"
            style={{ color: isDark ? '#94a3b8' : '#6b7280' }}
          >
            No results
          </div>
        )}
      </div>
    </div>
  )
}
