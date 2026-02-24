import SlidingProfilePanel from './SlidingProfilePanel'

export default function EmailProviderModal({ isOpen, onClose, onSelectProvider }) {
  const handleSelectProvider = (provider) => {
    onSelectProvider(provider)
    onClose()
  }

  return (
    <SlidingProfilePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Select Email Provider"
    >
      {/* Scrollable content area */}
      <div className="px-8 py-10 overflow-y-auto h-full">
        <div className="max-w-xl mx-auto">
          {/* Content card */}
          <div className="bg-neutral-50 rounded-xl p-8 shadow-sm border border-neutral-100">
            <div className="text-center mb-6">
              <h3 className="text-xl font-medium text-neutral-800 mb-2">
                Choose Your Email Provider
              </h3>
              <p className="text-sm text-neutral-500">
                Select how you'd like to send emails from this application
              </p>
            </div>

            {/* Provider buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => handleSelectProvider('gmail')}
                className="flex-1 px-6 py-4 text-base font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="block text-lg">Gmail</span>
                <span className="block text-xs opacity-80 mt-1">Google Mail</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectProvider('outlook')}
                className="flex-1 px-6 py-4 text-base font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="block text-lg">Outlook</span>
                <span className="block text-xs opacity-80 mt-1">Microsoft Mail</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </SlidingProfilePanel>
  )
}
