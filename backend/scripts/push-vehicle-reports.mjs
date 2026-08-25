import {
  getVehicles,
  replaceVehicles,
  getVehicleReports,
  setVehicleReports,
} from '../src/sqlite-db.js'

const RENDER_API_URL = (process.env.RENDER_API_URL || 'https://alatas.onrender.com').replace(/\/$/, '')

const WRANGLER_VEHICLE_ID = 'v-1787382879654'

const entries = [
  {
    id: 'vre_wrangler_parts_1',
    ownerId: '',
    vehicleId: WRANGLER_VEHICLE_ID,
    plateNo: '22222',
    date: '2026-08-23',
    type: 'Repair',
    category: 'Parts',
    description: 'Led Light',
    amount: 10000,
    status: 'Completed',
    attachment: '',
    recordedBy: 'Desktop',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'vre_wrangler_labor_1',
    ownerId: '',
    vehicleId: WRANGLER_VEHICLE_ID,
    plateNo: '22222',
    date: '2026-08-23',
    type: 'Repair',
    category: 'Labor',
    description: 'Suspension Repair',
    amount: 12000,
    status: 'Completed',
    attachment: '',
    recordedBy: 'Desktop',
    createdAt: new Date().toISOString(),
  },
]

const store = { entries, submissions: [] }

console.log('[local] saving vehicle reports store…')
setVehicleReports(store)

const vehicles = getVehicles()
const byVehicle = new Map()
entries.forEach((entry) => {
  const key = String(entry.vehicleId)
  if (!byVehicle.has(key)) byVehicle.set(key, [])
  byVehicle.get(key).push(entry)
})

const updatedVehicles = vehicles.map((vehicle) => ({
  ...vehicle,
  reportEntries: byVehicle.get(String(vehicle.id)) || vehicle.reportEntries || [],
}))

console.log('[local] embedding reportEntries on vehicles…')
replaceVehicles(updatedVehicles)

async function tryCloud(path, options) {
  const url = `${RENDER_API_URL}${path}`
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const text = await response.text().catch(() => '')
  return { ok: response.ok, status: response.status, text: text.slice(0, 200) }
}

console.log('[cloud] pushing via PUT /api/vehicle-reports…')
const putReports = await tryCloud('/api/vehicle-reports', {
  method: 'PUT',
  body: JSON.stringify(store),
})
console.log(putReports)

console.log('[cloud] pushing via POST /api/sync/push (vehicleReports)…')
const pushReports = await tryCloud('/api/sync/push', {
  method: 'POST',
  body: JSON.stringify({ changes: { vehicleReports: { updated: [store] } } }),
})
console.log(pushReports)

const cloudVehicles = updatedVehicles.filter((v) => (v.reportEntries || []).length)
console.log('[cloud] pushing via POST /api/sync/push (vehicles with reportEntries)…')
const pushVehicles = await tryCloud('/api/sync/push', {
  method: 'POST',
  body: JSON.stringify({ changes: { vehicles: { updated: cloudVehicles } } }),
})
console.log(pushVehicles)

const verifyReports = await tryCloud('/api/vehicle-reports', { method: 'GET' })
console.log('[cloud] GET /api/vehicle-reports →', verifyReports)

const verifyVehicles = await tryCloud('/api/vehicles', { method: 'GET' })
if (verifyVehicles.ok) {
  const list = JSON.parse(verifyVehicles.text.startsWith('[') ? verifyVehicles.text : '[]')
  const wrangler = list.find((v) => v.id === WRANGLER_VEHICLE_ID)
  console.log('[cloud] wrangler reportEntries on server:', wrangler?.reportEntries?.length ?? 'n/a')
}

console.log('[done] local entries:', getVehicleReports().entries.length)
