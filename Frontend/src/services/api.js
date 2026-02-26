// ================================================================
// API service layer — centralised fetch helpers for the backend
// ================================================================
import { apiUrl } from '../config.js'

/**
 * Fetch paginated candidate list with optional search filters.
 * @param {Object} params - Query parameters (name, location, jobTitle, keywords, limit, offset, etc.)
 * @returns {Promise<Array>} Array of candidate objects
 */
export async function fetchCandidates(params = {}) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value))
    }
  }
  const url = apiUrl(`/candidates${qs.toString() ? '?' + qs.toString() : ''}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch candidates: ${res.status}`)
  return res.json()
}

/**
 * Fetch a single candidate by ID.
 * @param {number|string} id - Candidate ID
 * @returns {Promise<Object>} Candidate detail object
 */
export async function fetchCandidateById(id) {
  const res = await fetch(apiUrl(`/candidates/${id}`))
  if (!res.ok) throw new Error(`Failed to fetch candidate ${id}: ${res.status}`)
  return res.json()
}

/**
 * Update a candidate's fields via PATCH.
 * @param {number|string} id - Candidate ID
 * @param {Object} data - Fields to update
 * @returns {Promise<Object>} Updated candidate object
 */
export async function updateCandidate(id, data) {
  const res = await fetch(apiUrl(`/candidates/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Failed to update candidate ${id}: ${res.status}`)
  return res.json()
}

/**
 * Upload a resume file to the backend for parsing.
 * @param {File} file - Resume file (PDF/DOCX)
 * @param {Function} [onProgress] - Progress callback (0-100)
 * @returns {Promise<Object>} Parsed resume result
 */
export async function uploadResume(file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', apiUrl('/upload-resume'))

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error('Invalid JSON response'))
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(formData)
  })
}

/**
 * Fetch database statistics.
 * @returns {Promise<Object>} Stats object
 */
export async function fetchStats() {
  const res = await fetch(apiUrl('/stats'))
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`)
  return res.json()
}
