import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { createClient } from '@supabase/supabase-js'

const extra = Constants.expoConfig?.extra || {}

const useSupabaseFlag =
  process.env.EXPO_PUBLIC_USE_SUPABASE === 'true' ||
  extra.useSupabase === true ||
  String(extra.useSupabase) === 'true'

const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '')
  .trim()
  .replace(/\/$/, '')
const key = String(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '',
).trim()

export function getSupabaseConfigDebug() {
  return {
    useSupabase: useSupabaseFlag,
    url: url ? `${url.slice(0, 28)}…` : '(empty)',
    hasKey: Boolean(key && key.length > 20),
    placeholder: isPlaceholderSupabaseConfig(),
  }
}

export function isPlaceholderSupabaseConfig() {
  if (!url || !key) return true
  if (/your-project|your_project|example\.com/i.test(url)) return true
  if (/^your[-_]|placeholder|example/i.test(key)) return true
  return false
}

export const isSupabaseConfigured = Boolean(
  useSupabaseFlag && url && key && !isPlaceholderSupabaseConfig(),
)

if (!isSupabaseConfigured) {
  console.warn(
    '[alatas] Supabase is not configured. Set real values in react_native/.env (same as frontend/.env), then restart Expo.',
  )
}

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

export function requireSupabase() {
  if (!supabase) {
    if (isPlaceholderSupabaseConfig()) {
      throw new Error(
        'Supabase still has placeholder .env values. Copy URL and anon key from frontend/.env into react_native/.env, then restart Expo (Ctrl+C, npx expo start).',
      )
    }
    throw new Error('Supabase is not configured. Check react_native/.env')
  }
  return supabase
}

export function mapAuthNetworkError(message) {
  const text = String(message || '')
  if (/failed to fetch|network request failed|network error/i.test(text)) {
    return 'Cannot reach Supabase. Check internet, .env URL/key (not .env.example placeholders), and restart Expo after changing .env.'
  }
  return text || 'Sign in failed.'
}
