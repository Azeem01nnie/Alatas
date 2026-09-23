import { safeSetItem } from './storage'
import { formatRentalFee, parseRentalFeeAmount } from './rentalFee'

const STORE_KEY = 'alatas-outside-city-destinations'

function emptyList() {
  return []
}

export function loadOutsideCityDestinations() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return emptyList()
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed?.destinations)
      ? parsed.destinations
      : Array.isArray(parsed)
        ? parsed
        : []
    return list
      .map(normalizeDestination)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return emptyList()
  }
}

function saveDestinations(list) {
  const next = (Array.isArray(list) ? list : []).map(normalizeDestination).filter(Boolean)
  safeSetItem(STORE_KEY, JSON.stringify({ destinations: next }))
  return next.sort((a, b) => a.name.localeCompare(b.name))
}

function normalizeDestination(row) {
  if (!row || typeof row !== 'object') return null
  const name = String(row.name || '').trim()
  if (!name) return null
  const price = parseRentalFeeAmount(row.price ?? row.fee ?? 0)
  return {
    id: String(row.id || '').trim() || `dest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    price,
    priceLabel: formatRentalFee(price) || `₱${price}`,
    active: row.active !== false,
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
  }
}

export function listActiveOutsideCityDestinations() {
  return loadOutsideCityDestinations().filter((d) => d.active)
}

export function getOutsideCityDestination(id) {
  const key = String(id || '').trim()
  if (!key) return null
  return loadOutsideCityDestinations().find((d) => d.id === key) || null
}

export function addOutsideCityDestination({ name, price }) {
  const now = new Date().toISOString()
  const row = normalizeDestination({
    id: `dest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    price,
    active: true,
    createdAt: now,
    updatedAt: now,
  })
  if (!row) throw new Error('Place name is required.')
  const prev = loadOutsideCityDestinations()
  if (prev.some((d) => d.name.toLowerCase() === row.name.toLowerCase())) {
    throw new Error('That place already exists.')
  }
  return saveDestinations([row, ...prev])
}

export function updateOutsideCityDestination(id, patch = {}) {
  const key = String(id || '').trim()
  if (!key) return loadOutsideCityDestinations()
  const prev = loadOutsideCityDestinations()
  const next = prev.map((d) => {
    if (d.id !== key) return d
    return normalizeDestination({
      ...d,
      ...patch,
      id: d.id,
      createdAt: d.createdAt,
      updatedAt: new Date().toISOString(),
    })
  })
  return saveDestinations(next)
}

export function deleteOutsideCityDestination(id) {
  const key = String(id || '').trim()
  if (!key) return loadOutsideCityDestinations()
  return saveDestinations(loadOutsideCityDestinations().filter((d) => d.id !== key))
}

export function replaceOutsideCityDestinations(list) {
  return saveDestinations(list)
}
