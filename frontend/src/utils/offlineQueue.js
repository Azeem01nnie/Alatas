const QUEUE_KEY = 'alatas-offline-queue'
export const OFFLINE_QUEUE_EVENT = 'alatas-offline-queue-change'

function emit(detail = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT, { detail }))
  }
}

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
  emit({ pending: items.length })
}

export function getOfflineQueue() {
  return readQueue()
}

export function enqueueOfflineOp(op) {
  const queue = readQueue()
  queue.push({
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: '',
    ...op,
  })
  writeQueue(queue)
  return queue.length
}

export function clearOfflineQueue() {
  writeQueue([])
}

export function getOfflineQueueStatus() {
  const entries = readQueue()
  const failed = entries.filter((item) => item.lastError)
  return {
    pending: entries.length,
    failed: failed.length,
    latestError: failed.at(-1)?.lastError || '',
    entries,
  }
}

export async function flushOfflineQueue(handlers) {
  const queue = readQueue()
  if (!queue.length) return { flushed: 0, remaining: 0, failed: 0, latestError: '' }

  const remaining = []
  let flushed = 0
  let failed = 0
  let latestError = ''

  for (const item of queue) {
    try {
      const handler = handlers[item.type]
      if (!handler) {
        latestError = `No sync handler for ${item.type}`
        failed += 1
        remaining.push({ ...item, lastError: latestError })
        continue
      }
      await handler(item.payload)
      flushed += 1
    } catch (err) {
      latestError = String(err?.message || err || 'Sync failed').slice(0, 500)
      failed += 1
      remaining.push({
        ...item,
        attempts: Number(item.attempts || 0) + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: latestError,
      })
    }
  }

  writeQueue(remaining)
  return { flushed, remaining: remaining.length, failed, latestError }
}
