import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { UploadProvider } from './contexts/UploadContext'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import SearchPeople from './pages/SearchPeople.jsx'
import Jobs from './pages/Jobs.jsx'
import Upload from './pages/Upload.jsx'
import FindJobs from './pages/FindJobs.jsx'
import AppliedCandidatesPage from './pages/AppliedCandidatesPage.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminResumes from './pages/AdminResumes.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import { Navigate } from 'react-router-dom'
import DashboardOverview from './pages/admin/DashboardOverview.jsx'
import UploadMetrics from './pages/admin/UploadMetrics.jsx'
import UsersManagement from './pages/admin/UsersManagement.jsx'
import ActivityLog from './pages/admin/ActivityLog.jsx'
import EmailTrackingDashboard from './pages/admin/EmailTrackingDashboard.jsx'
import CandidateTemplates from './pages/admin/CandidateTemplates.jsx'
import ServerStatus from './components/ServerStatus.jsx'
import ChatLauncher from './chatbot/ChatLauncher.jsx'
import FloatingUploadIndicator from './components/FloatingUploadIndicator.jsx'
import LoginPage from './login/LoginPage.jsx'
import CustomerPage from './pages/customer/CustomerPage.jsx'
import CustomerCreate from './pages/customer/CustomerCreate.jsx'
import CustomerDetail from './pages/customer/CustomerDetail.jsx'
import CustomerEdit from './pages/customer/CustomerEdit.jsx'
import SendMail from './pages/SendMail.jsx'
import TemplatesPage from './pages/TemplatesPage.jsx'
import EmailSettingsPage from './pages/EmailSettingsPage.jsx'
import UserEmailModule from './pages/UserEmailModule.jsx'

function AdminGuard({ children }) {
  try {
    const stored = localStorage.getItem('rp_user')
    const user = stored ? JSON.parse(stored) : null
    if (user?.role === 'superuser' || user?.role === 'admin') return children
  } catch {}
  return <Navigate to="/" replace />
}

function SearchPageChatbot() {
  const location = useLocation()
  if (location.pathname !== '/') return null
  return <ChatLauncher />
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const auth = sessionStorage.getItem('userLoginAuth')
    setIsAuthenticated(auth === 'true')
  }, [])

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

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
        {/* Main app routes with DashboardLayout */}
        <Route path="/" element={<DashboardLayout><SearchPeople /></DashboardLayout>} />
        <Route path="/jobs" element={<DashboardLayout><Jobs /></DashboardLayout>} />
        <Route path="/upload" element={<DashboardLayout><Upload /></DashboardLayout>} />
        <Route path="/find-jobs" element={<DashboardLayout><FindJobs /></DashboardLayout>} />
        <Route path="/jobs/:jobId/applied" element={<DashboardLayout><AppliedCandidatesPage /></DashboardLayout>} />
        {/* Customer routes */}
        <Route path="/customer" element={<DashboardLayout><CustomerPage /></DashboardLayout>} />
        <Route path="/customer/new" element={<DashboardLayout><CustomerCreate /></DashboardLayout>} />
        <Route path="/customer/:id/edit" element={<DashboardLayout><CustomerEdit /></DashboardLayout>} />
        <Route path="/customer/:id" element={<DashboardLayout><CustomerDetail /></DashboardLayout>} />
        {/* Send Mail page */}
        <Route path="/send-mail" element={<DashboardLayout><SendMail /></DashboardLayout>} />
        {/* User section */}
        <Route path="/user/email" element={<DashboardLayout><UserEmailModule /></DashboardLayout>} />
        <Route path="/user" element={<DashboardLayout><EmailSettingsPage /></DashboardLayout>} />
        <Route path="/user/email-settings" element={<DashboardLayout><EmailSettingsPage /></DashboardLayout>} />
        {/* Templates page (part of Customer module) */}
        <Route path="/customer/templates" element={<DashboardLayout><TemplatesPage /></DashboardLayout>} />
        {/* Admin routes — protected by role check */}
        <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
          <Route index element={<DashboardOverview />} />
          <Route path="upload-metrics" element={<UploadMetrics />} />
          <Route path="email-tracking" element={<EmailTrackingDashboard />} />
          <Route path="users" element={<UsersManagement />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="candidate-templates" element={<CandidateTemplates />} />
          <Route path="resumes" element={<AdminResumes />} />
        </Route>
        {/* Catch-all: redirect unmatched routes (e.g. /admin/login) to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SearchPageChatbot />
    </UploadProvider>
  )
}

export default function App() {
  // v2 – basename ensures React Router matches /dev/* routes correctly
  const basePath = import.meta.env.VITE_BASE_PATH || ''
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter basename={basePath || '/'}>
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}
