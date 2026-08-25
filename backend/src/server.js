import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import {
  getVehicles,
  replaceVehicles,
  getRentals,
  addRental,
  updateRentalCarPhotos,
  replaceRentals,
  deleteVehicle,
  getAdminProfile,
  setAdminProfile,
  getVehicleReports,
  setVehicleReports,
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  replaceEmployees,
  mergeEmployees,
  authenticateEmployee,
  getChatMessages,
  addChatMessage,
  getChatThreads,
  setChatThreadArchived,
  mergeChatMessages,
} from './sqlite-db.js'
import {
  getPendingRentals,
  addPendingRental,
  acceptPendingRental,
  rejectPendingRental,
  enqueueSyncItem,
  getSyncQueue,
  getSyncMeta,
  setSyncMeta,
  markQueueItemSynced,
  markQueueItemFailed,
} from './sync-db.js'

const app = express()
const PORT = Number(process.env.PORT || 4000)
const HOST = process.env.HOST || '127.0.0.1'
const serveFrontend = process.env.SERVE_FRONTEND === '1'
const frontendDist = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : null
const RENDER_API_URL = (process.env.RENDER_API_URL || '').replace(/\/$/, '')
const CLOUD_SYNC_ENABLED = process.env.CLOUD_SYNC_ENABLED === '1' && Boolean(RENDER_API_URL)

app.use(cors())
app.use(express.json({ limit: '15mb' }))

function sendError(res, err, status = 500) {
  console.error('[api]', err)
  const message = err?.message || 'Internal server error'
  res.status(status).json({ error: message })
}

function rentalUpdatedAt(rental) {
  const ts = rental.updatedAt || rental.createdAt || rental.encodedAt
  return ts ? new Date(ts).getTime() : 0
}

function flattenSyncRecords(list) {
  const out = []
  for (const entry of list) {
    if (Array.isArray(entry)) out.push(...entry)
    else if (entry != null) out.push(entry)
  }
  return out
}

function changesForQueueItem(item) {
  const payload = item.payload
  const records = Array.isArray(payload) ? payload : payload != null ? [payload] : []

  if (item.action === 'delete') {
    const deleted = Array.isArray(payload)
      ? payload.map((p) => (typeof p === 'object' ? p?.id : p)).filter(Boolean)
      : [payload?.id ?? payload].filter(Boolean)
    return { created: [], updated: [], deleted }
  }
  if (item.action === 'create') {
    return { created: records, updated: [], deleted: [] }
  }
  return { created: [], updated: records, deleted: [] }
}

