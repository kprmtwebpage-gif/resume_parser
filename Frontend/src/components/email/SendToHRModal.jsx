import { useState, useEffect, useCallback, useMemo } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { fetchCandidates } from '../../services/api'
import {
  getCPTemplates,
  listEmailTemplates,
  previewEmailTemplate,
  sendEmail,
} from '../../services/emailApi'
import { prepareEmailHtml } from '../../services/emailHtmlUtils'

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'align', 'list', 'bullet', 'link',
]

/**
 * 3-step modal: Select Candidate → Select Template → Preview & Send
 * Props:
 *  - contactPerson: { id, first_name, last_name, email }
 *  - onClose: () => void
 *  - onSent: () => void
 */
export default function SendToHRModal({ contactPerson, onClose, onSent }) {
  const [step, setStep] = useState(1)

  // Step 1 — candidate search
  const [candidateQuery, setCandidateQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  // Step 2 — template selection
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [templatesLoading, setTemplatesLoading] = useState(false)

  // Step 3 — preview & send
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)

  const cpName = [contactPerson.first_name, contactPerson.last_name].filter(Boolean).join(' ') || 'Contact'
  const cpEmail = contactPerson.email

  // ── Step 1: search candidates ────────────────────────────────
  const searchCandidates = useCallback(async () => {
    if (!candidateQuery.trim()) { setCandidates([]); return }
    setSearchLoading(true)
    try {
      const data = await fetchCandidates({ q: candidateQuery, limit: 20, offset: 0 })
      setCandidates(data.candidates || data || [])
    } catch (err) {
      console.error('Candidate search failed:', err)
    } finally {
      setSearchLoading(false)
    }
  }, [candidateQuery])

  useEffect(() => {
    const timer = setTimeout(searchCandidates, 400)
    return () => clearTimeout(timer)
  }, [searchCandidates])

  const pickCandidate = (c) => {
    setSelectedCandidate(c)
    setStep(2)
  }

  // ── Step 2: load mapped templates ────────────────────────────
  useEffect(() => {
    if (step !== 2) return
    let cancelled = false
    const load = async () => {
      setTemplatesLoading(true)
      try {
        let mapped = await getCPTemplates(contactPerson.id)
        if (!mapped || mapped.length === 0) {
          mapped = await listEmailTemplates()
        }
        if (!cancelled) setTemplates(mapped)
      } catch (err) {
        console.error('Failed to load templates:', err)
      } finally {
        if (!cancelled) setTemplatesLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [step, contactPerson.id])

  const pickTemplate = async (t) => {
    setSelectedTemplate(t)
    setStep(3)
    setPreviewLoading(true)
    try {
      const candidateData = buildCandidateData(selectedCandidate)
      const preview = await previewEmailTemplate(t.id, candidateData)
      setSubject(preview.subject)
      setBody(preview.body)
    } catch (err) {
      console.error('Preview failed:', err)
      setSubject(t.subject)
      setBody(t.body)
    } finally {
      setPreviewLoading(false)
    }
  }

  // ── Step 3: send email ───────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!cpEmail) { alert('Contact person has no email address'); return }
    if (!subject.trim() || !body.trim()) { alert('Subject and body are required'); return }
    setSending(true)
    try {
      await sendEmail({
        candidateId: selectedCandidate.id,
        recipientEmail: cpEmail,
        subject,
        body: prepareEmailHtml(body),
        provider: 'gmail',
      })
      onSent?.()
      onClose()
    } catch (err) {
      console.error('Send failed:', err)
      alert(err?.response?.data?.detail || 'Failed to send email')
    } finally {
      setSending(false)
    }
  }, [cpEmail, subject, body, selectedCandidate, onSent, onClose])

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ color: [] }],
        [{ align: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
      ],
    },
    clipboard: { matchVisual: false },
  }), [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '14px',
        width: '100%', maxWidth: step === 3 ? '720px' : '540px',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        transition: 'max-width 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Send Email to {cpName}
            </h3>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{cpEmail || 'No email'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1, 2, 3].map((s) => (
                <div key={s} style={{
                  width: '24px', height: '4px', borderRadius: '2px',
                  backgroundColor: s <= step ? '#2563eb' : '#e2e8f0',
                }} />
              ))}
            </div>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8' }}>
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── STEP 1: Select Candidate ───────────────────────── */}
          {step === 1 && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '12px', textTransform: 'uppercase' }}>
                Step 1 — Select Candidate
              </div>
              <input type="text" value={candidateQuery} onChange={(e) => setCandidateQuery(e.target.value)}
                placeholder="Search by name, email, or keyword..."
                autoFocus
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
              />
              {searchLoading && <div style={{ color: '#94a3b8', fontSize: '13px' }}>Searching...</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
                {candidates.map((c) => (
                  <button key={c.id} onClick={() => pickCandidate(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#dbeafe',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', color: '#2563eb', fontWeight: 600, flexShrink: 0,
                    }}>
                      {(c.first_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                        {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {c.email || 'No email'} • {c.phone || 'No phone'}
                      </div>
                    </div>
                  </button>
                ))}
                {!searchLoading && candidateQuery && candidates.length === 0 && (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    No candidates found.
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── STEP 2: Select Template ────────────────────────── */}
          {step === 2 && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>
                Step 2 — Select Template
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px' }}>
                Candidate: <strong style={{ color: '#1e293b' }}>{[selectedCandidate.first_name, selectedCandidate.last_name].filter(Boolean).join(' ')}</strong>
              </div>
              {templatesLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading templates...</div>
              ) : templates.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                  No templates available. Create one in Admin → Email Templates.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => pickTemplate(t)}
                      style={{
                        padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0',
                        borderRadius: '10px', cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Subject: {t.subject}</div>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setStep(1)}
                style={{ marginTop: '14px', background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
                ← Back to candidate selection
              </button>
            </>
          )}

          {/* ── STEP 3: Preview & Send ─────────────────────────── */}
          {step === 3 && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>
                Step 3 — Preview & Send
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px' }}>
                To: <strong style={{ color: '#1e293b' }}>{cpEmail}</strong> • Template: <strong style={{ color: '#1e293b' }}>{selectedTemplate.name}</strong>
              </div>

              {previewLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading preview...</div>
              ) : (
                <>
                  {/* Subject */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Subject</label>
                    <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Body editor */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Body</label>
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                      <ReactQuill
                        theme="snow"
                        value={body}
                        onChange={setBody}
                        modules={modules}
                        formats={QUILL_FORMATS}
                        style={{ minHeight: '220px' }}
                      />
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setStep(2)}
                  style={{ padding: '10px 20px', backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  ← Back
                </button>
                <button onClick={handleSend} disabled={sending || previewLoading}
                  style={{ padding: '10px 24px', backgroundColor: sending ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer' }}>
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Build a flat key-value map from candidate data for template variable substitution.
 */
function buildCandidateData(candidate) {
  if (!candidate) return {}

  const name = [candidate.first_name, candidate.last_name].filter(Boolean).join(' ')

  // Education: try to flatten structured education into a string
  let education = ''
  if (candidate.education_structured) {
    const eduArr = typeof candidate.education_structured === 'string'
      ? JSON.parse(candidate.education_structured)
      : candidate.education_structured
    education = (Array.isArray(eduArr) ? eduArr : [])
      .map((e) => [e.degree, e.institution, e.grad_year].filter(Boolean).join(', '))
      .join(' | ')
  }

  return {
    candidate_name: name,
    location: candidate.address || candidate.location || '',
    phone: candidate.phone || '',
    email: candidate.email || '',
    linkedin: candidate.linkedin || '',
    experience: candidate.years_of_experience || '',
    us_experience: candidate.us_experience || '',
    work_auth: candidate.work_authorization || '',
    visa_validity: candidate.visa_validity || '',
    passport: candidate.passport_number || '',
    rate: candidate.rate || '',
    education: education,
    availability: candidate.availability || '',
  }
}
