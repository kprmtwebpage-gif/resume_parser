/**
 * Interview Pipeline (Kanban) API service.
 */
import { api } from './api'

// ── Board ──────────────────────────────────────────
export async function fetchBoard({ jobId, search } = {}) {
  const res = await api.get('/api/pipeline/board', {
    params: { job_id: jobId || undefined, search: search || undefined },
  })
  return res.data
}

export async function fetchStages() {
  const res = await api.get('/api/pipeline/stages')
  return res.data
}

export async function fetchRankings() {
  const res = await api.get('/api/pipeline/rankings')
  return res.data
}

// ── Candidates ─────────────────────────────────────
export async function addToPipeline(data) {
  const res = await api.post('/api/pipeline/candidates', data)
  return res.data
}

export async function fetchPipelineCandidates(params = {}) {
  const res = await api.get('/api/pipeline/candidates', { params })
  return res.data
}

export async function fetchPipelineCandidate(id) {
  const res = await api.get(`/api/pipeline/candidates/${id}`)
  return res.data
}

export async function removeFromPipeline(id) {
  return api.delete(`/api/pipeline/candidates/${id}`)
}

// ── Stage transitions ──────────────────────────────
export async function moveCandidate(id, toStage, action = 'moved', notes = '') {
  const res = await api.post(`/api/pipeline/candidates/${id}/move`, {
    to_stage: toStage, action, notes,
  })
  return res.data
}

// ── Feedback ───────────────────────────────────────
export async function addFeedback(id, data) {
  const res = await api.post(`/api/pipeline/candidates/${id}/feedback`, data)
  return res.data
}

export async function fetchFeedback(id) {
  const res = await api.get(`/api/pipeline/candidates/${id}/feedback`)
  return res.data
}

export async function updateFeedback(feedbackId, data) {
  const res = await api.put(`/api/pipeline/feedback/${feedbackId}`, data)
  return res.data
}

export async function deleteFeedback(feedbackId) {
  return api.delete(`/api/pipeline/feedback/${feedbackId}`)
}

// ── Scorecard ──────────────────────────────────────
export async function fetchScorecard(id) {
  const res = await api.get(`/api/pipeline/candidates/${id}/scorecard`)
  return res.data
}

// ── Stage Config (Admin) ───────────────────────────
export async function fetchAllStages() {
  const res = await api.get('/api/pipeline/stages/all')
  return res.data
}

export async function createStage(data) {
  const res = await api.post('/api/pipeline/stages', data)
  return res.data
}

export async function updateStage(id, data) {
  const res = await api.put(`/api/pipeline/stages/${id}`, data)
  return res.data
}

export async function deleteStage(id) {
  return api.delete(`/api/pipeline/stages/${id}`)
}

export async function reorderStages(stageKeys) {
  const res = await api.post('/api/pipeline/stages/reorder', stageKeys)
  return res.data
}

// ── Analytics ──────────────────────────────────────
export async function fetchPipelineAnalytics() {
  const res = await api.get('/api/pipeline/analytics')
  return res.data
}
