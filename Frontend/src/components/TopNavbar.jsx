import logoUrl from '../assets/company-logo.png'

const nav = [
  // All navigation tabs removed as they have no function assigned
  // { label: 'Search', active: true },
  // { label: 'Job Projects' },
  // { label: 'Lead Lists' },
  // { label: 'Sequences' },
  // { label: 'Data Enrichment' },
]

function classNames(...xs) {
  return xs.filter(Boolean).join(' ')
}

export default function TopNavbar() {
  return (
    <header className="fixed top-0 z-40 w-full bg-white/80 backdrop-blur-lg shadow-lg border-b border-slate-200/50">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-6">
        <div className="flex items-center">
          <img src={logoUrl} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain drop-shadow-md hover:scale-105 transition-transform cursor-pointer" />
        </div>

        <nav className="hidden flex-1 items-center gap-2 md:flex">
          {nav.map((item) => (
            <button
              key={item.label}
              type="button"
              className={classNames(
                'rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-200',
                item.active
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:scale-105'
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Non-functional buttons and credits dropdown - commented out until implemented */}
          {/* 
          <button type="button" className="btn-secondary hidden sm:inline-flex">
            Earn Credits
          </button>
          <button type="button" className="btn-secondary hidden sm:inline-flex">
            Book Demo
          </button>
          <button type="button" className="btn-primary">Upgrade</button>
          
          <Menu as="div" className="relative">
            <Menu.Button>...</Menu.Button>
          </Menu>
          */}
        </div>
      </div>
    </header>
  )
}
