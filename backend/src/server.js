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
  replaceRentals,
  deleteVehicle,
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

    res.json({ ok: true })
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
  }
  if (serveFrontend) {
    console.log(`Serving frontend from ${frontendDist}`)
  }
})

server.on('error', (err) => {
  console.error('Failed to start Alatas backend:', err)
  process.exit(1)
})
