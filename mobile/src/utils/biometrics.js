import * as LocalAuthentication from 'expo-local-authentication'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const ENROLL_KEY = 'alatas-mobile-biometrics'

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
