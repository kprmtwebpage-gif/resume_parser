import DashboardLayout from './layouts/DashboardLayout.jsx'
import SearchPeople from './pages/SearchPeople.jsx'
import ServerStatus from './components/ServerStatus.jsx'
import { ChatLauncher } from './chatbot'

export default function App() {
  return (
    <>
      <ServerStatus />
      <DashboardLayout>
        <SearchPeople />
      </DashboardLayout>
      <ChatLauncher />
    </>
  )
}
