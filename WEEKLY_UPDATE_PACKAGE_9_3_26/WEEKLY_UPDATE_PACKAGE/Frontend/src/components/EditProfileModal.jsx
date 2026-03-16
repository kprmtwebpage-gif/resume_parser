import { Fragment, useEffect, useState, useCallback } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { api } from '../services/api'
import './CommentModal.css'

const COMMENTS_API = '/standalone-comments'

function initials(first, last) {
  const a = (first || '').trim()[0] || ''
  const b = (last || '').trim()[0] || ''
  return (a + b).toUpperCase() || '—'
}

export default function EditProfileModal({
  open,
  onClose,
  candidate,
  onSave,
  saving,
}) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    job_title: '',
    location: '',
    email: '',
    phone: '',
    linkedin: '',
    skills: [],
    experience: [],
    education: [],
  })

  const [errors, setErrors] = useState({})
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const userRole = 'HR' // TODO: replace with real auth role

  // Fetch comments for candidate
  const fetchComments = useCallback(async (candidateId) => {
    if (!candidateId) return
    setCommentsLoading(true)
    try {
      const res = await api.get(`${COMMENTS_API}/${candidateId}`)
      setComments(Array.isArray(res.data) ? res.data : [])
    } catch {
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  const handleDeleteComment = useCallback(async (commentId) => {
    try {
      await api.delete(`${COMMENTS_API}/${commentId}`)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (err) {
      console.error('[EditProfile] Failed to delete comment:', err)
    }
  }, [])

  const handleClearAllComments = useCallback(async () => {
    if (!candidate) return
    try {
      await Promise.all(comments.map(c => api.delete(`${COMMENTS_API}/${c.id}`)))
      setComments([])
    } catch (err) {
      console.error('[EditProfile] Failed to clear comments:', err)
    } finally {
      setShowClearConfirm(false)
    }
  }, [candidate, comments])

  // Initialize form data when candidate changes
  useEffect(() => {
    if (candidate) {
      setFormData({
        first_name: candidate.first_name || '',
        last_name: candidate.last_name || '',
        job_title: candidate.job_title || '',
        location: candidate.location || '',
        email: candidate.email || '',
        phone: candidate.phone || '',
        linkedin: candidate.linkedin || '',
        skills: Array.isArray(candidate.skills) ? [...candidate.skills] : [],
        experience: parseExperience(candidate.experience),
        education: parseEducation(candidate.education),
      })
      setErrors({})
      fetchComments(candidate.id)
    }
  }, [candidate, fetchComments])

  // Parse experience data from various formats
  const parseExperience = (exp) => {
    if (!exp) return []
    if (Array.isArray(exp)) return exp.map((e, idx) => ({ ...e, id: idx }))
    if (typeof exp === 'object') {
      // Handle nested structure like { positions: [...] }
      if (exp.positions) return exp.positions.map((e, idx) => ({ ...e, id: idx }))
      // Single object
      return [{ ...exp, id: 0 }]
    }
    return []
  }

  // Parse education data from various formats
  const parseEducation = (edu) => {
    if (!edu) return []
    if (Array.isArray(edu)) return edu.map((e, idx) => ({ ...e, id: idx }))
    if (typeof edu === 'object') {
      return [{ ...edu, id: 0 }]
    }
    return []
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const handleSkillChange = (index, value) => {
    setFormData(prev => {
      const newSkills = [...prev.skills]
      newSkills[index] = value
      return { ...prev, skills: newSkills }
    })
  }

  const addSkill = () => {
    setFormData(prev => ({
      ...prev,
      skills: [...prev.skills, '']
    }))
  }

  const removeSkill = (index) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }))
  }

  const handleExperienceChange = (index, field, value) => {
    setFormData(prev => {
      const newExp = [...prev.experience]
      newExp[index] = { ...newExp[index], [field]: value }
      return { ...prev, experience: newExp }
    })
  }

  const addExperience = () => {
    setFormData(prev => ({
      ...prev,
      experience: [...prev.experience, {
        id: Date.now(),
        title: '',
        company: '',
        location: '',
        start_date: '',
        end_date: '',
        description: ''
      }]
    }))
  }

  const removeExperience = (index) => {
    setFormData(prev => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index)
    }))
  }

  const handleEducationChange = (index, field, value) => {
    setFormData(prev => {
      const newEdu = [...prev.education]
      newEdu[index] = { ...newEdu[index], [field]: value }
      return { ...prev, education: newEdu }
    })
  }

  const addEducation = () => {
    setFormData(prev => ({
      ...prev,
      education: [...prev.education, {
        id: Date.now(),
        institution: '',
        degree: '',
        field_of_study: '',
        start_year: '',
        end_year: ''
      }]
    }))
  }

  const removeEducation = (index) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }))
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required'
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    
    // Clean up skills (remove empty ones)
    const cleanedData = {
      ...formData,
      skills: formData.skills.filter(s => s.trim()),
      experience: formData.experience.map(({ id, ...rest }) => rest),
      education: formData.education.map(({ id, ...rest }) => rest),
    }
    
    onSave(cleanedData)
  }

  const handleCancel = () => {
    setErrors({})
    onClose()
  }

  const fullName = [formData.first_name, formData.last_name].filter(Boolean).join(' ') || 'New Candidate'

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleCancel}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-neutral-900/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-2 scale-95"
              enterTo="opacity-100 translate-y-0 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 scale-100"
              leaveTo="opacity-0 translate-y-2 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-modal border border-neutral-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-brand-500">
                      <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-white">
                        {initials(formData.first_name, formData.last_name)}
                      </div>
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-neutral-900">
                        Edit Profile
                      </Dialog.Title>
                      <p className="text-sm text-neutral-500">{fullName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-button p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-all"
                    onClick={handleCancel}
                    title="Close"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                  {/* Basic Profile Details */}
                  <section className="mb-6">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.first_name}
                          onChange={(e) => handleInputChange('first_name', e.target.value)}
                          className={`input ${errors.first_name ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
                          placeholder="Enter first name"
                        />
                        {errors.first_name && (
                          <p className="mt-1 text-xs text-red-500">{errors.first_name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={formData.last_name}
                          onChange={(e) => handleInputChange('last_name', e.target.value)}
                          className="input"
                          placeholder="Enter last name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Job Title
                        </label>
                        <input
                          type="text"
                          value={formData.job_title}
                          onChange={(e) => handleInputChange('job_title', e.target.value)}
                          className="input"
                          placeholder="e.g. Software Engineer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Location
                        </label>
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => handleInputChange('location', e.target.value)}
                          className="input"
                          placeholder="e.g. New York, NY"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className={`input ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
                          placeholder="email@example.com"
                        />
                        {errors.email && (
                          <p className="mt-1 text-xs text-red-500">{errors.email}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className="input"
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          LinkedIn Profile
                        </label>
                        <input
                          type="url"
                          value={formData.linkedin}
                          onChange={(e) => handleInputChange('linkedin', e.target.value)}
                          className="input"
                          placeholder="https://linkedin.com/in/username"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Skills */}
                  <section className="mb-6">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-900">Skills</h3>
                      <button
                        type="button"
                        onClick={addSkill}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-500 hover:bg-brand-50 rounded-button transition-colors"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Add Skill
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.skills.length === 0 ? (
                        <p className="text-sm text-neutral-400">No skills added yet</p>
                      ) : (
                        formData.skills.map((skill, index) => (
                          <div key={index} className="flex items-center gap-1 bg-neutral-100 rounded-full pl-3 pr-1 py-1">
                            <input
                              type="text"
                              value={skill}
                              onChange={(e) => handleSkillChange(index, e.target.value)}
                              className="bg-transparent border-none text-sm text-neutral-700 w-24 focus:outline-none focus:ring-0"
                              placeholder="Skill"
                            />
                            <button
                              type="button"
                              onClick={() => removeSkill(index)}
                              className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                            >
                              <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  {/* Work Experience */}
                  <section className="mb-6">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-900">Work Experience</h3>
                      <button
                        type="button"
                        onClick={addExperience}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-500 hover:bg-brand-50 rounded-button transition-colors"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Add Experience
                      </button>
                    </div>
                    <div className="space-y-4">
                      {formData.experience.length === 0 ? (
                        <p className="text-sm text-neutral-400">No work experience added yet</p>
                      ) : (
                        formData.experience.map((exp, index) => (
                          <div key={exp.id || index} className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-xs font-medium text-neutral-500">Position {index + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeExperience(index)}
                                className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                                title="Remove"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Job Title</label>
                                <input
                                  type="text"
                                  value={exp.title || ''}
                                  onChange={(e) => handleExperienceChange(index, 'title', e.target.value)}
                                  className="input text-sm"
                                  placeholder="e.g. Senior Developer"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Company</label>
                                <input
                                  type="text"
                                  value={exp.company || ''}
                                  onChange={(e) => handleExperienceChange(index, 'company', e.target.value)}
                                  className="input text-sm"
                                  placeholder="Company name"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Location</label>
                                <input
                                  type="text"
                                  value={exp.location || ''}
                                  onChange={(e) => handleExperienceChange(index, 'location', e.target.value)}
                                  className="input text-sm"
                                  placeholder="City, Country"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium text-neutral-600 mb-1">Start Date</label>
                                  <input
                                    type="text"
                                    value={exp.start_date || ''}
                                    onChange={(e) => handleExperienceChange(index, 'start_date', e.target.value)}
                                    className="input text-sm"
                                    placeholder="MM/YYYY"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-neutral-600 mb-1">End Date</label>
                                  <input
                                    type="text"
                                    value={exp.end_date || ''}
                                    onChange={(e) => handleExperienceChange(index, 'end_date', e.target.value)}
                                    className="input text-sm"
                                    placeholder="MM/YYYY or Present"
                                  />
                                </div>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
                                <textarea
                                  value={exp.description || ''}
                                  onChange={(e) => handleExperienceChange(index, 'description', e.target.value)}
                                  className="input text-sm resize-none"
                                  rows={2}
                                  placeholder="Brief description of responsibilities..."
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  {/* Education */}
                  <section>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-900">Education</h3>
                      <button
                        type="button"
                        onClick={addEducation}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-500 hover:bg-brand-50 rounded-button transition-colors"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Add Education
                      </button>
                    </div>
                    <div className="space-y-4">
                      {formData.education.length === 0 ? (
                        <p className="text-sm text-neutral-400">No education added yet</p>
                      ) : (
                        formData.education.map((edu, index) => (
                          <div key={edu.id || index} className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-xs font-medium text-neutral-500">Education {index + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeEducation(index)}
                                className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                                title="Remove"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Institution</label>
                                <input
                                  type="text"
                                  value={edu.institution || edu.school || ''}
                                  onChange={(e) => handleEducationChange(index, 'institution', e.target.value)}
                                  className="input text-sm"
                                  placeholder="University or School name"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Degree</label>
                                <input
                                  type="text"
                                  value={edu.degree || ''}
                                  onChange={(e) => handleEducationChange(index, 'degree', e.target.value)}
                                  className="input text-sm"
                                  placeholder="e.g. Bachelor's, Master's"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Field of Study</label>
                                <input
                                  type="text"
                                  value={edu.field_of_study || edu.field || ''}
                                  onChange={(e) => handleEducationChange(index, 'field_of_study', e.target.value)}
                                  className="input text-sm"
                                  placeholder="e.g. Computer Science"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Start Year</label>
                                <input
                                  type="text"
                                  value={edu.start_year || ''}
                                  onChange={(e) => handleEducationChange(index, 'start_year', e.target.value)}
                                  className="input text-sm"
                                  placeholder="YYYY"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1">End Year</label>
                                <input
                                  type="text"
                                  value={edu.end_year || ''}
                                  onChange={(e) => handleEducationChange(index, 'end_year', e.target.value)}
                                  className="input text-sm"
                                  placeholder="YYYY or Expected"
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  {/* Comments */}
                  <section className="mt-6">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-900">Comments</h3>
                      {userRole === 'HR' && comments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(true)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded-button transition-colors"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          Clear All
                        </button>
                      )}
                    </div>

                    {commentsLoading ? (
                      <p className="text-sm text-neutral-400 py-4 text-center">Loading comments…</p>
                    ) : comments.length === 0 ? (
                      <p className="text-sm text-neutral-400 py-4 text-center">No comments available.</p>
                    ) : (
                      <div className="comments-timeline" style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                        {comments.map((c) => {
                          const d = new Date(c.created_at)
                          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                          const dateStr = `${months[d.getMonth()]} ${d.getFullYear()}`
                          const hours = d.getHours()
                          const ampm = hours >= 12 ? 'PM' : 'AM'
                          const h12 = hours % 12 || 12
                          const timeStr = `${String(h12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`
                          return (
                            <div key={c.id} className="comments-timeline-item">
                              <div className="comments-timeline-dot" />
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="comments-timeline-text">{c.comment_text}</div>
                                  <div className="comments-timeline-meta">
                                    <span>{dateStr}</span>
                                    <span>{timeStr}</span>
                                  </div>
                                </div>
                                {userRole === 'HR' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(c.id)}
                                    className="flex-shrink-0 p-1 text-neutral-400 hover:text-red-500 transition-colors mt-0.5"
                                    title="Delete comment"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Clear All Confirmation */}
                    {showClearConfirm && (
                      <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-sm text-red-700 mb-2">Delete all comments for this candidate?</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleClearAllComments}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-button transition-colors"
                          >
                            Yes, delete all
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowClearConfirm(false)}
                            className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-button transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn-secondary"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="btn-primary"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
