import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('appTheme')
    return saved === 'dark'
  })

  useEffect(() => {
    localStorage.setItem('appTheme', isDark ? 'dark' : 'light')
    
    // Apply theme class to document root
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  const toggleTheme = () => {
    setIsDark(prev => !prev)
  }

  const theme = {
    isDark,
    toggleTheme,
    colors: isDark ? {
      background: '#0f172a',
      card: '#1e293b',
      border: '#334155',
      text: '#e2e8f0',
    } : {
      background: '#ffffff',
      card: '#f8fafc',
      border: '#e2e8f0',
      text: '#1e293b',
    }
  }

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  )
}
