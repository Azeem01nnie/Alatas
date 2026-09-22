import { compressImageDataUrl, safeSetItem } from './storage'
import { pushVehicleReportsToCloud } from '../api/vehicleReportsApi'
import { resolveRentalSaleAmount } from './rentalFee'

const REPORTS_KEY = 'alatas-vehicle-reports'

const EMPTY_STORE = { entries: [], submissions: [] }

export const REPORT_TYPES = ['Expense', 'Repair', 'Issue']
export const REPORT_CATEGORIES = [
  'Parts',
  'Labor',
  'Car Wash',
  'Registration/LTO',
  'Insurance',
  'Towing',
  'Engine',
  'Aircon',
  'Others',
]
export const REPORT_STATUSES = ['Pending', 'In Progress', 'Completed', 'Resolved']

export function loadReportStore() {
  try {
    const raw = localStorage.getItem(REPORTS_KEY)
    if (!raw) return { ...EMPTY_STORE, entries: [], submissions: [] }
    const parsed = JSON.parse(raw)
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
    }
  } catch {
    return { ...EMPTY_STORE, entries: [], submissions: [] }
  }
}

function saveReportStore(store) {
  safeSetItem(REPORTS_KEY, JSON.stringify(store))
  void pushVehicleReportsToCloud(store).catch((err) => {
    console.warn('Vehicle reports sync failed', err)
  })
  return store
}

async function prepareAttachment(attachment) {
  if (!attachment || typeof attachment !== 'string') return ''
  if (attachment.startsWith('data:image')) {
    return compressImageDataUrl(attachment, 960, 0.72)
  }
  // Keep PDFs / remote URLs as-is (may be large — prefer remote Storage later).
  return attachment
}

