import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { 
  XMarkIcon, 
  DocumentArrowDownIcon, 
  EnvelopeIcon, 
  PhoneIcon, 
  UserIcon,
  MapPinIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  LinkIcon,
  IdentificationIcon
} from '@heroicons/react/24/outline'

/**
 * CandidateProfileModal - Full candidate profile view
 * 
 * Props:
 *  - isOpen: boolean
 *  - onClose: function
 *  - candidate: application data object from API
 */
export default function CandidateProfileModal({ isOpen, onClose, candidate }) {
  if (!candidate) return null

  // Resolve name from first_name/last_name or legacy candidate_name
  const getFullName = () => {
    if (candidate.first_name || candidate.last_name) {
      return `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim()
    }
    if (candidate.candidate_name) return candidate.candidate_name
    return 'Unknown Candidate'
  }

  const getFirstName = () => candidate.first_name || (candidate.candidate_name?.split(' ')[0]) || ''
  const getLastName = () => candidate.last_name || (candidate.candidate_name?.split(' ').slice(1).join(' ')) || ''
  const getEmail = () => candidate.email || candidate.candidate_email || ''
  const getPhone = () => candidate.phone || candidate.candidate_phone || ''
  const getResumeUrl = () => candidate.resume_file || candidate.resume_url || ''

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleDownloadResume = () => {
    const resumeUrl = getResumeUrl()
    if (resumeUrl) {
      const fullUrl = resumeUrl.startsWith('http')
        ? resumeUrl
        : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${resumeUrl}`
      window.open(fullUrl, '_blank')
    }
  }

  const statusBadgeClass = (s) => {
    const map = {
      applied: 'bg-blue-100 text-blue-700',
      PENDING: 'bg-amber-100 text-amber-700',
      REVIEWED: 'bg-blue-100 text-blue-700',
      SHORTLISTED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
      HIRED: 'bg-purple-100 text-purple-700',
    }
    return map[s] || 'bg-gray-100 text-gray-700'
  }

  const Field = ({ icon: Icon, label, value, isLink }) => {
    if (!value && value !== 0) return null
    return (
      <div className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg">
        <Icon className="h-5 w-5 text-neutral-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-neutral-500 mb-0.5">{label}</p>
          {isLink ? (
            <a
              href={value.startsWith('http') ? value : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 break-all"
            >
              {value}
            </a>
          ) : (
            <p className="text-sm font-medium text-neutral-900 break-words">{String(value)}</p>
          )}
        </div>
      </div>
    )
  }

  const status = candidate.application_status || 'applied'

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform rounded-xl bg-white shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 bg-gradient-to-r from-brand-500 to-brand-600 rounded-t-xl">
                  <Dialog.Title className="text-lg font-semibold text-white">
                    Candidate Profile
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Scrollable content */}
                <div className="px-6 py-6 max-h-[65vh] overflow-y-auto">
                  {/* Profile Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-shrink-0 w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center">
                      <UserIcon className="h-7 w-7 text-brand-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-neutral-900">{getFullName()}</h2>
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full mt-1 ${statusBadgeClass(status)}`}>
                        {status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* All Fields */}
                  <div className="space-y-3">
                    <Field icon={UserIcon} label="First Name" value={getFirstName()} />
                    <Field icon={UserIcon} label="Last Name" value={getLastName()} />
                    <Field icon={EnvelopeIcon} label="Email" value={getEmail()} />
                    <Field icon={PhoneIcon} label="Phone" value={getPhone()} />
                    <Field icon={MapPinIcon} label="Address" value={candidate.address} />
                    <Field icon={AcademicCapIcon} label="Education" value={candidate.education} />
                    <Field icon={IdentificationIcon} label="Citizenship" value={candidate.citizenship} />
                    <Field icon={LinkIcon} label="LinkedIn" value={candidate.linkedin_url} isLink />
                    <Field
                      icon={BriefcaseIcon}
                      label="Experience (Years)"
                      value={candidate.experience !== null && candidate.experience !== undefined ? candidate.experience : null}
                    />
                    <Field
                      icon={CalendarDaysIcon}
                      label="Applied Date"
                      value={formatDate(candidate.applied_at || candidate.submitted_at)}
                    />

                    {/* Resume */}
                    {getResumeUrl() && (
                      <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                        <DocumentArrowDownIcon className="h-5 w-5 text-neutral-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-neutral-500 mb-0.5">Resume</p>
                          <p className="text-sm font-medium text-neutral-700 truncate">
                            {candidate.resume_filename || 'Resume File'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadResume}
                          className="flex items-center gap-1 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
                        >
                          <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end border-t border-neutral-200 px-6 py-4 bg-neutral-50 rounded-b-xl">
                  <button
                    type="button"
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium text-sm rounded-lg transition-colors"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
