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
  authenticateEmployee,
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

function flattenSyncRecords(list) {
  const out = []
  for (const entry of list) {
    if (Array.isArray(entry)) out.push(...entry)
    else if (entry != null) out.push(entry)
  }
  return out
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

app.get('/api/settings/admin-profile', (_req, res) => {
  try {
    res.json(getAdminProfile())
  } catch (err) {
    sendError(res, err)
  }
})

app.put('/api/settings/admin-profile', (req, res) => {
  try {
    res.json(setAdminProfile(req.body || {}))
  } catch (err) {
    sendError(res, err)
  }
})

app.get('/api/vehicle-reports', (_req, res) => {
  try {
    res.json(getVehicleReports())
  } catch (err) {
    sendError(res, err)
  }
})

app.put('/api/vehicle-reports', (req, res) => {
  try {
    res.json(setVehicleReports(req.body || {}))
  } catch (err) {
    sendError(res, err)
  }
})

app.get('/api/employees', (req, res) => {
  try {
    const includePassword = String(req.query.includePassword || '') === '1'
    res.json(getEmployees({ includePassword }))
  } catch (err) {
    sendError(res, err)
  }
})

app.put('/api/employees', (req, res) => {
  try {
    res.json(replaceEmployees(req.body))
  } catch (err) {
    sendError(res, err)
  }
})

app.post('/api/employees', (req, res) => {
  try {
    const created = createEmployee(req.body || {})
    res.status(201).json(created)
  } catch (err) {
    sendError(res, err, 400)
  }
})

app.patch('/api/employees/:id', (req, res) => {
  try {
    const updated = updateEmployee(req.params.id, req.body || {})
    res.json(updated)
  } catch (err) {
    const status = String(err?.message || '').includes('not found') ? 404 : 400
    sendError(res, err, status)
  }
})

app.delete('/api/employees/:id', (req, res) => {
  try {
    res.json(deleteEmployee(req.params.id))
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