export async function addReportEntry(entry) {
  const store = loadReportStore()
  const attachment = await prepareAttachment(entry?.attachment)
  const next = {
    ...entry,
    attachment,
    id: `vre_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }
  store.entries = [next, ...store.entries]
  saveReportStore(store)
  return next
}

export async function updateReportEntry(id, patch) {
  const store = loadReportStore()
  const nextPatch = { ...patch }
  if (Object.prototype.hasOwnProperty.call(patch, 'attachment')) {
    nextPatch.attachment = await prepareAttachment(patch.attachment)
  }
  store.entries = store.entries.map((e) => (e.id === id ? { ...e, ...nextPatch } : e))
  saveReportStore(store)
  return store.entries.find((e) => e.id === id) || null
}

export function deleteReportEntry(id) {
  const store = loadReportStore()
  store.entries = store.entries.filter((e) => e.id !== id)
  saveReportStore(store)
}

export function markReportSubmitted({ ownerId, vehicleId, month }) {
  const store = loadReportStore()
  const keyMonth = month || new Date().toISOString().slice(0, 7)
  const existing = store.submissions.findIndex(
    (s) => s.ownerId === ownerId && s.vehicleId === vehicleId && s.month === keyMonth,
  )
  const row = {
    ownerId,
    vehicleId,
    month: keyMonth,
    submittedAt: new Date().toISOString(),
  }
  if (existing >= 0) store.submissions[existing] = row
  else store.submissions.push(row)
  saveReportStore(store)
  return row
}

export function getSubmission({ ownerId, vehicleId, month }) {
  const store = loadReportStore()
  const keyMonth = month || new Date().toISOString().slice(0, 7)
  return (
    store.submissions.find(
      (s) => s.ownerId === ownerId && s.vehicleId === vehicleId && s.month === keyMonth,
    ) || null
  )
}

export function filterEntries(entries, { vehicleId, from, to } = {}) {
  return entries.filter((e) => {
    if (vehicleId && e.vehicleId !== vehicleId) return false
    const d = new Date(e.date || e.createdAt || 0)
    if (Number.isNaN(d.getTime())) return false
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  })
}

export function sumAmounts(entries) {
  return entries.reduce((sum, e) => {
    const n = Number(e.amount)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

/** Parse peso strings like "₱1,200" or plain numbers. */
export function parseReportAmount(value) {
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function toDateKeyLocal(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rentalMatchesVehicle(rental, vehicleId, plateNo = '') {
  const rid = String(rental?.vehicleId || rental?.vehicle?.id || '').trim()
  const vid = String(vehicleId || '').trim()
  if (vid && rid && rid === vid) return true
  const plate = String(plateNo || '').trim().toUpperCase()
  const rPlate = String(rental?.vehicle?.plateNo || '').trim().toUpperCase()
  return Boolean(plate && rPlate && plate === rPlate)
}

function isReportableRental(rental) {
  const approval = String(rental?.approvalStatus || 'accepted').toLowerCase()
  if (approval === 'pending' || approval === 'rejected') return false
  const life = String(rental?.rentalLifecycle || '').toLowerCase()
  if (life === 'pending_approval') return false
  // Include active, scheduled, completed, and legacy rows without lifecycle.
  return true
}

function rentalStatusLabel(rental) {
  const life = String(rental?.rentalLifecycle || '').toLowerCase()
  if (life === 'active') return 'Active'
  if (life === 'scheduled') return 'Scheduled'
  if (life === 'completed') return 'Completed'
  return 'Rented'
}

function rentalCustomerName(rental) {
  const name = `${rental?.personal?.firstName || ''} ${rental?.personal?.lastName || ''}`.trim()
  return name || 'Customer'
}

function rentalDurationLabel(rental) {
  const r = rental?.rental || {}
  if (r.duration === 'Others' && r.durationOther) return String(r.durationOther)
  return r.duration || r.rentalType || 'Rental'
}

/** One ledger row per rental booking (income). */
export function rentalToReportRow(rental, fleetVehicle = null) {
  const periodRaw =
    rental?.rental?.periodFrom ||
    rental?.startedAt ||
    rental?.encodedAt ||
    rental?.createdAt ||
    ''
  const date = toDateKeyLocal(periodRaw) || toDateKeyLocal(new Date())
  const fee = resolveRentalSaleAmount(rental, fleetVehicle)
  const customer = rentalCustomerName(rental)
  const duration = rentalDurationLabel(rental)
  return {
    id: `rental_${rental.id}`,
    source: 'rental',
    rentalId: rental.id,
    vehicleId: rental.vehicleId || rental.vehicle?.id || '',
    plateNo: rental.vehicle?.plateNo || fleetVehicle?.plateNo || '',
    date,
    type: 'Rental',
    category: 'Rental Income',
    description: `Rental — ${customer} (${duration})`,
    amount: fee,
    status: rentalStatusLabel(rental),
    recordedBy: 'System',
    attachment: '',
    readOnly: true,
  }
}

/**
 * Manual expenses/repairs + one row per rental for the vehicle/period.
 */
export function buildVehicleReportRows({
  entries = [],
  rentals = [],
  vehicleId,
  plateNo = '',
  from = null,
  to = null,
  fleetVehicle = null,
} = {}) {
  const manual = filterEntries(entries, { vehicleId, from, to })

  const rentalRows = (Array.isArray(rentals) ? rentals : [])
    .filter((r) => isReportableRental(r) && rentalMatchesVehicle(r, vehicleId, plateNo))
    .map((r) => rentalToReportRow(r, fleetVehicle))
    .filter((row) => {
      const d = new Date(`${row.date}T12:00:00`)
      if (Number.isNaN(d.getTime())) return false
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    })

  return [...manual, ...rentalRows].sort((a, b) => {
    const byDate = String(b.date || '').localeCompare(String(a.date || ''))
    if (byDate) return byDate
    // Rentals before manual costs on the same day for readability
    const aRent = a.source === 'rental' ? 0 : 1
    const bRent = b.source === 'rental' ? 0 : 1
    return aRent - bRent
  })
}

/**
 * Owner-facing totals: rental income minus repair/expense costs.
 * Issue rows with no amount are ignored.
 */
export function summarizeReportAmounts(rows = []) {
  let income = 0
  let costs = 0
  for (const row of rows) {
    const n = parseReportAmount(row.amount)
    if (!n && row.type === 'Issue') continue
    if (row.source === 'rental' || row.type === 'Rental') {
      income += n
    } else if (row.type === 'Expense' || row.type === 'Repair') {
      costs += n
    } else if (row.type !== 'Issue') {
      costs += n
    }
  }
  return {
    income,
    costs,
    net: income - costs,
  }
}
