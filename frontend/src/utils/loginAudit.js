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

function resolveAuditRole(username, role) {
  const roleRaw = String(role || '').trim().toLowerCase()
  if (roleRaw === 'admin' || roleRaw === 'employee') return roleRaw
  const user = String(username || '').trim().toLowerCase()
  if (user === 'alatas') return 'admin'
  if (user && user !== 'unknown') return 'employee'
  return 'unknown'
}

function normalizeEntry(entry) {
  const username = sanitizeUsername(entry?.username || 'unknown') || 'unknown'
  return {
    id: String(entry?.id || `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    username,
    role: resolveAuditRole(username, entry?.role),
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

/** Push via security-definer RPC — works even with wrong credentials (no session). */
async function pushRemoteAuditViaRpc(entry) {
  if (!isSupabaseConfigured) return null
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('record_login_audit', {
    p_username: entry.username,
    p_status: entry.status,
    p_role: entry.role || 'unknown',
    p_detail: entry.detail || '',
    p_user_agent: entry.userAgent || '',
    p_fingerprint: entry.fingerprint || '',
  })
  if (error) throw error
  return data ? normalizeEntry({ ...entry, ...data }) : entry
}

async function pushRemoteAuditFallback(entries) {
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
    console.warn('Could not sync login audit fallback', err)
  }
}

export async function fetchLoginAudit() {
  const local = loadLocalLoginAudit()
  if (!isSupabaseConfigured) return local

  try {
    const sb = requireSupabase()
    const remoteEntries = []

    const { data: settingsRow, error: settingsErr } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', REMOTE_KEY)
      .maybeSingle()
    if (!settingsErr && Array.isArray(settingsRow?.value?.entries)) {
      settingsRow.value.entries.forEach((row) => remoteEntries.push(normalizeEntry(row)))
    }

    // Optional dedicated table (if migration applied)
    try {
      const { data: tableRows, error: tableErr } = await sb
        .from('audit_logs')
        .select('id, username, role, status, detail, user_agent, fingerprint, created_at')
        .eq('event_type', 'login')
        .order('created_at', { ascending: false })
        .limit(100)
      if (!tableErr && Array.isArray(tableRows)) {
        tableRows.forEach((row) =>
          remoteEntries.push(
            normalizeEntry({
              id: row.id,
              username: row.username,
              role: row.role,
              status: row.status,
              detail: row.detail,
              userAgent: row.user_agent,
              fingerprint: row.fingerprint,
              createdAt: row.created_at,
            }),
          ),
        )
      }
    } catch {
      /* table may not exist yet */
    }

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
 * Record a login attempt.
 * Uses Supabase RPC so failed attempts from any device still reach the admin audit trail.
 */
export async function recordLoginAudit({
  username,
  status,
  detail = '',
  suspicious = false,
  role = '',
} = {}) {
  const fp = getDeviceFingerprint()
  const entry = normalizeEntry({
    username,
    role,
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

  try {
    const remote = await pushRemoteAuditViaRpc(entry)
    if (remote?.id && remote.id !== entry.id) {
      const withRemoteId = [remote, ...loadLocalLoginAudit().filter((r) => r.id !== entry.id)].slice(
        0,
        MAX_LOCAL,
      )
      saveLocalLoginAudit(withRemoteId)
      return remote
    }
  } catch (err) {
    console.warn('Login audit RPC unavailable; using session fallback', err?.message || err)
    await pushRemoteAuditFallback(next)
  }

  return entry
}

export function formatAuditStatus(status) {
  if (status === 'success') return 'Success'
  if (status === 'suspicious') return 'Suspicious'
  return 'Failed'
}

export function formatAuditRole(role) {
  if (role === 'admin') return 'Admin'
  if (role === 'employee') return 'Employee'
  return '—'
}
