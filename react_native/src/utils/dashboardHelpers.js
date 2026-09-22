function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function startOfWeek(date) {
  const d = startOfDay(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function toDateKey(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseFee(fee) {
  if (fee == null || fee === '') return 0
  const n = Number(String(fee).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function formatDashDayLabel(date) {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatRangeCaption(from, to) {
  const sameYear = from.getFullYear() === to.getFullYear()
  const fromLabel = from.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
  const toLabel = to.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${fromLabel} – ${toLabel}`
}

export function getRevenueRange(preset) {
  const now = new Date()

  if (preset === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: startOfDay(from), to: endOfDay(to) }
  }

  if (preset === 'year') {
    const from = new Date(now.getFullYear(), 0, 1)
    const to = new Date(now.getFullYear(), 11, 31)
    return { from: startOfDay(from), to: endOfDay(to) }
  }

  const from = startOfWeek(now)
  const to = new Date(from)
  to.setDate(to.getDate() + 6)
  return { from: startOfDay(from), to: endOfDay(to) }
}

export function buildDailyRevenueSeries(rentals, from, to) {
  const fromMs = from.getTime()
  const toMs = to.getTime()
  const byDay = new Map()

  for (const r of rentals || []) {
    const encoded = new Date(r.encodedAt || r.createdAt || 0).getTime()
    if (!Number.isFinite(encoded) || encoded < fromMs || encoded > toMs) continue
    const key = toDateKey(encoded)
    const prev = byDay.get(key) || { revenue: 0, count: 0 }
    prev.revenue += parseFee(r.rental?.rentalFee)
    prev.count += 1
    byDay.set(key, prev)
  }

  const series = []
  const cursor = startOfDay(from)
  const last = startOfDay(to)
  while (cursor.getTime() <= last.getTime()) {
    const key = toDateKey(cursor)
    const bucket = byDay.get(key) || { revenue: 0, count: 0 }
    series.push({
      date: key,
      shortLabel: formatDashDayLabel(cursor),
      revenue: bucket.revenue,
      count: bucket.count,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const count = series.reduce((sum, d) => sum + d.count, 0)
  const revenue = series.reduce((sum, d) => sum + d.revenue, 0)
  return { series, count, revenue, from, to }
}

export function formatTimeRemaining(target, now = Date.now(), { mode = 'remaining' } = {}) {
  if (!target) return null
  const end = new Date(target).getTime()
  if (Number.isNaN(end)) return null
  const diffMs = end - now
  const abs = Math.abs(diffMs)
  const totalMins = Math.floor(abs / 60_000)
  const days = Math.floor(totalMins / (60 * 24))
  const hours = Math.floor((totalMins % (60 * 24)) / 60)
  const mins = totalMins % 60
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 || days > 0) parts.push(`${hours}h`)
  parts.push(`${mins}m`)
  const label = parts.join(' ')
  if (diffMs < 0) return `Overdue by ${label}`
  if (totalMins < 1) return mode === 'untilStart' ? 'Starting now' : 'Due now'
  if (mode === 'untilStart') return `starts in ${label}`
  return `${label} remaining`
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function customerName(r) {
  const p = r?.personal || {}
  return (
    [p.firstName, p.lastName].filter(Boolean).join(' ').trim() ||
    p.fullName ||
    p.name ||
    'Customer'
  )
}
