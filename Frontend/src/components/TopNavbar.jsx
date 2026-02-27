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

  return (
    <header 
      className="fixed top-0 z-40 w-full shadow-sm transition-colors duration-300"
      style={{ 
        backgroundColor: colors.background, 
        borderBottom: `1px solid ${colors.border}` 
      }}
    >
      <div className="flex h-16 items-center gap-6">
        <div className="flex items-center pl-4">
          <img src={logoUrl} alt="Company Logo" className="h-12 w-auto object-contain" />
        </div>

        <nav className="hidden flex-1 items-center gap-2 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) =>
                `rounded-button px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
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

        <div className="ml-auto flex items-center gap-2 pr-4">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300"
            style={{
              backgroundColor: isDark ? colors.card : colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text
            }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
