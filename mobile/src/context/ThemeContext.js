import React, { createContext, useState, useContext, useMemo } from 'react'
import { ACCENT, ACCENT_SOFT, ACCENT_SOFT_DARK } from '../theme/colors'

const ThemeContext = createContext()

export const ThemeProvider = ({ children }) => {
  const [activeTheme, setActiveTheme] = useState('Light')

  const isDark = activeTheme === 'Dark'

  const theme = useMemo(
    () => ({
      bg: isDark ? '#0f172a' : '#f8fafc',
      card: isDark ? '#1e293b' : '#ffffff',
      textMain: isDark ? '#f8fafc' : '#0f172a',
      textSub: isDark ? '#94a3b8' : '#64748b',
      border: isDark ? '#334155' : '#f1f5f9',
      iconBg: isDark ? '#334155' : '#f1f5f9',
      accent: ACCENT,
      accentSoft: isDark ? ACCENT_SOFT_DARK : ACCENT_SOFT,
    }),
    [isDark],
  )

  const value = useMemo(
    () => ({
      activeTheme,
      setActiveTheme,
      isDark,
      theme,
      toggleTheme: () => setActiveTheme((t) => (t === 'Dark' ? 'Light' : 'Dark')),
    }),
    [activeTheme, isDark, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
