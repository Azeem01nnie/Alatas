import { safeSetItem } from './storage'
import { resolveRentalSaleAmount } from './rentalFee'

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

function isCountableRental(rental) {
  const approval = String(rental?.approvalStatus || 'accepted').toLowerCase()
  if (approval === 'pending' || approval === 'rejected') return false
  const life = String(rental?.rentalLifecycle || '').toLowerCase()
  if (life === 'pending_approval' || life === 'cancelled' || life === 'rejected') return false
  return true
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
  // Last resort: rental period start (only if it parses)
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
 * Sales are rentals encoded in-range; amount uses saved fee or rate-card fallback.
 * ₱0 lines are kept so History and X&Z stay aligned.
 */
export function buildXZReading(
  rentals = [],
  bounds = null,
  store = loadXZStore(),
  vehicles = [],
) {
  // Always end the open period at "now" so live sales keep counting while the tab is open.
  const base = bounds || getOpenPeriodBounds(new Date(), store)
  const from = base.from
  const to = new Date()
  const sinceZ = base.sinceZ
  const lastClose = base.lastClose
  const fromMs = from.getTime()
  const toMs = to.getTime()
  const fleetById = new Map(
    (Array.isArray(vehicles) ? vehicles : []).map((v) => [String(v.id), v]),
  )

  const lines = []
  for (const r of Array.isArray(rentals) ? rentals : []) {
    if (!isCountableRental(r)) continue
    const stamped = rentalSaleStamp(r)
    if (!stamped) continue
    // Inclusive of period start so sales right after Z-close are not dropped.
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
    const amount = resolveRentalSaleAmount(r, fleet)
    const plate = r?.vehicle?.plateNo || fleet?.plateNo || '—'
    const vehicle =
      `${r?.vehicle?.make || fleet?.make || ''} ${r?.vehicle?.series || fleet?.series || ''}`.trim() ||
      '—'
    lines.push({
      rentalId: r.id,
      stamp: stamped.raw,
      dateLabel: new Date(stamped.ms).toLocaleString(),
      customer: customerNameXZ(r),
      plate,
      vehicle,
      duration: r?.rental?.duration || r?.rental?.durationOther || '—',
      amount,
      lifecycle: r?.rentalLifecycle || '—',
    })
  }

  lines.sort((a, b) => String(b.stamp).localeCompare(String(a.stamp)))
  const revenue = lines.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const count = lines.length

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
    rentalIds: (reading.lines || []).map((l) => l.rentalId).filter(Boolean),
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
