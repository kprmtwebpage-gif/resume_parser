import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { UploadProvider } from './contexts/UploadContext'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import SearchPeople from './pages/SearchPeople.jsx'
import Jobs from './pages/Jobs.jsx'
import Upload from './pages/Upload.jsx'
import FindJobs from './pages/FindJobs.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminResumes from './pages/AdminResumes.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import { Navigate } from 'react-router-dom'
import DashboardOverview from './pages/admin/DashboardOverview.jsx'
import UploadMetrics from './pages/admin/UploadMetrics.jsx'
import UsersManagement from './pages/admin/UsersManagement.jsx'
import ActivityLog from './pages/admin/ActivityLog.jsx'
import ServerStatus from './components/ServerStatus.jsx'
import ChatLauncher from './chatbot/ChatLauncher.jsx'
import LoginPage from './login/LoginPage.jsx'

function AdminGuard({ children }) {
  try {
    const stored = localStorage.getItem('rp_user')
    const user = stored ? JSON.parse(stored) : null
    if (user?.role === 'admin') return children
  } catch {}
  return <Navigate to="/" replace />
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

  return (
    <>
      <ServerStatus />
      <Routes>
        {/* Main app routes with DashboardLayout */}
        <Route path="/" element={<DashboardLayout><SearchPeople /></DashboardLayout>} />
        <Route path="/jobs" element={<DashboardLayout><Jobs /></DashboardLayout>} />
        <Route path="/upload" element={<UploadProvider><DashboardLayout><Upload /></DashboardLayout></UploadProvider>} />
        <Route path="/find-jobs" element={<DashboardLayout><FindJobs /></DashboardLayout>} />
        {/* Admin routes — protected by role check */}
        <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
          <Route index element={<DashboardOverview />} />
          <Route path="upload-metrics" element={<UploadMetrics />} />
          <Route path="users" element={<UsersManagement />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="resumes" element={<AdminResumes />} />
        </Route>
      </Routes>
      <ChatLauncher />
    </>
  )
}

export default function App() {
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
