import { useState, useRef, useEffect, useCallback } from 'react'
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { api } from '../services/api'
import Autocomplete from './Autocomplete'
import Dropdown from './Dropdown'
import RichTextEditor from './RichTextEditor'
import TagInput from './TagInput'
import './CreateJobModal.css'
import './Autocomplete.css'

/* ── Draft autosave interval (Feature 2) ── */
const AUTOSAVE_INTERVAL = 5000 // 5 seconds

/* ── Datasets ── */

const IT_JOB_TITLES = [
  'Systems Analyst',
  'Software Developer',
  'Database Administrator',
  'Web Developer',
  'Support Specialist',
  'Cloud Architect',
  'Project Manager',
  'Network Administrator',
  'Data Scientist',
  'Application Developer',
  'Cloud Engineer',
  'Programmer',
  'Data Quality Manager',
  'Front End Developer',
  'Back End Developer',
  'SQL Developer / DB Developer',
]

const JOB_CATEGORIES = [
  'Intern',
  'Junior',
  'Middle',
  'Senior',
  'Team Lead',
  'Architect',
  'Software Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Developer',
  'DevOps Engineer',
  'QA Engineer',
  'Data Engineer',
  'Data Scientist',
  'Machine Learning Engineer',
  'Product Manager',
  'Project Manager',
  'Scrum Master',
  'Agile Coach',
  'Business Analyst',
  'UI Designer',
  'UX Designer',
  'UI/UX Designer',
  'Graphic Designer',
  'Product Designer',
  'CTO',
  'CEO',
  'COO',
  'CFO',
  'CIO',
  'CMO',
  'VP of Engineering',
  'Head of Department',
  'Technical Lead',
  'Engineering Manager',
  'Mobile Developer',
  'Android Developer',
  'iOS Developer',
  'Cloud Engineer',
  'Cloud Architect',
  'Security Engineer',
  'Security Analyst',
  'Cybersecurity Specialist',
  'Database Administrator',
  'Database Developer',
  'Network Administrator',
  'Network Engineer',
  'Systems Administrator',
  'Systems Engineer',
  'Site Reliability Engineer',
  'Platform Engineer',
  'Solutions Architect',
  'Enterprise Architect',
  'Technical Architect',
  'Integration Specialist',
  'API Developer',
  'Automation Engineer',
  'Test Engineer',
  'QA Automation Engineer',
  'Performance Engineer',
  'Release Manager',
  'Configuration Manager',
  'IT Support Specialist',
  'Help Desk Analyst',
  'Technical Support Engineer',
  'Customer Success Engineer',
  'Sales Engineer',
  'Pre-Sales Consultant',
  'Technical Writer',
  'Documentation Specialist',
  'Research Scientist',
  'ML Engineer',
  'AI Engineer',
  'Data Analyst',
  'Business Intelligence Analyst',
  'ETL Developer',
  'Big Data Engineer',
  'Blockchain Developer',
  'Smart Contract Developer',
  'Game Developer',
  'Unity Developer',
  'Unreal Developer',
  'Embedded Systems Engineer',
  'Firmware Engineer',
  'Hardware Engineer',
  'FPGA Engineer',
  'Robotics Engineer',
  'Computer Vision Engineer',
  'NLP Engineer',
  'Voice Engineer',
  'Application Support Analyst',
]

const QUALIFICATIONS = [
  "Bachelor's Degree",
  "Master's Degree",
  'Masters in Computer Science',
  'Masters in Information Technology',
  'Masters in Computer Information Systems',
  'B.Tech Computer Science',
  'B.Sc Computer Science',
  'MCA',
  'MBA IT',
  'PhD Computer Science',
]

const LOCATIONS = [
  'New York, USA',
  'Los Angeles, USA',
  'Chicago, USA',
  'Dallas, USA',
  'Florida, USA',
  'Texas, USA',
  'California, USA',
  'Washington, USA',
  'Boston, USA',
  'Seattle, USA',
  'San Francisco, USA',
  'Austin, USA',
  'Remote',
  'Hybrid',
]

