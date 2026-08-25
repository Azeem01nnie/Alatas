import { getCloudApiUrl, isCloudConfigured, pushToCloud, CLOUD_SYNC_ENABLED } from './cloudSync'

const LOCAL_API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:4000' : '')
).replace(/\/$/, '')

function groupEntriesByVehicle(entries) {
  const map = new Map()
  ;(entries || []).forEach((entry) => {
    const key = String(entry?.vehicleId ?? '')
    if (!key) return
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(entry)
  })
  return map
}

async function putReportStore(url, store) {
  const response = await fetch(`${url.replace(/\/$/, '')}/api/vehicle-reports`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(store),
  })
  if (!response.ok) {
    throw new Error(`Could not sync vehicle reports (${response.status})`)
  }
  return response.json()
}

async function pushReportEntriesViaVehicles(store) {
  const { fetchVehicles, replaceVehicles } = await import('./backend')
  const vehicles = await fetchVehicles()
  if (!Array.isArray(vehicles) || !vehicles.length) return false

  const byVehicle = groupEntriesByVehicle(store.entries)
  const updated = vehicles.map((vehicle) => ({
    ...vehicle,
    reportEntries: byVehicle.get(String(vehicle.id)) || [],
  }))

  if (LOCAL_API_URL) {
    await replaceVehicles(updated)
  }

  if (isCloudConfigured() && CLOUD_SYNC_ENABLED) {
    await pushToCloud({ vehicles: { updated } })
  }

  return true
}

export async function pushVehicleReportsToCloud(store) {
  let synced = false

  if (LOCAL_API_URL) {
    try {
      await putReportStore(LOCAL_API_URL, store)
      synced = true
    } catch {
      /* local backend offline */
    }
  }

  if (isCloudConfigured()) {
    try {
      await putReportStore(getCloudApiUrl(), store)
      synced = true
    } catch {
      /* dedicated cloud route may not be deployed yet */
    }

    if (CLOUD_SYNC_ENABLED) {
      try {
        await pushToCloud({ vehicleReports: { updated: [store] } })
        synced = true
      } catch {
        /* sync/push fallback may not be deployed yet */
      }
    }
  }

  try {
    const viaVehicles = await pushReportEntriesViaVehicles(store)
    if (viaVehicles) synced = true
  } catch {
    /* vehicle embed fallback */
  }

  if (!synced && (LOCAL_API_URL || isCloudConfigured())) {
    throw new Error('Could not sync vehicle reports')
  }

  return store
}

export async function fetchVehicleReportsFromCloud() {
  if (!isCloudConfigured()) return null

  const url = `${getCloudApiUrl()}/api/vehicle-reports`
  const response = await fetch(url)
  if (response.ok) return response.json()

  if (response.status === 404 && CLOUD_SYNC_ENABLED) {
    try {
      const pull = await fetch(
        `${getCloudApiUrl()}/api/sync/pull?last_pulled_at=0`,
      )
      if (pull.ok) {
        const data = await pull.json()
        if (data?.changes?.vehicleReports) return data.changes.vehicleReports
      }
    } catch {
      /* ignore */
    }
  }

  return null
}
