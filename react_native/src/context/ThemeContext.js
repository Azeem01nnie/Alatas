import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ACCENT, paletteForMode } from '../theme/colors'

const THEME_STORAGE_KEY = 'alatas-rn-theme'

const ThemeContext = createContext(null)

async function readStoredMode() {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* ignore */
  }
  return 'light'
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('light')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    void (async () => {
      const stored = await readStoredMode()
      if (mounted) {
        setModeState(stored)
        setReady(true)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const setMode = useCallback(async (next) => {
    const value = next === 'dark' ? 'dark' : 'light'
    setModeState(value)
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, value)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    void setMode(mode === 'dark' ? 'light' : 'dark')
  }, [mode, setMode])

  const colors = useMemo(() => paletteForMode(mode), [mode])

  const value = useMemo(
    () => ({
      mode,
      colors,
      accent: ACCENT,
      ready,
      setMode,
      toggleTheme,
      isDark: mode === 'dark',
    }),
    [mode, colors, ready, setMode, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
