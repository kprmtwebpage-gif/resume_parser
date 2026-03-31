/**
 * Email service API layer.
 * Handles all email-related API calls.
 */
import { api } from './api'

/* ── Provider Management ─────────────────────────────────────── */

export async function checkEmailProvider() {
  console.log('emailApi — checkEmailProvider()')
  const res = await api.get('/email/provider/check')
  console.log('emailApi — checkEmailProvider response:', res.data)
  return res.data
}

export async function getEmailProviders() {
  const res = await api.get('/email/provider')
  return res.data
}

export async function registerEmailProvider(payload) {
  console.log('emailApi — registerEmailProvider:', payload)
  const res = await api.post('/email/provider', payload)
  console.log('emailApi — registerEmailProvider response:', res.data)
  return res.data
}

/* ── Sender Info ─────────────────────────────────────────────── */

export async function getSenderInfo() {
  const res = await api.get('/email/sender-info')
  return res.data
}

/* ── Send Email ──────────────────────────────────────────────── */

export async function sendEmail({ candidateId, recipientEmail, subject, body, provider }) {
  console.log('emailApi — sendEmail:', { candidateId, recipientEmail, subject, provider })
  const res = await api.post('/email/send', {
    candidate_id: candidateId,
    recipient_email: recipientEmail,
    subject,
    body,
    provider,
  })
  console.log('emailApi — sendEmail response:', res.data)
  return res.data
}

export async function sendEmailWithAttachments({ candidateId, recipientEmail, subject, body, provider, files }) {
  console.log('emailApi — sendEmailWithAttachments:', { candidateId, recipientEmail, subject, provider, fileCount: files?.length })
  const formData = new FormData()
  if (files && files.length > 0) {
    files.forEach((file) => formData.append('files', file))
  }

  const res = await api.post('/email/send-with-attachments', formData, {
    params: {
      candidate_id: candidateId,
      recipient_email: recipientEmail,
      subject,
      body,
      provider,
    },
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  console.log('emailApi — sendEmailWithAttachments response:', res.data)
  return res.data
}

/* ── Log externally-sent email (Outlook web compose) ────────── */

/**
 * Record an email that was composed and sent outside the app
 * (e.g. via Outlook web compose redirect). No SMTP call is made.
 */
export async function logSentEmail({ candidateId, recipientEmail, senderEmail, subject, provider = 'outlook' }) {
  const params = {
    candidate_id:    candidateId  || 0,
    recipient_email: recipientEmail || '',
    sender_email:    senderEmail  || '',
    subject:         subject      || '',
    provider,
  }
  const res = await api.post('/email/log', null, { params })
  return res.data
}

/* ── Email History ───────────────────────────────────────────── */

/**
 * Fetch all emails sent by the current user (user-level history).
 * @param {Object} opts - provider, dateRange, dateFrom, dateTo, limit, offset
 */
export async function getUserEmailHistory({
  provider,
  dateRange,
  dateFrom,
  dateTo,
  limit = 50,
  offset = 0,
} = {}) {
  const params = { limit, offset }
  if (provider) params.provider = provider
  if (dateRange) params.date_range = dateRange
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  const res = await api.get('/email/history', { params })
  return res.data
}

export async function getEmailHistory(candidateId, { limit = 50, offset = 0, provider } = {}) {
  console.log('emailApi — getEmailHistory for candidateId:', candidateId, 'provider:', provider)
  const params = { limit, offset }
  if (provider) params.provider = provider
  const res = await api.get(`/email/history/${candidateId}`, { params })
  console.log('emailApi — getEmailHistory response:', res.data)
  return res.data
}

export async function getEmailCount(candidateId) {
  const res = await api.get(`/email/history/${candidateId}/count`)
  return res.data
}

/* ── Attachments ─────────────────────────────────────────────── */

export async function getEmailAttachments(emailId) {
  const res = await api.get(`/email/attachments/${emailId}`)
  return res.data
}

/* ── Email Templates ─────────────────────────────────────────── */

export async function createEmailTemplate(payload) {
  const res = await api.post('/email/templates', payload)
  return res.data
}

export async function listEmailTemplates() {
  const res = await api.get('/email/templates')
  return res.data
}

export async function getEmailTemplate(templateId) {
  const res = await api.get(`/email/templates/${templateId}`)
  return res.data
}

export async function updateEmailTemplate(templateId, payload) {
  const res = await api.put(`/email/templates/${templateId}`, payload)
  return res.data
}

export async function deleteEmailTemplate(templateId) {
  const res = await api.delete(`/email/templates/${templateId}`)
  return res.data
}

export async function previewEmailTemplate(templateId, candidateData) {
  const res = await api.post(`/email/templates/${templateId}/preview`, {
    candidate_data: candidateData,
  })
  return res.data
}

/* ── Contact Person ↔ Template Mapping ───────────────────────── */

export async function getCPTemplates(contactPersonId) {
  const res = await api.get(`/email/templates/contact-person/${contactPersonId}`)
  return res.data
}

export async function assignCPTemplate(contactPersonId, templateId) {
  const res = await api.post(`/email/templates/contact-person/${contactPersonId}`, {
    template_id: templateId,
  })
  return res.data
}

export async function unassignCPTemplate(contactPersonId, templateId) {
  const res = await api.delete(`/email/templates/contact-person/${contactPersonId}/${templateId}`)
  return res.data
}

/* ── User Email Settings ─────────────────────────────────────── */

export async function getEmailSettings() {
  const res = await api.get('/email/settings')
  return res.data
}

export async function getEmailSettingByProvider(provider) {
  const res = await api.get(`/email/settings/${provider}`)
  return res.data
}

export async function saveEmailSetting(payload) {
  const res = await api.post('/email/settings', payload)
  return res.data
}

export async function setDefaultProvider(provider) {
  const res = await api.put(`/email/settings/${provider}/set-default`)
  return res.data
}

export async function disconnectProvider(provider) {
  const res = await api.delete(`/email/settings/${provider}`)
  return res.data
}

export async function testEmailConnection(payload) {
  const res = await api.post('/email/settings/test-connection', payload)
  return res.data
}

/* ── OAuth2 (Outlook) ────────────────────────────────────────── */

export async function getOAuth2Status() {
  const res = await api.get('/email/oauth2/status')
  return res.data
}

export async function getOAuth2AuthorizeUrl() {
  const res = await api.get('/email/oauth2/authorize')
  return res.data
}

export async function disconnectOAuth2() {
  const res = await api.post('/email/oauth2/disconnect')
  return res.data
}
