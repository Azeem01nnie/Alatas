import { isSupabaseConfigured, requireSupabase } from '../api/supabaseClient'
import AsyncStorage from '@react-native-async-storage/async-storage'

const LOCAL_AUDIT_KEY = 'alatas-login-audit'
const MAX_LOCAL = 100

function normalizeEntry(entry) {
  return {
    id: String(entry?.id || `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    username: String(entry?.username || 'unknown'),
    role: entry?.role || 'unknown',
    status: ['success', 'failed', 'suspicious'].includes(entry?.status) ? entry.status : 'failed',
    detail: String(entry?.detail || '').slice(0, 240),
    createdAt: entry?.createdAt || entry?.created_at || new Date().toISOString(),
  }
}

async function loadLocal() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_AUDIT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(normalizeEntry) : []
  } catch {
    return []
  }
}

async function saveLocal(entries) {
  await AsyncStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify((entries || []).slice(0, MAX_LOCAL)))
}

export async function fetchLoginAudit() {
  const local = await loadLocal()
  if (!isSupabaseConfigured) return local

  try {
    const sb = requireSupabase()
    const remote = []

    const { data: settingsRow } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'login_audit')
      .maybeSingle()
    if (Array.isArray(settingsRow?.value?.entries)) {
      settingsRow.value.entries.forEach((row) => remote.push(normalizeEntry(row)))
    }

    try {
      const { data: tableRows, error } = await sb
        .from('audit_logs')
        .select('id, username, role, status, detail, created_at')
        .eq('event_type', 'login')
        .order('created_at', { ascending: false })
        .limit(50)
      if (!error && Array.isArray(tableRows)) {
        tableRows.forEach((row) =>
          remote.push(
            normalizeEntry({
              id: row.id,
              username: row.username,
              role: row.role,
              status: row.status,
              detail: row.detail,
              createdAt: row.created_at,
            }),
          ),
        )
      }
    } catch {
      /* optional table */
    }

    const byId = new Map()
    ;[...remote, ...local].forEach((row) => byId.set(row.id, row))
    const merged = [...byId.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    await saveLocal(merged)
    return merged.slice(0, MAX_LOCAL)
  } catch {
    return local
  }
}
