import { checkHealth as supabaseHealth } from '../config/api'

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.status = status
    this.body = body
  }
}

function extractErrorText(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error.trim()
      if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message.trim()
    } catch {
      /* keep raw */
    }
  }
  return text
}

/** User-safe message — never show raw HTML error pages in the UI. */
export function formatApiError(err, context = '') {
  const status = err?.status
  const raw = String(err?.message || err || 'Unknown error')
  const body = String(err?.body || '')
  const combined = `${raw} ${body} ${context}`.toLowerCase()

  if (status === 401 || /jwt|auth|not signed|invalid login/i.test(combined)) {
    return 'Sign-in expired or invalid. Sign in again.'
  }
  if (status === 403 || /row-level security|permission|rls/i.test(combined)) {
    return 'You do not have permission for this action.'
  }
  if (status === 404) {
    return 'That record was not found on Supabase.'
  }
  if (/network|fetch failed|failed to fetch|timeout/i.test(combined)) {
    return 'Network error. Check your connection and try again.'
  }

  const cleaned = extractErrorText(raw) || extractErrorText(body) || 'Something went wrong'
  return cleaned.slice(0, 180)
}

export async function checkHealth() {
  return supabaseHealth()
}
