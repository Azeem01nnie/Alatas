import { safeSetItem } from './storage'
import {
  isRevenueCountableRental,
  resolveRentalChargeBreakdown,
} from './rentalFee'

const STORE_KEY = 'alatas-xz-readings'

function emptyStore() {
  return { closes: [] }
}

export function loadXZStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw)
    return {
      closes: Array.isArray(parsed?.closes) ? parsed.closes : [],
    }
  } catch {
    return emptyStore()
  }
}

function saveXZStore(store) {
  safeSetItem(STORE_KEY, JSON.stringify(store))
  return store
}

export function parsePesoAmount(value) {
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function formatPesoXZ(n) {
  const num = Number(n) || 0
  return `₱${num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function rentalSaleStamp(rental) {
  // Prefer when the sale was booked/encoded — same clock History uses.
  const candidates = [
    rental?.encodedAt,
    rental?.createdAt,
    rental?.startedAt,
    rental?.completedAt,
    rental?.updatedAt,
  ]
  for (const raw of candidates) {
    if (!raw) continue
    const ms = new Date(raw).getTime()
    if (Number.isFinite(ms)) return { raw: String(raw), ms }
  }
  const period = rental?.rental?.periodFrom
  if (period) {
    const ms = new Date(period).getTime()
    if (Number.isFinite(ms)) return { raw: String(period), ms }
  }
  return null
}

export function getLastZClose(store = loadXZStore()) {
  const closes = [...(store.closes || [])].sort((a, b) =>
    String(b.closedAt || '').localeCompare(String(a.closedAt || '')),
  )
  return closes[0] || null
}

/** Open period starts after last Z close, otherwise start of today. */
export function getOpenPeriodBounds(now = new Date(), store = loadXZStore()) {
  const last = getLastZClose(store)
  if (last?.closedAt) {
    const from = new Date(last.closedAt)
    if (!Number.isNaN(from.getTime())) {
      return { from, to: now, sinceZ: true, lastClose: last }
    }
  }
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  return { from, to: now, sinceZ: false, lastClose: null }
}

export function customerNameXZ(rental) {
  const p = rental?.personal || {}
  const name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim()
  return name || 'Customer'
}

/**
 * Build POS sales lines for the open period (or custom bounds).
 * Includes rental fee, overdue/exceed charges, and damage settlement amounts.
 * Cancelled / pending rentals are excluded.
 */
export function buildXZReading(
  rentals = [],
  bounds = null,
  store = loadXZStore(),
  vehicles = [],
) {
  const base = bounds || getOpenPeriodBounds(new Date(), store)
  const from = base.from
  const to = new Date()
  const sinceZ = base.sinceZ
  const lastClose = base.lastClose
  const fromMs = from.getTime()
  const toMs = to.getTime()
  const now = Date.now()
  const fleetById = new Map(
    (Array.isArray(vehicles) ? vehicles : []).map((v) => [String(v.id), v]),
  )

  const lines = []
  for (const r of Array.isArray(rentals) ? rentals : []) {
    if (!isRevenueCountableRental(r)) continue
    const stamped = rentalSaleStamp(r)
    if (!stamped) continue
    if (stamped.ms < fromMs || stamped.ms > toMs) continue
    const fleet =
      fleetById.get(String(r.vehicleId || r.vehicle?.id || '')) ||
      (Array.isArray(vehicles)
        ? vehicles.find(
            (v) =>
              v.plateNo &&
              r.vehicle?.plateNo &&
              String(v.plateNo).toUpperCase() === String(r.vehicle.plateNo).toUpperCase(),
          )
        : null)
    const breakdown = resolveRentalChargeBreakdown(r, fleet, now)
    if (!breakdown.countable) continue

    const plate = r?.vehicle?.plateNo || fleet?.plateNo || '—'
    const vehicle =
      `${r?.vehicle?.make || fleet?.make || ''} ${r?.vehicle?.series || fleet?.series || ''}`.trim() ||
      '—'
    const customer = customerNameXZ(r)
    const dateLabel = new Date(stamped.ms).toLocaleString()
    const lifecycle = r?.rentalLifecycle || '—'

    const pushLine = (kind, label, amount) => {
      if (kind !== 'rental' && !(Number(amount) > 0)) return
      lines.push({
        rentalId: r.id,
        kind,
        stamp: stamped.raw,
        dateLabel,
        customer,
        plate,
        vehicle,
        duration: label,
        amount: Number(amount) || 0,
        lifecycle,
      })
    }

    pushLine(
      'rental',
      r?.rental?.duration || r?.rental?.durationOther || 'Rental',
      breakdown.base,
    )
    if (breakdown.outsideCity > 0) {
      const dest =
        String(r?.rental?.outsideCityDestinationName || '').trim() || 'Outside city'
      pushLine('outside_city', dest, breakdown.outsideCity)
    }
    if (breakdown.driver > 0) {
      const hrs = Number(r?.rental?.driverBillableHours) || 0
      pushLine(
        'driver',
        hrs > 0 ? `Driver wage · ${hrs} hrs` : 'Driver wage',
        breakdown.driver,
      )
    }
    if (breakdown.overdue > 0) {
      pushLine('overdue', 'Overdue / exceed', breakdown.overdue)
    }
    if (breakdown.damage > 0) {
      pushLine('damage', 'Damage settlement', breakdown.damage)
    }
  }

  lines.sort((a, b) => String(b.stamp).localeCompare(String(a.stamp)))
  const revenue = lines.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const count = new Set(lines.map((l) => l.rentalId).filter(Boolean)).size

  return {
    from,
    to,
    sinceZ,
    lastClose,
    lines,
    revenue,
    count,
    average: count ? revenue / count : 0,
  }
}

export function recordZClose({ reading, closedBy = 'Admin', note = '' } = {}) {
  if (!reading) throw new Error('Reading required')
  const store = loadXZStore()
  const entry = {
    id: `z_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    closedAt: new Date().toISOString(),
    periodFrom: reading.from?.toISOString?.() || reading.from,
    periodTo: reading.to?.toISOString?.() || reading.to,
    revenue: Number(reading.revenue) || 0,
    count: Number(reading.count) || 0,
    rentalIds: [...new Set((reading.lines || []).map((l) => l.rentalId).filter(Boolean))],
    closedBy: String(closedBy || 'Admin').trim() || 'Admin',
    note: String(note || '').trim(),
  }
  store.closes = [entry, ...(store.closes || [])]
  saveXZStore(store)
  return entry
}

export function listZCloses(store = loadXZStore()) {
  return [...(store.closes || [])].sort((a, b) =>
    String(b.closedAt || '').localeCompare(String(a.closedAt || '')),
  )
}

/** Wipe Z-close history so the open period restarts (start of today). */
export function resetXZHistory() {
  return saveXZStore(emptyStore())
}
