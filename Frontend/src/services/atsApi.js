/**
 * ATS Job-Candidate Matching API service.
 */
import { api } from './api'

export async function analyzeJob(jobId, forceRefresh = false) {
  const res = await api.post('/api/ats/analyze', { job_id: jobId, force_refresh: forceRefresh })
  return res.data
}

export async function analyzeAllJobs() {
  const res = await api.post('/api/ats/analyze-all')
  return res.data
}

export async function fetchMatches(jobId, { tier, minScore, appliedOnly, shortlistedOnly, limit, offset } = {}) {
  const res = await api.get(`/api/ats/matches/${jobId}`, {
    params: {
      tier: tier || undefined, min_score: minScore || undefined,
      applied_only: appliedOnly || undefined, shortlisted_only: shortlistedOnly || undefined,
      limit: limit || 200, offset: offset || 0,
    },
  })
  return res.data
}

export async function fetchMatchSummary(jobId) {
  const res = await api.get(`/api/ats/matches/${jobId}/summary`)
  return res.data
}

export async function toggleShortlist(matchId) {
  const res = await api.patch(`/api/ats/matches/${matchId}/shortlist`)
  return res.data
}

export async function fetchATSConfigs() {
  const res = await api.get('/api/ats/config')
  return res.data
}

export async function createATSConfig(data) {
  const res = await api.post('/api/ats/config', data)
  return res.data
}

export async function updateATSConfig(configId, data) {
  const res = await api.put(`/api/ats/config/${configId}`, data)
  return res.data
}

export async function deleteATSConfig(configId) {
  return api.delete(`/api/ats/config/${configId}`)
}

export async function fetchATSRuns(jobId) {
  const res = await api.get('/api/ats/runs', { params: { job_id: jobId || undefined } })
  return res.data
}

export async function fetchATSDashboard() {
  const res = await api.get('/api/ats/dashboard')
  return res.data
}
