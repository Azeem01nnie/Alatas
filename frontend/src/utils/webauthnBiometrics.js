/**
 * WebAuthn platform biometrics for the Alatas PWA (Face ID / fingerprint / Windows Hello).
 * Supports Conditional UI (autofill on the username field) + modal unlock.
 * Soft-lock keeps a Supabase session vault so unlock works after Sign out
 * while the refresh token is still valid.
 */

const STORAGE_KEY = 'alatas-webauthn-biometrics'
const SESSION_VAULT_KEY = 'alatas-webauthn-session-vault'

function bufferToBase64Url(buffer) {
  const bytes =
    buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer || buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBuffer(value) {
  const padded = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(String(value || '').length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function randomChallenge(size = 32) {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytes.buffer
}

export function isWebAuthnAvailable() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials?.create === 'function' &&
    typeof navigator.credentials?.get === 'function'
  )
}

export async function isPlatformAuthenticatorAvailable() {
  if (!isWebAuthnAvailable()) return false
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    }
  } catch {
    return false
  }
  return true
}

export async function isConditionalMediationAvailable() {
  if (!isWebAuthnAvailable()) return false
  try {
    if (typeof PublicKeyCredential.isConditionalMediationAvailable === 'function') {
      return await PublicKeyCredential.isConditionalMediationAvailable()
    }
  } catch {
    return false
  }
  return false
}

export function loadBiometricEnrollment() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed?.credentialId || !parsed?.username) return null
    return parsed
  } catch {
    return null
  }
}

export function clearBiometricEnrollment() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  clearBiometricSessionVault()
}

function saveEnrollment(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

/** Persist Supabase tokens so fingerprint works across soft locks / restarts. */
export function saveBiometricSessionVault(session) {
  if (!session?.access_token || !session?.refresh_token) return false
  if (!loadBiometricEnrollment()?.credentialId) return false
  try {
    localStorage.setItem(
      SESSION_VAULT_KEY,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at || null,
        savedAt: new Date().toISOString(),
      }),
    )
    return true
  } catch {
    return false
  }
}

export function loadBiometricSessionVault() {
  try {
    const raw = localStorage.getItem(SESSION_VAULT_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed?.access_token || !parsed?.refresh_token) return null
    return parsed
  } catch {
    return null
  }
}

export function clearBiometricSessionVault() {
  try {
    localStorage.removeItem(SESSION_VAULT_KEY)
  } catch {
    /* ignore */
  }
}

export async function vaultCurrentSupabaseSession(sb) {
  if (!sb?.auth?.getSession) return false
  const {
    data: { session },
  } = await sb.auth.getSession()
  return saveBiometricSessionVault(session)
}

/**
 * Register a platform authenticator for this device + account.
 * Uses a discoverable (resident) credential when the platform supports it
 * so Conditional UI can offer the passkey in the username autofill.
 */
export async function enrollBiometrics(profile) {
  if (!(await isPlatformAuthenticatorAvailable())) {
    throw new Error('Biometrics are not available on this device or browser.')
  }

  const username = String(profile?.username || '').trim()
  if (!username) throw new Error('Username is required to enable biometrics.')

  const userId = new TextEncoder().encode(`alatas:${username}`.slice(0, 64))
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: {
        name: 'Alatas Car Rental',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: username,
        displayName: profile?.displayName || username,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
        requireResidentKey: false,
      },
      timeout: 60_000,
      attestation: 'none',
    },
  })

  if (!credential?.rawId) {
    throw new Error('Biometric enrollment was cancelled.')
  }

  const enrollment = {
    credentialId: bufferToBase64Url(credential.rawId),
    username,
    displayName: profile?.displayName || username,
    role: profile?.role || 'employee',
    sessionUser: profile?.sessionUser || {
      username,
      displayName: profile?.displayName || username,
      role: profile?.role || 'employee',
    },
    enrolledAt: new Date().toISOString(),
  }
  saveEnrollment(enrollment)
  return enrollment
}

function buildPublicKeyRequest(enrollment) {
  return {
    challenge: randomChallenge(),
    timeout: 60_000,
    userVerification: 'required',
    rpId: window.location.hostname,
    allowCredentials: [
      {
        type: 'public-key',
        id: base64UrlToBuffer(enrollment.credentialId),
        transports: ['internal'],
      },
    ],
  }
}

/** Modal biometric prompt. */
export async function assertBiometrics() {
  const enrollment = loadBiometricEnrollment()
  if (!enrollment?.credentialId) {
    throw new Error('Biometrics are not set up on this device yet.')
  }
  if (!(await isPlatformAuthenticatorAvailable())) {
    throw new Error('Biometrics are not available on this device or browser.')
  }

  const assertion = await navigator.credentials.get({
    publicKey: buildPublicKeyRequest(enrollment),
  })

  if (!assertion) {
    throw new Error('Biometric sign-in was cancelled.')
  }

  return enrollment
}

/**
 * Conditional UI: pending get() that resolves when the user picks a passkey
 * from the username field autofill (or rejects / aborts otherwise).
 */
export async function assertBiometricsConditional(signal) {
  const enrollment = loadBiometricEnrollment()
  if (!enrollment?.credentialId) {
    throw new Error('Biometrics are not set up on this device yet.')
  }
  if (!(await isConditionalMediationAvailable())) {
    throw new Error('Passkey autofill is not available in this browser.')
  }

  const assertion = await navigator.credentials.get({
    publicKey: buildPublicKeyRequest(enrollment),
    mediation: 'conditional',
    signal,
  })

  if (!assertion) {
    throw new Error('Biometric sign-in was cancelled.')
  }

  return enrollment
}

export function biometricLabel() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  if (/iPhone|iPad|Mac/.test(ua)) return 'Face ID / Touch ID'
  if (/Android/i.test(ua)) return 'Fingerprint'
  return 'Windows Hello / Biometrics'
}
