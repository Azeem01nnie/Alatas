import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
const vehiclesFile = path.join(dataDir, 'vehicles.json')
const rentalsFile = path.join(dataDir, 'rentals.json')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8')
}

if (!fs.existsSync(vehiclesFile)) writeJson(vehiclesFile, [])
if (!fs.existsSync(rentalsFile)) writeJson(rentalsFile, [])

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json({ limit: '15mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'alatas-backend' })
})

app.get('/api/vehicles', (_req, res) => {
  res.json(readJson(vehiclesFile, []))
})

app.put('/api/vehicles', (req, res) => {
  const vehicles = Array.isArray(req.body) ? req.body : []
  writeJson(vehiclesFile, vehicles)
  res.json(vehicles)
})

app.get('/api/rentals', (_req, res) => {
  res.json(readJson(rentalsFile, []))
})

app.post('/api/rentals', (req, res) => {
  const rentals = readJson(rentalsFile, [])
  const entry = { ...req.body, id: req.body.id || `r-${Date.now()}` }
  rentals.unshift(entry)
  writeJson(rentalsFile, rentals)
  res.status(201).json(entry)
})

app.put('/api/rentals', (req, res) => {
  const rentals = Array.isArray(req.body) ? req.body : []
  writeJson(rentalsFile, rentals)
  res.json(rentals)
})

app.listen(PORT, () => {
  console.log(`Alatas backend running on http://localhost:${PORT}`)
})
