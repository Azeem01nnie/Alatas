import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_USE_SUPABASE === 'true' && url && key,
)

if (!isSupabaseConfigured) {
  console.warn(
    '[alatas-mobile] Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_USE_SUPABASE=true',
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
    throw new Error('Supabase is not configured. Check mobile env (EXPO_PUBLIC_SUPABASE_*).')
  }
  return supabase
}
