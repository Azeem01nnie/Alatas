import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_USE_SUPABASE === 'true' && url && key,
)

if (!isSupabaseConfigured) {
  console.warn(
    '[alatas] Supabase is not configured. Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_USE_SUPABASE=true',
  )
}

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Check frontend/.env')
  }
  return supabase
}
