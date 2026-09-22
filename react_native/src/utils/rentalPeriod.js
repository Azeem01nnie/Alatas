/** Join hour + minute into "H:MM" for parsing/labels */
export function composeTime(hour, minute) {
  const h = String(hour ?? '').trim()
  const m = String(minute ?? '').trim()
  if (!h || m === '') return ''
  const minuteNum = parseInt(m, 10)
  if (Number.isNaN(minuteNum)) return ''
  return `${h}:${String(minuteNum).padStart(2, '0')}`
}

/** Build a readable label, e.g. "2026-08-05 2:30 PM" */
export function formatPeriodLabel(date, time, meridiem) {
  if (!date?.trim() || !time?.trim() || !meridiem) return ''
  return `${date.trim()} ${normalizeTime(time)} ${meridiem}`
}

function normalizeTime(time) {
  const cleaned = String(time).trim().replace('.', ':')
  const match = cleaned.match(/^(\d{1,2})(?::(\d{1,2}))?$/)
  if (!match) return cleaned
  const h = Math.min(12, Math.max(1, parseInt(match[1], 10)))
  const m = Math.min(59, Math.max(0, parseInt(match[2] || '0', 10)))
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Convert date + 12h time + AM/PM to a Date, or null if invalid */
export function toPeriodDate(date, time, meridiem) {
  if (!date?.trim() || !time?.trim() || !meridiem) return null
  const cleaned = String(time).trim().replace('.', ':')
  const match = cleaned.match(/^(\d{1,2})(?::(\d{1,2}))?$/)
  if (!match) return null

  let hour = parseInt(match[1], 10)
  const minute = parseInt(match[2] || '0', 10)
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null

  if (meridiem === 'PM' && hour !== 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0

  const [y, mo, d] = date.split('-').map((n) => parseInt(n, 10))
  if (!y || !mo || !d) return null

  const result = new Date(y, mo - 1, d, hour, minute, 0, 0)
  return Number.isNaN(result.getTime()) ? null : result
}

export function isValidHour(hour) {
  const cleaned = String(hour ?? '').trim()
  if (!/^\d{1,2}$/.test(cleaned)) return false
  const h = parseInt(cleaned, 10)
  return h >= 1 && h <= 12
}

export function isValidMinute(minute) {
  const cleaned = String(minute ?? '').trim()
  if (!/^\d{1,2}$/.test(cleaned)) return false
  const m = parseInt(cleaned, 10)
  return m >= 0 && m <= 59
}

export function isValidTimeInput(time) {
  const cleaned = String(time || '').trim().replace('.', ':')
  const match = cleaned.match(/^(\d{1,2})(?::(\d{1,2}))?$/)
  if (!match) return false
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2] || '0', 10)
  return h >= 1 && h <= 12 && m >= 0 && m <= 59
}

/** Keep only digits, max 2 characters */
export function sanitizeTimePart(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 2)
}
