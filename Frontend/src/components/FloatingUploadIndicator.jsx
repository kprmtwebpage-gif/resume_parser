import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { useUpload } from '../contexts/UploadContext'

export default function FloatingUploadIndicator() {
  const { uploads, activeCount } = useUpload()
  const location = useLocation()
  const navigate = useNavigate()

  // Don't show on the upload page itself — it already has its own UI
  if (location.pathname === '/upload') return null
  // Don't show when there are no active uploads
  if (activeCount === 0) return null

  const completedCount = uploads.filter(u => u.status === 'completed' || u.status === 'duplicate').length
  const totalCount = uploads.length

  return (
    <button
      onClick={() => navigate('/upload')}
      className="fixed bottom-20 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all animate-pulse"
      title="Click to view uploads"
    >
      <ArrowUpTrayIcon className="h-4 w-4" />
      <span>
        Uploading {completedCount}/{totalCount}
      </span>
      <span className="inline-block h-2 w-2 rounded-full bg-white animate-ping" />
    </button>
  )
}
