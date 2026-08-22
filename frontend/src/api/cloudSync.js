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
