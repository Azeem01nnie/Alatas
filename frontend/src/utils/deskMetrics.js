import {
  isCountableCustomerRental,
  loadCustomers,
} from './customers'
import {
  parseRentalFeeAmount,
  resolveBalanceDue,
  resolveDriverWageCharge,
  resolveOutsideCityCharge,
  resolveOverdueCharge,
  resolveRentalSaleAmount,
  isRevenueCountableRental,
} from './rentalFee'

function fleetVehicleFor(rental, vehicles = []) {
  const id = String(rental?.vehicleId || rental?.vehicle?.id || '')
  if (id) {
    const hit = vehicles.find((v) => String(v.id) === id)
    if (hit) return hit
  }
  const plate = String(rental?.vehicle?.plateNo || '')
    .trim()
    .toUpperCase()
  if (!plate) return rental?.vehicle || null
  return (
    vehicles.find(
      (v) => String(v.plateNo || '').trim().toUpperCase() === plate,
    ) ||
    rental?.vehicle ||
    null
  )
}

function isOpenAccepted(rental) {
  const approval = String(rental?.approvalStatus || 'accepted').toLowerCase()
  return approval !== 'pending' && approval !== 'rejected'
}

/**
 * Agreed rental revenue for desk KPIs.
 * Prefers saved totalAmount (city + outside + driver + change extras).
 * Adds live overdue only. Never includes damage estimates/settlements.
 */
function resolveRentalRevenue(rental, fleetVehicle = null, now = Date.now()) {
  if (!isRevenueCountableRental(rental)) return 0
  const r = rental?.rental && typeof rental.rental === 'object' ? rental.rental : {}
  const stored = parseRentalFeeAmount(r.totalAmountValue ?? r.totalAmount ?? 0)
  const overdue = resolveOverdueCharge(rental, fleetVehicle, now)
  if (stored > 0) return stored + overdue

  const base = resolveRentalSaleAmount(rental, fleetVehicle)
  const outside = resolveOutsideCityCharge(rental)
  const driver = resolveDriverWageCharge(rental)
  return Math.max(0, base + outside + driver + overdue)
}

/**
 * Desk KPIs for the dashboard strip.
 * Money figures are lifetime totals from countable rentals.
 */
export function buildDeskDashboardMetrics(rentals = [], vehicles = []) {
  const rows = Array.isArray(rentals) ? rentals : []
  const fleet = Array.isArray(vehicles) ? vehicles : []
  const now = Date.now()

  const checkIn = rows.filter(
    (r) => String(r?.rentalLifecycle || '').toLowerCase() === 'active' && isOpenAccepted(r),
  ).length
  const booking = rows.filter(
    (r) => String(r?.rentalLifecycle || '').toLowerCase() === 'scheduled' && isOpenAccepted(r),
  ).length

  let rentalsCount = 0
  let addOns = 0
  let excessHours = 0
  let discounts = 0
  let grandTotal = 0
  let rentalDays = 0
  let balanceDue = 0
  const rentedVehicles = new Set()

  for (const r of rows) {
    if (!isCountableCustomerRental(r)) continue
    rentalsCount += 1

    const fleetRow = fleetVehicleFor(r, fleet)
    addOns += resolveOutsideCityCharge(r) + resolveDriverWageCharge(r)
    excessHours += resolveOverdueCharge(r, fleetRow, now)

    const discount = Number(
      String(
        r?.rental?.discountAmountValue ??
          r?.rental?.discountAmount ??
          r?.discountAmountValue ??
          r?.discountAmount ??
          '',
      ).replace(/[^\d.]/g, ''),
    )
    const discountAmt = Number.isFinite(discount) && discount > 0 ? discount : 0
    discounts += discountAmt
    // totalAmountValue is already net of discount when encoded from Payment step.
    grandTotal += Math.max(0, resolveRentalRevenue(r, fleetRow, now))

    const life = String(r?.rentalLifecycle || '').toLowerCase()
    if (isOpenAccepted(r) && (life === 'active' || life === 'scheduled')) {
      balanceDue += resolveBalanceDue(r)
    }

    const fromMs = r?.rental?.periodFrom ? new Date(r.rental.periodFrom).getTime() : NaN
    const toMs = r?.rental?.periodTo ? new Date(r.rental.periodTo).getTime() : NaN
    if (Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs > fromMs) {
      rentalDays += Math.max(1, Math.ceil((toMs - fromMs) / 86_400_000))
    } else {
      rentalDays += 1
    }

    const vid = String(r.vehicleId || r.vehicle?.id || '')
    const plate = String(r.vehicle?.plateNo || '').trim().toUpperCase()
    if (vid) rentedVehicles.add(`id:${vid}`)
    else if (plate) rentedVehicles.add(`plate:${plate}`)
  }

  const customers = loadCustomers()
  const blacklistedCustomers = customers.filter((c) => Boolean(c.blacklisted)).length
  const activeCustomers = customers.filter(
    (c) => !c.blacklisted && Number(c.rentalCount || 0) > 0,
  ).length

  return {
    checkIn,
    booking,
    rentals: rentalsCount,
    addOns,
    excessHours,
    discounts,
    grandTotal,
    balanceDue,
    averageDailyRate: rentalDays > 0 ? grandTotal / rentalDays : 0,
    totalVehicleRented: rentedVehicles.size,
    blacklistedCustomers,
    activeCustomers,
  }
}
