import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { BASE_PATH } from './config'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import SearchPeople from './pages/SearchPeople.jsx'
import Jobs from './pages/Jobs.jsx'
import Upload from './pages/Upload.jsx'
import ServerStatus, { IS_LOCAL } from './components/ServerStatus.jsx'
import ChatLauncher from './chatbot/ChatLauncher.jsx'

export default function App() {
  return (
    <BrowserRouter basename={BASE_PATH}>
      {IS_LOCAL && <ServerStatus />}
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<SearchPeople />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/upload" element={<Upload />} />
        </Routes>
      </DashboardLayout>
      <ChatLauncher />
    </BrowserRouter>
  )
}
