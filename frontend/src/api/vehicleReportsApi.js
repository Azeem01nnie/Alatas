import { isSupabaseConfigured } from './supabaseClient'
import {
  fetchVehicleReportsRemote,
  patchVehicleReportEntries,
  saveVehicleReportsRemote,
} from './backend'
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

function normalizeStore(store) {
  return {
    entries: Array.isArray(store?.entries) ? store.entries : [],
    submissions: Array.isArray(store?.submissions) ? store.submissions : [],
  }
}

async function putReportStore(url, store) {
  const response = await fetch(`${url.replace(/\/$/, '')}/api/vehicle-reports`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizeStore(store)),
  })
  if (!response.ok) {
    throw new Error(`Could not sync vehicle reports (${response.status})`)
  }
  return response.json()
}

/**
 * Mirror entries onto each vehicle's report_entries column only.
 * Never call replaceVehicles — that was wiping owner / vehicle fields.
 */
async function mirrorReportEntriesOntoVehicles(store) {
  if (!isSupabaseConfigured) return false
  const byVehicle = groupEntriesByVehicle(store?.entries)
  if (!byVehicle.size) return true

  await Promise.all(
    [...byVehicle.entries()].map(([vehicleId, entries]) =>
      patchVehicleReportEntries(vehicleId, entries),
    ),
  )
  return true
}

export async function pushVehicleReportsToCloud(store) {
  const payload = normalizeStore(store)
  let synced = false

  // Primary: Supabase app_settings (source of truth for desk/PWA).
  if (isSupabaseConfigured) {
    try {
      await saveVehicleReportsRemote(payload)
      synced = true
      try {
        await mirrorReportEntriesOntoVehicles(payload)
      } catch (err) {
        console.warn('Could not mirror report entries onto vehicles', err)
      }
    } catch (err) {
      console.warn('Supabase vehicle reports save failed', err)
    }
  }

  if (LOCAL_API_URL) {
    try {
      await putReportStore(LOCAL_API_URL, payload)
      synced = true
    } catch {
      /* local Express may be offline when using Supabase */
    }
  }

  if (isCloudConfigured()) {
    try {
      await putReportStore(getCloudApiUrl(), payload)
      synced = true
    } catch {
      /* dedicated cloud route may not be deployed yet */
    }

    if (CLOUD_SYNC_ENABLED) {
      try {
        await pushToCloud({ vehicleReports: { updated: [payload] } })
        synced = true
      } catch {
        /* sync/push fallback may not be deployed yet */
      }
    }
  }

  if (!synced && isSupabaseConfigured) {
    throw new Error('Could not save vehicle reports to Supabase')
  }

  return payload
}

export async function fetchVehicleReportsFromCloud() {
  // Supabase is the source of truth. An empty store must win — do not fall
  // through to Render/local API or wiped expenses get resurrected.
  if (isSupabaseConfigured) {
    try {
      return await fetchVehicleReportsRemote()
    } catch (err) {
      console.warn('Supabase vehicle reports fetch failed', err)
    }
  }

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

/** Wipe local + every cloud mirror so Clear data cannot leave expenses behind. */
export async function clearVehicleReportsEverywhere() {
  const empty = { entries: [], submissions: [] }
  try {
    localStorage.setItem('alatas-vehicle-reports', JSON.stringify(empty))
  } catch {
    try {
      localStorage.removeItem('alatas-vehicle-reports')
    } catch {
      /* ignore */
    }
  }
  try {
    await pushVehicleReportsToCloud(empty)
  } catch (err) {
    console.warn('Could not push empty vehicle reports after clear', err)
  }
  // Also clear per-vehicle mirrors if any vehicles remain.
  if (isSupabaseConfigured) {
    try {
      const { requireSupabase } = await import('./supabaseClient')
      const sb = requireSupabase()
      await sb
        .from('vehicles')
        .update({ report_entries: [], updated_at: new Date().toISOString() })
        .neq('id', '')
    } catch (err) {
      console.warn('Could not clear vehicle report_entries mirrors', err)
    }
  }
  return empty
}
