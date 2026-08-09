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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'alatas-backend' })
})

app.get('/api/vehicles', (_req, res) => {
  res.json(getVehicles())
})

app.put('/api/vehicles', (req, res) => {
  const vehicles = Array.isArray(req.body) ? req.body : []
  const result = replaceVehicles(vehicles)
  res.json(result)
})

app.get('/api/rentals', (_req, res) => {
  res.json(getRentals())
})

app.post('/api/rentals', (req, res) => {
  const entry = { ...req.body, id: req.body.id || `r-${Date.now()}` }
  const created = addRental(entry)
  res.status(201).json(created)
})

app.delete('/api/vehicles/:id', (req, res) => {
  const id = req.params.id
  if (!id) {
    return res.status(400).json({ error: 'Vehicle id is required' })
  }
  const remainingVehicles = deleteVehicle(id)
  const remainingRentals = getRentals()
  res.json({ ok: true, vehicles: remainingVehicles, rentals: remainingRentals })
})

app.put('/api/rentals', (req, res) => {
  const rentals = Array.isArray(req.body) ? req.body : []
  const result = replaceRentals(rentals)
  res.json(result)
})

if (serveFrontend && frontendDist && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Alatas backend running on http://127.0.0.1:${PORT}`)
  if (serveFrontend) {
    console.log(`Serving frontend from ${frontendDist}`)
  }
})
