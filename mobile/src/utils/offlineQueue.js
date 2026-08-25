import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'alatas-mobile-offline-queue';

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function getOfflineQueueLength() {
  const queue = await readQueue();
  return queue.length;
}

export async function enqueueOfflineOp(op) {
  const queue = await readQueue();
  queue.push({
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...op,
  });
  await writeQueue(queue);
  return queue.length;
}

export async function flushOfflineQueue(handlers) {
  const queue = await readQueue();
  if (!queue.length) return { flushed: 0, remaining: 0 };

  const remaining = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      const handler = handlers[item.type];
      if (!handler) {
        remaining.push(item);
        continue;
      }
      await handler(item.payload);
      flushed += 1;
    } catch {
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
  return { flushed, remaining: remaining.length };
}
