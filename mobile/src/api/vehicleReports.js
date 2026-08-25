import { apiRequest, ApiError } from './client';

const EMPTY_STORE = { entries: [], submissions: [] };

async function fetchVehicleReportsFromSyncPull() {
  const pull = await apiRequest('/api/sync/pull?last_pulled_at=0');
  const store = pull?.changes?.vehicleReports;
  if (store && Array.isArray(store.entries)) {
    return store;
  }
  return null;
}

export async function fetchVehicleReports() {
  try {
    return await apiRequest('/api/vehicle-reports');
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      try {
        const fromSync = await fetchVehicleReportsFromSyncPull();
        if (fromSync) return fromSync;
      } catch {
        /* older cloud deploy without sync fallback */
      }
      return { ...EMPTY_STORE, unavailable: true };
    }
    throw err;
  }
}

export function saveVehicleReports(store) {
  return apiRequest('/api/vehicle-reports', {
    method: 'PUT',
    body: JSON.stringify(store),
  });
}