async function flushQueueToCloud() {
  if (!CLOUD_SYNC_ENABLED) {
    return { ok: true, flushed: 0, skipped: true, reason: 'Cloud sync not configured' }
  }

  const queue = getSyncQueue()
  let flushed = 0

  for (const item of queue) {
    try {
      const response = await fetch(`${RENDER_API_URL}/api/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: {
            [item.entityType]: changesForQueueItem(item),
          },
          last_pulled_at: Number(getSyncMeta('last_pulled_at') || 0),
        }),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`Cloud push failed (${response.status}): ${text}`)
      }

      markQueueItemSynced(item.id)
      flushed += 1
    } catch (err) {
      markQueueItemFailed(item.id, err.message)
      return { ok: false, flushed, error: err.message }
    }
  }

  return { ok: true, flushed }
}

function applySyncChanges(changes) {
  const vehicleUpdates = flattenSyncRecords([
    ...(changes?.vehicles?.created || []),
    ...(changes?.vehicles?.updated || []),
  ])
  const rentalUpdates = flattenSyncRecords([
    ...(changes?.rentals?.created || []),
    ...(changes?.rentals?.updated || []),
  ])

  if (vehicleUpdates.length) {
    const current = getVehicles()
    const byId = new Map(current.map((v) => [String(v.id), v]))
    for (const vehicle of vehicleUpdates) {
      if (vehicle?.id) byId.set(String(vehicle.id), vehicle)
    }
    replaceVehicles([...byId.values()])
  }

  if (rentalUpdates.length) {
    const current = getRentals()
    const byId = new Map(current.map((r) => [String(r.id), r]))
    for (const rental of rentalUpdates) {
      if (!rental?.id) continue
      const key = String(rental.id)
      const existing = byId.get(key)
      if (!existing || rentalUpdatedAt(rental) >= rentalUpdatedAt(existing)) {
        byId.set(key, rental)
      }
    }
    replaceRentals([...byId.values()])
  }

  const reportStore = changes?.vehicleReports?.updated?.[0] || changes?.vehicleReports
  if (reportStore && Array.isArray(reportStore.entries)) {
    const local = getVehicleReports()
    const byId = new Map(local.entries.map((entry) => [entry.id, entry]))
    reportStore.entries.forEach((entry) => {
      if (entry?.id) byId.set(entry.id, entry)
    })
    setVehicleReports({
      entries: [...byId.values()],
      submissions: reportStore.submissions?.length ? reportStore.submissions : local.submissions,
    })
  }

  return {
    vehicles: vehicleUpdates.length,
    rentals: rentalUpdates.length,
    vehicleReports: reportStore?.entries?.length || 0,
  }
}

async function pullVehicleReportsFromCloud() {
  if (!CLOUD_SYNC_ENABLED || !RENDER_API_URL) {
    return { ok: true, skipped: true, reason: 'Cloud sync not configured' }
  }

  const response = await fetch(`${RENDER_API_URL}/api/vehicle-reports`)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Cloud vehicle reports pull failed (${response.status}): ${text}`)
  }

  const remote = await response.json()
  const local = getVehicleReports()
  if (!Array.isArray(remote?.entries) || !remote.entries.length) {
    return { ok: true, pulled: 0, entries: local.entries.length }
  }

  const byId = new Map(local.entries.map((entry) => [entry.id, entry]))
  remote.entries.forEach((entry) => {
    if (entry?.id) byId.set(entry.id, entry)
  })

  const merged = setVehicleReports({
    entries: [...byId.values()],
    submissions: remote.submissions?.length ? remote.submissions : local.submissions,
  })

  return { ok: true, pulled: remote.entries.length, entries: merged.entries.length }
}

async function pullEmployeesFromCloud() {
  if (!CLOUD_SYNC_ENABLED || !RENDER_API_URL) {
    return { ok: true, skipped: true, reason: 'Cloud sync not configured' }
  }

  const response = await fetch(`${RENDER_API_URL}/api/employees?includePassword=1`)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Cloud employees pull failed (${response.status}): ${text}`)
  }

  const remote = await response.json()
  if (!Array.isArray(remote)) {
    return { ok: true, pulled: 0 }
  }

  const localBefore = getEmployees({ includePassword: true })

  // Never wipe local employees when cloud is empty — merge instead
  if (remote.length === 0) {
    if (localBefore.length > 0) {
      try {
        await pushEmployeeMutationToCloud(
          'PUT',
          '/api/employees',
          localBefore,
        )
        return { ok: true, pulled: 0, seeded: localBefore.length }
      } catch (err) {
        console.warn('[local-api] could not seed employees to cloud', err?.message || err)
      }
    }
    return { ok: true, pulled: 0 }
  }

  mergeEmployees(remote)
  const localAfter = getEmployees({ includePassword: true })

  // Push any local-only rows back to cloud so mobile stays in sync
  if (localAfter.length > remote.length) {
    try {
      await pushEmployeeMutationToCloud('PUT', '/api/employees', localAfter)
    } catch (err) {
      console.warn('[local-api] could not push merged employees to cloud', err?.message || err)
    }
  }

  return { ok: true, pulled: remote.length, local: localAfter.length }
}

async function pushEmployeeMutationToCloud(method, path, body) {
  if (!CLOUD_SYNC_ENABLED || !RENDER_API_URL) return null
  const response = await fetch(`${RENDER_API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Cloud employee sync failed (${response.status}): ${text}`)
  }
  if (response.status === 204) return null
  return response.json()
}

async function pullFromCloudToLocal() {
  if (!CLOUD_SYNC_ENABLED) {
    return { ok: true, skipped: true, reason: 'Cloud sync not configured' }
  }

  const lastPulledAt = Number(getSyncMeta('last_pulled_at') || 0)
  const response = await fetch(
    `${RENDER_API_URL}/api/sync/pull?last_pulled_at=${encodeURIComponent(lastPulledAt)}`,
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Cloud pull failed (${response.status}): ${text}`)
  }

  const data = await response.json()
  const applied = applySyncChanges(data.changes || {})
  if (data.timestamp) {
    setSyncMeta('last_pulled_at', String(data.timestamp))
  }

  return { ok: true, applied, timestamp: data.timestamp ?? Date.now() }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'alatas-backend', host: HOST })
})

