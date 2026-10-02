import { safeSetItem } from './storage'
import { formatRentalFee } from './rentalFee'

const STORE_KEY = 'alatas-driver-wage'

/** With-driver is always billed at least this many hours. */
export const DRIVER_MIN_HOURS = 12

function normalizeRate(value) {
  const rate = Number(value)
  return Number.isFinite(rate) && rate > 0 ? rate : 0
}

function normalizeSettings(settings = {}) {
  // Older installs stored a single wage. Use it for both coverages until the
  // admin saves the new, separate rates.
  const legacyRate = normalizeRate(settings?.wagePerHour)
  return {
    withinCityWagePerHour: normalizeRate(settings?.withinCityWagePerHour) || legacyRate,
    outsideCityWagePerHour: normalizeRate(settings?.outsideCityWagePerHour) || legacyRate,
    updatedAt: settings?.updatedAt || null,
  }
}

export function loadDriverWageSettings() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return normalizeSettings()
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return normalizeSettings()
  }
}

export function saveDriverWageSettings(settings = {}) {
  const normalized = normalizeSettings(settings)
  const next = {
    withinCityWagePerHour: normalized.withinCityWagePerHour,
    outsideCityWagePerHour: normalized.outsideCityWagePerHour,
    updatedAt: new Date().toISOString(),
  }
  safeSetItem(STORE_KEY, JSON.stringify(next))
  return next
}

export function replaceDriverWageSettings(settings) {
  return saveDriverWageSettings(settings || {})
}

/** Billable driver hours = max(rental hours, 12). */
export function resolveDriverBillableHours(rentalHours) {
  const h = Number(rentalHours) || 0
  if (h <= 0) return DRIVER_MIN_HOURS
  return Math.max(h, DRIVER_MIN_HOURS)
}

export function computeDriverWageCharge(wagePerHour, rentalHours) {
  const rate = Math.max(0, Number(wagePerHour) || 0)
  if (rate <= 0) {
    return { wagePerHour: 0, billableHours: 0, fee: 0 }
  }
  const billableHours = resolveDriverBillableHours(rentalHours)
  return {
    wagePerHour: rate,
    billableHours,
    fee: rate * billableHours,
  }
}

/**
 * Patch fields for the rent form / saved rental when type is With-driver.
 * Clears driver fields for Self-drive.
 */
export function buildDriverFeePatch(
  rentalType,
  rentalHours,
  coverage = 'within_city',
  settings = loadDriverWageSettings(),
) {
  if (String(rentalType || '') !== 'With-driver') {
    return {
      driverWagePerHour: '',
      driverBillableHours: null,
      driverFee: '',
      driverFeeNote: '',
    }
  }

  const normalized = normalizeSettings(settings)
  const isOutsideCity = String(coverage || '') === 'outside_city'
  const rate = isOutsideCity
    ? normalized.outsideCityWagePerHour
    : normalized.withinCityWagePerHour
  const coverageLabel = isOutsideCity ? 'outside-city' : 'in-city'
  const hours = Number(rentalHours) || 0

  if (rate <= 0) {
    return {
      driverWagePerHour: '',
      driverBillableHours: hours > 0 ? resolveDriverBillableHours(hours) : DRIVER_MIN_HOURS,
      driverFee: '',
      driverFeeNote: `Set ${coverageLabel} driver wage/hour in Settings`,
    }
  }

  if (hours <= 0) {
    return {
      driverWagePerHour: formatRentalFee(rate),
      driverBillableHours: DRIVER_MIN_HOURS,
      driverFee: '',
      driverFeeNote: `Driver (${coverageLabel}) · ₱${rate.toLocaleString('en-PH')}/hr · min ${DRIVER_MIN_HOURS} hrs (select duration)`,
    }
  }

  const calc = computeDriverWageCharge(rate, hours)
  const minApplied = calc.billableHours > hours
  return {
    driverWagePerHour: formatRentalFee(calc.wagePerHour),
    driverBillableHours: calc.billableHours,
    driverFee: formatRentalFee(calc.fee),
    driverFeeNote: minApplied
      ? `${formatRentalFee(calc.wagePerHour)}/hr × ${calc.billableHours} hrs (min ${DRIVER_MIN_HOURS}; rental is ${hours}h)`
      : `${formatRentalFee(calc.wagePerHour)}/hr × ${calc.billableHours} hr${calc.billableHours === 1 ? '' : 's'}`,
  }
}
