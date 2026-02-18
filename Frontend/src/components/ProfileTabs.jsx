const tabs = [
  { key: 'skills', label: 'Skills' },
  { key: 'experience', label: 'Work Experience' },
  { key: 'education', label: 'Education' },
]

function classNames(...xs) {
  return xs.filter(Boolean).join(' ')
}

export default function ProfileTabs({ active, onChange }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3 pb-5">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={classNames(
            'rounded-xl px-5 py-3 text-sm font-bold transition-all duration-200',
            active === t.key
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30 scale-105'
              : 'bg-white text-slate-700 ring-2 ring-slate-200 hover:ring-blue-400 hover:shadow-md hover:scale-105'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