app.get('/api/system/status', (_req, res) => {
  res.json({
    ok: true,
    mode: 'local',
    cloudSyncEnabled: CLOUD_SYNC_ENABLED,
    cloudApiUrl: CLOUD_SYNC_ENABLED ? RENDER_API_URL : null,
    pendingSyncCount: getSyncQueue().length,
    pendingApprovalCount: getPendingRentals().length,
    lastPulledAt: getSyncMeta('last_pulled_at'),
  })
})

app.get('/api/settings/admin-profile', (_req, res) => {
  try {
    res.json(getAdminProfile())
  } catch (err) {
    sendError(res, err)
  }
})

app.put('/api/settings/admin-profile', async (req, res) => {
  try {
    const profile = setAdminProfile(req.body || {})
    if (CLOUD_SYNC_ENABLED && RENDER_API_URL) {
      try {
        await fetch(`${RENDER_API_URL}/api/settings/admin-profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        })
      } catch (err) {
        console.warn('[local-api] could not push admin profile to cloud', err?.message || err)
      }
    }
    res.json(profile)
  } catch (err) {
    sendError(res, err)
  }
})

app.get('/api/vehicle-reports', async (_req, res) => {
  try {
    await pullVehicleReportsFromCloud().catch((err) => {
      console.warn('[local-api] vehicle reports pull skipped', err?.message || err)
    })
    res.json(getVehicleReports())
  } catch (err) {
    sendError(res, err)
  }
})

app.put('/api/vehicle-reports', async (req, res) => {
  try {
    const store = setVehicleReports(req.body || {})
    if (CLOUD_SYNC_ENABLED && RENDER_API_URL) {
      try {
        await fetch(`${RENDER_API_URL}/api/vehicle-reports`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(store),
        })
      } catch (err) {
        console.warn('[local-api] could not push vehicle reports to cloud', err?.message || err)
      }
    }
    res.json(store)
  } catch (err) {
    sendError(res, err)
  }
})

app.get('/api/employees', async (req, res) => {
  try {
    await pullEmployeesFromCloud().catch((err) => {
      console.warn('[local-api] employees pull skipped', err?.message || err)
    })
    const includePassword = String(req.query.includePassword || '') === '1'
    res.json(getEmployees({ includePassword }))
  } catch (err) {
    sendError(res, err)
  }
})

app.put('/api/employees', async (req, res) => {
  try {
    const rows = replaceEmployees(req.body)
    if (CLOUD_SYNC_ENABLED && RENDER_API_URL) {
      try {
        await pushEmployeeMutationToCloud('PUT', '/api/employees', getEmployees({ includePassword: true }))
      } catch (err) {
        console.warn('[local-api] could not push employees to cloud', err?.message || err)
      }
    }
    res.json(rows)
  } catch (err) {
    sendError(res, err)
  }
})

app.post('/api/employees', async (req, res) => {
  try {
    const created = createEmployee(req.body || {})
    if (CLOUD_SYNC_ENABLED && RENDER_API_URL) {
      try {
        await pushEmployeeMutationToCloud('POST', '/api/employees', {
          ...created,
          password: String(req.body?.password || ''),
        })
      } catch (err) {
        console.warn('[local-api] could not push new employee to cloud', err?.message || err)
      }
    }
    res.status(201).json(created)
  } catch (err) {
    sendError(res, err, 400)
  }
})

app.patch('/api/employees/:id', async (req, res) => {
  try {
    const updated = updateEmployee(req.params.id, req.body || {})
    if (CLOUD_SYNC_ENABLED && RENDER_API_URL) {
      try {
        await pushEmployeeMutationToCloud(
          'PATCH',
          `/api/employees/${encodeURIComponent(req.params.id)}`,
          req.body || {},
        )
      } catch (err) {
        console.warn('[local-api] could not push employee update to cloud', err?.message || err)
      }
    }
    res.json(updated)
  } catch (err) {
    const status = String(err?.message || '').includes('not found') ? 404 : 400
    sendError(res, err, status)
  }
})

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const removed = deleteEmployee(req.params.id)
    if (CLOUD_SYNC_ENABLED && RENDER_API_URL) {
      try {
        await pushEmployeeMutationToCloud(
          'DELETE',
          `/api/employees/${encodeURIComponent(req.params.id)}`,
        )
      } catch (err) {
        console.warn('[local-api] could not delete employee on cloud', err?.message || err)
      }
    }
    res.json(removed)
  } catch (err) {
    const status = String(err?.message || '').includes('not found') ? 404 : 400
    sendError(res, err, status)
  }
})

app.post('/api/employees/auth', (req, res) => {
  try {
    const { username, password } = req.body || {}
    const employee = authenticateEmployee(username, password)
    if (!employee) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }
    res.json(employee)
  } catch (err) {
    sendError(res, err)
  }
})

async function pullChatFromCloud() {
  if (!CLOUD_SYNC_ENABLED || !RENDER_API_URL) {
    return { ok: true, skipped: true }
  }
  const response = await fetch(`${RENDER_API_URL}/api/chat/messages?limit=500`)
  if (!response.ok) {
    throw new Error(`Cloud chat pull failed (${response.status})`)
  }
  const remote = await response.json()
  mergeChatMessages(Array.isArray(remote) ? remote : [])

  // Keep archive flags aligned with cloud when the endpoint exists.
  try {
    const [activeRes, archivedRes] = await Promise.all([
      fetch(`${RENDER_API_URL}/api/chat/threads`),
      fetch(`${RENDER_API_URL}/api/chat/threads?archived=1`),
    ])
    if (activeRes.ok) {
      const active = await activeRes.json()
      for (const thread of Array.isArray(active) ? active : []) {
        if (thread?.threadId) setChatThreadArchived(thread.threadId, false)
      }
    }
    if (archivedRes.ok) {
      const archived = await archivedRes.json()
      for (const thread of Array.isArray(archived) ? archived : []) {
        if (thread?.threadId) setChatThreadArchived(thread.threadId, true)
      }
    }
  } catch (err) {
    console.warn('[local-api] chat archive sync skipped', err?.message || err)
  }

  return { ok: true, pulled: Array.isArray(remote) ? remote.length : 0 }
}

app.get('/api/chat/threads', async (req, res) => {
  try {
    await pullChatFromCloud().catch((err) => {
      console.warn('[local-api] chat pull skipped', err?.message || err)
    })
    const archived = String(req.query.archived || '') === '1'
    res.json(getChatThreads({ archived }))
  } catch (err) {
    sendError(res, err)
  }
})

app.patch('/api/chat/threads/:threadId', async (req, res) => {
  try {
    const archived = Boolean(req.body?.archived)
    const updated = setChatThreadArchived(req.params.threadId, archived)
    if (CLOUD_SYNC_ENABLED && RENDER_API_URL) {
      try {
        await fetch(
          `${RENDER_API_URL}/api/chat/threads/${encodeURIComponent(req.params.threadId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archived }),
          },
        )
      } catch (err) {
        console.warn('[local-api] could not sync chat archive to cloud', err?.message || err)
      }
    }
    res.json(updated)
  } catch (err) {
    sendError(res, err, 400)
  }
})

