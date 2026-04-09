import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom'
import 'animate.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { UploadProvider } from './contexts/UploadContext'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import SearchPeople from './pages/SearchPeople.jsx'
import Jobs from './pages/Jobs.jsx'
import Upload from './pages/Upload.jsx'
import JobSearch from './pages/JobSearch.jsx'
import AppliedCandidatesPage from './pages/AppliedCandidatesPage.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminResumes from './pages/AdminResumes.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import DashboardOverview from './pages/admin/DashboardOverview.jsx'
import UploadMetrics from './pages/admin/UploadMetrics.jsx'
import UploadLog from './pages/admin/UploadLog.jsx'
import EmailTrackingDashboard from './pages/admin/EmailTrackingDashboard.jsx'
import CandidateTemplates from './pages/admin/CandidateTemplates.jsx'
import TemplateManager from './pages/admin/TemplateManager.jsx'
import UsersManagement from './pages/admin/UsersManagement.jsx'
import ActivityLog from './pages/admin/ActivityLog.jsx'
import ServerStatus from './components/ServerStatus.jsx'
import ChatLauncher from './chatbot/ChatLauncher.jsx'
import FloatingUploadIndicator from './components/FloatingUploadIndicator.jsx'
import LoginPage from './login/LoginPage.jsx'
import Home from './pages/Home.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import CustomerPage from './pages/customer/CustomerPage.jsx'
import CustomerCreate from './pages/customer/CustomerCreate.jsx'
import CustomerDetail from './pages/customer/CustomerDetail.jsx'
import CustomerEdit from './pages/customer/CustomerEdit.jsx'
import SendMail from './pages/SendMail.jsx'
import TemplatesPage from './pages/TemplatesPage.jsx'
import EmailSettingsPage from './pages/EmailSettingsPage.jsx'
import NotFound from './pages/NotFound.jsx'
// User panel
import UserLayout from './pages/user/UserLayout.jsx'
import UserUploadLogs from './pages/user/UserUploadLogs.jsx'
import EmailHistorySection from './components/email/EmailHistorySection.jsx'


function ScrollAnimationBootstrap() {
  const location = useLocation()

  useEffect(() => {
    // Re-query on every route change so newly mounted .wow elements are observed
    const elements = document.querySelectorAll('.wow')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target
            const duration = el.getAttribute('data-wow-duration')
            const delay = el.getAttribute('data-wow-delay')
            if (duration) el.style.animationDuration = duration
            if (delay) el.style.animationDelay = delay
            el.style.visibility = 'visible'
            el.classList.add('animated')
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.15 }
    )

    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [location.pathname])

  return <style>{`.wow { visibility: hidden; }`}</style>
}


function AdminGuard({ children }) {
  try {
    const stored = localStorage.getItem('rp_user')
    const user = stored ? JSON.parse(stored) : null
    if (user?.role === 'superuser' || user?.role === 'admin') return children
  } catch {}
  return <Navigate to="/dashboard" replace />
}

function SearchPageChatbot() {
  const location = useLocation()
  if (location.pathname !== '/dashboard') return null
  return <ChatLauncher />
}

function LoginRoute({ onLoginSuccess }) {
  const navigate = useNavigate()
  const handleSuccess = () => {
    onLoginSuccess()
    navigate('/dashboard', { replace: true })
  }
  return <LoginPage onLoginSuccess={handleSuccess} />
}

