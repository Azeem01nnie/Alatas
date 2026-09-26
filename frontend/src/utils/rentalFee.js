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

/** Parse peso strings like "₱1,200" into a number. */
export function parseRentalFeeAmount(value) {
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Sale amount for reports / X-Z:
 * 1) use saved rentalFee when > 0
 * 2) else recompute from rate card + duration (fleet vehicle preferred)
 */
export function resolveRentalSaleAmount(rental, fleetVehicle = null) {
  const saved = parseRentalFeeAmount(rental?.rental?.rentalFee)
  if (saved > 0) return saved

  const rates =
    fleetVehicle?.rates ||
    rental?.vehicle?.rates ||
    null
  if (!rates) return 0

  const duration = rental?.rental?.duration || ''
  const durationOther = rental?.rental?.durationOther || ''
  // Stored duration may already be "5hrs" or "2 days"
  let hours = parseDurationHours(duration, durationOther)
  if (hours == null && PRESET_HOURS[duration]) hours = PRESET_HOURS[duration]
  if (hours == null) {
    const days = parseDurationDays(duration)
    if (days) hours = days * 24
  }
  if (hours == null && rental?.rental?.feeHours != null) {
    hours = Number(rental.rental.feeHours) || null
  }
  if (hours == null) return 0

  const amount = calculateRentalFee(rates, hours)
  return amount == null ? 0 : Number(amount) || 0
}

/** Rentals that count toward est. revenue / X&Z (excludes cancelled & pending). */
export function isRevenueCountableRental(rental) {
  const approval = String(rental?.approvalStatus || 'accepted').toLowerCase()
  if (approval === 'pending' || approval === 'rejected') return false
  const life = String(rental?.rentalLifecycle || '').toLowerCase()
  if (life === 'pending_approval' || life === 'cancelled' || life === 'rejected') return false
  return true
}

/**
 * Whole overdue hours from periodTo → completedAt (or now if still active).
 */
export function resolveOverdueHours(rental, now = Date.now()) {
  const due = new Date(rental?.rental?.periodTo || 0).getTime()
  if (!due || Number.isNaN(due)) return 0

  const life = String(rental?.rentalLifecycle || '').toLowerCase()
  let endMs = Number(now) || Date.now()
  if (life === 'completed') {
    const completed = new Date(rental?.completedAt || 0).getTime()
    if (!completed || Number.isNaN(completed)) return 0
    endMs = completed
  } else if (life !== 'active') {
    return 0
  }

  const overdueMs = endMs - due
  if (overdueMs < 60_000) return 0
  return Math.ceil(overdueMs / 3_600_000)
}

/**
 * Overdue / exceed charge from periodTo → completedAt (or now if still active).
 * Prefers a recorded overdueFee after collection; otherwise rate × overdue hours.
 */
export function resolveOverdueCharge(rental, fleetVehicle = null, now = Date.now()) {
  const recorded = parseRentalFeeAmount(
    rental?.rental?.overdueFeeValue ?? rental?.rental?.overdueFee ?? '',
  )
  if (recorded > 0) return recorded

  const rates = fleetVehicle?.rates || rental?.vehicle?.rates || null
  const exceed = Number(rates?.exceedHour) || 0
  if (exceed <= 0) return 0

  const hours = resolveOverdueHours(rental, now)
  return hours > 0 ? hours * exceed : 0
}

/** Damage settlement / estimate amounts from return inspection. */
export function resolveDamageCharge(rental) {
  const insp = rental?.rental?.returnInspection
  if (!insp || typeof insp !== 'object') return 0

  const settlement = String(insp.settlement || '').toLowerCase()
  if (settlement === 'paid') return parseRentalFeeAmount(insp.paidAmount)
  if (settlement === 'partial') return parseRentalFeeAmount(insp.partialAmount)

  if (String(insp.assessment || '').toLowerCase() === 'estimate') {
    return parseRentalFeeAmount(insp.estimatedCost)
  }
  return 0
}

