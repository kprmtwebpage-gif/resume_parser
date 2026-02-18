import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log to console for debugging; can be wired to telemetry later.
    // eslint-disable-next-line no-console
    console.error('UI crashed:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const message = this.state.error?.message || String(this.state.error || 'Unknown error')

    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow">
          <div className="text-lg font-semibold text-slate-900">Something went wrong</div>
          <div className="mt-2 text-sm text-slate-700">
            The UI hit a runtime error and could not render. The backend may still be running.
          </div>
          <pre className="mt-4 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{message}</pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <a className="btn-secondary" href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">
              Open API docs
            </a>
          </div>
        </div>
      </div>
    )
  }
}