function AuthenticatedRoutes() {
  // Upload-only users: restrict to /upload route exclusively
  try {
    const stored = localStorage.getItem('rp_user')
    const user = stored ? JSON.parse(stored) : null
    if (user?.role === 'upload_user') {
      return (
        <UploadProvider>
          <Routes>
            <Route path="/upload" element={<DashboardLayout><Upload /></DashboardLayout>} />
            <Route path="*" element={<Navigate to="/upload" replace />} />
          </Routes>
        </UploadProvider>
      )
    }
  } catch {}

  return (
    <UploadProvider>
      <ServerStatus />
      <FloatingUploadIndicator />
      <Routes>
        {/* Public home page remains accessible when logged in */}
        <Route path="/" element={<Home />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/kprmt-privacy-policy.html" element={<Navigate to="/privacy-policy" replace />} />
        {/* Main dashboard (was previously at /) */}
        <Route path="/dashboard" element={<DashboardLayout><SearchPeople /></DashboardLayout>} />
        <Route path="/jobs" element={<DashboardLayout><Jobs /></DashboardLayout>} />
        <Route path="/upload" element={<DashboardLayout><Upload /></DashboardLayout>} />
        <Route path="/job-search" element={<DashboardLayout><JobSearch /></DashboardLayout>} />
        <Route path="/find-jobs" element={<DashboardLayout><JobSearch /></DashboardLayout>} />
        <Route path="/jobs/:jobId/applied" element={<DashboardLayout><AppliedCandidatesPage /></DashboardLayout>} />
        {/* Customer routes */}
        <Route path="/customer" element={<DashboardLayout><CustomerPage /></DashboardLayout>} />
        <Route path="/customer/new" element={<DashboardLayout><CustomerCreate /></DashboardLayout>} />
        <Route path="/customer/:id/edit" element={<DashboardLayout><CustomerEdit /></DashboardLayout>} />
        <Route path="/customer/:id" element={<DashboardLayout><CustomerDetail /></DashboardLayout>} />
        {/* Send Mail page */}
        <Route path="/send-mail" element={<DashboardLayout><SendMail /></DashboardLayout>} />
        {/* User section (user panel only) */}
        <Route path="/user" element={<DashboardLayout><UserLayout /></DashboardLayout>}>
          <Route index element={<Navigate to="email/settings" replace />} />
          <Route path="upload-log" element={<UserUploadLogs />} />
          <Route path="email" element={<Navigate to="settings" replace />} />
          <Route path="email/history" element={<EmailHistorySection />} />
          <Route path="email/settings" element={<EmailSettingsPage />} />
          {/* Back-compat routes */}
          <Route path="email-settings" element={<Navigate to="email/settings" replace />} />
        </Route>
        {/* Templates page (part of Customer module) */}
        <Route path="/customer/templates" element={<DashboardLayout><TemplatesPage /></DashboardLayout>} />
        {/* Admin routes — protected by role check */}
        <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
          <Route index element={<DashboardOverview />} />
          <Route path="upload-metrics" element={<UploadMetrics />} />
          <Route path="upload-log" element={<UploadLog />} />
          <Route path="email-tracking" element={<EmailTrackingDashboard />} />
          <Route path="users" element={<UsersManagement />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="candidate-templates" element={<CandidateTemplates />} />
          <Route path="email-templates" element={<TemplateManager />} />
          <Route path="resumes" element={<AdminResumes />} />
        </Route>
        {/* Catch-all: unmatched routes render a proper not-found page */}
        <Route path="*" element={<DashboardLayout><NotFound /></DashboardLayout>} />
      </Routes>
      <SearchPageChatbot />
    </UploadProvider>
  )
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const idleTimer = useRef(null)
  const IDLE_TIMEOUT_MS = 20 * 60 * 1000 // 20 minutes

  const handleLogout = useCallback(() => {
    localStorage.removeItem('rp_token')
    localStorage.removeItem('rp_user')
    sessionStorage.removeItem('userLoginAuth')
    setIsAuthenticated(false)
  }, [])

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS)
  }, [handleLogout, IDLE_TIMEOUT_MS])

  useEffect(() => {
    const auth = sessionStorage.getItem('userLoginAuth')
    setIsAuthenticated(auth === 'true')
  }, [])

  // Start/reset idle timer on user activity when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }))
    resetIdleTimer() // start timer immediately after login
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer))
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [isAuthenticated, resetIdleTimer])

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
    resetIdleTimer()
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/kprmt-privacy-policy.html" element={<Navigate to="/privacy-policy" replace />} />
        <Route path="/job-search" element={<JobSearch />} />
        <Route path="/find-jobs" element={<JobSearch />} />
        <Route path="/admin" element={<LoginRoute onLoginSuccess={handleLoginSuccess} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    )
  }

  return <AuthenticatedRoutes />
}

export default function App() {
  // v2 – basename ensures React Router matches /dev/* routes correctly
  const basePath = import.meta.env.VITE_BASE_PATH || ''
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter basename={basePath || '/'}>
          <ScrollAnimationBootstrap />
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}