app.get('/api/chat/messages', async (req, res) => {
  try {
    await pullChatFromCloud().catch((err) => {
      console.warn('[local-api] chat pull skipped', err?.message || err)
    })
    const threadId = req.query.threadId ? String(req.query.threadId) : null
    const since = req.query.since ? String(req.query.since) : null
    const limit = Number(req.query.limit || 200)
    res.json(getChatMessages({ threadId, since, limit }))
  } catch (err) {
    sendError(res, err)
  }
})

app.post('/api/chat/messages', async (req, res) => {
  try {
    const created = addChatMessage(req.body || {})
    if (CLOUD_SYNC_ENABLED && RENDER_API_URL) {
      try {
        await fetch(`${RENDER_API_URL}/api/chat/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(created),
        })
      } catch (err) {
        console.warn('[local-api] could not push chat message to cloud', err?.message || err)
      }
    }
    res.status(201).json(created)
  } catch (err) {
    sendError(res, err, 400)
  }
})

app.get('/api/vehicles', (_req, res) => {
  try {
    res.json(getVehicles())
  } catch (err) {
    sendError(res, err)
  }
})

app.put('/api/vehicles', (req, res) => {
  try {
    const vehicles = Array.isArray(req.body) ? req.body : []
    const result = replaceVehicles(vehicles)
    enqueueSyncItem({
      entityType: 'vehicles',
      action: 'update',
      payload: result,
    })
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

app.get('/api/rentals', (_req, res) => {
  try {
    res.json(getRentals())
  } catch (err) {
    sendError(res, err)
  }
})

app.post('/api/rentals', (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid rental payload' })
    }
    const entry = {
      ...req.body,
      id: req.body.id || `r-${Date.now()}`,
      approvalStatus: req.body.approvalStatus || 'accepted',
      source: req.body.source || 'desktop',
    }
    const created = addRental(entry)
    enqueueSyncItem({
      entityType: 'rentals',
      action: 'create',
      payload: created,
    })
    res.status(201).json(created)
  } catch (err) {
    sendError(res, err)
  }
})

app.post('/api/rentals/pending', (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid rental payload' })
    }
    const entry = {
      ...req.body,
      id: req.body.id || `r-${Date.now()}`,
      source: req.body.source || 'field',
    }
    const created = addPendingRental(entry)
    enqueueSyncItem({
      entityType: 'rentals',
      action: 'create',
      payload: created,
    })
    res.status(201).json(created)
  } catch (err) {
    sendError(res, err)
  }
})

app.get('/api/pending-rentals', (_req, res) => {
  try {
    res.json(getPendingRentals())
  } catch (err) {
    sendError(res, err)
  }
})

app.post('/api/pending-rentals/:id/accept', (req, res) => {
  try {
    const accepted = acceptPendingRental(req.params.id)
    enqueueSyncItem({
      entityType: 'rentals',
      action: 'update',
      payload: accepted,
    })
    res.json(accepted)
  } catch (err) {
    sendError(res, err, err.message.includes('not found') ? 404 : 409)
  }
})

app.post('/api/pending-rentals/:id/reject', (req, res) => {
  try {
    const reason = req.body?.reason || ''
    const rejected = rejectPendingRental(req.params.id, reason)
    enqueueSyncItem({
      entityType: 'rentals',
      action: 'update',
      payload: rejected,
    })
    res.json(rejected)
  } catch (err) {
    sendError(res, err, err.message.includes('not found') ? 404 : 409)
  }
})

app.delete('/api/vehicles/:id', (req, res) => {
  try {
    const id = req.params.id
    if (!id) {
      return res.status(400).json({ error: 'Vehicle id is required' })
    }
    const remainingVehicles = deleteVehicle(id)
    const remainingRentals = getRentals()
    enqueueSyncItem({
      entityType: 'vehicles',
      action: 'delete',
      payload: { id },
    })
    res.json({ ok: true, vehicles: remainingVehicles, rentals: remainingRentals })
  } catch (err) {
    sendError(res, err)
  }
})

app.patch('/api/rentals/:id/car-photos', (req, res) => {
  try {
    const carPhotos = req.body?.carPhotos
    const addedBy = req.body?.addedBy
    if (!carPhotos || typeof carPhotos !== 'object' || Array.isArray(carPhotos)) {
      return res.status(400).json({ error: 'carPhotos object is required' })
    }
    const updated = updateRentalCarPhotos(req.params.id, carPhotos, addedBy)
    enqueueSyncItem({
      entityType: 'rentals',
      action: 'update',
      payload: updated,
    })
    res.json(updated)
  } catch (err) {
    sendError(res, err, err.message.includes('not found') ? 404 : 400)
  }
})

app.post('/api/rentals/:id/car-photos', (req, res) => {
  try {
    const carPhotos = req.body?.carPhotos
    const addedBy = req.body?.addedBy
    if (!carPhotos || typeof carPhotos !== 'object' || Array.isArray(carPhotos)) {
      return res.status(400).json({ error: 'carPhotos object is required' })
    }
    const updated = updateRentalCarPhotos(req.params.id, carPhotos, addedBy)
    enqueueSyncItem({
      entityType: 'rentals',
      action: 'update',
      payload: updated,
    })
    res.json(updated)
  } catch (err) {
    sendError(res, err, err.message.includes('not found') ? 404 : 400)
  }
})

app.put('/api/rentals', (req, res) => {
  try {
    const rentals = Array.isArray(req.body) ? req.body : []
    const result = replaceRentals(rentals)
    enqueueSyncItem({
      entityType: 'rentals',
      action: 'update',
      payload: result,
    })
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

app.get('/api/sync/queue', (_req, res) => {
  try {
    res.json(getSyncQueue())
  } catch (err) {
    sendError(res, err)
  }
})

app.post('/api/sync/queue/flush', async (_req, res) => {
  try {
    const result = await flushQueueToCloud()
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

app.get('/api/sync/pull', (req, res) => {
  try {
    const lastPulledAt = Number(req.query.last_pulled_at || 0)
    const vehicles = getVehicles()
    const rentals = getRentals()

    const changedRentals = rentals.filter((r) => rentalUpdatedAt(r) > lastPulledAt)
    const timestamp = Date.now()
    setSyncMeta('last_pulled_at', String(timestamp))

    res.json({
      changes: {
        vehicles: { created: [], updated: vehicles, deleted: [] },
        rentals: {
          created: changedRentals.filter((r) => rentalUpdatedAt(r) > lastPulledAt && r.createdAt && new Date(r.createdAt).getTime() > lastPulledAt),
          updated: changedRentals.filter((r) => !(r.createdAt && new Date(r.createdAt).getTime() > lastPulledAt)),
          deleted: [],
        },
        vehicleReports: getVehicleReports(),
      },
      timestamp,
    })
  } catch (err) {
    sendError(res, err)
  }
})

app.post('/api/sync/push', (req, res) => {
  try {
    const { changes } = req.body || {}
    const applied = applySyncChanges(changes || {})
    res.json({ ok: true, applied })
  } catch (err) {
    sendError(res, err)
  }
})

app.post('/api/sync/cloud/pull', async (_req, res) => {
  try {
    const result = await pullFromCloudToLocal()
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

app.post('/api/sync/cloud/run', async (_req, res) => {
  try {
    const flush = await flushQueueToCloud()
    if (!flush.ok) {
      return res.status(502).json({ ok: false, flush })
    }
    const pull = await pullFromCloudToLocal()
    res.json({ ok: true, flush, pull })
  } catch (err) {
    sendError(res, err)
  }
})

if (serveFrontend && frontendDist && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) next(err)
    })
  })
}

app.use((err, _req, res, _next) => {
  sendError(res, err)
})

const server = app.listen(PORT, HOST, () => {
  console.log(`Alatas backend running on http://${HOST}:${PORT}`)
  if (CLOUD_SYNC_ENABLED) {
    console.log(`Cloud sync target: ${RENDER_API_URL}`)
    pullVehicleReportsFromCloud().catch((err) => {
      console.warn('[local-api] startup vehicle reports pull failed', err?.message || err)
    })
  }
  if (serveFrontend) {
    console.log(`Serving frontend from ${frontendDist}`)
  }
})

server.on('error', (err) => {
  console.error('Failed to start Alatas backend:', err)
  process.exit(1)
})
