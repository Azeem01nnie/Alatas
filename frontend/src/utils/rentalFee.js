import { composeTime, toPeriodDate } from './rentalPeriod'
import { formatPeso } from '../data/vehicles'

const PRESET_HOURS = {
  '5hrs': 5,
  '12hrs': 12,
  '24hrs': 24,
}

/** Parse Others input as whole days only — "16", "16 days", "2d" → days or null */
export function parseDurationDays(durationOther = '') {
  const raw = String(durationOther || '').trim().toLowerCase()
  if (!raw) return null
  const match = raw.match(/^(\d+)\s*(days?|d)?\s*$/)
  if (!match) return null
  const days = parseInt(match[1], 10)
  if (!Number.isFinite(days) || days < 1) return null
  return days
}

/** Format stored Others value as "N day(s)" */
export function formatDurationDaysLabel(durationOther = '') {
  const days = parseDurationDays(durationOther)
  if (!days) return ''
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/** Preset hours, or Others days × 24 → hours or null */
export function parseDurationHours(duration, durationOther = '') {
  if (PRESET_HOURS[duration]) return PRESET_HOURS[duration]
  if (duration !== 'Others') return null
  const days = parseDurationDays(durationOther)
  return days ? days * 24 : null
}

/** City-drive fee from rate card + hours */
export function calculateRentalFee(rates, hours) {
  if (!rates || hours == null || hours <= 0) return null
  const hrs5 = Number(rates.hrs5) || 0
  const hrs12 = Number(rates.hrs12) || 0
  const hrs24 = Number(rates.hrs24) || 0
  const exceed = Number(rates.exceedHour) || 0

  if (hours <= 5) return hrs5
  if (hours <= 12) return hrs12
  if (hours <= 24) return hrs24

  const days = Math.floor(hours / 24)
  const rem = hours % 24
  let fee = days * hrs24
  if (rem === 0) return fee
  fee += rem * exceed
  return fee
}

export function formatRentalFee(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return ''
  return formatPeso(amount)
}

export function feeBreakdownLabel(rates, hours) {
  if (!rates || hours == null || hours <= 0) return ''
  if (hours <= 5) return `5-hour package`
  if (hours <= 12) return `12-hour package`
  if (hours <= 24) return `24-hour package`
  const days = Math.floor(hours / 24)
  const rem = hours % 24
  if (rem === 0) return `${days} × 24-hour package`
  return `${days} × 24h + ${rem} exceeding hr${rem === 1 ? '' : 's'}`
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function dateToPeriodParts(date) {
  if (!date || Number.isNaN(date.getTime())) return null
  let h = date.getHours()
  const meridiem = h >= 12 ? 'PM' : 'AM'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return {
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    hour: String(h12),
    minute: pad2(date.getMinutes()),
    meridiem,
  }
}

/** Build To fields from From + duration hours */
export function computePeriodTo(data, hours) {
  if (!hours) return null
  const fromTime = composeTime(data.fromHour, data.fromMinute)
  const fromDt = toPeriodDate(data.fromDate, fromTime, data.fromMeridiem)
  if (!fromDt) return null
  const toDt = new Date(fromDt.getTime() + hours * 60 * 60 * 1000)
  const parts = dateToPeriodParts(toDt)
  if (!parts) return null
  return {
    toDate: parts.date,
    toHour: parts.hour,
    toMinute: parts.minute,
    toMeridiem: parts.meridiem,
  }
}

/** Returns patch of auto-computed rental fields */
export function buildRentalAutoPatch(data, rates) {
  const hours = parseDurationHours(data.duration, data.durationOther)
  const patch = {}

  if (hours && data.fromDate && data.fromHour && data.fromMinute !== '' && data.fromMeridiem) {
    const toParts = computePeriodTo(data, hours)
    if (toParts) Object.assign(patch, toParts)
  }

  if (hours && rates) {
    const amount = calculateRentalFee(rates, hours)
    if (amount != null) {
      patch.rentalFee = formatRentalFee(amount)
      patch.feeHours = hours
      patch.feeNote = feeBreakdownLabel(rates, hours)
    }
  } else if (data.duration === 'Others' && !hours) {
    patch.rentalFee = ''
    patch.feeHours = null
    patch.feeNote = ''
  }

  return patch
}
