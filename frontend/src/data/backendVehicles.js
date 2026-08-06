import { fetchVehicles, replaceVehicles, deleteVehicle as apiDeleteVehicle } from '../api/backend'

export async function loadVehicles() {
  try {
    const vehicles = await fetchVehicles()
    return Array.isArray(vehicles) ? vehicles : []
  } catch {
    return []
  }
}

export async function saveVehicles(vehicles) {
  try {
    await replaceVehicles(vehicles)
    return true
  } catch (err) {
    console.warn('Unable to persist vehicles to backend', err)
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
