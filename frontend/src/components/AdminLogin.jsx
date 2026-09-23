import { useEffect, useRef, useState } from 'react'
import logoLight from '../assets/logo.jpg'
import { requireSupabase } from '../api/supabaseClient'
import { recordLoginAudit } from '../utils/loginAudit'
import {
  clearCsrfToken,
  ensureCsrfToken,
  getDeviceFingerprint,
  isSuspiciousLogin,
  rememberFingerprint,
  sanitizeUsername,
} from '../utils/security'
import {
  assertBiometrics,
  assertBiometricsConditional,
  biometricLabel,
  clearBiometricEnrollment,
  clearBiometricSessionVault,
  enrollBiometrics,
  isConditionalMediationAvailable,
  isPlatformAuthenticatorAvailable,
  loadBiometricEnrollment,
  loadBiometricSessionVault,
  vaultCurrentSupabaseSession,
} from '../utils/webauthnBiometrics'

const AUTH_KEY = 'customer-encoder-admin-auth'
const ROLE_KEY = 'alatas-session-role'
const USER_KEY = 'alatas-session-user'

export function isAdminLoggedIn() {
  return sessionStorage.getItem(AUTH_KEY) === '1'
}

export function getSessionRole() {
  const stored = sessionStorage.getItem(ROLE_KEY)
  if (stored === 'employee' || stored === 'admin') return stored
  try {
    const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null')
    if (user?.role === 'employee' || user?.role === 'admin') return user.role
  } catch {
    // ignore
  }
  return 'admin'
}

export function getSessionUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

/**
 * Soft lock when biometrics are enrolled: clear desk UI session but keep
 * Supabase tokens in the vault so Conditional UI / fingerprint can unlock.
 * Pass { hard: true } to fully sign out and wipe biometric vault.
 */
export function clearAdminSession(options = {}) {
  const hard = Boolean(options?.hard)
  const enrolled = Boolean(loadBiometricEnrollment()?.credentialId)

  sessionStorage.removeItem(AUTH_KEY)
  sessionStorage.removeItem(ROLE_KEY)
  sessionStorage.removeItem(USER_KEY)
  clearCsrfToken()

  if (hard || !enrolled) {
    clearBiometricSessionVault()
    if (hard) clearBiometricEnrollment()
    try {
      requireSupabase().auth.signOut()
    } catch {
      // ignore if supabase not ready
    }
    return
  }

  // Soft lock: refresh vault from live session, then drop only the desk flag.
  try {
    const sb = requireSupabase()
    vaultCurrentSupabaseSession(sb).catch(() => {})
  } catch {
    // ignore
  }
}

function toAuthEmail(username) {
  const u = username.trim()
  if (u.includes('@')) return u
  return `${u}@alatas.local`
}

/** Re-check admin username/password before destructive actions (e.g. Clear data). */
export async function verifyAdminCredentials(username, password) {
  const trimmedUser = sanitizeUsername(username)
  const trimmedPass = String(password || '')
  if (!trimmedUser || !trimmedPass) {
    throw new Error('Enter admin username and password.')
  }

  const sb = requireSupabase()
  const email = toAuthEmail(trimmedUser)
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password: trimmedPass,
  })
  if (error) {
    throw new Error('Invalid admin username or password.')
  }

  const user = data?.user
  const metaRole = user?.app_metadata?.role || user?.user_metadata?.role || ''
  const isAdmin =
    metaRole === 'admin' ||
    trimmedUser.toLowerCase() === 'alatas' ||
    String(user?.email || '')
      .toLowerCase()
      .includes('alatas@alatas.local')

  if (!isAdmin) {
    throw new Error('Only the admin account can clear all data.')
  }

  return true
}

