/** Strip tags / control chars from user-facing text fields. */
export function sanitizeUserText(value, { maxLength = 200 } = {}) {
  let text = String(value ?? '')
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  text = text.replace(/<[^>]*>/g, '')
  text = text.replace(/javascript:/gi, '')
  text = text.replace(/on\w+\s*=/gi, '')
  text = text.trim()
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
