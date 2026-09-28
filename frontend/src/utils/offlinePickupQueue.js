import { reportAppError } from './errorMonitor'

const DB_NAME = 'alatas-offline-media'
const DB_VERSION = 1
const STORE_NAME = 'pickup-queue'
export const OFFLINE_PICKUP_EVENT = 'alatas-offline-pickup-change'

function emit(detail = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_PICKUP_EVENT, { detail }))
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Offline media storage is unavailable in this browser'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not open offline media storage'))
  })
}

async function withStore(mode, action) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = action(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Offline media queue failed'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error || new Error('Offline media queue failed'))
    }
  })
}

export async function enqueueOfflinePickup(rentalId, pickup) {
  const id = `pickup-${String(rentalId)}-${Date.now()}`
  const row = {
    id,
    rentalId: String(rentalId),
    pickup,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: '',
  }
  await withStore('readwrite', (store) => store.put(row))
  emit({ type: 'queued', id })
  return row
}

export async function getOfflinePickupQueue() {
  const rows = await withStore('readonly', (store) => store.getAll())
  return Array.isArray(rows) ? rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []
}

export async function getOfflinePickupStatus() {
  try {
    const entries = await getOfflinePickupQueue()
    const failed = entries.filter((row) => row.lastError)
    return {
      pending: entries.length,
      failed: failed.length,
      latestError: failed.at(-1)?.lastError || '',
      entries,
    }
  } catch (err) {
    return { pending: 0, failed: 1, latestError: err?.message || String(err), entries: [] }
  }
}

export async function flushOfflinePickups(handler) {
  const entries = await getOfflinePickupQueue()
  let flushed = 0
  let failed = 0
  let latestError = ''

  for (const row of entries) {
    try {
      await handler(row.rentalId, row.pickup)
      await withStore('readwrite', (store) => store.delete(row.id))
      flushed += 1
    } catch (err) {
      latestError = String(err?.message || err || 'Pickup sync failed').slice(0, 500)
      failed += 1
      await withStore('readwrite', (store) =>
        store.put({
          ...row,
          attempts: Number(row.attempts || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: latestError,
        }),
      )
      reportAppError(err, { area: 'sync', operation: `pickup ${row.rentalId}` })
    }
  }

  const result = { flushed, remaining: entries.length - flushed, failed, latestError }
  emit({ type: 'flushed', ...result })
  return result
}

