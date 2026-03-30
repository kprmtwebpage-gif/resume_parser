/**
 * Interview Scheduling API service.
 */
import { api } from './api'

// ── Interview CRUD ─────────────────────────────────

export async function fetchInterviews({ search, status, type, dateFrom, dateTo, candidateId, jobId, sortBy, sortOrder, limit, offset } = {}) {
  const res = await api.get('/api/interviews', {
    params: {
      search: search || undefined,
      status: status || undefined,
      type: type || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      candidate_id: candidateId || undefined,
      job_id: jobId || undefined,
      sort_by: sortBy || 'scheduled_date',
      sort_order: sortOrder || 'desc',
      limit: limit || 100,
      offset: offset || 0,
    },
  })
  return res.data
}

export async function fetchInterview(id) {
  const res = await api.get(`/api/interviews/${id}`)
  return res.data
}

export async function createInterview(data) {
  const res = await api.post('/api/interviews', data)
  return res.data
}

export async function updateInterview(id, data) {
  const res = await api.put(`/api/interviews/${id}`, data)
  return res.data
}

export async function deleteInterview(id) {
  const res = await api.delete(`/api/interviews/${id}`)
  return res.data
}

// ── Status transitions ─────────────────────────────

export async function confirmInterview(id) {
  const res = await api.post(`/api/interviews/${id}/confirm`)
  return res.data
}

export async function cancelInterview(id, reason) {
  const res = await api.post(`/api/interviews/${id}/cancel`, null, {
    params: { reason: reason || undefined },
  })
  return res.data
}

export async function completeInterview(id, { outcome, rating } = {}) {
  const res = await api.post(`/api/interviews/${id}/complete`, null, {
    params: { outcome: outcome || undefined, rating: rating || undefined },
  })
  return res.data
}

export async function rescheduleInterview(id, newDate, newEnd) {
  const res = await api.post(`/api/interviews/${id}/reschedule`, null, {
    params: { new_date: newDate, new_end: newEnd || undefined },
  })
  return res.data
}

// ── Panel ──────────────────────────────────────────

export async function addPanelMember(interviewId, data) {
  const res = await api.post(`/api/interviews/${interviewId}/panel`, data)
  return res.data
}

export async function removePanelMember(interviewId, panelId) {
  const res = await api.delete(`/api/interviews/${interviewId}/panel/${panelId}`)
  return res.data
}

// ── Feedback ───────────────────────────────────────

export async function addFeedback(interviewId, data) {
  const res = await api.post(`/api/interviews/${interviewId}/feedback`, data)
  return res.data
}

export async function listFeedback(interviewId) {
  const res = await api.get(`/api/interviews/${interviewId}/feedback`)
  return res.data
}

// ── Availability ───────────────────────────────────

export async function addAvailability(data) {
  const res = await api.post('/api/interviews/availability', data)
  return res.data
}

export async function fetchAvailability({ email, dateFrom, dateTo } = {}) {
  const res = await api.get('/api/interviews/availability', {
    params: {
      email: email || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    },
  })
  return res.data
}

export async function deleteAvailability(id) {
  const res = await api.delete(`/api/interviews/availability/${id}`)
  return res.data
}

// ── Conflict check ─────────────────────────────────

export async function checkConflicts(interviewerEmail, start, end, excludeId) {
  const res = await api.get('/api/interviews/conflicts/check', {
    params: {
      interviewer_email: interviewerEmail,
      start,
      end,
      exclude_interview_id: excludeId || undefined,
    },
  })
  return res.data
}

// ── Analytics ──────────────────────────────────────

export async function fetchInterviewAnalytics() {
  const res = await api.get('/api/interviews/analytics')
  return res.data
}