function SeatbeltRail() {
  return (
    <div className="login-seatbelt-rail" aria-hidden="true">
      <svg
        className="login-seatbelt"
        viewBox="0 0 400 28"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <pattern
            id="seatbelt-weave"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-38)"
          >
            <rect width="8" height="8" fill="#1c1c1c" />
            <rect width="4" height="8" fill="#2f2f2f" />
            <rect width="8" height="1.5" fill="#3a3a3a" />
            <rect y="4" width="8" height="1" fill="#141414" />
          </pattern>
          <linearGradient id="seatbelt-depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="35%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <rect width="400" height="28" fill="url(#seatbelt-weave)" />
        <rect width="400" height="28" fill="url(#seatbelt-depth)" />
        <rect y="0" width="400" height="1.5" fill="#0a0a0a" opacity="0.55" />
        <rect y="26.5" width="400" height="1.5" fill="#000" opacity="0.45" />
      </svg>
    </div>
  )
}

function IconEye({ crossed = false }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
      {crossed && <path d="M4 20 20 4" />}
    </svg>
  )
}

async function resolveSessionUser(sb, usernameInput) {
  const trimmed = sanitizeUsername(usernameInput)
  const {
    data: { user },
  } = await sb.auth.getUser()

  const metaRole =
    user?.app_metadata?.role || user?.user_metadata?.role || ''
  const isAdmin =
    metaRole === 'admin' ||
    trimmed.toLowerCase() === 'alatas' ||
    (user?.email || '').toLowerCase() === 'alatas@alatas.local'

  let displayName =
    user?.user_metadata?.displayName ||
    (isAdmin ? 'Alatas Admin' : trimmed)
  let username = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed

  if (!isAdmin) {
    const { data: emp } = await sb
      .from('employees')
      .select('name, username, role, active')
      .ilike('username', username)
      .maybeSingle()
    if (emp) {
      if (emp.active === false) {
        throw new Error('This employee account is inactive.')
      }
      displayName = emp.name || emp.username || displayName
      username = emp.username || username
    }
  }

  return {
    role: isAdmin ? 'admin' : 'employee',
    displayName,
    username,
  }
}

function applyDeskSession(sessionUser) {
  ensureCsrfToken()
  sessionStorage.setItem(AUTH_KEY, '1')
  sessionStorage.setItem(ROLE_KEY, sessionUser.role)
  sessionStorage.setItem(USER_KEY, JSON.stringify(sessionUser))
}