const IT_SKILLS = [
  'Java',
  'JavaScript',
  'Python',
  'SQL',
  'React',
  'React.js',
  'Node.js',
  'Spring Boot',
  'Angular',
  'Vue.js',
  'Docker',
  'Kubernetes',
  'AWS',
  'Azure',
  'Google Cloud Platform',
  'DevOps',
  'CI/CD',
  'Jenkins',
  'Git',
  'GitHub',
  'GitLab',
  'C++',
  'C#',
  '.NET',
  'ASP.NET',
  'Machine Learning',
  'Data Science',
  'TensorFlow',
  'PyTorch',
  'MongoDB',
  'PostgreSQL',
  'MySQL',
  'Redis',
  'Elasticsearch',
  'Microservices',
  'REST API',
  'GraphQL',
  'TypeScript',
  'HTML',
  'CSS',
  'Sass',
  'Tailwind CSS',
  'Bootstrap',
  'Redux',
  'jQuery',
  'Express.js',
  'Django',
  'Flask',
  'FastAPI',
  'Ruby on Rails',
  'PHP',
  'Laravel',
  'WordPress',
  'Agile',
  'Scrum',
  'JIRA',
  'Linux',
  'Unix',
  'Bash',
  'PowerShell',
  'Terraform',
  'Ansible',
  'Selenium',
  'JUnit',
  'Jest',
  'Pytest',
  'ETL',
  'Data Warehousing',
  'Big Data',
  'Hadoop',
  'Spark',
  'Kafka',
  'RabbitMQ',
  'Snowflake',
  'Tableau',
  'Power BI',
  'Data Analysis',
  'Statistical Analysis',
  'Data Visualization',
  'Pandas',
  'NumPy',
  'Scikit-learn',
  'R',
  'Scala',
  'Go',
  'Rust',
  'Swift',
  'Kotlin',
  'Flutter',
  'React Native',
  'iOS Development',
  'Android Development',
  'Mobile Development',
  'API Development',
  'System Design',
  'Software Architecture',
  'Test Automation',
  'Quality Assurance',
  'Cybersecurity',
  'Network Security',
  'Penetration Testing',
  'OWASP',
  'Blockchain',
  'Solidity',
  'Smart Contracts',
  'OAuth',
  'JWT',
  'Authentication',
  'SAP',
  'Salesforce',
  'ServiceNow',
  'Splunk',
  'ELK Stack',
  'Grafana',
  'Prometheus',
  'New Relic',
]

const DEPARTMENTS = [
  'Tech',
  'Analytics',
  'Functional',
  'Marketing',
  'Product',
  'Design',
  'Support',
  'Sales',
  'Legal',
]

const PRIORITIES = ['High', 'Normal', 'Low']

const STATUSES = ['DRAFT', 'POSTED', 'HOLD', 'CLOSED']

