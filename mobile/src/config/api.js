import { Platform } from 'react-native';

const CLOUD_URL = (
  process.env.EXPO_PUBLIC_API_URL || 'https://alatas.onrender.com'
).replace(/\/$/, '');

function devLocalUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_DEV_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  // Android emulator maps 10.0.2.2 → host machine localhost
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://127.0.0.1:4000';
}

/** In dev, use the desk backend (npm start) unless EXPO_PUBLIC_USE_CLOUD=true */
export const API_URL =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_USE_CLOUD !== 'true'
    ? devLocalUrl()
    : CLOUD_URL;

export const API_CONFIGURED = Boolean(API_URL);
