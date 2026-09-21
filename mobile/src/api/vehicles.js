import {
  fetchVehicles as sbFetchVehicles,
  replaceVehicles as sbReplaceVehicles,
  deleteVehicle as sbDeleteVehicle,
} from './supabaseBackend'

export function fetchVehicles() {
  return sbFetchVehicles()
}

export function replaceVehicles(vehicles, options = {}) {
  return sbReplaceVehicles(vehicles, options)
}

export function deleteVehicle(id) {
  return sbDeleteVehicle(id)
}
