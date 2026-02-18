import {
  EnvelopeIcon,
  MapPinIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'

function initials(first, last) {
  const a = (first || '').trim()[0] || ''
  const b = (last || '').trim()[0] || ''
  return (a + b).toUpperCase() || '—'
}

function sanitizeLinkedInUrl(url) {
  if (!url) return null
  
  // Trim whitespace
  url = url.trim()
  
  // If URL doesn't start with http/https, add https
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  
  // Convert http to https for LinkedIn
  if (url.startsWith('http://') && url.includes('linkedin.com')) {
    url = url.replace('http://', 'https://')
  }
  
  return url
}

export default function ProfileCard({ row, checked, onToggle, onOpen }) {
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ') || `Candidate #${row.id}`
  const location = row.location || row.address || '—'

  return (
    <div className="group relative grid grid-cols-[48px_1fr_300px] items-center gap-6 px-6 py-5 transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 rounded-xl hover:shadow-lg hover:scale-[1.01]">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 rounded-xl transition-all duration-200"></div>
      <div className="relative flex items-center">
        <input
          type="checkbox"
          className="h-5 w-5 rounded-lg border-2 border-slate-300 text-blue-600 focus:ring-blue-200 focus:ring-4 transition-all hover:border-blue-400 cursor-pointer"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
        />
      </div>

      <div className="relative grid grid-cols-[1fr_220px] gap-8">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 shadow-md ring-2 ring-white group-hover:shadow-lg transition-all">
            {row.profile_picture_url ? (
              <img 
                src={row.profile_picture_url} 
                alt={`${row.first_name || ''} ${row.last_name || ''}`.trim()}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // Hide image and show initials if loading fails
                  e.target.style.display = 'none'
                }}
              />
            ) : null}
            <div className={`absolute inset-0 flex items-center justify-center text-base font-bold text-white ${row.profile_picture_url ? 'hidden' : ''}`}>
              {initials(row.first_name, row.last_name)}
            </div>
          </div>

          <div className="min-w-0">
            <button
              type="button"
              className="block truncate text-left text-base font-bold text-slate-900 hover:text-blue-600 transition-colors"
              onClick={onOpen}
            >
              {fullName}
            </button>
            <div className="mt-1 truncate text-sm font-medium text-slate-600">
              {row.job_title || '—'}
              {row.company ? <span className="text-slate-400"> · </span> : null}
              {row.company ? row.company : null}
            </div>
            {row.linkedin && (
              <div className="mt-1 flex items-center gap-2">
                <a
                  href={sanitizeLinkedInUrl(row.linkedin)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md p-1 text-[#0A66C2] hover:bg-blue-50"
                  title="View LinkedIn Profile"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-base text-slate-700">
          <MapPinIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
          <span className="break-words">{location}</span>
        </div>
      </div>

      <div className="flex flex-col items-end justify-center gap-1.5 text-sm">
        {row.email && (
          <div className="flex items-center gap-1.5 text-slate-700">
            <EnvelopeIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <a href={`mailto:${row.email}`} className="hover:text-blue-600 font-medium break-words text-right" title={row.email}>
              {row.email}
            </a>
          </div>
        )}
        {row.phone && (
          <div className="flex items-center gap-1.5 text-slate-700">
            <PhoneIcon className="h-4 w-4 text-slate-400" />
            <a href={`tel:${row.phone}`} className="hover:text-blue-600 font-medium" title={row.phone}>
              {row.phone}
            </a>
          </div>
        )}
        {!row.email && !row.phone && (
          <span className="text-slate-400">—</span>
        )}
      </div>
    </div>
  )
}