const EMPLOYMENT_TYPES = [
  'Full Time',
  'Part Time',
  'Contract',
  'Temporary',
  'Temp to Perm',
  'Volunteer',
  'Remote Work',
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']

/* ── Experience options (Feature 9) ── */
const EXPERIENCE_OPTIONS = [
  'Fresher',
  '1 year',
  '2 years',
  '3 years',
  '4 years',
  '5 years',
  '6 years',
  '7 years',
  '8 years',
  '9 years',
  '10 years',
  '11 years',
  '12 years',
  '13 years',
  '14 years',
  '15 years',
  '15+ years',
  '20+ years',
]

/* ── Initial form state ── */

const INITIAL_FORM = {
  title: '',
  company: '',
  priority: 'Normal',
  status: 'DRAFT',
  location: [], // Changed to array for multi-select
  department: '',
  category: '',
  employment_type: '',
  experience: '', // Feature 9: Experience field
  skills: [], // Changed to array for multi-select
  description: '',
  comments: '',
  customer: '',
  assignee: '',
  qualification: '',
  currency: 'USD',
  salary_start: '',
  salary_end: '',
  positions: '1',
  reason: '',
  removePhoto: false, // Feature 10: Flag for logo removal
}

/* ── Validation helpers ── */

const REQUIRED_FIELDS = ['title', 'company', 'location', 'employment_type']

function getValidationErrors(form) {
  const errors = {}
  if (!form.title.trim()) errors.title = 'Job Title is required'
  if (!form.company.trim()) errors.company = 'Company is required'
  if (!form.location || form.location.length === 0) errors.location = 'At least one location is required'
  if (!form.employment_type.trim()) errors.employment_type = 'Employment Type is required'
  return errors
}

/* ========================================================================= */

/**
 * CreateJobModal
 *
 * Props:
 *  - isOpen      : boolean
 *  - onClose     : () => void
 *  - mode        : 'create' | 'edit' | 'review'   (default 'create')
 *  - initialData : job object to prefill in edit / review mode
 *  - onSave      : (jobData, mode) => void         called on submit
 *  - onDelete    : (job) => void                   called to archive job
 *  - onDuplicate : (job) => void                   called to duplicate job
 */
export default function CreateJobModal({
  isOpen,
  onClose,
  mode = 'create',
  initialData = null,
  onSave,
  onDelete,
  onDuplicate,
}) {
  const [formData, setFormData] = useState({ ...INITIAL_FORM })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [salaryError, setSalaryError] = useState('')
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [jobDescription, setJobDescription] = useState('')
  const [comments, setComments] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const fileInputRef = useRef(null)
  
  /* ── Draft autosave state (Feature 2) ── */
  const [draftId, setDraftId] = useState(null)
  const [lastAutosave, setLastAutosave] = useState(null)
  const [isAutosaving, setIsAutosaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const autosaveTimerRef = useRef(null)
  const submitGuardRef = useRef(false)

  const isReview = mode === 'review'
  const isEdit = mode === 'edit'

  /* Populate form when opening in edit / review mode */
  useEffect(() => {
    if (isOpen && initialData && (isEdit || isReview)) {
      const merged = { ...INITIAL_FORM }
      Object.keys(INITIAL_FORM).forEach((key) => {
        if (initialData[key] !== undefined && initialData[key] !== null) {
          // Handle array fields
          if (key === 'location' || key === 'skills') {
            if (Array.isArray(initialData[key])) {
              merged[key] = initialData[key]
            } else if (typeof initialData[key] === 'string') {
              // Split by pipe separator (new); fall back to comma for old data
              const raw = initialData[key]
              merged[key] = raw.includes(' | ')
                ? raw.split(' | ').map((s) => s.trim()).filter((s) => s)
                : raw.split(',').map((s) => s.trim()).filter((s) => s)
            } else {
              merged[key] = []
            }
          } else {
            merged[key] = String(initialData[key])
          }
        }
      })
      setFormData(merged)
      // Load existing photo from backend if available
      setLogoPreview(initialData.photo_url ? `${import.meta.env.VITE_API_BASE_URL || ''}${initialData.photo_url}` : null)
      setLogoFile(null)
      setSalaryError('')
      setErrors({})
      setTouched({})
      setJobDescription(merged.description || '')
      setComments(merged.comments || '')
      setIsDirty(false)
      setShowConfirm(false)
    } else if (isOpen && mode === 'create') {
      setFormData({ ...INITIAL_FORM })
      setLogoPreview(null)
      setLogoFile(null)
      setSalaryError('')
      setErrors({})
      setTouched({})
      setJobDescription('')
      setComments('')
      setIsDirty(false)
      setShowConfirm(false)
    }
  }, [isOpen, mode, initialData, isEdit, isReview])

  /* ESC key handler and body scroll lock */
  useEffect(() => {
    if (!isOpen) return

    // Lock body scroll
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // ESC key handler
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (!isReview && isDirty) {
          setShowConfirm(true)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleEsc)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose, isDirty, isReview])

  /* ── Draft autosave effect (Feature 2) ── */
  const performAutosave = useCallback(async () => {
    if (isReview || !isDirty || isAutosaving) return
    
    try {
      setIsAutosaving(true)
      
      const fieldMapping = {
        title: 'job_title',
        description: 'job_description',
        qualification: 'required_qualification',
        positions: 'open_positions',
      }
      
      // Backend draft endpoints use Form() params, so send FormData
      const fd = new FormData()
      for (const [key, value] of Object.entries(formData)) {
        if (key === 'removePhoto') continue
        const apiKey = fieldMapping[key] || key
        if (Array.isArray(value)) {
          if (value.length > 0) fd.append(apiKey, value.join(' | '))
        } else if (value !== null && value !== undefined && value !== '') {
          fd.append(apiKey, String(value))
        }
      }
      fd.append('job_description', jobDescription || '')
      fd.append('comments', comments || '')
      
      if (mode === 'create' && !draftId) {
        // Create new draft
        const { data } = await api.post('/api/job-projects/draft', fd)
        setDraftId(data.id)
      } else if (mode === 'create' && draftId) {
        // Update existing draft
        await api.post(`/api/job-projects/${draftId}/draft`, fd)
      } else if (isEdit && initialData?.id) {
        // Update existing job as draft
        await api.post(`/api/job-projects/${initialData.id}/draft`, fd)
      }
      
      setLastAutosave(new Date())
      setIsDirty(false)
    } catch (err) {
      console.error('Draft autosave failed:', err)
    } finally {
      setIsAutosaving(false)
    }
  }, [isReview, isDirty, isAutosaving, formData, jobDescription, comments, mode, draftId, isEdit, initialData])
  
  useEffect(() => {
    if (!isOpen || isReview) return
    
    // Clear any existing timer
    if (autosaveTimerRef.current) {
      clearInterval(autosaveTimerRef.current)
    }
    
    // Set up autosave interval
    autosaveTimerRef.current = setInterval(() => {
      if (isDirty) {
        performAutosave()
      }
    }, AUTOSAVE_INTERVAL)
    
    return () => {
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current)
      }
    }
  }, [isOpen, isReview, isDirty, performAutosave])
  
  // Reset draft ID when modal opens fresh
  useEffect(() => {
    if (isOpen && mode === 'create') {
      setDraftId(null)
      setLastAutosave(null)
    }
  }, [isOpen, mode])

  if (!isOpen) return null

  /* ── Modal header text ── */
  const headerText =
    isReview
      ? 'Review Job'
      : isEdit
        ? 'Edit Job'
        : 'Create a new job'

  /* ── Handlers ── */

  const handleChange = (e) => {
    if (isReview) return
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
    setIsDirty(true)
  }

  const handleFieldChange = (fieldName) => (valOrEvent) => {
    if (isReview) return
    // Autocomplete & Dropdown pass event-like {target:{value}} objects;
    // TagInput passes arrays directly. Handle both.
    const value =
      valOrEvent && typeof valOrEvent === 'object' && !Array.isArray(valOrEvent) && valOrEvent.target
        ? valOrEvent.target.value
        : valOrEvent
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
    if (touched[fieldName]) setErrors((prev) => ({ ...prev, [fieldName]: undefined }))
    setIsDirty(true)
  }

  const handleSalaryChange = (field) => (e) => {
    if (isReview) return
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setFormData((prev) => {
      const next = { ...prev, [field]: raw }
      if (next.salary_start && next.salary_end) {
        setSalaryError(
          Number(next.salary_start) > Number(next.salary_end)
            ? 'Start salary cannot exceed end salary'
            : '',
        )
      } else {
        setSalaryError('')
      }
      return next
    })
    setIsDirty(true)
  }

  const handlePositionsChange = (e) => {
    if (isReview) return
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setFormData((prev) => ({ ...prev, positions: raw }))
    setIsDirty(true)
  }

  const handleLogoChange = (e) => {
    if (isReview) return
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.')
      return
    }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(reader.result)
    reader.readAsDataURL(file)
    setIsDirty(true)
  }

  const removeLogo = () => {
    if (isReview) return
    setLogoFile(null)
    setLogoPreview(null)
    // Feature 10: Mark for removal on save
    setFormData((prev) => ({ ...prev, removePhoto: true }))
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsDirty(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isReview || isSubmitting || submitGuardRef.current) return

    // Mark all required as touched
    const allTouched = {}
    REQUIRED_FIELDS.forEach((f) => (allTouched[f] = true))
    setTouched(allTouched)

    const validationErrors = getValidationErrors(formData)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    if (salaryError) return

    // Ref-based guard prevents double-submit (state updates are async)
    submitGuardRef.current = true
    setIsSubmitting(true)

    // Stop autosave timer to prevent race with draft creation during submit
    if (autosaveTimerRef.current) {
      clearInterval(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    const payload = {
      ...formData,
      description: jobDescription,
      comments,
      logoFile: logoFile || null,
      logoPreview: logoPreview || null,
      _draftId: draftId || null,
    }

    try {
      if (onSave) {
        await onSave(payload, mode)
      }
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      submitGuardRef.current = false
    }

    if (mode === 'create') {
      setFormData({ ...INITIAL_FORM })
      setErrors({})
      setTouched({})
      removeLogo()
    }
    setJobDescription('')
    setComments('')
    setIsDirty(false)
    setShowConfirm(false)
    setIsSubmitting(false)
    onClose()
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      if (!isReview && isDirty) {
        setShowConfirm(true)
      } else {
        onClose()
      }
    }
  }

  const handleCloseRequest = () => {
    if (!isReview && isDirty) {
      setShowConfirm(true)
    } else {
      onClose()
    }
  }

  const handleConfirmSave = () => {
    setShowConfirm(false)
    // simulate submit click
    const fakeEvent = { preventDefault: () => {} }
    handleSubmit(fakeEvent)
  }

  const handleDiscard = () => {
    setShowConfirm(false)
    setIsDirty(false)
    onClose()
  }

  const fieldError = (name) =>
    touched[name] && errors[name] ? <span className="cjm-field-error">{errors[name]}</span> : null

  /* ── Render ── */

  return (
    <div className="cjm-overlay" onClick={handleOverlayClick}>
      <div className="cjm-modal">
        {/* ── Header ── */}
        <div className="cjm-header">
          <div className="cjm-header-left">
            <h2 className="cjm-title">{headerText}</h2>
            {isReview && <span className="cjm-review-badge">READ ONLY</span>}
            {/* Autosave indicator (Feature 2) */}
            {!isReview && (
              <span className="cjm-autosave-status">
                {isAutosaving ? (
                  <span className="cjm-autosave--saving">Saving...</span>
                ) : lastAutosave ? (
                  <span className="cjm-autosave--saved">
                    Draft saved at {lastAutosave.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : isDirty ? (
                  <span className="cjm-autosave--unsaved">Unsaved changes</span>
                ) : null}
              </span>
            )}
          </div>
          <button type="button" className="cjm-close-btn" onClick={handleCloseRequest} aria-label="Close modal">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <form className="cjm-body" onSubmit={handleSubmit} noValidate>

          {/* SECTION 1 — Title + Company + Logo */}
          <div className="cjm-top-row">
            <div className="cjm-top-left">
              {/* Job Title */}
              <div className="cjm-field">
                <label className="cjm-label">Job Title <span className="cjm-req">*</span></label>
                {isReview ? (
                  <div className="cjm-readonly-value">{formData.title || '—'}</div>
                ) : (
                  <Autocomplete
                    name="title"
                    value={formData.title}
                    onChange={handleFieldChange('title')}
                    suggestions={IT_JOB_TITLES}
                    placeholder="Job Title"
                    allowFreeText
                    highlightMatch
                  />
                )}
                {fieldError('title')}
              </div>

              {/* Company */}
              <div className="cjm-field">
                <label className="cjm-label">Company <span className="cjm-req">*</span></label>
                {isReview ? (
                  <div className="cjm-readonly-value">{formData.company || '—'}</div>
                ) : (
                  <input
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="cjm-input"
                    placeholder="Company"
                  />
                )}
                {fieldError('company')}
              </div>
            </div>

            {/* Logo */}
            <div className="cjm-top-logo">
              {logoPreview ? (
                <div className="cjm-logo-preview-wrapper">
                  <img src={logoPreview} alt="Logo preview" className="cjm-logo-preview" />
                  {!isReview && (
                    <button type="button" className="cjm-logo-remove" onClick={removeLogo}>
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                !isReview && (
                  <button
                    type="button"
                    className="cjm-logo-placeholder"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <PhotoIcon className="w-8 h-8 text-neutral-400" />
                    <span className="cjm-logo-text">Upload photo</span>
                  </button>
                )
              )}
              {!isReview && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              )}
            </div>
          </div>

          {/* SECTION 2 — Priority & Status */}
          <div className="cjm-grid">
            <div className="cjm-field">
              <label className="cjm-label">Priority</label>
              {isReview ? (
                <div className="cjm-readonly-value">{formData.priority || '—'}</div>
              ) : (
                <Dropdown
                  name="priority"
                  value={formData.priority}
                  onChange={handleFieldChange('priority')}
                  options={PRIORITIES}
                  placeholder="Select priority"
                />
              )}
            </div>
            <div className="cjm-field">
              <label className="cjm-label">Status</label>
              {isReview ? (
                <div className="cjm-readonly-value">{formData.status || '—'}</div>
              ) : (
                <Dropdown
                  name="status"
                  value={formData.status}
                  onChange={handleFieldChange('status')}
                  options={STATUSES}
                  placeholder="Select status"
                />
              )}
            </div>

            {/* Location */}
            <div className="cjm-field">
              <label className="cjm-label">Location <span className="cjm-req">*</span></label>
              {isReview ? (
                <div className="cjm-readonly-tags">
                  {formData.location && formData.location.length > 0
                    ? formData.location.map((loc, idx) => (
                        <span key={idx} className="cjm-readonly-tag">
                          {loc}
                        </span>
                      ))
                    : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>—</span>}
                </div>
              ) : (
                <TagInput
                  name="location"
                  tags={formData.location}
                  onChange={(tags) => {
                    setFormData((prev) => ({ ...prev, location: tags }))
                    if (touched.location) setErrors((prev) => ({ ...prev, location: undefined }))
                  }}
                  suggestions={LOCATIONS}
                  placeholder="Choose a location..."
                  required
                />
              )}
              {fieldError('location')}
            </div>

            {/* Department */}
            <div className="cjm-field">
              <label className="cjm-label">Department</label>
              {isReview ? (
                <div className="cjm-readonly-value">{formData.department || '—'}</div>
              ) : (
                <Dropdown
                  name="department"
                  value={formData.department}
                  onChange={handleFieldChange('department')}
                  options={DEPARTMENTS}
                  placeholder="Department"
                />
              )}
            </div>

            {/* Quantity */}
            <div className="cjm-field">
              <label className="cjm-label">Number of Open Positions</label>
              {isReview ? (
                <div className="cjm-readonly-value">{formData.positions || '—'}</div>
              ) : (
                <input
                  name="positions"
                  type="text"
                  inputMode="numeric"
                  value={formData.positions}
                  onChange={handlePositionsChange}
                  className="cjm-input"
                  placeholder="Quantity of required employees"
                  min="1"
                />
              )}
            </div>

            {/* Reason */}
            <div className="cjm-field">
              <label className="cjm-label">Reason</label>
              {isReview ? (
                <div className="cjm-readonly-value">{formData.reason || '—'}</div>
              ) : (
                <Dropdown
                  name="reason"
                  value={formData.reason}
                  onChange={handleFieldChange('reason')}
                  options={['New Position', 'Replacement', 'Expansion', 'Contract']}
                  placeholder="Reason"
                />
              )}
            </div>

            {/* Salary Range */}
            <div className="cjm-salary-row">
              <div className="cjm-salary-field">
                <label className="cjm-label">Currency ($)</label>
                {isReview ? (
                  <div className="cjm-readonly-value">{formData.currency || '—'}</div>
                ) : (
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="cjm-currency-select"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="cjm-salary-field">
                <label className="cjm-label">Salary Start ($ per year)</label>
                {isReview ? (
                  <div className="cjm-readonly-value">{formData.salary_start ? `${formData.currency} ${Number(formData.salary_start).toLocaleString()}` : '—'}</div>
                ) : (
                  <div className="cjm-salary-input-wrapper">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.salary_start}
                      onChange={handleSalaryChange('salary_start')}
                      className="cjm-salary-input cjm-salary-input--no-prefix"
                      placeholder="Salary ($ per year)"
                    />
                  </div>
                )}
              </div>
              <div className="cjm-salary-field">
                <label className="cjm-label">Salary End ($ per year)</label>
                {isReview ? (
                  <div className="cjm-readonly-value">{formData.salary_end ? `${formData.currency} ${Number(formData.salary_end).toLocaleString()}` : '—'}</div>
                ) : (
                  <div className="cjm-salary-input-wrapper">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.salary_end}
                      onChange={handleSalaryChange('salary_end')}
                      className="cjm-salary-input cjm-salary-input--no-prefix"
                      placeholder="Salary End"
                    />
                  </div>
                )}
              </div>
              {salaryError && <p className="cjm-salary-error">{salaryError}</p>}
            </div>

            {/* Category */}
            <div className="cjm-field">
              <label className="cjm-label">Category</label>
              {isReview ? (
                <div className="cjm-readonly-value">{formData.category || '—'}</div>
              ) : (
                <Autocomplete
                  name="category"
                  value={formData.category}
                  onChange={handleFieldChange('category')}
                  suggestions={JOB_CATEGORIES}
                  placeholder="Choose a category"
                  allowFreeText
                  highlightMatch
                />
              )}
            </div>

            {/* Experience (Feature 9) */}
            <div className="cjm-field">
              <label className="cjm-label">Experience</label>
              {isReview ? (
                <div className="cjm-readonly-value">{formData.experience || '—'}</div>
              ) : (
                <Autocomplete
                  name="experience"
                  value={formData.experience}
                  onChange={handleFieldChange('experience')}
                  suggestions={EXPERIENCE_OPTIONS}
                  placeholder="Select or type experience"
                  allowFreeText
                  highlightMatch
                />
              )}
            </div>

            {/* Employment Type */}
            <div className="cjm-field">
              <label className="cjm-label">Employment Type <span className="cjm-req">*</span></label>
              {isReview ? (
                <div className="cjm-readonly-value">{formData.employment_type || '—'}</div>
              ) : (
                <Dropdown
                  name="employment_type"
                  value={formData.employment_type}
                  onChange={handleFieldChange('employment_type')}
                  options={EMPLOYMENT_TYPES}
                  placeholder="Choose a employment type"
                  required
                />
              )}
              {fieldError('employment_type')}
            </div>

            {/* Skills */}
            <div className="cjm-field cjm-full">
              <label className="cjm-label">Skills</label>
              {isReview ? (
                <div className="cjm-readonly-tags">
                  {formData.skills && formData.skills.length > 0
                    ? formData.skills.map((skill, idx) => (
                        <span key={idx} className="cjm-readonly-tag">
                          {skill}
                        </span>
                      ))
                    : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>—</span>}
                </div>
              ) : (
                <TagInput
                  name="skills"
                  tags={formData.skills}
                  onChange={(tags) => setFormData((prev) => ({ ...prev, skills: tags }))}
                  suggestions={IT_SKILLS}
                  placeholder="Type skill name (e.g., JavaScript, Python, React...)"
                />
              )}
            </div>

            {/* Required Qualification */}
            <div className="cjm-field cjm-full cjm-field-qualification">
              <label className="cjm-label">Required Qualification</label>
              {isReview ? (
                <div className="cjm-readonly-value">{formData.qualification || '—'}</div>
              ) : (
                <Autocomplete
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleFieldChange('qualification')}
                  suggestions={QUALIFICATIONS}
                  placeholder="e.g. Bachelor's Degree"
                  allowFreeText
                  highlightMatch
                />
              )}
            </div>
          </div>

          {/* Job Description (Rich Text) */}
          <div className="cjm-field cjm-full cjm-field-description">
            <label className="cjm-label">Job Description</label>
            <RichTextEditor
              value={jobDescription}
              onChange={(html) => {
                setJobDescription(html)
                setFormData((p) => ({ ...p, description: html }))
                if (!isReview) setIsDirty(true)
              }}
              placeholder="Add job description here..."
              readOnly={isReview}
            />
          </div>

          {/* Comments (simple textarea with char counter) */}
          <div className="cjm-field cjm-full" style={{ marginTop: 16 }}>
            <label className="cjm-label">Comments</label>
            {isReview ? (
              <div className="cjm-input" style={{ minHeight: 60, whiteSpace: 'pre-wrap' }}>
                {comments || '—'}
              </div>
            ) : (
              <div className="cjm-textarea-wrap">
                <textarea
                  className="cjm-input cjm-textarea"
                  value={comments}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 100)
                    setComments(val)
                    setFormData((p) => ({ ...p, comments: val }))
                    if (!isReview) setIsDirty(true)
                  }}
                  placeholder="Add comments here..."
                  maxLength={100}
                  rows={3}
                />
                <span className="cjm-char-count">
                  {comments.length}/100
                </span>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="cjm-footer">
            <div className="cjm-footer-left">
              {!isReview && (
                <button type="submit" className="cjm-btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create and move individuals'}
                </button>
              )}
              <button type="button" className="cjm-btn-cancel" onClick={handleCloseRequest}>
                {isReview ? 'Close' : 'Cancel'}
              </button>
            </div>
            {isEdit && (onDuplicate || onDelete) && (
              <div className="cjm-footer-right">
                {onDuplicate && (
                  <button 
                    type="button" 
                    className="cjm-btn-secondary" 
                    onClick={() => onDuplicate(initialData)}
                  >
                    Copy Job
                  </button>
                )}
                {onDelete && (
                  <button 
                    type="button" 
                    className="cjm-btn-danger" 
                    onClick={() => {
                      if (window.confirm(`Move "${initialData?.title || 'this job'}" to Archive?\n\nYou can restore it later from the Archive.`)) {
                        onDelete(initialData)
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {showConfirm && (
            <div className="cjm-confirm-overlay" onClick={(e) => e.stopPropagation()}>
              <div className="cjm-confirm-dialog">
                <h3 className="cjm-confirm-title">Unsaved changes</h3>
                <p className="cjm-confirm-message">You have unsaved changes. Save before closing?</p>
                <div className="cjm-confirm-actions">
                  <button type="button" className="cjm-btn-submit" onClick={handleConfirmSave}>
                    Save Changes
                  </button>
                  <button type="button" className="cjm-btn-danger" onClick={handleDiscard}>
                    Discard
                  </button>
                  <button type="button" className="cjm-btn-cancel" onClick={() => setShowConfirm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
