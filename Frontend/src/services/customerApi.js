/**
 * Customer module API service.
 * Uses the same axios instance from services/api.js for auth token.
 */
import { api } from './api'

// ── Customers ──────────────────────────────────────────────────

export async function fetchCustomers({ search, status, sortBy, sortOrder, limit, offset } = {}) {
  const res = await api.get('/api/customers', {
    params: {
      search: search || undefined,
      status: status || undefined,
      sort_by: sortBy || undefined,
      sort_order: sortOrder || undefined,
      limit: limit || 100,
      offset: offset || 0,
    },
  })
  return res.data
}

export async function fetchCustomer(id) {
  const res = await api.get(`/api/customers/${id}`)
  return res.data
}

export async function createCustomer(data) {
  const res = await api.post('/api/customers', data)
  return res.data
}

export async function updateCustomer(id, data) {
  const res = await api.put(`/api/customers/${id}`, data)
  return res.data
}

export async function deleteCustomer(id) {
  const res = await api.delete(`/api/customers/${id}`)
  return res.data
}

export async function cloneCustomer(id) {
  const res = await api.post(`/api/customers/${id}/clone`)
  return res.data
}

// ── Contact Persons ────────────────────────────────────────────

export async function addContactPerson(customerId, data) {
  const res = await api.post(`/api/customers/${customerId}/contact-persons`, data)
  return res.data
}

export async function updateContactPerson(customerId, cpId, data) {
  const res = await api.put(`/api/customers/${customerId}/contact-persons/${cpId}`, data)
  return res.data
}

export async function deleteContactPerson(customerId, cpId) {
  const res = await api.delete(`/api/customers/${customerId}/contact-persons/${cpId}`)
  return res.data
}

// ── Documents ──────────────────────────────────────────────────

export async function uploadDocuments(customerId, files, onProgress) {
  const formData = new FormData()
  files.forEach((f) => formData.append('files', f))
  const res = await api.post(`/api/customers/${customerId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
    },
  })
  return res.data
}

export async function deleteDocument(customerId, docId) {
  const res = await api.delete(`/api/customers/${customerId}/documents/${docId}`)
  return res.data
}

// ── Activities ─────────────────────────────────────────────────

export async function fetchActivities(customerId) {
  const res = await api.get(`/api/customers/${customerId}/activities`)
  return res.data
}
