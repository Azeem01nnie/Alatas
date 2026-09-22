/** Start of local calendar day (ms). */
function startOfLocalDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * True when a scheduled rental is in the "Scheduled" window:
 * from the calendar day before periodFrom through the start day.
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

function openRentalsForVehicle(vehicleId, rentals) {
  const key = String(vehicleId)
  return (rentals || []).filter((r) => {
    const rid = String(r.vehicleId || r.vehicle?.id || '')
    return (
      rid === key &&
      (r.rentalLifecycle === 'scheduled' ||
        r.rentalLifecycle === 'active' ||
        r.rentalLifecycle === 'pending_approval') &&
      r.approvalStatus !== 'rejected'
    )
  })
}

function pendingForVehicle(vehicleId, rentals) {
  const key = String(vehicleId)
  return (rentals || []).some(
    (r) =>
      String(r.vehicleId || r.vehicle?.id || '') === key &&
      (r.approvalStatus === 'pending' || r.rentalLifecycle === 'pending_approval'),
  )
}

/**
 * Simplified display status: maintenance | pending_approval | active | scheduled | available
 */
export function getDisplayStatus(vehicle, rentals, now = Date.now()) {
  if (!vehicle) return 'available'
  const stored = String(vehicle.status || '')
  if (stored === 'Under Maintenance') return 'maintenance'

  if (pendingForVehicle(vehicle.id, rentals)) return 'pending_approval'

  const open = openRentalsForVehicle(vehicle.id, rentals).filter(
    (r) => r.approvalStatus !== 'pending',
  )
  if (open.some((r) => r.rentalLifecycle === 'active')) return 'active'

  const blockingScheduled = open.some(
    (r) =>
      r.rentalLifecycle === 'scheduled' && isScheduledWindow(r.rental?.periodFrom, now),
  )
  if (blockingScheduled) return 'scheduled'

  return 'available'
}

export function displayStatusLabel(status) {
  switch (status) {
    case 'active':
      return 'On Rent'
    case 'scheduled':
      return 'Scheduled'
    case 'pending_approval':
      return 'Pending approval'
    case 'maintenance':
      return 'Under Maintenance'
    case 'available':
    default:
      return 'Available'
  }
}

export function statusClassForDisplay(status) {
  switch (status) {
    case 'available':
      return 'status-available'
    case 'active':
      return 'status-rented'
    case 'scheduled':
      return 'status-scheduled'
    case 'pending_approval':
      return 'status-pending'
    case 'maintenance':
      return 'status-maintenance'
    default:
      return 'status-available'
  }
}

/** Earliest upcoming open rental for archive-block messaging. */
export function getBlockingRental(vehicleId, rentals) {
  const open = openRentalsForVehicle(vehicleId, rentals).filter(
    (r) => r.approvalStatus !== 'pending' && r.approvalStatus !== 'rejected',
  )
  if (!open.length) return null
  return [...open].sort((a, b) => {
    const ta = new Date(a.rental?.periodFrom || 0).getTime()
    const tb = new Date(b.rental?.periodFrom || 0).getTime()
    return ta - tb
  })[0]
}
