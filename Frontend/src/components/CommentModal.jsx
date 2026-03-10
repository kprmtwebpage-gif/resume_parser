import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { api } from '../services/api'
import './CommentModal.css'

const COMMENTS_API = '/standalone-comments/'

export default function CommentModal({ isOpen, onClose, candidateId, candidateName }) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSave = async () => {
    const trimmed = comment.trim()
    if (!trimmed) {
      setError('Comment cannot be empty.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      candidate_id: String(candidateId),
      comment_text: trimmed,
    }
    console.log('[CommentModal] Sending payload:', payload)

    try {
      const res = await api.post(COMMENTS_API, payload)
      console.log('[CommentModal] Response:', res.status, res.data)
      if (res.status === 200) {
        setComment('')
        setSaving(false)
        onClose(true)
      } else {
        setError('Unexpected response. Please try again.')
        setSaving(false)
      }
    } catch (err) {
      console.error('[CommentModal] Failed to save comment:', err)
      setError('Failed to save comment. Please try again.')
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setComment('')
    setError('')
    onClose(false)
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) handleCancel()
  }

  return (
    <div className="ccm-overlay" onClick={handleOverlayClick}>
      <div className="ccm-modal">
        {/* Header */}
        <div className="ccm-header">
          <div>
            <h2 className="ccm-title">Add Comment</h2>
            {candidateName && (
              <p className="ccm-subtitle">{candidateName}</p>
            )}
          </div>
          <button type="button" className="ccm-close-btn" onClick={handleCancel} aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="ccm-body">
          <textarea
            className="ccm-textarea"
            rows={6}
            placeholder="Write your comment here..."
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
              if (error) setError('')
            }}
            autoFocus
          />
          {error && <p className="ccm-error">{error}</p>}
        </div>

        {/* Footer */}
        <div className="ccm-footer">
          <button type="button" className="ccm-btn-cancel" onClick={handleCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="ccm-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
