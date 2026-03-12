/**
 * CommentsTimeline – vertical dotted-line timeline for candidate comments.
 *
 * Props:
 *   comments  — array of { id, comment_text, created_at }
 *   loading   — boolean (optional)
 */
export default function CommentsTimeline({ comments = [], loading = false }) {
  if (loading) {
    return (
      <div className="text-sm text-neutral-500 py-6 text-center">
        Loading comments…
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="text-sm text-neutral-500 py-6 text-center">
        No comments yet
      </div>
    )
  }

  return (
    <div className="relative pl-6" style={{ maxHeight: '420px', overflowY: 'auto' }}>
      {/* Vertical dotted line */}
      <div
        className="absolute top-0 bottom-0 left-[9px]"
        style={{ borderLeft: '2px dotted #cbd5e1' }}
      />

      {comments.map((c) => {
        const d = new Date(c.created_at)
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        const dateStr = `${months[d.getMonth()]} ${d.getFullYear()}`
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

        return (
          <div key={c.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
            {/* Dot marker */}
            <div
              className="absolute left-[-15px] top-[6px] h-3 w-3 rounded-full bg-blue-500 ring-2 ring-white z-10 flex-shrink-0"
            />

            {/* Comment card */}
            <div className="flex-1 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-neutral-800 leading-relaxed">{c.comment_text}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
                <span>{dateStr}</span>
                <span className="text-neutral-300">·</span>
                <span>{timeStr}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
