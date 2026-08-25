import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'alatas-mobile-notifications-seen';

export function buildNotificationKeys(upcomingNotices = [], pendingRentals = []) {
  const keys = [];
  pendingRentals.forEach((rental) => {
    if (rental?.id) keys.push(`pending:${rental.id}`);
  });
  upcomingNotices.forEach((notice) => {
    if (notice?.id) keys.push(`upcoming:${notice.id}`);
  });
  return keys;
}

export async function loadSeenNotificationKeys() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSeenNotificationKeys(keys) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}

export async function markNotificationKeysSeen(keys) {
  const existing = new Set(await loadSeenNotificationKeys());
  keys.forEach((key) => existing.add(key));
  const merged = [...existing];
  await saveSeenNotificationKeys(merged);
  return merged;
}

export function countUnseenNotificationKeys(allKeys, seenKeys) {
  const seen = seenKeys instanceof Set ? seenKeys : new Set(seenKeys);
  return allKeys.filter((key) => !seen.has(key)).length;
}
