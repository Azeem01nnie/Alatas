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

const app = express()
const PORT = Number(process.env.PORT || 4000)
const serveFrontend = process.env.SERVE_FRONTEND === '1'
const frontendDist = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : null

app.use(cors())
app.use(express.json({ limit: '15mb' }))

function sendError(res, err, status = 500) {
  console.error('[api]', err)
  const message = err?.message || 'Internal server error'
  res.status(status).json({ error: message })
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'alatas-backend' })
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
    const entry = { ...req.body, id: req.body.id || `r-${Date.now()}` }
    const created = addRental(entry)
    res.status(201).json(created)
  } catch (err) {
    sendError(res, err)
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

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Alatas backend running on http://127.0.0.1:${PORT}`)
  if (serveFrontend) {
    console.log(`Serving frontend from ${frontendDist}`)
  }
})

server.on('error', (err) => {
  console.error('Failed to start Alatas backend:', err)
  process.exit(1)
})
