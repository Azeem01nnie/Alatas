import { isSupabaseConfigured, requireSupabase } from './supabaseClient'

/** Legacy REST URL kept for display only when Supabase is primary. */
export const API_URL = isSupabaseConfigured
  ? process.env.EXPO_PUBLIC_SUPABASE_URL || 'supabase'
  : (
      process.env.EXPO_PUBLIC_API_URL ||
      process.env.EXPO_PUBLIC_DEV_API_URL ||
      'https://alatas-q5ks.onrender.com'
    ).replace(/\/$/, '')

export async function checkHealth() {
  if (!isSupabaseConfigured) {
    return { ok: false, mode: 'unconfigured' }
  }
  try {
    const sb = requireSupabase()
    const { error } = await sb.from('vehicles').select('id', { count: 'exact', head: true })
    if (error) return { ok: false, mode: 'supabase', error: error.message }
    return { ok: true, mode: 'supabase' }
  } catch (err) {
    return { ok: false, mode: 'supabase', error: err?.message || String(err) }
  }
}
