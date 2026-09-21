import {
  fetchVehicleReportsRemote,
  saveVehicleReportsRemote,
  patchVehicleReportEntries,
} from './supabaseBackend'

const EMPTY_STORE = { entries: [], submissions: [] }

export async function fetchVehicleReports() {
  try {
    return await fetchVehicleReportsRemote()
  } catch (err) {
    console.warn('Vehicle reports load failed', err?.message || err)
    return { ...EMPTY_STORE, unavailable: true }
  }
}

export function saveVehicleReports(store) {
  return saveVehicleReportsRemote(store)
}

export function patchVehicleReports(vehicleId, entries) {
  return patchVehicleReportEntries(vehicleId, entries)
}
