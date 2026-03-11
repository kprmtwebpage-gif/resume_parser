import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  Users, Clock, LogOut,
  Menu, Home, ChevronLeft, ChevronDown, ArrowLeft, RefreshCw, Bell,
  LayoutDashboard, Upload, BarChart3,
} from 'lucide-react'
import companyLogo from '../../assets/company-logo.png'

export default function AdminLayout() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [dashboardOpen, setDashboardOpen] = useState(true)

  const dashboardSubmenus = [
    { path: '/admin', label: 'Overview', icon: Home },
    { path: '/admin/upload-metrics', label: 'Upload Metrics', icon: Upload },
  ]

  const menuItems = [
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/activity', label: 'Activity Logs', icon: Clock },
  ]

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-5">
        <div className="flex flex-col items-start gap-1.5">
          <img
            src={companyLogo}
            alt="Company Logo"
            className={`object-contain transition-all duration-300 ${sidebarOpen ? 'h-14 w-auto max-w-[190px]' : 'h-10 w-10 rounded-lg'}`}
            style={!sidebarOpen ? { objectPosition: 'left' } : undefined}
          />
          {sidebarOpen && (
            <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-gray-400 pl-0.5">Superuser Panel</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {/* Dashboard Parent Menu */}
        <div>
          <button
            onClick={() => {
              if (sidebarOpen) {
                setDashboardOpen(!dashboardOpen)
              } else {
                navigate('/admin')
                setMobileSidebarOpen(false)
              }
            }}
            className={`group w-full flex items-center gap-3 rounded-lg transition-all duration-200 ${
              sidebarOpen ? 'px-3 py-2.5' : 'px-2 py-2.5 justify-center'
            } ${
              dashboardSubmenus.some(s => isActive(s.path))
                ? 'bg-blue-600/10 text-blue-400'
                : 'text-gray-400 hover:bg-white/[0.06] hover:text-gray-200'
            }`}
            title={!sidebarOpen ? 'Dashboard' : undefined}
          >
            <LayoutDashboard className="h-[18px] w-[18px] shrink-0" />
            {sidebarOpen && (
              <>
                <span className="text-[13px] font-medium flex-1 text-left">Dashboard</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  dashboardOpen ? 'rotate-0' : '-rotate-90'
                }`} />
              </>
            )}
          </button>
          {/* Submenus */}
          {sidebarOpen && dashboardOpen && (
            <div className="mt-0.5 ml-3 pl-3 space-y-0.5" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
              {dashboardSubmenus.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileSidebarOpen(false) }}
                    className={`group w-full flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 ${
                      active
                        ? 'bg-blue-600/15 text-blue-400'
                        : 'text-gray-400 hover:bg-white/[0.06] hover:text-gray-200'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-[12px] font-medium">{item.label}</span>
                    {active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Other Menu Items */}
        {menuItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setMobileSidebarOpen(false) }}
              className={`group w-full flex items-center gap-3 rounded-lg transition-all duration-200 ${
                sidebarOpen ? 'px-3 py-2.5' : 'px-2 py-2.5 justify-center'
              } ${
                active
                  ? 'bg-blue-600/15 text-blue-400'
                  : 'text-gray-400 hover:bg-white/[0.06] hover:text-gray-200'
              }`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {sidebarOpen && (
                <span className="text-[13px] font-medium">{item.label}</span>
              )}
              {sidebarOpen && active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Back to Home */}
      <div className="px-3 mt-1">
        <button
          onClick={() => { navigate('/'); setMobileSidebarOpen(false) }}
          className={`group w-full flex items-center gap-3 rounded-lg transition-all duration-200 ${
            sidebarOpen ? 'px-3 py-2.5' : 'px-2 py-2.5 justify-center'
          } text-gray-400 hover:bg-blue-500/10 hover:text-blue-400`}
          title={!sidebarOpen ? 'Back to Home' : undefined}
        >
          <ArrowLeft className="h-[18px] w-[18px] shrink-0" />
          {sidebarOpen && <span className="text-[13px] font-medium">Back to Home</span>}
        </button>
      </div>

      {/* User / Logout */}
      <div className="border-t border-white/[0.06] px-3 py-4">
        {sidebarOpen && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-[11px] font-bold text-white uppercase shadow-md">
              {user?.username?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium tracking-wide uppercase text-gray-500" style={{ letterSpacing: '0.04em' }}>Signed in as</p>
              <p className="text-[13px] font-extrabold text-gray-100 truncate tracking-tight" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{user?.username || 'Admin'}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 ${
            sidebarOpen ? 'px-3 py-2.5' : 'px-2 py-2.5 justify-center'
          }`}
          title={!sidebarOpen ? 'Logout' : undefined}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {sidebarOpen && <span className="text-[13px] font-medium">Logout</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          ${sidebarOpen ? 'w-[240px]' : 'w-[68px]'}
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col transition-all duration-300
        `}
        style={{ backgroundColor: '#111827' }}
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden lg:flex absolute -right-3 top-[72px] h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft className={`h-3.5 w-3.5 transition-transform duration-200 ${sidebarOpen ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b px-6 h-[60px] flex items-center justify-between gap-4 shrink-0" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
            >
              <Menu className="h-5 w-5 text-gray-500" />
            </button>
            {/* Back to main page */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="Back to main page"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Main Page</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Refresh button */}
            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-[18px] w-[18px]" />
            </button>
            {/* Notification bell */}
            <button
              className="relative p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            {/* Admin avatar */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white uppercase">
                {user?.username?.charAt(0) || 'A'}
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] font-medium tracking-wide uppercase leading-none" style={{ color: '#9CA3AF', letterSpacing: '0.04em' }}>Admin</p>
                <p className="text-[13px] font-extrabold tracking-tight leading-none mt-0.5" style={{ color: '#111827', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{user?.username || 'Admin'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
