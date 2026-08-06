import express from 'express'
import cors from 'cors'
import {
  getVehicles,
  replaceVehicles,
  getRentals,
  addRental,
  replaceRentals,
  deleteVehicle,
} from './sqlite-db.js'

const app = express()
const PORT = process.env.PORT || 4000

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

app.listen(PORT, () => {
  console.log(`Alatas backend running on http://localhost:${PORT}`)
})
