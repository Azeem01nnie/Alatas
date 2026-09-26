/**
 * Client-side security helpers for Alatas desk (XSS / CSRF / injection guards).
 * Supabase queries stay parameterized; these harden UI input and sensitive actions.
 */

const CSRF_KEY = 'alatas-csrf-token'
const FINGERPRINT_KEY = 'alatas-device-fingerprint'

/** Escape text for safe HTML insertion (defense in depth; prefer React text nodes). */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strip tags / control chars from user-facing text fields.
 * Does not trim — callers that sanitize on every keystroke must keep trailing spaces
 * so users can type multi-word names; trim on blur/save instead.
 */
export function sanitizeUserText(value, { maxLength = 200 } = {}) {
  let text = String(value ?? '')
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  text = text.replace(/<[^>]*>/g, '')
  text = text.replace(/javascript:/gi, '')
  text = text.replace(/on\w+\s*=/gi, '')
  if (text.length > maxLength) text = text.slice(0, maxLength)
  return text
}

/** Username-safe: letters, numbers, @ . _ - only. */
export function sanitizeUsername(value) {
  return sanitizeUserText(value, { maxLength: 64 })
    .replace(/[^\w.@+-]/g, '')
    .slice(0, 64)
}

/**
 * Guard values used in .eq / .in filters — reject characters that belong in SQL fragments.
 * Supabase client already parameterizes; this blocks accidental raw-SQL construction.
 */
export function assertSafeDbId(value, label = 'id') {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`Invalid ${label}`)
  if (!/^[a-zA-Z0-9_.:@+-]{1,128}$/.test(text)) {
    throw new Error(`Invalid ${label} format`)
  }
  if (/('|--|;|\/\*|\*\/|xp_|union\s+select|drop\s+table)/i.test(text)) {
    throw new Error(`Rejected unsafe ${label}`)
  }
  return text
}

export function sanitizeForLikeFilter(value) {
  return sanitizeUserText(value, { maxLength: 80 })
    .replace(/[%_\\]/g, '')
    .slice(0, 80)
}

function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function ensureCsrfToken() {
  try {
    let token = sessionStorage.getItem(CSRF_KEY)
    if (!token || token.length < 32) {
      token = randomToken(32)
      sessionStorage.setItem(CSRF_KEY, token)
    }
    return token
  } catch {
    return randomToken(32)
  }
}

export function getCsrfToken() {
  try {
    return sessionStorage.getItem(CSRF_KEY) || ''
  } catch {
    return ''
  }
}

export function clearCsrfToken() {
  try {
    sessionStorage.removeItem(CSRF_KEY)
  } catch {
    /* ignore */
  }
}

/** Require a valid same-session CSRF token for destructive admin actions. */
export function requireCsrfToken(token) {
  const expected = getCsrfToken()
  if (!expected || !token || token !== expected) {
    throw new Error('Security check failed (CSRF). Refresh and try again.')
  }
  return true
}

/** Same-origin check for state-changing browser actions. */
export function assertSameOriginRequest() {
  if (typeof window === 'undefined') return true
  try {
    const page = window.location.origin
    if (document.referrer) {
      const ref = new URL(document.referrer).origin
      if (ref !== page && ref !== 'null') {
        // Allow empty referrer (typed URL / Electron); block cross-site referrers.
        throw new Error('Blocked cross-origin request.')
      }
    }
  } catch (err) {
    if (err?.message?.includes('Blocked')) throw err
  }
  return true
}

export function isSecureTransport() {
  if (typeof window === 'undefined') return true
  const { protocol, hostname } = window.location
  if (protocol === 'https:') return true
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true
  // Electron file / custom schemes still talk to HTTPS Supabase
  if (protocol === 'file:' || protocol === 'app:') return true
  return false
}

export function getTransportLabel() {
  if (typeof window === 'undefined') return { secure: true, label: 'Secure channel' }
  if (window.location.protocol === 'https:') {
    return { secure: true, label: 'HTTPS — encrypted in transit' }
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return { secure: true, label: 'Local desk — API uses HTTPS (Supabase)' }
  }
  if (window.location.protocol === 'file:' || window.location.protocol === 'app:') {
    return { secure: true, label: 'Desktop app — auth over HTTPS (Supabase)' }
  }
  return { secure: false, label: 'Not HTTPS — use a secure URL' }
}

export function getDeviceFingerprint() {
  try {
    const raw = [
      navigator.userAgent || '',
      navigator.language || '',
      String(screen?.width || ''),
      String(screen?.height || ''),
      String(new Date().getTimezoneOffset()),
    ].join('|')
    let hash = 0
    for (let i = 0; i < raw.length; i += 1) {
      hash = (hash << 5) - hash + raw.charCodeAt(i)
      hash |= 0
    }
    return `fp_${Math.abs(hash).toString(16)}`
  } catch {
    return 'fp_unknown'
  }
}

export function getKnownFingerprints() {
  try {
    const raw = localStorage.getItem(FINGERPRINT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function rememberFingerprint(fp) {
  const known = getKnownFingerprints()
  if (!known.includes(fp)) {
    const next = [fp, ...known].slice(0, 8)
    try {
      localStorage.setItem(FINGERPRINT_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
}

export function isSuspiciousLogin(fp) {
  const known = getKnownFingerprints()
  if (!known.length) return false
  return !known.includes(fp)
}

/**
 * AES-GCM encrypt a string for local sensitive cache (encryption at rest on device).
 * Key is session-scoped in memory + persisted wrapped marker — best-effort client protection.
 */
const LOCAL_KEY_MATERIAL = 'alatas-local-ear-v1'

async function getLocalAesKey() {
  const enc = new TextEncoder()
  const base = await crypto.subtle.digest('SHA-256', enc.encode(LOCAL_KEY_MATERIAL + getCsrfToken()))
  return crypto.subtle.importKey('raw', base, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptAtRest(plainText) {
  const key = await getLocalAesKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(String(plainText ?? ''))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const packed = new Uint8Array(iv.length + cipher.byteLength)
  packed.set(iv, 0)
  packed.set(new Uint8Array(cipher), iv.length)
  let binary = ''
  packed.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return `ear1:${btoa(binary)}`
}

export async function decryptAtRest(payload) {
  if (!payload || typeof payload !== 'string' || !payload.startsWith('ear1:')) {
    return null
  }
  try {
    const raw = atob(payload.slice(5))
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0))
    const iv = bytes.slice(0, 12)
    const data = bytes.slice(12)
    const key = await getLocalAesKey()
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

export const SECURITY_FEATURES = [
  {
    id: 'xss',
    title: 'XSS prevention',
    detail: 'User text is sanitized; React escapes output; CSP blocks inline script.',
  },
  {
    id: 'csrf',
    title: 'CSRF protection',
    detail: 'Session CSRF tokens gate destructive admin actions; same-origin checks apply.',
  },
  {
    id: 'sqli',
    title: 'SQL injection protection',
    detail: 'All database access uses parameterized Supabase/PostgREST queries — no raw SQL from the client.',
  },
  {
    id: 'ear',
    title: 'Encryption at rest',
    detail: 'Supabase encrypts database & storage at rest; sensitive local cache uses AES-GCM.',
  },
  {
    id: 'https',
    title: 'Secure transport',
    detail: 'Authentication and API calls use HTTPS to Supabase Auth.',
  },
]
