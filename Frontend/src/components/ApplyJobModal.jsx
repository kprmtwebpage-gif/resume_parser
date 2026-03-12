import { useState, useRef, useCallback } from 'react'
import { XMarkIcon, CloudArrowUpIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { api } from '../services/api'

/**
 * ApplyJobModal - Modal for submitting job applications
 * 
 * Props:
 *  - job: Job data object
 *  - onClose: Function to close modal
 */
export default function ApplyJobModal({ job, onClose }) {
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    qualification: '',
    workAuthorization: '',
    domainExpert: '',
    techExperience: '',
    linkedInUrl: ''
  })
  
  // File state
  const [resumeFile, setResumeFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)
  
  // Captcha state
  const [captchaCode, setCaptchaCode] = useState(generateCaptcha())
  const [captchaInput, setCaptchaInput] = useState('')
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null) // 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('')

  // Generate simple captcha code
  function generateCaptcha() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Handle file drop
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (isValidFile(file)) {
        setResumeFile(file)
      }
    }
  }, [])

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  // Handle file select
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (isValidFile(file)) {
        setResumeFile(file)
      }
    }
  }

  // Validate file type
  const isValidFile = (file) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    const maxSize = 10 * 1024 * 1024 // 10MB
    
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Please upload a PDF or Word document')
      return false
    }
    
    if (file.size > maxSize) {
      setErrorMessage('File size must be less than 10MB')
      return false
    }
    
    setErrorMessage('')
    return true
  }

  // Refresh captcha
  const refreshCaptcha = () => {
    setCaptchaCode(generateCaptcha())
    setCaptchaInput('')
  }

  // Validate form
  const validateForm = () => {
    if (!formData.firstName.trim()) return 'First name is required'
    if (!formData.lastName.trim()) return 'Last name is required'
    if (!formData.email.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Invalid email format'
    if (!formData.phone.trim()) return 'Phone number is required'
    if (!resumeFile) return 'Please upload your resume'
    if (captchaInput.toLowerCase() !== captchaCode.toLowerCase()) return 'Invalid captcha code'
    return null
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }
    
    setIsSubmitting(true)
    setErrorMessage('')
    
    try {
      const submitData = new FormData()
      submitData.append('first_name', formData.firstName.trim())
      submitData.append('last_name', formData.lastName.trim())
      submitData.append('candidate_email', formData.email.trim())
      submitData.append('candidate_phone', formData.phone.trim())
      submitData.append('address', formData.address || '')
      submitData.append('education', formData.qualification || '')
      submitData.append('citizenship', formData.workAuthorization || '')
      submitData.append('experience', formData.techExperience || '0')
      submitData.append('tech_experience', formData.techExperience || '')
      submitData.append('domain_expert', formData.domainExpert || '')
      submitData.append('linkedin_url', formData.linkedInUrl || '')
      
      if (resumeFile) {
        submitData.append('resume', resumeFile)
      }
      
      // Use the correct endpoint: /api/job-projects/{job_id}/applications
      await api.post(`/api/job-projects/${job.id}/applications`, submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      setSubmitStatus('success')
    } catch (err) {
      console.error('Application submission failed:', err)
      if (err.response?.status === 409) {
        setErrorMessage('You have already applied for this job.')
      } else if (err.response?.data?.detail) {
        setErrorMessage(err.response.data.detail)
      } else {
        setErrorMessage('Failed to submit application. Please try again.')
      }
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Work authorization options
  const workAuthOptions = [
    'US Citizen',
    'Green Card',
    'H1B',
    'OPT/CPT',
    'H4 EAD',
    'L2 EAD',
    'TN Visa',
    'Other'
  ]

  // Success View
  if (submitStatus === 'success') {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-2xl max-w-md w-full p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your application for <strong>{job.job_title}</strong> at <strong>{job.company}</strong> has been submitted successfully.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">JOB APPLICATION</h2>
            <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded mt-1">
              JobId#{job.id?.toString().substring(0, 8)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto max-h-[calc(90vh-150px)]">
          <div className="space-y-3">
            {/* First Name */}
            <input
              type="text"
              name="firstName"
              placeholder="First Name"
              value={formData.firstName}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            
            {/* Last Name */}
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            
            {/* Address */}
            <input
              type="text"
              name="address"
              placeholder="Address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* Phone */}
            <input
              type="tel"
              name="phone"
              placeholder="Phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            
            {/* Email */}
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            
            {/* Qualification */}
            <input
              type="text"
              name="qualification"
              placeholder="Qualification"
              value={formData.qualification}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* Work Authorization */}
            <select
              name="workAuthorization"
              value={formData.workAuthorization}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-500"
            >
              <option value="">--Select Work Authorization Type--</option>
              {workAuthOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            
            {/* Domain Expert */}
            <input
              type="text"
              name="domainExpert"
              placeholder="Domain Expert"
              value={formData.domainExpert}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* Tech Experience */}
            <input
              type="text"
              name="techExperience"
              placeholder="Tech Experience"
              value={formData.techExperience}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* LinkedIn URL (Optional) */}
            <input
              type="text"
              name="linkedInUrl"
              placeholder="LinkedIn URL (Optional)"
              value={formData.linkedInUrl}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* File Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-orange-300 bg-orange-50/30'
              }`}
            >
              {resumeFile ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-gray-700">{resumeFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setResumeFile(null)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-blue-500 mb-1">Drag and drop a file here or</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm text-orange-500 hover:text-orange-600 underline"
                  >
                    click to upload
                  </button>
                  <p className="text-xs text-orange-400 mt-2">No files selected yet</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            
            {/* Captcha */}
            <div className="space-y-2">
              <div 
                className="inline-block px-4 py-2 bg-yellow-400 text-gray-800 font-mono text-lg tracking-wide rounded cursor-pointer"
                onClick={refreshCaptcha}
                title="Click to refresh"
              >
                {captchaCode}
              </div>
              <input
                type="text"
                placeholder="Captcha"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
            )}
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isSubmitting 
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="w-5 h-5" />
                  SUBMIT
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
