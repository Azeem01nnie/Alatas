import {
  fetchRentals as sbFetchRentals,
  fetchPendingRentals as sbFetchPending,
  submitPendingRental as sbSubmitPending,
  acceptPendingRental as sbAccept,
  rejectPendingRental as sbReject,
  patchRentalCarPhotos,
  addRental as sbAddRental,
  completeVehicleRental as sbComplete,
  replaceRentals as sbReplaceRentals,
} from './supabaseBackend'

export function fetchRentals() {
  return sbFetchRentals()
}

export function fetchPendingRentals() {
  return sbFetchPending()
}

export function submitPendingRental(rental) {
  return sbSubmitPending(rental)
}

export function acceptPendingRental(id) {
  return sbAccept(id)
}

export function rejectPendingRental(id, reason = '') {
  return sbReject(id, reason)
}

export function updateRentalCarPhotos(id, carPhotos, addedBy) {
  return patchRentalCarPhotos(id, carPhotos, addedBy)
}

export function addRental(rental) {
  return sbAddRental(rental)
}

export function completeVehicleRental(vehicleId, plateNo = '', rentalId = '') {
  return sbComplete(vehicleId, plateNo, rentalId)
}

export function replaceRentals(rentals, options = {}) {
  return sbReplaceRentals(rentals, options)
}
