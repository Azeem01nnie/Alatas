import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
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
} from './sync-db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT || 4000)
const HOST = process.env.HOST || '0.0.0.0'

app.use(cors())
app.use(express.json({ limit: '15mb' }))

function sendError(res, err, status = 500) {
  console.error('[render-api]', err)
  const message = err?.message || 'Internal server error'
  res.status(status).json({ error: message })
}

function rentalUpdatedAt(rental) {
  const ts = rental.updatedAt || rental.createdAt || rental.encodedAt
  return ts ? new Date(ts).getTime() : 0
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'alatas-render-backend', host: HOST })
})

app.get('/api/system/status', (_req, res) => {
  res.json({
    ok: true,
    mode: 'cloud-master',
    cloudSyncEnabled: true,
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
    res.json(accepted)
  } catch (err) {
    sendError(res, err, err.message.includes('not found') ? 404 : 409)
  }
})

app.post('/api/pending-rentals/:id/reject', (req, res) => {
  try {
    const reason = req.body?.reason || ''
    const rejected = rejectPendingRental(req.params.id, reason)
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
    res.json({ ok: true, vehicles: remainingVehicles, rentals: remainingRentals })
  } catch (err) {
    sendError(res, err)
  }
})

app.put('/api/rentals', (req, res) => {
  try {
    const rentals = Array.isArray(req.body) ? req.body : []
    const result = replaceRentals(rentals)
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
          created: changedRentals.filter(
            (r) => r.createdAt && new Date(r.createdAt).getTime() > lastPulledAt,
          ),
          updated: changedRentals.filter(
            (r) => !(r.createdAt && new Date(r.createdAt).getTime() > lastPulledAt),
          ),
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
    const vehicleUpdates = [
      ...(changes?.vehicles?.created || []),
      ...(changes?.vehicles?.updated || []),
    ]
    const rentalUpdates = [
      ...(changes?.rentals?.created || []),
      ...(changes?.rentals?.updated || []),
    ]

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

app.get('/', (_req, res) => {
  res.json({
    service: 'alatas-render-backend',
    docs: path.join(__dirname, '..', 'README.md'),
  })
})

app.use((err, _req, res, _next) => {
  sendError(res, err)
})

const server = app.listen(PORT, HOST, () => {
  console.log(`Alatas Render backend running on http://${HOST}:${PORT}`)
})

server.on('error', (err) => {
  console.error('Failed to start Alatas Render backend:', err)
  process.exit(1)
})
