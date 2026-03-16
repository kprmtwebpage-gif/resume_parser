import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import SearchPeople from './pages/SearchPeople.jsx'
import Jobs from './pages/Jobs.jsx'
import Upload from './pages/Upload.jsx'
import FindJobs from './pages/FindJobs.jsx'
import ServerStatus from './components/ServerStatus.jsx'
import ChatLauncher from './chatbot/ChatLauncher.jsx'
import LoginPage from './login/LoginPage.jsx'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check if user is authenticated on mount
    const auth = sessionStorage.getItem('userLoginAuth')
    setIsAuthenticated(auth === 'true')
  }, [])

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  // Show dashboard if authenticated
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ServerStatus />
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<SearchPeople />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/find-jobs" element={<FindJobs />} />
          </Routes>
        </DashboardLayout>
        <ChatLauncher />
      </BrowserRouter>
    </ThemeProvider>
  )
}