/** Outside-city destination fee stored on the rental (0 when within city). */
export function resolveOutsideCityCharge(rental) {
  const coverage = String(rental?.rental?.coverage || 'within_city').toLowerCase()
  if (coverage !== 'outside_city') return 0
  return parseRentalFeeAmount(
    rental?.rental?.outsideCityFee ?? rental?.rental?.outsideCityFeeLabel ?? 0,
  )
}

/** With-driver wage stored on the rental (0 for Self-drive). */
export function resolveDriverWageCharge(rental) {
  const type = String(rental?.rental?.rentalType || '').toLowerCase()
  if (type !== 'with-driver') return 0
  return parseRentalFeeAmount(rental?.rental?.driverFee)
}

/** Full charge stack: city fee + outside-city + driver + overdue + damage. */
export function resolveRentalChargeBreakdown(rental, fleetVehicle = null, now = Date.now()) {
  if (!isRevenueCountableRental(rental)) {
    return {
      base: 0,
      outsideCity: 0,
      driver: 0,
      overdue: 0,
      damage: 0,
      total: 0,
      countable: false,
    }
  }
  const base = resolveRentalSaleAmount(rental, fleetVehicle)
  const outsideCity = resolveOutsideCityCharge(rental)
  const driver = resolveDriverWageCharge(rental)
  const overdue = resolveOverdueCharge(rental, fleetVehicle, now)
  const damage = resolveDamageCharge(rental)
  return {
    base,
    outsideCity,
    driver,
    overdue,
    damage,
    total: base + outsideCity + driver + overdue + damage,
    countable: true,
  }
}

/** City + outside-city + driver from the live rent form (or saved rental blob). */
export function resolveRentalQuoteTotal(rentalLike = {}) {
  const r = rentalLike?.rental && typeof rentalLike.rental === 'object' ? rentalLike.rental : rentalLike
  const city = parseRentalFeeAmount(r?.rentalFee)
  const coverage = String(r?.coverage || 'within_city').toLowerCase()
  const outside =
    coverage === 'outside_city' ? parseRentalFeeAmount(r?.outsideCityFee) : 0
  const type = String(r?.rentalType || '').toLowerCase()
  const driver = type === 'with-driver' ? parseRentalFeeAmount(r?.driverFee) : 0
  return Math.max(0, city + outside + driver)
}

/** Amount already received toward the quote. */
export function resolveAmountPaid(rentalLike = {}) {
  const r = rentalLike?.rental && typeof rentalLike.rental === 'object' ? rentalLike.rental : rentalLike
  const paid = parseRentalFeeAmount(
    r?.amountPaidValue ?? r?.amountPaid ?? rentalLike?.amountPaidValue ?? rentalLike?.amountPaid ?? 0,
  )
  return Math.max(0, paid)
}

/** First payment recorded at encoding (does not change when vehicle fees are added later). */
export function resolveInitialPayment(rentalLike = {}) {
  const r = rentalLike?.rental && typeof rentalLike.rental === 'object' ? rentalLike.rental : rentalLike
  const initial = parseRentalFeeAmount(
    r?.initialPaymentValue ??
      r?.initialPayment ??
      rentalLike?.initialPaymentValue ??
      rentalLike?.initialPayment ??
      '',
  )
  if (initial > 0) return initial
  // Older rentals: treat current amount paid as the first payment snapshot.
  return resolveAmountPaid(rentalLike)
}

/** Remaining balance = quote total − paid (never negative). */
export function resolveBalanceDue(rentalLike = {}) {
  const r = rentalLike?.rental && typeof rentalLike.rental === 'object' ? rentalLike.rental : rentalLike
  const storedTotal = parseRentalFeeAmount(
    r?.totalAmountValue ?? r?.totalAmount ?? rentalLike?.totalAmountValue ?? rentalLike?.totalAmount ?? 0,
  )
  const quote = storedTotal > 0 ? storedTotal : resolveRentalQuoteTotal(rentalLike)
  const paid = resolveAmountPaid(rentalLike)
  return Math.max(0, quote - paid)
}

export function resolveRentalTotalCharges(rental, fleetVehicle = null, now = Date.now()) {
  return resolveRentalChargeBreakdown(rental, fleetVehicle, now).total
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
