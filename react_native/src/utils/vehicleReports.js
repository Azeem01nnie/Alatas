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

export function filterEntries(entries, { vehicleId, from, to } = {}) {
  return (entries || []).filter((e) => {
    if (vehicleId && String(e.vehicleId) !== String(vehicleId)) return false
    const d = new Date(e.date || e.createdAt || 0)
    if (Number.isNaN(d.getTime())) return false
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  })
}

export function sumAmounts(entries) {
  return (entries || []).reduce((sum, e) => {
    const n = Number(e.amount)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

export function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function toReportDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
