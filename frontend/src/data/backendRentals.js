import {
  fetchRentals,
  replaceRentals,
  addRental as postRental,
  submitPendingRental as postPendingRental,
} from '../api/backend'
import { enqueueOfflineOp } from '../utils/offlineQueue'

export async function loadRentals() {
  const rentals = await fetchRentals()
  return Array.isArray(rentals) ? rentals : []
}

export async function saveRentals(rentals) {
  try {
    await replaceRentals(rentals)
    return true
  } catch (err) {
    console.warn('Unable to persist rentals to backend', err)
    enqueueOfflineOp({ type: 'rentals', payload: rentals })
    return false
  }
}

export async function addRental(rental) {
  try {
    return await postRental(rental)
  } catch (err) {
    console.warn('Unable to add rental to backend', err)
    enqueueOfflineOp({ type: 'rentals-add', payload: rental })
    return null
  }
}

export async function submitPendingRental(rental) {
  try {
    return await postPendingRental(rental)
  } catch (err) {
    console.warn('Unable to submit pending rental to backend', err)
    enqueueOfflineOp({ type: 'pending-rental', payload: rental })
    return null
  }
}
