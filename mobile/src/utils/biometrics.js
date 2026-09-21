import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const ENROLL_KEY = 'alatas-mobile-biometrics'
const SESSION_VAULT_KEY = 'alatas-mobile-bio-session'

export async function getBiometricLabel() {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
    const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    const hasFinger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
    if (hasFace && Platform.OS === 'ios') return 'Face ID'
    if (hasFace) return 'Face unlock'
    if (hasFinger) return 'Fingerprint'
    return 'Biometrics'
  } catch {
    return 'Biometrics'
  }
}

export async function isBiometricsAvailable() {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync()
    if (!compatible) return false
    const enrolled = await LocalAuthentication.isEnrolledAsync()
    return Boolean(enrolled)
  } catch {
    return false
  }
}

export async function loadBiometricEnrollment() {
  try {
    const raw = await AsyncStorage.getItem(ENROLL_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed?.enabled || !parsed?.username) return null
    return parsed
  } catch {
    return null
  }
}

export async function saveBiometricEnrollment(profile) {
  const payload = {
    enabled: true,
    username: String(profile?.username || '').trim(),
    displayName: profile?.displayName || '',
    role: profile?.role || 'employee',
    enrolledAt: new Date().toISOString(),
  }
  await AsyncStorage.setItem(ENROLL_KEY, JSON.stringify(payload))
  return payload
}

export async function clearBiometricEnrollment() {
  await AsyncStorage.removeItem(ENROLL_KEY)
  await clearBiometricSessionVault()
}

/** Persist Supabase tokens so fingerprint works across many app locks / restarts. */
export async function saveBiometricSessionVault(session) {
  if (!session?.access_token || !session?.refresh_token) return false
  const enrollment = await loadBiometricEnrollment()
  if (!enrollment?.enabled) return false
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || null,
    savedAt: new Date().toISOString(),
  })
  try {
    await SecureStore.setItemAsync(SESSION_VAULT_KEY, payload, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
    return true
  } catch {
    // Fallback without iOS-only options (e.g. some Android builds)
    await SecureStore.setItemAsync(SESSION_VAULT_KEY, payload)
    return true
  }
}

export async function loadBiometricSessionVault() {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_VAULT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.access_token || !parsed?.refresh_token) return null
    return parsed
  } catch {
    return null
  }
}

export async function clearBiometricSessionVault() {
  try {
    await SecureStore.deleteItemAsync(SESSION_VAULT_KEY)
  } catch {
    /* ignore */
  }
}

export async function promptBiometrics(promptMessage) {
  const label = await getBiometricLabel()
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: promptMessage || `Unlock Alatas with ${label}`,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    biometricsSecurityLevel: 'strong',
  })
  if (!result.success) {
    throw new Error(result.error === 'user_cancel' ? 'Cancelled.' : `${label} failed. Try again.`)
  }
  return true
}
