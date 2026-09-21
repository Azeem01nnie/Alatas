import {
  fetchAdminProfile as sbFetch,
  saveAdminProfileRemote as sbSave,
  clearAllAppData,
  fetchSystemStatus,
} from './supabaseBackend'

export function fetchAdminProfile() {
  return sbFetch()
}

export function saveAdminProfile(profile) {
  return sbSave(profile)
}

export function clearAppData() {
  return clearAllAppData()
}

export function getSystemStatus() {
  return fetchSystemStatus()
}
