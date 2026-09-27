const fs = require('fs')
const path = require('path')

/** Load <repo>/env/.env into process.env (existing vars win). */
function loadSharedEnv() {
  const file = path.resolve(__dirname, '..', 'env', '.env')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = val
  }
  // Mobile reuses the web Supabase project unless EXPO_PUBLIC_* is set explicitly.
  const fallbacks = {
    EXPO_PUBLIC_SUPABASE_URL: 'VITE_SUPABASE_URL',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'VITE_SUPABASE_ANON_KEY',
    EXPO_PUBLIC_USE_SUPABASE: 'VITE_USE_SUPABASE',
  }
  for (const [expoKey, viteKey] of Object.entries(fallbacks)) {
    if (!process.env[expoKey] && process.env[viteKey]) process.env[expoKey] = process.env[viteKey]
  }
}

loadSharedEnv()

module.exports = ({ config }) => {
  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const useSupabase = process.env.EXPO_PUBLIC_USE_SUPABASE === 'true'

  return {
    ...config,
    name: config.name || 'Alatas',
    slug: config.slug || 'alatas',
    extra: {
      ...(config.extra || {}),
      useSupabase,
      supabaseUrl,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    },
  }
}
