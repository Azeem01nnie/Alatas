import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildNotificationKeys,
  countUnseenNotificationKeys,
  loadSeenNotificationKeys,
  markNotificationKeysSeen,
} from '../utils/notificationSeen';

export function useNotificationsSeen(upcomingNotices, pendingRentals) {
  const [seenKeys, setSeenKeys] = useState(new Set());
  const [ready, setReady] = useState(false);

  const allKeys = useMemo(
    () => buildNotificationKeys(upcomingNotices, pendingRentals),
    [upcomingNotices, pendingRentals],
  );

  const unseenCount = useMemo(
    () => (ready ? countUnseenNotificationKeys(allKeys, seenKeys) : allKeys.length),
    [allKeys, seenKeys, ready],
  );

  useEffect(() => {
    let mounted = true;
    loadSeenNotificationKeys().then((keys) => {
      if (mounted) {
        setSeenKeys(new Set(keys));
        setReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const markAllSeen = useCallback(async () => {
    const merged = await markNotificationKeysSeen(allKeys);
    setSeenKeys(new Set(merged));
  }, [allKeys]);

  return {
    unseenCount,
    markAllSeen,
    hasNotifications: allKeys.length > 0,
  };
}
