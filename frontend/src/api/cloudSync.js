const BASE_URL =
  import.meta.env.VITE_RENDER_API_URL ||
  import.meta.env.VITE_CLOUD_API_URL ||
  ''

export const CLOUD_SYNC_ENABLED =
  import.meta.env.VITE_CLOUD_SYNC_ENABLED === 'true' && Boolean(BASE_URL)

export function getCloudApiUrl() {
  return BASE_URL.replace(/\/$/, '')
}

export function isCloudConfigured() {
  return Boolean(BASE_URL)
}

async function cloudRequest(path, options = {}) {
  const url = `${getCloudApiUrl()}${path}`
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Cloud API failed: ${response.status} ${response.statusText} ${errorText}`)
  }
  return response.json()
}

/** Pull changes from Render master — only when VITE_CLOUD_SYNC_ENABLED=true */
export async function pullFromCloud(lastPulledAt = 0) {
  if (!CLOUD_SYNC_ENABLED) {
    return { skipped: true, reason: 'Cloud sync is not enabled' }
  }
  return cloudRequest(`/api/sync/pull?last_pulled_at=${encodeURIComponent(lastPulledAt)}`)
}

/** Push local queue item to Render — only when enabled */
export async function pushToCloud(changes, lastPulledAt = 0) {
  if (!CLOUD_SYNC_ENABLED) {
    return { skipped: true, reason: 'Cloud sync is not enabled' }
  }
  return cloudRequest('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({ changes, last_pulled_at: lastPulledAt }),
  })
}

export async function fetchCloudPendingRentals() {
  if (!isCloudConfigured()) return []
  return cloudRequest('/api/pending-rentals')
}

export async function acceptCloudPendingRental(id) {
  if (!isCloudConfigured()) {
    throw new Error('Cloud URL is not configured')
  }
  return cloudRequest(`/api/pending-rentals/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
  })
}

export async function rejectCloudPendingRental(id, reason = '') {
  if (!isCloudConfigured()) {
    throw new Error('Cloud URL is not configured')
  }
  return cloudRequest(`/api/pending-rentals/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function fetchCloudSystemStatus() {
  if (!isCloudConfigured()) {
    return { configured: false, enabled: false }
  }
  try {
    const status = await cloudRequest('/api/system/status')
    return { configured: true, enabled: CLOUD_SYNC_ENABLED, ...status }
  } catch (err) {
    return { configured: true, enabled: CLOUD_SYNC_ENABLED, reachable: false, error: err.message }
  }
}

export async function fetchCloudEmployees() {
  if (!isCloudConfigured()) return []
  return cloudRequest('/api/employees')
}

export async function createCloudEmployee(employee) {
  if (!isCloudConfigured()) throw new Error('Cloud URL is not configured')
  return cloudRequest('/api/employees', {
    method: 'POST',
    body: JSON.stringify(employee),
  })
}

export async function updateCloudEmployee(id, patch) {
  if (!isCloudConfigured()) throw new Error('Cloud URL is not configured')
  return cloudRequest(`/api/employees/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteCloudEmployee(id) {
  if (!isCloudConfigured()) throw new Error('Cloud URL is not configured')
  return cloudRequest(`/api/employees/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function fetchCloudChatMessages({ threadId, since, limit } = {}) {
  if (!isCloudConfigured()) return []
  const params = new URLSearchParams()
  if (threadId) params.set('threadId', threadId)
  if (since) params.set('since', since)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  return cloudRequest(`/api/chat/messages${qs ? `?${qs}` : ''}`)
}

export async function sendCloudChatMessage(payload) {
  if (!isCloudConfigured()) throw new Error('Cloud URL is not configured')
  return cloudRequest('/api/chat/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchCloudChatThreads({ archived = false } = {}) {
  if (!isCloudConfigured()) return []
  const qs = archived ? '?archived=1' : ''
  return cloudRequest(`/api/chat/threads${qs}`)
}

export async function setCloudChatThreadArchived(threadId, archived) {
  if (!isCloudConfigured()) throw new Error('Cloud URL is not configured')
  return cloudRequest(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: Boolean(archived) }),
  })
}
