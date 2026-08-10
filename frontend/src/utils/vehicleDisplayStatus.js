/** Start of local calendar day (ms). */
function startOfLocalDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * True when a scheduled rental is in the "Scheduled" window:
 * from the calendar day before periodFrom through the start day
 * (until the rental becomes active).
 */
export function isScheduledWindow(periodFrom, now = Date.now()) {
  if (!periodFrom) return false
  const start = new Date(periodFrom)
  if (Number.isNaN(start.getTime())) return false

  const startDay = startOfLocalDay(start)
  const prepDay = startDay - 24 * 60 * 60 * 1000
  const today = startOfLocalDay(now)
  return today >= prepDay
}

export function openRentalsForVehicle(vehicleId, rentals) {
  const key = String(vehicleId)
  return (rentals || []).filter(
    (r) =>
      String(r.vehicle?.id) === key &&
      (r.rentalLifecycle === 'scheduled' || r.rentalLifecycle === 'active'),
  )
}

/**
 * Display status for Manage Vehicle / Rent Car.
 * - Under Maintenance (stored)
 * - On Rent (active rental) → 'Rented'
 * - Scheduled (day before start through start day while still scheduled)
 * - Available otherwise (far-future scheduled does not lock the fleet badge)
 */
export function getDisplayStatus(vehicle, rentals, now = Date.now()) {
  if (!vehicle) return 'Available'
  if (vehicle.status === 'Under Maintenance') return 'Under Maintenance'

  const open = openRentalsForVehicle(vehicle.id, rentals)
  if (open.some((r) => r.rentalLifecycle === 'active')) return 'Rented'

  const blockingScheduled = open.some(
    (r) =>
      r.rentalLifecycle === 'scheduled' && isScheduledWindow(r.rental?.periodFrom, now),
  )
  if (blockingScheduled) return 'Scheduled'

  return 'Available'
}

export function displayStatusLabel(status) {
  if (status === 'Rented') return 'On Rent'
  return status || 'Available'
}

export function statusClassForDisplay(status) {
  if (status === 'Available') return 'status-available'
  if (status === 'Rented') return 'status-rented'
  if (status === 'Scheduled') return 'status-scheduled'
  return 'status-maintenance'
}

/** Earliest upcoming open rental for archive-block messaging. */
export function getBlockingRental(vehicleId, rentals) {
  const open = openRentalsForVehicle(vehicleId, rentals)
  if (!open.length) return null
  return [...open].sort((a, b) => {
    const ta = new Date(a.rental?.periodFrom || 0).getTime()
    const tb = new Date(b.rental?.periodFrom || 0).getTime()
    return ta - tb
  })[0]
}
