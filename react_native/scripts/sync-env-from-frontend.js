/**
 * Copy Supabase (and related) vars from frontend/.env → react_native/.env
 * Run: npm run env:sync
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', '..')
const frontendEnv = path.join(root, 'frontend', '.env')
const outEnv = path.join(__dirname, '..', '.env')

const MAP = {
  VITE_SUPABASE_URL: 'EXPO_PUBLIC_SUPABASE_URL',
  VITE_SUPABASE_ANON_KEY: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  VITE_USE_SUPABASE: 'EXPO_PUBLIC_USE_SUPABASE',
}

function parseEnv(text) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
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
    out[key] = val
  }
  return out
}

if (!fs.existsSync(frontendEnv)) {
  console.error('Missing frontend/.env — create it from frontend/.env.example first.')
  process.exit(1)
}

const parsed = parseEnv(fs.readFileSync(frontendEnv, 'utf8'))
const lines = [
  '# Auto-synced from frontend/.env — run: npm run env:sync',
  '',
]

for (const [from, to] of Object.entries(MAP)) {
  if (parsed[from] != null && String(parsed[from]).trim() !== '') {
    lines.push(`${to}=${parsed[from]}`)
  }
}

if (!lines.some((l) => l.startsWith('EXPO_PUBLIC_SUPABASE_URL='))) {
  console.error('frontend/.env has no VITE_SUPABASE_URL.')
  process.exit(1)
}
if (!lines.some((l) => l.startsWith('EXPO_PUBLIC_SUPABASE_ANON_KEY='))) {
  console.error('frontend/.env has no VITE_SUPABASE_ANON_KEY.')
  process.exit(1)
}

if (!lines.some((l) => l.startsWith('EXPO_PUBLIC_USE_SUPABASE='))) {
  lines.push('EXPO_PUBLIC_USE_SUPABASE=true')
}

lines.push('')
fs.writeFileSync(outEnv, lines.join('\n'), 'utf8')
console.log('Wrote', outEnv)
console.log('Restart Expo: Ctrl+C then npx expo start')
