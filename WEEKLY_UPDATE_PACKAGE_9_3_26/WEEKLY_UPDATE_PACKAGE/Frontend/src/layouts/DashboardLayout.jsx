import { useTheme } from '../contexts/ThemeContext'
import TopNavbar from '../components/TopNavbar.jsx'

export default function DashboardLayout({ children }) {
  const { colors } = useTheme()
  
  return (
    <div 
      className="min-h-screen transition-colors duration-300" 
      style={{ backgroundColor: colors.card }}
    >
      <TopNavbar />
      <div className="pt-16">{children}</div>
    </div>
  )
}
