export const ACCENT = '#b32025'

const shared = {
  accent: ACCENT,
  accentMuted: '#8f1a1e',
  onAccent: '#ffffff',
  danger: '#c62828',
  success: '#2e7d32',
  warning: '#ed6c02',
}

export const lightPalette = {
  ...shared,
  mode: 'light',
  background: '#f4f4f5',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  border: '#e4e4e7',
  text: '#18181b',
  textSecondary: '#52525b',
  textMuted: '#71717a',
  inputBackground: '#fafafa',
  tabBar: '#ffffff',
  header: '#ffffff',
}

export const darkPalette = {
  ...shared,
  mode: 'dark',
  background: '#0f0f10',
  surface: '#18181b',
  surfaceElevated: '#27272a',
  border: '#3f3f46',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  inputBackground: '#27272a',
  tabBar: '#18181b',
  header: '#18181b',
}

export function paletteForMode(mode) {
  return mode === 'dark' ? darkPalette : lightPalette
}
