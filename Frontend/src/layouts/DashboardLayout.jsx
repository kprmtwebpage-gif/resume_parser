import TopNavbar from '../components/TopNavbar.jsx'

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-neutral-100">
      <TopNavbar />
      <div className="pt-16">{children}</div>
    </div>
  )
}
