import { useEffect, useState, useRef } from 'react'
import { apiUrl } from '../config'

export default function ServerStatus() {
  const [backendStatus, setBackendStatus] = useState('checking')
  const [frontendStatus, setFrontendStatus] = useState('running')
  const consecutiveFailures = useRef(0)

  const checkBackend = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(apiUrl('/health'), { 
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        setBackendStatus('running')
        consecutiveFailures.current = 0
      } else {
        consecutiveFailures.current += 1
        if (consecutiveFailures.current >= 3) {
          setBackendStatus('error')
        }
      }
    } catch (error) {
      consecutiveFailures.current += 1
      if (consecutiveFailures.current >= 3) {
        console.error('Backend check failed:', error)
        setBackendStatus('offline')
      }
    }
  }

  useEffect(() => {
    checkBackend()
    
    // After initial check, poll every 15 seconds
    const periodicCheck = setInterval(() => {
      checkBackend()
    }, 15000)
    
    return () => {
      clearInterval(periodicCheck)
    }
  }, [])

  // Don't show until we've confirmed backend is truly down (3 consecutive failures)
  if (backendStatus === 'running' || backendStatus === 'checking') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/90">
      <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-modal border border-neutral-200">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">Backend Server Not Running</h3>
        </div>

        <div className="space-y-3 text-sm text-neutral-600">
          <p>The frontend UI is running, but the backend API server is not accessible.</p>
          
          <div className="rounded-lg bg-neutral-50 p-3 font-mono text-xs border border-neutral-200">
            <div className="mb-1 font-semibold text-neutral-700">Status:</div>
            <div className="text-neutral-600">
              Frontend: <span className="text-green-600">✓ Running</span> ({window.location.origin})
            </div>
            <div className="text-neutral-600">
              Backend: <span className="text-red-600">✗ {backendStatus === 'checking' ? 'Checking...' : 'Offline'}</span> (API server)
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
            <div className="mb-2 font-semibold text-blue-900">To start the backend:</div>
            <ol className="list-inside list-decimal space-y-1 text-blue-800">
              <li>Open a terminal in the <code className="rounded bg-blue-100 px-1">Backend</code> folder</li>
              <li>Run: <code className="rounded bg-blue-100 px-1">python api_server.py</code></li>
            </ol>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button 
            onClick={checkBackend}
            className="btn-primary flex-1"
          >
            Retry Connection
          </button>
          <a 
            href={`${window.location.origin}/docs`}
            target="_blank" 
            rel="noreferrer"
            className="btn-secondary"
          >
            API Docs
          </a>
        </div>
      </div>
    </div>
  )
}
