import { useEffect, useState } from 'react'

export default function ServerStatus() {
  const [backendStatus, setBackendStatus] = useState('checking')
  const [frontendStatus, setFrontendStatus] = useState('running')
  const [retryCount, setRetryCount] = useState(0)

  const checkBackend = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
      const response = await fetch(`${apiBaseUrl}/`, { 
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        setBackendStatus('running')
        setRetryCount(0)
      } else {
        setBackendStatus('error')
        setRetryCount(prev => prev + 1)
      }
    } catch (error) {
      console.error('Backend check failed:', error)
      setBackendStatus('offline')
      setRetryCount(prev => prev + 1)
    }
  }

  useEffect(() => {
    checkBackend()
    
    // Retry a few times with delays
    const timers = []
    const retries = [1000, 2000, 4000, 6000, 8000]
    retries.forEach((delay) => {
      const timer = setTimeout(() => {
        checkBackend()
      }, delay)
      timers.push(timer)
    })
    
    // Periodic check every 10 seconds after initial retries
    const periodicCheck = setInterval(() => {
      if (backendStatus !== 'running') {
        checkBackend()
      }
    }, 10000)
    
    return () => {
      timers.forEach(t => clearTimeout(t))
      clearInterval(periodicCheck)
    }
  }, [])

  // Don't show error immediately, give backend time to start
  if (backendStatus === 'running' || (backendStatus === 'checking' && retryCount < 5)) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Backend Server Not Running</h3>
        </div>

        <div className="space-y-3 text-sm text-slate-600">
          <p>The frontend UI is running, but the backend API server is not accessible.</p>
          
          <div className="rounded-lg bg-slate-50 p-3 font-mono text-xs">
            <div className="mb-1 font-semibold text-slate-700">Status:</div>
            <div className="text-slate-600">
              Frontend: <span className="text-green-600">✓ Running</span> (http://127.0.0.1:5173)
            </div>
            <div className="text-slate-600">
              Backend: <span className="text-red-600">✗ {backendStatus === 'checking' ? 'Checking...' : 'Offline'}</span> (http://127.0.0.1:8000)
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 p-3">
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
            href="http://127.0.0.1:8000/docs" 
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
