import { isSupabaseConfigured, requireSupabase } from '../api/supabaseClient'
import {
  getDeviceFingerprint,
  sanitizeUsername,
  sanitizeUserText,
} from './security'
import { safeSetItem } from './storage'

const LOCAL_AUDIT_KEY = 'alatas-login-audit'
const MAX_LOCAL = 100
const REMOTE_KEY = 'login_audit'

function normalizeEntry(entry) {
  return {
    id: String(entry?.id || `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    username: sanitizeUsername(entry?.username || 'unknown') || 'unknown',
    status: ['success', 'failed', 'suspicious'].includes(entry?.status)
      ? entry.status
      : 'failed',
    detail: sanitizeUserText(entry?.detail || '', { maxLength: 240 }),
    userAgent: sanitizeUserText(entry?.userAgent || '', { maxLength: 180 }),
    fingerprint: sanitizeUserText(entry?.fingerprint || '', { maxLength: 64 }),
    createdAt: entry?.createdAt || new Date().toISOString(),
  }
}

export function loadLocalLoginAudit() {
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(normalizeEntry) : []
  } catch {
    return []
  }
}

function saveLocalLoginAudit(entries) {
  const next = (Array.isArray(entries) ? entries : []).slice(0, MAX_LOCAL)
  safeSetItem(LOCAL_AUDIT_KEY, JSON.stringify(next))
  return next
}

async function pushRemoteAudit(entries) {
  if (!isSupabaseConfigured) return
  try {
    const sb = requireSupabase()
    const {
      data: { session },
    } = await sb.auth.getSession()
    if (!session) return

    await sb.from('app_settings').upsert({
      key: REMOTE_KEY,
      value: { entries: entries.slice(0, MAX_LOCAL) },
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('Could not sync login audit', err)
  }
}

export async function fetchLoginAudit() {
  const local = loadLocalLoginAudit()
  if (!isSupabaseConfigured) return local

  try {
    const sb = requireSupabase()
    const { data, error } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', REMOTE_KEY)
      .maybeSingle()
    if (error) throw error
    const remoteEntries = Array.isArray(data?.value?.entries)
      ? data.value.entries.map(normalizeEntry)
      : []

    const byId = new Map()
    ;[...remoteEntries, ...local].forEach((row) => byId.set(row.id, row))
    const merged = [...byId.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    saveLocalLoginAudit(merged)
    return merged.slice(0, MAX_LOCAL)
  } catch {
    return local
  }
}

/**
 * Record a login attempt. Works before/after auth (local first, sync when session exists).
 */
export async function recordLoginAudit({
  username,
  status,
  detail = '',
  suspicious = false,
} = {}) {
  const fp = getDeviceFingerprint()
  const entry = normalizeEntry({
    username,
    status: suspicious ? 'suspicious' : status,
    detail:
      detail ||
      (suspicious
        ? 'Sign-in from an unrecognized device/browser'
        : status === 'success'
          ? 'Signed in successfully'
          : 'Sign-in failed'),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    fingerprint: fp,
    createdAt: new Date().toISOString(),
  })

  const next = [entry, ...loadLocalLoginAudit()].slice(0, MAX_LOCAL)
  saveLocalLoginAudit(next)
  await pushRemoteAudit(next)
  return entry
}

export function formatAuditStatus(status) {
  if (status === 'success') return 'Success'
  if (status === 'suspicious') return 'Suspicious'
  return 'Failed'
}
