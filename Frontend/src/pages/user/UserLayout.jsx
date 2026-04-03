import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, FileText, Mail } from 'lucide-react'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export default function UserLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [emailOpen, setEmailOpen] = useState(false) // default: collapsed

  const active = useMemo(() => {
    const p = location.pathname
    return {
      uploadLog: p.startsWith('/user/upload-log'),
      emailSettings: p.startsWith('/user/email/settings') || p.startsWith('/user/email-settings'),
      emailHistory: p.startsWith('/user/email/history'),
      emailAny: p.startsWith('/user/email'),
    }
  }, [location.pathname])

  return (
    <div className="flex min-h-[calc(100vh-56px)] bg-slate-50">
      <aside className="w-[240px] shrink-0 bg-white border-r border-slate-200">
        <nav className="px-3 py-4 space-y-1">
          <button
            onClick={() => navigate('/user/upload-log')}
            className={cx(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
              active.uploadLog
                ? 'bg-blue-600/10 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            )}
          >
            <FileText className="h-[18px] w-[18px] shrink-0" />
            <span className="text-[13px] font-medium">Upload Logs</span>
            {active.uploadLog && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
            )}
          </button>

          <div>
            <button
              onClick={() => setEmailOpen(v => !v)}
              className={cx(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                active.emailAny
                  ? 'bg-blue-600/10 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              <Mail className="h-[18px] w-[18px] shrink-0" />
              <span className="text-[13px] font-medium flex-1 text-left">Email Center</span>
              <ChevronDown className={cx('h-4 w-4 transition-transform', emailOpen ? 'rotate-0' : '-rotate-90')} />
            </button>

            {emailOpen && (
              <div className="mt-1 ml-3 pl-3 space-y-1" style={{ borderLeft: '1px solid rgba(148,163,184,0.35)' }}>
                <button
                  onClick={() => navigate('/user/email/history')}
                  className={cx(
                    'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors',
                    active.emailHistory
                      ? 'bg-blue-600/10 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  )}
                >
                  <span className="text-[12px] font-medium">Email History</span>
                  {active.emailHistory && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
                  )}
                </button>

                <button
                  onClick={() => navigate('/user/email/settings')}
                  className={cx(
                    'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors',
                    active.emailSettings
                      ? 'bg-blue-600/10 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  )}
                >
                  <span className="text-[12px] font-medium">Email Settings</span>
                  {active.emailSettings && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
                  )}
                </button>
              </div>
            )}
          </div>
        </nav>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
