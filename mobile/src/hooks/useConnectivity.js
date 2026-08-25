import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useConnectivity() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsub();
  }, []);

  return { online, offline: !online };
}
