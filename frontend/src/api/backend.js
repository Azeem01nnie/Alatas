// Dev: Vite on :5173 talks to API on :4000
// Packaged Electron: UI is served by the same Express host, so relative /api works
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:4000' : '')

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    let detail = errorText
    try {
      const parsed = JSON.parse(errorText)
      detail = parsed.message || parsed.error || parsed.flush?.error || errorText
    } catch {
      // ignore
    }
    if (typeof detail === 'string' && (detail.includes('<!DOCTYPE') || detail.includes('<html'))) {
      detail =
        response.status === 520 || response.status >= 500
          ? 'Cloud host (Render) is temporarily unavailable. Try again in a minute.'
          : `Server error (${response.status})`
    }
    throw new Error(
      String(detail || `Backend request failed: ${response.status} ${response.statusText}`).slice(0, 240),
    )
  }
  return response.json()
}

export function fetchVehicles() {
  return request('/api/vehicles')
}

export function replaceVehicles(vehicles) {
  return request('/api/vehicles', {
    method: 'PUT',
    body: JSON.stringify(vehicles),
  })
}

export function deleteVehicle(id) {
  return request(`/api/vehicles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function fetchRentals() {
  return request('/api/rentals')
}

export function replaceRentals(rentals) {
  return request('/api/rentals', {
    method: 'PUT',
    body: JSON.stringify(rentals),
  })
}

export function addRental(rental) {
  return request('/api/rentals', {
    method: 'POST',
    body: JSON.stringify(rental),
  })
}

export function submitPendingRental(rental) {
  return request('/api/rentals/pending', {
    method: 'POST',
    body: JSON.stringify(rental),
  })
}

export function fetchPendingRentals() {
  return request('/api/pending-rentals')
}

export function acceptPendingRental(id) {
  return request(`/api/pending-rentals/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
  })
}

export function rejectPendingRental(id, reason = '') {
  return request(`/api/pending-rentals/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function fetchSystemStatus() {
  return request('/api/system/status')
}

export function fetchSyncQueue() {
  return request('/api/sync/queue')
}

export function flushSyncQueue() {
  return request('/api/sync/queue/flush', { method: 'POST' })
}

export function pullFromCloudViaBackend() {
  return request('/api/sync/cloud/pull', { method: 'POST' })
}

export function runCloudSync() {
  return request('/api/sync/cloud/run', { method: 'POST' })
}

export function fetchAdminProfile() {
  return request('/api/settings/admin-profile')
}

export function saveAdminProfileRemote(profile) {
  return request('/api/settings/admin-profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  })
}

export function fetchEmployees() {
  return request('/api/employees')
}

export function createEmployee(employee) {
  return request('/api/employees', {
    method: 'POST',
    body: JSON.stringify(employee),
  })
}

export function updateEmployee(id, patch) {
  return request(`/api/employees/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function deleteEmployee(id) {
  return request(`/api/employees/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function authenticateEmployee(username, password) {
  return request('/api/employees/auth', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function fetchChatMessages({ threadId, since, limit } = {}) {
  const params = new URLSearchParams()
  if (threadId) params.set('threadId', threadId)
  if (since) params.set('since', since)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  return request(`/api/chat/messages${qs ? `?${qs}` : ''}`)
}

export function sendChatMessage(payload) {
  return request('/api/chat/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchChatThreads({ archived = false } = {}) {
  const qs = archived ? '?archived=1' : ''
  return request(`/api/chat/threads${qs}`)
}

export function setChatThreadArchivedRemote(threadId, archived) {
  return request(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: Boolean(archived) }),
  })
}
