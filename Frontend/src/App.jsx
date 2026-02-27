import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import SearchPeople from './pages/SearchPeople.jsx'
import Jobs from './pages/Jobs.jsx'
import Upload from './pages/Upload.jsx'
import ServerStatus from './components/ServerStatus.jsx'
import ChatLauncher from './chatbot/ChatLauncher.jsx'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ServerStatus />
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<SearchPeople />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/upload" element={<Upload />} />
          </Routes>
        </DashboardLayout>
        <ChatLauncher />
      </BrowserRouter>
    </ThemeProvider>
  )
}
