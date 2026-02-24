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
            'rounded-button px-5 py-2.5 text-sm font-semibold transition-all duration-200',
            active === t.key
              ? 'bg-brand-500 text-white'
              : 'bg-white text-neutral-700 border border-neutral-300 hover:border-brand-400 hover:bg-neutral-50'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
