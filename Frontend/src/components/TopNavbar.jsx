import { NavLink } from 'react-router-dom'
import logoUrl from '../assets/company-logo.png'

const navItems = [
  { label: 'Search', path: '/' },
  { label: 'Jobs', path: '/jobs' },
  { label: 'Upload', path: '/upload' },
]

export default function TopNavbar() {
  return (
    <header className="fixed top-0 z-40 w-full bg-white shadow-sm border-b border-neutral-200">
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
                `rounded-button px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-500 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 pr-4">
          {/* Placeholder for future features */}
        </div>
      </div>
    </header>
  )
}
