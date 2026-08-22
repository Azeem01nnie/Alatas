const QUEUE_KEY = 'alatas-offline-queue'

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
}

export function getOfflineQueue() {
  return readQueue()
}

export function enqueueOfflineOp(op) {
  const queue = readQueue()
  queue.push({
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...op,
  })
  writeQueue(queue)
  return queue.length
}

export function clearOfflineQueue() {
  writeQueue([])
}

export async function flushOfflineQueue(handlers) {
  const queue = readQueue()
  if (!queue.length) return { flushed: 0, remaining: 0 }

  const remaining = []
  let flushed = 0

  for (const item of queue) {
    try {
      const handler = handlers[item.type]
      if (!handler) {
        remaining.push(item)
        continue
      }
      await handler(item.payload)
      flushed += 1
    } catch {
      remaining.push(item)
    }
  }

  writeQueue(remaining)
  return { flushed, remaining: remaining.length }
}
