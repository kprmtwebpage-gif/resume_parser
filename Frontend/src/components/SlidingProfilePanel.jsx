import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

/**
 * SlidingProfilePanel - A full-screen sliding panel component (SignalHire-style)
 * 
 * Usage:
 * <SlidingProfilePanel
 *   isOpen={isProfileOpen}
 *   onClose={() => setIsProfileOpen(false)}
 * >
 *   {/* Profile content here *\/}
 * </SlidingProfilePanel>
 */
export default function SlidingProfilePanel({ 
  isOpen, 
  onClose, 
  children,
  title = 'Profile',
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false
}) {
  // Internal state to control visibility for animation
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const panelRef = useRef(null)

  // Handle opening animation
  useEffect(() => {
    if (isOpen) {
      // Mount the component first, then trigger animation
      setIsVisible(true)
      // Small delay to ensure DOM is ready before animation starts
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
    }
  }, [isOpen])

  // Handle closing with animation
  const handleClose = () => {
    setIsAnimating(false)
    // Wait for animation to complete before unmounting
    setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, 350) // Match transition duration
  }

  // Close panel on Escape key
  useEffect(() => {
    if (!isVisible) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isVisible])

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isVisible])

  if (!isVisible) return null

  // Use createPortal to render directly to body (like Vue's <teleport to="body">)
  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* Left-side overlay (30vw) - clicking closes the panel */}
      <div
        className={`absolute top-0 left-0 h-full transition-opacity duration-[350ms] ease-in-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          width: '30vw',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
        }}
        onClick={handleClose}
      />

      {/* Right-side sliding panel (70vw) */}
      <div
        ref={panelRef}
        className={`absolute top-0 right-0 h-full bg-white overflow-y-auto transition-transform duration-[350ms] ease-in-out ${
          isAnimating ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: '70vw',
          boxShadow: '-10px 0 25px rgba(0, 0, 0, 0.15)',
          willChange: 'transform',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header section */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-white sticky top-0 z-10">
          {/* Left side - Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center justify-center w-10 h-10 rounded-full text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            title="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>

          {/* Center - Title */}
          <h2 className="text-lg font-semibold text-neutral-900">
            {title}
          </h2>

          {/* Right side - Navigation buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                hasPrev 
                  ? 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100' 
                  : 'text-neutral-400 opacity-50 cursor-not-allowed'
              }`}
              title="Previous"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                hasNext 
                  ? 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100' 
                  : 'text-neutral-400 opacity-50 cursor-not-allowed'
              }`}
              title="Next"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="h-[calc(100vh-73px)]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