export default function AdminLogin({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [conditionalOk, setConditionalOk] = useState(false)
  const [enrollment, setEnrollment] = useState(() => loadBiometricEnrollment())
  const [enrollPrompt, setEnrollPrompt] = useState(null)
  const [bioLabel, setBioLabel] = useState('Biometrics')
  const conditionalAbortRef = useRef(null)
  const finishingBioRef = useRef(false)

  useEffect(() => {
    setBioLabel(biometricLabel())
    let cancelled = false
    ;(async () => {
      const platform = await isPlatformAuthenticatorAvailable()
      const conditional = await isConditionalMediationAvailable()
      if (cancelled) return
      setBioAvailable(platform)
      setConditionalOk(conditional)
      setEnrollment(loadBiometricEnrollment())
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const finishSuccessfulLogin = async (
    sb,
    sessionUser,
    { viaBiometrics = false, enterDesk = true } = {},
  ) => {
    const fp = getDeviceFingerprint()
    const suspicious = isSuspiciousLogin(fp)

    if (suspicious) {
      await recordLoginAudit({
        username: sessionUser.username,
        role: sessionUser.role,
        status: 'suspicious',
        detail: viaBiometrics
          ? 'Biometric unlock from an unrecognized device/browser'
          : 'Successful sign-in from an unrecognized device/browser',
        suspicious: true,
      })
      setNotice(
        'Suspicious login: this device was not recognized. If this was not you, change your password.',
      )
    } else {
      await recordLoginAudit({
        username: sessionUser.username,
        role: sessionUser.role,
        status: 'success',
        detail: viaBiometrics
          ? `Unlocked with ${biometricLabel()}`
          : 'Signed in successfully over HTTPS',
      })
    }
    rememberFingerprint(fp)
    await vaultCurrentSupabaseSession(sb)
    if (enterDesk) {
      applyDeskSession(sessionUser)
      onSuccess(sessionUser)
    }
  }

  const unlockWithEnrollment = async (enrolled) => {
    if (finishingBioRef.current) return
    finishingBioRef.current = true
    setLoading(true)
    setError('')
    try {
      const sb = requireSupabase()
      const vault = loadBiometricSessionVault()
      if (vault?.access_token && vault?.refresh_token) {
        const { error: setErr } = await sb.auth.setSession({
          access_token: vault.access_token,
          refresh_token: vault.refresh_token,
        })
        if (setErr) {
          clearBiometricSessionVault()
          throw new Error(
            `Session expired. Sign in with password once, then use ${biometricLabel()} again.`,
          )
        }
      } else {
        const {
          data: { session },
        } = await sb.auth.getSession()
        if (!session) {
          throw new Error(
            `Session expired. Sign in with password once, then use ${biometricLabel()} again.`,
          )
        }
      }

      const sessionUser =
        enrolled.sessionUser ||
        (await resolveSessionUser(sb, enrolled.username))
      await finishSuccessfulLogin(sb, sessionUser, { viaBiometrics: true })
      setEnrollPrompt(null)
    } catch (err) {
      setError(err?.message || `Could not unlock with ${biometricLabel()}.`)
    } finally {
      finishingBioRef.current = false
      setLoading(false)
    }
  }

  // Conditional UI: listen for passkey autofill on the username field after soft lock / logout.
  useEffect(() => {
    if (!enrollment?.credentialId || !conditionalOk || loading || enrollPrompt) return undefined

    const abort = new AbortController()
    conditionalAbortRef.current = abort

    ;(async () => {
      try {
        const enrolled = await assertBiometricsConditional(abort.signal)
        if (abort.signal.aborted) return
        await unlockWithEnrollment(enrolled)
      } catch (err) {
        if (abort.signal.aborted) return
        const name = err?.name || ''
        if (name === 'AbortError' || name === 'NotAllowedError') return
        // Stay quiet for autofill cancellations; password form remains available.
      }
    })()

    return () => {
      abort.abort()
      conditionalAbortRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when enroll / capability changes
  }, [enrollment?.credentialId, conditionalOk, enrollPrompt])

  const handleBiometricClick = async () => {
    if (loading) return
    setError('')
    setLoading(true)
    try {
      conditionalAbortRef.current?.abort()
      const enrolled = await assertBiometrics()
      await unlockWithEnrollment(enrolled)
    } catch (err) {
      setError(err?.message || `Could not unlock with ${biometricLabel()}.`)
      setLoading(false)
    }
  }

  const handleEnrollAccept = async () => {
    if (!enrollPrompt || loading) return
    setLoading(true)
    setError('')
    try {
      const next = await enrollBiometrics(enrollPrompt)
      await vaultCurrentSupabaseSession(requireSupabase())
      setEnrollment(next)
      setEnrollPrompt(null)
      applyDeskSession(enrollPrompt.sessionUser)
      onSuccess(enrollPrompt.sessionUser, {
        toast: `${biometricLabel()} successfully added on this device.`,
      })
    } catch (err) {
      setError(err?.message || 'Could not enable biometrics.')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollSkip = () => {
    const sessionUser = enrollPrompt?.sessionUser
    setEnrollPrompt(null)
    if (sessionUser) {
      applyDeskSession(sessionUser)
      onSuccess(sessionUser)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setNotice('')
    setLoading(true)
    const safeUser = sanitizeUsername(username)

    try {
      conditionalAbortRef.current?.abort()
      const sb = requireSupabase()
      const email = toAuthEmail(safeUser)
      const { error: authError } = await sb.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) {
        await recordLoginAudit({
          username: safeUser || 'unknown',
          role: safeUser.toLowerCase() === 'alatas' ? 'admin' : 'employee',
          status: 'failed',
          detail: 'Invalid username or password',
        })
        setError(authError.message || 'Invalid username or password.')
        setLoading(false)
        return
      }

      const sessionUser = await resolveSessionUser(sb, safeUser)
      const shouldOfferEnroll =
        bioAvailable && !loadBiometricEnrollment()?.credentialId

      await finishSuccessfulLogin(sb, sessionUser, {
        enterDesk: !shouldOfferEnroll,
      })

      if (shouldOfferEnroll) {
        setEnrollPrompt({
          username: sessionUser.username,
          displayName: sessionUser.displayName,
          role: sessionUser.role,
          sessionUser,
        })
        setLoading(false)
        return
      }

      setLoading(false)
    } catch (err) {
      try {
        requireSupabase().auth.signOut()
      } catch {
        // ignore
      }
      await recordLoginAudit({
        username: safeUser || 'unknown',
        role: safeUser.toLowerCase() === 'alatas' ? 'admin' : 'employee',
        status: 'failed',
        detail: err?.message || 'Sign-in error',
      })
      setError(err?.message || 'Could not sign in. Check Supabase connection.')
      setLoading(false)
    }
  }

  const showBioButton = Boolean(enrollment?.credentialId && bioAvailable)

  return (
    <main className="login-card">
      <div className="login-brand">
        <SeatbeltRail />
        <div className="login-logo-plate">
          <img
            src={logoLight}
            alt="Alatas Car Rental Services"
            className="login-logo"
          />
        </div>
      </div>

      <div className="login-copy">
        <h1>Sign in</h1>
        <p>Admin and employee access to the fleet desk.</p>
      </div>

      {loading && !enrollPrompt ? (
        <div className="login-loading" aria-live="polite" aria-busy="true">
          <div className="loader" aria-hidden="true" />
          <p>Signing you in…</p>
        </div>
      ) : enrollPrompt ? (
        <div className="login-enroll-panel">
          <h2 className="login-enroll-title">Enable {bioLabel}?</h2>
          <p className="login-enroll-copy">
            Next time, tap the username field or use {bioLabel} to unlock this desk
            after signing out — no password needed while your session is valid.
          </p>
          {error && <span className="error-msg">{error}</span>}
          <div className="login-enroll-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={loading}
              onClick={handleEnrollAccept}
            >
              {loading ? 'Enabling…' : `Enable ${bioLabel}`}
            </button>
            <button
              type="button"
              className="btn-outline"
              disabled={loading}
              onClick={handleEnrollSkip}
            >
              Not now
            </button>
          </div>
        </div>
      ) : (
        <form className="login-form" onSubmit={handleSubmit} autoComplete="on">
          {showBioButton ? (
            <>
              <button
                type="button"
                className="btn-primary login-bio-btn"
                onClick={handleBiometricClick}
                disabled={loading}
              >
                Sign in with {bioLabel}
              </button>
              <p className="login-bio-hint">
                {conditionalOk
                  ? `Or tap Username — your browser can offer ${bioLabel} autofill.`
                  : 'Or sign in with password below.'}
              </p>
              <div className="login-divider" aria-hidden="true">
                <span>or</span>
              </div>
            </>
          ) : null}

          <label className="field">
            <span className="field-label">Username</span>
            <input
              type="text"
              name="username"
              value={username}
              onChange={(e) => {
                setUsername(sanitizeUsername(e.target.value))
                setError('')
              }}
              autoComplete={conditionalOk ? 'username webauthn' : 'username'}
              disabled={loading}
              maxLength={64}
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <div className="login-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <IconEye crossed={showPassword} />
              </button>
            </div>
          </label>

          {error && <span className="error-msg">{error}</span>}
          {notice && (
            <span className="login-security-notice" role="status">
              {notice}
            </span>
          )}

          <button type="submit" className="btn-primary login-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      )}
    </main>
  )
}
