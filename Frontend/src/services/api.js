import axios from 'axios'

// Use relative URL for production, or env variable for development
const baseURL = import.meta.env.VITE_API_BASE_URL || ''

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
})

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rp_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      const customError = new Error(
        'Cannot connect to backend server. Please ensure the FastAPI server is running on http://localhost:8000'
      )
      customError.isNetworkError = true
      return Promise.reject(customError)
    }
    return Promise.reject(error)
  }
)

export async function fetchCandidates({ q, name, location, jobTitle, keywords, experienceFrom, experienceTo, experienceStatus, limit, offset }) {
  const res = await api.get('/candidates', {
    params: {
      q: q || undefined,
      name: name || undefined,
      location: location || undefined,
      jobTitle: jobTitle || undefined,
      keywords: keywords || undefined,
      experienceFrom: experienceFrom ?? undefined,
      experienceTo: experienceTo ?? undefined,
      experienceStatus: experienceStatus || undefined,
      limit,
      offset,
    },
  })
  return res.data
}

export async function fetchCandidateById(id) {
  const res = await api.get(`/candidates/${id}`)
  return res.data
}

export async function updateCandidate(id, data) {
  const res = await api.patch(`/candidates/${id}`, data)
  return res.data
}

export async function uploadResume(file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await api.post('/upload-resume', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        onProgress(percentCompleted)
      }
    },
  })
  return res.data
}

export async function fetchStats() {
  const res = await api.get('/stats')
  return res.data
}

export async function bulkDownloadResumes(candidateIds) {
  const res = await api.post('/candidates/bulk-download', { ids: candidateIds }, {
    responseType: 'blob'
  })
  return res.data
}
