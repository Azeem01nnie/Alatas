import { safeSetItem } from './storage'

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
  return store
}

export function addReportEntry(entry) {
  const store = loadReportStore()
  const next = {
    ...entry,
    id: `vre_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }
  store.entries = [next, ...store.entries]
  saveReportStore(store)
  return next
}

export function updateReportEntry(id, patch) {
  const store = loadReportStore()
  store.entries = store.entries.map((e) => (e.id === id ? { ...e, ...patch } : e))
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
