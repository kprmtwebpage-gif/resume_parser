import { useState } from 'react'

function SettingSection({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-5">
        <h3 className="text-[14px] font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-[12px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] font-medium text-gray-900">{label}</p>
        {description && <p className="text-[12px] text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

export default function Settings() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState('30')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <p className="text-[13px] text-gray-400 mt-1">Configure your admin dashboard preferences</p>
      </div>

      {/* Dashboard Settings */}
      <SettingSection title="Dashboard" subtitle="Configure dashboard behavior">
        <Toggle
          label="Auto Refresh"
          description="Automatically refresh dashboard data periodically"
          checked={autoRefresh}
          onChange={setAutoRefresh}
        />
        {autoRefresh && (
          <div>
            <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider">Refresh Interval</label>
            <select
              value={refreshInterval}
              onChange={e => setRefreshInterval(e.target.value)}
              className="mt-1 block w-48 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-[13px] text-gray-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
            >
              <option value="15">15 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="300">5 minutes</option>
            </select>
          </div>
        )}
      </SettingSection>

      {/* Notification Settings */}
      <SettingSection title="Notifications" subtitle="Manage alert preferences">
        <Toggle
          label="Email Notifications"
          description="Receive email alerts for critical events"
          checked={emailNotifications}
          onChange={setEmailNotifications}
        />
      </SettingSection>

      {/* Appearance */}
      <SettingSection title="Appearance" subtitle="Customize visual preferences">
        <Toggle
          label="Dark Mode"
          description="Switch the dashboard to a dark color scheme (coming soon)"
          checked={darkMode}
          onChange={setDarkMode}
        />
      </SettingSection>

      {/* System Info */}
      <SettingSection title="System Information" subtitle="Platform details">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Platform', value: 'Resume Parsing Platform' },
            { label: 'Version', value: 'v2.0.0' },
            { label: 'Backend', value: 'FastAPI + PostgreSQL' },
            { label: 'Frontend', value: 'React + Vite' },
          ].map((item, i) => (
            <div key={i}>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{item.label}</p>
              <p className="text-[13px] font-medium text-gray-700 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </SettingSection>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="rounded-xl bg-blue-500 px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-600 shadow-sm hover:shadow transition"
        >
          Save Settings
        </button>
        {saved && (
          <span className="text-[13px] font-medium text-emerald-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Settings saved
          </span>
        )}
      </div>
    </div>
  )
}
