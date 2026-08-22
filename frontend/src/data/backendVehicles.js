import { fetchVehicles, replaceVehicles, deleteVehicle as apiDeleteVehicle } from '../api/backend'
import { enqueueOfflineOp } from '../utils/offlineQueue'

export async function loadVehicles() {
  const vehicles = await fetchVehicles()
  return Array.isArray(vehicles) ? vehicles : []
}

export async function saveVehicles(vehicles) {
  try {
    await replaceVehicles(vehicles)
    return true
  } catch (err) {
    console.warn('Unable to persist vehicles to backend', err)
    enqueueOfflineOp({ type: 'vehicles', payload: vehicles })
    return false
  }
}

export async function deleteVehicle(id) {
  try {
    return await apiDeleteVehicle(id)
  } catch (err) {
    console.warn('Unable to delete vehicle from backend', err)
    return null
  }
}
