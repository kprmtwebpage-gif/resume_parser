import { Fragment, useEffect, useMemo, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

import ProfileTabs from './ProfileTabs.jsx'

function initials(first, last) {
  const a = (first || '').trim()[0] || ''
  const b = (last || '').trim()[0] || ''
  return (a + b).toUpperCase() || '—'
}

function sanitizeLinkedInUrl(url) {
  if (!url) return null
  
  // Trim whitespace
  url = url.trim()
  
  // If URL doesn't start with http/https, add https
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  
  // Convert http to https for LinkedIn
  if (url.startsWith('http://') && url.includes('linkedin.com')) {
    url = url.replace('http://', 'https://')
  }
  
  return url
}

export default function ProfileModal({
  open,
  onClose,
  candidate,
  tab,
  onTab,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) {
  const fullName = useMemo(() => {
    if (!candidate) return ''
    return [candidate.first_name, candidate.last_name].filter(Boolean).join(' ') || `Candidate #${candidate.id}`
  }, [candidate])

  const [show, setShow] = useState(open)

  useEffect(() => setShow(open), [open])

  return (
    <Transition.Root show={show} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/30" />
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
              <Dialog.Panel className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200/50">
                <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-50 to-purple-50 px-8 py-5">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="rounded-xl p-2.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-all hover:shadow-md"
                      onClick={onClose}
                      title="Close"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                    <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">👤 Profile Details</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 bg-white border-2 border-slate-200 hover:border-blue-400 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={onPrev}
                      disabled={!hasPrev}
                      title="Previous"
                    >
                      <ArrowLeftIcon className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 bg-white border-2 border-slate-200 hover:border-purple-400 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={onNext}
                      disabled={!hasNext}
                      title="Next"
                    >
                      <ArrowRightIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="px-8 py-6">
                  {!candidate ? (
                    <div className="py-16 text-center">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 animate-pulse">
                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <div className="mt-4 text-base font-medium text-slate-500">Loading profile...</div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-6">
                        <div className="flex items-start gap-5">
                          <div className="relative h-20 w-20 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg ring-4 ring-blue-100">
                            {candidate.profile_picture_url ? (
                              <img 
                                src={candidate.profile_picture_url} 
                                alt={fullName}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  // Hide image and show initials if loading fails
                                  e.target.style.display = 'none'
                                }}
                              />
                            ) : null}
                            <div className={`absolute inset-0 flex items-center justify-center text-2xl font-bold text-white ${candidate.profile_picture_url ? 'hidden' : ''}`}>
                              {initials(candidate.first_name, candidate.last_name)}
                            </div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-slate-900">{fullName}</div>
                            <div className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-600">
                              <span className="text-purple-500">💼</span>
                              {candidate.job_title || '—'}
                              {candidate.company ? <span className="text-slate-400"> · </span> : null}
                              {candidate.company ? candidate.company : null}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-600">
                              <span className="text-green-500">📍</span>
                              {candidate.location || '—'}
                            </div>
                            {candidate.email && (
                              <div className="mt-2 flex items-center gap-2 text-sm">
                                <span className="text-slate-500">✉️</span>
                                <a href={`mailto:${candidate.email}`} className="hover:text-blue-600 font-medium break-all" title={candidate.email}>
                                  {candidate.email}
                                </a>
                              </div>
                            )}
                            {candidate.phone && (
                              <div className="mt-2 flex items-center gap-2 text-sm">
                                <span className="text-slate-500">📞</span>
                                <a href={`tel:${candidate.phone}`} className="hover:text-blue-600 font-medium" title={candidate.phone}>
                                  {candidate.phone}
                                </a>
                              </div>
                            )}
                            {candidate.linkedin && (
                              <div className="mt-3">
                                <a
                                  href={sanitizeLinkedInUrl(candidate.linkedin)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#0A66C2] px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg hover:scale-105 transition-all"
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                  </svg>
                                  View Profile
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <a
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            href={candidate.resume_filename ? `/candidates/${candidate.id}/resume` : undefined}
                            download
                            onClick={(e) => {
                              if (!candidate.resume_filename) e.preventDefault()
                            }}
                          >
                            📄 Export PDF
                          </a>
                        </div>
                      </div>

                      <ProfileTabs active={tab} onChange={onTab} />

                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="md:col-span-2">
                          {tab === 'skills' && (
                            <div className="rounded-2xl bg-gradient-to-br from-white to-purple-50/30 p-6 shadow-lg ring-1 ring-slate-200/50">
                              <div className="flex items-center gap-2 mb-4">
                                <span className="text-2xl">🎯</span>
                                <h3 className="text-lg font-bold text-slate-900">Technical Skills</h3>
                              </div>
                              <div className="flex flex-wrap gap-3">
                                {(candidate.skills || []).length === 0 ? (
                                  <div className="text-sm font-medium text-slate-500">No skills available</div>
                                ) : (
                                  candidate.skills.map((s) => (
                                    <span key={s} className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg hover:scale-105 transition-all">
                                      {s}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          )}

                          {tab === 'experience' && (
                            <div className="rounded-2xl bg-gradient-to-br from-white to-orange-50/30 p-6 shadow-lg ring-1 ring-slate-200/50">
                              <div className="flex items-center gap-2 mb-4">
                                <span className="text-2xl">💼</span>
                                <h3 className="text-lg font-bold text-slate-900">Work Experience</h3>
                              </div>
                              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                                <div className="text-base font-bold text-slate-900">{candidate.experience?.job_title || candidate.job_title || '—'}</div>
                                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-600">
                                  <span className="text-orange-500">⏱️</span>
                                  Years of experience: {candidate.experience?.years_of_experience ?? '—'}
                                </div>
                              </div>

                              <div className="mt-5">
                              
                                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                                  <span className="text-green-500">🏆</span> Certifications
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  {(candidate.experience?.certifications || []).length === 0 ? (
                                    <div className="text-sm font-medium text-slate-500">No certifications</div>
                                  ) : (
                                    candidate.experience.certifications.map((c) => (
                                      <span key={c} className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg hover:scale-105 transition-all">
                                        {c}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {tab === 'education' && (
                            <div className="rounded-2xl bg-gradient-to-br from-white to-indigo-50/30 p-6 shadow-lg ring-1 ring-slate-200/50">
                              <div className="flex items-center gap-2 mb-4">
                                <span className="text-2xl">🎓</span>
                                <h3 className="text-lg font-bold text-slate-900">Education</h3>
                              </div>
                              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 text-base font-medium text-slate-900">{candidate.education || '—'}</div>
                            </div>
                          )}
                        </div>

                        {/*<div className="space-y-3">
                          <div className="card p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job Projects</div>
                            <button type="button" className="btn-secondary mt-3 w-full">+ Add</button>
                          </div>
                          <div className="card p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead Lists</div>
                            <button type="button" className="btn-secondary mt-3 w-full">+ Add</button>
                          </div>
                          <div className="card p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sequences</div>
                            <button type="button" className="btn-secondary mt-3 w-full">+ Add</button>
                          </div>
                          <div className="card p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">ATS / CRM</div>
                            <button type="button" className="btn-secondary mt-3 w-full">+ Add</button>
                          </div>
                        </div>*/}
                      </div>
                    </>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
