const ARCHIVE_KEY = 'alatas-archived-vehicles'
export const ARCHIVE_EVENT = 'alatas-archive-changed'

function notifyArchiveChanged() {
  try {
    window.dispatchEvent(new Event(ARCHIVE_EVENT))
  } catch {
    /* ignore */
  }
}

export function loadArchivedVehicles() {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveArchivedVehicles(list) {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list))
  } catch {
    /* ignore quota */
  }
  notifyArchiveChanged()
}

export function getArchivedIdSet() {
  return new Set(loadArchivedVehicles().map((v) => String(v.id)))
}

export function archiveVehicleSnapshot(vehicle) {
  if (!vehicle?.id) return loadArchivedVehicles()
  const prev = loadArchivedVehicles()
  const id = String(vehicle.id)
  const next = [
    {
      ...vehicle,
      archivedAt: new Date().toISOString(),
    },
    ...prev.filter((v) => String(v.id) !== id),
  ]
  saveArchivedVehicles(next)
  return next
}

export function restoreArchivedVehicle(id) {
  const key = String(id)
  const next = loadArchivedVehicles().filter((v) => String(v.id) !== key)
  saveArchivedVehicles(next)
  return next
}

export function removeFromArchiveStore(id) {
  return restoreArchivedVehicle(id)
}
