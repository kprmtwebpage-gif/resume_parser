import { NavLink } from 'react-router-dom'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../contexts/ThemeContext'
import logoUrl from '../assets/company-logo.png'

const navItems = [
  { label: 'Search', path: '/' },
  { label: 'Jobs', path: '/jobs' },
  { label: 'Upload', path: '/upload' },
]

export default function TopNavbar() {
  const { isDark, toggleTheme, colors } = useTheme()

  const handleLogout = () => {
    sessionStorage.removeItem('userLoginAuth')
    window.location.reload()
  }

  return (
    <header 
      className="fixed top-0 z-40 w-full shadow-sm transition-colors duration-300"
      style={{ 
        backgroundColor: colors.background, 
        borderBottom: `1px solid ${colors.border}` 
      }}
    >
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left side: Logo + Nav */}
        <div className="flex items-center gap-6">
          <img src={logoUrl} alt="Company Logo" className="h-10 w-auto object-contain" />
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.path}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-500 text-white'
                      : isDark 
                        ? 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right side: Theme toggle + Logout */}
        <div className="flex items-center gap-2">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
            style={{
              backgroundColor: isDark ? colors.card : colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text
            }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <SunIcon className="h-4 w-4" />
            ) : (
              <MoonIcon className="h-4 w-4" />
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
            title="Logout"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
